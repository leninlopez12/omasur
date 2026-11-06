import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { FinalService, Salon } from './final.service';
import { ALTERNATIVAS, Alternativa, PuntajesExamen } from '../examen/examen.service';
import { GRADOS } from '../common/grados';
import { GRANATE, escribirEncabezados, escribirTitulo, nombreArchivo } from '../common/excel';

const CLAVE_CONFIG = 'examen_final_config';
const CLAVE_RESPUESTAS = (salon: number) => `examen_final_respuestas_${salon}`;

/** Cuántas preguntas puede tener la prueba final, como tope razonable. */
const MAX_PREGUNTAS = 60;

export interface ConfigExamenFinal {
  /** Las respuestas correctas, por categoría: { A: ['A','C',...] }. */
  claves: Record<string, Alternativa[]>;
  puntajes: PuntajesExamen;
  /** Cuántas preguntas trae la prueba. La institucional fueron veinte. */
  preguntas: number;
  /** Mientras no esté abierto, solo el administrador puede probar el envío. */
  abierto: boolean;
  actualizado: string;
}

const CONFIG_VACIA: ConfigExamenFinal = {
  claves: {},
  puntajes: { correcta: 10, blanco: 0, incorrecta: -1 },
  preguntas: 20,
  abierto: false,
  actualizado: '',
};

export interface CorregidoFinal {
  dni: string;
  nombres: string;
  institucion: string;
  tutorId: string;
  categoria: string;
  respuestas: Alternativa[];
  correctas: number;
  incorrectas: number;
  blancos: number;
  puntaje: number;
}

export interface EntregaSalon {
  salon: number;
  nivel: string;
  categoria: string;
  grado: string;
  responsable: string | null;
  enviadoEn: string | null;
  registradoPor: string;
  esperados: number;
  recibidos: number;
  ausentes: number;
  puntajeAlto: number;
  promedio: number;
}

/**
 * El examen de la final macrorregional.
 *
 * Es el mismo oficio que el institucional, con una diferencia que cambia todo
 * lo demás: aquí no entrega el tutor por su delegación, entrega el responsable
 * por su salón. El salón es de una sola categoría, así que su plantilla tiene
 * una sola hoja y una sola clave con la que corregir.
 *
 * Lo guardado son las alternativas que marcó cada alumno; el puntaje se vuelve
 * a sacar en cada lectura con la clave vigente, para que corregir una clave
 * mal cargada arrastre sin que nadie reenvíe nada.
 *
 * Sin tabla nueva: una fila de `Ajuste` por salón.
 */
@Injectable()
export class ExamenFinalService {
  private readonly log = new Logger('ExamenFinal');

  constructor(
    private prisma: PrismaService,
    private final: FinalService,
  ) {}

  // ------------------------------------------------------------- configuración

