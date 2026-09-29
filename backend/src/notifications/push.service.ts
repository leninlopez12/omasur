import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Notificacion } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

/** Avisos que el navegador debe mantener en pantalla hasta que los atiendan. */
const EXIGEN_ACCION = ['INSCRIPCION_ENVIADA', 'OBSERVACION_ABSUELTA'];

/**
 * Notificaciones del sistema operativo para la comisión: llegan aunque el
 * supervisor haya cerrado la página, mientras el navegador siga abierto.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly log = new Logger('Push');
  private activo = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const publica = process.env.VAPID_PUBLIC_KEY;
    const privada = process.env.VAPID_PRIVATE_KEY;

    if (!publica || !privada) {
      this.log.warn('Sin claves VAPID: las notificaciones del navegador quedan desactivadas.');
      return;
    }

    webpush.setVapidDetails(
      process.env.VAPID_CONTACTO || 'mailto:admin@ipeh.edu.pe',
      publica,
      privada,
    );
    this.activo = true;
  }

  get clavePublica(): string | null {
    return this.activo ? process.env.VAPID_PUBLIC_KEY : null;
  }

  async suscribir(adminId: string, suscripcion: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    const datos = {
      endpoint: suscripcion.endpoint,
      p256dh: suscripcion.keys.p256dh,
      auth: suscripcion.keys.auth,
      adminId,
    };

    await this.prisma.suscripcionPush.upsert({
      where: { endpoint: suscripcion.endpoint },
      create: datos,
      update: datos,
    });

    return { ok: true };
  }

  async desuscribir(endpoint: string) {
    await this.prisma.suscripcionPush.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  /** Envía el aviso a todos los dispositivos registrados de la comisión. */
  async enviar(notificacion: Notificacion) {
    if (!this.activo) return;

    const suscripciones = await this.prisma.suscripcionPush.findMany();
    if (suscripciones.length === 0) return;

    const carga = JSON.stringify({
      id: notificacion.id,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      detalle: notificacion.detalle,
      tutorId: notificacion.tutorId,
      exigeAccion: EXIGEN_ACCION.includes(notificacion.tipo),
    });

    await Promise.all(
      suscripciones.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            carga,
          );
        } catch (error: any) {
          // 404/410: el navegador ya no existe o revocó el permiso.
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await this.prisma.suscripcionPush.deleteMany({ where: { endpoint: s.endpoint } });
          } else {
            this.log.warn(`No se pudo enviar el aviso: ${error?.message ?? error}`);
          }
        }
      }),
    );
  }
}
