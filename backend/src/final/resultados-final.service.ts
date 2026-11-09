import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Modalidad } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CorregidoFinal, ExamenFinalService } from './examen-final.service';
import { ResultadosService } from '../resultados/resultados.service';
import { GRADOS } from '../common/grados';
import { GRANATE, escribirEncabezados, escribirTitulo, nombreArchivo } from '../common/excel';

const CLAVE = 'resultados_final_config';

/** Cuántos puestos entran en la premiación si nadie dice otra cosa. */
const PODIOS = 10;

const TITULO_POR_DEFECTO = 'RESULTADOS DE LA FINAL MACRORREGIONAL';

/** Lo que se proyecta debajo del lugar, en todas las láminas. */
const NOMBRE_CONCURSO = 'I OMASUR UNI 2026';

/** Los lugares que se llaman al estrado, del décimo al primero. */
const LUGARES = 10;

/** El nombre de cada lugar, para el titular de la lámina. */
const ORDINALES = [
  '',
  'PRIMER',
  'SEGUNDO',
  'TERCER',
  'CUARTO',
  'QUINTO',
  'SEXTO',
  'SÉPTIMO',
  'OCTAVO',
  'NOVENO',
  'DÉCIMO',
];

/**
 * Los dos ámbitos de la premiación, en el orden en que se proyectan.
 *
 * Estatales y particulares no compiten por el mismo premio, así que cada uno
 * tiene su tabla y su décimo lugar. La tabla que los mezcla no está aquí: esa
 * es la de siempre y vive en Resultados finales, que es donde se consulta,
 * no en el acto, donde se premia.
 */
const AMBITOS = [
  {
    id: 'PRIVADO',
    texto: 'Privado',
    detalle: 'Colegios particulares y grupos de estudio.',
  },
  { id: 'PUBLICO', texto: 'Público', detalle: 'Colegios estatales.' },
] as const;

/** Dónde compite una delegación. El general no es de nadie: es la suma. */
export type Ambito = 'PRIVADO' | 'PUBLICO';

/** Cómo se nombra al grupo entero, para los títulos y los archivos. */
const AMBITO_PLURAL: Record<Ambito, string> = { PRIVADO: 'privados', PUBLICO: 'públicos' };

/** Cómo se nombra la modalidad de una institución en la premiación. */
const MODALIDAD_TEXTO: Record<Modalidad, string> = {
  ESTATAL: 'Pública',
  PARTICULAR: 'Particular',
  GRUPO_ESTUDIO: 'Grupo de estudio',
};

/**
 * Lo que vale cada puesto para el campeonato de delegaciones.
 *
 * La escala baja de golpe en el podio y se aplana del cuarto para abajo: un
 * primer puesto no se compensa juntando quintos, y a la vez el cuarto y el
 * décimo valen lo mismo porque los dos son «estar entre los diez». Es la
 * tabla que fijó la comisión y no una fórmula nuestra.
 */
const PUNTOS_CAMPEONATO: Record<number, number> = { 1: 10, 2: 6, 3: 4 };

/** Del cuarto al décimo, todos suman esto. */
const PUNTOS_RESTO = 2;

/** Más abajo del décimo puesto ya no se suma nada. */
const PUESTOS_QUE_SUMAN = 10;

/** La escala, escrita para mostrarla tal cual en pantalla. */
const ESCALA_CAMPEONATO = [
  { texto: '1er puesto', puntos: PUNTOS_CAMPEONATO[1] },
  { texto: '2do puesto', puntos: PUNTOS_CAMPEONATO[2] },
  { texto: '3er puesto', puntos: PUNTOS_CAMPEONATO[3] },
  { texto: `Del 4to al ${PUESTOS_QUE_SUMAN}mo puesto`, puntos: PUNTOS_RESTO },
];

/** Cuántas delegaciones suben al estrado por el premio mayor. */
const CAMPEONES = 3;

/** Lo que se ve de una delegación en el campeonato. */
export interface CampeonFinal {
  tutorId: string;
  tutor: string;
  institucion: string;
  modalidad: Modalidad;
  modalidadTexto: string;
  ambito: Ambito;
  ambitoTexto: string;
  /** Su lugar en el campeonato, compartido si empata en todo lo que decide. */
  puesto: number;
  empatado: boolean;
  puntos: number;
  /** En cuántas categorías distintas puntuó, que es de lo que se trata. */
  categorias: number;
  categoriasTexto: string;
  /** Cuántos de sus alumnos entraron entre los diez primeros, y cuántos vinieron. */
  premiados: number;
  rindieron: number;
  primeros: number;
  segundos: number;
  terceros: number;
  /** Los puntos que suma cada alumno: el sustento del premio. */
  alumnos: {
    dni: string;
    nombres: string;
    categoria: string;
    grado: string;
    puesto: number;
    empatado: boolean;
    puntaje: number;
    puntos: number;
  }[];
}

export interface ConfigResultadosFinal {
  /** Abre los resultados en la cuenta de cada tutor. */
  publicado: boolean;
  publicadoEn: string | null;
  /** Abre la consulta por DNI en la página pública, que es otra cosa. */
  consultaActiva: boolean;
  tituloPublico: string;
  /** Cuántos puestos se premian por categoría. */
  puestos: number;
  actualizado: string;
}

const VACIA: ConfigResultadosFinal = {
  publicado: false,
  publicadoEn: null,
  consultaActiva: false,
  tituloPublico: TITULO_POR_DEFECTO,
  puestos: PODIOS,
  actualizado: '',
};

export interface PuestoFinal {
  puesto: number;
  dni: string;
  nombres: string;
  institucion: string;
  tutorId: string;
  categoria: string;
  grado: string;
  salon: number;
  correctas: number;
  incorrectas: number;
  blancos: number;
  puntaje: number;
  /** La hora a la que entregó y los minutos que tardó desde que empezó. */
  horaEntrega: string;
  minutos: number | null;
  /** Mismo puntaje y mismo tiempo que otro: comparten el puesto. */
  empatado: boolean;
  /** La modalidad de su institución y el ámbito en que se le premia. */
  modalidad: Modalidad;
  ambito: Ambito;
}

/**
 * Resultados de la final macrorregional.
 *
 * Aquí no hay corte ni porcentaje: la final no clasifica a nadie, premia. Lo
 * que importa es el orden dentro de cada categoría, que es donde compiten
 * entre sí, y de ese orden salen las tres cosas que pide la premiación: los
 * primeros puestos de cada categoría, el mejor puntaje del día y el más bajo.
 *
 * Los puestos se cuentan como en cualquier competencia: dos empatados ocupan
 * el mismo puesto y el siguiente salta. Inventar un desempate que nadie acordó
 * sería peor que entregar dos medallas.
 *
 * Nada se guarda calculado: los puntajes se vuelven a leer del examen en cada
 * consulta, para que corregir una clave arrastre hasta la premiación.
 */
@Injectable()
export class ResultadosFinalService {
  private readonly log = new Logger('ResultadosFinal');

  constructor(
    private prisma: PrismaService,
    private examen: ExamenFinalService,
    // Para saber si la consulta de la etapa institucional sigue abierta: la
    // portada no ofrece las dos a la vez.
    private institucional: ResultadosService,
  ) {}

  // ------------------------------------------------------------- configuración

