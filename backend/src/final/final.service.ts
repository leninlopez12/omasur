import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ResultadosService } from '../resultados/resultados.service';
import { GRADOS } from '../common/grados';
import { GRANATE, escribirEncabezados, escribirTitulo, nombreArchivo } from '../common/excel';

const CLAVE_CONFIG = 'final_config';
const CLAVE_SALONES = 'final_salones';

export type NivelFinal = 'SECUNDARIA' | 'PRIMARIA';

/**
 * El orden del día.
 *
 * Secundaria rinde temprano y primaria después, y los salones se numeran
 * siguiendo ese mismo orden: así el número del salón dice a qué hora se entra,
 * sin que nadie tenga que cruzar dos listas.
 */
export const ORDEN_NIVELES: NivelFinal[] = ['SECUNDARIA', 'PRIMARIA'];

interface Bloque {
  inicio: string;
  fin: string;
}

export interface ConfigFinal {
  /** Cuántos entran por salón. */
  capacidad: number;
  /** El número del primer salón; de ahí para arriba, uno por uno. */
  primerSalon: number;
  sede: string;
  fecha: string;
  bloques: Record<NivelFinal, Bloque>;
  actualizado: string;
}

const CONFIG_VACIA: ConfigFinal = {
  capacidad: 30,
  primerSalon: 101,
  sede: '',
  fecha: '08 de noviembre de 2026',
  bloques: {
    SECUNDARIA: { inicio: '08:30', fin: '10:00' },
    PRIMARIA: { inicio: '10:30', fin: '12:00' },
  },
  actualizado: '',
};

export interface AlumnoSalon {
  dni: string;
  nombres: string;
  institucion: string;
  tutorId: string;
}

export interface Salon {
  numero: number;
  nivel: NivelFinal;
  categoria: string;
  grado: string;
  /** La cuenta de la comisión que vigila el salón y sube sus respuestas. */
  responsableId: string | null;
  alumnos: AlumnoSalon[];
}

export interface Sorteo {
  generadoEn: string;
  capacidad: number;
  primerSalon: number;
  salones: Salon[];
}

/**
 * La etapa final macrorregional: el reparto en salones.
 *
 * A la final llega quien clasificó en la institucional. Como es presencial y
 * en una sola sede, hay que repartirlos en aulas y decir quién vigila cada
 * una. El reparto es por categoría —cada categoría rinde su propia prueba, así
 * que mezclarlas en un salón obligaría a repartir dos exámenes distintos en la
 * misma puerta— y dentro de cada una por orden alfabético, de a treinta.
 *
 * El reparto se guarda, no se recalcula. Las listas se imprimen y se pegan en
 * las puertas: si cambiara solo porque alguien corrigió un DNI, el alumno
 * llegaría a un aula que ya no es la suya.
 *
 * Sin tabla nueva: el reparto y su configuración son dos filas de `Ajuste`.
 */
@Injectable()
export class FinalService {
  private readonly log = new Logger('Final');

  constructor(
    private prisma: PrismaService,
    private resultados: ResultadosService,
  ) {}

  // ------------------------------------------------------------- configuración

