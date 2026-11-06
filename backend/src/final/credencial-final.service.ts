import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';
import { FinalService, NivelFinal } from './final.service';
import { EtapasService } from '../credentials/etapas.service';
import { StorageService } from '../storage/storage.service';
import { GRADOS } from '../common/grados';

const GRANATE = '#7B1E2B';
const GRANATE_OSCURO = '#5A121C';
const CARBON = '#2B2F38';
const BLANCO = '#FFFFFF';
const GRIS = '#6B7280';
const CREMA = '#FBEEF0';

/** Donde se guarda si los finalistas ya pueden bajar su credencial. */
const CLAVE_ABIERTA = 'credencial_final_abierta';

/** 9 cm × 6 cm, en puntos: es el tamaño de tarjeta que pidieron. */
const CM = 28.3465;
export const ANCHO = 9 * CM;
export const ALTO = 6 * CM;

const NIVEL_TEXTO: Record<NivelFinal, string> = {
  SECUNDARIA: 'Secundaria',
  PRIMARIA: 'Primaria',
};

export interface Finalista {
  dni: string;
  nombres: string;
  institucion: string;
  tutorId: string;
  categoria: string;
  grado: string;
  nivel: NivelFinal;
  salon: number;
  /** Qué número hace en la lista de su salón: por ahí lo busca el supervisor. */
  puesto: number;
  hora: string;
}

/**
 * La credencial de la final macrorregional.
 *
 * No es la misma que la institucional y por eso no comparte molde. Aquella
 * acreditaba a toda la delegación; esta es solo de quien clasificó, y lleva lo
 * único que hace falta el día del examen: a qué hora entra, a qué aula y qué
 * número hace en la lista de esa aula, que es por donde el responsable lo
 * busca en la puerta.
 *
 * Sin foto y en tarjeta de 9 × 6, que es lo que entra en un portagafete.
 *
 * Sin tabla nueva: los datos salen del reparto de salones y el interruptor es
 * una fila de `Ajuste`.
 */
@Injectable()
export class CredencialFinalService {
  constructor(
    private prisma: PrismaService,
    private final: FinalService,
    private etapas: EtapasService,
    private almacenamiento: StorageService,
  ) {}

  // ------------------------------------------------------------- el interruptor

  async estado() {
    const [fila, { salones, resumen, config }] = await Promise.all([
      this.prisma.ajuste.findUnique({ where: { clave: CLAVE_ABIERTA } }),
      this.final.estado(),
    ]);

    return {
      abierta: fila?.valor === 'true',
      sede: config.sede,
      fecha: config.fecha,
      bloques: config.bloques,
      finalistas: resumen.repartidos,
      salones: salones.length,
      sinSalon: resumen.sinSalon.length,
    };
  }

