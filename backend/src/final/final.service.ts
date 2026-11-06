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
 * Secundaria rinde temprano y primaria después, en las mismas aulas: por eso
 * los dos turnos numeran desde el mismo primer salón. El 101 de la mañana y el
 * 101 de media mañana son la misma puerta con gente distinta.
 */
export const ORDEN_NIVELES: NivelFinal[] = ['SECUNDARIA', 'PRIMARIA'];

export const NIVEL_TEXTO: Record<NivelFinal, string> = {
  SECUNDARIA: 'Secundaria',
  PRIMARIA: 'Primaria',
};

/** Como el número se repite entre turnos, un salón se nombra con los dos. */
export const idSalon = (nivel: NivelFinal, numero: number) => `${nivel}-${numero}`;

interface Bloque {
  inicio: string;
  fin: string;
}

export interface ConfigFinal {
  /** Cuántos entran por salón. */
  capacidad: number;
  /** El número del primer salón de cada turno; de ahí para arriba. */
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
  /** Viaja con el alumno: un salón puede acabar con varias si lo acomodan. */
  categoria: string;
  grado: string;
}

export interface Salon {
  numero: number;
  nivel: NivelFinal;
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
 * una. El reparto automático va categoría por categoría y dentro de cada una
 * por orden alfabético, de a treinta, porque es lo que menos trabajo da
 * después; pero una vez armado se acomoda a mano sin esa regla, que es como
 * se resuelven las cosas que el reparto no puede saber.
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
    if (datos.fecha !== undefined) config.fecha = String(datos.fecha).trim().slice(0, 60);

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
   * Cada turno numera desde el primer salón porque son las mismas aulas: a las
   * 8:30 entra secundaria al 101 y a las 10:30 entra primaria al mismo 101.
   *
   * Lo único que se respeta del reparto anterior es quién vigilaba cada aula:
   * el rol docente no cambia porque entre un alumno más.
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

    // Rehacer el reparto renumera todo, y las actas se guardan por salón: las
    // respuestas quedarían atribuidas a quien no se sentó ahí.
    const conActa = await this.salonesConActa();
    if (conActa.size > 0) {
      throw new BadRequestException(
        `Ya hay ${conActa.size} ${conActa.size === 1 ? 'salón que entregó' : 'salones que entregaron'} su acta. ` +
          'Anule esos envíos antes de volver a repartir, o acomode los salones a mano en Reparto de alumnos.',
      );
    }

    const responsablePrevio = new Map(
      (anterior?.salones || []).map((s) => [idSalon(s.nivel, s.numero), s.responsableId]),
    );

    const salones: Salon[] = [];

