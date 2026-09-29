import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';
import { InscripcionesAbiertasGuard } from '../common/inscripciones.guard';

const FORMATOS = /\.(jpg|jpeg|png|webp|pdf)$/i;

/** En memoria: el servicio de almacenamiento decide si va a R2 o a disco. */
const OPCIONES_ARCHIVO = {
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    if (!FORMATOS.test(file.originalname)) {
      return cb(new BadRequestException('Solo se aceptan imágenes JPG, PNG, WEBP o PDF'), false);
    }
    cb(null, true);
  },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pagos')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Roles('TUTOR')
  @Get()
  listar(@CurrentUser() user: JwtUser) {
    return this.payments.listar(user.sub);
  }

  /** El comprobante se sirve desde aquí, ya sea que viva en R2 o en disco. */
  @Roles('TUTOR', 'ADMIN', 'SUPERVISOR')
  @Get(':id/archivo')
  async archivo(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { cuerpo, tipo, tamano } = await this.payments.archivo(id, user);

    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (tamano) res.setHeader('Content-Length', String(tamano));

    cuerpo.on('error', () => res.destroy());
    cuerpo.pipe(res);
  }

  @Roles('TUTOR')
  @UseGuards(InscripcionesAbiertasGuard)
  @Post()
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_ARCHIVO))
  registrar(
    @CurrentUser() user: JwtUser,
    @UploadedFile() archivo: Express.Multer.File,
    @Body() body: { metodo?: string; alumnos?: string },
  ) {
    return this.payments.registrar(user.sub, archivo, body);
  }

  /** Cambiar la foto de un comprobante ya enviado. */
  @Roles('TUTOR')
  @UseGuards(InscripcionesAbiertasGuard)
  @Put(':id/archivo')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_ARCHIVO))
  reemplazar(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File,
  ) {
    return this.payments.reemplazarArchivo(user.sub, id, archivo);
  }

  /** Anular un comprobante: sus estudiantes vuelven a quedar pendientes. */
  @Roles('TUTOR')
  @UseGuards(InscripcionesAbiertasGuard)
  @Delete(':id')
  anular(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.payments.anular(user.sub, id);
  }
}
