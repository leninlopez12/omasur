import { Module } from '@nestjs/common';
import { FinalService } from './final.service';
import { ExamenFinalService } from './examen-final.service';
import { ResultadosFinalService } from './resultados-final.service';
import { CredencialFinalService } from './credencial-final.service';
import { FinalController } from './final.controller';
import { ResultadosModule } from '../resultados/resultados.module';
import { CredentialsModule } from '../credentials/credentials.module';

// A la final llega quien clasificó en la institucional, así que el reparto de
// salones sale de los resultados de esa etapa. De credenciales se toman los
// textos de la etapa macrorregional, que la comisión ya edita en un solo sitio.
@Module({
  imports: [ResultadosModule, CredentialsModule],
  providers: [
    FinalService,
    ExamenFinalService,
    ResultadosFinalService,
    CredencialFinalService,
  ],
  controllers: [FinalController],
  exports: [FinalService, ExamenFinalService, ResultadosFinalService, CredencialFinalService],
})
export class FinalModule {}
