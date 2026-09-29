import { Module } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { TutorsController } from './tutors.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  // La tabla de «Inscripciones» la arma el mismo servicio que usa el
  // supervisor: el estado de un alumno tiene que ser uno solo.
  imports: [AdminModule],
  providers: [TutorsService],
  controllers: [TutorsController],
  exports: [TutorsService],
})
export class TutorsModule {}
