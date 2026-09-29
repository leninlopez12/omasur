import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';

/** Latido que mantiene viva la conexión a través de proxies. */
const LATIDO_MS = 25000;

/**
 * Misma API para los dos lados: la comisión ve los avisos de la comisión y el
 * tutor ve solo los suyos. Quién es se deduce del token, no del cliente.
 */
@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificationsController {
  constructor(
    private notificaciones: NotificationsService,
    private push: PushService,
  ) {}

  @Get()
  listar(@CurrentUser() user: JwtUser) {
    return this.notificaciones.listar(this.destinatario(user));
  }

  /** Clave pública para que el navegador de la comisión pueda suscribirse. */
  @Roles('ADMIN', 'SUPERVISOR')
  @UseGuards(RolesGuard)
  @Get('push/clave')
  clavePush() {
    return { clave: this.push.clavePublica };
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @UseGuards(RolesGuard)
  @Post('push/suscribir')
  suscribir(@CurrentUser() user: JwtUser, @Body() suscripcion: any) {
    if (!suscripcion?.endpoint || !suscripcion?.keys?.p256dh || !suscripcion?.keys?.auth) {
      throw new BadRequestException('Suscripción incompleta');
    }
    return this.push.suscribir(user.sub, suscripcion);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @UseGuards(RolesGuard)
  @Post('push/desuscribir')
  desuscribir(@Body() body: { endpoint?: string }) {
    if (!body?.endpoint) throw new BadRequestException('Falta el endpoint');
    return this.push.desuscribir(body.endpoint);
  }

  @Patch(':id/leer')
  marcarLeida(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notificaciones.marcarLeida(id, this.destinatario(user));
  }

  @Post('leer-todas')
  marcarTodasLeidas(@CurrentUser() user: JwtUser) {
    return this.notificaciones.marcarTodasLeidas(this.destinatario(user));
  }

  /** Flujo en tiempo real de avisos nuevos. */
  @Sse('stream')
  stream(@CurrentUser() user: JwtUser): Observable<MessageEvent> {
    const avisos = this.notificaciones
      .enVivo(this.destinatario(user))
      .pipe(map((n) => ({ data: { evento: 'notificacion', notificacion: n } }) as MessageEvent));

    const latidos = interval(LATIDO_MS).pipe(
      map(() => ({ data: { evento: 'latido' } }) as MessageEvent),
    );

    return merge(avisos, latidos);
  }

  private destinatario(user: JwtUser) {
    return user.rol === 'TUTOR' ? user.sub : undefined;
  }
}
