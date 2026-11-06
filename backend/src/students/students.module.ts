import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { ExamenModule } from '../examen/examen.module';
import { ResultadosModule } from '../resultados/resultados.module';

// Corregir el DNI de un alumno obliga a tocar su examen ya entregado y las
// llaves de resultados, que lo llevan dentro: por eso los dos módulos.
@Module({
  imports: [ExamenModule, ResultadosModule],
  providers: [StudentsService],
  controllers: [StudentsController],
  exports: [StudentsService],
})
export class StudentsModule {}
