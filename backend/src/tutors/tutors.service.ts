import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Tutor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { precioPorAlumno, validarDelegacion } from '../common/reglas';
import { DatosInstitucionDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { conEnlace } from '../common/enlaces';

@Injectable()
export class TutorsService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificationsService,
  ) {}

  async resumen(tutorId: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: {
        students: { select: { grado: true, nivel: true, paymentId: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    const validacion = validarDelegacion(tutor.students, tutor.modalidad, tutor.nivelInstitucion);
    const pago = conEnlace(tutor.payments[0] ?? null);
    const datosCompletos = this.institucionCompleta(tutor);
    const precio = precioPorAlumno(tutor.modalidad);

    // El pago puede ir por partes: se cuenta cuántos ya están cubiertos por
    // algún comprobante y cuántos siguen esperando.
    const pagados = tutor.students.filter((a) => a.paymentId).length;
    const pendientes = tutor.students.length - pagados;

    return {
      estado: tutor.estado,
      observacion: tutor.observacion,
      respuesta: tutor.respuesta,
      modalidad: tutor.modalidad,
      nivelInstitucion: tutor.nivelInstitucion,
      institucion: tutor.institucion,
      departamento: tutor.departamento,
      provincia: tutor.provincia,
      distrito: tutor.distrito,
      validacion,
      precioPorAlumno: precio,
      totalPagar: validacion.total * precio,
      pago,
      cobertura: {
        pagados,
        pendientes,
        montoPendiente: pendientes * precio,
        comprobantes: tutor.payments.length,
      },
      pasos: {
        datosCompletos,
        alumnosCompletos: validacion.puedeEnviar,
        pagoAdjunto: Boolean(pago),
        enviada: tutor.estado === 'EN_REVISION' || tutor.estado === 'APROBADA',
      },
    };
  }

  /**
   * La región se mantiene igual al departamento elegido.
   *
   * La modalidad y el nivel se congelan apenas hay un estudiante registrado.
   * Son los dos campos de los que cuelga el dinero: la modalidad fija el
   * precio por alumno (estatal S/ 12, particular y grupo de estudio S/ 17) y
   * los dos fijan los mínimos. Sin este candado un tutor podía inscribirse
   * como estatal, pagar a S/ 12 y después pasarse a particular, o declararse
   * grupo de estudio para que le exijan 15 en vez de 30 o 60. Lo demás
   * —nombre de la institución, ubicación, datos de contacto— se corrige
   * siempre.
   */
  async actualizarDatos(tutorId: string, dto: DatosInstitucionDto) {
    const actual = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      select: {
        modalidad: true,
        nivelInstitucion: true,
        _count: { select: { students: true, payments: true } },
      },
    });
    if (!actual) throw new NotFoundException('Tutor no encontrado');

    const cambios: string[] = [];
    if (dto.modalidad !== actual.modalidad) cambios.push('la modalidad');
    if (dto.nivelInstitucion !== actual.nivelInstitucion) cambios.push('el nivel');

    if (cambios.length > 0) {
      const { students, payments } = actual._count;

      if (payments > 0) {
        throw new BadRequestException(
          `Ya envió ${payments === 1 ? 'un comprobante' : payments + ' comprobantes'} de pago, ` +
            `así que no puede cambiar ${cambios.join(' ni ')}: de eso depende el monto que ya ` +
            'pagó. Si se equivocó al registrarse, escriba a la comisión organizadora.',
        );
      }

      if (students > 0) {
        throw new BadRequestException(
          `Ya tiene ${students === 1 ? '1 estudiante registrado' : students + ' estudiantes registrados'}, ` +
            `así que no puede cambiar ${cambios.join(' ni ')}: de eso dependen el precio por ` +
            'estudiante y los mínimos. Borre primero a sus estudiantes o escriba a la comisión.',
        );
      }
    }

    const data: Record<string, any> = {
      institucion: dto.institucion.trim(),
      modalidad: dto.modalidad,
      nivelInstitucion: dto.nivelInstitucion,
      departamento: dto.departamento,
      region: dto.departamento,
      provincia: dto.provincia,
      distrito: dto.distrito,
    };
    if (dto.nombres) data.nombres = dto.nombres.trim();
    if (dto.apellidos) data.apellidos = dto.apellidos.trim();
    if (dto.celular) data.celular = dto.celular;

    const tutor = await this.prisma.tutor.update({ where: { id: tutorId }, data });
    const { password, ...resto } = tutor;
    return resto;
  }

  /** Envía la inscripción a revisión de la comisión organizadora. */
  async enviarInscripcion(tutorId: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { students: { select: { grado: true, nivel: true } }, payments: true },
    });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    if (!this.institucionCompleta(tutor)) {
      throw new BadRequestException('Complete los datos de su institución educativa');
    }

    const validacion = validarDelegacion(tutor.students, tutor.modalidad, tutor.nivelInstitucion);

    // Los mínimos ya no frenan el envío: se informan en el panel y los revisa
    // la comisión, que puede observar la delegación si no llega. Lo que sí es
    // indispensable es que haya alumnos y un comprobante que revisar.
    if (validacion.total === 0) {
      throw new BadRequestException('Registre al menos un estudiante antes de enviar');
    }
    if (tutor.payments.length === 0) {
      throw new BadRequestException('Debe adjuntar el comprobante de pago antes de enviar');
    }

    await this.prisma.tutor.update({
      where: { id: tutorId },
      data: { estado: 'EN_REVISION', observacion: null },
    });

    await this.notificaciones.crear({
      tipo: 'INSCRIPCION_ENVIADA',
      titulo: 'Inscripción enviada a revisión',
      detalle:
        tutor.institucion + ' envió su delegación de ' + validacion.total + ' estudiantes.',
      tutorId,
    });

    return { ok: true, estado: 'EN_REVISION' };
  }

  /**
   * El tutor levanta la observación: explica qué corrigió y su delegación
   * vuelve a la cola de revisión de la comisión.
   */
  async absolverObservacion(tutorId: string, respuesta: string) {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { students: { select: { grado: true, nivel: true } }, payments: true },
    });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    if (tutor.estado !== 'OBSERVADA') {
      throw new BadRequestException('Su inscripción no tiene observaciones pendientes');
    }
    if (!respuesta?.trim()) {
      throw new BadRequestException('Escriba cómo levantó la observación');
    }

    // Las mismas condiciones que el primer envío, ni una más: alumnos y un
    // comprobante que revisar. Exigir aquí los mínimos dejaba sin salida a
    // quien fue observado justamente por no llegar a ellos —no podía ni
    // responder—, y quien decide si la delegación alcanza es la comisión.
    const validacion = validarDelegacion(tutor.students, tutor.modalidad, tutor.nivelInstitucion);
    if (validacion.total === 0) {
      throw new BadRequestException('Registre al menos un estudiante antes de responder');
    }
    if (tutor.payments.length === 0) {
      throw new BadRequestException('Debe adjuntar el comprobante de pago antes de responder');
    }

    await this.prisma.tutor.update({
      where: { id: tutorId },
      data: { estado: 'EN_REVISION', respuesta: respuesta.trim() },
    });

    await this.notificaciones.crear({
      tipo: 'OBSERVACION_ABSUELTA',
      titulo: 'Observación absuelta',
      detalle: `${tutor.institucion} respondió a la observación y espera nueva revisión.`,
      tutorId,
    });

    return { ok: true, estado: 'EN_REVISION' };
  }

  private institucionCompleta(tutor: Tutor): boolean {
    return Boolean(
      tutor.institucion?.trim() && tutor.departamento && tutor.provincia && tutor.distrito,
    );
  }
}
