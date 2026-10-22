import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { SupervisoresService } from './supervisores.service';
import { SistemaService } from './sistema.service';
import { AvisosService } from './avisos.service';
import { ReportesService } from './reportes.service';
import { InscripcionesService } from './inscripciones.service';
import { AbonosService } from './abonos.service';
import { ConsolidadoService } from './consolidado.service';
import { AccesoService } from './acceso.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule],
  providers: [
    AdminService,
    SupervisoresService,
    SistemaService,
    AvisosService,
    ReportesService,
    InscripcionesService,
    AbonosService,
    ConsolidadoService,
    AccesoService,
  ],
  controllers: [AdminController],
  exports: [InscripcionesService],
})
export class AdminModule {}
