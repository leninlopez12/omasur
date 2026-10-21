import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { GRADOS, etiquetaGrado } from '../common/grados';
import { minimosDe, validarDelegacion } from '../common/reglas';
import { escribirEncabezados, escribirTitulo, nombreArchivo } from '../common/excel';

export interface FiltrosReporte {
  tipo?: 'estudiantes' | 'delegaciones';
  estado?: string;
  pago?: string;
  situacion?: string;
  modalidad?: string;
  nivelInstitucion?: string;
  nivel?: string;
  grado?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  desde?: string;
  hasta?: string;
  buscar?: string;
}

const ESTADOS: Record<string, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_PAGO: 'Pago adjuntado',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  OBSERVADA: 'Observada',
};

const MODALIDADES: Record<string, string> = {
  ESTATAL: 'Institución estatal',
  PARTICULAR: 'Institución particular',
  GRUPO_ESTUDIO: 'Grupo de estudio',
};

const SITUACIONES: Record<string, string> = {
  INCOMPLETAS: 'No llegan al mínimo de estudiantes',
  UNO_SOLO: 'Registraron un solo estudiante',
  SIN_ESTUDIANTES: 'Sin ningún estudiante',
  COMPLETAS: 'Cumplen los mínimos',
  SIN_DATOS: 'Datos de institución incompletos',
};

/** En la cabecera del Excel el filtro se lee en palabras, no en el enum. */
const NIVELES: Record<string, string> = {
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
};

const NIVELES_INSTITUCION: Record<string, string> = {
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  AMBOS: 'Primaria y secundaria',
};

const PAGOS: Record<string, string> = {
  PAGADO: 'Con comprobante enviado',
  SIN_PAGAR: 'Sin comprobante',
  APROBADO: 'Con comprobante aprobado',
};

/**
 * Reportes del panel. Un solo armador con filtros en vez de una lista fija de
 * descargas: las combinaciones que la comisión va a necesitar no se pueden
 * adivinar de antemano.
 */
