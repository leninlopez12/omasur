import {
  applyDecorators,
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
import { Ola, ResultadosService } from './resultados.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermisoGuard } from '../permisos/permiso.guard';
import { CurrentUser, JwtUser, Permiso, Roles } from '../common/decorators';

/** Cada pantalla trabaja una tanda; sin `ola` se ven las dos juntas. */
function tanda(valor?: string): Ola | undefined {
  return valor === 'tutores' || valor === 'comision' ? valor : undefined;
}

/**
 * Resultados no es de todo el equipo.
 *
 * El administrador entra siempre. De los supervisores, cada uno llega hasta
 * donde le dieron permiso: por eso cada ruta dice de qué pantalla es, y las
 * que sirven a varias listan todas —basta tener una.
 */
const Comision = (...permisos: string[]) =>
  applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, PermisoGuard),
    Roles('ADMIN', 'SUPERVISOR'),
    Permiso(...permisos),
  );

/** Las dos pantallas por tanda y las dos de lectura miran la misma tabla. */
const LECTURA = [
  'resultados-tutores',
  'resultados-comision',
  'resultados-general',
  'resultados-consultar',
];

@Controller('resultados')
export class ResultadosController {
  constructor(private resultados: ResultadosService) {}

  // ------------------------------------------------------------------ público

  /** Lo lee la página pública: si está abierta y con qué título. */
  @Get('publico')
  estadoPublico() {
    return this.resultados.estadoPublico();
  }

  @Get('consulta')
  consulta(@Query('dni') dni: string) {
    return this.resultados.consultar(dni);
  }

  // --------------------------------------------------------------------- tutor

  /** Lo que ve el tutor en su cuenta: sus estudiantes y sus puntajes. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('mi-clasificacion')
  miClasificacion(@CurrentUser() user: JwtUser) {
    return this.resultados.miClasificacion(user.sub);
  }

  // ------------------------- el resto: el admin y el supervisor a cargo

  @Comision(...LECTURA)
  @Get()
  tabla(@Query('ola') ola?: string) {
    return this.resultados.porDelegacion(tanda(ola));
  }

  @Comision('resultados-general')
  @Get('general')
  general() {
    return this.resultados.general();
  }

  /** De las dos tandas: los sueltos se trabajan en un solo lugar. */
  @Comision('resultados-comision')
  @Get('individuales')
  individuales() {
    return this.resultados.individuales();
  }

  @Comision('resultados-tutores', 'resultados-comision')
  @Get('empates')
  empates(@Query('ola') ola?: string) {
    return this.resultados.empates(tanda(ola));
  }

  @Comision('resultados-tutores', 'resultados-comision', 'resultados-decidir')
  @Post('decidir')
  decidir(
    @Body() body: { clave: string; estado: 'CLASIFICA' | 'NO_CLASIFICA' | null },
    @Query('ola') ola?: string,
  ) {
    return this.resultados.decidir(body?.clave, body?.estado ?? null, tanda(ola));
  }

  @Comision('resultados-tutores', 'resultados-comision')
  @Post('porcentaje')
  porcentaje(@Body() body: { porcentaje: number }, @Query('ola') ola?: string) {
    return this.resultados.cambiarPorcentaje(body?.porcentaje, tanda(ola));
  }

  // -------------------------------------------------------------- agrupaciones

  @Comision('resultados-comision')
  @Post('agrupaciones')
  crear(@Body() body: { nombre?: string; delegacionId?: string | null }) {
    return this.resultados.crearAgrupacion(body || {});
  }

  @Comision('resultados-comision')
  @Patch('agrupaciones/:id')
  cambiar(
    @Param('id') id: string,
    @Body() body: { nombre?: string; miembros?: string[] },
    @Query('ola') ola?: string,
  ) {
    return this.resultados.cambiarAgrupacion(id, body || {}, tanda(ola));
  }

  @Comision('resultados-comision')
  @Delete('agrupaciones/:id')
  borrar(@Param('id') id: string, @Query('ola') ola?: string) {
    return this.resultados.borrarAgrupacion(id, tanda(ola));
  }

  // --------------------------------------------------------------- publicación

  @Comision('resultados-tutores', 'resultados-comision')
  @Post('publicar')
  publicar(@Body() body: { ola: Ola; publicado: boolean }) {
    return this.resultados.publicar(body?.ola, Boolean(body?.publicado));
  }

  @Comision('resultados-general')
  @Post('publicar/general')
  publicarGeneral(@Body() body: { publicado: boolean }) {
    return this.resultados.publicarGeneral(Boolean(body?.publicado));
  }

  // ------------------------------------------------------------ consultar

  /** Buscar por institución, tutor, nombre o DNI. */
  @Comision('resultados-consultar')
  @Get('buscar')
  buscar(@Query('q') q: string) {
    return this.resultados.buscar(q);
  }

  /** El Excel de una delegación, para mandárselo a su tutor. */
  @Comision('resultados-consultar')
  @Get('delegacion/:tutorId/excel')
  async excelDelegacion(@Param('tutorId') tutorId: string, @Res() res: Response) {
    const { buffer, nombre } = await this.resultados.excelDelegacion(tutorId);
    this.enviarExcel(res, buffer, nombre);
  }

  /** Buscar estudiantes de las dos tandas para decidirlos a mano. */
  @Comision('resultados-decidir')
  @Get('alumnos')
  alumnos(@Query('q') q: string) {
    return this.resultados.buscarAlumnos(q);
  }

  // ------------------------------------------------------- la consulta pública

  /** El título de la página pública y el interruptor de la consulta. */
  @Comision('resultados-publica')
  @Post('ajustes')
  ajustes(@Body() body: { tituloPublico?: string; consultaActiva?: boolean }) {
    return this.resultados.guardarAjustes(body || {});
  }

  @Comision('resultados-publica')
  @Get('ajustes')
  verAjustes() {
    return this.resultados.estadoPublico();
  }

  // -------------------------------------------------------------------- Excel

  @Comision(...LECTURA)
  @Get('excel')
  async excel(@Query('solo') solo: string, @Query('ola') ola: string, @Res() res: Response) {
    const { buffer, nombre } = await this.resultados.excel(solo === 'clasificados', tanda(ola));
    this.enviarExcel(res, buffer, nombre);
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
