import { Module } from '@nestjs/common';
import { ResultadosService } from './resultados.service';
import { ResultadosController } from './resultados.controller';
import { ExamenModule } from '../examen/examen.module';

@Module({
  imports: [ExamenModule],
  providers: [ResultadosService],
  controllers: [ResultadosController],
  exports: [ResultadosService],
})
export class ResultadosModule {}
