import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupervisoresService } from './supervisores.service';
import { SistemaService } from './sistema.service';
import { AvisosService } from './avisos.service';
import { ReportesService } from './reportes.service';
import { InscripcionesService } from './inscripciones.service';
import { AdminController } from './admin.controller';

@Module({
  providers: [
    AdminService,
    SupervisoresService,
    SistemaService,
    AvisosService,
    ReportesService,
    InscripcionesService,
  ],
  controllers: [AdminController],
  exports: [InscripcionesService],
})
export class AdminModule {}
