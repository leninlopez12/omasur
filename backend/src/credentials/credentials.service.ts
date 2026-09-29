import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma/prisma.service';
import { etiquetaGrado } from '../common/grados';

const GRANATE = '#7B1E2B';
const GRANATE_OSCURO = '#5A121C';
const BLANCO = '#FFFFFF';
const GRIS = '#6B7280';

type AlumnoConTutor = {
  dni: string;
  nombres: string;
  categoria: string;
  grado: any;
  tutor: { institucion: string; modalidad: string; region: string; provincia: string };
};

@Injectable()
export class CredentialsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Consulta pública. Solo devuelve los datos del estudiante cuando la comisión
   * ya aprobó la inscripción de su institución; mientras tanto no se expone nada.
   */
  async consultarPorDni(dni: string) {
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

  async credencialPorDni(dni: string): Promise<Buffer> {
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
    return this.construirPdf([alumno as unknown as AlumnoConTutor]);
  }

  /**
   * Las credenciales de la delegación, con los filtros que el tutor tenga
   * puestos en pantalla: así puede bajar solo «secundaria, 2.º grado» y no un
   * PDF de doscientas hojas para recortar tres.
   */
  async credencialesDelTutor(
    tutorId: string,
    filtros: { nivel?: string; grado?: string } = {},
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
    return this.construirPdf(alumnos);
  }

  /** Dos credenciales por página A4, listas para recortar. */
  private construirPdf(alumnos: AlumnoConTutor[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const partes: Buffer[] = [];
      doc.on('data', (d: Buffer) => partes.push(d));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);

      alumnos.forEach((alumno, i) => {
        const posicion = i % 2;
        if (i > 0 && posicion === 0) doc.addPage();
        this.dibujarCredencial(doc, alumno, posicion === 0 ? 40 : 430);
      });

      doc.end();
    });
  }

  private dibujarCredencial(doc: PDFKit.PDFDocument, alumno: AlumnoConTutor, y: number) {
    const x = 50;
    const ancho = 495;
    const alto = 340;

    doc.save();
    doc.roundedRect(x, y, ancho, alto, 16).fill(BLANCO).stroke();
    doc.roundedRect(x, y, ancho, alto, 16).lineWidth(1.5).stroke('#E5E7EB');

    // Cabecera granate
    doc.save();
    doc.roundedRect(x, y, ancho, 86, 16).fill(GRANATE);
    doc.rect(x, y + 60, ancho, 26).fill(GRANATE);
    doc.restore();

    doc.fillColor(BLANCO).font('Helvetica-Bold').fontSize(19);
    doc.text('I - OMASUR UNI 2026', x + 24, y + 22, { width: ancho - 48 });
    doc.font('Helvetica').fontSize(9.5).fillColor('#F3D9DD');
    doc.text('Olimpiada Macrorregional Sur de Matemática', x + 24, y + 48, { width: ancho - 48 });
    doc.text('IES Ingenieritos del Perú "Eduardo de Habich"', x + 24, y + 62, { width: ancho - 48 });

    // El DNI es el identificador del estudiante: no se usa ningún código aparte.
    doc.roundedRect(x + 24, y + 106, 200, 46, 8).fill('#FBEEF0');
    doc.fillColor(GRIS).font('Helvetica').fontSize(8);
    doc.text('DNI DEL ESTUDIANTE', x + 34, y + 114);
    doc.fillColor(GRANATE_OSCURO).font('Helvetica-Bold').fontSize(18);
    doc.text(alumno.dni, x + 34, y + 128);

    // Categoría
    doc.roundedRect(x + 240, y + 106, 100, 46, 8).fill('#FBEEF0');
    doc.fillColor(GRIS).font('Helvetica').fontSize(8);
    doc.text('CATEGORÍA', x + 250, y + 114);
    doc.fillColor(GRANATE_OSCURO).font('Helvetica-Bold').fontSize(18);
    doc.text('CAT. ' + alumno.categoria, x + 250, y + 128);

    this.campo(doc, x + 24, y + 172, 'ESTUDIANTE', alumno.nombres, ancho - 48);
    this.campo(doc, x + 24, y + 214, 'GRADO', etiquetaGrado(alumno.grado as any), ancho - 48);
    this.campo(doc, x + 24, y + 256, 'INSTITUCIÓN EDUCATIVA', alumno.tutor.institucion, ancho - 48);

    doc.moveTo(x + 24, y + alto - 44).lineTo(x + ancho - 24, y + alto - 44).lineWidth(0.8).stroke('#E5E7EB');
    doc.fillColor(GRIS).font('Helvetica').fontSize(8);
    doc.text(
      'Presentar junto con el DNI. Portar lápiz 2B, borrador y tajador.',
      x + 24,
      y + alto - 34,
      { width: ancho - 48 },
    );
    doc.text('Primera etapa: 22 de octubre  ·  Segunda etapa: 08 de noviembre', x + 24, y + alto - 22, {
      width: ancho - 48,
    });

    doc.restore();
  }

  private campo(doc: PDFKit.PDFDocument, x: number, y: number, etiqueta: string, valor: string, ancho: number) {
    doc.fillColor(GRIS).font('Helvetica').fontSize(8);
    doc.text(etiqueta, x, y);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13);
    doc.text(valor, x, y + 12, { width: ancho, ellipsis: true, lineBreak: false });
  }
}
