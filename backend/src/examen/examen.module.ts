import { Module } from '@nestjs/common';
import { ExamenService } from './examen.service';
import { ExamenController } from './examen.controller';

@Module({
  providers: [ExamenService],
  controllers: [ExamenController],
})
export class ExamenModule {}