  async config(): Promise<ConfigFinal> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVE_CONFIG } });
    if (!fila?.valor) return this.vacia();

    try {
      const guardada = JSON.parse(fila.valor);
      return {
        ...this.vacia(),
        ...guardada,
        bloques: { ...CONFIG_VACIA.bloques, ...guardada.bloques },
      };
    } catch {
      return this.vacia();
    }
  }

  private vacia(): ConfigFinal {
    return { ...CONFIG_VACIA, bloques: { ...CONFIG_VACIA.bloques } };
  }

  async guardarConfig(datos: Partial<ConfigFinal>) {
    const config = await this.config();

    if (datos.capacidad !== undefined) {
      const n = Number(datos.capacidad);
      if (!Number.isInteger(n) || n < 1 || n > 200) {
        throw new BadRequestException('La capacidad del salón va de 1 a 200');
      }
      config.capacidad = n;
    }

    if (datos.primerSalon !== undefined) {
      const n = Number(datos.primerSalon);
      if (!Number.isInteger(n) || n < 1 || n > 9999) {
        throw new BadRequestException('El número del primer salón no es válido');
      }
      config.primerSalon = n;
    }

    if (datos.sede !== undefined) config.sede = String(datos.sede).trim().slice(0, 160);
    if (datos.fecha !== undefined) config.fecha = String(datos.fecha).trim().slice(0, 40);

    for (const nivel of ORDEN_NIVELES) {
      const bloque = datos.bloques?.[nivel];
      if (!bloque) continue;
      config.bloques[nivel] = {
        inicio: this.hora(bloque.inicio, config.bloques[nivel].inicio),
        fin: this.hora(bloque.fin, config.bloques[nivel].fin),
      };
    }

    config.actualizado = new Date().toISOString();
    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE_CONFIG },
      create: { clave: CLAVE_CONFIG, valor: JSON.stringify(config) },
      update: { valor: JSON.stringify(config) },
    });

    return config;
  }

  private hora(valor: unknown, porDefecto: string) {
    const texto = String(valor || '').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto) ? texto : porDefecto;
  }

  // ------------------------------------------------------------------ el sorteo

  /** El reparto guardado, o `null` si todavía no se armó. */
  async sorteo(): Promise<Sorteo | null> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVE_SALONES } });
    if (!fila?.valor) return null;
    try {
      const guardado = JSON.parse(fila.valor);
      return { ...guardado, salones: guardado.salones || [] };
    } catch {
      return null;
    }
  }

  /** Quiénes clasificaron, que son los que rinden la final. */
  private async clasificados() {
    const { resultados } = await this.resultados.calcular();
    return resultados.filter((r) => r.estado === 'CLASIFICA');
  }

  /**
   * Arma el reparto desde cero.
   *
   * Vuelve a repartir a todos, así que se pide a mano y la pantalla avisa de
   * lo que implica. Lo único que se respeta del reparto anterior es quién
   * vigilaba cada número de salón: el rol docente no cambia porque entre un
   * alumno más.
   */
  async generar() {
    const [config, clasificados, anterior] = await Promise.all([
      this.config(),
      this.clasificados(),
      this.sorteo(),
    ]);

    if (clasificados.length === 0) {
      throw new BadRequestException(
        'Todavía no hay clasificados de la etapa institucional: no hay a quién repartir.',
      );
    }

    // Rehacer el reparto renumera todo, y las actas se guardan por número de
    // salón: las respuestas quedarían atribuidas a quien no se sentó ahí.
    const conActa = await this.salonesConActa();
    if (conActa.size > 0) {
      throw new BadRequestException(
        `Ya hay ${conActa.size} ${conActa.size === 1 ? 'salón que entregó' : 'salones que entregaron'} su acta. ` +
          'Anule esos envíos antes de volver a repartir, o acomode los salones a mano en Reparto de alumnos.',
      );
    }

    const responsablePrevio = new Map(
      (anterior?.salones || []).map((s) => [s.numero, s.responsableId]),
    );

    const salones: Salon[] = [];
    let numero = config.primerSalon;

    for (const nivel of ORDEN_NIVELES) {
      for (const grado of GRADOS.filter((g) => g.nivel === nivel)) {
        const suyos = clasificados
          .filter((r) => r.categoria === grado.categoria)
          .sort((a, b) => a.nombres.localeCompare(b.nombres, 'es') || a.dni.localeCompare(b.dni));

        for (let i = 0; i < suyos.length; i += config.capacidad) {
          salones.push({
            numero,
            nivel,
            categoria: grado.categoria,
            grado: grado.label,
            responsableId: responsablePrevio.get(numero) ?? null,
            alumnos: suyos.slice(i, i + config.capacidad).map((r) => ({
              dni: r.dni,
              nombres: r.nombres,
              institucion: r.institucion,
              tutorId: r.tutorId,
            })),
          });
          numero += 1;
        }
      }
    }

    const sorteo: Sorteo = {
      generadoEn: new Date().toISOString(),
      capacidad: config.capacidad,
      primerSalon: config.primerSalon,
      salones,
    };

    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE_SALONES },
      create: { clave: CLAVE_SALONES, valor: JSON.stringify(sorteo) },
      update: { valor: JSON.stringify(sorteo) },
    });

    this.log.log(`Reparto de la final: ${salones.length} salones, ${clasificados.length} alumnos.`);
    return this.estado();
  }

  async borrarSorteo() {
    const conActa = await this.salonesConActa();
    if (conActa.size > 0) {
      throw new BadRequestException(
        'No se puede borrar el reparto: hay salones que ya entregaron su acta. Anule esos envíos primero.',
      );
    }

    await this.prisma.ajuste.deleteMany({ where: { clave: CLAVE_SALONES } });
    this.log.warn('Se borró el reparto de salones de la final.');
    return this.estado();
  }

  /**
   * Todo lo que necesita la pantalla: el reparto, quién vigila cada salón y si
   * lo repartido sigue cuadrando con los clasificados de hoy.
   */
  async estado() {
    const [config, sorteo, clasificados] = await Promise.all([
      this.config(),
      this.sorteo(),
      this.clasificados(),
    ]);

    const [responsables, conActa] = await Promise.all([
      this.responsables(),
      this.salonesConActa(),
    ]);
    const porId = new Map(responsables.map((r) => [r.id, r]));

    const salones = (sorteo?.salones || []).map((s) => ({
      ...s,
      total: s.alumnos.length,
      horario: config.bloques[s.nivel],
      responsable: s.responsableId ? porId.get(s.responsableId) || null : null,
      // Ya entregó: su gente queda quieta hasta que se anule el envío.
      conActa: conActa.has(s.numero),
      // Acomodar a mano puede pasarse del cupo, y conviene que se vea.
      excedido: s.alumnos.length > config.capacidad,
    }));

    const repartidos = salones.reduce((suma, s) => suma + s.total, 0);

    return {
      config,
      responsables,
      salones,
      niveles: ORDEN_NIVELES.map((nivel) => ({
        nivel,
        horario: config.bloques[nivel],
        salones: salones.filter((s) => s.nivel === nivel).length,
        alumnos: salones.filter((s) => s.nivel === nivel).reduce((n, s) => n + s.total, 0),
      })),
      resumen: {
        generadoEn: sorteo?.generadoEn || null,
        salones: salones.length,
        repartidos,
        clasificados: clasificados.length,
        // Si alguien clasificó —o dejó de clasificar— después del reparto, lo
        // impreso ya no coincide y hay que volver a armarlo.
        desfasado: Boolean(sorteo) && repartidos !== clasificados.length,
        sinResponsable: salones.filter((s) => !s.responsableId).length,
        // Con actas entregadas el reparto ya no se rehace entero.
        conActa: salones.filter((s) => s.conActa).length,
        excedidos: salones.filter((s) => s.excedido).length,
        // A quien no le tocó salón: pasa si lo sacaron de uno y nadie lo
        // volvió a sentar, o si clasificó después de armar el reparto.
        sinSalon: this.sinSalon(sorteo, clasificados),
      },
    };
  }

  /** Clasificados que no están sentados en ningún salón. */
  private sinSalon(
    sorteo: Sorteo | null,
    clasificados: { dni: string; nombres: string; categoria: string; institucion: string }[],
  ) {
    if (!sorteo) return [];
    const sentados = new Set(sorteo.salones.flatMap((s) => s.alumnos.map((a) => a.dni)));

    return clasificados
      .filter((r) => !sentados.has(r.dni))
      .map((r) => ({
        dni: r.dni,
        nombres: r.nombres,
        // La categoría viaja porque la pantalla solo puede ofrecerle los
        // salones de la suya.
        categoria: r.categoria,
        institucion: r.institucion,
      }));
  }

  // ------------------------------------------------------- acomodar a mano

  /**
   * Los salones que ya entregaron su acta.
   *
   * Ahí no se mueve a nadie: el acta se guardó con la gente que tenía ese
   * salón, y cambiarla después dejaría respuestas atribuidas a quien no se
   * sentó ahí. Se lee la fila del examen directamente para no atar este
   * servicio al del examen, que a su vez depende de este.
   */
  private async salonesConActa(): Promise<Set<number>> {
    const filas = await this.prisma.ajuste.findMany({
      where: { clave: { startsWith: 'examen_final_respuestas_' } },
      select: { clave: true },
    });
    return new Set(filas.map((f) => Number(f.clave.replace('examen_final_respuestas_', ''))));
  }

  private async sorteoVivo(): Promise<Sorteo> {
    const sorteo = await this.sorteo();
    if (!sorteo) throw new NotFoundException('Todavía no se armó el reparto de salones');
    return sorteo;
  }

  private async guardarSorteo(sorteo: Sorteo) {
    await this.prisma.ajuste.update({
      where: { clave: CLAVE_SALONES },
      data: { valor: JSON.stringify(sorteo) },
    });
  }

  private trabado(conActa: Set<number>, ...numeros: number[]) {
    const quieto = numeros.find((n) => conActa.has(n));
    if (quieto !== undefined) {
      throw new BadRequestException(
        `El salón ${quieto} ya entregó su acta. Anule ese envío antes de tocar su gente.`,
      );
    }
  }

  /**
   * Cambia a un alumno de salón.
   *
   * Solo entre salones de su misma categoría: el salón decide qué prueba se
   * reparte en esa puerta, así que mandarlo a uno de otra categoría le daría
   * un examen que no es el suyo.
   *
   * La capacidad no frena el movimiento. El reparto automático la respeta;
   * esto es la excepción que se hace a mano, y quien la hace sabe por qué.
   */
  async moverAlumno(dni: string, destino: number) {
    const sorteo = await this.sorteoVivo();
    const conActa = await this.salonesConActa();
    const limpio = String(dni || '').trim();

    const salon = sorteo.salones.find((s) => s.numero === Number(destino));
    if (!salon) throw new NotFoundException('Ese salón no existe en el reparto');

    const origen = sorteo.salones.find((s) => s.alumnos.some((a) => a.dni === limpio));

    // Sin salón de origen puede ser que clasificara después de armar el
    // reparto: se le busca entre los clasificados y se le sienta, que es más
    // sano que rehacer el reparto entero por una persona.
    let alumno: AlumnoSalon | undefined = origen?.alumnos.find((a) => a.dni === limpio);
    let categoria = origen?.categoria;

    if (!alumno) {
      const suelto = (await this.clasificados()).find((r) => r.dni === limpio);
      if (!suelto) {
        throw new NotFoundException('Ese alumno no clasificó a la final');
      }
      alumno = {
        dni: suelto.dni,
        nombres: suelto.nombres,
        institucion: suelto.institucion,
        tutorId: suelto.tutorId,
      };
      categoria = suelto.categoria;
    }

    if (origen?.numero === salon.numero) return this.estado();

    if (salon.categoria !== categoria) {
      throw new BadRequestException(
        `El salón ${salon.numero} es de la CAT. ${salon.categoria} y el alumno es de la CAT. ${categoria}. ` +
          'Cada salón rinde una sola prueba.',
      );
    }

    this.trabado(conActa, ...[origen?.numero, salon.numero].filter((n): n is number => !!n));

    if (origen) origen.alumnos = origen.alumnos.filter((a) => a.dni !== limpio);
    salon.alumnos.push(alumno);
    salon.alumnos.sort((a, b) => a.nombres.localeCompare(b.nombres, 'es'));

    await this.guardarSorteo(sorteo);
    this.log.log(
      `${alumno.nombres} ${origen ? `pasó del salón ${origen.numero} al` : 'se sentó en el salón'} ${salon.numero}.`,
    );
    return this.estado();
  }

  /** Saca a un alumno de su salón sin ponerlo en otro: queda a la espera. */
  async sacarAlumno(dni: string) {
    const sorteo = await this.sorteoVivo();
    const conActa = await this.salonesConActa();
    const limpio = String(dni || '').trim();

    const origen = sorteo.salones.find((s) => s.alumnos.some((a) => a.dni === limpio));
    if (!origen) throw new NotFoundException('Ese alumno no está sentado en ningún salón');

    this.trabado(conActa, origen.numero);

    const alumno = origen.alumnos.find((a) => a.dni === limpio);
    origen.alumnos = origen.alumnos.filter((a) => a.dni !== limpio);

    await this.guardarSorteo(sorteo);
    this.log.warn(`${alumno.nombres} salió del salón ${origen.numero} y quedó sin sentar.`);
    return this.estado();
  }

  /**
   * Abre un salón vacío para una categoría.
   *
   * Toma el primer número libre, que no tiene por qué caer junto a los de su
   * nivel: después de mover cosas a mano el número deja de decir la hora, y
   * por eso cada salón lleva su horario escrito en la lista que se imprime.
   */
  async crearSalon(categoria: string) {
    const sorteo = await this.sorteoVivo();
    const cat = String(categoria || '').trim().toUpperCase();

    const grado = GRADOS.find((g) => g.categoria === cat);
    if (!grado) throw new BadRequestException('Esa categoría no existe');

    const ocupados = new Set(sorteo.salones.map((s) => s.numero));
    let numero = sorteo.primerSalon;
    while (ocupados.has(numero)) numero += 1;

    sorteo.salones.push({
      numero,
      nivel: grado.nivel === 'SECUNDARIA' ? 'SECUNDARIA' : 'PRIMARIA',
      categoria: cat,
      grado: grado.label,
      responsableId: null,
      alumnos: [],
    });
    sorteo.salones.sort((a, b) => a.numero - b.numero);

    await this.guardarSorteo(sorteo);
    this.log.log(`Se abrió el salón ${numero} para la CAT. ${cat}.`);
    return this.estado();
  }

  /** Cierra un salón. Tiene que estar vacío: nadie se borra de paso. */
  async borrarSalon(numero: number) {
    const sorteo = await this.sorteoVivo();
    const conActa = await this.salonesConActa();

    const salon = sorteo.salones.find((s) => s.numero === Number(numero));
    if (!salon) throw new NotFoundException('Ese salón no existe en el reparto');

    if (salon.alumnos.length > 0) {
      throw new BadRequestException(
        `El salón ${salon.numero} todavía tiene ${salon.alumnos.length} alumnos. ` +
          'Muévalos a otro salón antes de cerrarlo.',
      );
    }
    this.trabado(conActa, salon.numero);

    sorteo.salones = sorteo.salones.filter((s) => s.numero !== salon.numero);
    await this.guardarSorteo(sorteo);

    this.log.warn(`Se cerró el salón ${salon.numero}.`);
    return this.estado();
  }

  // ------------------------------------------------------------- responsables

  /** Las cuentas de la comisión que pueden quedar a cargo de un salón. */
  async responsables() {
    const cuentas = await this.prisma.admin.findMany({
      where: { rol: 'SUPERVISOR' },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, correo: true, dni: true },
    });
    return cuentas;
  }

  async asignar(numero: number, responsableId: string | null) {
    const sorteo = await this.sorteo();
    if (!sorteo) throw new NotFoundException('Todavía no se armó el reparto de salones');

    const salon = sorteo.salones.find((s) => s.numero === Number(numero));
    if (!salon) throw new NotFoundException('Ese salón no existe en el reparto');

    if (responsableId) {
      const cuenta = await this.prisma.admin.findUnique({ where: { id: responsableId } });
      if (!cuenta || cuenta.rol !== 'SUPERVISOR') {
        throw new BadRequestException('Esa cuenta no es de un supervisor');
      }
    }

    salon.responsableId = responsableId || null;
    await this.prisma.ajuste.update({
      where: { clave: CLAVE_SALONES },
      data: { valor: JSON.stringify(sorteo) },
    });

    return this.estado();
  }

  /** Los salones de un supervisor: lo único que ve en su panel. */
  async misSalones(usuarioId: string) {
    const [config, sorteo] = await Promise.all([this.config(), this.sorteo()]);
    const suyos = (sorteo?.salones || []).filter((s) => s.responsableId === usuarioId);

    return {
      config,
      salones: suyos.map((s) => ({
        numero: s.numero,
        nivel: s.nivel,
        categoria: s.categoria,
        grado: s.grado,
        horario: config.bloques[s.nivel],
        total: s.alumnos.length,
        alumnos: s.alumnos,
      })),
    };
  }

  /** ¿Este salón es suyo? El administrador entra a todos. */
  async puedeVerSalon(usuario: { sub: string; rol: string }, numero: number) {
    if (usuario.rol === 'ADMIN') return true;
    const sorteo = await this.sorteo();
    const salon = sorteo?.salones.find((s) => s.numero === Number(numero));
    return Boolean(salon && salon.responsableId === usuario.sub);
  }

  async salon(numero: number): Promise<Salon> {
    const sorteo = await this.sorteo();
    const salon = sorteo?.salones.find((s) => s.numero === Number(numero));
    if (!salon) throw new NotFoundException('Ese salón no existe en el reparto');
    return salon;
  }

  // --------------------------------------------------------------------- Excel

  /**
   * Las listas que se pegan en la puerta y se firman en la mesa.
   *
   * Sin número de salón salen todas, una hoja por aula, que es como se imprime
   * de una sola vez la mañana del examen.
   */
  async excel(numero?: number): Promise<{ buffer: Buffer; nombre: string }> {
    const { config, salones } = await this.estado();
    const elegidos = numero ? salones.filter((s) => s.numero === Number(numero)) : salones;

    if (elegidos.length === 0) {
      throw new NotFoundException(
        numero ? 'Ese salón no existe en el reparto' : 'Todavía no se armó el reparto de salones',
      );
    }

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';

    for (const salon of elegidos) {
      const hoja = libro.addWorksheet(`SALÓN ${salon.numero}`);
      const columnas = [
        { header: 'N°', width: 6 },
        { header: 'DNI', width: 14 },
        { header: 'APELLIDOS Y NOMBRES', width: 40 },
        { header: 'INSTITUCIÓN EDUCATIVA', width: 40 },
        { header: 'FIRMA', width: 24 },
      ];

      escribirTitulo(
        hoja,
        columnas.length,
        `SALÓN ${salon.numero} · CAT. ${salon.categoria} · ${salon.grado}`,
        [
          `Final macrorregional${config.fecha ? ` · ${config.fecha}` : ''}`,
          `${salon.horario.inicio} a ${salon.horario.fin}`,
          config.sede,
          salon.responsable ? `Responsable: ${salon.responsable.nombre}` : 'Sin responsable asignado',
        ]
          .filter(Boolean)
          .join(' · '),
        salon.alumnos.length,
      );
      escribirEncabezados(hoja, columnas);

      salon.alumnos.forEach((a, i) => {
        const fila = hoja.addRow([i + 1, a.dni, a.nombres, a.institucion, '']);
        fila.getCell(2).numFmt = '@';
        fila.getCell(3).font = { bold: true, color: { argb: GRANATE } };
        fila.height = 26;
      });
    }

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(numero ? `salon-${numero}-final` : 'salones-final-macrorregional'),
    };
  }
}