  async abrir(abierta: boolean) {
    const valor = abierta ? 'true' : 'false';
    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE_ABIERTA },
      create: { clave: CLAVE_ABIERTA, valor },
      update: { valor },
    });
    return this.estado();
  }

  private async comprobarAbierta() {
    const { abierta } = await this.estado();
    if (!abierta) {
      throw new NotFoundException(
        'Las credenciales de la final todavía no están habilitadas. Vuelva a intentarlo más tarde.',
      );
    }
  }

  // ------------------------------------------------------------- los finalistas

  /**
   * Todos los que tienen asiento, con su aula y su número de lista.
   *
   * La fuente es el reparto de salones y no los clasificados: quien todavía no
   * está sentado no puede llevar una credencial que diga a qué aula entrar.
   */
  async finalistas(): Promise<Finalista[]> {
    const { salones, config } = await this.final.estado();
    const lista: Finalista[] = [];

    for (const salon of salones) {
      const bloque = config.bloques[salon.nivel];
      salon.alumnos.forEach((a, i) => {
        lista.push({
          dni: a.dni,
          nombres: a.nombres,
          institucion: a.institucion,
          tutorId: a.tutorId,
          // Del alumno y no del salón: un aula puede llevar varias categorías.
          categoria: a.categoria,
          grado: a.grado,
          nivel: salon.nivel,
          salon: salon.numero,
          puesto: i + 1,
          hora: `${bloque.inicio} a ${bloque.fin}`,
        });
      });
    }

    return lista;
  }

  /** Lo que devuelve la consulta pública por DNI, antes de bajar el PDF. */
  async consultar(dni: string) {
    await this.comprobarAbierta();

    const limpio = String(dni || '').trim();
    if (!/^\d{6,12}$/.test(limpio)) {
      throw new BadRequestException('Escriba el DNI del estudiante, solo números');
    }

    const suyo = (await this.finalistas()).find((f) => f.dni === limpio);
    if (!suyo) {
      throw new NotFoundException(
        'Ese DNI no figura entre los finalistas. Solo clasificaron algunos de cada categoría.',
      );
    }

    const { sede, fecha } = await this.estado();
    return { ...suyo, nivelTexto: NIVEL_TEXTO[suyo.nivel], sede, fecha };
  }

  async pdfPorDni(dni: string): Promise<Buffer> {
    await this.comprobarAbierta();

    const suyo = (await this.finalistas()).find((f) => f.dni === String(dni).trim());
    if (!suyo) throw new NotFoundException('Ese DNI no figura entre los finalistas');

    return this.construir([suyo]);
  }

  /**
   * Los finalistas de una delegación, en un solo PDF.
   *
   * Es lo que baja el tutor desde su cuenta: no tiene que pedir uno por uno ni
   * saber quién clasificó, le salen los suyos y nada más.
   */
  async pdfDeTutor(tutorId: string, publica = true): Promise<Buffer> {
    if (publica) await this.comprobarAbierta();

    const suyos = (await this.finalistas()).filter((f) => f.tutorId === tutorId);
    if (suyos.length === 0) {
      throw new NotFoundException('Su delegación no tiene finalistas con aula asignada todavía');
    }

    return this.construir(suyos);
  }

  /** Todas, o las de un salón: lo que imprime la comisión. */
  async pdfComision(filtros: { salon?: number; nivel?: string } = {}): Promise<Buffer> {
    let lista = await this.finalistas();

    if (filtros.nivel) lista = lista.filter((f) => f.nivel === filtros.nivel);
    if (filtros.salon) lista = lista.filter((f) => f.salon === Number(filtros.salon));

    if (lista.length === 0) {
      throw new NotFoundException('No hay finalistas con esos filtros');
    }
    return this.construir(lista);
  }

  /** Una de muestra, para ver el diseño antes de abrirlo a nadie. */
  async muestra(): Promise<Buffer> {
    const { config } = await this.final.estado();
    const bloque = config.bloques.PRIMARIA;

    return this.construir([
      {
        dni: '12345678',
        nombres: 'NOMBRE DEL ESTUDIANTE FINALISTA',
        institucion: 'INSTITUCIÓN EDUCATIVA DE EJEMPLO',
        tutorId: '',
        categoria: 'A',
        grado: GRADOS[0].label,
        nivel: 'PRIMARIA',
        salon: config.primerSalon,
        puesto: 7,
        hora: `${bloque.inicio} a ${bloque.fin}`,
      },
    ]);
  }

  // ---------------------------------------------------------------------- el PDF

  /**
   * Ocho tarjetas por hoja A4, en dos columnas.
   *
   * A 9 × 6 entran dos al ancho y cuatro al alto con margen de sobra para la
   * guillotina. Se dibuja un hilo de corte alrededor de cada una porque se
   * recortan a mano, de a cientos.
   */
  private async construir(lista: Finalista[]): Promise<Buffer> {
    const [etapa, logo] = await Promise.all([this.etapas.una('MACRORREGIONAL'), this.logo()]);
    const { sede, fecha } = await this.estado();

    const columnas = 2;
    const filas = 4;
    const huecoX = 25;
    const huecoY = 18;
    const margenX = (595.28 - (columnas * ANCHO + (columnas - 1) * huecoX)) / 2;
    const margenY = (841.89 - (filas * ALTO + (filas - 1) * huecoY)) / 2;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const partes: Buffer[] = [];
      doc.on('data', (d: Buffer) => partes.push(d));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);

      lista.forEach((f, i) => {
        const enHoja = i % (columnas * filas);
        if (i > 0 && enHoja === 0) doc.addPage();

        const col = enHoja % columnas;
        const fila = Math.floor(enHoja / columnas);
        this.dibujar(
          doc,
          f,
          { etapa, logo, sede, fecha },
          margenX + col * (ANCHO + huecoX),
          margenY + fila * (ALTO + huecoY),
        );
      });

      doc.end();
    });
  }

  private async logo(): Promise<Buffer | null> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: 'credencial_logo' } });
    if (!fila?.valor) return null;

    try {
      const archivo = await this.almacenamiento.leer(fila.valor);
      if (!archivo) return null;
      const trozos: Buffer[] = [];
      for await (const trozo of archivo.cuerpo) trozos.push(trozo as Buffer);
      return Buffer.concat(trozos);
    } catch {
      // Sin logo la credencial sale igual.
      return null;
    }
  }

  /**
   * Una tarjeta.
   *
   * El bloque granate de arriba a la izquierda y la barra de abajo son los que
   * la hacen reconocible de lejos; en el medio, a la izquierda va el aula —que
   * es el dato que se mira en la puerta— y a la derecha los datos en dos
   * columnas, rótulo y valor, separados por dos puntos.
   */
  private dibujar(
    doc: PDFKit.PDFDocument,
    f: Finalista,
    marco: { etapa: any; logo: Buffer | null; sede: string; fecha: string },
    x: number,
    y: number,
  ) {
    const r = 10;
    doc.save();

    // Hilo de corte y fondo.
    doc.roundedRect(x - 2, y - 2, ANCHO + 4, ALTO + 4, r + 2).lineWidth(0.4).dash(2, { space: 2 }).stroke('#D4D4D8');
    doc.undash();
    doc.roundedRect(x, y, ANCHO, ALTO, r).fill(BLANCO);

    // Recorta todo lo que venga al contorno de la tarjeta.
    doc.save();
    doc.roundedRect(x, y, ANCHO, ALTO, r).clip();

    // La banda de arriba y la de abajo, con el mismo juego de dos colores que
    // el modelo: el color de la casa manda y una franja oscura lo cierra.
    const altoBanda = 42;
    doc.rect(x, y, ANCHO, altoBanda).fill(GRANATE);
    doc.rect(x, y + altoBanda, ANCHO, 5).fill(CARBON);
    doc.rect(x, y + ALTO - 9, ANCHO, 9).fill(CARBON);
    doc.rect(x, y + ALTO - 9, ANCHO * 0.32, 9).fill(GRANATE);

    // Cabecera: a la izquierda el logo y el nombre corto, a la derecha el
    // título de la olimpiada con su sede.
    let xTexto = x + 12;
    if (marco.logo) {
      try {
        doc.image(marco.logo, x + 10, y + 7, { fit: [28, 28], align: 'center', valign: 'center' });
        xTexto = x + 44;
      } catch {
        /* una imagen ilegible no puede tumbar la credencial */
      }
    }

    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(9);
    doc.text('OMASUR', xTexto, y + 10, { width: ANCHO * 0.42 - (xTexto - x) - 6, lineGap: -1 });
    doc.fontSize(8).text('UNI 2026', xTexto, y + 21, { width: ANCHO * 0.42 - (xTexto - x) - 6 });

    // A la derecha, la etapa y debajo cuándo y dónde, una línea cada uno: en
    // 42 puntos de banda no entra nada que se envuelva.
    const xDer = x + ANCHO * 0.46;
    const anchoDer = ANCHO - (xDer - x) - 11;
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(9.5);
    doc.text('FINAL MACRORREGIONAL', xDer, y + 8, { width: anchoDer, align: 'right' });

    doc.font('Helvetica').fontSize(6.5).fillColor('#F3D9DD');
    doc.text(marco.fecha || marco.etapa.fecha || '', xDer, y + 20, {
      width: anchoDer,
      align: 'right',
      height: 9,
      ellipsis: true,
    });
    doc.fontSize(6).text(marco.sede || marco.etapa.lugar || '', xDer, y + 29, {
      width: anchoDer,
      align: 'right',
      height: 9,
      ellipsis: true,
    });

    // El aula, que es lo que se mira en la puerta.
    const cajaX = x + 11;
    const cajaY = y + altoBanda + 13;
    const cajaAncho = 68;
    const cajaAlto = ALTO - altoBanda - 13 - 19;

    doc.roundedRect(cajaX, cajaY, cajaAncho, cajaAlto, 8).fill(CREMA);
    doc.roundedRect(cajaX, cajaY, cajaAncho, cajaAlto, 8).lineWidth(1).stroke(GRANATE);

    doc.fillColor(GRANATE).font('Helvetica-Bold').fontSize(6.5);
    doc.text('AULA', cajaX, cajaY + 9, { width: cajaAncho, align: 'center' });
    doc.fillColor(GRANATE_OSCURO).fontSize(26);
    doc.text(String(f.salon), cajaX, cajaY + 19, { width: cajaAncho, align: 'center' });

    doc.fillColor(GRANATE).font('Helvetica-Bold').fontSize(6.5);
    doc.text('N° EN LA LISTA', cajaX, cajaY + 52, { width: cajaAncho, align: 'center' });
    doc.fillColor(GRANATE_OSCURO).fontSize(17);
    doc.text(String(f.puesto), cajaX, cajaY + 61, { width: cajaAncho, align: 'center' });

    doc.roundedRect(cajaX + 8, cajaY + cajaAlto - 20, cajaAncho - 16, 14, 7).fill(GRANATE);
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(7.5);
    doc.text('CAT. ' + f.categoria, cajaX + 8, cajaY + cajaAlto - 16, {
      width: cajaAncho - 16,
      align: 'center',
    });

    // Los datos, en dos columnas con los dos puntos alineados, como el modelo.
    const dx = cajaX + cajaAncho + 11;
    const anchoRotulo = 32;
    const xValor = dx + anchoRotulo + 7;
    const anchoValor = x + ANCHO - 11 - xValor;

    // El nombre va primero y manda: se encoge hasta entrar en dos líneas, que
    // es lo que separa una credencial legible de una con el apellido cortado.
    let tamanoNombre = 9;
    doc.font('Helvetica-Bold');
    while (tamanoNombre > 6.2) {
      doc.fontSize(tamanoNombre);
      if (doc.heightOfString(f.nombres, { width: anchoValor, lineGap: -1 }) <= tamanoNombre * 2.3) {
        break;
      }
      tamanoNombre -= 0.4;
    }

    let dy = cajaY + 1;
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS);
    doc.text('Nombre', dx, dy, { width: anchoRotulo });
    doc.text(':', dx + anchoRotulo, dy, { width: 6 });
    doc.font('Helvetica-Bold').fontSize(tamanoNombre).fillColor(GRANATE_OSCURO);
    doc.text(f.nombres, xValor, dy - 0.5, { width: anchoValor, lineGap: -1 });
    dy += Math.max(12, doc.y - (cajaY + 1) + 1.5);

    const datos: [string, string][] = [
      ['DNI', f.dni],
      ['Grado', f.grado],
      ['Nivel', NIVEL_TEXTO[f.nivel]],
      ['Hora', f.hora],
      ['I.E.', f.institucion || '—'],
    ];

    for (const [rotulo, valor] of datos) {
      doc.font('Helvetica').fontSize(7.5).fillColor(GRIS);
      doc.text(rotulo, dx, dy, { width: anchoRotulo });
      doc.text(':', dx + anchoRotulo, dy, { width: 6 });

      // El nombre de la institución es largo casi siempre, y cortarlo deja la
      // credencial sin decir de dónde viene: a esa fila se le dan dos líneas.
      const dosLineas = rotulo === 'I.E.';
      doc.font('Helvetica-Bold').fontSize(dosLineas ? 6.8 : 7.5).fillColor(CARBON);
      doc.text(valor, xValor, dy + (dosLineas ? 0.6 : 0), {
        width: anchoValor,
        height: dosLineas ? 17 : 11,
        lineGap: -1.5,
        ellipsis: true,
      });
      dy += 11.5;
    }

    doc.font('Helvetica').fontSize(5.8).fillColor(GRIS);
    doc.text(
      marco.etapa.pie || 'Esta credencial es personal e intransferible. Preséntela con su DNI.',
      dx,
      y + ALTO - 22,
      { width: x + ANCHO - 12 - dx },
    );

    doc.restore();
    doc.restore();
  }
}
