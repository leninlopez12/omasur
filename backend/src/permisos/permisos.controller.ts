import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermisoGuard } from './permiso.guard';
import { CurrentUser, JwtUser, Permiso, Roles } from '../common/decorators';

@Controller('permisos')
export class PermisosController {
  constructor(private permisos: PermisosService) {}

  /** Lo primero que pregunta el panel: con qué sidebar se arma. */
  @UseGuards(JwtAuthGuard)
  @Get('mios')
  mios(@CurrentUser() usuario: JwtUser) {
    return this.permisos.mios(usuario);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermisoGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Permiso('resultados-encargados')
  @Get('supervisores')
  supervisores() {
    return this.permisos.supervisores();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermisoGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Permiso('resultados-encargados')
  @Post('supervisores/:id')
  guardar(
    @Param('id') id: string,
    @Body() body: { permisos?: unknown },
    @CurrentUser() usuario: JwtUser,
  ) {
    return this.permisos.guardar(id, body?.permisos, usuario);
  }
}
