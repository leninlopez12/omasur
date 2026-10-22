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
  // Credenciales que baja la comisión para enviárselas al tutor.
  // ------------------------------------------------------------------

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('delegaciones')
  delegaciones() {
    return this.credentials.delegacionesAprobadas();
  }

  /** Todos los alumnos aprobados de una delegación, en un PDF. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('delegaciones/:tutorId')
  async credencialesDeDelegacion(
    @Param('tutorId') tutorId: string,
    @Query('etapa') etapa: string,
    @Res() res: Response,
  ) {
    const pdf = await this.credentials.credencialesDelTutor(tutorId, { etapa });
    this.enviar(res, pdf, `credenciales-delegacion-${tutorId}.pdf`);
  }

  /** La credencial de un tutor, o la de todos en un solo PDF. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('tutores')
  async credencialesDeTutores(@Query('etapa') etapa: string, @Res() res: Response) {
    const pdf = await this.credentials.credencialesDeTutores(null, etapa);
    this.enviar(res, pdf, 'credenciales-de-tutores.pdf');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('tutores/:tutorId')
  async credencialDeTutor(
    @Param('tutorId') tutorId: string,
    @Query('etapa') etapa: string,
    @Res() res: Response,
  ) {
    const pdf = await this.credentials.credencialesDeTutores([tutorId], etapa);
    this.enviar(res, pdf, `credencial-tutor-${tutorId}.pdf`);
  }

  /** La suya propia, desde el panel del tutor. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('mi-credencial')
  async miCredencial(
    @CurrentUser() user: JwtUser,
    @Query('etapa') etapa: string,
    @Res() res: Response,
  ) {
    const pdf = await this.credentials.credencialDelTutorMismo(user.sub, etapa);
    this.enviar(res, pdf, 'mi-credencial.pdf');
  }

  private enviar(res: Response, pdf: Buffer, nombre: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
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