    for (const nivel of ORDEN_NIVELES) {
      let numero = config.primerSalon;

      for (const grado of GRADOS.filter((g) => g.nivel === nivel)) {
        const suyos = clasificados
          .filter((r) => r.categoria === grado.categoria)
          .sort((a, b) => a.nombres.localeCompare(b.nombres, 'es') || a.dni.localeCompare(b.dni));

        for (let i = 0; i < suyos.length; i += config.capacidad) {
          salones.push({
            numero,
            nivel,
            responsableId: responsablePrevio.get(idSalon(nivel, numero)) ?? null,
            alumnos: suyos.slice(i, i + config.capacidad).map((r) => ({
              dni: r.dni,
              nombres: r.nombres,
              institucion: r.institucion,
              tutorId: r.tutorId,
              categoria: r.categoria,
              grado: grado.label,
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

    const salones = (sorteo?.salones || []).map((s) => {
      const categorias = [...new Set(s.alumnos.map((a) => a.categoria))].sort();
      return {
        ...s,
        id: idSalon(s.nivel, s.numero),
        total: s.alumnos.length,
        horario: config.bloques[s.nivel],
        responsable: s.responsableId ? porId.get(s.responsableId) || null : null,
        // Ya entregó: su gente queda quieta hasta que se anule el envío.
        conActa: conActa.has(idSalon(s.nivel, s.numero)),
        // Acomodar a mano puede pasarse del cupo, y conviene que se vea.
        excedido: s.alumnos.length > config.capacidad,
        categorias,
        mezclado: categorias.length > 1,
      };
    });

    const repartidos = salones.reduce((suma, s) => suma + s.total, 0);

    return {
      config,
      responsables,
      salones,
      niveles: ORDEN_NIVELES.map((nivel) => ({
        nivel,
        texto: NIVEL_TEXTO[nivel],
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
        conActa: salones.filter((s) => s.conActa).length,
        excedidos: salones.filter((s) => s.excedido).length,
        mezclados: salones.filter((s) => s.mezclado).length,
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
        categoria: r.categoria,
        institucion: r.institucion,
        nivel: (GRADOS.find((g) => g.categoria === r.categoria)?.nivel ||
          'PRIMARIA') as NivelFinal,
      }));
  }

  // ------------------------------------------------------- acomodar a mano

  /**
   * Los salones que ya entregaron su acta, por su id.
   *
   * Ahí no se mueve a nadie: el acta se guardó con la gente que tenía ese
   * salón, y cambiarla después dejaría respuestas atribuidas a quien no se
   * sentó ahí. Se lee la fila del examen directamente para no atar este
   * servicio al del examen, que a su vez depende de este.
   */
  private async salonesConActa(): Promise<Set<string>> {
    const filas = await this.prisma.ajuste.findMany({
      where: { clave: { startsWith: 'examen_final_respuestas_' } },
      select: { clave: true },
    });
    return new Set(filas.map((f) => f.clave.replace('examen_final_respuestas_', '')));
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

  private trabado(conActa: Set<string>, ...salones: (Salon | undefined)[]) {
    const quieto = salones.find((s) => s && conActa.has(idSalon(s.nivel, s.numero)));
    if (quieto) {
      throw new BadRequestException(
        `El salón ${quieto.numero} de ${NIVEL_TEXTO[quieto.nivel].toLowerCase()} ya entregó su acta. ` +
          'Anule ese envío antes de tocar su gente.',
      );
    }
  }

  private buscarSalon(sorteo: Sorteo, nivel: string, numero: number) {
    const salon = sorteo.salones.find(
      (s) => s.nivel === nivel && s.numero === Number(numero),
    );
    if (!salon) throw new NotFoundException('Ese salón no existe en el reparto');
    return salon;
  }

  /**
   * Cambia a un alumno de salón.
   *
   * Dentro del turno se mueve a donde sea, aunque el salón lleve otra
   * categoría: cada examen se corrige con la clave del alumno y no con la del
   * aula, así que mezclar no rompe nada y a veces es la única forma de que
   * entren todos.
   *
   * De turno no se le cambia: el nivel decide a qué hora rinde, y mandarlo al
   * otro le pondría en la credencial una hora a la que no lo esperan.
   *
   * La capacidad tampoco frena el movimiento. El reparto automático la
   * respeta; esto es la excepción que se hace a mano.
   */
  async moverAlumno(dni: string, nivel: string, numero: number) {
    const sorteo = await this.sorteoVivo();
    const conActa = await this.salonesConActa();
    const limpio = String(dni || '').trim();

    const salon = this.buscarSalon(sorteo, nivel, numero);
    const origen = sorteo.salones.find((s) => s.alumnos.some((a) => a.dni === limpio));

    // Sin salón de origen puede ser que clasificara después de armar el
    // reparto: se le busca entre los clasificados y se le sienta, que es más
    // sano que rehacer el reparto entero por una persona.
    let alumno: AlumnoSalon | undefined = origen?.alumnos.find((a) => a.dni === limpio);

    if (!alumno) {
      const suelto = (await this.clasificados()).find((r) => r.dni === limpio);
      if (!suelto) throw new NotFoundException('Ese alumno no clasificó a la final');
      alumno = {
        dni: suelto.dni,
        nombres: suelto.nombres,
        institucion: suelto.institucion,
        tutorId: suelto.tutorId,
        categoria: suelto.categoria,
        grado: GRADOS.find((g) => g.categoria === suelto.categoria)?.label || '',
      };
    }

    if (origen && origen.nivel === salon.nivel && origen.numero === salon.numero) {
      return this.estado();
    }

    const nivelAlumno = GRADOS.find((g) => g.categoria === alumno.categoria)?.nivel;
    if (nivelAlumno !== salon.nivel) {
      throw new BadRequestException(
        `El salón ${salon.numero} es del turno de ${NIVEL_TEXTO[salon.nivel].toLowerCase()} y ` +
          `${alumno.nombres} rinde con ${NIVEL_TEXTO[nivelAlumno as NivelFinal].toLowerCase()}. ` +
          'Los dos turnos entran a distinta hora.',
      );
    }

    this.trabado(conActa, origen, salon);

    if (origen) origen.alumnos = origen.alumnos.filter((a) => a.dni !== limpio);
    salon.alumnos.push(alumno);
    salon.alumnos.sort((a, b) => a.nombres.localeCompare(b.nombres, 'es'));

    await this.guardarSorteo(sorteo);
    this.log.log(
      `${alumno.nombres} ${origen ? `pasó del salón ${origen.numero} al` : 'se sentó en el salón'} ${salon.numero} (${salon.nivel}).`,
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

    this.trabado(conActa, origen);

    const alumno = origen.alumnos.find((a) => a.dni === limpio);
    origen.alumnos = origen.alumnos.filter((a) => a.dni !== limpio);

    await this.guardarSorteo(sorteo);
    this.log.warn(`${alumno.nombres} salió del salón ${origen.numero} y quedó sin sentar.`);
    return this.estado();
  }

  /**
   * Abre un salón vacío en un turno.
   *
   * Toma el primer número libre de ese turno, así que reaprovecha el hueco de
   * uno cerrado. El salón nace sin categoría: la toma de quien se siente.
   */
  async crearSalon(nivel: string) {
    const sorteo = await this.sorteoVivo();
    if (!ORDEN_NIVELES.includes(nivel as NivelFinal)) {
      throw new BadRequestException('Ese turno no existe');
    }

    const ocupados = new Set(
      sorteo.salones.filter((s) => s.nivel === nivel).map((s) => s.numero),
    );
    let numero = sorteo.primerSalon;
    while (ocupados.has(numero)) numero += 1;

    sorteo.salones.push({
      numero,
      nivel: nivel as NivelFinal,
      responsableId: null,
      alumnos: [],
    });
    sorteo.salones.sort(
      (a, b) =>
        ORDEN_NIVELES.indexOf(a.nivel) - ORDEN_NIVELES.indexOf(b.nivel) || a.numero - b.numero,
    );

    await this.guardarSorteo(sorteo);
    this.log.log(`Se abrió el salón ${numero} de ${nivel}.`);
    return this.estado();
  }

  /** Cierra un salón. Tiene que estar vacío: nadie se borra de paso. */
  async borrarSalon(nivel: string, numero: number) {
    const sorteo = await this.sorteoVivo();
    const conActa = await this.salonesConActa();
    const salon = this.buscarSalon(sorteo, nivel, numero);

    if (salon.alumnos.length > 0) {
      throw new BadRequestException(
        `El salón ${salon.numero} todavía tiene ${salon.alumnos.length} alumnos. ` +
          'Muévalos a otro salón antes de cerrarlo.',
      );
    }
    this.trabado(conActa, salon);

    sorteo.salones = sorteo.salones.filter(
      (s) => !(s.nivel === salon.nivel && s.numero === salon.numero),
    );
    await this.guardarSorteo(sorteo);

    this.log.warn(`Se cerró el salón ${salon.numero} de ${salon.nivel}.`);
    return this.estado();
  }

  // ------------------------------------------------------------- responsables

  /** Las cuentas de la comisión que pueden quedar a cargo de un salón. */
  async responsables() {
    return this.prisma.admin.findMany({
      where: { rol: 'SUPERVISOR' },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, correo: true, dni: true },
    });
  }

  async asignar(nivel: string, numero: number, responsableId: string | null) {
    const sorteo = await this.sorteoVivo();
    const salon = this.buscarSalon(sorteo, nivel, numero);

    if (responsableId) {
      const cuenta = await this.prisma.admin.findUnique({ where: { id: responsableId } });
      if (!cuenta || cuenta.rol !== 'SUPERVISOR') {
        throw new BadRequestException('Esa cuenta no es de un supervisor');
      }
    }

    salon.responsableId = responsableId || null;
    await this.guardarSorteo(sorteo);

    return this.estado();
  }

  /** Los salones de un supervisor: lo único que ve en su panel. */
  async misSalones(usuarioId: string) {
    const { salones, config } = await this.estado();
    return {
      config,
      salones: salones.filter((s) => s.responsableId === usuarioId),
    };
  }

  /** ¿Este salón es suyo? El administrador entra a todos. */
  async puedeVerSalon(usuario: { sub: string; rol: string }, nivel: string, numero: number) {
    if (usuario.rol === 'ADMIN') return true;
    const sorteo = await this.sorteo();
    const salon = sorteo?.salones.find(
      (s) => s.nivel === nivel && s.numero === Number(numero),
    );
    return Boolean(salon && salon.responsableId === usuario.sub);
  }

  async salon(nivel: string, numero: number): Promise<Salon> {
    return this.buscarSalon(await this.sorteoVivo(), nivel, numero);
  }

  // --------------------------------------------------------------------- Excel

  /**
   * Las listas que se pegan en la puerta y se pasan en la mesa.
   *
   * Sin salón salen todas, una hoja por aula, que es como se imprime de una
   * sola vez la mañana del examen. La columna de categoría solo aparece cuando
   * el salón trae más de una: en los demás sería la misma palabra repetida.
   */
  async excel(
    filtros: { nivel?: string; numero?: number } = {},
  ): Promise<{ buffer: Buffer; nombre: string }> {
    const { config, salones } = await this.estado();

    let elegidos = salones;
    if (filtros.nivel) elegidos = elegidos.filter((s) => s.nivel === filtros.nivel);
    if (filtros.numero) elegidos = elegidos.filter((s) => s.numero === Number(filtros.numero));

    if (elegidos.length === 0) {
      throw new NotFoundException(
        salones.length === 0
          ? 'Todavía no se armó el reparto de salones'
          : 'No hay salones con esos filtros',
      );
    }

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';

    for (const salon of elegidos) {
      const sufijo = salon.nivel === 'SECUNDARIA' ? 'SEC' : 'PRI';
      const hoja = libro.addWorksheet(`${sufijo} ${salon.numero}`);

      const columnas = [
        { header: 'N°', width: 6 },
        { header: 'DNI', width: 14 },
        { header: 'APELLIDOS Y NOMBRES', width: 42 },
        { header: 'INSTITUCIÓN EDUCATIVA', width: 42 },
        ...(salon.mezclado ? [{ header: 'CAT.', width: 8 }] : []),
      ];

      escribirTitulo(
        hoja,
        columnas.length,
        `SALÓN ${salon.numero} · ${NIVEL_TEXTO[salon.nivel].toUpperCase()}` +
          (salon.mezclado ? '' : ` · CAT. ${salon.categorias[0] || '—'}`),
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
        const fila = hoja.addRow([
          i + 1,
          a.dni,
          a.nombres,
          a.institucion,
          ...(salon.mezclado ? [a.categoria] : []),
        ]);
        fila.getCell(2).numFmt = '@';
        fila.getCell(3).font = { bold: true, color: { argb: GRANATE } };
        fila.height = 24;
      });
    }

    const nombre = filtros.numero
      ? `salon-${filtros.numero}-${filtros.nivel || ''}`
      : filtros.nivel
        ? `salones-${filtros.nivel}`
        : 'salones-final-macrorregional';

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(nombre),
    };
  }
}