  async config(): Promise<ConfigExamenFinal> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVE_CONFIG } });
    if (!fila?.valor) return this.vacia();

    try {
      const guardada = JSON.parse(fila.valor);
      return {
        ...this.vacia(),
        ...guardada,
        claves: guardada.claves || {},
        puntajes: { ...CONFIG_VACIA.puntajes, ...guardada.puntajes },
      };
    } catch {
      return this.vacia();
    }
  }

  private vacia(): ConfigExamenFinal {
    return { ...CONFIG_VACIA, claves: {}, puntajes: { ...CONFIG_VACIA.puntajes } };
  }

  private async guardarConfig(config: ConfigExamenFinal) {
    config.actualizado = new Date().toISOString();
    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE_CONFIG },
      create: { clave: CLAVE_CONFIG, valor: JSON.stringify(config) },
      update: { valor: JSON.stringify(config) },
    });
    return config;
  }

  async guardarClave(categoria: string, respuestas: unknown) {
    const cat = String(categoria || '').trim().toUpperCase();
    if (!GRADOS.some((g) => g.categoria === cat)) {
      throw new BadRequestException('Esa categoría no existe');
    }

    const config = await this.config();
    config.claves[cat] = this.limpiarClave(respuestas, config.preguntas);
    this.log.log(`Clave de la final cargada para la CAT. ${cat}.`);
    return this.guardarConfig(config);
  }

  async borrarClave(categoria: string) {
    const config = await this.config();
    delete config.claves[String(categoria || '').trim().toUpperCase()];
    return this.guardarConfig(config);
  }

  async guardarPuntajes(datos: Partial<PuntajesExamen>) {
    const config = await this.config();
    for (const campo of ['correcta', 'blanco', 'incorrecta'] as const) {
      if (datos[campo] === undefined) continue;
      const n = Number(datos[campo]);
      if (!Number.isFinite(n) || n < -100 || n > 100) {
        throw new BadRequestException('Los puntajes van de -100 a 100');
      }
      config.puntajes[campo] = n;
    }
    return this.guardarConfig(config);
  }

  /**
   * Cambiar cuántas preguntas trae la prueba recorta o rellena las claves ya
   * cargadas: dejarlas con otro largo haría que la corrección leyera de más.
   */
  async guardarPreguntas(cantidad: unknown) {
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PREGUNTAS) {
      throw new BadRequestException(`La prueba va de 1 a ${MAX_PREGUNTAS} preguntas`);
    }

    const config = await this.config();
    config.preguntas = n;
    for (const cat of Object.keys(config.claves)) {
      config.claves[cat] = this.limpiarClave(config.claves[cat], n);
    }
    return this.guardarConfig(config);
  }

  async abrir(abierto: boolean) {
    const config = await this.config();
    config.abierto = abierto;
    this.log.warn(`El envío de la final quedó ${abierto ? 'abierto' : 'cerrado'}.`);
    return this.guardarConfig(config);
  }

  // -------------------------------------------------------------- la plantilla

  /** El Excel del salón, con su gente ya escrita y las alternativas en lista. */
  async plantilla(numero: number): Promise<{ buffer: Buffer; nombre: string }> {
    const salon = await this.final.salon(numero);
    const config = await this.config();

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet(`CAT. ${salon.categoria}`);

    hoja.columns = [
      { width: 6 },
      { width: 14 },
      { width: 40 },
      ...Array.from({ length: config.preguntas }, () => ({ width: 6 })),
    ] as any;

    const marca = hoja.addRow(['I - OMASUR UNI 2026 · final macrorregional']);
    marca.font = { bold: true, size: 16, color: { argb: GRANATE } };
    marca.height = 24;

    const titulo = hoja.addRow([`SALÓN ${salon.numero} · CAT. ${salon.categoria} · ${salon.grado}`]);
    titulo.font = { bold: true, size: 13, color: { argb: 'FF111827' } };
    hoja.addRow(['Marque A, B, C, D, E o BLANCO en cada pregunta.']).font = {
      size: 10,
      italic: true,
      color: { argb: 'FF6B7280' },
    };
    hoja.addRow(['Al que no se presentó, déjelo en blanco y avise en la observación.']).font = {
      size: 10,
      italic: true,
      color: { argb: 'FF6B7280' },
    };
    hoja.addRow([]);

    const encabezado = hoja.addRow([
      'N°',
      'DNI',
      'APELLIDOS Y NOMBRES',
      ...Array.from({ length: config.preguntas }, (_, i) => `P${i + 1}`),
    ]);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRANATE } };
    encabezado.height = 22;
    encabezado.alignment = { horizontal: 'center', vertical: 'middle' };

    const primera = encabezado.number + 1;
    salon.alumnos.forEach((a, i) => {
      const fila = hoja.addRow([i + 1, a.dni, a.nombres]);
      fila.getCell(2).numFmt = '@';
      fila.height = 20;
    });

    hoja.views = [{ state: 'frozen', xSplit: 3, ySplit: encabezado.number }];

    if (salon.alumnos.length > 0) {
      const opciones = '"' + ALTERNATIVAS.join(',') + '"';
      const ultima = primera + salon.alumnos.length - 1;
      for (let f = primera; f <= ultima; f++) {
        for (let c = 4; c < 4 + config.preguntas; c++) {
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
            error: 'Solo A, B, C, D, E o BLANCO.',
          };
        }
      }
    }

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(`respuestas-salon-${salon.numero}`),
    };
  }

  // ----------------------------------------------------------------- el envío

  /** Lee el archivo y lo corrige, sin guardar nada. Es «probar el envío». */
  async revisar(numero: number, archivo: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Adjunte el Excel con las respuestas');

    const [salon, config] = await Promise.all([this.final.salon(numero), this.config()]);
    const esperados = new Map(salon.alumnos.map((a) => [a.dni, a]));

    const libro = new ExcelJS.Workbook();
    try {
      await libro.xlsx.load(archivo.buffer as any);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo. ¿Es el Excel que descargó?');
    }

    const errores: string[] = [];
    const filas: CorregidoFinal[] = [];
    const vistos = new Set<string>();

    for (const hoja of libro.worksheets) {
      hoja.eachRow((fila, numeroFila) => {
        const dni = String(fila.getCell(2).value ?? '').trim();
        if (!dni || !/^\d{6,12}$/.test(dni)) return;

        const alumno = esperados.get(dni);
        if (!alumno) {
          errores.push(`Fila ${numeroFila}: el DNI ${dni} no es de este salón.`);
          return;
        }
        if (vistos.has(dni)) {
          errores.push(`Fila ${numeroFila}: ${alumno.nombres} aparece dos veces.`);
          return;
        }
        vistos.add(dni);

        const respuestas: Alternativa[] = [];
        for (let i = 0; i < config.preguntas; i++) {
          const bruto = fila.getCell(4 + i).value;
          const plano =
            typeof bruto === 'object' && bruto !== null
              ? (bruto as any).result ?? (bruto as any).text
              : bruto;
          const valor = this.comoAlternativa(plano);
          if (valor === null && String(plano ?? '').trim() !== '') {
            errores.push(
              `Fila ${numeroFila} (${alumno.nombres}), P${i + 1}: «${String(plano).trim()}» no es una alternativa válida.`,
            );
          }
          respuestas.push(valor ?? 'BLANCO');
        }

        filas.push(this.corregir(alumno, salon.categoria, respuestas, config));
      });
    }

    // Quien no venga en el archivo es un ausente: se avisa, no se frena.
    const ausentes = salon.alumnos.filter((a) => !vistos.has(a.dni)).map((a) => a.nombres);

    return {
      salon: salon.numero,
      categoria: salon.categoria,
      grado: salon.grado,
      filas: filas.sort((a, b) => b.puntaje - a.puntaje || a.nombres.localeCompare(b.nombres, 'es')),
      errores,
      ausentes,
      puntajes: config.puntajes,
      preguntas: config.preguntas,
      clave: config.claves[salon.categoria] || null,
      sinClave: !config.claves[salon.categoria],
    };
  }

  /** Lo mismo, guardando. */
  async registrar(
    numero: number,
    archivo: Express.Multer.File,
    autor: { nombre: string; esAdmin: boolean },
  ) {
    const config = await this.config();
    if (!config.abierto && !autor.esAdmin) {
      throw new BadRequestException('El envío de respuestas de la final todavía no está abierto.');
    }

    const revision = await this.revisar(numero, archivo);
    if (revision.errores.length > 0) {
      throw new BadRequestException('Corrija los errores del archivo antes de enviarlo.');
    }
    if (revision.filas.length === 0) {
      throw new BadRequestException('El archivo no trae ninguna respuesta.');
    }

    const registro = {
      salon: revision.salon,
      categoria: revision.categoria,
      enviadoEn: new Date().toISOString(),
      registradoPor: autor.nombre,
      filas: revision.filas,
    };

    const clave = CLAVE_RESPUESTAS(revision.salon);
    await this.prisma.ajuste.upsert({
      where: { clave },
      create: { clave, valor: JSON.stringify(registro) },
      update: { valor: JSON.stringify(registro) },
    });

    this.log.log(`Salón ${revision.salon}: ${revision.filas.length} respuestas de la final.`);
    return {
      ok: true,
      total: revision.filas.length,
      ausentes: revision.ausentes.length,
      enviadoEn: registro.enviadoEn,
    };
  }

  async anular(numero: number) {
    const entrega = await this.entregaDe(numero);
    if (!entrega) throw new NotFoundException('Ese salón todavía no envió respuestas');

    await this.prisma.ajuste.delete({ where: { clave: CLAVE_RESPUESTAS(Number(numero)) } });
    this.log.warn(`Se anuló el envío del salón ${numero}.`);
    return { ok: true, salon: Number(numero), total: entrega.filas.length };
  }

  /** Lo entregado por un salón, vuelto a corregir con la clave de ahora. */
  async entregaDe(numero: number, config?: ConfigExamenFinal) {
    const fila = await this.prisma.ajuste.findUnique({
      where: { clave: CLAVE_RESPUESTAS(Number(numero)) },
    });
    if (!fila?.valor) return null;

    try {
      return this.recorregir(JSON.parse(fila.valor), config ?? (await this.config()));
    } catch {
      return null;
    }
  }

  private recorregir(entrega: any, config: ConfigExamenFinal) {
    const filas: CorregidoFinal[] = entrega?.filas || [];
    return {
      ...entrega,
      puntajes: config.puntajes,
      filas: filas.map((f) =>
        this.corregir(f, entrega.categoria || f.categoria, f.respuestas, config),
      ),
    };
  }

  async corregirAlumno(numero: number, dni: string, respuestas: unknown) {
    const guardado = await this.prisma.ajuste.findUnique({
      where: { clave: CLAVE_RESPUESTAS(Number(numero)) },
    });
    if (!guardado?.valor) throw new NotFoundException('Ese salón todavía no envió respuestas');

    const entrega = JSON.parse(guardado.valor);
    const config = await this.config();
    const fila = (entrega.filas || []).find(
      (f: CorregidoFinal) => f.dni === String(dni).trim(),
    );
    if (!fila) throw new NotFoundException('Ese estudiante no está en el envío de este salón');

    const nueva = this.corregir(
      fila,
      entrega.categoria || fila.categoria,
      this.limpiarClave(respuestas, config.preguntas),
      config,
    );
    entrega.filas = entrega.filas.map((f: CorregidoFinal) => (f.dni === fila.dni ? nueva : f));
    entrega.corregidoEn = new Date().toISOString();

    await this.prisma.ajuste.update({
      where: { clave: CLAVE_RESPUESTAS(Number(numero)) },
      data: { valor: JSON.stringify(entrega) },
    });

    this.log.warn(`Se corrigieron las respuestas de ${fila.nombres} en el salón ${numero}.`);
    return nueva;
  }

  // ------------------------------------------------------------------ consultas

  /** Qué salones entregaron y cuáles faltan: el tablero de la mañana. */
  async entregas(): Promise<EntregaSalon[]> {
    const [{ salones }, config] = await Promise.all([this.final.estado(), this.config()]);
    const filas = await this.prisma.ajuste.findMany({
      where: { clave: { startsWith: 'examen_final_respuestas_' } },
    });

    const porSalon = new Map<number, any>();
    for (const f of filas) {
      try {
        const d = this.recorregir(JSON.parse(f.valor), config);
        porSalon.set(Number(d.salon), d);
      } catch {
        /* una fila ilegible no puede tumbar el tablero */
      }
    }

    return salones.map((s) => {
      const entrega = porSalon.get(s.numero);
      const puntajes: number[] = (entrega?.filas || []).map((x: CorregidoFinal) => x.puntaje);

      return {
        salon: s.numero,
        nivel: s.nivel,
        categoria: s.categoria,
        grado: s.grado,
        responsable: s.responsable?.nombre || null,
        enviadoEn: entrega?.enviadoEn || null,
        registradoPor: entrega?.registradoPor || '',
        esperados: s.total,
        recibidos: puntajes.length,
        ausentes: entrega ? Math.max(0, s.total - puntajes.length) : 0,
        puntajeAlto: puntajes.length ? Math.max(...puntajes) : 0,
        promedio: puntajes.length
          ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 100) / 100
          : 0,
      };
    });
  }

  /** Todas las respuestas recibidas, ya corregidas y con su salón al lado. */
  async todas(): Promise<(CorregidoFinal & { salon: number; nivel: string })[]> {
    const [{ salones }, config] = await Promise.all([this.final.estado(), this.config()]);
    const lista: (CorregidoFinal & { salon: number; nivel: string })[] = [];

    for (const s of salones) {
      const entrega = await this.entregaDe(s.numero, config);
      for (const fila of entrega?.filas || []) {
        lista.push({ ...fila, salon: s.numero, nivel: s.nivel });
      }
    }

    return lista;
  }

  async consolidado() {
    const entregas = await this.entregas();
    const recibidos = entregas.reduce((n, e) => n + e.recibidos, 0);
    const esperados = entregas.reduce((n, e) => n + e.esperados, 0);

    return {
      salones: entregas,
      resumen: {
        salones: entregas.length,
        entregados: entregas.filter((e) => e.enviadoEn).length,
        pendientes: entregas.filter((e) => !e.enviadoEn).length,
        esperados,
        recibidos,
        ausentes: entregas.filter((e) => e.enviadoEn).reduce((n, e) => n + e.ausentes, 0),
      },
      porCategoria: [...new Set(entregas.map((e) => e.categoria))].sort().map((categoria) => {
        const suyos = entregas.filter((e) => e.categoria === categoria);
        return {
          categoria,
          grado: suyos[0]?.grado || '',
          salones: suyos.length,
          esperados: suyos.reduce((n, e) => n + e.esperados, 0),
          recibidos: suyos.reduce((n, e) => n + e.recibidos, 0),
          completo: suyos.every((e) => e.enviadoEn),
        };
      }),
    };
  }

  // --------------------------------------------------------------------- Excel

  /** Las respuestas de un salón, pregunta por pregunta y con su acierto. */
  async excelEnviadas(numero: number): Promise<{ buffer: Buffer; nombre: string }> {
    const config = await this.config();
    const entrega = await this.entregaDe(numero, config);
    if (!entrega) throw new NotFoundException('Ese salón todavía no envió respuestas');

    const salon = await this.final.salon(numero);
    const clave = config.claves[salon.categoria] || [];

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet(`SALÓN ${salon.numero}`);

    const columnas = [
      { header: 'N°', width: 6 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 36 },
      { header: 'INSTITUCIÓN', width: 32 },
      ...Array.from({ length: config.preguntas }, (_, i) => ({ header: `P${i + 1}`, width: 6 })),
      { header: 'ACIERTOS', width: 11 },
      { header: 'ERRORES', width: 11 },
      { header: 'BLANCOS', width: 11 },
      { header: 'PUNTAJE', width: 11 },
    ];

    escribirTitulo(
      hoja,
      columnas.length,
      `Respuestas · SALÓN ${salon.numero} · CAT. ${salon.categoria} · ${salon.grado}`,
      `Final macrorregional · enviadas por ${entrega.registradoPor || 'la comisión'}`,
      entrega.filas.length,
    );
    escribirEncabezados(hoja, columnas);

    entrega.filas.forEach((f: CorregidoFinal, i: number) => {
      const fila = hoja.addRow([
        i + 1,
        f.dni,
        f.nombres,
        f.institucion,
        ...f.respuestas,
        f.correctas,
        f.incorrectas,
        f.blancos,
        f.puntaje,
      ]);
      fila.getCell(2).numFmt = '@';
      fila.getCell(columnas.length).font = { bold: true, color: { argb: GRANATE } };

      f.respuestas.forEach((r, j) => {
        const celda = fila.getCell(5 + j);
        celda.alignment = { horizontal: 'center' };
        if (clave[j] && r === clave[j]) {
          celda.font = { bold: true, color: { argb: 'FF047857' } };
        } else if (r !== 'BLANCO' && clave[j]) {
          celda.font = { color: { argb: 'FF9CA3AF' } };
        }
      });
    });

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(`respuestas-enviadas-salon-${salon.numero}`),
    };
  }

  /** El consolidado de la mañana: salón por salón, qué entró y qué falta. */
  async excelConsolidado(): Promise<{ buffer: Buffer; nombre: string }> {
    const { salones, resumen } = await this.consolidado();

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet('Consolidado');

    const columnas = [
      { header: 'SALÓN', width: 10 },
      { header: 'NIVEL', width: 14 },
      { header: 'CAT.', width: 8 },
      { header: 'GRADO', width: 20 },
      { header: 'RESPONSABLE', width: 30 },
      { header: 'ESPERADOS', width: 12 },
      { header: 'RECIBIDOS', width: 12 },
      { header: 'AUSENTES', width: 12 },
      { header: 'PUNTAJE ALTO', width: 14 },
      { header: 'PROMEDIO', width: 12 },
      { header: 'ESTADO', width: 16 },
    ];

    escribirTitulo(
      hoja,
      columnas.length,
      'Consolidado del examen final',
      `${resumen.entregados} de ${resumen.salones} salones entregados · ${resumen.recibidos} de ${resumen.esperados} respuestas`,
      salones.length,
    );
    escribirEncabezados(hoja, columnas);

    salones.forEach((s) => {
      const fila = hoja.addRow([
        s.salon,
        s.nivel === 'SECUNDARIA' ? 'Secundaria' : 'Primaria',
        s.categoria,
        s.grado,
        s.responsable || 'Sin asignar',
        s.esperados,
        s.recibidos,
        s.ausentes,
        s.puntajeAlto,
        s.promedio,
        s.enviadoEn ? 'Entregado' : 'Pendiente',
      ]);
      fila.getCell(11).font = {
        bold: true,
        color: { argb: s.enviadoEn ? 'FF047857' : 'FFB91C1C' },
      };
    });

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo('consolidado-examen-final'),
    };
  }

  // -------------------------------------------------------------------- apoyos

  private corregir(
    alumno: { dni: string; nombres: string; institucion?: string; tutorId?: string },
    categoria: string,
    respuestas: Alternativa[],
    config: ConfigExamenFinal,
  ): CorregidoFinal {
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
      institucion: alumno.institucion || '',
      tutorId: alumno.tutorId || '',
      categoria,
      respuestas,
      correctas,
      incorrectas,
      blancos,
      puntaje: correctas * p.correcta + blancos * p.blanco + incorrectas * p.incorrecta,
    };
  }

  private limpiarClave(respuestas: unknown, preguntas: number): Alternativa[] {
    const lista = Array.isArray(respuestas) ? respuestas : [];
    return Array.from(
      { length: preguntas },
      (_, i) => this.comoAlternativa(lista[i]) ?? 'BLANCO',
    );
  }

  private comoAlternativa(valor: unknown): Alternativa | null {
    const texto = String(valor ?? '').trim().toUpperCase();
    if (!texto) return null;
    if (texto === 'BLANCO' || texto === 'EN BLANCO' || texto === '-') return 'BLANCO';
    return (ALTERNATIVAS as readonly string[]).includes(texto) ? (texto as Alternativa) : null;
  }
}
