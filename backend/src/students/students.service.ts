import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Modalidad, NivelInstitucion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GRADOS, GradoInfo, etiquetaGrado, resolverGrado } from '../common/grados';
import { gradosPermitidos, minimosDe } from '../common/reglas';
import { CrearAlumnoDto } from './dto';

export interface ResultadoImportacion {
  creados: number;
  errores: { fila: number; dni: string; motivo: string }[];
}

const GRANATE = 'FF7B1E2B';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  listar(tutorId: string) {
    return this.prisma.student.findMany({
      where: { tutorId },
      orderBy: [{ grado: 'asc' }, { nombres: 'asc' }],
    });
  }

  async crear(tutorId: string, dto: CrearAlumnoDto) {
    const info = resolverGrado(dto.grado);
    if (!info) throw new BadRequestException('Grado no reconocido: ' + dto.grado);
    await this.comprobarNivel(tutorId, info);

    const dni = dto.dni.trim();
    const duplicado = await this.prisma.student.findUnique({ where: { dni } });
    if (duplicado) throw new BadRequestException('El DNI ' + dni + ' ya está inscrito');

    return this.prisma.student.create({
      data: {
        dni,
        nombres: this.limpiarNombre(dto.nombres),
        grado: info.grado,
        nivel: info.nivel,
        categoria: info.categoria,
        tutorId,
      },
    });
  }

  async actualizar(tutorId: string, id: string, nombres: string, grado: string) {
    const alumno = await this.prisma.student.findFirst({ where: { id, tutorId } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');

    const info = resolverGrado(grado);
    if (!info) throw new BadRequestException('Grado no reconocido: ' + grado);
    await this.comprobarNivel(tutorId, info);

    return this.prisma.student.update({
      where: { id },
      data: {
        nombres: this.limpiarNombre(nombres),
        grado: info.grado,
        nivel: info.nivel,
        categoria: info.categoria,
      },
    });
  }

  async eliminar(tutorId: string, id: string) {
    const alumno = await this.prisma.student.findFirst({ where: { id, tutorId } });
    if (!alumno) throw new NotFoundException('Alumno no encontrado');
    await this.prisma.student.delete({ where: { id } });
    return { ok: true };
  }

  /** Registro masivo: valida fila por fila y reporta cada rechazo. */
  async importarExcel(tutorId: string, archivo: Express.Multer.File): Promise<ResultadoImportacion> {
    if (!archivo) throw new BadRequestException('Debe adjuntar el archivo Excel');

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(archivo.buffer as any);
    const hoja = libro.worksheets[0];
    if (!hoja) throw new BadRequestException('El archivo no contiene ninguna hoja');

    const errores: ResultadoImportacion['errores'] = [];
    const pendientes: { dni: string; nombres: string; grado: string; fila: number }[] = [];
    const vistos = new Set<string>();

    hoja.eachRow((fila, numero) => {
      if (numero === 1) return; // encabezados
      const dni = this.textoCelda(fila.getCell(1));
      const nombres = this.textoCelda(fila.getCell(2));
      const grado = this.textoCelda(fila.getCell(3));
      if (!dni && !nombres && !grado) return;

      if (!/^\d{8}$/.test(dni)) {
        errores.push({ fila: numero, dni, motivo: 'DNI inválido, deben ser 8 dígitos' });
        return;
      }
      if (!nombres) {
        errores.push({ fila: numero, dni, motivo: 'Falta el nombre del estudiante' });
        return;
      }
      if (!resolverGrado(grado)) {
        errores.push({ fila: numero, dni, motivo: 'Grado no reconocido: ' + grado });
        return;
      }
      if (vistos.has(dni)) {
        errores.push({ fila: numero, dni, motivo: 'DNI repetido dentro del archivo' });
        return;
      }
      vistos.add(dni);
      pendientes.push({ dni, nombres, grado, fila: numero });
    });

    let creados = 0;
    for (const p of pendientes) {
      try {
        await this.crear(tutorId, { dni: p.dni, nombres: p.nombres, grado: p.grado });
        creados++;
      } catch (e: any) {
        errores.push({ fila: p.fila, dni: p.dni, motivo: e?.message || 'No se pudo registrar' });
      }
    }

    return { creados, errores };
  }

  /**
   * Una institución de primaria no puede cargar alumnos de secundaria ni al
   * revés. Se comprueba aquí porque por esta misma puerta entra el Excel.
   */
  private async comprobarNivel(tutorId: string, info: GradoInfo) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      select: { nivelInstitucion: true },
    });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    const permitidos = gradosPermitidos(tutor.nivelInstitucion);
    if (!permitidos.some((g) => g.grado === info.grado)) {
      throw new BadRequestException(
        `Su institución está inscrita solo en ${tutor.nivelInstitucion === 'PRIMARIA' ? 'primaria' : 'secundaria'}, ` +
          `así que no puede registrar alumnos de ${info.label}.`,
      );
    }
  }

  /** Plantilla oficial con lista desplegable de grados. */
  async plantilla(tutorId?: string): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet('Estudiantes');

    hoja.columns = [
      { header: 'DNI', key: 'dni', width: 16 },
      { header: 'NOMBRES Y APELLIDOS', key: 'nombres', width: 46 },
      { header: 'GRADO', key: 'grado', width: 24 },
    ];
    this.pintarEncabezado(hoja);

    // La plantilla sale a la medida de quien la baja: los grados de su nivel
    // y los mínimos de su modalidad. Un grupo de estudio no tiene mínimo por
    // grado, y con la plantilla genérica se le pedía uno que no le corresponde.
    const delegacion = tutorId ? await this.reglasDe(tutorId) : null;
    const grados = delegacion ? gradosPermitidos(delegacion.nivelInstitucion) : GRADOS;
    const opciones = '"' + grados.map((g) => g.label).join(',') + '"';
    for (let i = 2; i <= 300; i++) {
      hoja.getCell('A' + i).numFmt = '@';
      hoja.getCell('C' + i).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [opciones],
        showErrorMessage: true,
        errorTitle: 'Grado inválido',
        error: 'Seleccione un grado de la lista.',
      };
    }

    const ayuda = libro.addWorksheet('Instrucciones');
    ayuda.columns = [{ width: 90 }];
    const lineas = [
      'PLANTILLA DE INSCRIPCIÓN - I OMASUR UNI 2026',
      '',
      '1. Complete una fila por estudiante en la hoja "Estudiantes".',
      '2. El DNI debe tener 8 dígitos, sin espacios ni puntos.',
      '3. El grado se elige de la lista desplegable de la columna GRADO.',
      '4. No modifique ni elimine la fila de encabezados.',
      '5. Guarde el archivo y súbalo en el paso "Registrar estudiantes".',
      ...(delegacion ? ['', ...this.lineasDeReglas(delegacion)] : []),
      '',
      'Categorías disponibles para usted:',
      ...grados.map((g) => '   CAT. ' + g.categoria + ' - ' + g.label),
    ];
    lineas.forEach((texto, i) => {
      const celda = ayuda.getCell('A' + (i + 1));
      celda.value = texto;
      if (i === 0) celda.font = { bold: true, size: 14, color: { argb: GRANATE } };
    });

    return (await libro.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /** Exporta la delegación ya registrada, con el código de cada credencial. */
  async exportarDelegacion(tutorId: string): Promise<Buffer> {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { students: { orderBy: [{ grado: 'asc' }, { nombres: 'asc' }] } },
    });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Delegacion');
    hoja.columns = [
      { header: 'DNI', key: 'dni', width: 14 },
      { header: 'NOMBRES', key: 'nombres', width: 42 },
      { header: 'GRADO', key: 'grado', width: 22 },
      { header: 'CATEGORÍA', key: 'categoria', width: 12 },
    ];
    this.pintarEncabezado(hoja);

    tutor.students.forEach((a) =>
      hoja.addRow({
        dni: a.dni,
        nombres: a.nombres,
        grado: etiquetaGrado(a.grado),
        categoria: a.categoria,
      }),
    );

    return (await libro.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private pintarEncabezado(hoja: ExcelJS.Worksheet) {
    const fila = hoja.getRow(1);
    fila.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRANATE } };
    fila.alignment = { vertical: 'middle', horizontal: 'center' };
    fila.height = 24;
  }

  private limpiarNombre(nombres: string) {
    return nombres.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private textoCelda(celda: ExcelJS.Cell): string {
    const valor = celda?.value as any;
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'object' && 'result' in valor) return String(valor.result ?? '').trim();
    if (typeof valor === 'object' && 'text' in valor) return String(valor.text ?? '').trim();
    return String(valor).trim();
  }

  private async reglasDe(tutorId: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      select: { modalidad: true, nivelInstitucion: true },
    });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');
    return tutor;
  }

  /** Las reglas de esta delegación, escritas en la hoja de instrucciones. */
  private lineasDeReglas({
    modalidad,
    nivelInstitucion,
  }: {
    modalidad: Modalidad;
    nivelInstitucion: NivelInstitucion;
  }) {
    const nombre: Record<Modalidad, string> = {
      ESTATAL: 'Institución estatal',
      PARTICULAR: 'Institución particular',
      GRUPO_ESTUDIO: 'Grupo de estudio',
    };
    const niveles: Record<NivelInstitucion, string> = {
      PRIMARIA: 'Solo primaria',
      SECUNDARIA: 'Solo secundaria',
      AMBOS: 'Primaria y secundaria',
    };
    const minimos = minimosDe(modalidad, nivelInstitucion);

    return [
      'SUS REQUISITOS:',
      `   Modalidad: ${nombre[modalidad]}`,
      `   Nivel: ${niveles[nivelInstitucion]}`,
      `   Mínimo de estudiantes en total: ${minimos.total}`,
      minimos.porGrado > 0
        ? `   Mínimo por grado que use: ${minimos.porGrado}`
        : '   Sin mínimo por grado: reparta los estudiantes como prefiera.',
    ];
  }
}
