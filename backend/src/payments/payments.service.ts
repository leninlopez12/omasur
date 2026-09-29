import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MetodoPago, Payment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { JwtUser } from '../common/decorators';
import { conEnlace } from '../common/enlaces';
import { precioPorAlumno } from '../common/reglas';
import { etiquetaGrado } from '../common/grados';

const METODOS: Record<MetodoPago, string> = { YAPE: 'Yape', BCP: 'BCP' };

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private notificaciones: NotificationsService,
    private almacenamiento: StorageService,
  ) {}

  /**
   * El tutor puede pagar por partes: elige a qué alumnos cubre este comprobante
   * y el sistema calcula el monto. Los que quedan sin pagar se cubren después
   * con otro comprobante, y todos juntos forman el historial de la delegación.
   */
  async registrar(
    tutorId: string,
    archivo: Express.Multer.File,
    datos: { metodo?: string; alumnos?: string | string[] },
  ) {
    if (!archivo) throw new BadRequestException('Debe adjuntar la foto del comprobante');

    const metodo = this.metodoValido(datos.metodo);
    const elegidos = this.listaDeAlumnos(datos.alumnos);
    if (elegidos.length === 0) {
      throw new BadRequestException('Elija a qué estudiantes cubre este comprobante');
    }

    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    // Solo se aceptan alumnos propios y que todavía no estén cubiertos por otro
    // comprobante: así nunca se paga dos veces al mismo estudiante.
    const disponibles = await this.prisma.student.findMany({
      where: { id: { in: elegidos }, tutorId, paymentId: null },
      select: { id: true },
    });

    if (disponibles.length !== elegidos.length) {
      throw new BadRequestException(
        'Algunos estudiantes ya están cubiertos por otro comprobante. Actualice la página.',
      );
    }

    const precio = precioPorAlumno(tutor.modalidad);
    const monto = disponibles.length * precio;

    // Primero se sube: si falla, no se toca nada de lo que ya existía.
    const referencia = await this.almacenamiento.guardar(archivo, 'comprobantes');

    let pago: Payment;
    try {
      pago = await this.prisma.payment.create({
        data: {
          tutorId,
          metodo,
          monto,
          archivoUrl: referencia,
          students: { connect: disponibles.map(({ id }) => ({ id })) },
        },
      });
    } catch (error) {
      // La base no aceptó el cambio: se retira el archivo recién subido.
      await this.almacenamiento.eliminar(referencia);
      throw error;
    }

    if (tutor.estado === 'BORRADOR') {
      await this.prisma.tutor.update({ where: { id: tutorId }, data: { estado: 'PENDIENTE_PAGO' } });
    }

    const pendientes = await this.prisma.student.count({ where: { tutorId, paymentId: null } });

    await this.notificaciones.crear({
      tipo: 'PAGO_ENVIADO',
      titulo: 'Comprobante de pago recibido',
      detalle:
        (tutor.institucion || 'Institución sin nombre') +
        ' envió un comprobante de ' +
        METODOS[metodo] +
        ' por S/ ' +
        monto +
        ' (' +
        disponibles.length +
        ' estudiantes). Le quedan ' +
        pendientes +
        ' por pagar.',
      tutorId,
    });

    return conEnlace(pago);
  }

  /**
   * Cambiar la foto de un comprobante ya enviado. El archivo anterior se borra
   * de Cloudflare para que en el bucket solo queden los que están en uso.
   */
  async reemplazarArchivo(tutorId: string, pagoId: string, archivo: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Debe adjuntar la foto del comprobante');

    const pago = await this.suyo(tutorId, pagoId);
    if (pago.estado === 'APROBADO') {
      throw new BadRequestException('Ese comprobante ya fue aprobado y no se puede cambiar');
    }

    const referencia = await this.almacenamiento.guardar(archivo, 'comprobantes');

    let actualizado: Payment;
    try {
      actualizado = await this.prisma.payment.update({
        where: { id: pago.id },
        data: { archivoUrl: referencia, estado: 'EN_REVISION', observacion: null },
      });
    } catch (error) {
      await this.almacenamiento.eliminar(referencia);
      throw error;
    }

    // Ya está guardado el nuevo: recién ahí se descarta el viejo.
    if (pago.archivoUrl !== referencia) await this.almacenamiento.eliminar(pago.archivoUrl);

    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    await this.notificaciones.crear({
      tipo: 'PAGO_ENVIADO',
      titulo: 'Comprobante de pago reemplazado',
      detalle:
        (tutor?.institucion || 'Institución sin nombre') +
        ' cambió la foto de un comprobante de S/ ' +
        pago.monto +
        '.',
      tutorId,
    });

    return conEnlace(actualizado);
  }

  /**
   * Anular un comprobante. Los estudiantes que cubría vuelven a quedar
   * pendientes, para que el tutor pueda rehacer la selección.
   */
  async anular(tutorId: string, pagoId: string) {
    const pago = await this.suyo(tutorId, pagoId);
    if (pago.estado === 'APROBADO') {
      throw new BadRequestException('Ese comprobante ya fue aprobado y no se puede anular');
    }

    await this.prisma.payment.delete({ where: { id: pago.id } });
    await this.almacenamiento.eliminar(pago.archivoUrl);

    return { ok: true };
  }

  /** Historial completo del tutor, del más reciente al más antiguo. */
  async listar(tutorId: string) {
    const pagos = await this.prisma.payment.findMany({
      where: { tutorId },
      orderBy: { createdAt: 'desc' },
      include: {
        students: {
          orderBy: [{ grado: 'asc' }, { nombres: 'asc' }],
          select: { id: true, dni: true, nombres: true, grado: true, categoria: true },
        },
      },
    });

    return pagos.map(({ students, ...pago }) => ({
      ...conEnlace(pago),
      alumnos: students.map((a) => ({ ...a, gradoLabel: etiquetaGrado(a.grado) })),
      totalAlumnos: students.length,
    }));
  }

  /**
   * Entrega el archivo: el tutor solo el suyo, la comisión cualquiera.
   * Va por la API para que el enlace nunca caduque y siempre pase por permisos.
   */
  async archivo(pagoId: string, usuario: JwtUser) {
    const pago = await this.prisma.payment.findUnique({ where: { id: pagoId } });
    if (!pago) throw new NotFoundException('Comprobante no encontrado');

    if (usuario.rol === 'TUTOR' && pago.tutorId !== usuario.sub) {
      throw new ForbiddenException('Ese comprobante no le pertenece');
    }

    const archivo = await this.almacenamiento.leer(pago.archivoUrl);
    if (!archivo) throw new NotFoundException('El archivo ya no está disponible');

    return archivo;
  }

  // ---------------------------------------------------------------- internos

  private async suyo(tutorId: string, pagoId: string) {
    const pago = await this.prisma.payment.findUnique({ where: { id: pagoId } });
    if (!pago || pago.tutorId !== tutorId) {
      throw new NotFoundException('Comprobante no encontrado');
    }
    return pago;
  }

  private metodoValido(valor?: string): MetodoPago {
    const metodo = (valor || '').toUpperCase();
    if (metodo !== 'YAPE' && metodo !== 'BCP') {
      throw new BadRequestException('Elija cómo pagó: Yape o BCP');
    }
    return metodo;
  }

  /** El formulario manda la lista como JSON dentro del multipart. */
  private listaDeAlumnos(valor?: string | string[]): string[] {
    if (Array.isArray(valor)) return [...new Set(valor.filter(Boolean))];
    if (!valor) return [];

    try {
      const lista = JSON.parse(valor);
      if (!Array.isArray(lista)) return [];
      return [...new Set(lista.filter((id) => typeof id === 'string' && id))];
    } catch {
      return [];
    }
  }
}
