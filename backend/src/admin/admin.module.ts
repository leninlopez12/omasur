import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupervisoresService } from './supervisores.service';
import { SistemaService } from './sistema.service';
import { AvisosService } from './avisos.service';
import { ReportesService } from './reportes.service';
import { InscripcionesService } from './inscripciones.service';
import { AbonosService } from './abonos.service';
import { ConsolidadoService } from './consolidado.service';
import { AdminController } from './admin.controller';

@Module({
  providers: [
    AdminService,
    SupervisoresService,
    SistemaService,
    AvisosService,
    ReportesService,
    InscripcionesService,
    AbonosService,
    ConsolidadoService,
  ],
  controllers: [AdminController],
  exports: [InscripcionesService],
})
export class AdminModule {}
