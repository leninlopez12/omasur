import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type Rol = 'TUTOR' | 'ADMIN' | 'SUPERVISOR';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

export interface JwtUser {
  sub: string;
  correo: string;
  rol: Rol;
  nombre: string;
  /**
   * Cuando el administrador entra a la cuenta de un tutor, el token sale a su
   * nombre pero marcado: así se sabe, en el servidor y en pantalla, que quien
   * está actuando es la comisión y no el tutor.
   */
  actuandoComo?: boolean;
  suplantadoPor?: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUser => {
  return ctx.switchToHttp().getRequest().user;
});
