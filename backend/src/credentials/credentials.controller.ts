import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CredentialsService } from './credentials.service';
import { Etapa, EtapasService } from './etapas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';

@Controller('credenciales')
export class CredentialsController {
  constructor(
    private credentials: CredentialsService,
    private etapas: EtapasService,
  ) {}

  /** Las etapas que ya se pueden descargar. La usan el tutor y la portada. */
  @Get('etapas')
  publicadas() {
    return this.etapas.publicadas();
  }

  // ------------------------------------------------------------------
  // Edición de las credenciales. Comisión.
  // ------------------------------------------------------------------

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('etapas/todas')
  todas() {
    return this.etapas.todas();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Post('etapas/:clave')
  guardar(@Param('clave') clave: string, @Body() body: Partial<Etapa>) {
    if (!this.etapas.esClave(clave)) {
      return { error: 'Etapa desconocida' };
    }
    return this.etapas.guardar(clave, body);
  }

  /** Una credencial de muestra, para ver cómo quedó el PDF antes de publicar. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('etapas/:clave/muestra')
  async muestra(@Param('clave') clave: string, @Res() res: Response) {
    const pdf = await this.credentials.muestra(clave);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="credencial-de-muestra.pdf"');
    res.end(pdf);
  }

  // ------------------------------------------------------------------

  @Get('consulta/:dni')
  consulta(@Param('dni') dni: string) {
    return this.credentials.consultarPorDni(dni);
  }

  @Get('dni/:dni')
  async porDni(@Param('dni') dni: string, @Query('etapa') etapa: string, @Res() res: Response) {
    const pdf = await this.credentials.credencialPorDni(dni, etapa);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="credencial-' + dni + '.pdf"');
    res.end(pdf);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('delegacion')
  async delegacion(
    @CurrentUser() user: JwtUser,
    @Query('nivel') nivel: string,
    @Query('grado') grado: string,
    @Query('etapa') etapa: string,
    @Res() res: Response,
  ) {
    const pdf = await this.credentials.credencialesDelTutor(user.sub, { nivel, grado, etapa });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="credenciales-omasur-2026.pdf"');
    res.end(pdf);
  }
}
