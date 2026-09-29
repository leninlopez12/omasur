import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CredentialsService } from './credentials.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';

@Controller('credenciales')
export class CredentialsController {
  constructor(private credentials: CredentialsService) {}

  @Get('consulta/:dni')
  consulta(@Param('dni') dni: string) {
    return this.credentials.consultarPorDni(dni);
  }

  @Get('dni/:dni')
  async porDni(@Param('dni') dni: string, @Res() res: Response) {
    const pdf = await this.credentials.credencialPorDni(dni);
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
    @Res() res: Response,
  ) {
    const pdf = await this.credentials.credencialesDelTutor(user.sub, { nivel, grado });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="credenciales-omasur-2026.pdf"');
    res.end(pdf);
  }
}
