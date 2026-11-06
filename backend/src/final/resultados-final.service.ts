import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ExamenFinalService } from './examen-final.service';
import { GRADOS } from '../common/grados';
import { GRANATE, escribirEncabezados, escribirTitulo, nombreArchivo } from '../common/excel';

const CLAVE = 'resultados_final_config';

/** Cuántos puestos entran en la premiación si nadie dice otra cosa. */
const PODIOS = 10;

const TITULO_POR_DEFECTO = 'RESULTADOS DE LA FINAL MACRORREGIONAL';

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
    const todas = await this.examen.todas();
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
