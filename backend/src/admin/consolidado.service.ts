import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { GRADOS } from '../common/grados';
import { GRANATE, escribirEncabezados, escribirTitulo } from '../common/excel';

/**
 * A quiénes alcanza el consolidado.
 *
 * APROBADOS es la lista con la que se arma el examen: comprobante aprobado y
 * delegación aprobada. EN_PROCESO suma a los que ya pagaron y esperan
 * revisión, que sirve para estimar aulas antes de terminar de revisar.
 */
export type AlcanceConsolidado = 'APROBADOS' | 'EN_PROCESO';

const ALCANCES: Record<AlcanceConsolidado, string> = {
  APROBADOS: 'Solo inscripciones aprobadas',
  EN_PROCESO: 'Aprobadas y en revisión',
};

const MODALIDADES: Record<string, string> = {
  ESTATAL: 'Institución estatal',
  PARTICULAR: 'Institución particular',
  GRUPO_ESTUDIO: 'Grupo de estudio',
};

/**
 * Consolidado general para el día del examen.
 *
 * Responde dos preguntas distintas con los mismos datos: cuántos rinden cada
 * categoría y en qué institución están —para repartir aulas—, y qué alumnos
 * trae cada delegación con su tutor y su celular —para llamarlo ese día—.
 */
@Injectable()
export class ConsolidadoService {
  constructor(private prisma: PrismaService) {}

  async resumen(alcance: AlcanceConsolidado, categoria?: string) {
    // Con una categoría elegida entran solo sus alumnos, y por lo tanto solo
    // las delegaciones que mandaron a alguien a esa categoría —aunque además
    // hayan inscrito en otras—.
    const soloCategoria = GRADOS.some((g) => g.categoria === categoria) ? categoria : undefined;
    const alumnos = await this.alumnos(alcance, soloCategoria);

    const delegaciones = new Map<string, any>();
    const porCategoria = new Map<string, { alumnos: number; delegaciones: Set<string> }>();

    for (const a of alumnos) {
      const t = a.tutor;

      if (!delegaciones.has(t.id)) {
        delegaciones.set(t.id, {
          tutorId: t.id,
          institucion: t.institucion || 'Sin institución',
          tutor: `${t.nombres} ${t.apellidos}`.trim(),
          celular: t.celular,
          correo: t.correo,
          modalidad: t.modalidad,
          modalidadLabel: MODALIDADES[t.modalidad] || t.modalidad,
          departamento: t.departamento,
          provincia: t.provincia,
          distrito: t.distrito,
          total: 0,
          porCategoria: {} as Record<string, number>,
          alumnos: [] as any[],
        });
      }

      const d = delegaciones.get(t.id);
      d.total += 1;
      d.porCategoria[a.categoria] = (d.porCategoria[a.categoria] || 0) + 1;
      d.alumnos.push({
        id: a.id,
        dni: a.dni,
        nombres: a.nombres,
        categoria: a.categoria,
        grado: a.grado,
      });

      if (!porCategoria.has(a.categoria)) {
        porCategoria.set(a.categoria, { alumnos: 0, delegaciones: new Set() });
      }
      const c = porCategoria.get(a.categoria)!;
      c.alumnos += 1;
      c.delegaciones.add(t.id);
    }

    // Ordenadas por nombre de institución: así el Excel y la pantalla se
    // recorren igual que la lista de asistencia del día del examen.
    const filas = [...delegaciones.values()].sort((a, b) =>
      a.institucion.localeCompare(b.institucion, 'es'),
    );
    for (const d of filas) {
      d.alumnos.sort(
        (x: any, y: any) =>
          x.categoria.localeCompare(y.categoria) || x.nombres.localeCompare(y.nombres, 'es'),
      );
    }

    const categorias = GRADOS.filter((g) => !soloCategoria || g.categoria === soloCategoria).map(
      (g) => {
        const c = porCategoria.get(g.categoria);
        return {
          categoria: g.categoria,
          grado: g.grado,
          label: g.label,
          nivel: g.nivel,
          alumnos: c?.alumnos || 0,
          delegaciones: c?.delegaciones.size || 0,
        };
      },
    );

    const individuales = this.individuales(filas);

    return {
      alcance,
      categoria: soloCategoria || '',
      descripcion: this.descripcion(alcance, soloCategoria),
      totales: {
        alumnos: alumnos.length,
        delegaciones: filas.length,
        individuales: individuales.length,
      },
      categorias,
      delegaciones: filas,
      individuales,
    };
  }

