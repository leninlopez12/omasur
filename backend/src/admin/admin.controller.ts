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
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';
import { SupervisoresService } from './supervisores.service';
import { SistemaService } from './sistema.service';
import { AvisosService } from './avisos.service';
import { FiltrosReporte, ReportesService } from './reportes.service';
import { InscripcionesService } from './inscripciones.service';
import { AbonosService, FiltrosAbonos } from './abonos.service';
import { AlcanceConsolidado, ConsolidadoService } from './consolidado.service';
import { AccesoService } from './acceso.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERVISOR')
@Controller('admin')
export class AdminController {
  constructor(
    private admin: AdminService,
    private supervisores: SupervisoresService,
    private sistema: SistemaService,
    private avisos: AvisosService,
    private reportes: ReportesService,
    private tabla: InscripcionesService,
    private abonos: AbonosService,
    private consolidado: ConsolidadoService,
    private acceso: AccesoService,
  ) {}

  @Get('metricas')
  metricas() {
    return this.admin.metricas();
  }

  @Get('inscripciones')
  inscripciones(
    @Query('estado') estado?: string,
    @Query('region') region?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.admin.inscripciones({ estado, region, buscar });
  }

  @Get('tutores')
  tutores(@Query('estado') estado?: string, @Query('buscar') buscar?: string) {
    return this.admin.tutores({ estado, buscar });
  }

  @Get('estudiantes')
  estudiantes(
    @Query('estado') estado?: string,
    @Query('grado') grado?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.admin.estudiantes({ estado, grado, buscar });
  }

  @Get('inscripciones/:id')
  detalle(@Param('id') id: string) {
    return this.admin.detalle(id);
  }

  @Patch('inscripciones/:id/revisar')
  revisar(
    @Param('id') id: string,
    @Body() body: { estado: 'APROBADA' | 'OBSERVADA'; observacion?: string },
    @CurrentUser() usuario: JwtUser,
  ) {
    return this.admin.revisar(id, body.estado, body.observacion, usuario.nombre);
  }

  /** Aprobar o rechazar un comprobante suelto del historial de pagos. */
  @Patch('pagos/:id/revisar')
  revisarPago(
    @Param('id') id: string,
    @Body() body: { estado: 'APROBADO' | 'RECHAZADO'; observacion?: string },
    @CurrentUser() usuario: JwtUser,
  ) {
    return this.admin.revisarPago(id, body.estado, body.observacion, usuario.nombre);
  }

  @Get('exportar')
  async exportar(@Res() res: Response) {
    const buffer = await this.admin.exportarConsolidado();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="consolidado-omasur-2026.xlsx"');
    res.end(buffer);
  }

  // ------------------------------------------------------------------
  // Reportes con filtros. Los ve también el supervisor.
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Revisión alumno por alumno, para el supervisor.
  // ------------------------------------------------------------------

  @Get('revisar')
  paraRevisar(
    @Query('estado') estado?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.tabla.paraRevisar({ estado, nivel, grado, buscar });
  }

  // ------------------------------------------------------------------
  // Abonos: el dinero visto por delegación, no por estudiante.
  // ------------------------------------------------------------------

  @Get('abonos')
  resumenAbonos(@Query() filtros: FiltrosAbonos) {
    return this.abonos.resumen(filtros);
  }

  @Get('abonos/excel')
  async abonosExcel(@Query() filtros: FiltrosAbonos, @Res() res: Response) {
    const buffer = await this.abonos.excel(filtros);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="abonos-por-delegacion.xlsx"');
    res.end(buffer);
  }

  // ------------------------------------------------------------------
  // Consolidado para el día del examen: por categoría y por delegación.
  // ------------------------------------------------------------------

  @Get('consolidado')
  verConsolidado(@Query('alcance') alcance?: string, @Query('categoria') categoria?: string) {
    return this.consolidado.resumen(this.alcance(alcance), categoria);
  }

