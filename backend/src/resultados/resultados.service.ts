import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ExamenService } from '../examen/examen.service';
import { GRADOS } from '../common/grados';
import { GRANATE, escribirEncabezados, escribirTitulo, nombreArchivo } from '../common/excel';

const CLAVE = 'resultados_config';

/** Para buscar sin que estorben los acentos ni las mayúsculas. */
const sinTildes = (texto: string) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Las dos tandas, que se trabajan por separado.
 *
 * Primero las delegaciones cuyo tutor mandó sus propias respuestas; después
 * las que llenó la comisión, que son las que conviene mirar con más calma.
 * Cada una se revisa, se desempata y se publica por su cuenta.
 */
export type Ola = 'tutores' | 'comision';

export type EstadoResultado = 'CLASIFICA' | 'NO_CLASIFICA' | 'EN_EVALUACION' | 'EMPATE';

export interface Agrupacion {
  id: string;
  nombre: string;
  delegacionId: string | null;
  miembros: string[];
}

export interface ConfigResultados {
  porcentaje: number;
  manual: Record<string, 'CLASIFICA' | 'NO_CLASIFICA'>;
  agrupaciones: Agrupacion[];
  /** Publicar abre los resultados a los tutores, cada uno en su cuenta. */
  publicado: Record<Ola, boolean>;
  publicadoEn: Record<Ola, string | null>;
  /** Qué supervisores pueden entrar a esta sección. El admin siempre puede. */
  encargados: string[];
  actualizado: string;
}

const VACIA: ConfigResultados = {
  porcentaje: 30,
  manual: {},
  agrupaciones: [],
  publicado: { tutores: false, comision: false },
  publicadoEn: { tutores: null, comision: null },
  encargados: [],
  actualizado: '',
};

interface Alumno {
  clave: string;
  tutorId: string;
  institucion: string;
  tutor: string;
  celular: string;
  dni: string;
  nombres: string;
  categoria: string;
  puntaje: number;
  ola: Ola;
}

export interface Resultado extends Alumno {
  grupoId: string;
  grupoNombre: string;
  agrupado: boolean;
  puesto: number;
  estado: EstadoResultado;
  manual: boolean;
  /** Entró con el mismo puntaje del último cupo. Pasa igual. */
  empatado: boolean;
}

/**
 * Resultados de la etapa institucional.
 *
 * Cada delegación compite consigo misma: dentro de una categoría clasifican
 * los mejores de esa misma institución, no los mejores del concurso. De ahí
 * que el corte se calcule pozo por pozo y no sobre una tabla general.
 *
 * No hay tabla nueva: lo único que se guarda son las decisiones de la
 * comisión. Los puntajes se vuelven a leer del examen en cada cálculo, para
 * que corregir una respuesta siga arrastrando hasta aquí.
 */
@Injectable()
export class ResultadosService {
  private readonly log = new Logger('Resultados');

  constructor(
    private prisma: PrismaService,
    private examen: ExamenService,
  ) {}

  // ---------------------------------------------------------------- configuración

