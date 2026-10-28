import { Global, Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { PermisoGuard } from './permiso.guard';

/**
 * Global a propósito: el guardia de permisos está puesto en toda la aplicación
 * y cualquier controlador puede marcar una ruta sin importar este módulo.
 */
@Global()
@Module({
  providers: [PermisosService, PermisoGuard],
  controllers: [PermisosController],
  exports: [PermisosService],
})
export class PermisosModule {}
