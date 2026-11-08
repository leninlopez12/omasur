import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { FinalService, NIVEL_TEXTO, NivelFinal, Salon, idSalon } from './final.service';
import { ALTERNATIVAS, Alternativa, PuntajesExamen } from '../examen/examen.service';
import { GRADOS } from '../common/grados';
import { GRANATE, escribirEncabezados, escribirTitulo, nombreArchivo } from '../common/excel';

const CLAVE_CONFIG = 'examen_final_config';
const CLAVE_RESPUESTAS = (salon: string) => `examen_final_respuestas_${salon}`;

/**
 * Cómo está armada la prueba de cada turno.
 *
 * Las dos tienen la misma cola de cinco preguntas de respuesta numérica, donde
 * no hay alternativas que marcar y se escribe el número; lo que cambia es
 * cuántas de alternativa vienen antes. Secundaria rinde una prueba más larga.
 */
export const ESTRUCTURA: Record<NivelFinal, { alternativas: number; numericas: number }> = {
  SECUNDARIA: { alternativas: 15, numericas: 5 },
  PRIMARIA: { alternativas: 10, numericas: 5 },
};

/**
 * El color de cada respuesta en el acta.
 *
 * Marcar veinte casillas por alumno a mano es donde se cuelan los errores:
 * con cada letra de un color, una fila mal corrida o una casilla olvidada se
 * ven de lejos, sin leerlas una por una. Los tonos son suaves a propósito,
 * que esto también se imprime.
 */
const COLOR_RESPUESTA: Record<string, { fondo: string; letra: string }> = {
  A: { fondo: 'FFDBEAFE', letra: 'FF1E3A8A' },
  B: { fondo: 'FFDCFCE7', letra: 'FF14532D' },
  C: { fondo: 'FFFEF3C7', letra: 'FF78350F' },
  D: { fondo: 'FFF3E8FF', letra: 'FF4C1D95' },
  E: { fondo: 'FFFFE4E6', letra: 'FF881337' },
  BLANCO: { fondo: 'FFE5E7EB', letra: 'FF4B5563' },
};

/** El nombre de una columna en Excel: 1 es A, 27 es AA. */
function columnaExcel(n: number): string {
  let nombre = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    nombre = String.fromCharCode(65 + resto) + nombre;
    n = Math.floor((n - 1) / 26);
  }
  return nombre;
}

export const nivelDe = (categoria: string): NivelFinal =>
  (GRADOS.find((g) => g.categoria === categoria)?.nivel as NivelFinal) || 'PRIMARIA';

export const totalPreguntas = (nivel: NivelFinal) =>
  ESTRUCTURA[nivel].alternativas + ESTRUCTURA[nivel].numericas;

/** La clave de una categoría: lo que marcan y lo que escriben. */
export interface ClaveCategoria {
  alternativas: Alternativa[];
  numericas: string[];
}

export interface ConfigExamenFinal {
  claves: Record<string, ClaveCategoria>;
  puntajes: PuntajesExamen;
  /** Mientras no esté abierto, solo el administrador puede subir un acta. */
  abierto: boolean;
  actualizado: string;
}

const CONFIG_VACIA: ConfigExamenFinal = {
  claves: {},
  puntajes: { correcta: 10, blanco: 0, incorrecta: -1 },
  abierto: false,
  actualizado: '',
};

export interface CorregidoFinal {
  dni: string;
  nombres: string;
  institucion: string;
  tutorId: string;
  categoria: string;
  nivel: NivelFinal;
  alternativas: Alternativa[];
  numericas: string[];
  correctas: number;
  incorrectas: number;
  blancos: number;
  puntaje: number;
  /** Lo que escribió el responsable, tal cual: «09:47». */
  horaEntrega: string;
  /** Minutos desde que empezó su turno. Null si no se anotó la hora. */
  minutos: number | null;
}

export interface EntregaSalon {
  id: string;
  salon: number;
  nivel: NivelFinal;
  nivelTexto: string;
  categorias: string[];
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
 * Es el mismo oficio que el institucional, con dos diferencias que cambian
 * todo lo demás. Aquí no entrega el tutor por su delegación, entrega el
 * responsable por su salón. Y la prueba tiene dos tramos: las de alternativa,
 * que se marcan, y cinco de respuesta numérica, que se escriben.
 *
 * Cada alumno se corrige con la clave de su categoría y no con la de su aula,
 * porque un salón puede acabar con gente de varias si lo acomodaron a mano.
 *
 * El acta pide además la hora a la que cada uno entregó: a igual puntaje gana
 * quien terminó antes, y sin ese dato la final se llenaría de empates.
 *
 * Lo guardado son las respuestas; el puntaje se vuelve a sacar en cada lectura
 * con la clave vigente, para que corregir una clave mal cargada arrastre sin
 * que nadie reenvíe nada.
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
      const claves: Record<string, ClaveCategoria> = {};

