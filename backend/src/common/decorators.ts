import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type Rol = 'TUTOR' | 'ADMIN' | 'SUPERVISOR';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

export interface JwtUser {
  sub: string;
  correo: string;
  rol: Rol;
  nombre: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUser => {
  return ctx.switchToHttp().getRequest().user;
});
