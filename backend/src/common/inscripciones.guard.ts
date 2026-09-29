import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Bloquea las acciones de inscripción cuando la comisión ya culminó el periodo.
 * Solo se aplica a lo que hace el tutor; la comisión sigue revisando normalmente.
 */
@Injectable()
export class InscripcionesAbiertasGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(): Promise<boolean> {
    const ajuste = await this.prisma.ajuste.findUnique({
      where: { clave: 'inscripciones_cerradas' },
    });

    if (ajuste?.valor === 'true') {
      throw new ForbiddenException(
        'Las inscripciones para el I OMASUR UNI 2026 ya fueron culminadas.',
      );
    }
    return true;
  }
}
