import { Module } from '@nestjs/common';
import { ResultadosService } from './resultados.service';
import { ResultadosController } from './resultados.controller';
import { EncargadoGuard } from './encargado.guard';
import { ExamenModule } from '../examen/examen.module';

@Module({
  imports: [ExamenModule],
  providers: [ResultadosService, EncargadoGuard],
  controllers: [ResultadosController],
})
export class ResultadosModule {}
