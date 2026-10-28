import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';
import { etiquetaGrado } from '../common/grados';
import { Etapa, EtapasService } from './etapas.service';
import { StorageService } from '../storage/storage.service';
import { ResultadosService } from '../resultados/resultados.service';

const GRANATE = '#7B1E2B';
const GRANATE_OSCURO = '#5A121C';
const GRANATE_CLARO = '#C98A95';
const CREMA = '#FBEEF0';
const BLANCO = '#FFFFFF';
const GRIS = '#6B7280';

type AlumnoConTutor = {
  dni: string;
  nombres: string;
  categoria: string;
  grado: any;
  tutor: { institucion: string; modalidad: string; region: string; provincia: string };
};

/**
 * Lo que se imprime en una credencial, ya resuelto.
 *
 * El alumno y el tutor usan el mismo molde: cambian los rótulos y los datos,
 * no el diseño. Así las dos credenciales se ven como parte del mismo juego.
 */
interface Impresion {
  dni: string;
  nombre: string;
  /** El recuadro del medio: la categoría del alumno o la condición del tutor. */
  distintivo: string;
  distintivoTitulo: string;
  /** La línea bajo el nombre: el grado del alumno o lo que trae el tutor. */
  detalleTitulo: string;
  detalle: string;
  institucion: string;
  nombreTitulo: string;
}

/** Dónde se guarda si la credencial pública está abierta. */
const CLAVE_PUBLICA = 'credencial_publica';

@Injectable()
export class CredentialsService {
  constructor(
    private prisma: PrismaService,
    private etapas: EtapasService,
    private almacenamiento: StorageService,
    private resultados: ResultadosService,
  ) {}

