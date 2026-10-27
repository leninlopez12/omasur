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
import { Ola, ResultadosService } from './resultados.service';
import { EncargadoGuard } from './encargado.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';

/** Cada pantalla trabaja una tanda; sin `ola` se ven las dos juntas. */
function tanda(valor?: string): Ola | undefined {
  return valor === 'tutores' || valor === 'comision' ? valor : undefined;
}

@Controller('resultados')
export class ResultadosController {
  constructor(private resultados: ResultadosService) {}

  // --------------------------------------------------------------------- tutor

  /** Lo que ve el tutor en su cuenta: sus estudiantes y sus puntajes. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('mi-clasificacion')
  miClasificacion(@CurrentUser() user: JwtUser) {
    return this.resultados.miClasificacion(user.sub);
  }

  // ------------------------------------------------------- quién está a cargo

  /** Lo pregunta el panel para saber si muestra la sección. */
  @UseGuards(JwtAuthGuard)
  @Get('acceso')
  acceso(@CurrentUser() user: JwtUser) {
    return this.resultados.puedeEntrar(user);
  }

  /** Asignar y quitar encargados es solo del administrador. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('encargados')
  encargados() {
    return this.resultados.encargados();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('encargados')
  cambiarEncargado(@Body() body: { id: string; aCargo: boolean }) {
    return this.resultados.cambiarEncargado(body?.id, Boolean(body?.aCargo));
  }

  // ------------------------- el resto: el admin y el supervisor a cargo

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Get()
  tabla(@Query('ola') ola?: string) {
    return this.resultados.porDelegacion(tanda(ola));
  }

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Get('general')
  general() {
    return this.resultados.general();
  }

  /** De las dos tandas: los sueltos se trabajan en un solo lugar. */
  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Get('individuales')
  individuales() {
    return this.resultados.individuales();
  }

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Get('empates')
  empates(@Query('ola') ola?: string) {
    return this.resultados.empates(tanda(ola));
  }

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Post('decidir')
  decidir(
    @Body() body: { clave: string; estado: 'CLASIFICA' | 'NO_CLASIFICA' | null },
    @Query('ola') ola?: string,
  ) {
    return this.resultados.decidir(body?.clave, body?.estado ?? null, tanda(ola));
  }

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Post('porcentaje')
  porcentaje(@Body() body: { porcentaje: number }, @Query('ola') ola?: string) {
    return this.resultados.cambiarPorcentaje(body?.porcentaje, tanda(ola));
  }

  // -------------------------------------------------------------- agrupaciones

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Post('agrupaciones')
  crear(@Body() body: { nombre?: string; delegacionId?: string | null }) {
    return this.resultados.crearAgrupacion(body || {});
  }

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Patch('agrupaciones/:id')
  cambiar(
    @Param('id') id: string,
    @Body() body: { nombre?: string; miembros?: string[] },
    @Query('ola') ola?: string,
  ) {
    return this.resultados.cambiarAgrupacion(id, body || {}, tanda(ola));
  }

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Delete('agrupaciones/:id')
  borrar(@Param('id') id: string, @Query('ola') ola?: string) {
    return this.resultados.borrarAgrupacion(id, tanda(ola));
  }

  // --------------------------------------------------------------- publicación

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Post('publicar')
  publicar(@Body() body: { ola: Ola; publicado: boolean }) {
    return this.resultados.publicar(body?.ola, Boolean(body?.publicado));
  }

  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Post('publicar/general')
  publicarGeneral(@Body() body: { publicado: boolean }) {
    return this.resultados.publicarGeneral(Boolean(body?.publicado));
  }

  // ------------------------------------------------------------ consultar

  /** Buscar por institución, tutor, nombre o DNI. */
  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Get('buscar')
  buscar(@Query('q') q: string) {
    return this.resultados.buscar(q);
  }

  /** El Excel de una delegación, para mandárselo a su tutor. */
  @UseGuards(JwtAuthGuard, EncargadoGuard)
  @Get('delegacion/:tutorId/excel')
  async excelDelegacion(@Param('tutorId') tutorId: string, @Res() res: Response) {
    const { buffer, nombre } = await this.resultados.excelDelegacion(tutorId);
    this.enviarExcel(res, buffer, nombre);
  }

  // -------------------------------------------------------------------- Excel

  @UseGuards(JwtAuthGuard, EncargadoGuard)
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
