import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ArchivoAdministrado, Comunicado, SettingsService, TipoImagen } from './settings.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';

/**
 * Todo lo que sube la comisión pasa por memoria y de ahí a Cloudflare: nada
 * queda en el disco del servidor, que en producción se pierde en cada
 * despliegue.
 */
function recibir(formato: 'imagen' | 'pdf') {
  const valido = formato === 'pdf' ? /\.pdf$/i : /\.(jpg|jpeg|png|webp)$/i;
  const aviso =
    formato === 'pdf'
      ? 'Las bases deben ser un archivo PDF'
      : 'Solo se aceptan imágenes JPG, PNG o WEBP';

  return FileInterceptor('archivo', {
    storage: memoryStorage(),
    limits: { fileSize: (formato === 'pdf' ? 20 : 8) * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!valido.test(file.originalname)) return cb(new BadRequestException(aviso), false);
      cb(null, true);
    },
  });
}

@Controller('ajustes')
export class SettingsController {
  constructor(
    private settings: SettingsService,
    private almacenamiento: StorageService,
  ) {}

  /** Público: lo consume la portada y el paso de pago. */
  @Get()
  publicos() {
    return this.settings.publicos();
  }

  // --------------------------------------------------------------------
  // Fondos de la portada y del ingreso
  // --------------------------------------------------------------------

  @Get('imagenes/:tipo')
  verImagen(@Param('tipo') tipo: string, @Res({ passthrough: false }) res: Response) {
    return this.entregar(this.validarTipo(tipo), res);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('imagenes/:tipo')
  @UseInterceptors(recibir('imagen'))
  guardarImagen(@Param('tipo') tipo: string, @UploadedFile() archivo: Express.Multer.File) {
    return this.settings.guardarArchivo(this.validarTipo(tipo), archivo);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('imagenes/:tipo')
  quitarImagen(@Param('tipo') tipo: string) {
    return this.settings.quitarArchivo(this.validarTipo(tipo));
  }

  private validarTipo(tipo: string): TipoImagen {
    if (tipo !== 'hero' && tipo !== 'login') {
      throw new BadRequestException('Imagen no reconocida');
    }
    return tipo;
  }

  // --------------------------------------------------------------------
  // QR de Yape
  // --------------------------------------------------------------------

  @Get('yape')
  verYape(@Res({ passthrough: false }) res: Response) {
    return this.entregar('yape', res);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('yape')
  @UseInterceptors(recibir('imagen'))
  guardarYape(@UploadedFile() archivo: Express.Multer.File) {
    return this.settings.guardarArchivo('yape', archivo);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Delete('yape')
  quitarYape() {
    return this.settings.quitarArchivo('yape');
  }

  // --------------------------------------------------------------------
  // Comunicado de la portada
  // --------------------------------------------------------------------

  /** El comunicado completo, publicado o no: para editarlo. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('comunicado')
  verComunicado() {
    return this.settings.comunicado();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('comunicado')
  guardarComunicado(@Body() body: Partial<Comunicado>) {
    return this.settings.guardarComunicado(body);
  }

  // --------------------------------------------------------------------
  // Logo de la credencial
  // --------------------------------------------------------------------

  @Get('credencial')
  verLogoCredencial(@Res({ passthrough: false }) res: Response) {
    return this.entregar('credencial', res);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('credencial')
  @UseInterceptors(recibir('imagen'))
  guardarLogoCredencial(@UploadedFile() archivo: Express.Multer.File) {
    return this.settings.guardarArchivo('credencial', archivo);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Delete('credencial')
  quitarLogoCredencial() {
    return this.settings.quitarArchivo('credencial');
  }

  /** Titular y número de la cuenta, lo que acompaña al QR en el paso de pago. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('yape/datos')
  guardarDatosYape(@Body() body: { numero?: string; titular?: string }) {
    return this.settings.guardarYape(body);
  }

  // --------------------------------------------------------------------
  // Bases del concurso
  // --------------------------------------------------------------------

  @Get('bases')
  verBases(@Res({ passthrough: false }) res: Response) {
    return this.entregar('bases', res);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('bases')
  @UseInterceptors(recibir('pdf'))
  guardarBases(@UploadedFile() archivo: Express.Multer.File) {
    return this.settings.guardarArchivo('bases', archivo);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('bases')
  quitarBases() {
    return this.settings.quitarArchivo('bases');
  }

  /**
   * Entrega el archivo desde aquí en vez de abrir el bucket: la dirección no
   * cambia al reemplazarlo y nadie ve la clave interna de Cloudflare, que está
   * en el mismo bucket que los comprobantes.
   */
  private async entregar(tipo: ArchivoAdministrado, res: Response) {
    const datos = await this.settings.referenciaArchivo(tipo);
    if (!datos) throw new NotFoundException('Archivo no publicado');

    const archivo = await this.almacenamiento.leer(datos.referencia);
    if (!archivo) throw new NotFoundException('Archivo no publicado');

    res.setHeader('Content-Type', datos.mime || archivo.tipo);
    if (datos.formato === 'pdf') {
      res.setHeader('Content-Disposition', `inline; filename="${datos.nombre}"`);
    }
    // Corto: la dirección es siempre la misma, y aunque lleva ?v= al cambiar,
    // un enlace viejo no debe quedarse con el archivo anterior para siempre.
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (archivo.tamano) res.setHeader('Content-Length', String(archivo.tamano));

    archivo.cuerpo.on('error', () => res.destroy());
    archivo.cuerpo.pipe(res);
  }

  // --------------------------------------------------------------------
  // Resto de ajustes
  // --------------------------------------------------------------------

  /** Culminar o reabrir el periodo de inscripciones. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('inscripciones')
  cambiarCierre(@Body() body: { cerradas?: boolean }) {
    return this.settings.cambiarCierre(Boolean(body?.cerradas));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('grupos')
  crearGrupo(@Body() body: { nombre: string; enlace?: string }) {
    if (!body?.nombre?.trim()) throw new BadRequestException('Escriba el nombre del grupo');
    return this.settings.crearGrupo(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Patch('grupos/:id')
  actualizarGrupo(
    @Param('id') id: string,
    @Body() body: { nombre?: string; enlace?: string; lleno?: boolean },
  ) {
    return this.settings.actualizarGrupo(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Delete('grupos/:id')
  eliminarGrupo(@Param('id') id: string) {
    return this.settings.eliminarGrupo(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('bcp')
  guardarBcp(@Body() body: { titular?: string; cuenta?: string; cci?: string }) {
    return this.settings.guardarBcp(body);
  }

  /** Botón flotante de WhatsApp de la portada: a qué número y con qué texto. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('whatsapp')
  guardarWhatsapp(@Body() body: { numero?: string; mensaje?: string }) {
    return this.settings.guardarWhatsapp(body);
  }
}