  @Get('consolidado/excel')
  async consolidadoExcel(
    @Query('alcance') alcance: string,
    @Query('categoria') categoria: string,
    @Res() res: Response,
  ) {
    const buffer = await this.consolidado.excel(this.alcance(alcance), categoria);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.consolidado.nombreArchivo(categoria)}"`,
    );
    res.end(buffer);
  }

  private alcance(valor?: string): AlcanceConsolidado {
    return valor === 'EN_PROCESO' ? 'EN_PROCESO' : 'APROBADOS';
  }

  @Get('reportes/opciones')
  opcionesReporte() {
    return this.reportes.opciones();
  }

  @Get('reportes')
  previsualizarReporte(@Query() filtros: FiltrosReporte) {
    return this.reportes.previsualizar(filtros);
  }

  @Get('reportes/excel')
  async reporteExcel(@Query() filtros: FiltrosReporte, @Res() res: Response) {
    const buffer = await this.reportes.excel(filtros);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.reportes.nombreArchivo(filtros)}"`,
    );
    res.end(buffer);
  }

  // ------------------------------------------------------------------
  // Cuentas de supervisor. Solo el administrador: el supervisor no puede
  // crearse compañeros ni darse permisos.
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Deshacer. Solo el administrador.
  // ------------------------------------------------------------------

  @Roles('ADMIN')
  @Patch('inscripciones/:id/reabrir')
  reabrir(@Param('id') id: string, @CurrentUser() usuario: JwtUser) {
    return this.admin.reabrir(id, usuario.nombre);
  }

  // ------------------------------------------------------------------
  // Estado del sistema, respaldo y corrección de datos. Solo administrador.
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // Entrar a la cuenta de un tutor. Solo el administrador.
  // ------------------------------------------------------------------

  @Roles('ADMIN')
  @Get('acceder')
  tutoresParaAcceder(@Query('buscar') buscar?: string) {
    return this.acceso.tutores(buscar);
  }

  @Roles('ADMIN')
  @Post('acceder/:tutorId')
  acceder(@Param('tutorId') tutorId: string, @CurrentUser() usuario: JwtUser) {
    return this.acceso.entrar(tutorId, usuario);
  }

  @Roles('ADMIN')
  @Get('estado')
  estado() {
    return this.sistema.estado();
  }

  @Roles('ADMIN')
  @Get('respaldo')
  async respaldo(@Res() res: Response) {
    const datos = await this.sistema.respaldo();
    const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="omasur-${marca}.json"`);
    res.end(JSON.stringify(datos, null, 2));
  }

  @Roles('ADMIN')
  @Patch('inscripciones/:id/datos')
  corregirTutor(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.sistema.corregirTutor(id, body || {});
  }

  @Roles('ADMIN')
  @Delete('inscripciones/:id')
  eliminarDelegacion(@Param('id') id: string, @Body() body: { confirmacion?: string }) {
    return this.admin.eliminarDelegacion(id, body?.confirmacion || '');
  }

  // ------------------------------------------------------------------
  // Avisos por correo a los tutores. Solo administrador.
  // ------------------------------------------------------------------

  @Roles('ADMIN')
  @Get('avisos/grupos')
  gruposAviso() {
    return this.avisos.grupos();
  }

  @Roles('ADMIN')
  @Get('avisos/destinatarios')
  destinatarios(@Query('grupo') grupo: string) {
    return this.avisos.destinatarios(grupo as any);
  }

  @Roles('ADMIN')
  @Get('avisos')
  historialAvisos() {
    return this.avisos.historial();
  }

  @Roles('ADMIN')
  @Post('avisos/prueba')
  probarAviso(@Body() body: { para?: string; asunto?: string; mensaje?: string }) {
    return this.avisos.prueba(body?.para || '', body?.asunto || '', body?.mensaje || '');
  }

  @Roles('ADMIN')
  @Post('avisos')
  enviarAviso(
    @Body() body: { grupo?: string; asunto?: string; mensaje?: string },
    @CurrentUser() usuario: JwtUser,
  ) {
    return this.avisos.enviar(
      body?.grupo as any,
      body?.asunto || '',
      body?.mensaje || '',
      usuario.nombre,
    );
  }

  @Roles('ADMIN')
  @Get('supervisores')
  listarSupervisores() {
    return this.supervisores.listar();
  }

  @Roles('ADMIN')
  @Post('supervisores')
  crearSupervisor(@Body() body: { nombre?: string; correo?: string; dni?: string }) {
    return this.supervisores.crear(body || {});
  }

  @Roles('ADMIN')
  @Post('supervisores/:id/clave')
  regenerarClave(@Param('id') id: string) {
    return this.supervisores.regenerarClave(id);
  }

  @Roles('ADMIN')
  @Delete('supervisores/:id')
  eliminarSupervisor(@Param('id') id: string, @CurrentUser() usuario: JwtUser) {
    return this.supervisores.eliminar(id, usuario.sub);
  }
}
