import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { StudentsService } from './students.service';
import { ActualizarAlumnoDto, CrearAlumnoDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';
import { GRADOS } from '../common/grados';
import { InscripcionesAbiertasGuard } from '../common/inscripciones.guard';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('alumnos')
export class StudentsController {
  constructor(private students: StudentsService) {}

  @Get('grados')
  grados() {
    return GRADOS;
  }

  // Con sesión: la plantilla sale con los grados del nivel que declaró la
  // institución, así el tutor no llena filas que el servidor va a rechazar.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('plantilla')
  async plantilla(@CurrentUser() usuario: JwtUser, @Res() res: Response) {
    const buffer = await this.students.plantilla(usuario.sub);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-omasur-2026.xlsx"');
    res.end(buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get()
  listar(@CurrentUser() user: JwtUser) {
    return this.students.listar(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, InscripcionesAbiertasGuard)
  @Roles('TUTOR')
  @Post()
  crear(@CurrentUser() user: JwtUser, @Body() dto: CrearAlumnoDto) {
    return this.students.crear(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, InscripcionesAbiertasGuard)
  @Roles('TUTOR')
  @Patch(':id')
  actualizar(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ActualizarAlumnoDto,
  ) {
    return this.students.actualizar(user.sub, id, dto.nombres, dto.grado);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, InscripcionesAbiertasGuard)
  @Roles('TUTOR')
  @Delete(':id')
  eliminar(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.students.eliminar(user.sub, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, InscripcionesAbiertasGuard)
  @Roles('TUTOR')
  @Post('importar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  importar(@CurrentUser() user: JwtUser, @UploadedFile() archivo: Express.Multer.File) {
    return this.students.importarExcel(user.sub, archivo);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('exportar')
  async exportar(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const buffer = await this.students.exportarDelegacion(user.sub);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="delegacion-omasur-2026.xlsx"');
    res.end(buffer);
  }
}