@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  /** Las opciones que ofrece la pantalla, con los valores que hay en la base. */
  async opciones() {
    const tutores = await this.prisma.tutor.findMany({
      select: { departamento: true, provincia: true, distrito: true },
    });

    const unicos = (campo: 'departamento' | 'provincia' | 'distrito') =>
      [...new Set(tutores.map((t) => t[campo]).filter(Boolean))].sort();

    return {
      estados: Object.entries(ESTADOS).map(([id, texto]) => ({ id, texto })),
      modalidades: Object.entries(MODALIDADES).map(([id, texto]) => ({ id, texto })),
      situaciones: Object.entries(SITUACIONES).map(([id, texto]) => ({ id, texto })),
      pagos: Object.entries(PAGOS).map(([id, texto]) => ({ id, texto })),
      grados: GRADOS.map((g) => ({ id: g.grado, texto: `CAT. ${g.categoria} · ${g.label}` })),
      departamentos: unicos('departamento'),
      provincias: unicos('provincia'),
      distritos: unicos('distrito'),
    };
  }

  /** Vista previa: cuántas filas salen y las primeras, para revisar antes. */
  async previsualizar(filtros: FiltrosReporte) {
    const filas = await this.filas(filtros);
    return {
      total: filas.length,
      titulo: this.titulo(filtros),
      descripcion: this.descripcion(filtros),
      // Las mismas columnas del Excel, para que la vista previa se lea igual.
      columnas: (filtros.tipo === 'delegaciones'
        ? this.columnasDelegacion()
        : this.columnasEstudiante()
      ).map(({ key, header }) => ({ key, header })),
      muestra: filas.slice(0, 25),
    };
  }

  async excel(filtros: FiltrosReporte): Promise<Buffer> {
    const filas = await this.filas(filtros);
    const porDelegacion = filtros.tipo === 'delegaciones';

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet(porDelegacion ? 'Delegaciones' : 'Estudiantes');

    const columnas = porDelegacion ? this.columnasDelegacion() : this.columnasEstudiante();
    const anchoTitulo = columnas.length;

    // Cabecera del documento: el nombre del concurso, qué se está bajando y
    // con qué filtros. Sin esto, un Excel suelto no dice nada por sí mismo.
    escribirTitulo(hoja, anchoTitulo, this.titulo(filtros), this.descripcion(filtros), filas.length);

    escribirEncabezados(hoja, columnas);

    for (const fila of filas) {
      hoja.addRow(columnas.map((c) => (fila as any)[c.key] ?? ''));
    }

    return (await libro.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /** Nombre de archivo legible, con la fecha. */
  nombreArchivo(filtros: FiltrosReporte) {
    return nombreArchivo(this.titulo(filtros));
  }

  // --------------------------------------------------------------------

  private columnasEstudiante() {
    return [
      { header: 'N°', key: 'orden', width: 6 },
      { header: 'DNI', key: 'dni', width: 13 },
      { header: 'ESTUDIANTE', key: 'nombres', width: 38 },
      { header: 'GRADO', key: 'grado', width: 20 },
      { header: 'CAT.', key: 'categoria', width: 7 },
      { header: 'NIVEL', key: 'nivel', width: 13 },
      { header: 'INSTITUCIÓN', key: 'institucion', width: 34 },
      { header: 'MODALIDAD', key: 'modalidad', width: 20 },
      { header: 'DEPARTAMENTO', key: 'departamento', width: 16 },
      { header: 'PROVINCIA', key: 'provincia', width: 16 },
      { header: 'DISTRITO', key: 'distrito', width: 16 },
      { header: 'TUTOR', key: 'tutor', width: 30 },
      { header: 'CELULAR', key: 'celular', width: 13 },
      { header: 'CORREO', key: 'correo', width: 28 },
      { header: 'PAGO', key: 'pago', width: 20 },
      { header: 'ESTADO', key: 'estado', width: 16 },
      { header: 'INSCRITO EL', key: 'inscrito', width: 18 },
    ];
  }

  private columnasDelegacion() {
    return [
      { header: 'N°', key: 'orden', width: 6 },
      { header: 'INSTITUCIÓN', key: 'institucion', width: 36 },
      { header: 'MODALIDAD', key: 'modalidad', width: 20 },
      { header: 'NIVEL', key: 'nivelInstitucion', width: 20 },
      { header: 'TUTOR', key: 'tutor', width: 30 },
      { header: 'DNI TUTOR', key: 'dni', width: 13 },
      { header: 'CELULAR', key: 'celular', width: 13 },
      { header: 'CORREO', key: 'correo', width: 28 },
      { header: 'DEPARTAMENTO', key: 'departamento', width: 16 },
      { header: 'PROVINCIA', key: 'provincia', width: 16 },
      { header: 'DISTRITO', key: 'distrito', width: 16 },
      { header: 'ESTUDIANTES', key: 'alumnos', width: 13 },
      { header: 'MÍNIMO', key: 'minimo', width: 10 },
      { header: 'PAGADOS', key: 'pagados', width: 11 },
      { header: 'POR PAGAR', key: 'pendientes', width: 12 },
      { header: 'COMPROBANTES', key: 'comprobantes', width: 15 },
      { header: 'MONTO APROBADO', key: 'montoAprobado', width: 17 },
      { header: 'ESTADO', key: 'estado', width: 16 },
      { header: 'REVISADO POR', key: 'revisadoPor', width: 26 },
      { header: 'REGISTRADO EL', key: 'inscrito', width: 18 },
    ];
  }

  /** El filtro en palabras, para que el Excel diga de qué es. */
  private titulo(f: FiltrosReporte) {
    const porDelegacion = f.tipo === 'delegaciones';
    const base = porDelegacion ? 'Delegaciones' : 'Estudiantes';

    if (f.situacion && SITUACIONES[f.situacion]) return `${base}: ${SITUACIONES[f.situacion]}`;
    if (f.pago && PAGOS[f.pago]) return `${base}: ${PAGOS[f.pago]}`;
    if (f.estado && ESTADOS[f.estado]) return `${base} con inscripción ${ESTADOS[f.estado]}`;
    if (f.distrito) return `${base} de ${f.distrito}`;
    if (f.provincia) return `${base} de ${f.provincia}`;
    if (f.departamento) return `${base} de ${f.departamento}`;
    if (f.modalidad && MODALIDADES[f.modalidad]) return `${base}: ${MODALIDADES[f.modalidad]}`;
    if (f.grado) return `${base} de ${etiquetaGrado(f.grado as any)}`;
    return porDelegacion ? 'Consolidado de delegaciones' : 'Consolidado general de estudiantes';
  }

  private descripcion(f: FiltrosReporte) {
    const partes: string[] = [];

    if (f.estado && ESTADOS[f.estado]) partes.push(`Estado: ${ESTADOS[f.estado]}`);
    if (f.situacion && SITUACIONES[f.situacion]) partes.push(SITUACIONES[f.situacion]);
    if (f.pago && PAGOS[f.pago]) partes.push(PAGOS[f.pago]);
    if (f.modalidad && MODALIDADES[f.modalidad]) partes.push(MODALIDADES[f.modalidad]);
    if (f.nivelInstitucion) {
      partes.push(`Nivel de la institución: ${NIVELES_INSTITUCION[f.nivelInstitucion] || f.nivelInstitucion}`);
    }
    if (f.nivel) partes.push(`Nivel: ${NIVELES[f.nivel] || f.nivel}`);
    if (f.grado) partes.push(`Grado: ${etiquetaGrado(f.grado as any)}`);
    if (f.departamento) partes.push(`Departamento: ${f.departamento}`);
    if (f.provincia) partes.push(`Provincia: ${f.provincia}`);
    if (f.distrito) partes.push(`Distrito: ${f.distrito}`);
    if (f.desde || f.hasta) {
      partes.push(`Registrados del ${f.desde || 'inicio'} al ${f.hasta || 'hoy'}`);
    }
    if (f.buscar) partes.push(`Búsqueda: "${f.buscar}"`);

    return partes.length ? partes.join(' · ') : 'Sin filtros: todos los registros';
  }

  /** El filtro sobre el tutor, que comparten los dos tipos de reporte. */
  private dondeTutor(f: FiltrosReporte) {
    const where: any = {};

    if (f.estado) where.estado = f.estado;
    if (f.modalidad) where.modalidad = f.modalidad;
    if (f.nivelInstitucion) where.nivelInstitucion = f.nivelInstitucion;
    if (f.departamento) where.departamento = f.departamento;
    if (f.provincia) where.provincia = f.provincia;
    if (f.distrito) where.distrito = f.distrito;

    if (f.desde || f.hasta) {
      where.createdAt = {};
      if (f.desde) where.createdAt.gte = new Date(`${f.desde}T00:00:00`);
      // El "hasta" incluye el día entero, que es lo que espera quien lo elige.
      if (f.hasta) where.createdAt.lte = new Date(`${f.hasta}T23:59:59.999`);
    }

    return where;
  }

  private async filas(f: FiltrosReporte) {
    return f.tipo === 'delegaciones' ? this.filasDelegacion(f) : this.filasEstudiante(f);
  }

  private async filasEstudiante(f: FiltrosReporte) {
    const where: any = { tutor: this.dondeTutor(f) };

    if (f.nivel) where.nivel = f.nivel;
    if (f.grado) where.grado = f.grado;
    if (f.pago === 'SIN_PAGAR') where.paymentId = null;
    if (f.pago === 'PAGADO') where.paymentId = { not: null };
    if (f.pago === 'APROBADO') where.payment = { estado: 'APROBADO' };

    if (f.buscar) {
      const buscar = f.buscar.trim();
      where.OR = [
        { nombres: { contains: buscar, mode: 'insensitive' } },
        { dni: { contains: buscar } },
        { tutor: { institucion: { contains: buscar, mode: 'insensitive' } } },
      ];
    }

    const alumnos = await this.prisma.student.findMany({
      where,
      include: { tutor: true, payment: { select: { estado: true, monto: true } } },
      orderBy: [{ tutor: { institucion: 'asc' } }, { categoria: 'asc' }, { nombres: 'asc' }],
    });

    const filtrados = await this.porSituacionEstudiantes(alumnos, f.situacion);

    return filtrados.map((a, i) => ({
      orden: i + 1,
      dni: a.dni,
      nombres: a.nombres,
      grado: etiquetaGrado(a.grado),
      categoria: a.categoria,
      nivel: a.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria',
      institucion: a.tutor.institucion,
      modalidad: MODALIDADES[a.tutor.modalidad] || a.tutor.modalidad,
      departamento: a.tutor.departamento,
      provincia: a.tutor.provincia,
      distrito: a.tutor.distrito,
      tutor: `${a.tutor.nombres} ${a.tutor.apellidos}`.trim(),
      celular: a.tutor.celular,
      correo: a.tutor.correo,
      pago: !a.paymentId
        ? 'Sin comprobante'
        : a.payment?.estado === 'APROBADO'
          ? 'Aprobado'
          : 'En revisión',
      estado: ESTADOS[a.tutor.estado] || a.tutor.estado,
      inscrito: this.fecha(a.createdAt),
    }));
  }

  private async filasDelegacion(f: FiltrosReporte) {
    const where: any = this.dondeTutor(f);

    if (f.buscar) {
      const buscar = f.buscar.trim();
      where.OR = [
        { institucion: { contains: buscar, mode: 'insensitive' } },
        { nombres: { contains: buscar, mode: 'insensitive' } },
        { apellidos: { contains: buscar, mode: 'insensitive' } },
        { correo: { contains: buscar, mode: 'insensitive' } },
        { dni: { contains: buscar } },
      ];
    }

    const tutores = await this.prisma.tutor.findMany({
      where,
      include: {
        students: { select: { grado: true, nivel: true, paymentId: true } },
        payments: { select: { estado: true, monto: true } },
      },
      orderBy: [{ institucion: 'asc' }],
    });

    const conDatos = tutores
      .map((t) => {
        const pagados = t.students.filter((a) => a.paymentId).length;
        const validacion = validarDelegacion(t.students, t.modalidad, t.nivelInstitucion);
        const minimos = minimosDe(t.modalidad, t.nivelInstitucion);
        return { t, pagados, validacion, minimos };
      })
      .filter(({ t, validacion, pagados }) => {
        if (f.pago === 'SIN_PAGAR' && t.students.length - pagados === 0) return false;
        if (f.pago === 'PAGADO' && pagados === 0) return false;
        if (f.pago === 'APROBADO' && !t.payments.some((p) => p.estado === 'APROBADO')) return false;

        switch (f.situacion) {
          case 'INCOMPLETAS':
            return t.students.length > 0 && !validacion.puedeEnviar;
          case 'COMPLETAS':
            return validacion.puedeEnviar;
          case 'UNO_SOLO':
            return t.students.length === 1;
          case 'SIN_ESTUDIANTES':
            return t.students.length === 0;
          case 'SIN_DATOS':
            return !t.institucion?.trim() || !t.departamento || !t.provincia || !t.distrito;
          default:
            return true;
        }
      });

    return conDatos.map(({ t, pagados, minimos }, i) => ({
      orden: i + 1,
      institucion: t.institucion,
      modalidad: MODALIDADES[t.modalidad] || t.modalidad,
      nivelInstitucion:
        t.nivelInstitucion === 'AMBOS'
          ? 'Primaria y secundaria'
          : t.nivelInstitucion === 'PRIMARIA'
            ? 'Solo primaria'
            : 'Solo secundaria',
      tutor: `${t.nombres} ${t.apellidos}`.trim(),
      dni: t.dni || '',
      celular: t.celular,
      correo: t.correo,
      departamento: t.departamento,
      provincia: t.provincia,
      distrito: t.distrito,
      alumnos: t.students.length,
      minimo: minimos.total,
      pagados,
      pendientes: t.students.length - pagados,
      comprobantes: t.payments.length,
      montoAprobado: t.payments
        .filter((p) => p.estado === 'APROBADO')
        .reduce((suma, p) => suma + p.monto, 0),
      estado: ESTADOS[t.estado] || t.estado,
      revisadoPor: t.revisadoPor || '',
      inscrito: this.fecha(t.createdAt),
    }));
  }

  /**
   * Las situaciones se calculan sobre la delegación entera, así que para el
   * reporte de estudiantes hay que resolver primero qué tutores califican.
   */
  private async porSituacionEstudiantes(alumnos: any[], situacion?: string) {
    if (!situacion) return alumnos;

    const tutores = new Map<string, any>();
    for (const a of alumnos) tutores.set(a.tutor.id, a.tutor);

    const conteos = await this.prisma.student.groupBy({
      by: ['tutorId'],
      _count: true,
      where: { tutorId: { in: [...tutores.keys()] } },
    });
    const totalDe = (id: string) => conteos.find((c) => c.tutorId === id)?._count ?? 0;

    const listas = await this.prisma.student.findMany({
      where: { tutorId: { in: [...tutores.keys()] } },
      select: { tutorId: true, grado: true, nivel: true },
    });

    const aceptado = new Set<string>();
    for (const [id, tutor] of tutores) {
      const suyos = listas.filter((s) => s.tutorId === id);
      const validacion = validarDelegacion(suyos, tutor.modalidad, tutor.nivelInstitucion);
      const total = totalDe(id);

      const pasa =
        situacion === 'INCOMPLETAS'
          ? total > 0 && !validacion.puedeEnviar
          : situacion === 'COMPLETAS'
            ? validacion.puedeEnviar
            : situacion === 'UNO_SOLO'
              ? total === 1
              : situacion === 'SIN_ESTUDIANTES'
                ? false // Un estudiante nunca pertenece a una delegación vacía.
                : situacion === 'SIN_DATOS'
                  ? !tutor.institucion?.trim() ||
                    !tutor.departamento ||
                    !tutor.provincia ||
                    !tutor.distrito
                  : true;

      if (pasa) aceptado.add(id);
    }

    return alumnos.filter((a) => aceptado.has(a.tutor.id));
  }

  private fecha(valor: Date) {
    return new Date(valor).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
}
