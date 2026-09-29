import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

/** Solo letras, números y guiones: nunca una ruta. */
const NOMBRE_VALIDO = /^[a-z0-9_-]{1,40}\.(png|webp|jpg|jpeg|svg)$/i;

const CARPETA = 'publico/iconos/';

/**
 * Imágenes públicas guardadas en Cloudflare: los iconos 3D de la portada.
 *
 * Va sin sesión porque la portada la ve cualquiera, pero el nombre se valida
 * con una expresión estricta para que nadie pueda salirse de esta carpeta y
 * llegar a los comprobantes, que están en el mismo bucket.
 */
@Controller('publico')
export class PublicoController {
  constructor(private almacenamiento: StorageService) {}

  @Get('iconos/:nombre')
  async icono(@Param('nombre') nombre: string, @Res({ passthrough: false }) res: Response) {
    if (!NOMBRE_VALIDO.test(nombre)) throw new NotFoundException('Imagen no encontrada');

    const archivo = await this.almacenamiento.leer('r2:' + CARPETA + nombre);
    if (!archivo) throw new NotFoundException('Imagen no encontrada');

    res.setHeader('Content-Type', archivo.tipo);
    // Son fijas: el navegador puede guardarlas y no volver a pedirlas.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (archivo.tamano) res.setHeader('Content-Length', String(archivo.tamano));

    archivo.cuerpo.on('error', () => res.destroy());
    archivo.cuerpo.pipe(res);
  }
}