      for (const [categoria, clave] of Object.entries(guardada.claves || {})) {
        claves[categoria] = this.limpiarClave(clave, nivelDe(categoria));
      }

      return {
        ...this.vacia(),
        ...guardada,
        claves,
        puntajes: { ...CONFIG_VACIA.puntajes, ...guardada.puntajes },
      };
    } catch {
      return this.vacia();
    }
  }

  private vacia(): ConfigExamenFinal {
    return { ...CONFIG_VACIA, claves: {}, puntajes: { ...CONFIG_VACIA.puntajes } };
  }

  /** La estructura de la prueba, para que la pantalla arme sus casillas. */
  estructura() {
    return GRADOS.map((g) => ({
      categoria: g.categoria,
      grado: g.label,
      nivel: g.nivel,
      nivelTexto: NIVEL_TEXTO[g.nivel as NivelFinal],
      ...ESTRUCTURA[g.nivel as NivelFinal],
      total: totalPreguntas(g.nivel as NivelFinal),
    }));
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

  async guardarClave(categoria: string, clave: unknown) {
    const cat = String(categoria || '').trim().toUpperCase();
    if (!GRADOS.some((g) => g.categoria === cat)) {
      throw new BadRequestException('Esa categoría no existe');
    }

    const config = await this.config();
    config.claves[cat] = this.limpiarClave(clave, nivelDe(cat));
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

  async abrir(abierto: boolean) {
    const config = await this.config();
    config.abierto = abierto;
    this.log.warn(`El envío de la final quedó ${abierto ? 'abierto' : 'cerrado'}.`);
    return this.guardarConfig(config);
  }

  // -------------------------------------------------------------- la plantilla

  /** El acta del salón, con su gente ya escrita y las casillas listas. */
  async plantilla(nivel: string, numero: number): Promise<{ buffer: Buffer; nombre: string }> {
    const [salon, dia] = await Promise.all([
      this.final.salon(nivel, numero),
      this.final.config(),
    ]);
    const forma = ESTRUCTURA[salon.nivel];
    const mezclado = new Set(salon.alumnos.map((a) => a.categoria)).size > 1;

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet(`SALÓN ${salon.numero}`);

    // N°, DNI, nombres, [cat], alternativas, numéricas, hora.
    const colCat = mezclado ? 1 : 0;
    const primeraAlt = 4 + colCat;
    const primeraNum = primeraAlt + forma.alternativas;
    const colHora = primeraNum + forma.numericas;

    hoja.columns = [
      { width: 6 },
      { width: 14 },
      { width: 38 },
      ...(mezclado ? [{ width: 7 }] : []),
      ...Array.from({ length: forma.alternativas }, () => ({ width: 6 })),
      ...Array.from({ length: forma.numericas }, () => ({ width: 9 })),
      { width: 15 },
    ] as any;

    const marca = hoja.addRow(['I - OMASUR UNI 2026 · final macrorregional']);
    marca.font = { bold: true, size: 16, color: { argb: GRANATE } };
    marca.height = 24;

    const titulo = hoja.addRow([
      `SALÓN ${salon.numero} · ${NIVEL_TEXTO[salon.nivel].toUpperCase()}`,
    ]);
    titulo.font = { bold: true, size: 13, color: { argb: 'FF111827' } };

    // La numeración es la del examen impreso, corrida de principio a fin:
    // el responsable copia la fila sin tener que traducir «N1» a «16».
    hoja.addRow([
      `Preguntas 1 a ${forma.alternativas}: marque A, B, C, D, E o BLANCO. ` +
        `Preguntas ${forma.alternativas + 1} a ${forma.alternativas + forma.numericas}: ` +
        'escriba el número que respondió; en blanco si no respondió.',
    ]).font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    hoja.addRow([
      'HORA DE ENTREGA: elíjala de la lista de la casilla o escríbala a mano, en formato 09:47. ' +
        'A igual puntaje pasa primero quien entregó antes.',
    ]).font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    hoja.addRow(['Al que no se presentó, déjelo con todo en blanco.']).font = {
      size: 10,
      italic: true,
      color: { argb: 'FF6B7280' },
    };
    hoja.addRow([]);

    const encabezado = hoja.addRow([
      'N°',
      'DNI',
      'APELLIDOS Y NOMBRES',
      ...(mezclado ? ['CAT.'] : []),
      ...Array.from({ length: forma.alternativas }, (_, i) => `${i + 1}`),
      ...Array.from(
        { length: forma.numericas },
        (_, i) => `${forma.alternativas + i + 1}`,
      ),
      'HORA DE ENTREGA',
    ]);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRANATE } };
    encabezado.height = 24;
    encabezado.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const primera = encabezado.number + 1;
    salon.alumnos.forEach((a, i) => {
      const fila = hoja.addRow([
        i + 1,
        a.dni,
        a.nombres,
        ...(mezclado ? [a.categoria] : []),
      ]);
      fila.getCell(2).numFmt = '@';
      fila.height = 20;
    });

    hoja.views = [{ state: 'frozen', xSplit: 3 + colCat, ySplit: encabezado.number }];

    if (salon.alumnos.length > 0) {
      const opciones = '"' + ALTERNATIVAS.join(',') + '"';
      const horas = this.horasSugeridas(dia.bloques[salon.nivel]);
      const ultima = primera + salon.alumnos.length - 1;

      for (let f = primera; f <= ultima; f++) {
        for (let c = primeraAlt; c <= colHora; c++) {
          const celda = hoja.getCell(f, c);
          celda.alignment = { horizontal: 'center', vertical: 'middle' };
          celda.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          // El fondo distingue los tres bloques de un vistazo; encima de este
          // va el color de cada respuesta, que lo pinta Excel al escribirla.
          celda.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
              argb: c < primeraNum ? 'FFFDF3F5' : c < colHora ? 'FFFFF7ED' : 'FFF1F5F9',
            },
          };

          if (c < primeraNum) {
            celda.font = { bold: true, size: 12 };
            celda.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [opciones],
              showErrorMessage: true,
              errorTitle: 'Respuesta inválida',
              error: 'Solo A, B, C, D, E o BLANCO.',
            };
          } else {
            // Las numéricas y la hora van como texto: con formato de número,
            // Excel convierte «09:47» en una fracción de día y «007» en 7.
            celda.numFmt = '@';
            if (c === colHora && horas) {
              // Sugerida, no obligatoria: la lista ahorra escribir, pero si
              // entregó a una hora que no está en ella se escribe a mano.
              celda.dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [horas],
                showErrorMessage: false,
              };
            }
          }
        }
      }

      this.pintarRespuestas(hoja, primera, ultima, primeraAlt, primeraNum, colHora);
    }

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(`acta-salon-${salon.numero}-${salon.nivel.toLowerCase()}`),
    };
  }

  // ----------------------------------------------------------------- el envío

  /** Lee el archivo y lo corrige, sin guardar nada. Es «probar el envío». */
  async revisar(nivel: string, numero: number, archivo: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Adjunte el Excel con las respuestas');

    const [salon, config, { config: dia }] = await Promise.all([
      this.final.salon(nivel, numero),
      this.config(),
      this.final.estado(),
    ]);

    const forma = ESTRUCTURA[salon.nivel];
    const mezclado = new Set(salon.alumnos.map((a) => a.categoria)).size > 1;
    const colCat = mezclado ? 1 : 0;
    const primeraAlt = 4 + colCat;
    const primeraNum = primeraAlt + forma.alternativas;
    const colHora = primeraNum + forma.numericas;
    const inicio = dia.bloques[salon.nivel].inicio;

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
        const dni = String(this.plano(fila.getCell(2).value) ?? '').trim();
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

        const alternativas: Alternativa[] = [];
        for (let i = 0; i < forma.alternativas; i++) {
          const bruto = this.plano(fila.getCell(primeraAlt + i).value);
          const valor = this.comoAlternativa(bruto);
          if (valor === null && String(bruto ?? '').trim() !== '') {
            errores.push(
              `Fila ${numeroFila} (${alumno.nombres}), pregunta ${i + 1}: ` +
                `«${String(bruto).trim()}» no es una alternativa válida.`,
            );
          }
          alternativas.push(valor ?? 'BLANCO');
        }

        const numericas: string[] = [];
        for (let i = 0; i < forma.numericas; i++) {
          numericas.push(this.comoNumero(this.plano(fila.getCell(primeraNum + i).value)));
        }

        // Sin pasarla por String primero: si la casilla quedó con formato de
        // hora, lo que llega es una fecha o la fracción del día, y volverla
        // texto aquí perdía justo lo que comoHora sabe interpretar.
        const horaCruda = this.plano(fila.getCell(colHora).value);
        const horaEntrega = this.comoHora(horaCruda);
        const horaBruta = String(horaCruda ?? '').trim();
        if (horaBruta && !horaEntrega) {
          errores.push(
            `Fila ${numeroFila} (${alumno.nombres}): «${horaBruta}» no es una hora. Escríbala como 09:47.`,
          );
        }

        filas.push(
          this.corregir(alumno, { alternativas, numericas, horaEntrega }, config, inicio),
        );
      });
    }

    // Quien no venga en el archivo es un ausente: se avisa, no se frena.
    const ausentes = salon.alumnos.filter((a) => !vistos.has(a.dni)).map((a) => a.nombres);
    const sinHora = filas.filter((f) => f.minutos === null).map((f) => f.nombres);
    const sinClave = [...new Set(filas.map((f) => f.categoria))].filter(
      (c) => !config.claves[c],
    );

    return {
      salon: salon.numero,
      nivel: salon.nivel,
      nivelTexto: NIVEL_TEXTO[salon.nivel],
      forma,
      filas: filas.sort(
        (a, b) =>
          b.puntaje - a.puntaje ||
          (a.minutos ?? Infinity) - (b.minutos ?? Infinity) ||
          a.nombres.localeCompare(b.nombres, 'es'),
      ),
      errores,
      ausentes,
      sinHora,
      sinClave,
      puntajes: config.puntajes,
    };
  }

  /** Lo mismo, guardando. */
  async registrar(
    nivel: string,
    numero: number,
    archivo: Express.Multer.File,
    autor: { nombre: string; esAdmin: boolean },
  ) {
    const config = await this.config();
    if (!config.abierto && !autor.esAdmin) {
      throw new BadRequestException('El envío de respuestas de la final todavía no está abierto.');
    }

    const revision = await this.revisar(nivel, numero, archivo);
    if (revision.errores.length > 0) {
      throw new BadRequestException('Corrija los errores del archivo antes de enviarlo.');
    }
    if (revision.filas.length === 0) {
      throw new BadRequestException('El archivo no trae ninguna respuesta.');
    }

    const registro = {
      salon: revision.salon,
      nivel: revision.nivel,
      enviadoEn: new Date().toISOString(),
      registradoPor: autor.nombre,
      filas: revision.filas,
    };

    const clave = CLAVE_RESPUESTAS(idSalon(revision.nivel, revision.salon));
    await this.prisma.ajuste.upsert({
      where: { clave },
      create: { clave, valor: JSON.stringify(registro) },
      update: { valor: JSON.stringify(registro) },
    });

    this.log.log(`Salón ${revision.salon} (${revision.nivel}): ${revision.filas.length} respuestas.`);
    return {
      ok: true,
      total: revision.filas.length,
      ausentes: revision.ausentes.length,
      sinHora: revision.sinHora.length,
      enviadoEn: registro.enviadoEn,
    };
  }

  async anular(nivel: string, numero: number) {
    const entrega = await this.entregaDe(nivel, numero);
    if (!entrega) throw new NotFoundException('Ese salón todavía no envió respuestas');

    await this.prisma.ajuste.delete({
      where: { clave: CLAVE_RESPUESTAS(idSalon(nivel as NivelFinal, Number(numero))) },
    });
    this.log.warn(`Se anuló el envío del salón ${numero} (${nivel}).`);
    return { ok: true, salon: Number(numero), total: entrega.filas.length };
  }

  /** Lo entregado por un salón, vuelto a corregir con la clave de ahora. */
  async entregaDe(nivel: string, numero: number, config?: ConfigExamenFinal) {
    const fila = await this.prisma.ajuste.findUnique({
      where: { clave: CLAVE_RESPUESTAS(idSalon(nivel as NivelFinal, Number(numero))) },
    });
    if (!fila?.valor) return null;

    try {
      const dia = await this.final.config();
      return this.recorregir(
        JSON.parse(fila.valor),
        config ?? (await this.config()),
        dia.bloques[nivel as NivelFinal].inicio,
      );
    } catch {
      return null;
    }
  }

  private recorregir(entrega: any, config: ConfigExamenFinal, inicio: string) {
    const filas: CorregidoFinal[] = entrega?.filas || [];
    return {
      ...entrega,
      puntajes: config.puntajes,
      filas: filas.map((f) => this.corregir(f, f, config, inicio)),
    };
  }

  async corregirAlumno(nivel: string, numero: number, dni: string, datos: any) {
    const clave = CLAVE_RESPUESTAS(idSalon(nivel as NivelFinal, Number(numero)));
    const guardado = await this.prisma.ajuste.findUnique({ where: { clave } });
    if (!guardado?.valor) throw new NotFoundException('Ese salón todavía no envió respuestas');

    const entrega = JSON.parse(guardado.valor);
    const config = await this.config();
    const dia = await this.final.config();
    const fila = (entrega.filas || []).find(
      (f: CorregidoFinal) => f.dni === String(dni).trim(),
    );
    if (!fila) throw new NotFoundException('Ese estudiante no está en el envío de este salón');

    const nueva = this.corregir(
      fila,
      {
        alternativas: datos?.alternativas ?? fila.alternativas,
        numericas: datos?.numericas ?? fila.numericas,
        horaEntrega: datos?.horaEntrega ?? fila.horaEntrega,
      },
      config,
      dia.bloques[nivel as NivelFinal].inicio,
    );

    entrega.filas = entrega.filas.map((f: CorregidoFinal) => (f.dni === fila.dni ? nueva : f));
    entrega.corregidoEn = new Date().toISOString();
    await this.prisma.ajuste.update({ where: { clave }, data: { valor: JSON.stringify(entrega) } });

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

    const porSalon = new Map<string, any>();
    for (const f of filas) {
      try {
        porSalon.set(f.clave.replace('examen_final_respuestas_', ''), JSON.parse(f.valor));
      } catch {
        /* una fila ilegible no puede tumbar el tablero */
      }
    }

    return salones.map((s) => {
      const guardada = porSalon.get(s.id);
      const inicio = s.horario.inicio;
      const filas: CorregidoFinal[] = (guardada?.filas || []).map((f: CorregidoFinal) =>
        this.corregir(f, f, config, inicio),
      );
      const puntajes = filas.map((x) => x.puntaje);

      return {
        id: s.id,
        salon: s.numero,
        nivel: s.nivel,
        nivelTexto: NIVEL_TEXTO[s.nivel],
        categorias: s.categorias,
        responsable: s.responsable?.nombre || null,
        enviadoEn: guardada?.enviadoEn || null,
        registradoPor: guardada?.registradoPor || '',
        esperados: s.total,
        recibidos: filas.length,
        ausentes: guardada ? Math.max(0, s.total - filas.length) : 0,
        puntajeAlto: puntajes.length ? Math.max(...puntajes) : 0,
        promedio: puntajes.length
          ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 100) / 100
          : 0,
      };
    });
  }

  /** Todas las respuestas recibidas, ya corregidas y con su salón al lado. */
  async todas(): Promise<(CorregidoFinal & { salon: number })[]> {
    const [{ salones }, config] = await Promise.all([this.final.estado(), this.config()]);
    const filas = await this.prisma.ajuste.findMany({
      where: { clave: { startsWith: 'examen_final_respuestas_' } },
    });
    const porSalon = new Map<string, any>();
    for (const f of filas) {
      try {
        porSalon.set(f.clave.replace('examen_final_respuestas_', ''), JSON.parse(f.valor));
      } catch {
        /* se ignora */
      }
    }

    const lista: (CorregidoFinal & { salon: number })[] = [];
    for (const s of salones) {
      const guardada = porSalon.get(s.id);
      for (const fila of guardada?.filas || []) {
        lista.push({
          ...this.corregir(fila, fila, config, s.horario.inicio),
          salon: s.numero,
        });
      }
    }
    return lista;
  }

  /**
   * Las horas que ofrece la casilla, de cinco en cinco.
   *
   * Desde que empieza el turno hasta un rato después de que termina, porque
   * siempre hay quien entrega sobre la hora o un poco pasado.
   */
  private horasSugeridas(bloque?: { inicio: string; fin: string }): string | null {
    if (!bloque?.inicio || !bloque?.fin) return null;

    const minutos = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
    };

    const desde = minutos(bloque.inicio);
    const hasta = minutos(bloque.fin);
    if (desde === null || hasta === null || hasta <= desde) return null;

    const lista: string[] = [];
    for (let t = desde; t <= hasta + 20 && lista.length < 40; t += 5) {
      lista.push(
        `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`,
      );
    }
    // Excel no admite listas en línea de más de 255 caracteres.
    const texto = lista.join(',');
    return texto.length > 250 ? null : '"' + texto + '"';
  }

  /**
   * El color de cada casilla, puesto por Excel mientras se escribe.
   *
   * Va como formato condicional y no como relleno fijo porque el acta se
   * llena después de bajarla: la casilla tiene que encenderse cuando el
   * responsable escribe la letra, no antes.
   */
  private pintarRespuestas(
    hoja: ExcelJS.Worksheet,
    primera: number,
    ultima: number,
    primeraAlt: number,
    primeraNum: number,
    colHora: number,
  ) {
    const relleno = (argb: string) =>
      ({ type: 'pattern', pattern: 'solid', bgColor: { argb } }) as any;

    hoja.addConditionalFormatting({
      ref: `${columnaExcel(primeraAlt)}${primera}:${columnaExcel(primeraNum - 1)}${ultima}`,
      rules: Object.entries(COLOR_RESPUESTA).map(([alternativa, color], i) => ({
        type: 'cellIs' as const,
        operator: 'equal' as const,
        priority: i + 1,
        formulae: ['"' + alternativa + '"'],
        style: { fill: relleno(color.fondo), font: { bold: true, color: { argb: color.letra } } },
      })),
    });

    // Las numéricas y la hora solo dicen «ya está puesta»: lo que se busca de
    // un vistazo es la casilla que quedó vacía.
    for (const [desde, hasta] of [
      [primeraNum, colHora - 1],
      [colHora, colHora],
    ]) {
      if (hasta < desde) continue;
      const inicio = `${columnaExcel(desde)}${primera}`;
      hoja.addConditionalFormatting({
        ref: `${inicio}:${columnaExcel(hasta)}${ultima}`,
        rules: [
          {
            type: 'expression',
            priority: 1,
            formulae: [`LEN(TRIM(${inicio}))>0`],
            style: {
              fill: relleno('FFDCFCE7'),
              font: { bold: true, color: { argb: 'FF14532D' } },
            },
          },
        ],
      });
    }
  }

  async consolidado() {
    const entregas = await this.entregas();
    const recibidos = entregas.reduce((n, e) => n + e.recibidos, 0);
    const esperados = entregas.reduce((n, e) => n + e.esperados, 0);
    const config = await this.config();

    return {
      salones: entregas,
      claves: Object.keys(config.claves).sort(),
      resumen: {
        salones: entregas.length,
        entregados: entregas.filter((e) => e.enviadoEn).length,
        pendientes: entregas.filter((e) => !e.enviadoEn).length,
        esperados,
        recibidos,
        ausentes: entregas.filter((e) => e.enviadoEn).reduce((n, e) => n + e.ausentes, 0),
      },
      porNivel: ['SECUNDARIA', 'PRIMARIA'].map((nivel) => {
        const suyos = entregas.filter((e) => e.nivel === nivel);
        return {
          nivel,
          texto: NIVEL_TEXTO[nivel as NivelFinal],
          salones: suyos.length,
          entregados: suyos.filter((e) => e.enviadoEn).length,
          esperados: suyos.reduce((n, e) => n + e.esperados, 0),
          recibidos: suyos.reduce((n, e) => n + e.recibidos, 0),
        };
      }).filter((n) => n.salones > 0),
    };
  }

  // --------------------------------------------------------------------- Excel

  /** Las respuestas de un salón, pregunta por pregunta y con su acierto. */
  async excelEnviadas(nivel: string, numero: number): Promise<{ buffer: Buffer; nombre: string }> {
    const config = await this.config();
    const entrega = await this.entregaDe(nivel, numero, config);
    if (!entrega) throw new NotFoundException('Ese salón todavía no envió respuestas');

    const salon = await this.final.salon(nivel, numero);
    const forma = ESTRUCTURA[salon.nivel];

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet(`SALÓN ${salon.numero}`);

    const columnas = [
      { header: 'N°', width: 6 },
      { header: 'DNI', width: 14 },
      { header: 'APELLIDOS Y NOMBRES', width: 34 },
      { header: 'CAT.', width: 7 },
      { header: 'INSTITUCIÓN', width: 30 },
      ...Array.from({ length: forma.alternativas }, (_, i) => ({ header: `${i + 1}`, width: 6 })),
      ...Array.from({ length: forma.numericas }, (_, i) => ({
        header: `${forma.alternativas + i + 1}`,
        width: 8,
      })),
      { header: 'ENTREGÓ', width: 11 },
      { header: 'MIN.', width: 8 },
      { header: 'ACIERTOS', width: 11 },
      { header: 'ERRORES', width: 11 },
      { header: 'BLANCOS', width: 11 },
      { header: 'PUNTAJE', width: 11 },
    ];

    escribirTitulo(
      hoja,
      columnas.length,
      `Respuestas · SALÓN ${salon.numero} · ${NIVEL_TEXTO[salon.nivel].toUpperCase()}`,
      `Final macrorregional · enviadas por ${entrega.registradoPor || 'la comisión'}`,
      entrega.filas.length,
    );
    escribirEncabezados(hoja, columnas);

    entrega.filas.forEach((f: CorregidoFinal, i: number) => {
      const clave = config.claves[f.categoria];
      const fila = hoja.addRow([
        i + 1,
        f.dni,
        f.nombres,
        f.categoria,
        f.institucion,
        ...f.alternativas,
        ...f.numericas.map((n) => n || '—'),
        f.horaEntrega || '—',
        f.minutos ?? '—',
        f.correctas,
        f.incorrectas,
        f.blancos,
        f.puntaje,
      ]);
      fila.getCell(2).numFmt = '@';
      fila.getCell(columnas.length).font = { bold: true, color: { argb: GRANATE } };

      f.alternativas.forEach((r, j) => {
        const celda = fila.getCell(6 + j);
        celda.alignment = { horizontal: 'center' };
        if (clave?.alternativas[j] && r === clave.alternativas[j]) {
          celda.font = { bold: true, color: { argb: 'FF047857' } };
        } else if (r !== 'BLANCO' && clave) {
          celda.font = { color: { argb: 'FF9CA3AF' } };
        }
      });

      f.numericas.forEach((r, j) => {
        const celda = fila.getCell(6 + forma.alternativas + j);
        celda.alignment = { horizontal: 'center' };
        if (clave && r && this.mismoNumero(r, clave.numericas[j])) {
          celda.font = { bold: true, color: { argb: 'FF047857' } };
        } else if (r && clave) {
          celda.font = { color: { argb: 'FF9CA3AF' } };
        }
      });
    });

    return {
      buffer: (await libro.xlsx.writeBuffer()) as unknown as Buffer,
      nombre: nombreArchivo(`respuestas-salon-${salon.numero}-${salon.nivel.toLowerCase()}`),
    };
  }

  /** El consolidado de la mañana: salón por salón, qué entró y qué falta. */
  async excelConsolidado(): Promise<{ buffer: Buffer; nombre: string }> {
    const { salones, resumen } = await this.consolidado();

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet('Consolidado');

    const columnas = [
      { header: 'TURNO', width: 14 },
      { header: 'SALÓN', width: 10 },
      { header: 'CATEGORÍAS', width: 16 },
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
        s.nivelTexto,
        s.salon,
        s.categorias.join(', ') || '—',
        s.responsable || 'Sin asignar',
        s.esperados,
        s.recibidos,
        s.ausentes,
        s.puntajeAlto,
        s.promedio,
        s.enviadoEn ? 'Entregado' : 'Pendiente',
      ]);
      fila.getCell(10).font = {
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

  /**
   * Corrige a un alumno con la clave de su categoría.
   *
   * No con la de su aula: después de acomodar a mano un salón puede llevar
   * gente de varias, y cada uno rindió la prueba de la suya.
   */
  private corregir(
    alumno: { dni: string; nombres: string; institucion?: string; tutorId?: string; categoria: string },
    respuestas: { alternativas: unknown; numericas: unknown; horaEntrega?: string },
    config: ConfigExamenFinal,
    inicioTurno: string,
  ): CorregidoFinal {
    const nivel = nivelDe(alumno.categoria);
    const forma = ESTRUCTURA[nivel];
    const clave = config.claves[alumno.categoria];

    const alternativas = Array.from({ length: forma.alternativas }, (_, i) =>
      this.comoAlternativa((respuestas.alternativas as any[])?.[i]) ?? 'BLANCO',
    );
    const numericas = Array.from({ length: forma.numericas }, (_, i) =>
      this.comoNumero((respuestas.numericas as any[])?.[i]),
    );

    let correctas = 0;
    let incorrectas = 0;
    let blancos = 0;

    alternativas.forEach((r, i) => {
      if (r === 'BLANCO') blancos += 1;
      else if (clave && clave.alternativas[i] === r) correctas += 1;
      else if (clave) incorrectas += 1;
    });

    numericas.forEach((r, i) => {
      if (!r) blancos += 1;
      else if (clave && this.mismoNumero(r, clave.numericas[i])) correctas += 1;
      else if (clave) incorrectas += 1;
    });

    const p = config.puntajes;
    const horaEntrega = this.comoHora(respuestas.horaEntrega) || '';

    return {
      dni: alumno.dni,
      nombres: alumno.nombres,
      institucion: alumno.institucion || '',
      tutorId: alumno.tutorId || '',
      categoria: alumno.categoria,
      nivel,
      alternativas,
      numericas,
      correctas,
      incorrectas,
      blancos,
      puntaje: correctas * p.correcta + blancos * p.blanco + incorrectas * p.incorrecta,
      horaEntrega,
      minutos: this.minutosDesde(inicioTurno, horaEntrega),
    };
  }

  /** La clave con el largo que le toca a su nivel, ni más ni menos. */
  private limpiarClave(clave: unknown, nivel: NivelFinal): ClaveCategoria {
    const forma = ESTRUCTURA[nivel];
    const bruto = (clave || {}) as any;
    const alt = Array.isArray(bruto.alternativas) ? bruto.alternativas : [];
    const num = Array.isArray(bruto.numericas) ? bruto.numericas : [];

    return {
      alternativas: Array.from(
        { length: forma.alternativas },
        (_, i) => this.comoAlternativa(alt[i]) ?? 'BLANCO',
      ),
      numericas: Array.from({ length: forma.numericas }, (_, i) => this.comoNumero(num[i])),
    };
  }

  /** Una celda de Excel puede venir como fórmula o como texto enriquecido. */
  private plano(valor: unknown) {
    if (valor && typeof valor === 'object') {
      const o = valor as any;
      return o.result ?? o.text ?? (Array.isArray(o.richText) ? o.richText.map((t: any) => t.text).join('') : valor);
    }
    return valor;
  }

  private comoAlternativa(valor: unknown): Alternativa | null {
    const texto = String(this.plano(valor) ?? '').trim().toUpperCase();
    if (!texto) return null;
    if (texto === 'BLANCO' || texto === 'EN BLANCO' || texto === '-') return 'BLANCO';
    return (ALTERNATIVAS as readonly string[]).includes(texto) ? (texto as Alternativa) : null;
  }

  /** La respuesta numérica se guarda como la escribieron, ya normalizada. */
  private comoNumero(valor: unknown): string {
    const texto = String(this.plano(valor) ?? '')
      .trim()
      .replace(',', '.');
    if (!texto || texto === '-') return '';
    return texto.slice(0, 20);
  }

  /** Dos números son el mismo aunque uno traiga ceros o decimales de más. */
  private mismoNumero(a: string, b: string) {
    if (!a || !b) return false;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-9;
    return a.trim().toUpperCase() === b.trim().toUpperCase();
  }

  private comoHora(valor: unknown): string {
    const bruto = this.plano(valor);

    // Si la casilla quedó con formato de hora, Excel no devuelve «09:47» sino
    // la hora de verdad, en UTC. Y a veces, la fracción del día que hay
    // debajo. Las tres formas dicen lo mismo y las tres se aceptan.
    if (bruto instanceof Date) {
      return (
        String(bruto.getUTCHours()).padStart(2, '0') +
        ':' +
        String(bruto.getUTCMinutes()).padStart(2, '0')
      );
    }
    if (typeof bruto === 'number' && bruto > 0 && bruto < 1) {
      const total = Math.round(bruto * 24 * 60);
      return (
        String(Math.floor(total / 60) % 24).padStart(2, '0') +
        ':' +
        String(total % 60).padStart(2, '0')
      );
    }

    const texto = String(bruto ?? '').trim();
    const m = texto.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return '';
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return '';
    return `${String(h).padStart(2, '0')}:${m[2]}`;
  }

  /** Cuántos minutos tardó desde que empezó su turno. */
  private minutosDesde(inicio: string, entrega: string): number | null {
    if (!entrega) return null;
    const [hi, mi] = inicio.split(':').map(Number);
    const [he, me] = entrega.split(':').map(Number);
    if ([hi, mi, he, me].some((n) => !Number.isFinite(n))) return null;
    return he * 60 + me - (hi * 60 + mi);
  }
}
