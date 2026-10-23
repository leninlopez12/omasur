import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { GRADOS } from '../common/grados';
import { GRANATE, escribirEncabezados, escribirTitulo, nombreArchivo } from '../common/excel';

/** Lo único que se acepta como respuesta. */
export const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E', 'BLANCO'] as const;
export type Alternativa = (typeof ALTERNATIVAS)[number];

export const PREGUNTAS = 20;

/**
 * Un color por alternativa, ninguno rojo.
 *
 * El rojo se reserva para los errores: si una respuesta válida ya fuera roja,
 * el tutor no distinguiría lo que marcó de lo que está mal.
 */
const COLORES: Record<Alternativa, string> = {
  A: 'FFDBEAFE',
  B: 'FFD1FAE5',
  C: 'FFFEF3C7',
  D: 'FFEDE9FE',
  E: 'FFCFFAFE',
  BLANCO: 'FFE5E7EB',
};

const MODALIDADES: Record<string, string> = {
  ESTATAL: 'Institución estatal',
  PARTICULAR: 'Institución particular',
  GRUPO_ESTUDIO: 'Grupo de estudio',
};

const CLAVE_CONFIG = 'examen_config';
const CLAVE_RESPUESTAS = (tutorId: string) => `examen_respuestas_${tutorId}`;

export interface PuntajesExamen {
  correcta: number;
  blanco: number;
  incorrecta: number;
}

export interface ConfigExamen {
  /** Las respuestas correctas, por categoría: { A: ['A','C',...] }. */
  claves: Record<string, Alternativa[]>;
  puntajes: PuntajesExamen;
  /** Mientras no esté publicado, solo la comisión puede probar el envío. */
  publicado: boolean;
  actualizado: string;
}

const CONFIG_VACIA: ConfigExamen = {
  claves: {},
  puntajes: { correcta: 10, blanco: 0, incorrecta: -1 },
  publicado: false,
  actualizado: '',
};

/** Una respuesta ya corregida. */
interface Corregido {
  dni: string;
  nombres: string;
  categoria: string;
  respuestas: Alternativa[];
  correctas: number;
  incorrectas: number;
  blancos: number;
  puntaje: number;
}

/** Lo que entregó una delegación, resumido para los listados. */
export interface Entrega {
  tutorId: string;
  institucion: string;
  enviadoEn: string;
  corregidoEn: string | null;
  porComision: boolean;
  registradoPor: string;
  total: number;
  categorias: string[];
  puntajeAlto: number;
  promedio: number;
}

/**
 * Respuestas del examen.
 *
 * El tutor baja un Excel con su delegación ya escrita, marca A–E o BLANCO en
 * cada una de las veinte preguntas y lo sube. El sistema lo lee, lo compara
 * con la clave que la comisión cargó y guarda el puntaje.
 *
 * No hay tabla nueva: la configuración y lo que entrega cada delegación son
 * registros de `Ajuste`, uno por delegación, que se leen y escriben enteros.
 */
@Injectable()
export class ExamenService {
  private readonly log = new Logger('Examen');

  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------------ configuración

