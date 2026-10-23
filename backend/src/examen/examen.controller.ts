import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ConfigExamen, ExamenService } from './examen.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';

/** El Excel llega a memoria y se lee ahí mismo: no se guarda el archivo. */
const RECIBIR = FileInterceptor('archivo', {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

@Controller('examen')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamenController {
  constructor(private examen: ExamenService) {}

  // ------------------------------------------------------------------ tutor

  /** Si el envío está abierto y qué entregó ya esta delegación. */
  @Roles('TUTOR')
  @Get('estado')
  async estado(@CurrentUser() user: JwtUser) {
    const [config, entrega, habilitado] = await Promise.all([
      this.examen.config(),
      this.examen.entregaDe(user.sub),
      this.examen.habilitada(user.sub),
    ]);
    return {
      habilitado,
      // Para esta delegación el envío solo está abierto si además le toca
      // rendir: así una sola bandera decide el aviso y la sección entera.
      abierto: config.publicado && habilitado,
      puntajes: config.puntajes,
      entrega: entrega && {
        enviadoEn: entrega.enviadoEn,
        total: entrega.filas?.length || 0,
        porComision: Boolean(entrega.porComision),
      },
    };
  }

  @Roles('TUTOR')
  @Get('plantilla')
  async plantilla(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const { buffer, nombre } = await this.examen.plantilla(user.sub);
    this.enviarExcel(res, buffer, nombre);
  }

  @Roles('TUTOR')
  @Post('revisar')
  @UseInterceptors(RECIBIR)
  revisar(@CurrentUser() user: JwtUser, @UploadedFile() archivo: Express.Multer.File) {
    return this.examen.revisar(user.sub, archivo);
  }

  @Roles('TUTOR')
  @Post('enviar')
  @UseInterceptors(RECIBIR)
  enviar(@CurrentUser() user: JwtUser, @UploadedFile() archivo: Express.Multer.File) {
    return this.examen.registrar(user.sub, archivo);
  }

  // -------------------------------------------------------- comisión · tablero

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('config')
  config() {
    return this.examen.config();
  }

  @Roles('ADMIN')
  @Post('config')
  guardarConfig(@Body() body: Partial<ConfigExamen>) {
    return this.examen.guardarConfig(body);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('entregas')
  entregas() {
    return this.examen.entregas();
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('consultas')
  consultas() {
    return this.examen.consultas();
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('consultas/excel')
  async consultasExcel(@Res() res: Response) {
    const { buffer, nombre } = await this.examen.consultasExcel();
    this.enviarExcel(res, buffer, nombre);
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('consolidado')
  consolidado() {
    return this.examen.consolidado();
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('consolidado/excel')
  async consolidadoExcel(@Res() res: Response) {
    const { buffer, nombre } = await this.examen.consolidadoExcel();
    this.enviarExcel(res, buffer, nombre);
  }

  /** La plantilla de una delegación: para ensayar o para llenarla por ella. */
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('plantilla/:tutorId')
  async plantillaDe(@Param('tutorId') tutorId: string, @Res() res: Response) {
    const { buffer, nombre } = await this.examen.plantilla(tutorId);
    this.enviarExcel(res, buffer, nombre);
  }

  /**
   * La prueba antes de publicar: la comisión sube un Excel de una delegación y
   * ve cómo quedaría corregido, sin guardar nada ni habilitar a nadie.
   */
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('probar')
  @UseInterceptors(RECIBIR)
  probar(@Query('tutorId') tutorId: string, @UploadedFile() archivo: Express.Multer.File) {
    return this.examen.revisar(tutorId, archivo);
  }

  // ------------------------------------------- comisión · sobre una delegación

  /** La revisión previa del archivo que la comisión sube por una delegación. */
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('revisar/:tutorId')
  @UseInterceptors(RECIBIR)
  revisarDe(@Param('tutorId') tutorId: string, @UploadedFile() archivo: Express.Multer.File) {
    return this.examen.revisar(tutorId, archivo);
  }

  /** Llenar por la delegación que no pudo hacerlo sola. */
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('enviar/:tutorId')
  @UseInterceptors(RECIBIR)
  enviarPor(
    @Param('tutorId') tutorId: string,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() user: JwtUser,
  ) {
    return this.examen.registrar(tutorId, archivo, {
      nombre: user.nombre || 'Comisión',
      porComision: true,
    });
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get('entregas/:tutorId')
  entrega(@Param('tutorId') tutorId: string) {
    return this.examen.entregaCompleta(tutorId);
  }

  /** Lo que envió una delegación, en Excel. Con o sin clave y puntaje. */
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('entregas/:tutorId/excel')
  async entregaExcel(
    @Param('tutorId') tutorId: string,
    @Query('detalle') detalle: string,
    @Res() res: Response,
  ) {
    const { buffer, nombre } = await this.examen.respuestasExcel(tutorId, detalle !== 'simple');
    this.enviarExcel(res, buffer, nombre);
  }

  /** Anula el envío para que la delegación pueda volver a mandarlo. */
  @Roles('ADMIN')
  @Delete('entregas/:tutorId')
  anular(@Param('tutorId') tutorId: string) {
    return this.examen.anular(tutorId);
  }

  @Roles('ADMIN')
  @Patch('entregas/:tutorId/:dni')
  corregir(
    @Param('tutorId') tutorId: string,
    @Param('dni') dni: string,
    @Body() body: { respuestas: string[] },
  ) {
    return this.examen.corregirAlumno(tutorId, dni, body?.respuestas);
  }

  private enviarExcel(res: Response, buffer: Buffer, nombre: string) {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.end(buffer);
  }
}