  async config(): Promise<ConfigResultadosFinal> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVE } });
    if (!fila?.valor) return { ...VACIA };

    try {
      return { ...VACIA, ...JSON.parse(fila.valor) };
    } catch {
      return { ...VACIA };
    }
  }

  private async guardar(config: ConfigResultadosFinal) {
    config.actualizado = new Date().toISOString();
    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE },
      create: { clave: CLAVE, valor: JSON.stringify(config) },
      update: { valor: JSON.stringify(config) },
    });
    return config;
  }

  async guardarAjustes(datos: {
    tituloPublico?: string;
    consultaActiva?: boolean;
    puestos?: number;
  }) {
    const config = await this.config();

    if (datos.tituloPublico !== undefined) {
      config.tituloPublico = String(datos.tituloPublico).trim().slice(0, 160) || TITULO_POR_DEFECTO;
    }
    if (datos.consultaActiva !== undefined) config.consultaActiva = Boolean(datos.consultaActiva);
    if (datos.puestos !== undefined) {
      const n = Number(datos.puestos);
      if (!Number.isInteger(n) || n < 1 || n > 50) {
        throw new BadRequestException('Los puestos a premiar van de 1 a 50');
      }
      config.puestos = n;
    }

    return this.guardar(config);
  }

  async publicar(publicado: boolean) {
    const config = await this.config();
    config.publicado = publicado;
    config.publicadoEn = publicado ? new Date().toISOString() : null;
    await this.guardar(config);

    this.log.warn(`Los resultados de la final quedaron ${publicado ? 'publicados' : 'ocultos'}.`);
    return this.general();
  }

  // ------------------------------------------------------------------ el cálculo

  /**
   * Todos los que rindieron, con su puesto dentro de su categoría.
   *
   * A igual puntaje pasa primero quien entregó antes: por eso el acta pide la
   * hora de entrega. Solo quedan empatados los que además tardaron lo mismo,
   * que son pocos y esos sí comparten el puesto.
   *
   * Quien no tiene hora anotada va al final de su grupo de puntaje: no se le
   * premia por un dato que faltó, pero tampoco se le baja de puntaje.
   *
   * El salón no entra en el orden: se reparte por salones para que quepan en
   * la sede, no para que compitan por aula.
   */
  async calcular(): Promise<PuestoFinal[]> {
    const [todas, modalidades] = await Promise.all([this.examen.todas(), this.modalidades()]);
    return this.ordenar(todas, modalidades);
  }

  /** La modalidad de cada delegación, en una sola consulta. */
  private async modalidades(): Promise<Map<string, Modalidad>> {
    const tutores = await this.prisma.tutor.findMany({ select: { id: true, modalidad: true } });
    return new Map(tutores.map((t) => [t.id, t.modalidad]));
  }

  /**
   * La ficha de cada delegación: quién la lleva, de dónde y de qué modalidad.
   *
   * El examen solo guarda el nombre de la institución; el del tutor hay que
   * buscarlo, y el campeonato premia al tutor tanto como al colegio.
   */
  private async delegaciones(): Promise<
    Map<string, { tutor: string; institucion: string; modalidad: Modalidad }>
  > {
    const tutores = await this.prisma.tutor.findMany({
      select: { id: true, nombres: true, apellidos: true, institucion: true, modalidad: true },
    });

    return new Map(
      tutores.map((t) => [
        t.id,
        {
          tutor: `${t.nombres} ${t.apellidos}`.trim(),
          institucion: t.institucion,
          modalidad: t.modalidad,
        },
      ]),
    );
  }

  /**
   * El ámbito en que compite una delegación.
   *
   * Los grupos de estudio van con los particulares: no son un colegio del
   * Estado. Si la delegación no apareciera, cuenta como pública, que es lo
   * que dice su ficha por defecto.
   */
  private ambitoDe(modalidad: Modalidad | undefined): Ambito {
    return modalidad === 'PARTICULAR' || modalidad === 'GRUPO_ESTUDIO' ? 'PRIVADO' : 'PUBLICO';
  }

  /**
   * Reparte los puestos dentro de cada categoría, sobre el conjunto que se le
   * dé.
   *
   * Va aparte de `calcular` porque la premiación por ámbito necesita el mismo
   * orden aplicado solo a los privados o solo a los públicos: el décimo de los
   * privados no es el décimo de la tabla general.
   */
  private ordenar(
    todas: (CorregidoFinal & { salon: number })[],
    modalidades: Map<string, Modalidad>,
  ): PuestoFinal[] {
    const lista: PuestoFinal[] = [];
    const tiempo = (m: number | null) => (m === null ? Infinity : m);

    for (const grado of GRADOS) {
      const suyos = todas
        .filter((f) => f.categoria === grado.categoria)
        .sort(
          (a, b) =>
            b.puntaje - a.puntaje ||
            tiempo(a.minutos) - tiempo(b.minutos) ||
            a.nombres.localeCompare(b.nombres, 'es'),
        );

      const igual = (x: typeof suyos[number], y: typeof suyos[number]) =>
        x.puntaje === y.puntaje && tiempo(x.minutos) === tiempo(y.minutos);

      suyos.forEach((f) => {
        const puesto = suyos.findIndex((x) => igual(x, f)) + 1;
        const empatado = suyos.filter((x) => igual(x, f)).length > 1;

        lista.push({
          puesto,
          dni: f.dni,
          nombres: f.nombres,
          institucion: f.institucion,
          tutorId: f.tutorId,
          categoria: f.categoria,
          grado: grado.label,
          salon: f.salon,
          correctas: f.correctas,
          incorrectas: f.incorrectas,
          blancos: f.blancos,
          puntaje: f.puntaje,
          horaEntrega: f.horaEntrega,
          minutos: f.minutos,
          empatado,
          modalidad: modalidades.get(f.tutorId) ?? 'ESTATAL',
          ambito: this.ambitoDe(modalidades.get(f.tutorId)),
        });
      });
    }

    return lista;
  }

  /** El tablero: cada categoría con su mejor, su peor y su promedio. */
  async general() {
    const [lista, config, consolidado] = await Promise.all([
      this.calcular(),
      this.config(),
      this.examen.consolidado(),
    ]);

    const categorias = GRADOS.map((g) => {
      const suyos = lista.filter((r) => r.categoria === g.categoria);
      if (suyos.length === 0) return null;

      const puntajes = suyos.map((r) => r.puntaje);
      return {
        categoria: g.categoria,
        grado: g.label,
        nivel: g.nivel,
        rindieron: suyos.length,
        mejor: suyos[0],
        peor: suyos[suyos.length - 1],
        promedio: Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 100) / 100,
        delegaciones: new Set(suyos.map((r) => r.tutorId)).size,
      };
    }).filter(Boolean);

    const porPuntaje = [...lista].sort((a, b) => b.puntaje - a.puntaje);

    return {
      config,
      categorias,
      resumen: {
        rindieron: lista.length,
        categorias: categorias.length,
        delegaciones: new Set(lista.map((r) => r.tutorId)).size,
        // Mientras falte un salón por entregar, los puestos pueden moverse.
        salonesPendientes: consolidado.resumen.pendientes,
        completo: consolidado.resumen.salones > 0 && consolidado.resumen.pendientes === 0,
      },
      mejor: porPuntaje[0] || null,
      peor: porPuntaje[porPuntaje.length - 1] || null,
    };
  }

  /** Los primeros `n` de cada categoría, para mirar categoría por categoría. */
  async top(n?: number) {
    const [lista, config] = await Promise.all([this.calcular(), this.config()]);
    const cuantos = Number(n) > 0 ? Number(n) : config.puestos;

    return GRADOS.map((g) => {
      const suyos = lista.filter((r) => r.categoria === g.categoria);
      if (suyos.length === 0) return null;
      return {
        categoria: g.categoria,
        grado: g.label,
        nivel: g.nivel,
        rindieron: suyos.length,
        // Por puesto y no por posición: con un empate en el tope entran los
        // dos, que es lo que hay que premiar.
        alumnos: suyos.filter((r) => r.puesto <= cuantos),
      };
    }).filter(Boolean);
  }

  /**
   * La premiación, leída al revés.
   *
   * En el acto se llama por puesto y no por categoría: «los décimos puestos»,
   * y suben los nueve de todas las categorías. Esto devuelve exactamente eso,
   * del último puesto al primero, que es el orden en que se entrega.
   */
  async premiacion(n?: number) {
    const [lista, config] = await Promise.all([this.calcular(), this.config()]);
    const cuantos = Number(n) > 0 ? Number(n) : config.puestos;

    const puestos = [];
    for (let p = cuantos; p >= 1; p--) {
      const suyos = lista
        .filter((r) => r.puesto === p)
        .sort((a, b) => a.categoria.localeCompare(b.categoria) || b.puntaje - a.puntaje);
      if (suyos.length === 0) continue;
      puestos.push({ puesto: p, alumnos: suyos });
    }

    return { puestos, totalPuestos: cuantos };
  }

  /**
   * La misma premiación, armada para proyectarla en pantalla grande.
   *
   * Una lámina por lugar y ámbito, del décimo al primero y dentro de cada
   * lugar primero el privado y después el público: ese es el orden en que se
   * llama al estrado. Son siempre los diez lugares y las veinte láminas,
   * estén llenas o no, porque el menú de la presentación es fijo y una lámina
   * que desaparece a mitad del acto desordena a quien la está pasando; la que
   * no tiene a nadie viene marcada para que la pantalla lo diga.
   */
  async presentacion() {
    const [todas, modalidades, delegaciones, config, consolidado] = await Promise.all([
      this.examen.todas(),
      this.modalidades(),
      this.delegaciones(),
      this.config(),
      this.examen.consolidado(),
    ]);

    const solo = (ambito: Ambito) =>
      todas.filter((f) => this.ambitoDe(modalidades.get(f.tutorId)) === ambito);

    const tablas: Record<string, PuestoFinal[]> = {
      PRIVADO: this.ordenar(solo('PRIVADO'), modalidades),
      PUBLICO: this.ordenar(solo('PUBLICO'), modalidades),
    };

    const laminas = [];
    for (let puesto = LUGARES; puesto >= 1; puesto--) {
      for (const ambito of AMBITOS) {
        const suyos = tablas[ambito.id].filter((r) => r.puesto === puesto);

        const categorias = GRADOS.map((g) => {
          const alumnos = suyos
            .filter((r) => r.categoria === g.categoria)
            .sort((a, b) => a.nombres.localeCompare(b.nombres, 'es'))
            .map((r) => ({
              dni: r.dni,
              nombres: r.nombres,
              institucion: r.institucion,
              puntaje: r.puntaje,
              empatado: r.empatado,
            }));
          if (alumnos.length === 0) return null;
          return { categoria: g.categoria, grado: g.label, nivel: g.nivel, alumnos };
        }).filter(Boolean);

        laminas.push({
          id: `${puesto}-${ambito.id.toLowerCase()}`,
          tipo: 'lugar',
          puesto,
          ambito: ambito.id,
          ambitoTexto: ambito.texto,
          // El ámbito no entra en el titular: ya va en su propia etiqueta,
          // justo encima, y repetido dos veces en la misma lámina sobra.
          titulo: `${ORDINALES[puesto]} LUGAR`,
          subtitulo: NOMBRE_CONCURSO,
          detalle: ambito.detalle,
          categorias,
          premiados: categorias.reduce((n, c) => n + c.alumnos.length, 0),
        });
      }
    }

    /**
     * La última lámina del acto: el premio mayor.
     *
     * Va después del primer lugar porque se entrega al final, y mira la tabla
     * general —no la de privados ni la de públicos—: el campeonato es uno
     * solo y la modalidad va como dato en el renglón.
     */
    const campeones = this.tablaCampeones(this.ordenar(todas, modalidades), delegaciones)
      .filter((d) => d.puesto <= CAMPEONES)
      .map((d) => ({
        puesto: d.puesto,
        ordinal: `${ORDINALES[d.puesto]} LUGAR`,
        tutor: d.tutor || 'Sin tutor registrado',
        institucion: d.institucion,
        modalidadTexto: d.modalidadTexto,
        ambitoTexto: d.ambitoTexto,
        puntos: d.puntos,
        categorias: d.categorias,
        premiados: d.premiados,
        empatado: d.empatado,
      }));

    laminas.push({
      id: 'campeones-podio',
      tipo: 'campeones',
      // Primer lugar para la pantalla: corona y serpentina dorada, que es el
      // remate del acto.
      puesto: 1,
      ambito: 'GENERAL',
      ambitoTexto: 'Premio mayor',
      titulo: 'CAMPEONES DE CAMPEONES',
      subtitulo: NOMBRE_CONCURSO,
      detalle: 'Las delegaciones con más puntos sumando los puestos de todas sus categorías.',
      categorias: [],
      campeones,
      premiados: campeones.length,
    } as any);

    return {
      lugares: LUGARES,
      ambitos: AMBITOS,
      laminas,
      resumen: {
        rindieron: todas.length,
        privados: tablas.PRIVADO.length,
        publicos: tablas.PUBLICO.length,
        // Mientras falte un salón por entregar, los puestos todavía se mueven.
        salonesPendientes: consolidado.resumen.pendientes,
        completo: consolidado.resumen.salones > 0 && consolidado.resumen.pendientes === 0,
      },
      publicado: config.publicado,
    };
  }

  // -------------------------------------------------- campeones de campeones

  /** Lo que suma un alumno por el puesto que sacó en su categoría. */
  private puntosDelPuesto(puesto: number): number {
    if (puesto > PUESTOS_QUE_SUMAN) return 0;
    return PUNTOS_CAMPEONATO[puesto] ?? PUNTOS_RESTO;
  }

  /**
   * El campeonato de delegaciones, sobre la tabla general de puestos.
   *
   * Aquí no se premia a un alumno sino a quien llevó al equipo: suma cada uno
   * de sus alumnos que entró entre los diez primeros de su categoría, con la
   * escala de la comisión. Por eso gana quien reparte premiados en muchas
   * categorías y no quien trajo una estrella sola: un primer puesto son diez
   * puntos, pero cinco categorías con un cuarto puesto cada una son también
   * diez y de más mérito para la delegación.
   *
   * El empate se resuelve en ese mismo orden —puntos, categorías distintas y
   * después cuántos primeros, segundos y terceros— y si aun así coinciden en
   * todo eso, comparten el lugar: inventar un desempate que nadie acordó el
   * día del acto sería peor que entregar dos trofeos.
   *
   * Los puestos salen de la tabla general y no de la de privados o públicos:
   * el premio mayor es uno solo para toda la olimpiada, y la modalidad se
   * muestra como dato, no como una liga aparte.
   */
  private tablaCampeones(
    lista: PuestoFinal[],
    delegaciones: Map<string, { tutor: string; institucion: string; modalidad: Modalidad }>,
  ): CampeonFinal[] {
    const porDelegacion = new Map<string, PuestoFinal[]>();
    for (const r of lista) {
      const clave = r.tutorId || r.institucion;
      if (!porDelegacion.has(clave)) porDelegacion.set(clave, []);
      porDelegacion.get(clave)!.push(r);
    }

    const filas = [...porDelegacion.entries()]
      .map(([clave, suyos]) => {
        const ficha = delegaciones.get(clave);
        const modalidad = ficha?.modalidad ?? suyos[0].modalidad;
        const ambito = this.ambitoDe(modalidad);

        const puntuados = suyos
          .filter((r) => r.puesto <= PUESTOS_QUE_SUMAN)
          .sort((a, b) => a.puesto - b.puesto || a.categoria.localeCompare(b.categoria));

        const alumnos = puntuados.map((r) => ({
          dni: r.dni,
          nombres: r.nombres,
          categoria: r.categoria,
          grado: r.grado,
          puesto: r.puesto,
          empatado: r.empatado,
          puntaje: r.puntaje,
          puntos: this.puntosDelPuesto(r.puesto),
        }));

        const cuantos = (puesto: number) => puntuados.filter((r) => r.puesto === puesto).length;
        const categorias = [...new Set(alumnos.map((a) => a.categoria))].sort();

        return {
          tutorId: clave,
          tutor: ficha?.tutor || '',
          institucion: ficha?.institucion || suyos[0].institucion || 'Sin nombre',
          modalidad,
          modalidadTexto: MODALIDAD_TEXTO[modalidad],
          ambito,
          ambitoTexto: ambito === 'PRIVADO' ? 'Privado' : 'Público',
          puesto: 0,
          empatado: false,
          puntos: alumnos.reduce((n, a) => n + a.puntos, 0),
          categorias: categorias.length,
          categoriasTexto: categorias.join(' · '),
          premiados: alumnos.length,
          rindieron: suyos.length,
          primeros: cuantos(1),
          segundos: cuantos(2),
          terceros: cuantos(3),
          // Para el desempate de cortesía, que no decide el premio.
          puntajeTotal: puntuados.reduce((n, r) => n + r.puntaje, 0),
          alumnos,
        };
      })
      // Sin ningún alumno entre los diez primeros no se entra al campeonato:
      // una delegación con cero puntos no está compitiendo por este premio.
      .filter((d) => d.premiados > 0)
      .sort(
        (a, b) =>
          b.puntos - a.puntos ||
          b.categorias - a.categorias ||
          b.primeros - a.primeros ||
          b.segundos - a.segundos ||
          b.terceros - a.terceros ||
          b.puntajeTotal - a.puntajeTotal ||
          a.institucion.localeCompare(b.institucion, 'es'),
      );

    // Lo que decide el premio son estos cinco números; el puntaje solo ordena
    // la pantalla, así que quien coincide en los cinco sale como empatado
    // aunque uno haya quedado una línea más arriba.
    const decide = (d: typeof filas[number]) =>
      [d.puntos, d.categorias, d.primeros, d.segundos, d.terceros].join('·');

    return filas.map((fila) => {
      const { puntajeTotal, ...d } = fila;
      return {
        ...d,
        puesto: filas.findIndex((x) => decide(x) === decide(fila)) + 1,
        empatado: filas.filter((x) => decide(x) === decide(fila)).length > 1,
      };
    });
  }

  /**
   * El campeonato con su sustento: la tabla entera y por qué gana cada uno.
   *
   * Lo que se proyecta en el acto son tres renglones; esto es lo que hay que
   * poder mostrar cuando un tutor pregunte por qué no fue él, con los alumnos
   * y los puntos de cada uno a la vista.
   */
  async campeones() {
    const [lista, delegaciones, consolidadoExamen] = await Promise.all([
      this.calcular(),
      this.delegaciones(),
      this.examen.consolidado(),
    ]);

    const tabla = this.tablaCampeones(lista, delegaciones);

    return {
      escala: ESCALA_CAMPEONATO,
      puestosQueSuman: PUESTOS_QUE_SUMAN,
      cuantosPremian: CAMPEONES,
      podio: tabla.filter((d) => d.puesto <= CAMPEONES),
      tabla,
      resumen: {
        rindieron: lista.length,
        delegaciones: new Set(lista.map((r) => r.tutorId)).size,
        conPuntos: tabla.length,
        categorias: new Set(lista.map((r) => r.categoria)).size,
        // Mientras falte un salón por entregar, los puestos todavía se mueven
        // y con ellos los puntos: esto no es definitivo hasta que lleguen.
        salonesPendientes: consolidadoExamen.resumen.pendientes,
        completo:
          consolidadoExamen.resumen.salones > 0 && consolidadoExamen.resumen.pendientes === 0,
      },
    };
  }

  // ------------------------------------------------------------- el consolidado

  /** Un alumno como lo lee el consolidado: sin la hoja de respuestas detrás. */
  private ficha(r: PuestoFinal) {
    return {
      dni: r.dni,
      nombres: r.nombres,
      institucion: r.institucion,
      ambito: r.ambito,
      ambitoTexto: r.ambito === 'PRIVADO' ? 'Privado' : 'Público',
      categoria: r.categoria,
      grado: r.grado,
      /** Su puesto dentro de su categoría, que es por donde se premia. */
      puesto: r.puesto,
      puntaje: r.puntaje,
    };
  }

  /**
   * La tabla por puntaje a secas, sin separar categorías.
   *
   * El puesto de la premiación es dentro de la categoría —un tercero de
   * primaria no compite contra un quinto de secundaria—, pero para saber
   * quién hizo el mejor examen del día hay que mirarlos a todos juntos, y esa
   * es otra tabla.
   */
  private porPuntaje(lista: PuestoFinal[]) {
    const tiempo = (m: number | null) => (m === null ? Infinity : m);
    const orden = [...lista].sort(
      (a, b) =>
        b.puntaje - a.puntaje ||
        tiempo(a.minutos) - tiempo(b.minutos) ||
        a.nombres.localeCompare(b.nombres, 'es'),
    );
    const igual = (x: PuestoFinal, y: PuestoFinal) =>
      x.puntaje === y.puntaje && tiempo(x.minutos) === tiempo(y.minutos);

    return orden.map((r) => ({
      ...this.ficha(r),
      posicion: orden.findIndex((x) => igual(x, r)) + 1,
      empatado: orden.filter((x) => igual(x, r)).length > 1,
    }));
  }

  /**
   * El consolidado de la final: todo lo que se pregunta después del acto.
   *
   * Quién hizo el mejor examen del día, quién el de cada categoría, cómo
   * quedaron estatales y particulares por separado, y qué colegio se lleva el
   * día. Nada de esto se guarda: sale de los mismos puntajes que la
   * premiación, así que corregir una clave lo arrastra entero.
   */
  async consolidado() {
    const [lista, consolidadoExamen] = await Promise.all([
      this.calcular(),
      this.examen.consolidado(),
    ]);

    const media = (xs: number[]) =>
      xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0;

    // Con empate en el décimo entran los dos: cortar por el número de filas
    // dejaría fuera a alguien con el mismo puntaje que el que sí entró.
    const diez = (suyos: PuestoFinal[]) =>
      this.porPuntaje(suyos).filter((r) => r.posicion <= 10);

    const deAmbito = (id: Ambito) => {
      const suyos = lista.filter((r) => r.ambito === id);
      const tabla = this.porPuntaje(suyos);
      return {
        id,
        texto: AMBITOS.find((a) => a.id === id)!.texto,
        detalle: AMBITOS.find((a) => a.id === id)!.detalle,
        rindieron: suyos.length,
        instituciones: new Set(suyos.map((r) => r.tutorId)).size,
        promedio: media(suyos.map((r) => r.puntaje)),
        mejor: tabla[0] || null,
      };
    };

    // ------------------------------------------------------ por categoría
    const categorias = GRADOS.map((g) => {
      const suyos = lista.filter((r) => r.categoria === g.categoria);
      if (suyos.length === 0) return null;

      // `calcular` ya devuelve cada categoría ordenada, así que el primero de
      // cada recorte es el mejor: no hace falta volver a ordenar.
      const privados = suyos.filter((r) => r.ambito === 'PRIVADO');
      const publicos = suyos.filter((r) => r.ambito === 'PUBLICO');

      return {
        categoria: g.categoria,
        grado: g.label,
        nivel: g.nivel,
        rindieron: suyos.length,
        promedio: media(suyos.map((r) => r.puntaje)),
        mejor: this.ficha(suyos[0]),
        mejorPrivado: privados.length ? this.ficha(privados[0]) : null,
        mejorPublico: publicos.length ? this.ficha(publicos[0]) : null,
      };
    }).filter(Boolean);

    // --------------------------------------------------------- por colegio
    const porColegio = new Map<string, PuestoFinal[]>();
    for (const r of lista) {
      const clave = r.tutorId || r.institucion;
      if (!porColegio.has(clave)) porColegio.set(clave, []);
      porColegio.get(clave)!.push(r);
    }

    const colegios = [...porColegio.values()]
      .map((suyos) => {
        const mejor = suyos.reduce((a, b) => (b.puntaje > a.puntaje ? b : a));
        return {
          institucion: suyos[0].institucion || 'Sin nombre',
          ambito: suyos[0].ambito,
          ambitoTexto: suyos[0].ambito === 'PRIVADO' ? 'Privado' : 'Público',
          rindieron: suyos.length,
          mejor: mejor.puntaje,
          mejorAlumno: mejor.nombres,
          mejorCategoria: mejor.categoria,
          promedio: media(suyos.map((r) => r.puntaje)),
          total: suyos.reduce((n, r) => n + r.puntaje, 0),
          enPodio: suyos.filter((r) => r.puesto <= 3).length,
        };
      })
      .sort(
        (a, b) =>
          b.mejor - a.mejor ||
          b.promedio - a.promedio ||
          a.institucion.localeCompare(b.institucion, 'es'),
      );

    /**
     * Tres maneras de ser «el colegio con mayor puntaje», y las tres valen
     * según lo que se quiera mirar: el mejor examen, el conjunto más parejo o
     * el que más suma. Se dan las tres antes que elegir una por nadie.
     */
    const cima = (clave: 'mejor' | 'promedio' | 'total') =>
      colegios.length ? [...colegios].sort((a, b) => b[clave] - a[clave])[0] : null;

    const tablaGeneral = this.porPuntaje(lista);

    return {
      resumen: {
        rindieron: lista.length,
        delegaciones: new Set(lista.map((r) => r.tutorId)).size,
        categorias: categorias.length,
        promedio: media(lista.map((r) => r.puntaje)),
        // Mientras falte un salón por entregar, todo esto todavía se mueve.
        salonesPendientes: consolidadoExamen.resumen.pendientes,
        completo:
          consolidadoExamen.resumen.salones > 0 && consolidadoExamen.resumen.pendientes === 0,
      },
      mejorGeneral: tablaGeneral[0] || null,
      ambitos: [deAmbito('PRIVADO'), deAmbito('PUBLICO')],
      top: {
        general: diez(lista),
        privado: diez(lista.filter((r) => r.ambito === 'PRIVADO')),
        publico: diez(lista.filter((r) => r.ambito === 'PUBLICO')),
      },
      categorias,
      colegios,
      destacados: {
        mejorPuntaje: cima('mejor'),
        mejorPromedio: cima('promedio'),
        masPuntos: cima('total'),
      },
    };
  }

  /** El mismo consolidado en Excel, una hoja por pregunta. */
  async excelConsolidado(): Promise<{ buffer: Buffer; nombre: string }> {
    const datos = await this.consolidado();
    const libro = new ExcelJS.Workbook();
    libro.creator = NOMBRE_CONCURSO;

    const cuando = datos.resumen.completo
      ? 'Con todas las actas recibidas'
      : `Faltan ${datos.resumen.salonesPendientes} salón(es) por entregar`;

    // ------------------------------------------------------------- resumen
    const resumen = libro.addWorksheet('RESUMEN');
    escribirTitulo(
      resumen,
      4,
      'Consolidado de la final macrorregional',
      cuando,
      datos.resumen.rindieron,
    );
    escribirEncabezados(resumen, [
      { header: 'DATO', width: 34 },
      { header: 'VALOR', width: 44 },
      { header: 'DETALLE', width: 34 },
      { header: 'PUNTAJE', width: 12 },
    ]);

    const linea = (dato: string, valor: string | number, detalle = '', puntaje: any = '') => {
      const fila = resumen.addRow([dato, valor, detalle, puntaje]);
      fila.getCell(1).font = { bold: true };
      return fila;
    };

    linea('Rindieron la final', datos.resumen.rindieron);
    linea('Delegaciones', datos.resumen.delegaciones);
    linea('Categorías con alumnos', datos.resumen.categorias);
    linea('Promedio general', datos.resumen.promedio);
    resumen.addRow([]);

    if (datos.mejorGeneral) {
      linea(
        'Mejor puntaje del día',
        datos.mejorGeneral.nombres,
        `${datos.mejorGeneral.institucion} · categoría ${datos.mejorGeneral.categoria} · ${datos.mejorGeneral.ambitoTexto}`,
        datos.mejorGeneral.puntaje,
      );
    }
    for (const a of datos.ambitos) {
      linea(
        `Mejor de ${a.texto.toLowerCase()}`,
        a.mejor ? a.mejor.nombres : '—',
        a.mejor ? `${a.mejor.institucion} · categoría ${a.mejor.categoria}` : '',
        a.mejor ? a.mejor.puntaje : '',
      );
    }
    resumen.addRow([]);

    for (const a of datos.ambitos) {
      linea(
        `${a.texto}: rindieron`,
        a.rindieron,
        `${a.instituciones} institución(es) · promedio ${a.promedio}`,
      );
    }
    resumen.addRow([]);

    const premios: [string, typeof datos.destacados.mejorPuntaje, string][] = [
      ['Colegio con el mejor puntaje', datos.destacados.mejorPuntaje, 'mejor'],
      ['Colegio con el mejor promedio', datos.destacados.mejorPromedio, 'promedio'],
      ['Colegio con más puntos en total', datos.destacados.masPuntos, 'total'],
    ];
    for (const [titulo, colegio, clave] of premios) {
      if (!colegio) continue;
      linea(
        titulo,
        colegio.institucion,
        `${colegio.ambitoTexto} · ${colegio.rindieron} alumno(s)`,
        (colegio as any)[clave],
      );
    }

    // -------------------------------------------------------------- top 10
    const hojaTop = libro.addWorksheet('TOP 10');
    const columnasTop = [
      { header: 'TABLA', width: 14 },
      { header: 'POSICIÓN', width: 11 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 38 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 38 },
      { header: 'ÁMBITO', width: 12 },
      { header: 'CAT.', width: 8 },
      { header: 'GRADO', width: 20 },
      { header: 'PUNTAJE', width: 11 },
    ];
    const tablas = [
      ['General', datos.top.general],
      ['Privado', datos.top.privado],
      ['Público', datos.top.publico],
    ] as const;
    escribirTitulo(
      hojaTop,
      columnasTop.length,
      'Los diez primeros de la final',
      'Por puntaje y sin separar categorías, en las tres tablas',
      tablas.reduce((n, [, filas]) => n + filas.length, 0),
    );
    escribirEncabezados(hojaTop, columnasTop);
    for (const [nombre, filas] of tablas) {
      for (const r of filas) {
        const fila = hojaTop.addRow([
          nombre,
          r.posicion + (r.empatado ? ' (empate)' : ''),
          r.dni,
          r.nombres,
          r.institucion,
          r.ambitoTexto,
          r.categoria,
          r.grado,
          r.puntaje,
        ]);
        fila.getCell(3).numFmt = '@';
        fila.getCell(columnasTop.length).font = { bold: true, color: { argb: GRANATE } };
        if (r.posicion <= 3) fila.getCell(2).font = { bold: true, color: { argb: 'FFB45309' } };
      }
    }

    // -------------------------------------------------------- por categoría
    const hojaCat = libro.addWorksheet('POR CATEGORÍA');
    const columnasCat = [
      { header: 'CAT.', width: 8 },
      { header: 'GRADO', width: 20 },
      { header: 'RINDIERON', width: 12 },
      { header: 'PROMEDIO', width: 11 },
      { header: 'MEJOR DE LA CATEGORÍA', width: 38 },
      { header: 'INSTITUCIÓN', width: 34 },
      { header: 'PTS', width: 9 },
      { header: 'MEJOR PRIVADO', width: 38 },
      { header: 'PTS', width: 9 },
      { header: 'MEJOR PÚBLICO', width: 38 },
      { header: 'PTS', width: 9 },
    ];
    escribirTitulo(
      hojaCat,
      columnasCat.length,
      'El mejor de cada categoría',
      'El primer puesto de cada categoría, y el primero de cada ámbito dentro de ella',
      datos.categorias.length,
    );
    escribirEncabezados(hojaCat, columnasCat);
    for (const c of datos.categorias) {
      hojaCat.addRow([
        c.categoria,
        c.grado,
        c.rindieron,
        c.promedio,
        c.mejor.nombres,
        c.mejor.institucion,
        c.mejor.puntaje,
        c.mejorPrivado ? c.mejorPrivado.nombres : '—',
        c.mejorPrivado ? c.mejorPrivado.puntaje : '',
        c.mejorPublico ? c.mejorPublico.nombres : '—',
        c.mejorPublico ? c.mejorPublico.puntaje : '',
      ]);
    }

    // ------------------------------------------------------------- colegios
    const hojaCol = libro.addWorksheet('COLEGIOS');
    const columnasCol = [
      { header: 'INSTITUCIÓN EDUCATIVA', width: 40 },
      { header: 'ÁMBITO', width: 12 },
      { header: 'RINDIERON', width: 12 },
      { header: 'MEJOR PUNTAJE', width: 15 },
      { header: 'SU MEJOR ALUMNO', width: 38 },
      { header: 'CAT.', width: 8 },
      { header: 'PROMEDIO', width: 11 },
      { header: 'PUNTOS EN TOTAL', width: 16 },
      { header: 'EN EL PODIO', width: 13 },
    ];
    escribirTitulo(
      hojaCol,
      columnasCol.length,
      'Las instituciones en la final',
      'Ordenadas por su mejor puntaje. «En el podio» cuenta sus alumnos entre los tres primeros de alguna categoría',
      datos.colegios.length,
    );
    escribirEncabezados(hojaCol, columnasCol);
    for (const c of datos.colegios) {
      const fila = hojaCol.addRow([
        c.institucion,
        c.ambitoTexto,
        c.rindieron,
        c.mejor,
        c.mejorAlumno,
        c.mejorCategoria,
        c.promedio,
        c.total,
        c.enPodio,
      ]);
      fila.getCell(4).font = { bold: true, color: { argb: GRANATE } };
    }

    // ----------------------------------------------------------------- todos
    const hojaTodos = libro.addWorksheet('TODOS');
    const columnasTodos = [
      { header: 'POSICIÓN GENERAL', width: 17 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 38 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 38 },
      { header: 'ÁMBITO', width: 12 },
      { header: 'CAT.', width: 8 },
      { header: 'GRADO', width: 20 },
      { header: 'PUESTO EN SU CATEGORÍA', width: 22 },
      { header: 'PUNTAJE', width: 11 },
    ];
    const todos = this.porPuntaje(await this.calcular());
    escribirTitulo(
      hojaTodos,
      columnasTodos.length,
      'Todos los que rindieron la final',
      'Por puntaje general; el puesto de la premiación es el de su categoría',
      todos.length,
    );
    escribirEncabezados(hojaTodos, columnasTodos);
    for (const r of todos) {
      const fila = hojaTodos.addRow([
        r.posicion + (r.empatado ? ' (empate)' : ''),
        r.dni,
        r.nombres,
        r.institucion,
        r.ambitoTexto,
        r.categoria,
        r.grado,
        r.puesto,
        r.puntaje,
      ]);
      fila.getCell(2).numFmt = '@';
      fila.getCell(columnasTodos.length).font = { bold: true, color: { argb: GRANATE } };
    }

    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    return { buffer, nombre: nombreArchivo('consolidado final macrorregional') };
  }

  // ------------------------------------------------------------------- consultas

  /**
   * Lo que ve la portada: si la consulta está abierta y con qué título.
   *
   * La de la final espera a que cierre la de la etapa institucional. No es un
   * capricho de orden: son dos consultas por DNI en la misma portada y, con
   * las dos abiertas, el que busca su resultado de la final acaba entrando a
   * la de la institucional y leyendo que «no clasificó». Una a la vez, y la
   * que manda es la etapa en la que está el concurso.
   */
  async estadoPublico() {
    const [config, institucional] = await Promise.all([
      this.config(),
      this.institucional.estadoPublico(),
    ]);

    return {
      activa: config.consultaActiva && !institucional.activa,
      /** Lo que decidió la comisión, aunque todavía no se vea en la portada. */
      abierta: config.consultaActiva,
      institucionalAbierta: institucional.activa,
      /** Abierta aquí pero tapada por la institucional: hay que cerrar esa. */
      esperando: config.consultaActiva && institucional.activa,
      titulo: config.tituloPublico,
      publicado: config.publicado,
      publicadoEn: config.publicadoEn,
      puestos: config.puestos,
    };
  }

  /**
   * La misma tabla, contada dos veces: entre todos y dentro de su ámbito.
   *
   * El puesto que se premia y el que se consulta no son el mismo número. En
   * la premiación compiten todos los de la categoría; en la consulta, cada
   * uno quiere saber cómo le fue entre los suyos, porque un colegio estatal
   * no se mide contra un grupo de estudio. Se devuelven los dos para que la
   * ficha pueda decirlo sin que nadie los confunda.
   */
  private async tablas() {
    const [todas, modalidades] = await Promise.all([this.examen.todas(), this.modalidades()]);
    const general = this.ordenar(todas, modalidades);

    const porAmbito = new Map<string, PuestoFinal>();
    for (const { id } of AMBITOS) {
      const suyos = todas.filter((f) => this.ambitoDe(modalidades.get(f.tutorId)) === id);
      for (const r of this.ordenar(suyos, modalidades)) {
        porAmbito.set(`${r.dni}-${r.categoria}`, r);
      }
    }

    return { general, porAmbito };
  }

  async consultar(dni: string) {
    const [estado, config] = await Promise.all([this.estadoPublico(), this.config()]);
    if (!estado.activa) {
      throw new NotFoundException(
        estado.esperando
          ? 'La consulta de la final se abre cuando cierre la de la etapa institucional.'
          : 'La consulta de la final todavía no está habilitada.',
      );
    }

    const limpio = String(dni || '').trim();
    if (!/^\d{6,12}$/.test(limpio)) {
      throw new BadRequestException('Escriba el DNI del estudiante, solo números');
    }

    const { general, porAmbito } = await this.tablas();
    const suyos = general.filter((r) => r.dni === limpio);
    if (suyos.length === 0) {
      throw new NotFoundException('No encontramos ese DNI entre los que rindieron la final.');
    }

    return suyos.map((r) => {
      const enAmbito = porAmbito.get(`${r.dni}-${r.categoria}`);
      const deSuCategoria = general.filter((x) => x.categoria === r.categoria);
      const deSuGrupo = deSuCategoria.filter((x) => x.ambito === r.ambito);

      return {
        nombres: r.nombres,
        dni: r.dni,
        institucion: r.institucion,
        categoria: r.categoria,
        grado: r.grado,
        /** Su puesto entre todos los de su categoría, que es el de la premiación. */
        puesto: r.puesto,
        empatado: r.empatado,
        rindieron: deSuCategoria.length,
        /** Y el que viene a buscar: su lugar entre los de su mismo ámbito. */
        ambito: r.ambito,
        ambitoTexto: r.ambito === 'PRIVADO' ? 'Privado' : 'Público',
        modalidadTexto: MODALIDAD_TEXTO[r.modalidad],
        puestoAmbito: enAmbito?.puesto ?? r.puesto,
        empatadoAmbito: enAmbito?.empatado ?? r.empatado,
        rindieronAmbito: deSuGrupo.length,
        horaEntrega: r.horaEntrega,
        minutos: r.minutos,
        correctas: r.correctas,
        incorrectas: r.incorrectas,
        blancos: r.blancos,
        puntaje: r.puntaje,
        premiado: r.puesto <= config.puestos,
      };
    });
  }

  /**
   * Un alumno con sus dos puestos, que es como se informa fuera del acto.
   *
   * El puesto que se premia y el que vienen a preguntar no son el mismo
   * número: en el acto compiten todos los de la categoría, pero el tutor y
   * el alumno quieren saber cómo les fue entre los colegios que son como el
   * suyo. Van los dos, cada uno con de cuántos sale, para que nadie los
   * confunda al leerlos.
   */
  private fichaDe(
    general: PuestoFinal[],
    porAmbito: Map<string, PuestoFinal>,
    premiaHasta: number,
  ) {
    const enCategoria = new Map<string, number>();
    const enGrupo = new Map<string, number>();
    for (const r of general) {
      enCategoria.set(r.categoria, (enCategoria.get(r.categoria) || 0) + 1);
      const grupo = `${r.categoria}-${r.ambito}`;
      enGrupo.set(grupo, (enGrupo.get(grupo) || 0) + 1);
    }

    return (r: PuestoFinal) => {
      const enAmbito = porAmbito.get(`${r.dni}-${r.categoria}`);

      return {
        dni: r.dni,
        nombres: r.nombres,
        institucion: r.institucion,
        tutorId: r.tutorId,
        categoria: r.categoria,
        grado: r.grado,
        salon: r.salon,
        correctas: r.correctas,
        incorrectas: r.incorrectas,
        blancos: r.blancos,
        puntaje: r.puntaje,
        horaEntrega: r.horaEntrega,
        minutos: r.minutos,
        /** Entre todos los de su categoría: el puesto del acto. */
        puesto: r.puesto,
        empatado: r.empatado,
        rindieron: enCategoria.get(r.categoria) || 0,
        /** Y entre los de su mismo ámbito, que es con quienes se compara. */
        ambito: r.ambito,
        ambitoTexto: r.ambito === 'PRIVADO' ? 'Privado' : 'Público',
        modalidad: r.modalidad,
        modalidadTexto: MODALIDAD_TEXTO[r.modalidad],
        puestoAmbito: enAmbito?.puesto ?? r.puesto,
        empatadoAmbito: enAmbito?.empatado ?? r.empatado,
        rindieronAmbito: enGrupo.get(`${r.categoria}-${r.ambito}`) || 0,
        premiado: r.puesto <= premiaHasta,
      };
    };
  }

  /**
   * Lo que ve el tutor en su cuenta, cuando ya está publicado.
   *
   * Sus finalistas con el puntaje y los dos puestos, agrupados por categoría
   * porque es como compiten. Mientras la comisión no publique no devuelve
   * nada: el tutor no puede enterarse antes del acto.
   */
  async miDelegacion(tutorId: string) {
    const config = await this.config();

    // La cabecera es la misma esté publicado o no, para que la pantalla no
    // tenga que preguntarse qué campos existen en cada caso.
    type Alumno = ReturnType<ReturnType<ResultadosFinalService['fichaDe']>>;
    const cabecera = {
      publicado: config.publicado,
      publicadoEn: config.publicadoEn,
      titulo: config.tituloPublico,
      puestos: config.puestos,
      institucion: '',
      tutor: '',
      modalidadTexto: '',
      ambitoTexto: '',
      categorias: [] as { categoria: string; grado: string; alumnos: Alumno[] }[],
      resumen: null as {
        rindieron: number;
        premiados: number;
        categorias: number;
        mejor: Alumno;
      } | null,
    };

    if (!config.publicado) return cabecera;

    const [{ general, porAmbito }, delegaciones] = await Promise.all([
      this.tablas(),
      this.delegaciones(),
    ]);

    const mia = delegaciones.get(tutorId);
    const ficha = this.fichaDe(general, porAmbito, config.puestos);
    const mios = general.filter((r) => r.tutorId === tutorId).map(ficha);

    cabecera.institucion = mia?.institucion || mios[0]?.institucion || '';
    cabecera.tutor = mia?.tutor || '';
    cabecera.modalidadTexto = mia ? MODALIDAD_TEXTO[mia.modalidad] : mios[0]?.modalidadTexto || '';
    cabecera.ambitoTexto = mia
      ? this.ambitoDe(mia.modalidad) === 'PRIVADO'
        ? 'Privado'
        : 'Público'
      : mios[0]?.ambitoTexto || '';

    if (mios.length === 0) return cabecera;

    cabecera.categorias = [...new Set(mios.map((r) => r.categoria))].sort().map((categoria) => ({
      categoria,
      grado: GRADOS.find((g) => g.categoria === categoria)?.label || '',
      alumnos: mios.filter((r) => r.categoria === categoria).sort((a, b) => a.puesto - b.puesto),
    }));

    cabecera.resumen = {
      rindieron: mios.length,
      premiados: mios.filter((r) => r.premiado).length,
      categorias: cabecera.categorias.length,
      /** El mejor de la casa: el que se nombra al contar cómo les fue. */
      mejor: [...mios].sort((a, b) => a.puesto - b.puesto || b.puntaje - a.puntaje)[0],
    };

    return cabecera;
  }

  /** Buscar por institución, tutor, nombre o DNI. Para atender por teléfono. */
  async buscar(texto: string) {
    const termino = sinTildes(texto);
    if (termino.length < 2) {
      throw new BadRequestException('Escriba al menos dos letras o el DNI');
    }

    const [lista, config] = await Promise.all([this.calcular(), this.config()]);
    const tutores = await this.prisma.tutor.findMany({
      where: { id: { in: [...new Set(lista.map((r) => r.tutorId))] } },
      select: { id: true, nombres: true, apellidos: true, celular: true },
    });
    const porId = new Map(tutores.map((t) => [t.id, t]));

    const coincide = (r: PuestoFinal) => {
      const tutor = porId.get(r.tutorId);
      const nombre = tutor ? `${tutor.nombres} ${tutor.apellidos}` : '';
      return sinTildes(`${r.institucion} ${nombre} ${r.nombres} ${r.dni}`).includes(termino);
    };

    return [...new Set(lista.filter(coincide).map((r) => r.tutorId))].map((tutorId) => {
      const suyos = lista
        .filter((r) => r.tutorId === tutorId)
        .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.puesto - b.puesto);
      const tutor = porId.get(tutorId);

      return {
        tutorId,
        institucion: suyos[0]?.institucion || '',
        tutor: tutor ? `${tutor.nombres} ${tutor.apellidos}`.trim() : '',
        celular: tutor?.celular || '',
        rindieron: suyos.length,
        premiados: suyos.filter((r) => r.puesto <= config.puestos).length,
        alumnos: suyos.map((r) => ({ ...r, premiado: r.puesto <= config.puestos })),
      };
    });
  }

  // --------------------------------------------------------------------- Excel

  /**
   * El cuadro de la final: una hoja por categoría con su orden completo y, al
   * frente, la hoja de premiación con los puestos que se entregan.
   */
  async excel(soloPremiados = false): Promise<{ buffer: Buffer; nombre: string }> {
    const [lista, config] = await Promise.all([this.calcular(), this.config()]);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';

    const columnas = [
      { header: 'PUESTO', width: 10 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 38 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 38 },
      { header: 'SALÓN', width: 9 },
      { header: 'ENTREGÓ', width: 11 },
      { header: 'MIN.', width: 8 },
      { header: 'ACIERTOS', width: 11 },
      { header: 'ERRORES', width: 11 },
      { header: 'BLANCOS', width: 11 },
      { header: 'PUNTAJE', width: 11 },
    ];

    const escribirFilas = (hoja: ExcelJS.Worksheet, filas: PuestoFinal[]) => {
      filas.forEach((r) => {
        const fila = hoja.addRow([
          r.puesto + (r.empatado ? ' (empate)' : ''),
          r.dni,
          r.nombres,
          r.institucion,
          r.salon,
          r.horaEntrega || '—',
          r.minutos ?? '—',
          r.correctas,
          r.incorrectas,
          r.blancos,
          r.puntaje,
        ]);
        fila.getCell(2).numFmt = '@';
        fila.getCell(columnas.length).font = { bold: true, color: { argb: GRANATE } };
        if (r.puesto <= 3) {
          fila.getCell(1).font = { bold: true, color: { argb: 'FFB45309' } };
        }
      });
    };

    // La premiación va primero: es la hoja que se usa el día del acto.
    const premiados = lista
      .filter((r) => r.puesto <= config.puestos)
      .sort(
        (a, b) =>
          a.puesto - b.puesto ||
          a.categoria.localeCompare(b.categoria) ||
          a.nombres.localeCompare(b.nombres, 'es'),
      );

    const hojaPodio = libro.addWorksheet('PREMIACIÓN');
    const columnasPodio = [
      { header: 'PUESTO', width: 10 },
      { header: 'CAT.', width: 8 },
      { header: 'GRADO', width: 20 },
      ...columnas.slice(1),
    ];
    escribirTitulo(
      hojaPodio,
      columnasPodio.length,
      'Premiación · final macrorregional',
      `Los primeros ${config.puestos} puestos de cada categoría`,
      premiados.length,
    );
    escribirEncabezados(hojaPodio, columnasPodio);
    premiados.forEach((r) => {
      const fila = hojaPodio.addRow([
        r.puesto + (r.empatado ? ' (empate)' : ''),
        r.categoria,
        r.grado,
        r.dni,
        r.nombres,
        r.institucion,
        r.salon,
        r.horaEntrega || '—',
        r.minutos ?? '—',
        r.correctas,
        r.incorrectas,
        r.blancos,
        r.puntaje,
      ]);
      fila.getCell(4).numFmt = '@';
      fila.getCell(columnasPodio.length).font = { bold: true, color: { argb: GRANATE } };
      if (r.puesto <= 3) fila.getCell(1).font = { bold: true, color: { argb: 'FFB45309' } };
    });

    if (!soloPremiados) {
      for (const g of GRADOS) {
        const suyos = lista.filter((r) => r.categoria === g.categoria);
        if (suyos.length === 0) continue;

        const hoja = libro.addWorksheet(`CAT. ${g.categoria}`);
        escribirTitulo(
          hoja,
          columnas.length,
          `Final macrorregional · CAT. ${g.categoria} · ${g.label}`,
          `${suyos.length} rindieron · mejor puntaje ${suyos[0].puntaje} · más bajo ${suyos[suyos.length - 1].puntaje}`,
          suyos.length,
        );
        escribirEncabezados(hoja, columnas);
        escribirFilas(hoja, suyos);
      }
    }

    if (lista.length === 0) {
      libro.addWorksheet('Sin datos').getCell('A1').value =
        'Todavía no hay respuestas de la final.';
    }

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(soloPremiados ? 'premiacion-final' : 'resultados-final-macrorregional'),
    };
  }

  /**
   * El cuadro de su delegación, en Excel, para el tutor.
   *
   * Lo pide para el periódico mural o para mandárselo al director, así que la
   * tabla tiene que entenderse sola: los dos puestos de cada alumno con de
   * cuántos salen y una columna que dice si está premiado, sin que haga falta
   * abrir el sistema al lado para interpretarla.
   */
  async miExcel(tutorId: string): Promise<{ buffer: Buffer; nombre: string }> {
    const datos = await this.miDelegacion(tutorId);
    if (!datos.publicado) {
      throw new NotFoundException('Los resultados de la final todavía no están publicados.');
    }
    if (!datos.resumen || datos.categorias.length === 0) {
      throw new NotFoundException('Su delegación no tiene estudiantes en la final.');
    }

    const ambito = (datos.ambitoTexto || '').toUpperCase();
    const columnas = [
      { header: 'CAT.', width: 8 },
      { header: 'GRADO', width: 20 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 38 },
      { header: 'PUNTAJE', width: 11 },
      { header: 'ACIERTOS', width: 11 },
      { header: 'ERRORES', width: 11 },
      { header: 'BLANCOS', width: 11 },
      { header: 'PUESTO EN SU CATEGORÍA', width: 23 },
      { header: 'DE CUÁNTOS', width: 13 },
      { header: `PUESTO ENTRE ${ambito ? `${ambito}S` : 'LOS SUYOS'}`, width: 23 },
      { header: 'DE CUÁNTOS', width: 13 },
      { header: 'PREMIADO', width: 12 },
    ];

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet('MI DELEGACIÓN');

    escribirTitulo(
      hoja,
      columnas.length,
      `${datos.titulo} · ${datos.institucion}`,
      `${datos.tutor ? `${datos.tutor} · ` : ''}${datos.modalidadTexto} · ` +
        `${datos.resumen.rindieron} rindieron la final · ` +
        `${datos.resumen.premiados} entre los ${datos.puestos} primeros de su categoría`,
      datos.resumen.rindieron,
    );
    escribirEncabezados(hoja, columnas);

    for (const c of datos.categorias) {
      for (const a of c.alumnos) {
        const fila = hoja.addRow([
          a.categoria,
          a.grado,
          a.dni,
          a.nombres,
          a.puntaje,
          a.correctas,
          a.incorrectas,
          a.blancos,
          a.puesto + (a.empatado ? ' (empate)' : ''),
          a.rindieron,
          a.puestoAmbito + (a.empatadoAmbito ? ' (empate)' : ''),
          a.rindieronAmbito,
          a.premiado ? 'SÍ' : '—',
        ]);
        fila.getCell(3).numFmt = '@';
        fila.getCell(5).font = { bold: true, color: { argb: GRANATE } };
        if (a.premiado) {
          fila.getCell(columnas.length).font = { bold: true, color: { argb: 'FFB45309' } };
        }
      }
    }

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(`final-${datos.institucion || 'mi-delegacion'}`),
    };
  }

  /**
   * Cuántos hay en cada categoría y ámbito, para la pantalla de descargas.
   *
   * No es un resultado: es el índice del archivo, para que quien lo baja sepa
   * de antemano cuántas hojas trae y con cuánta gente dentro.
   */
  async cuadroAmbitos() {
    const [{ general }, config, consolidado] = await Promise.all([
      this.tablas(),
      this.config(),
      this.examen.consolidado(),
    ]);

    const ambitos = AMBITOS.map((a) => {
      const suyos = general.filter((r) => r.ambito === a.id);
      return {
        id: a.id,
        texto: a.texto,
        detalle: a.detalle,
        total: suyos.length,
        categorias: GRADOS.filter((g) => suyos.some((r) => r.categoria === g.categoria)).map(
          (g) => {
            const dentro = suyos.filter((r) => r.categoria === g.categoria);
            return {
              categoria: g.categoria,
              grado: g.label,
              total: dentro.length,
              mejor: Math.max(...dentro.map((r) => r.puntaje)),
            };
          },
        ),
      };
    });

    return {
      ambitos,
      puestos: config.puestos,
      resumen: {
        rindieron: general.length,
        /** Las hojas que trae el archivo completo: las de cada grupo y la de todos. */
        hojas: ambitos.reduce((suma, a) => suma + a.categorias.length, 0) + 1,
        salonesPendientes: consolidado.resumen.pendientes,
      },
    };
  }

  /**
   * Todo el orden de la final, por categoría y por modalidad.
   *
   * Una hoja por cada categoría dentro de cada ámbito —que es el orden con el
   * que de verdad se premia a cada grupo— y delante una hoja con todos para
   * filtrar a mano. El puesto general va también en cada hoja, porque es el
   * que se nombró en el acto y si faltara parecería otro resultado.
   */
  async excelAmbitos(soloAmbito?: Ambito): Promise<{ buffer: Buffer; nombre: string }> {
    const [config, { general, porAmbito }] = await Promise.all([this.config(), this.tablas()]);
    const ficha = this.fichaDe(general, porAmbito, config.puestos);
    const todos = general.map(ficha);
    const ambitos = AMBITOS.filter((a) => !soloAmbito || a.id === soloAmbito);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';

    // ------------------------------------------------------ la hoja de todos
    const columnasTodos = [
      { header: 'CAT.', width: 8 },
      { header: 'GRADO', width: 20 },
      { header: 'ÁMBITO', width: 11 },
      { header: 'PUESTO EN SU ÁMBITO', width: 21 },
      { header: 'PUESTO GENERAL', width: 17 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 38 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 38 },
      { header: 'MODALIDAD', width: 18 },
      { header: 'ACIERTOS', width: 11 },
      { header: 'ERRORES', width: 11 },
      { header: 'BLANCOS', width: 11 },
      { header: 'PUNTAJE', width: 11 },
      { header: 'PREMIADO', width: 12 },
    ];

    const deEsteArchivo = todos.filter((r) => !soloAmbito || r.ambito === soloAmbito);
    const hojaTodos = libro.addWorksheet('TODOS');
    escribirTitulo(
      hojaTodos,
      columnasTodos.length,
      'Final macrorregional · todos los que rindieron',
      soloAmbito
        ? `Solo ${AMBITO_PLURAL[soloAmbito]} · el puesto de cada uno dentro de su categoría`
        : 'Cada uno con su puesto dentro de su ámbito y su puesto entre todos los de su categoría',
      deEsteArchivo.length,
    );
    escribirEncabezados(hojaTodos, columnasTodos);

    [...deEsteArchivo]
      .sort(
        (a, b) =>
          a.categoria.localeCompare(b.categoria) ||
          a.ambito.localeCompare(b.ambito) ||
          a.puestoAmbito - b.puestoAmbito,
      )
      .forEach((r) => {
        const fila = hojaTodos.addRow([
          r.categoria,
          r.grado,
          r.ambitoTexto,
          r.puestoAmbito + (r.empatadoAmbito ? ' (empate)' : ''),
          r.puesto + (r.empatado ? ' (empate)' : ''),
          r.dni,
          r.nombres,
          r.institucion,
          r.modalidadTexto,
          r.correctas,
          r.incorrectas,
          r.blancos,
          r.puntaje,
          r.premiado ? 'SÍ' : '—',
        ]);
        fila.getCell(6).numFmt = '@';
        fila.getCell(13).font = { bold: true, color: { argb: GRANATE } };
      });

    // ------------------------------------- una hoja por categoría y ámbito
    const columnas = [
      { header: 'PUESTO', width: 10 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 38 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 38 },
      { header: 'MODALIDAD', width: 18 },
      { header: 'ACIERTOS', width: 11 },
      { header: 'ERRORES', width: 11 },
      { header: 'BLANCOS', width: 11 },
      { header: 'PUNTAJE', width: 11 },
      { header: 'ENTREGÓ', width: 11 },
      { header: 'PUESTO GENERAL', width: 17 },
    ];

    for (const a of ambitos) {
      for (const g of GRADOS) {
        const suyos = todos
          .filter((r) => r.ambito === a.id && r.categoria === g.categoria)
          .sort((x, y) => x.puestoAmbito - y.puestoAmbito);
        if (suyos.length === 0) continue;

        const hoja = libro.addWorksheet(
          `${a.id === 'PUBLICO' ? 'PÚB' : 'PRIV'} · CAT. ${g.categoria}`,
        );
        escribirTitulo(
          hoja,
          columnas.length,
          `CAT. ${g.categoria} · ${g.label} · ${a.texto.toUpperCase()}`,
          `${a.detalle} ${suyos.length} ${suyos.length === 1 ? 'estudiante' : 'estudiantes'} · ` +
            `mejor puntaje ${suyos[0].puntaje}`,
          suyos.length,
        );
        escribirEncabezados(hoja, columnas);

        suyos.forEach((r) => {
          const fila = hoja.addRow([
            r.puestoAmbito + (r.empatadoAmbito ? ' (empate)' : ''),
            r.dni,
            r.nombres,
            r.institucion,
            r.modalidadTexto,
            r.correctas,
            r.incorrectas,
            r.blancos,
            r.puntaje,
            r.horaEntrega || '—',
            r.puesto + (r.empatado ? ' (empate)' : ''),
          ]);
          fila.getCell(2).numFmt = '@';
          fila.getCell(9).font = { bold: true, color: { argb: GRANATE } };
          if (r.puestoAmbito <= 3) {
            fila.getCell(1).font = { bold: true, color: { argb: 'FFB45309' } };
          }
        });
      }
    }

    if (general.length === 0) {
      libro.addWorksheet('Sin datos').getCell('A1').value =
        'Todavía no hay respuestas de la final.';
    }

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(
        soloAmbito
          ? `final-por-categoria-${AMBITO_PLURAL[soloAmbito]}`
          : 'final-por-categoria-y-modalidad',
      ),
    };
  }
}

/** Para buscar sin que estorben los acentos ni las mayúsculas. */
const sinTildes = (texto: string) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