  /**
   * La credencial pública de la etapa macrorregional.
   *
   * Se abre aparte porque ya no es para todos: pasada la etapa institucional
   * la credencial le toca solo a quien clasificó, y mientras la comisión no
   * la habilite no se entrega ninguna.
   */
  async publica() {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVE_PUBLICA } });
    return { activa: fila?.valor === 'true' };
  }

  async cambiarPublica(activa: boolean) {
    const valor = activa ? 'true' : 'false';
    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE_PUBLICA },
      create: { clave: CLAVE_PUBLICA, valor },
      update: { valor },
    });
    return { activa };
  }

  /** Nadie baja una credencial si no está habilitada o no clasificó. */
  private async comprobarClasificado(dni: string) {
    const { activa } = await this.publica();
    if (!activa) {
      throw new NotFoundException(
        'La descarga de credenciales todavía no está habilitada. Vuelva a intentarlo más tarde.',
      );
    }

    const { resultados } = await this.resultados.calcular();
    const suyos = resultados.filter((r) => r.dni === dni.trim());

    if (suyos.length > 0 && !suyos.some((r) => r.estado === 'CLASIFICA')) {
      throw new ForbiddenException('No clasificaste a la siguiente etapa.');
    }
  }

  /**
   * Consulta pública. Solo devuelve los datos del estudiante cuando la comisión
   * ya aprobó la inscripción de su institución; mientras tanto no se expone nada.
   */
  async consultarPorDni(dni: string) {
    await this.comprobarClasificado(dni);

    const alumno = await this.prisma.student.findUnique({
      where: { dni: dni.trim() },
      include: { tutor: true },
    });
    if (!alumno) throw new NotFoundException('No encontramos un estudiante inscrito con ese DNI');

    if (alumno.tutor.estado !== 'APROBADA') {
      throw new ForbiddenException(
        'La inscripción de su institución todavía no ha sido confirmada. Consulte con su tutor.',
      );
    }

    return {
      nombres: alumno.nombres,
      dni: alumno.dni,
      categoria: alumno.categoria,
      grado: etiquetaGrado(alumno.grado),
      institucion: alumno.tutor.institucion,
      habilitada: true,
    };
  }

  /**
   * La credencial de un estudiante por su DNI.
   *
   * `publica` es la consulta de la portada, que exige que la descarga esté
   * abierta y que el estudiante haya clasificado. La comisión la pide desde su
   * panel para atender a quien llama, y ahí esas dos condiciones no van.
   */
  async credencialPorDni(dni: string, etapa?: string, publica = true): Promise<Buffer> {
    if (publica) await this.comprobarClasificado(dni);

    const alumno = await this.prisma.student.findUnique({
      where: { dni: dni.trim() },
      include: { tutor: true },
    });
    if (!alumno) throw new NotFoundException('No encontramos un estudiante inscrito con ese DNI');
    if (alumno.tutor.estado !== 'APROBADA') {
      throw new ForbiddenException('La inscripción de su institución aún no ha sido aprobada');
    }
    // Que la delegación esté aprobada no alcanza: el alumno agregado después
    // todavía no tiene pago revisado y no le corresponde credencial.
    if (!alumno.paymentId) {
      throw new ForbiddenException('Este estudiante todavía no tiene su inscripción aprobada');
    }
    return this.construirPdf(
      [this.comoAlumno(alumno as unknown as AlumnoConTutor)],
      await this.etapas.paraImprimir(etapa),
    );
  }

  /**
   * Las credenciales de la delegación, con los filtros que el tutor tenga
   * puestos en pantalla: así puede bajar solo «secundaria, 2.º grado» y no un
   * PDF de doscientas hojas para recortar tres.
   */
  async credencialesDelTutor(
    tutorId: string,
    filtros: { nivel?: string; grado?: string; etapa?: string } = {},
  ): Promise<Buffer> {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');
    if (tutor.estado !== 'APROBADA') {
      throw new ForbiddenException('Su inscripción aún no ha sido aprobada por la comisión');
    }

    const where: any = { tutorId, payment: { estado: 'APROBADO' } };
    if (filtros.nivel) where.nivel = filtros.nivel;
    if (filtros.grado) where.grado = filtros.grado;

    const students = await this.prisma.student.findMany({
      where,
      orderBy: [{ grado: 'asc' }, { nombres: 'asc' }],
    });
    if (students.length === 0) {
      throw new NotFoundException('No hay estudiantes aprobados con esos filtros');
    }

    const alumnos = students.map((a) => ({ ...a, tutor })) as unknown as AlumnoConTutor[];
    return this.construirPdf(
      alumnos.map((a) => this.comoAlumno(a)),
      await this.etapas.paraImprimir(filtros.etapa),
    );
  }

  /**
   * La credencial del propio tutor.
   *
   * La necesita para entrar a la sede el día del examen igual que sus
   * alumnos; por eso lleva su institución y cuántos estudiantes trae.
   */
  async credencialDelTutorMismo(tutorId: string, etapa?: string): Promise<Buffer> {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { _count: { select: { students: true } } },
    });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');
    if (tutor.estado !== 'APROBADA') {
      throw new ForbiddenException('Su inscripción aún no ha sido aprobada por la comisión');
    }

    const aprobados = await this.prisma.student.count({
      where: { tutorId, payment: { estado: 'APROBADO' } },
    });

    return this.construirPdf(
      [this.comoTutor(tutor, aprobados)],
      await this.etapas.paraImprimir(etapa),
    );
  }

  /** Las credenciales de varios tutores en un solo PDF, para la comisión. */
  async credencialesDeTutores(tutorIds: string[] | null, etapa?: string): Promise<Buffer> {
    const tutores = await this.prisma.tutor.findMany({
      where: { estado: 'APROBADA', ...(tutorIds?.length ? { id: { in: tutorIds } } : {}) },
      orderBy: { institucion: 'asc' },
    });
    if (tutores.length === 0) {
      throw new NotFoundException('No hay delegaciones aprobadas');
    }

    const conteos = await this.prisma.student.groupBy({
      by: ['tutorId'],
      where: { tutorId: { in: tutores.map((t) => t.id) }, payment: { estado: 'APROBADO' } },
      _count: { _all: true },
    });
    const porTutor = new Map(conteos.map((c) => [c.tutorId, c._count._all]));

    return this.construirPdf(
      tutores.map((t) => this.comoTutor(t, porTutor.get(t.id) || 0)),
      await this.etapas.paraImprimir(etapa),
    );
  }

  /** Las delegaciones aprobadas, para que la comisión baje sus credenciales. */
  async delegacionesAprobadas() {
    const tutores = await this.prisma.tutor.findMany({
      where: { estado: 'APROBADA' },
      orderBy: { institucion: 'asc' },
      select: {
        id: true,
        dni: true,
        nombres: true,
        apellidos: true,
        correo: true,
        celular: true,
        institucion: true,
        modalidad: true,
        departamento: true,
        provincia: true,
        distrito: true,
      },
    });

    const conteos = await this.prisma.student.groupBy({
      by: ['tutorId'],
      where: { tutorId: { in: tutores.map((t) => t.id) }, payment: { estado: 'APROBADO' } },
      _count: { _all: true },
    });
    const porTutor = new Map(conteos.map((c) => [c.tutorId, c._count._all]));

    return tutores.map((t) => ({
      tutorId: t.id,
      institucion: t.institucion || 'Sin institución',
      tutor: `${t.nombres} ${t.apellidos}`.trim(),
      dni: t.dni,
      correo: t.correo,
      celular: t.celular,
      modalidad: t.modalidad,
      departamento: t.departamento,
      provincia: t.provincia,
      distrito: t.distrito,
      alumnosAprobados: porTutor.get(t.id) || 0,
    }));
  }

  /** El tutor, vestido con el molde de la credencial. */
  private comoTutor(tutor: any, alumnos: number): Impresion {
    return {
      dni: tutor.dni || '—',
      nombre: `${tutor.nombres} ${tutor.apellidos}`.trim(),
      nombreTitulo: 'TUTOR RESPONSABLE',
      distintivo: 'TUTOR',
      distintivoTitulo: 'CONDICIÓN',
      detalleTitulo: 'ESTUDIANTES A CARGO',
      detalle: String(alumnos),
      institucion: tutor.institucion || 'Sin institución',
    };
  }

  /** El alumno, con el mismo molde. */
  private comoAlumno(alumno: AlumnoConTutor): Impresion {
    return {
      dni: alumno.dni,
      nombre: alumno.nombres,
      nombreTitulo: 'ESTUDIANTE',
      distintivo: 'CAT. ' + alumno.categoria,
      distintivoTitulo: 'CATEGORÍA',
      detalleTitulo: 'GRADO',
      detalle: etiquetaGrado(alumno.grado as any),
      institucion: alumno.tutor.institucion,
    };
  }

  /**
   * Una credencial de muestra con datos de ejemplo.
   *
   * Permite ver cómo quedó el diseño antes de publicar la etapa, incluso
   * cuando todavía no hay ningún alumno aprobado.
   */
  async muestra(clave: string): Promise<Buffer> {
    const etapa = this.etapas.esClave(clave)
      ? await this.etapas.una(clave)
      : await this.etapas.una('INSTITUCIONAL');

    const ejemplo = {
      dni: '12345678',
      nombres: 'NOMBRE DEL ESTUDIANTE',
      categoria: 'A',
      grado: 'TERCERO_PRIMARIA',
      tutor: {
        institucion: 'INSTITUCIÓN EDUCATIVA DE EJEMPLO',
        modalidad: 'ESTATAL',
        region: 'Puno',
        provincia: 'San Román',
      },
    } as unknown as AlumnoConTutor;

    // Una de alumno y una de tutor: se ven las dos de un vistazo.
    return this.construirPdf(
      [
        this.comoAlumno(ejemplo),
        this.comoTutor(
          { dni: '87654321', nombres: 'NOMBRE DEL', apellidos: 'TUTOR', institucion: ejemplo.tutor.institucion },
          12,
        ),
      ],
      etapa,
    );
  }

  /** Dos credenciales por página A4, listas para recortar. */
  private async construirPdf(fichas: Impresion[], etapa: Etapa): Promise<Buffer> {
    const logo = await this.logo();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const partes: Buffer[] = [];
      doc.on('data', (d: Buffer) => partes.push(d));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);

      fichas.forEach((ficha, i) => {
        const posicion = i % 2;
        if (i > 0 && posicion === 0) doc.addPage();
        this.dibujarCredencial(doc, ficha, etapa, logo, posicion === 0 ? 40 : 440);
      });

      doc.end();
    });
  }

  /**
   * El logo que la comisión subió a Cloudflare, si lo hay.
   *
   * Se lee una vez por documento y no una por credencial: con doscientos
   * alumnos serían doscientas descargas del mismo archivo.
   */
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
      // Sin logo la credencial sale igual: no vale la pena fallar por esto.
      return null;
    }
  }

  /**
   * Una credencial.
   *
   * El marco es doble —una línea granate gruesa por fuera y una fina por
   * dentro— porque es lo que la hace leerse como credencial y no como una
   * ficha cualquiera, y porque marca por dónde recortar.
   *
   * Los campos fluyen de arriba abajo: el que quede vacío no se dibuja, y con
   * él desaparece su título. Dejar el rótulo solo, sin dato debajo, se veía
   * como un error de impresión.
   */
  private dibujarCredencial(
    doc: PDFKit.PDFDocument,
    ficha: Impresion,
    etapa: Etapa,
    logo: Buffer | null,
    y: number,
  ) {
    const x = 50;
    const ancho = 495;
    const alto = 360;

    doc.save();

    doc.roundedRect(x, y, ancho, alto, 14).fill(BLANCO);
    doc.roundedRect(x + 2, y + 2, ancho - 4, alto - 4, 12).lineWidth(3).stroke(GRANATE);
    doc.roundedRect(x + 9, y + 9, ancho - 18, alto - 18, 8).lineWidth(0.8).stroke(GRANATE_CLARO);

    const bx = x + 9;
    const banda = ancho - 18;

    doc.save();
    doc.roundedRect(bx, y + 9, banda, 80, 8).fill(GRANATE);
    doc.rect(bx, y + 55, banda, 34).fill(GRANATE);
    doc.restore();

    // Con logo, los textos de la cabecera dejan su sitio a la derecha.
    const ladoLogo = 56;
    const margenTexto = logo ? ladoLogo + 26 : 16;

    if (logo) {
      try {
        doc.image(logo, bx + banda - ladoLogo - 14, y + 20, {
          fit: [ladoLogo, ladoLogo],
          align: 'center',
          valign: 'center',
        });
      } catch {
        // Una imagen que PDFKit no sepa leer no puede tumbar la credencial.
      }
    }

    const anchoTexto = banda - margenTexto * 2;
    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(17);
    doc.text(etapa.titulo, bx + margenTexto, y + 23, { width: anchoTexto, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor('#F3D9DD');
    if (etapa.subtitulo) {
      doc.text(etapa.subtitulo, bx + margenTexto, y + 45, { width: anchoTexto, align: 'center' });
    }
    if (etapa.organizador) {
      doc.text(etapa.organizador, bx + margenTexto, y + 58, {
        width: anchoTexto,
        align: 'center',
      });
    }

    if (etapa.etiqueta) {
      const anchoEtapa = 206;
      const xEtapa = x + (ancho - anchoEtapa) / 2;
      doc.roundedRect(xEtapa, y + 78, anchoEtapa, 22, 11).fill(BLANCO);
      doc.roundedRect(xEtapa, y + 78, anchoEtapa, 22, 11).lineWidth(1.2).stroke(GRANATE);
      doc.fillColor(GRANATE_OSCURO).font('Helvetica-Bold').fontSize(9);
      doc.text(etapa.etiqueta, xEtapa, y + 85, { width: anchoEtapa, align: 'center' });
    }

    // Los recuadros de arriba. El DNI y la categoría son del estudiante y
    // siempre están; la fecha la pone la comisión y puede faltar.
    const cajas: { titulo: string; valor: string; tamano: number }[] = [
      { titulo: 'DNI', valor: ficha.dni, tamano: 17 },
      { titulo: ficha.distintivoTitulo, valor: ficha.distintivo, tamano: 17 },
    ];
    if (etapa.fecha) cajas.push({ titulo: 'FECHA', valor: etapa.fecha, tamano: 9 });

    const anchos = cajas.length === 3 ? [196, 96, 127] : [238, 205];
    let cx = x + 26;
    cajas.forEach((caja, i) => {
      doc.roundedRect(cx, y + 112, anchos[i], 44, 8).fill(CREMA);
      doc.fillColor(GRIS).font('Helvetica').fontSize(7.5);
      doc.text(caja.titulo, cx + 10, y + 120);
      doc.fillColor(GRANATE_OSCURO).font('Helvetica-Bold').fontSize(caja.tamano);
      doc.text(caja.valor, cx + 10, y + (caja.tamano > 12 ? 133 : 135), {
        width: anchos[i] - 18,
        ellipsis: true,
        lineBreak: false,
      });
      cx += anchos[i] + 12;
    });

    // De aquí para abajo el cursor solo avanza cuando algo se dibuja.
    let cursor = y + 168;
    const salto = 38;

    cursor = this.campo(doc, x + 26, cursor, ficha.nombreTitulo, ficha.nombre, ancho - 52, salto);

    if (etapa.hora) {
      this.campo(doc, x + 26, cursor, ficha.detalleTitulo, ficha.detalle, 210, 0);
      cursor = this.campo(doc, x + 254, cursor, 'HORA DE INGRESO', etapa.hora, 215, salto);
    } else {
      cursor = this.campo(
        doc,
        x + 26,
        cursor,
        ficha.detalleTitulo,
        ficha.detalle,
        ancho - 52,
        salto,
      );
    }

    cursor = this.campo(
      doc,
      x + 26,
      cursor,
      'INSTITUCIÓN EDUCATIVA',
      ficha.institucion,
      ancho - 52,
      salto,
    );
    cursor = this.campo(doc, x + 26, cursor, 'LUGAR', etapa.lugar, ancho - 52, salto);

    // El pie solo si hay algo que escribir: si no, ni la línea.
    if (etapa.indicaciones || etapa.pie) {
      doc
        .moveTo(x + 26, y + 316)
        .lineTo(x + ancho - 26, y + 316)
        .lineWidth(0.8)
        .stroke(GRANATE_CLARO);

      if (etapa.indicaciones) {
        doc.fillColor(GRIS).font('Helvetica').fontSize(7.5);
        doc.text(etapa.indicaciones, x + 26, y + 323, { width: ancho - 52 });
      }
      if (etapa.pie) {
        doc.fillColor(GRIS).font('Helvetica-Oblique').fontSize(7);
        doc.text(etapa.pie, x + 26, y + 344, { width: ancho - 52 });
      }
    }

    doc.restore();
  }

  /**
   * Un rótulo con su dato. Sin dato no se dibuja nada —ni el rótulo— y el
   * cursor no avanza, así que el siguiente campo ocupa su lugar.
   */
  private campo(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    etiqueta: string,
    valor: string,
    ancho: number,
    salto: number,
  ) {
    if (!valor?.trim()) return y;

    doc.fillColor(GRIS).font('Helvetica').fontSize(7.5);
    doc.text(etiqueta, x, y);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12.5);
    doc.text(valor, x, y + 11, { width: ancho, ellipsis: true, lineBreak: false });

    return y + salto;
  }
}
