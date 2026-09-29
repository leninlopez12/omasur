import { Injectable } from '@nestjs/common';
import { Notificacion, TipoNotificacion } from '@prisma/client';
import { Observable, Subject, filter } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

const MAXIMO_HISTORIAL = 50;

@Injectable()
export class NotificationsService {
  /** Canal en vivo: cada panel abierto escucha aquí y filtra lo suyo. */
  private readonly canal = new Subject<Notificacion>();

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  /**
   * Registra el aviso y lo empuja a los paneles conectados.
   * Sin `paraTutorId` el aviso es para la comisión; con él, para ese tutor.
   */
  async crear(datos: {
    tipo: TipoNotificacion;
    titulo: string;
    detalle: string;
    tutorId?: string;
    paraTutorId?: string;
  }): Promise<Notificacion | null> {
    try {
      const notificacion = await this.prisma.notificacion.create({ data: datos });
      this.canal.next(notificacion);

      // Solo la comisión recibe notificación del navegador.
      if (!notificacion.paraTutorId) void this.push.enviar(notificacion);

      return notificacion;
    } catch {
      // Un aviso nunca debe tumbar la acción que lo originó.
      return null;
    }
  }

  /** Solo llegan los avisos que le corresponden a quien escucha. */
  enVivo(tutorId?: string): Observable<Notificacion> {
    return this.canal
      .asObservable()
      .pipe(filter((n) => (tutorId ? n.paraTutorId === tutorId : n.paraTutorId === null)));
  }

  async listar(tutorId?: string) {
    const where = { paraTutorId: tutorId ?? null };

    const [notificaciones, sinLeer] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: MAXIMO_HISTORIAL,
      }),
      this.prisma.notificacion.count({ where: { ...where, leida: false } }),
    ]);
    return { notificaciones, sinLeer };
  }

  async marcarLeida(id: string, tutorId?: string) {
    await this.prisma.notificacion.updateMany({
      where: { id, paraTutorId: tutorId ?? null },
      data: { leida: true },
    });
    return this.listar(tutorId);
  }

  async marcarTodasLeidas(tutorId?: string) {
    await this.prisma.notificacion.updateMany({
      where: { paraTutorId: tutorId ?? null, leida: false },
      data: { leida: true },
    });
    return this.listar(tutorId);
  }
}
