import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { validarDelegacion } from '../common/reglas';
import { GRADOS, etiquetaGrado } from '../common/grados';
import { NotificationsService } from '../notifications/notifications.service';
import { conEnlace } from '../common/enlaces';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AdminService {
  private readonly log = new Logger('Comisión');

  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificationsService,
    private almacenamiento: StorageService,
  ) {}

  async metricas() {
    const [
      tutores,
      alumnos,
      enRevision,
      aprobadas,
      observadas,
      porModalidad,
      porRegion,
      porProvincia,
      porGrado,
      pagos,
      instituciones,
      delegaciones,
      porEstado,
      alumnosPagados,
      staff,
      ultimosTutores,
      ultimosPagos,
      porNivel,
    ] = await Promise.all([
      this.prisma.tutor.count(),
      this.prisma.student.count(),
      this.prisma.tutor.count({ where: { estado: 'EN_REVISION' } }),
      this.prisma.tutor.count({ where: { estado: 'APROBADA' } }),
      this.prisma.tutor.count({ where: { estado: 'OBSERVADA' } }),
      this.prisma.tutor.groupBy({ by: ['modalidad'], _count: true }),
      this.prisma.tutor.groupBy({ by: ['departamento'], _count: true }),
      this.prisma.tutor.groupBy({ by: ['provincia'], _count: true }),
      this.prisma.student.groupBy({ by: ['grado'], _count: true }),
      this.prisma.payment.groupBy({ by: ['estado'], _sum: { monto: true }, _count: true }),
      this.prisma.tutor.findMany({ select: { institucion: true }, where: { institucion: { not: '' } } }),
      this.prisma.tutor.findMany({
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          institucion: true,
          modalidad: true,
          departamento: true,
          provincia: true,
          estado: true,
          _count: { select: { students: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tutor.groupBy({ by: ['estado'], _count: true }),
      this.prisma.student.count({ where: { paymentId: { not: null } } }),
      this.prisma.admin.groupBy({ by: ['rol'], _count: true }),
      this.prisma.tutor.findMany({
        select: { id: true, institucion: true, nombres: true, apellidos: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.payment.findMany({
        select: {
          id: true,
          monto: true,
          metodo: true,
          estado: true,
          createdAt: true,
          tutor: { select: { id: true, institucion: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.student.groupBy({ by: ['nivel'], _count: true }),
    ]);

    const montoDe = (estado: string) => pagos.find((p) => p.estado === estado)?._sum.monto ?? 0;
    const cuentaDe = (estado: string) => pagos.find((p) => p.estado === estado)?._count ?? 0;
    const estadoDe = (estado: string) => porEstado.find((e) => e.estado === estado)?._count ?? 0;
    const rolDe = (rol: string) => staff.find((s) => s.rol === rol)?._count ?? 0;
    const colegios = new Set(instituciones.map((i) => i.institucion.trim().toUpperCase())).size;
    const confirmado = await this.resumenConfirmado(montoDe('APROBADO'));

    return {
      tutores,
      alumnos,
      colegios,
      enRevision,
      aprobadas,
      observadas,
      promedioPorTutor: tutores ? Math.round((alumnos / tutores) * 10) / 10 : 0,
      recaudado: {
        total: montoDe('APROBADO') + montoDe('EN_REVISION') + montoDe('RECHAZADO'),
        aprobado: montoDe('APROBADO'),
        enRevision: montoDe('EN_REVISION'),
        rechazado: montoDe('RECHAZADO'),
        comprobantes: pagos.reduce((n, p) => n + p._count, 0),
        porEstado: {
          APROBADO: { total: cuentaDe('APROBADO'), monto: montoDe('APROBADO') },
          EN_REVISION: { total: cuentaDe('EN_REVISION'), monto: montoDe('EN_REVISION') },
          RECHAZADO: { total: cuentaDe('RECHAZADO'), monto: montoDe('RECHAZADO') },
        },
      },
      // Todos los estados, no solo los tres que se revisaban: sin esto no se
      // veía cuántas delegaciones están a medio llenar.
      porEstadoInscripcion: {
        BORRADOR: estadoDe('BORRADOR'),
        PENDIENTE_PAGO: estadoDe('PENDIENTE_PAGO'),
        EN_REVISION: estadoDe('EN_REVISION'),
        APROBADA: estadoDe('APROBADA'),
        OBSERVADA: estadoDe('OBSERVADA'),
      },
      cobertura: {
        pagados: alumnosPagados,
        pendientes: alumnos - alumnosPagados,
      },
      equipo: { administradores: rolDe('ADMIN'), supervisores: rolDe('SUPERVISOR') },
      porNivel: {
        PRIMARIA: porNivel.find((n) => n.nivel === 'PRIMARIA')?._count ?? 0,
        SECUNDARIA: porNivel.find((n) => n.nivel === 'SECUNDARIA')?._count ?? 0,
      },
      recientes: {
        tutores: ultimosTutores.map((t) => ({
          id: t.id,
          institucion: t.institucion,
          tutor: `${t.nombres} ${t.apellidos}`.trim(),
          cuando: t.createdAt,
        })),
        pagos: ultimosPagos.map((p) => ({
          id: p.id,
          tutorId: p.tutor.id,
          institucion: p.tutor.institucion,
          monto: p.monto,
          metodo: p.metodo,
          estado: p.estado,
          cuando: p.createdAt,
        })),
      },
      porModalidad: porModalidad.map((m) => ({ modalidad: m.modalidad, total: m._count })),
      porRegion: this.ordenar(porRegion, 'departamento', 'region'),
      porProvincia: this.ordenar(porProvincia, 'provincia', 'provincia'),
      porGrado: GRADOS.map((g) => ({
        label: g.label,
        categoria: g.categoria,
        total: porGrado.find((p) => p.grado === g.grado)?._count ?? 0,
      })),
      delegaciones: delegaciones
        .map((t) => ({
          id: t.id,
          institucion: t.institucion,
          tutor: `${t.nombres} ${t.apellidos}`,
          modalidad: t.modalidad,
          departamento: t.departamento,
          provincia: t.provincia,
          estado: t.estado,
          alumnos: t._count.students,
        }))
        .sort((a, b) => b.alumnos - a.alumnos),
      confirmado,
    };
  }

  /**
   * Lo mismo que el tablero general, pero contando solo las delegaciones que la
   * comisión ya aprobó. Es la foto real del concurso: quién está adentro.
   */
  private async resumenConfirmado(montoAprobado: number) {
    const soloAprobadas = { estado: 'APROBADA' as const };

    const [tutores, alumnos, instituciones, porRegion, porGrado, porModalidad] = await Promise.all([
      this.prisma.tutor.count({ where: soloAprobadas }),
      this.prisma.student.count({ where: { tutor: soloAprobadas } }),
      this.prisma.tutor.findMany({
        select: { institucion: true },
        where: { ...soloAprobadas, institucion: { not: '' } },
      }),
      this.prisma.tutor.groupBy({ by: ['departamento'], _count: true, where: soloAprobadas }),
      this.prisma.student.groupBy({
        by: ['grado'],
        _count: true,
        where: { tutor: soloAprobadas },
      }),
      this.prisma.tutor.groupBy({ by: ['modalidad'], _count: true, where: soloAprobadas }),
    ]);

    return {
      tutores,
      alumnos,
      colegios: new Set(instituciones.map((i) => i.institucion.trim().toUpperCase())).size,
      promedioPorTutor: tutores ? Math.round((alumnos / tutores) * 10) / 10 : 0,
      recaudado: montoAprobado,
      porRegion: this.ordenar(porRegion, 'departamento', 'region'),
      porModalidad: porModalidad.map((m) => ({ modalidad: m.modalidad, total: m._count })),
      porGrado: GRADOS.map((g) => ({
        label: g.label,
        categoria: g.categoria,
        total: porGrado.find((p) => p.grado === g.grado)?._count ?? 0,
      })),
    };
  }

  /** Agrupa, descarta los vacíos y ordena de mayor a menor. */
  private ordenar(filas: any[], campo: string, salida: string) {
    return filas
      .filter((f) => f[campo])
      .map((f) => ({ [salida]: f[campo], total: f._count }))
      .sort((a: any, b: any) => b.total - a.total);
  }

  /** Consulta de tutores: tabla simple para buscar quién se está inscribiendo. */
  async tutores(filtros: { estado?: string; buscar?: string }) {
    const where: any = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.buscar) {
      where.OR = [
        { institucion: { contains: filtros.buscar, mode: 'insensitive' } },
        { nombres: { contains: filtros.buscar, mode: 'insensitive' } },
        { apellidos: { contains: filtros.buscar, mode: 'insensitive' } },
        { dni: { contains: filtros.buscar } },
        { correo: { contains: filtros.buscar, mode: 'insensitive' } },
      ];
    }

    const tutores = await this.prisma.tutor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { students: true } } },
    });

    return {
      total: tutores.length,
      tutores: tutores.map((t) => ({
        id: t.id,
        dni: t.dni,
        nombre: `${t.nombres} ${t.apellidos}`,
        celular: t.celular,
        correo: t.correo,
        institucion: t.institucion,
        modalidad: t.modalidad,
        departamento: t.departamento,
        provincia: t.provincia,
        estado: t.estado,
        alumnos: t._count.students,
        createdAt: t.createdAt,
      })),
    };
  }

  /** Consulta de estudiantes, con el estado de la delegación a la que pertenecen. */
  async estudiantes(filtros: { estado?: string; grado?: string; buscar?: string }) {
    const where: any = {};
    if (filtros.grado) where.grado = filtros.grado;
    if (filtros.estado) where.tutor = { estado: filtros.estado };
    if (filtros.buscar) {
      where.OR = [
        { nombres: { contains: filtros.buscar, mode: 'insensitive' } },
        { dni: { contains: filtros.buscar } },
        { tutor: { institucion: { contains: filtros.buscar, mode: 'insensitive' } } },
      ];
    }

    const alumnos = await this.prisma.student.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tutor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            institucion: true,
            modalidad: true,
            departamento: true,
            provincia: true,
            estado: true,
          },
        },
      },
    });

    return {
      total: alumnos.length,
      alumnos: alumnos.map((a) => ({
        id: a.id,
        dni: a.dni,
        nombres: a.nombres,
        categoria: a.categoria,
        grado: a.grado,
        gradoLabel: etiquetaGrado(a.grado),
        nivel: a.nivel,
        institucion: a.tutor.institucion,
        modalidad: a.tutor.modalidad,
        departamento: a.tutor.departamento,
        provincia: a.tutor.provincia,
        tutorId: a.tutor.id,
        tutor: `${a.tutor.nombres} ${a.tutor.apellidos}`,
        estado: a.tutor.estado,
        credencialLista: a.tutor.estado === 'APROBADA',
      })),
    };
  }

  async inscripciones(filtros: { estado?: string; region?: string; buscar?: string }) {
    const where: any = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.region) where.region = filtros.region;
    if (filtros.buscar) {
      where.OR = [
        { institucion: { contains: filtros.buscar, mode: 'insensitive' } },
        { nombres: { contains: filtros.buscar, mode: 'insensitive' } },
        { apellidos: { contains: filtros.buscar, mode: 'insensitive' } },
        { correo: { contains: filtros.buscar, mode: 'insensitive' } },
      ];
    }

    const tutores = await this.prisma.tutor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { students: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    // `payments` se descarta a propósito: el comprobante sale solo en `pago`,
    // ya convertido a la ruta de la API, para no filtrar la clave interna.
    return tutores.map(({ password, payments, ...t }) => ({
      ...t,
      totalAlumnos: t._count.students,
      pago: conEnlace(payments[0] ?? null),
    }));
  }

  async detalle(tutorId: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: {
        students: { orderBy: [{ grado: 'asc' }, { nombres: 'asc' }] },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { students: true } } },
        },
      },
    });
    if (!tutor) throw new NotFoundException('Inscripción no encontrada');

    const { password, ...datos } = tutor;
    const pagados = tutor.students.filter((a) => a.paymentId).length;
    return {
      ...datos,
      cobertura: { pagados, pendientes: tutor.students.length - pagados },
      payments: tutor.payments.map(({ _count, ...pago }) => ({
        ...conEnlace(pago),
        totalAlumnos: _count.students,
      })),
      students: tutor.students.map((a) => ({ ...a, gradoLabel: etiquetaGrado(a.grado) })),
      validacion: validarDelegacion(tutor.students, tutor.modalidad, tutor.nivelInstitucion),
    };
  }

  async revisar(
    tutorId: string,
    estado: 'APROBADA' | 'OBSERVADA',
    observacion?: string,
    quien?: string,
  ) {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) throw new NotFoundException('Inscripción no encontrada');

    const observada = estado === 'OBSERVADA';

    await this.prisma.tutor.update({
      where: { id: tutorId },
      data: {
        estado,
        observacion: observada ? observacion || null : null,
        // Al cerrar la revisión, la respuesta anterior del tutor deja de aplicar.
        respuesta: null,
        revisadoPor: quien || null,
        revisadoEn: new Date(),
      },
    });

    await this.notificaciones.crear({
      tipo: observada ? 'INSCRIPCION_OBSERVADA' : 'INSCRIPCION_APROBADA',
      titulo: observada ? 'Su inscripción fue observada' : '¡Su inscripción fue aprobada!',
      detalle: observada
        ? observacion || 'Revise las observaciones de la comisión y responda desde su panel.'
        : 'Ya puede descargar las credenciales de su delegación.',
      tutorId,
      paraTutorId: tutorId,
    });

    if (estado === 'APROBADA') {
      await this.prisma.payment.updateMany({
        where: { tutorId, estado: 'EN_REVISION' },
        data: {
          estado: 'APROBADO',
          observacion: null,
          revisadoPor: quien || null,
          revisadoEn: new Date(),
        },
      });
    }

    return { ok: true, estado };
  }

  /**
   * Revisión de un comprobante suelto. Al rechazarlo, los estudiantes que
   * cubría vuelven a quedar pendientes para que el tutor rehaga el pago.
   */
  async revisarPago(
    pagoId: string,
    estado: 'APROBADO' | 'RECHAZADO',
    observacion?: string,
    quien?: string,
  ) {
    const pago = await this.prisma.payment.findUnique({
      where: { id: pagoId },
      include: { tutor: { select: { id: true, institucion: true } } },
    });
    if (!pago) throw new NotFoundException('Comprobante no encontrado');

    const rechazado = estado === 'RECHAZADO';

    await this.prisma.payment.update({
      where: { id: pagoId },
      data: {
        estado,
        observacion: rechazado ? observacion || null : null,
        revisadoPor: quien || null,
        revisadoEn: new Date(),
        ...(rechazado ? { students: { set: [] } } : {}),
      },
    });

    await this.notificaciones.crear({
      tipo: rechazado ? 'INSCRIPCION_OBSERVADA' : 'INSCRIPCION_APROBADA',
      titulo: rechazado ? 'Un comprobante fue rechazado' : 'Comprobante aprobado',
      detalle: rechazado
        ? observacion || 'La comisión rechazó un comprobante. Vuelva a enviarlo desde su panel.'
        : 'La comisión aprobó su comprobante de S/ ' + pago.monto + '.',
      tutorId: pago.tutor.id,
      paraTutorId: pago.tutor.id,
    });

    return { ok: true, estado };
  }

  /** Consolidado general de todos los estudiantes inscritos. */
  async exportarConsolidado(): Promise<Buffer> {
    const alumnos = await this.prisma.student.findMany({
      include: { tutor: true },
      orderBy: [{ categoria: 'asc' }, { nombres: 'asc' }],
    });

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Consolidado');
    hoja.columns = [
      { header: 'DNI', key: 'dni', width: 13 },
      { header: 'ESTUDIANTE', key: 'nombres', width: 40 },
      { header: 'GRADO', key: 'grado', width: 20 },
      { header: 'CAT.', key: 'categoria', width: 8 },
      { header: 'INSTITUCIÓN', key: 'institucion', width: 36 },
      { header: 'MODALIDAD', key: 'modalidad', width: 14 },
      { header: 'REGIÓN', key: 'region', width: 18 },
      { header: 'PROVINCIA', key: 'provincia', width: 18 },
      { header: 'DISTRITO', key: 'distrito', width: 18 },
      { header: 'TUTOR', key: 'tutor', width: 30 },
      { header: 'CELULAR', key: 'celular', width: 14 },
      { header: 'ESTADO', key: 'estado', width: 14 },
    ];
    const cabecera = hoja.getRow(1);
    cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B1E2B' } };

    alumnos.forEach((a) =>
      hoja.addRow({
        dni: a.dni,
        nombres: a.nombres,
        grado: etiquetaGrado(a.grado),
        categoria: a.categoria,
        institucion: a.tutor.institucion,
        modalidad: a.tutor.modalidad,
        region: a.tutor.region,
        provincia: a.tutor.provincia,
        distrito: a.tutor.distrito,
        tutor: a.tutor.nombres + ' ' + a.tutor.apellidos,
        celular: a.tutor.celular,
        estado: a.tutor.estado,
      }),
    );

    return (await libro.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // --------------------------------------------------------------------
  // Deshacer. Solo el administrador.
  // --------------------------------------------------------------------

  /**
   * Devuelve una delegación ya resuelta al estado "en revisión", para volver
   * a decidir sobre ella. No toca los comprobantes: si alguno se aprobó, se
   * revisa uno por uno desde la misma pantalla.
   */
  async reabrir(tutorId: string, quien?: string) {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) throw new NotFoundException('Inscripción no encontrada');

    if (tutor.estado !== 'APROBADA' && tutor.estado !== 'OBSERVADA') {
      throw new BadRequestException('Esta inscripción todavía no fue resuelta');
    }

    await this.prisma.tutor.update({
      where: { id: tutorId },
      data: {
        estado: 'EN_REVISION',
        observacion: null,
        respuesta: null,
        revisadoPor: quien || null,
        revisadoEn: new Date(),
      },
    });

    await this.notificaciones.crear({
      tipo: 'INSCRIPCION_ENVIADA',
      titulo: 'Su inscripción volvió a revisión',
      detalle: 'La comisión está revisando nuevamente su delegación.',
      tutorId,
      paraTutorId: tutorId,
    });

    return { ok: true, estado: 'EN_REVISION' };
  }

  /**
   * Borra una delegación entera: tutor, estudiantes, comprobantes y los
   * archivos que tenga en Cloudflare. No hay vuelta atrás, por eso el
   * controlador exige que se escriba el nombre de la institución.
   */
  async eliminarDelegacion(tutorId: string, confirmacion: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { payments: { select: { archivoUrl: true } }, students: { select: { id: true } } },
    });
    if (!tutor) throw new NotFoundException('Inscripción no encontrada');

    const esperado = (tutor.institucion || tutor.correo).trim().toUpperCase();
    if ((confirmacion || '').trim().toUpperCase() !== esperado) {
      throw new BadRequestException(`Para confirmar, escriba exactamente: ${esperado}`);
    }

    // Primero la base: si algo falla, no se borró ningún archivo de más.
    await this.prisma.notificacion.deleteMany({
      where: { OR: [{ tutorId }, { paraTutorId: tutorId }] },
    });
    await this.prisma.tokenRecuperacion.deleteMany({ where: { cuentaId: tutorId } });
    await this.prisma.payment.deleteMany({ where: { tutorId } });
    await this.prisma.student.deleteMany({ where: { tutorId } });
    await this.prisma.tutor.delete({ where: { id: tutorId } });

    for (const pago of tutor.payments) {
      await this.almacenamiento.eliminar(pago.archivoUrl);
    }

    this.log.warn(
      `Delegación eliminada: ${tutor.institucion} (${tutor.correo}) — ` +
        `${tutor.students.length} estudiantes y ${tutor.payments.length} comprobantes.`,
    );

    return {
      ok: true,
      eliminado: {
        institucion: tutor.institucion,
        correo: tutor.correo,
        estudiantes: tutor.students.length,
        comprobantes: tutor.payments.length,
      },
    };
  }
}
