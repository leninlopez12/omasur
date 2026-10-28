import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermisosService } from './permisos.service';
import { JwtUser, PERMISO_KEY } from '../common/decorators';

/**
 * El guardia de los permisos por módulo.
 *
 * Está puesto en toda la aplicación pero no estorba: una ruta sin `@Permiso`
 * pasa de largo. Las que lo llevan solo frenan a los supervisores, que son los
 * únicos que tienen permisos repartidos; el administrador pasa siempre.
 */
@Injectable()
export class PermisoGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permisos: PermisosService,
  ) {}

  async canActivate(contexto: ExecutionContext) {
    const requeridos = this.reflector.getAllAndOverride<string[]>(PERMISO_KEY, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!requeridos?.length) return true;

    const usuario: JwtUser | undefined = contexto.switchToHttp().getRequest().user;
    if (!usuario) throw new ForbiddenException('No tiene permisos para esta acción');
    if (usuario.rol !== 'SUPERVISOR') return true;

    if (!(await this.permisos.tiene(usuario, requeridos))) {
      throw new ForbiddenException('Esta sección no está entre sus permisos.');
    }

    return true;
  }
}
