import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { DatosInstitucionDto } from './dto';
import { AbsolverDto } from './dto-absolver';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';
import { InscripcionesAbiertasGuard } from '../common/inscripciones.guard';
import { InscripcionesService } from '../admin/inscripciones.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TUTOR')
@Controller('tutores')
export class TutorsController {
  constructor(
    private tutors: TutorsService,
    private tabla: InscripcionesService,
  ) {}

  /** Tabla de «Inscripciones»: un alumno por fila, con su estado real. */
  @Get('inscripciones')
  inscripciones(@CurrentUser() user: JwtUser) {
    return this.tabla.delTutor(user.sub);
  }

  @Get('resumen')
  resumen(@CurrentUser() user: JwtUser) {
    return this.tutors.resumen(user.sub);
  }

  @UseGuards(InscripcionesAbiertasGuard)
  @Patch('datos')
  actualizar(@CurrentUser() user: JwtUser, @Body() datos: DatosInstitucionDto) {
    return this.tutors.actualizarDatos(user.sub, datos);
  }

  @UseGuards(InscripcionesAbiertasGuard)
  @Post('enviar')
  enviar(@CurrentUser() user: JwtUser) {
    return this.tutors.enviarInscripcion(user.sub);
  }

  @UseGuards(InscripcionesAbiertasGuard)
  @Post('absolver')
  absolver(@CurrentUser() user: JwtUser, @Body() dto: AbsolverDto) {
    return this.tutors.absolverObservacion(user.sub, dto.respuesta);
  }
}
