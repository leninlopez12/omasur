import { Module } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { EtapasService } from './etapas.service';
import { CredentialsController } from './credentials.controller';
import { ResultadosModule } from '../resultados/resultados.module';

@Module({
  imports: [ResultadosModule],
  providers: [CredentialsService, EtapasService],
  controllers: [CredentialsController],
  exports: [EtapasService],
})
export class CredentialsModule {}