  async config(): Promise<ConfigResultados> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVE } });
    if (!fila?.valor) return this.vacia();

    try {
      const guardada = JSON.parse(fila.valor);
      return {
        ...this.vacia(),
        ...guardada,
        manual: guardada.manual || {},
        agrupaciones: guardada.agrupaciones || [],
        encargados: guardada.encargados || [],
        publicado: { ...VACIA.publicado, ...guardada.publicado },
        publicadoEn: { ...VACIA.publicadoEn, ...guardada.publicadoEn },
      };
    } catch {
      return this.vacia();
    }
  }

  private vacia(): ConfigResultados {
    return {
      ...VACIA,
      manual: {},
      agrupaciones: [],
      encargados: [],
      publicado: { ...VACIA.publicado },
      publicadoEn: { ...VACIA.publicadoEn },
    };
  }

  private async guardar(config: ConfigResultados) {
    config.actualizado = new Date().toISOString();
    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE },
      create: { clave: CLAVE, valor: JSON.stringify(config) },
      update: { valor: JSON.stringify(config) },
    });
    return config;
  }

  /** Los supervisores del equipo, marcando a los que están a cargo. */
  async encargados() {
    const [config, supervisores] = await Promise.all([
      this.config(),
      this.prisma.admin.findMany({
        where: { rol: 'SUPERVISOR' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nombre: true, correo: true },
      }),
    ]);

    return supervisores.map((s) => ({ ...s, aCargo: config.encargados.includes(s.id) }));
  }

  async cambiarEncargado(id: string, aCargo: boolean) {
    const supervisor = await this.prisma.admin.findUnique({ where: { id } });
    if (!supervisor || supervisor.rol !== 'SUPERVISOR') {
      throw new NotFoundException('Ese supervisor no existe');
    }

    const config = await this.config();
    config.encargados = aCargo
      ? [...new Set([...config.encargados, id])]
      : config.encargados.filter((x) => x !== id);

    await this.guardar(config);
    this.log.warn(
      `${supervisor.nombre} ${aCargo ? 'queda a cargo de' : 'sale de'} los resultados.`,
    );
    return this.encargados();
  }

  /** Lo que pregunta el panel para saber si muestra la sección. */
  async puedeEntrar(usuario: { sub: string; rol: string }) {
    if (usuario.rol === 'ADMIN') return { puede: true };
    if (usuario.rol !== 'SUPERVISOR') return { puede: false };

    const { encargados } = await this.config();
    return { puede: encargados.includes(usuario.sub) };
  }

  // ----------------------------------------------------------------- el cálculo

  /**
   * Cuántos pasan de un pozo de `n` estudiantes.
   *
   * Es el porcentaje redondeado hacia arriba: con 4 pasan 2, con 7 pasan 3,
   * con 11 pasan 4. Nunca hacia abajo, porque dejaría sin cupo a categorías
   * chicas que sí tienen derecho a uno.
   */
  cupos(n: number, porcentaje = 30) {
    if (n <= 1) return 0;
    return Math.max(1, Math.ceil((n * porcentaje) / 100));
  }

  private async alumnos(): Promise<Alumno[]> {
    const entregas = await this.examen.entregas();
    const tutores = await this.prisma.tutor.findMany({
      where: { id: { in: entregas.map((e) => e.tutorId) } },
      select: { id: true, nombres: true, apellidos: true, celular: true },
    });
    const porId = new Map(tutores.map((t) => [t.id, t]));

    const lista: Alumno[] = [];
    for (const entrega of entregas) {
      const completa = await this.examen.entregaDe(entrega.tutorId);
      const tutor = porId.get(entrega.tutorId);

      for (const fila of completa?.filas || []) {
        lista.push({
          clave: `${entrega.tutorId}:${fila.dni}`,
          tutorId: entrega.tutorId,
          institucion: entrega.institucion,
          tutor: tutor ? `${tutor.nombres} ${tutor.apellidos}`.trim() : '',
          celular: tutor?.celular || '',
          dni: fila.dni,
          nombres: fila.nombres,
          categoria: fila.categoria,
          puntaje: fila.puntaje,
          ola: entrega.porComision ? 'comision' : 'tutores',
        });
      }
    }

    return lista;
  }

  /**
   * La tabla completa.
   *
   * El cálculo es uno solo porque los pozos pueden cruzar tandas: a un
   * estudiante que quedó solo se le junta con la delegación que sea. La tanda
   * de cada resultado la decide su pozo, no su origen, que es lo que hace que
   * «donde compite» y «dónde se publica» sean siempre lo mismo.
   */
  async calcular() {
    const [config, alumnos] = await Promise.all([this.config(), this.alumnos()]);

    const pozoDe = new Map<string, { id: string; nombre: string; agrupado: boolean }>();
    for (const a of alumnos) {
      pozoDe.set(a.clave, { id: a.tutorId, nombre: a.institucion, agrupado: false });
    }

    for (const grupo of config.agrupaciones) {
      for (const miembro of grupo.miembros) {
        if (!alumnos.some((a) => a.clave === miembro)) continue;

        if (grupo.delegacionId) {
          const anfitriona = alumnos.find((a) => a.tutorId === grupo.delegacionId);
          pozoDe.set(miembro, {
            id: grupo.delegacionId,
            nombre: anfitriona?.institucion || grupo.nombre,
            agrupado: true,
          });
        } else {
          pozoDe.set(miembro, { id: `grupo:${grupo.id}`, nombre: grupo.nombre, agrupado: true });
        }
      }
    }

    // La tanda del pozo: la de su delegación, o la de la comisión cuando es un
    // grupo armado a mano, que es donde se trabajan los sueltos.
    const olaDelPozo = (pozoId: string): Ola => {
      if (pozoId.startsWith('grupo:')) return 'comision';
      return alumnos.find((a) => a.tutorId === pozoId)?.ola || 'comision';
    };

    const pozos = new Map<string, Alumno[]>();
    for (const a of alumnos) {
      const pozo = pozoDe.get(a.clave)!;
      const llave = `${pozo.id}|${a.categoria}`;
      if (!pozos.has(llave)) pozos.set(llave, []);
      pozos.get(llave)!.push(a);
    }

    const resultados: Resultado[] = [];

    for (const [, lista] of pozos) {
      lista.sort((a, b) => b.puntaje - a.puntaje || a.nombres.localeCompare(b.nombres, 'es'));

      const cupos = this.cupos(lista.length, config.porcentaje);
      const corte = cupos > 0 ? lista[cupos - 1].puntaje : null;
      const mejores = corte === null ? 0 : lista.filter((a) => a.puntaje > corte).length;
      const empatados = corte === null ? 0 : lista.filter((a) => a.puntaje === corte).length;
      // Empatados en el corte: pasan todos, aunque el pozo se pase del cupo.
      // Desempatar a mano sería inventar un criterio que nadie acordó.
      const huboEmpate = corte !== null && empatados > cupos - mejores;

      lista.forEach((alumno, i) => {
        const pozo = pozoDe.get(alumno.clave)!;
        const decision = config.manual[alumno.clave];

        let estado: EstadoResultado;
        if (lista.length === 1) estado = 'EN_EVALUACION';
        else if (corte === null) estado = 'NO_CLASIFICA';
        else estado = alumno.puntaje >= corte ? 'CLASIFICA' : 'NO_CLASIFICA';

        resultados.push({
          ...alumno,
          ola: olaDelPozo(pozo.id),
          grupoId: pozo.id,
          grupoNombre: pozo.nombre,
          agrupado: pozo.agrupado,
          puesto: i + 1,
          estado: decision || estado,
          manual: Boolean(decision),
          empatado: huboEmpate && corte !== null && alumno.puntaje === corte,
        });
      });
    }

    resultados.sort(
      (a, b) =>
        a.grupoNombre.localeCompare(b.grupoNombre, 'es') ||
        a.categoria.localeCompare(b.categoria) ||
        a.puesto - b.puesto,
    );

    return { config, resultados };
  }

  /** Alias de `calcular`: la tabla ya sale con las dos tandas marcadas. */
  async calcularTodo() {
    return this.calcular();
  }

  private resumir(resultados: Resultado[], config: ConfigResultados, ola?: Ola) {
    const cuenta = (estado: EstadoResultado) => resultados.filter((r) => r.estado === estado).length;

    return {
      ola: ola || null,
      estudiantes: resultados.length,
      clasifican: cuenta('CLASIFICA'),
      noClasifican: cuenta('NO_CLASIFICA'),
      enEvaluacion: cuenta('EN_EVALUACION'),
      empates: resultados.filter((r) => r.empatado).length,
      // Lo único que frena una publicación es quien sigue sin resolver.
      pendientes: cuenta('EN_EVALUACION'),
      delegaciones: new Set(resultados.map((r) => r.grupoId)).size,
      publicado: config.publicado,
      publicadoEn: config.publicadoEn,
      porcentaje: config.porcentaje,
    };
  }

  /** Los pozos de una tanda, que es como se revisa en pantalla. */
  async porDelegacion(ola?: Ola) {
    const { resultados: todos, config } = await this.calcular();
    const resultados = ola ? todos.filter((r) => r.ola === ola) : todos;

    const grupos = new Map<string, any>();
    for (const r of resultados) {
      const llave = `${r.ola}|${r.grupoId}|${r.categoria}`;
      if (!grupos.has(llave)) {
        grupos.set(llave, {
          llave,
          grupoId: r.grupoId,
          grupoNombre: r.grupoNombre,
          categoria: r.categoria,
          grado: GRADOS.find((g) => g.categoria === r.categoria)?.label || '',
          tutor: r.tutor,
          celular: r.celular,
          ola: r.ola,
          alumnos: [],
        });
      }
      grupos.get(llave).alumnos.push(r);
    }

    const lista = [...grupos.values()].map((g) => ({
      ...g,
      total: g.alumnos.length,
      cupos: this.cupos(g.alumnos.length, config.porcentaje),
      clasifican: g.alumnos.filter((a: Resultado) => a.estado === 'CLASIFICA').length,
      pendientes: g.alumnos.filter(
        (a: Resultado) => a.estado === 'EMPATE' || a.estado === 'EN_EVALUACION',
      ).length,
    }));

    return {
      grupos: lista,
      resumen: this.resumir(resultados, config, ola),
      agrupaciones: config.agrupaciones,
    };
  }

  /** El tablero final: cada tanda y el total, para publicar lo general. */
  async general() {
    const { resultados, config } = await this.calcular();

    return {
      tutores: this.resumir(
        resultados.filter((r) => r.ola === 'tutores'),
        config,
        'tutores',
      ),
      comision: this.resumir(
        resultados.filter((r) => r.ola === 'comision'),
        config,
        'comision',
      ),
      total: this.resumir(resultados, config),
      categorias: this.porCategoria(resultados.filter((r) => r.estado === 'CLASIFICA')),
    };
  }

  private porCategoria(lista: Resultado[]) {
    return [...new Set(lista.map((r) => r.categoria))].sort().map((categoria) => ({
      categoria,
      grado: GRADOS.find((g) => g.categoria === categoria)?.label || '',
      clasifican: lista.filter((r) => r.categoria === categoria).length,
    }));
  }

  // --------------------------------------------------------------- decisiones

  async decidir(clave: string, estado: 'CLASIFICA' | 'NO_CLASIFICA' | null, ola?: Ola) {
    const config = await this.config();

    if (estado === null) delete config.manual[clave];
    else config.manual[clave] = estado;

    await this.guardar(config);
    this.log.warn(`Decisión manual sobre ${clave}: ${estado ?? 'se devolvió al cálculo'}.`);
    return this.porDelegacion(ola);
  }

  async crearAgrupacion(datos: { nombre?: string; delegacionId?: string | null }) {
    const config = await this.config();
    const nombre = (datos.nombre || '').trim();

    if (!datos.delegacionId && !nombre) {
      throw new BadRequestException('Póngale un nombre al grupo');
    }

    const grupo: Agrupacion = {
      id: randomUUID(),
      nombre: nombre || 'Agrupación',
      delegacionId: datos.delegacionId || null,
      miembros: [],
    };

    config.agrupaciones.push(grupo);
    await this.guardar(config);
    return grupo;
  }

  async cambiarAgrupacion(id: string, datos: { nombre?: string; miembros?: string[] }, ola?: Ola) {
    const config = await this.config();
    const grupo = config.agrupaciones.find((g) => g.id === id);
    if (!grupo) throw new NotFoundException('Ese grupo no existe');

    if (datos.nombre !== undefined) grupo.nombre = datos.nombre.trim() || grupo.nombre;
    if (datos.miembros !== undefined) {
      // Nadie puede estar en dos pozos a la vez.
      grupo.miembros = [...new Set(datos.miembros)];
      for (const otro of config.agrupaciones) {
        if (otro.id === id) continue;
        otro.miembros = otro.miembros.filter((m) => !grupo.miembros.includes(m));
      }
    }

    await this.guardar(config);
    return this.porDelegacion(ola);
  }

  async borrarAgrupacion(id: string, ola?: Ola) {
    const config = await this.config();
    config.agrupaciones = config.agrupaciones.filter((g) => g.id !== id);
    await this.guardar(config);
    return this.porDelegacion(ola);
  }

  /**
   * Quiénes están solos en su categoría, de las dos tandas.
   *
   * No se separan por tanda a propósito: a uno que quedó solo se le junta con
   * la delegación que haga falta, venga de donde venga, y partir la lista
   * obligaría a buscarlo en dos pantallas.
   */
  async individuales() {
    const { resultados } = await this.calcular();

    const porPozo = new Map<string, number>();
    for (const r of resultados) {
      const llave = `${r.grupoId}|${r.categoria}`;
      porPozo.set(llave, (porPozo.get(llave) || 0) + 1);
    }

    return resultados
      .filter((r) => porPozo.get(`${r.grupoId}|${r.categoria}`) === 1)
      .sort(
        (a, b) =>
          a.categoria.localeCompare(b.categoria) || a.nombres.localeCompare(b.nombres, 'es'),
      );
  }

  /** Quiénes entraron por empate. Es informativo: todos ellos clasifican. */
  async empates(ola?: Ola) {
    const { resultados } = await this.calcular();
    return resultados.filter((r) => r.empatado && (!ola || r.ola === ola));
  }

  async cambiarPorcentaje(porcentaje: number, ola?: Ola) {
    const valor = Number(porcentaje);
    if (!Number.isFinite(valor) || valor < 1 || valor > 100) {
      throw new BadRequestException('El porcentaje debe estar entre 1 y 100');
    }

    const config = await this.config();
    config.porcentaje = Math.round(valor);
    await this.guardar(config);
    return this.porDelegacion(ola);
  }

  // --------------------------------------------------------------- publicación

  async publicar(ola: Ola, publicado: boolean) {
    if (ola !== 'tutores' && ola !== 'comision') {
      throw new BadRequestException('Tanda desconocida');
    }

    const config = await this.config();
    config.publicado[ola] = publicado;
    config.publicadoEn[ola] = publicado ? new Date().toISOString() : null;
    await this.guardar(config);

    this.log.warn(`Resultados de la tanda «${ola}»: ${publicado ? 'publicados' : 'ocultados'}.`);
    return this.general();
  }

  /** El botón del final: las dos tandas de una vez. */
  async publicarGeneral(publicado: boolean) {
    const config = await this.config();
    const cuando = publicado ? new Date().toISOString() : null;

    for (const ola of ['tutores', 'comision'] as Ola[]) {
      config.publicado[ola] = publicado;
      config.publicadoEn[ola] = cuando;
    }

    await this.guardar(config);
    this.log.warn(`Resultados generales: ${publicado ? 'publicados' : 'ocultados'}.`);
    return this.general();
  }

  /**
   * Lo que ve un tutor en su cuenta.
   *
   * Sus propios estudiantes, publicados o no según la tanda en que hayan
   * competido: a uno que se agrupó con otra delegación le toca la tanda de
   * esa, y por eso se mira pozo por pozo y no la del tutor.
   */
  async miClasificacion(tutorId: string) {
    const { resultados, config } = await this.calcular();
    const mios = resultados.filter((r) => r.tutorId === tutorId && config.publicado[r.ola]);

    if (mios.length === 0) return { publicado: false, categorias: [], resumen: null };

    const categorias = [...new Set(mios.map((r) => r.categoria))].sort().map((categoria) => ({
      categoria,
      grado: GRADOS.find((g) => g.categoria === categoria)?.label || '',
      alumnos: mios
        .filter((r) => r.categoria === categoria)
        .sort((a, b) => b.puntaje - a.puntaje || a.nombres.localeCompare(b.nombres, 'es'))
        .map((r) => ({
          nombres: r.nombres,
          dni: r.dni,
          puntaje: r.puntaje,
          puesto: r.puesto,
          clasifica: r.estado === 'CLASIFICA',
          enEvaluacion: r.estado === 'EN_EVALUACION',
          empatado: r.empatado,
          // Si compitió en otro pozo, hay que decirlo: su puesto es de ahí.
          compitioEn: r.grupoNombre !== r.institucion ? r.grupoNombre : null,
        })),
    }));

    return {
      publicado: true,
      institucion: mios[0].institucion,
      categorias,
      resumen: {
        estudiantes: mios.length,
        clasifican: mios.filter((r) => r.estado === 'CLASIFICA').length,
      },
    };
  }

  /**
   * La búsqueda de la comisión.
   *
   * Es para atender a quien no puede entrar a su cuenta: se busca por
   * institución, tutor, nombre o DNI y se baja lo de esa delegación.
   */
  async buscar(texto: string) {
    const termino = sinTildes(texto);
    if (termino.length < 2) {
      throw new BadRequestException('Escriba al menos dos letras o el DNI');
    }

    const { resultados, config } = await this.calcular();
    const publicados = resultados.filter((r) => config.publicado[r.ola]);

    const coincide = (r: Resultado) =>
      sinTildes(`${r.institucion} ${r.tutor} ${r.nombres} ${r.dni}`).includes(termino);

    const tutores = [...new Set(publicados.filter(coincide).map((r) => r.tutorId))];

    return tutores
      .map((tutorId) => {
        const suyos = publicados.filter((r) => r.tutorId === tutorId);
        const primero = suyos[0];

        return {
          tutorId,
          institucion: primero.institucion,
          tutor: primero.tutor,
          celular: primero.celular,
          estudiantes: suyos.length,
          clasifican: suyos.filter((r) => r.estado === 'CLASIFICA').length,
          alumnos: suyos
            .sort(
              (a, b) =>
                a.categoria.localeCompare(b.categoria) ||
                b.puntaje - a.puntaje ||
                a.nombres.localeCompare(b.nombres, 'es'),
            )
            .map((r) => ({
              nombres: r.nombres,
              dni: r.dni,
              categoria: r.categoria,
              puntaje: r.puntaje,
              puesto: r.puesto,
              clasifica: r.estado === 'CLASIFICA',
              empatado: r.empatado,
            })),
        };
      })
      .sort((a, b) => a.institucion.localeCompare(b.institucion, 'es'));
  }

  /** El Excel de una sola delegación, para mandárselo a su tutor. */
  async excelDelegacion(tutorId: string): Promise<{ buffer: Buffer; nombre: string }> {
    const { resultados, config } = await this.calcular();
    const suyos = resultados.filter((r) => r.tutorId === tutorId && config.publicado[r.ola]);

    if (suyos.length === 0) {
      throw new NotFoundException('Esa delegación todavía no tiene resultados publicados');
    }

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet('Clasificación');

    const columnas = [
      { header: 'N°', width: 6 },
      { header: 'CATEGORÍA', width: 12 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 38 },
      { header: 'PUESTO', width: 10 },
      { header: 'PUNTAJE', width: 12 },
      { header: 'RESULTADO', width: 18 },
    ];

    const primero = suyos[0];
    escribirTitulo(
      hoja,
      columnas.length,
      primero.institucion,
      `Etapa institucional · ${primero.tutor} · clasifica el ${config.porcentaje}% de cada categoría`,
      suyos.length,
    );
    escribirEncabezados(hoja, columnas);

    suyos
      .sort(
        (a, b) =>
          a.categoria.localeCompare(b.categoria) ||
          b.puntaje - a.puntaje ||
          a.nombres.localeCompare(b.nombres, 'es'),
      )
      .forEach((r, i) => {
        const fila = hoja.addRow([
          i + 1,
          `CAT. ${r.categoria}`,
          r.dni,
          r.nombres,
          r.puesto,
          r.puntaje,
          ETIQUETAS[r.estado] + (r.empatado ? ' (empate)' : ''),
        ]);
        fila.getCell(3).numFmt = '@';
        fila.getCell(6).font = { bold: true, color: { argb: GRANATE } };
        fila.getCell(7).font = { bold: true, color: { argb: COLOR_ESTADO[r.estado] } };
      });

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(`clasificacion-${primero.institucion}`),
    };
  }

  // -------------------------------------------------------------------- Excel

  async excel(
    soloClasificados: boolean,
    ola?: Ola,
  ): Promise<{ buffer: Buffer; nombre: string }> {
    const { resultados: todos, config } = await this.calcular();
    const deLaTanda = ola ? todos.filter((r) => r.ola === ola) : todos;
    const lista = soloClasificados
      ? deLaTanda.filter((r) => r.estado === 'CLASIFICA')
      : deLaTanda;

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';

    const categorias = [...new Set(lista.map((r) => r.categoria))].sort();
    const deQuien = ola === 'tutores' ? ' · enviadas por los tutores' : ola === 'comision' ? ' · llenadas por la comisión' : '';

    for (const categoria of categorias) {
      const grado = GRADOS.find((g) => g.categoria === categoria);
      const hoja = libro.addWorksheet(`CAT. ${categoria}`);

      const columnas = [
        { header: 'N°', width: 6 },
        { header: 'INSTITUCIÓN EDUCATIVA', width: 40 },
        { header: 'TUTOR', width: 30 },
        { header: 'CELULAR', width: 14 },
        { header: 'DNI', width: 14 },
        { header: 'APELLIDOS Y NOMBRES', width: 38 },
        { header: 'PUESTO', width: 10 },
        { header: 'PUNTAJE', width: 12 },
        ...(soloClasificados ? [] : [{ header: 'ESTADO', width: 18 }]),
      ];

      const suyos = lista
        .filter((r) => r.categoria === categoria)
        .sort(
          (a, b) =>
            a.grupoNombre.localeCompare(b.grupoNombre, 'es') ||
            b.puntaje - a.puntaje ||
            a.nombres.localeCompare(b.nombres, 'es'),
        );

      escribirTitulo(
        hoja,
        columnas.length,
        soloClasificados
          ? `Clasificados · CAT. ${categoria} · ${grado?.label || ''}`
          : `Resultados · CAT. ${categoria} · ${grado?.label || ''}`,
        `Etapa institucional · clasifica el ${config.porcentaje}% de cada delegación${deQuien}`,
        suyos.length,
      );
      escribirEncabezados(hoja, columnas);

      suyos.forEach((r, i) => {
        const fila = hoja.addRow([
          i + 1,
          r.grupoNombre,
          r.tutor,
          r.celular,
          r.dni,
          r.nombres,
          r.puesto,
          r.puntaje,
          ...(soloClasificados ? [] : [ETIQUETAS[r.estado]]),
        ]);
        fila.getCell(5).numFmt = '@';
        fila.getCell(8).font = { bold: true, color: { argb: GRANATE } };

        if (!soloClasificados) {
          fila.getCell(9).font = { bold: true, color: { argb: COLOR_ESTADO[r.estado] } };
        }
      });
    }

    if (categorias.length === 0) {
      libro.addWorksheet('Sin datos').getCell('A1').value = 'Todavía no hay resultados.';
    }

    const sufijo = ola ? `-${ola}` : '';
    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(
        (soloClasificados ? 'clasificados-etapa-institucional' : 'resultados-etapa-institucional') +
          sufijo,
      ),
    };
  }
}

const ETIQUETAS: Record<EstadoResultado, string> = {
  CLASIFICA: 'Clasifica',
  NO_CLASIFICA: 'No clasifica',
  EN_EVALUACION: 'En evaluación',
  EMPATE: 'Empate',
};

const COLOR_ESTADO: Record<EstadoResultado, string> = {
  CLASIFICA: 'FF047857',
  NO_CLASIFICA: 'FF6B7280',
  EN_EVALUACION: 'FFB91C1C',
  EMPATE: 'FFB45309',
};