  async excel(alcance: AlcanceConsolidado, categoria?: string): Promise<Buffer> {
    const datos = await this.resumen(alcance, categoria);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';

    this.hojaResumen(libro, datos);
    for (const [i, delegacion] of datos.delegaciones.entries()) {
      this.hojaDelegacion(libro, delegacion, i + 1, datos.descripcion);
    }
    if (datos.individuales.length) this.hojaIndividuales(libro, datos);

    return (await libro.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // --------------------------------------------------------------------

  private async alumnos(alcance: AlcanceConsolidado, categoria?: string) {
    const where: any =
      alcance === 'APROBADOS'
        ? { payment: { estado: 'APROBADO' }, tutor: { estado: 'APROBADA' } }
        : { payment: { estado: { not: 'RECHAZADO' } } };
    if (categoria) where.categoria = categoria;

    return this.prisma.student.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { nombres: 'asc' }],
      include: {
        tutor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            institucion: true,
            celular: true,
            correo: true,
            modalidad: true,
            departamento: true,
            provincia: true,
            distrito: true,
          },
        },
      },
    });
  }

  /**
   * Los que vienen solos: su delegación aporta un único alumno a esa
   * categoría. El día del examen no llenan un aula, así que van juntos en una
   * lista aparte.
   */
  private individuales(delegaciones: any[]) {
    const sueltos: any[] = [];

    for (const d of delegaciones) {
      for (const [categoria, cantidad] of Object.entries(d.porCategoria)) {
        if (cantidad !== 1) continue;
        const alumno = d.alumnos.find((a: any) => a.categoria === categoria);
        if (!alumno) continue;
        sueltos.push({
          categoria,
          label: this.etiquetaCategoria(categoria),
          dni: alumno.dni,
          nombres: alumno.nombres,
          institucion: d.institucion,
          modalidadLabel: d.modalidadLabel,
          tutor: d.tutor,
          celular: d.celular,
        });
      }
    }

    return sueltos.sort(
      (a, b) => a.categoria.localeCompare(b.categoria) || a.nombres.localeCompare(b.nombres, 'es'),
    );
  }

  private descripcion(alcance: AlcanceConsolidado, categoria?: string) {
    const base = ALCANCES[alcance];
    return categoria ? `${this.etiquetaCategoria(categoria)} · ${base}` : base;
  }

  /** Nombre de archivo según lo que se esté bajando. */
  nombreArchivo(categoria?: string) {
    const valida = GRADOS.some((g) => g.categoria === categoria);
    return valida
      ? `consolidado-cat-${String(categoria).toLowerCase()}-omasur-2026.xlsx`
      : 'consolidado-omasur-2026.xlsx';
  }

  private etiquetaCategoria(categoria: string) {
    const g = GRADOS.find((x) => x.categoria === categoria);
    return g ? `CAT. ${g.categoria} · ${g.label}` : `CAT. ${categoria}`;
  }

  // ------------------------------------------------------------- hojas

  /** La foto completa: cuántos por categoría y qué trae cada delegación. */
  private hojaResumen(libro: ExcelJS.Workbook, datos: any) {
    const hoja = libro.addWorksheet('Resumen');
    const cats = datos.categorias.map((c: any) => c.categoria);
    const columnas = [
      { header: 'N°', width: 6 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 38 },
      { header: 'MODALIDAD', width: 22 },
      { header: 'TUTOR', width: 30 },
      { header: 'CELULAR', width: 13 },
      ...cats.map((c) => ({ header: c, width: 6 })),
      { header: 'TOTAL', width: 9 },
    ];

    escribirTitulo(
      hoja,
      columnas.length,
      datos.categoria
        ? `Consolidado de ${this.etiquetaCategoria(datos.categoria)}`
        : 'Consolidado general por delegación',
      datos.descripcion,
      datos.totales.alumnos,
    );

    // Primero el conteo por categoría: es la pregunta que se hace al armar
    // las aulas, antes de mirar delegación por delegación.
    const tituloCat = hoja.addRow(['CATEGORÍAS']);
    tituloCat.font = { bold: true, size: 12, color: { argb: GRANATE } };
    hoja.addRow(['CAT.', 'GRADO', 'NIVEL', 'INSCRITOS', 'DELEGACIONES']).font = { bold: true };
    for (const c of datos.categorias) {
      hoja.addRow([
        `CAT. ${c.categoria}`,
        c.label,
        c.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria',
        c.alumnos,
        c.delegaciones,
      ]);
    }
    hoja.addRow([]);
    hoja.addRow([]);

    const tituloDel = hoja.addRow(['DELEGACIONES']);
    tituloDel.font = { bold: true, size: 12, color: { argb: GRANATE } };

    escribirEncabezados(hoja, columnas);

    datos.delegaciones.forEach((d: any, i: number) => {
      hoja.addRow([
        i + 1,
        d.institucion,
        d.modalidadLabel,
        d.tutor,
        d.celular,
        ...cats.map((c) => d.porCategoria[c] || ''),
        d.total,
      ]);
    });

    const cierre = hoja.addRow([
      '',
      'TOTALES',
      '',
      '',
      '',
      ...cats.map((c) => datos.categorias.find((x: any) => x.categoria === c)?.alumnos || 0),
      datos.totales.alumnos,
    ]);
    cierre.font = { bold: true };
  }

  /** Una hoja por delegación: su cabecera y sus alumnos por categoría. */
  private hojaDelegacion(
    libro: ExcelJS.Workbook,
    d: any,
    numero: number,
    descripcion: string,
  ) {
    const hoja = libro.addWorksheet(this.nombreHoja(libro, numero, d.institucion));

    hoja.columns = [{ width: 8 }, { width: 16 }, { width: 46 }, { width: 24 }] as any;

    const marca = hoja.addRow(['I - OMASUR UNI 2026']);
    marca.font = { bold: true, size: 16, color: { argb: GRANATE } };
    hoja.addRow([descripcion]).font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    hoja.addRow([]);

    for (const [etiqueta, valor] of [
      ['I.E.:', d.institucion],
      ['TUTOR:', d.tutor],
      ['CELULAR:', d.celular],
      ['MODALIDAD:', d.modalidadLabel],
      ['UBICACIÓN:', [d.departamento, d.provincia, d.distrito].filter(Boolean).join(' · ')],
      ['INSCRITOS:', d.total],
    ]) {
      const fila = hoja.addRow([etiqueta, valor]);
      fila.getCell(1).font = { bold: true, color: { argb: 'FF6B7280' } };
      fila.getCell(2).font = { bold: true, size: 12 };
    }

    // Los alumnos, agrupados por categoría: cada grupo rinde en su aula.
    const categorias = [...new Set(d.alumnos.map((a: any) => a.categoria))].sort() as string[];

    for (const categoria of categorias) {
      hoja.addRow([]);
      const suyos = d.alumnos.filter((a: any) => a.categoria === categoria);

      const titulo = hoja.addRow([
        `${this.etiquetaCategoria(categoria)}  —  ${suyos.length} ${
          suyos.length === 1 ? 'inscrito' : 'inscritos'
        }`,
      ]);
      titulo.font = { bold: true, size: 12, color: { argb: GRANATE } };

      const encabezado = hoja.addRow(['N°', 'DNI', 'NOMBRES Y APELLIDOS', '']);
      encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRANATE } };
      encabezado.height = 20;

      suyos.forEach((a: any, i: number) => {
        hoja.addRow([i + 1, a.dni, a.nombres, '']);
      });
    }

    // Y al final, el conteo por categoría: es lo que se firma al entregar la
    // delegación el día del examen, sin tener que volver a contar arriba.
    hoja.addRow([]);
    hoja.addRow([]);

    const titulo = hoja.addRow(['RESUMEN DE LA DELEGACIÓN']);
    titulo.font = { bold: true, size: 12, color: { argb: GRANATE } };

    const encabezado = hoja.addRow(['', 'CATEGORÍA', 'GRADO', 'INSCRITOS']);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRANATE } };
    encabezado.height = 20;

    for (const categoria of categorias) {
      const g = GRADOS.find((x) => x.categoria === categoria);
      hoja.addRow([
        '',
        `CAT. ${categoria}`,
        g ? g.label : '',
        d.alumnos.filter((a: any) => a.categoria === categoria).length,
      ]);
    }

    const total = hoja.addRow(['', 'TOTAL', '', d.total]);
    total.font = { bold: true };
  }

  /** Los que vienen solos, todos juntos y con su institución al costado. */
  private hojaIndividuales(libro: ExcelJS.Workbook, datos: any) {
    const hoja = libro.addWorksheet('Individuales');
    const columnas = [
      { header: 'N°', width: 6 },
      { header: 'CATEGORÍA', width: 24 },
      { header: 'DNI', width: 14 },
      { header: 'NOMBRES Y APELLIDOS', width: 40 },
      { header: 'INSTITUCIÓN EDUCATIVA', width: 36 },
      { header: 'MODALIDAD', width: 22 },
      { header: 'TUTOR', width: 28 },
      { header: 'CELULAR', width: 13 },
    ];

    escribirTitulo(
      hoja,
      columnas.length,
      'Alumnos que vienen solos',
      'Su delegación aporta un único inscrito en esa categoría · ' + datos.descripcion,
      datos.individuales.length,
    );
    escribirEncabezados(hoja, columnas);

    datos.individuales.forEach((a: any, i: number) => {
      hoja.addRow([
        i + 1,
        a.label,
        a.dni,
        a.nombres,
        a.institucion,
        a.modalidadLabel,
        a.tutor,
        a.celular,
      ]);
    });
  }

  /**
   * Nombre de hoja válido para Excel: 31 caracteres, sin `\ / ? * [ ] :` y
   * sin repetirse. Va numerado para que las hojas queden en el mismo orden
   * que la tabla del resumen.
   */
  private nombreHoja(libro: ExcelJS.Workbook, numero: number, institucion: string) {
    const prefijo = String(numero).padStart(2, '0') + ' ';
    const limpio = (institucion || 'Sin institución')
      .replace(/[\\/?*[\]:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let nombre = (prefijo + limpio).slice(0, 31).trim();
    let intento = 2;
    while (libro.getWorksheet(nombre)) {
      const sufijo = ` (${intento++})`;
      nombre = (prefijo + limpio).slice(0, 31 - sufijo.length).trim() + sufijo;
    }
    return nombre;
  }
}