  async config(): Promise<ConfigExamen> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVE_CONFIG } });
    // Copias propias y no las del módulo: `guardarConfig` escribe encima de lo
    // que recibe, y con la referencia compartida el valor por defecto quedaría
    // alterado para todo el proceso.
    if (!fila?.valor) return this.vacia();

    try {
      const guardada = JSON.parse(fila.valor);
      return { ...CONFIG_VACIA, ...guardada, puntajes: { ...CONFIG_VACIA.puntajes, ...guardada.puntajes } };
    } catch {
      return this.vacia();
    }
  }

  private vacia(): ConfigExamen {
    return { ...CONFIG_VACIA, claves: {}, puntajes: { ...CONFIG_VACIA.puntajes } };
  }

  async guardarConfig(datos: Partial<ConfigExamen>): Promise<ConfigExamen> {
    const actual = await this.config();
    const nueva: ConfigExamen = { ...actual };

    if (datos.claves) {
      for (const [categoria, respuestas] of Object.entries(datos.claves)) {
        if (!GRADOS.some((g) => g.categoria === categoria)) continue;
        nueva.claves[categoria] = this.limpiarClave(respuestas);
      }
    }

    if (datos.puntajes) {
      for (const campo of ['correcta', 'blanco', 'incorrecta'] as const) {
        const valor = Number(datos.puntajes[campo]);
        if (Number.isFinite(valor)) nueva.puntajes[campo] = valor;
      }
    }

    if (datos.publicado !== undefined) {
      nueva.publicado = Boolean(datos.publicado);
      if (nueva.publicado && Object.keys(nueva.claves).length === 0) {
        throw new BadRequestException('Cargue las respuestas correctas antes de publicar');
      }
    }

    nueva.actualizado = new Date().toISOString();

    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE_CONFIG },
      create: { clave: CLAVE_CONFIG, valor: JSON.stringify(nueva) },
      update: { valor: JSON.stringify(nueva) },
    });

    return nueva;
  }

  /** Una clave siempre tiene veinte respuestas; lo que falte queda en blanco. */
  private limpiarClave(respuestas: any): Alternativa[] {
    const lista = Array.isArray(respuestas) ? respuestas : [];
    return Array.from({ length: PREGUNTAS }, (_, i) => this.comoAlternativa(lista[i]) ?? 'BLANCO');
  }

  private comoAlternativa(valor: any): Alternativa | null {
    const texto = String(valor ?? '')
      .trim()
      .toUpperCase();
    if (!texto) return null;
    if (texto === 'BLANCO' || texto === 'EN BLANCO' || texto === '-') return 'BLANCO';
    return (ALTERNATIVAS as readonly string[]).includes(texto) ? (texto as Alternativa) : null;
  }

  // ------------------------------------------------------------------ plantilla

  /**
   * El Excel de la delegación: una hoja por categoría, con sus alumnos ya
   * escritos y veinte columnas para marcar.
   *
   * Los nombres vienen puestos y las celdas traen lista desplegable: el tutor
   * solo elige, no escribe. Es lo que evita la mitad de los errores.
   */
  async plantilla(tutorId: string): Promise<Buffer> {
    const { tutor, porCategoria } = await this.delegacion(tutorId);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';

    for (const [categoria, alumnos] of porCategoria) {
      const grado = GRADOS.find((g) => g.categoria === categoria);
      const hoja = libro.addWorksheet(`CAT. ${categoria}`);

      hoja.columns = [
        { width: 6 },
        { width: 14 },
        { width: 40 },
        ...Array.from({ length: PREGUNTAS }, () => ({ width: 6 })),
      ] as any;

      const marca = hoja.addRow(['I - OMASUR UNI 2026']);
      marca.font = { bold: true, size: 16, color: { argb: GRANATE } };
      marca.height = 24;

      const titulo = hoja.addRow([`CAT. ${categoria} · ${grado?.label || ''}`]);
      titulo.font = { bold: true, size: 13, color: { argb: 'FF111827' } };
      hoja.addRow([tutor.institucion || 'Sin institución']).font = {
        size: 10,
        color: { argb: 'FF6B7280' },
      };
      hoja.addRow(['Marque A, B, C, D, E o BLANCO en cada pregunta.']).font = {
        size: 10,
        italic: true,
        color: { argb: 'FF6B7280' },
      };
      hoja.addRow([]);

      const encabezado = hoja.addRow([
        'N°',
        'DNI',
        'APELLIDOS Y NOMBRES',
        ...Array.from({ length: PREGUNTAS }, (_, i) => `P${i + 1}`),
      ]);
      encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRANATE } };
      encabezado.height = 22;
      encabezado.alignment = { horizontal: 'center', vertical: 'middle' };

      const primera = encabezado.number + 1;
      alumnos.forEach((a, i) => {
        const fila = hoja.addRow([i + 1, a.dni, a.nombres]);
        fila.getCell(2).numFmt = '@';
        fila.height = 20;
      });
      const ultima = primera + alumnos.length - 1;

      hoja.views = [{ state: 'frozen', xSplit: 3, ySplit: encabezado.number }];

      if (alumnos.length === 0) continue;

      // Lista desplegable y color por alternativa en las veinte columnas.
      const opciones = '"' + ALTERNATIVAS.join(',') + '"';
      for (let f = primera; f <= ultima; f++) {
        for (let c = 4; c < 4 + PREGUNTAS; c++) {
          const celda = hoja.getCell(f, c);
          celda.alignment = { horizontal: 'center', vertical: 'middle' };
          celda.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          celda.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [opciones],
            showErrorMessage: true,
            errorTitle: 'Respuesta inválida',
            error: 'Solo se acepta A, B, C, D, E o BLANCO.',
          };
        }
      }

      const letra = (n: number) => String.fromCharCode(64 + n);
      const rango = `${letra(4)}${primera}:${letra(3 + PREGUNTAS)}${ultima}`;
      hoja.addConditionalFormatting({
        ref: rango,
        // `cellIs equal` y no `containsText`: así «E» no pinta también a
        // «BLANCO», que la contiene.
        rules: ALTERNATIVAS.map((alt, i) => ({
          type: 'cellIs' as const,
          operator: 'equal' as const,
          formulae: [`"${alt}"`],
          priority: i + 1,
          style: {
            fill: {
              type: 'pattern' as const,
              pattern: 'solid' as const,
              bgColor: { argb: COLORES[alt] },
            },
          },
        })),
      });
    }

    if (porCategoria.size === 0) {
      const hoja = libro.addWorksheet('Sin estudiantes');
      hoja.getCell('A1').value = 'Su delegación todavía no tiene estudiantes aprobados.';
    }

    return (await libro.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // -------------------------------------------------------------------- lectura

  /**
   * Lee el Excel y lo corrige, sin guardar nada.
   *
   * Es lo que se muestra en pantalla antes de confirmar: si algo está mal, el
   * tutor lo corrige en su archivo y vuelve a subirlo.
   */
  async revisar(tutorId: string, archivo: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Adjunte el Excel con las respuestas');

    const config = await this.config();
    const { porCategoria, alumnos } = await this.delegacion(tutorId);

    const libro = new ExcelJS.Workbook();
    try {
      await libro.xlsx.load(archivo.buffer as any);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo. ¿Es el Excel que descargó?');
    }

    const errores: string[] = [];
    const corregidos: Corregido[] = [];
    const vistos = new Set<string>();

    for (const hoja of libro.worksheets) {
      const categoria = (hoja.name.match(/CAT\.\s*([A-I])/i) || [])[1]?.toUpperCase();
      if (!categoria) continue;

      hoja.eachRow((fila, numero) => {
        const dni = String(fila.getCell(2).value ?? '').trim();
        if (!dni || !/^\d{6,12}$/.test(dni)) return;

        const alumno = alumnos.get(dni);
        if (!alumno) {
          errores.push(`${hoja.name}, fila ${numero}: el DNI ${dni} no es de su delegación.`);
          return;
        }
        if (vistos.has(dni)) {
          errores.push(`${hoja.name}, fila ${numero}: ${alumno.nombres} aparece dos veces.`);
          return;
        }
        vistos.add(dni);

        const respuestas: Alternativa[] = [];
        for (let i = 0; i < PREGUNTAS; i++) {
          const bruto = fila.getCell(4 + i).value;
          const valor = this.comoAlternativa(
            typeof bruto === 'object' && bruto !== null ? (bruto as any).result ?? (bruto as any).text : bruto,
          );
          if (valor === null && String(bruto ?? '').trim() !== '') {
            errores.push(
              `${hoja.name}, fila ${numero} (${alumno.nombres}), P${i + 1}: «${String(bruto).trim()}» no es una alternativa válida.`,
            );
          }
          respuestas.push(valor ?? 'BLANCO');
        }

        corregidos.push(this.corregir(alumno, categoria, respuestas, config));
      });
    }

    // Quien no aparezca en el archivo se avisa, pero no frena el envío: puede
    // que ese alumno no se haya presentado.
    const faltantes: string[] = [];
    for (const [, lista] of porCategoria) {
      for (const a of lista) if (!vistos.has(a.dni)) faltantes.push(a.nombres);
    }

    return {
      filas: corregidos.sort(
        (a, b) => a.categoria.localeCompare(b.categoria) || a.nombres.localeCompare(b.nombres, 'es'),
      ),
      errores,
      faltantes,
      puntajes: config.puntajes,
      sinClave: corregidos
        .map((c) => c.categoria)
        .filter((c, i, todas) => todas.indexOf(c) === i && !config.claves[c]),
    };
  }

  /**
   * Lo mismo, pero guardando el resultado.
   *
   * Cuando lo sube la comisión por una delegación que no pudo hacerlo sola, no
   * se exige que el envío esté abierto: para eso existe ese atajo.
   */
  async registrar(
    tutorId: string,
    archivo: Express.Multer.File,
    autor?: { nombre: string; porComision: boolean },
  ) {
    const config = await this.config();
    if (!config.publicado && !autor?.porComision) {
      throw new BadRequestException('El envío de respuestas todavía no está habilitado.');
    }

    const revision = await this.revisar(tutorId, archivo);
    if (revision.errores.length > 0) {
      throw new BadRequestException('Corrija los errores del archivo antes de enviarlo.');
    }
    if (revision.filas.length === 0) {
      throw new BadRequestException('El archivo no trae ninguna respuesta.');
    }

    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    const registro = {
      tutorId,
      institucion: tutor?.institucion || '',
      enviadoEn: new Date().toISOString(),
      porComision: Boolean(autor?.porComision),
      registradoPor: autor?.nombre || '',
      puntajes: config.puntajes,
      filas: revision.filas,
    };

    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE_RESPUESTAS(tutorId) },
      create: { clave: CLAVE_RESPUESTAS(tutorId), valor: JSON.stringify(registro) },
      update: { valor: JSON.stringify(registro) },
    });

    this.log.log(
      `${tutor?.institucion || tutorId} envió ${revision.filas.length} respuestas del examen.`,
    );

    return { ok: true, total: revision.filas.length, enviadoEn: registro.enviadoEn };
  }

  /** Lo que una delegación ya entregó, si entregó algo. */
  async entregaDe(tutorId: string) {
    const fila = await this.prisma.ajuste.findUnique({
      where: { clave: CLAVE_RESPUESTAS(tutorId) },
    });
    if (!fila?.valor) return null;
    try {
      return JSON.parse(fila.valor);
    } catch {
      return null;
    }
  }

  /** Qué delegaciones ya entregaron. Para la comisión. */
  async entregas(): Promise<Entrega[]> {
    const filas = await this.prisma.ajuste.findMany({
      where: { clave: { startsWith: 'examen_respuestas_' } },
    });

    return filas
      .map((f) => {
        try {
          const d = JSON.parse(f.valor);
          const lista: Corregido[] = d.filas || [];
          const puntajes = lista.map((c) => c.puntaje);
          return {
            tutorId: d.tutorId,
            institucion: d.institucion || 'Sin institución',
            enviadoEn: d.enviadoEn,
            corregidoEn: d.corregidoEn || null,
            porComision: Boolean(d.porComision),
            registradoPor: d.registradoPor || '',
            total: lista.length,
            categorias: [...new Set(lista.map((c) => c.categoria))].sort(),
            puntajeAlto: puntajes.length ? Math.max(...puntajes) : 0,
            promedio: puntajes.length
              ? Math.round((puntajes.reduce((s, n) => s + n, 0) / puntajes.length) * 100) / 100
              : 0,
          };
        } catch {
          return null;
        }
      })
      .filter((e): e is Entrega => e !== null)
      .sort((a, b) => (a.enviadoEn < b.enviadoEn ? 1 : -1));
  }

  /** Lo que entregó una delegación, con todas sus filas. Para corregirla. */
  async entregaCompleta(tutorId: string) {
    const entrega = await this.entregaDe(tutorId);
    if (!entrega) throw new NotFoundException('Esta delegación todavía no envió respuestas');
    return entrega;
  }

  /**
   * Anula el envío de una delegación.
   *
   * Es lo que destraba al tutor cuando mandó el archivo equivocado: al borrar
   * el registro vuelve a ver la pantalla de carga como si nunca hubiera
   * enviado.
   */
  async anular(tutorId: string) {
    const entrega = await this.entregaDe(tutorId);
    if (!entrega) throw new NotFoundException('Esta delegación todavía no envió respuestas');

    await this.prisma.ajuste.delete({ where: { clave: CLAVE_RESPUESTAS(tutorId) } });
    this.log.warn('Se anuló el envío de respuestas de ' + entrega.institucion + '.');

    return { ok: true, institucion: entrega.institucion, total: entrega.filas?.length || 0 };
  }

  /** Cambia las respuestas de un estudiante y lo vuelve a corregir. */
  async corregirAlumno(tutorId: string, dni: string, respuestas: any) {
    const entrega = await this.entregaCompleta(tutorId);
    const fila = (entrega.filas || []).find((f: Corregido) => f.dni === String(dni).trim());
    if (!fila) throw new NotFoundException('Ese estudiante no está en el envío');

    const config = await this.config();
    const nueva = this.corregir(
      { dni: fila.dni, nombres: fila.nombres },
      fila.categoria,
      this.limpiarClave(respuestas),
      config,
    );

    entrega.filas = entrega.filas.map((f: Corregido) => (f.dni === fila.dni ? nueva : f));
    entrega.corregidoEn = new Date().toISOString();

    await this.prisma.ajuste.update({
      where: { clave: CLAVE_RESPUESTAS(tutorId) },
      data: { valor: JSON.stringify(entrega) },
    });

    this.log.warn('Se corrigieron las respuestas de ' + fila.nombres + '.');
    return nueva;
  }

  // ------------------------------------------------------------------ consultas

  /**
   * Quiénes enviaron y quiénes faltan.
   *
   * Se mide contra las delegaciones aprobadas con alumnos aprobados, que son
   * las únicas que rinden: cualquier otra lista daría faltantes que no existen.
   */
  async consultas() {
    const [delegaciones, entregas] = await Promise.all([this.aprobadas(), this.entregas()]);
    const porTutor = new Map(entregas.map((e) => [e.tutorId, e]));

    const filas = delegaciones.map((d) => {
      const entrega = porTutor.get(d.tutorId);
      return {
        ...d,
        enviado: Boolean(entrega),
        porComision: entrega?.porComision || false,
        registradoPor: entrega?.registradoPor || '',
        enviadoEn: entrega?.enviadoEn || null,
        respondidos: entrega?.total || 0,
        sinResponder: Math.max(0, d.alumnosAprobados - (entrega?.total || 0)),
      };
    });

    return {
      filas,
      resumen: {
        delegaciones: filas.length,
        enviadas: filas.filter((f) => f.enviado).length,
        pendientes: filas.filter((f) => !f.enviado).length,
        porComision: filas.filter((f) => f.porComision).length,
        alumnos: filas.reduce((s, f) => s + f.alumnosAprobados, 0),
        respondidos: filas.reduce((s, f) => s + f.respondidos, 0),
      },
    };
  }

  async consultasExcel(): Promise<{ buffer: Buffer; nombre: string }> {
    const { filas, resumen } = await this.consultas();

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet('Envios');

    const columnas = [
      { header: 'N°', width: 6 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 42 },
      { header: 'MODALIDAD', width: 22 },
      { header: 'TUTOR', width: 32 },
      { header: 'CELULAR', width: 14 },
      { header: 'PROVINCIA', width: 20 },
      { header: 'ALUMNOS', width: 10 },
      { header: 'RESPONDIERON', width: 14 },
      { header: 'ESTADO', width: 16 },
      { header: 'LLENADO POR', width: 18 },
      { header: 'ENVIADO EL', width: 22 },
    ];

    escribirTitulo(
      hoja,
      columnas.length,
      'Envíos de respuestas del examen',
      resumen.enviadas +
        ' de ' +
        resumen.delegaciones +
        ' delegaciones enviaron · ' +
        resumen.pendientes +
        ' pendientes',
      filas.length,
    );
    escribirEncabezados(hoja, columnas);

    filas.forEach((f, i) => {
      const fila = hoja.addRow([
        i + 1,
        f.institucion,
        MODALIDADES[f.modalidad] || f.modalidad,
        f.tutor,
        f.celular,
        f.provincia,
        f.alumnosAprobados,
        f.respondidos,
        f.enviado ? 'Enviado' : 'Pendiente',
        f.enviado ? (f.porComision ? f.registradoPor || 'Comisión' : 'Tutor') : '',
        f.enviadoEn
          ? new Date(f.enviadoEn).toLocaleString('es-PE', { timeZone: 'America/Lima' })
          : '',
      ]);
      fila.getCell(9).font = { bold: true, color: { argb: f.enviado ? 'FF047857' : 'FFB45309' } };
    });

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo('envios-respuestas-examen'),
    };
  }

  // ----------------------------------------------------------------- consolidado

  /** Todo lo recibido: delegación por delegación y alumno por alumno. */
  async consolidado() {
    const entregas = await this.entregas();
    const alumnos: (Corregido & { institucion: string; porComision: boolean })[] = [];

    for (const e of entregas) {
      const entrega = await this.entregaDe(e.tutorId);
      for (const fila of entrega?.filas || []) {
        alumnos.push({ ...fila, institucion: e.institucion, porComision: e.porComision });
      }
    }

    alumnos.sort(
      (a, b) =>
        a.categoria.localeCompare(b.categoria) ||
        b.puntaje - a.puntaje ||
        a.nombres.localeCompare(b.nombres, 'es'),
    );

    const categorias = [...new Set(alumnos.map((a) => a.categoria))].sort().map((categoria) => {
      const suyos = alumnos.filter((a) => a.categoria === categoria);
      return {
        categoria,
        grado: GRADOS.find((g) => g.categoria === categoria)?.label || '',
        alumnos: suyos.length,
        promedio: Math.round((suyos.reduce((s, a) => s + a.puntaje, 0) / suyos.length) * 100) / 100,
        maximo: Math.max(...suyos.map((a) => a.puntaje)),
      };
    });

    return {
      entregas,
      categorias,
      alumnos,
      resumen: {
        delegaciones: entregas.length,
        alumnos: alumnos.length,
        porComision: entregas.filter((e) => e.porComision).length,
      },
    };
  }

  async consolidadoExcel(): Promise<{ buffer: Buffer; nombre: string }> {
    const { entregas, categorias, alumnos, resumen } = await this.consolidado();

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';

    const hoja = libro.addWorksheet('Delegaciones');
    const columnas = [
      { header: 'N°', width: 6 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 42 },
      { header: 'CATEGORÍAS', width: 18 },
      { header: 'ALUMNOS', width: 10 },
      { header: 'PROMEDIO', width: 12 },
      { header: 'PUNTAJE MÁS ALTO', width: 18 },
      { header: 'LLENADO POR', width: 18 },
      { header: 'ENVIADO EL', width: 22 },
    ];

    escribirTitulo(
      hoja,
      columnas.length,
      'Consolidado de respuestas del examen',
      resumen.delegaciones +
        ' delegaciones · ' +
        resumen.alumnos +
        ' estudiantes corregidos',
      entregas.length,
    );
    escribirEncabezados(hoja, columnas);

    entregas.forEach((e, i) => {
      hoja.addRow([
        i + 1,
        e.institucion,
        e.categorias.join(', '),
        e.total,
        e.promedio,
        e.puntajeAlto,
        e.porComision ? e.registradoPor || 'Comisión' : 'Tutor',
        new Date(e.enviadoEn).toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      ]);
    });

    // Una hoja por categoría, de mayor a menor puntaje.
    for (const c of categorias) {
      const suya = libro.addWorksheet('CAT. ' + c.categoria);
      const cols = [
        { header: 'N°', width: 6 },
        { header: 'DNI', width: 14 },
        { header: 'APELLIDOS Y NOMBRES', width: 38 },
        { header: 'INSTITUCIÓN EDUCATIVA', width: 40 },
        { header: 'BIEN', width: 8 },
        { header: 'MAL', width: 8 },
        { header: 'BLANCO', width: 10 },
        { header: 'PUNTAJE', width: 12 },
      ];

      escribirTitulo(
        suya,
        cols.length,
        'CAT. ' + c.categoria + ' · ' + c.grado,
        'Promedio ' + c.promedio + ' · puntaje más alto ' + c.maximo,
        c.alumnos,
      );
      escribirEncabezados(suya, cols);

      alumnos
        .filter((a) => a.categoria === c.categoria)
        .forEach((a, i) => {
          const fila = suya.addRow([
            i + 1,
            a.dni,
            a.nombres,
            a.institucion,
            a.correctas,
            a.incorrectas,
            a.blancos,
            a.puntaje,
          ]);
          fila.getCell(2).numFmt = '@';
          fila.getCell(8).font = { bold: true, color: { argb: GRANATE } };
        });
    }

    if (categorias.length === 0) {
      libro.addWorksheet('Sin datos').getCell('A1').value =
        'Todavía ninguna delegación envió respuestas.';
    }

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo('consolidado-respuestas-examen'),
    };
  }

  // --------------------------------------------------------------------- apoyo

  private corregir(
    alumno: { dni: string; nombres: string },
    categoria: string,
    respuestas: Alternativa[],
    config: ConfigExamen,
  ): Corregido {
    const clave = config.claves[categoria];
    let correctas = 0;
    let incorrectas = 0;
    let blancos = 0;

    respuestas.forEach((r, i) => {
      if (r === 'BLANCO') blancos += 1;
      else if (clave && clave[i] === r) correctas += 1;
      else if (clave) incorrectas += 1;
    });

    const p = config.puntajes;
    return {
      dni: alumno.dni,
      nombres: alumno.nombres,
      categoria,
      respuestas,
      correctas,
      incorrectas,
      blancos,
      puntaje: correctas * p.correcta + blancos * p.blanco + incorrectas * p.incorrecta,
    };
  }

  /**
   * Las delegaciones que rinden: aprobadas y con alumnos aprobados.
   *
   * Una delegación aprobada sin alumnos pagados no tiene a quién presentar,
   * así que figuraría como faltante para siempre.
   */
  private async aprobadas() {
    const tutores = await this.prisma.tutor.findMany({
      where: { estado: 'APROBADA' },
      orderBy: { institucion: 'asc' },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        celular: true,
        institucion: true,
        modalidad: true,
        departamento: true,
        provincia: true,
      },
    });

    const conteos = await this.prisma.student.groupBy({
      by: ['tutorId'],
      where: { tutorId: { in: tutores.map((t) => t.id) }, payment: { estado: 'APROBADO' } },
      _count: { _all: true },
    });
    const porTutor = new Map(conteos.map((c) => [c.tutorId, c._count._all]));

    return tutores
      .map((t) => ({
        tutorId: t.id,
        institucion: t.institucion || 'Sin institución',
        modalidad: t.modalidad || '',
        tutor: `${t.nombres} ${t.apellidos}`.trim(),
        celular: t.celular || '',
        departamento: t.departamento || '',
        provincia: t.provincia || '',
        alumnosAprobados: porTutor.get(t.id) || 0,
      }))
      .filter((d) => d.alumnosAprobados > 0);
  }

  /** Los alumnos aprobados de la delegación, agrupados por categoría. */
  private async delegacion(tutorId: string) {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    const students = await this.prisma.student.findMany({
      where: { tutorId, payment: { estado: 'APROBADO' } },
      orderBy: [{ categoria: 'asc' }, { nombres: 'asc' }],
      select: { dni: true, nombres: true, categoria: true },
    });

    const porCategoria = new Map<string, { dni: string; nombres: string }[]>();
    const alumnos = new Map<string, { dni: string; nombres: string }>();

    for (const a of students) {
      if (!porCategoria.has(a.categoria)) porCategoria.set(a.categoria, []);
      porCategoria.get(a.categoria)!.push({ dni: a.dni, nombres: a.nombres });
      alumnos.set(a.dni, { dni: a.dni, nombres: a.nombres });
    }

    return { tutor, porCategoria, alumnos };
  }
}
