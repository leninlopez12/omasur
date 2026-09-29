import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { etiquetaGrado } from '../common/grados';
import { conEnlace } from '../common/enlaces';

/**
 * El recorrido de un alumno, de punta a punta:
 *
 *   REGISTRADO → EN_REVISION → APROBADA
 *                           └→ OBSERVADA
 *
 * Se calcula por alumno y no por delegación: un alumno que el tutor agrega
 * después de que le aprobaron la inscripción vuelve a empezar, porque todavía
 * no está pagado ni revisado. Antes heredaba el "aprobada" de su delegación y
 * aparecía listo sin que nadie lo hubiera visto.
 */
export type EstadoInscripcionAlumno = 'REGISTRADO' | 'EN_REVISION' | 'APROBADA' | 'OBSERVADA';
export type EstadoComprobante = 'SIN_ENVIAR' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO';

const CON_TUTOR = {
  tutor: {
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      institucion: true,
      estado: true,
      observacion: true,
      departamento: true,
      provincia: true,
      distrito: true,
    },
  },
  payment: {
    select: {
      id: true,
      monto: true,
      metodo: true,
      estado: true,
      observacion: true,
      archivoUrl: true,
      createdAt: true,
    },
  },
} as const;

@Injectable()
export class InscripcionesService {
  constructor(private prisma: PrismaService) {}

  /** Lo que ve el tutor en su sección «Inscripciones». */
  async delTutor(tutorId: string) {
    const alumnos = await this.prisma.student.findMany({
      where: { tutorId },
      include: CON_TUTOR,
      orderBy: { createdAt: 'desc' },
    });

    // Los rechazados sueltan a sus alumnos, así que no salen por la relación:
    // se pasan aparte para que el tutor sepa qué le rechazaron y por qué.
    const rechazados = await this.prisma.payment.findMany({
      where: { tutorId, estado: 'RECHAZADO' },
      orderBy: { createdAt: 'desc' },
    });

    return {
      filas: alumnos.map((a) => this.fila(a)),
      rechazados: rechazados.map((p) => conEnlace(p)),
    };
  }

  /**
   * Lo que ve el supervisor: un alumno por fila, con su tutor y su
   * comprobante, para revisar sin tener que abrir delegación por delegación.
   */
  async paraRevisar(filtros: {
    estado?: string;
    nivel?: string;
    grado?: string;
    buscar?: string;
  }) {
    const where: any = {};
    if (filtros.nivel) where.nivel = filtros.nivel;
    if (filtros.grado) where.grado = filtros.grado;
    if (filtros.buscar) {
      const buscar = filtros.buscar.trim();
      where.OR = [
        { nombres: { contains: buscar, mode: 'insensitive' } },
        { dni: { contains: buscar } },
        { tutor: { institucion: { contains: buscar, mode: 'insensitive' } } },
      ];
    }

    const alumnos = await this.prisma.student.findMany({
      where,
      include: CON_TUTOR,
      orderBy: { createdAt: 'desc' },
    });

    const filas = alumnos.map((a) => this.fila(a));
    return filtros.estado ? filas.filter((f) => f.estadoInscripcion === filtros.estado) : filas;
  }

  /** Una fila con todo lo que piden las dos tablas. */
  private fila(a: any) {
    const pago = a.payment;

    const estadoComprobante: EstadoComprobante = !pago
      ? 'SIN_ENVIAR'
      : (pago.estado as EstadoComprobante);

    // El orden manda: una observación tapa todo lo demás, y la aprobación
    // exige las dos cosas —comprobante aprobado y delegación aprobada—.
    let estadoInscripcion: EstadoInscripcionAlumno = 'REGISTRADO';
    let observacion: string | null = null;

    if (a.tutor.estado === 'OBSERVADA') {
      estadoInscripcion = 'OBSERVADA';
      observacion = a.tutor.observacion;
    } else if (pago?.estado === 'RECHAZADO') {
      estadoInscripcion = 'OBSERVADA';
      observacion = pago.observacion;
    } else if (pago?.estado === 'APROBADO' && a.tutor.estado === 'APROBADA') {
      estadoInscripcion = 'APROBADA';
    } else if (pago) {
      estadoInscripcion = 'EN_REVISION';
    }

    return {
      id: a.id,
      dni: a.dni,
      nombres: a.nombres,
      nivel: a.nivel,
      nivelLabel: a.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria',
      grado: a.grado,
      gradoLabel: etiquetaGrado(a.grado),
      categoria: a.categoria,
      registradoEn: a.createdAt,

      institucion: a.tutor.institucion,
      tutorId: a.tutor.id,
      tutorNombre: `${a.tutor.nombres} ${a.tutor.apellidos}`.trim(),
      departamento: a.tutor.departamento,
      provincia: a.tutor.provincia,
      distrito: a.tutor.distrito,

      estadoComprobante,
      estadoInscripcion,
      observacion,
      // La hora exacta en que se mandó el comprobante: es la que pidieron para
      // saber cuáles fueron los últimos alumnos enviados.
      enviadoEn: pago?.createdAt ?? null,
      pago: pago
        ? {
            id: pago.id,
            monto: pago.monto,
            metodo: pago.metodo,
            estado: pago.estado,
            archivoUrl: `/api/pagos/${pago.id}/archivo`,
          }
        : null,
    };
  }
}
