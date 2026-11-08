import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Modalidad } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CorregidoFinal, ExamenFinalService } from './examen-final.service';
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
    const [todas, modalidades, config, consolidado] = await Promise.all([
      this.examen.todas(),
      this.modalidades(),
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

  /** Lo que ve la portada: si la consulta está abierta y con qué título. */
  async estadoPublico() {
    const config = await this.config();
    return {
      activa: config.consultaActiva,
      titulo: config.tituloPublico,
      publicado: config.publicado,
      publicadoEn: config.publicadoEn,
      puestos: config.puestos,
    };
  }

  async consultar(dni: string) {
    const config = await this.config();
    if (!config.consultaActiva) {
      throw new NotFoundException('La consulta de la final todavía no está habilitada.');
    }

    const limpio = String(dni || '').trim();
    if (!/^\d{6,12}$/.test(limpio)) {
      throw new BadRequestException('Escriba el DNI del estudiante, solo números');
    }

    const suyos = (await this.calcular()).filter((r) => r.dni === limpio);
    if (suyos.length === 0) {
      throw new NotFoundException('No encontramos ese DNI entre los que rindieron la final.');
    }

    return suyos.map((r) => ({
      nombres: r.nombres,
      dni: r.dni,
      institucion: r.institucion,
      categoria: r.categoria,
      grado: r.grado,
      puesto: r.puesto,
      empatado: r.empatado,
      horaEntrega: r.horaEntrega,
      minutos: r.minutos,
      correctas: r.correctas,
      incorrectas: r.incorrectas,
      blancos: r.blancos,
      puntaje: r.puntaje,
      premiado: r.puesto <= config.puestos,
    }));
  }

  /** Lo que ve el tutor en su cuenta, cuando ya está publicado. */
  async miDelegacion(tutorId: string) {
    const [lista, config] = await Promise.all([this.calcular(), this.config()]);
    if (!config.publicado) return { publicado: false, categorias: [], resumen: null };

    const mios = lista.filter((r) => r.tutorId === tutorId);
    if (mios.length === 0) return { publicado: true, categorias: [], resumen: null };

    const categorias = [...new Set(mios.map((r) => r.categoria))].sort().map((categoria) => ({
      categoria,
      grado: GRADOS.find((g) => g.categoria === categoria)?.label || '',
      alumnos: mios
        .filter((r) => r.categoria === categoria)
        .sort((a, b) => a.puesto - b.puesto)
        .map((r) => ({ ...r, premiado: r.puesto <= config.puestos })),
    }));

    return {
      publicado: true,
      publicadoEn: config.publicadoEn,
      categorias,
      resumen: {
        rindieron: mios.length,
        premiados: mios.filter((r) => r.puesto <= config.puestos).length,
        mejor: [...mios].sort((a, b) => a.puesto - b.puesto)[0],
      },
    };
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
}

/** Para buscar sin que estorben los acentos ni las mayúsculas. */
const sinTildes = (texto: string) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
