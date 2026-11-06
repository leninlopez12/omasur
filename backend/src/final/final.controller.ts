import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FinalService } from './final.service';
import { ExamenFinalService } from './examen-final.service';
import { ResultadosFinalService } from './resultados-final.service';
import { CredencialFinalService } from './credencial-final.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermisoGuard } from '../permisos/permiso.guard';
import { CurrentUser, JwtUser, Permiso, Roles } from '../common/decorators';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * La etapa final la lleva el administrador.
 *
 * La clave, el reparto de salones y la premiación no se delegan: son las
 * decisiones del día y no hay permiso que las conceda.
 */
const SoloAdmin = () => applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles('ADMIN'));

/**
 * Lo que sí se delega: el aula.
 *
 * El permiso dice que puede subir respuestas; `soloSuSalon` dice de cuál. Hacen
 * falta los dos, porque el permiso es el mismo para todos los responsables.
 */
const Responsable = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, PermisoGuard),
    Roles('ADMIN', 'SUPERVISOR'),
    Permiso('final-salon'),
  );

/**
 * Un salón se nombra con su turno y su número.
 *
 * El número solo no alcanza desde que los dos turnos usan las mismas aulas: el
 * 101 de secundaria y el 101 de primaria son puertas distintas en la agenda.
 */
@Controller('final')
export class FinalController {
  constructor(
    private final: FinalService,
    private examen: ExamenFinalService,
    private resultados: ResultadosFinalService,
    private credencial: CredencialFinalService,
  ) {}

  // ------------------------------------------------------------------ público

  @Get('publico')
  estadoPublico() {
    return this.resultados.estadoPublico();
  }

  @Get('consulta')
  consulta(@Query('dni') dni: string) {
    return this.resultados.consultar(dni);
  }

  /** Si la portada muestra el botón de credencial de finalistas. */
  @Get('credencial/estado')
  async estadoCredencial() {
    const { abierta } = await this.credencial.estado();
    return { abierta };
  }

  @Get('credencial/consulta')
  consultaCredencial(@Query('dni') dni: string) {
    return this.credencial.consultar(dni);
  }

  @Get('credencial/dni/:dni')
  async credencialPorDni(@Param('dni') dni: string, @Res() res: Response) {
    this.enviarPdf(res, await this.credencial.pdfPorDni(dni), `credencial-final-${dni}.pdf`);
  }

  // -------------------------------------------------------------------- tutor

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('mi-delegacion')
  miDelegacion(@CurrentUser() usuario: JwtUser) {
    return this.resultados.miDelegacion(usuario.sub);
  }

  /** Los finalistas de su delegación, para saber si hay algo que bajar. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('mis-finalistas')
  async misFinalistas(@CurrentUser() usuario: JwtUser) {
    const { abierta, sede, fecha } = await this.credencial.estado();
    const suyos = (await this.credencial.finalistas()).filter((f) => f.tutorId === usuario.sub);
    return { abierta, sede, fecha, finalistas: abierta ? suyos : [] };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TUTOR')
  @Get('mis-finalistas/credenciales')
  async credencialesDeMisFinalistas(@CurrentUser() usuario: JwtUser, @Res() res: Response) {
    const pdf = await this.credencial.pdfDeTutor(usuario.sub);
    this.enviarPdf(res, pdf, 'credenciales-finalistas.pdf');
  }

  // ------------------------------------------------------ salones y horarios

  @SoloAdmin()
  @Get('salones')
  salones() {
    return this.final.estado();
  }

  @SoloAdmin()
  @Post('config')
  guardarConfig(@Body() body: any) {
    return this.final.guardarConfig(body || {});
  }

  @SoloAdmin()
  @Post('salones/generar')
  generar() {
    return this.final.generar();
  }

  @SoloAdmin()
  @Delete('salones')
  borrarSorteo() {
    return this.final.borrarSorteo();
  }

  // --------------------------------------------------- acomodar a mano

  @SoloAdmin()
  @Post('salones/mover')
  mover(@Body() body: { dni?: string; nivel?: string; salon?: number }) {
    return this.final.moverAlumno(body?.dni || '', body?.nivel || '', Number(body?.salon));
  }

  @SoloAdmin()
  @Post('salones/sacar')
  sacar(@Body() body: { dni?: string }) {
    return this.final.sacarAlumno(body?.dni || '');
  }

  @SoloAdmin()
  @Post('salones/nuevo')
  crearSalon(@Body() body: { nivel?: string }) {
    return this.final.crearSalon(body?.nivel || '');
  }

  @SoloAdmin()
  @Delete('salones/:nivel/:numero')
  borrarSalon(@Param('nivel') nivel: string, @Param('numero') numero: string) {
    return this.final.borrarSalon(nivel, Number(numero));
  }

  @SoloAdmin()
  @Post('salones/:nivel/:numero/responsable')
  asignar(
    @Param('nivel') nivel: string,
    @Param('numero') numero: string,
    @Body() body: { responsableId?: string | null },
  ) {
    return this.final.asignar(nivel, Number(numero), body?.responsableId || null);
  }

  // ------------------------------------------------- las listas del examen

  /** La lista de la puerta. El responsable baja la suya; el admin, todas. */
  @Responsable()
  @Get('listas/excel')
  async excelSalones(
    @Query('nivel') nivel: string,
    @Query('salon') salon: string,
    @CurrentUser() usuario: JwtUser,
    @Res() res: Response,
  ) {
    if (salon) await this.soloSuSalon(usuario, nivel, salon);
    else if (usuario.rol !== 'ADMIN') {
      throw new ForbiddenException('Solo puede bajar la lista de los salones a su cargo.');
    }

    const { buffer, nombre } = await this.final.excel({
      nivel: nivel || undefined,
      numero: salon ? Number(salon) : undefined,
    });
    this.enviar(res, buffer, nombre);
  }

  /** Lo que ve el responsable de aula: sus salones y nada más. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERVISOR')
  @Get('mis-salones')
  misSalones(@CurrentUser() usuario: JwtUser) {
    return this.final.misSalones(usuario.sub);
  }

  // ------------------------------------------------------------ el examen final

  @Responsable()
  @Get('examen/config')
  async configExamen(@CurrentUser() usuario: JwtUser) {
    const config = await this.examen.config();
    const estructura = this.examen.estructura();

    // El responsable de aula necesita saber cómo está armada la prueba, no las
    // respuestas correctas.
    if (usuario.rol === 'ADMIN') return { ...config, estructura };
    const { claves, ...resto } = config;
    return { ...resto, estructura, categoriasConClave: Object.keys(claves).sort() };
  }

  @SoloAdmin()
  @Post('examen/clave')
  guardarClave(@Body() body: { categoria?: string; clave?: unknown }) {
    return this.examen.guardarClave(body?.categoria || '', body?.clave);
  }

  @SoloAdmin()
  @Delete('examen/clave/:categoria')
  borrarClave(@Param('categoria') categoria: string) {
    return this.examen.borrarClave(categoria);
  }

  @SoloAdmin()
  @Post('examen/puntajes')
  guardarPuntajes(@Body() body: any) {
    return this.examen.guardarPuntajes(body || {});
  }

  @SoloAdmin()
  @Post('examen/abrir')
  abrir(@Body() body: { abierto?: boolean }) {
    return this.examen.abrir(Boolean(body?.abierto));
  }

  @SoloAdmin()
  @Get('examen')
  entregas() {
    return this.examen.entregas();
  }

  @SoloAdmin()
  @Get('consolidado')
  consolidado() {
    return this.examen.consolidado();
  }

  @SoloAdmin()
  @Get('consolidado/excel')
  async excelConsolidado(@Res() res: Response) {
    const { buffer, nombre } = await this.examen.excelConsolidado();
    this.enviar(res, buffer, nombre);
  }

  @Responsable()
  @Get('examen/:nivel/:numero/plantilla')
  async plantilla(
    @Param('nivel') nivel: string,
    @Param('numero') numero: string,
    @CurrentUser() usuario: JwtUser,
    @Res() res: Response,
  ) {
    await this.soloSuSalon(usuario, nivel, numero);
    const { buffer, nombre } = await this.examen.plantilla(nivel, Number(numero));
    this.enviar(res, buffer, nombre);
  }

  @Responsable()
  @Post('examen/:nivel/:numero/revisar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async revisar(
    @Param('nivel') nivel: string,
    @Param('numero') numero: string,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() usuario: JwtUser,
  ) {
    await this.soloSuSalon(usuario, nivel, numero);
    return this.examen.revisar(nivel, Number(numero), archivo);
  }

  @Responsable()
  @Post('examen/:nivel/:numero/enviar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async recibir(
    @Param('nivel') nivel: string,
    @Param('numero') numero: string,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() usuario: JwtUser,
  ) {
    await this.soloSuSalon(usuario, nivel, numero);
    return this.examen.registrar(nivel, Number(numero), archivo, {
      nombre: usuario.nombre || '',
      esAdmin: usuario.rol === 'ADMIN',
    });
  }

  @SoloAdmin()
  @Delete('examen/:nivel/:numero')
  anular(@Param('nivel') nivel: string, @Param('numero') numero: string) {
    return this.examen.anular(nivel, Number(numero));
  }

  @SoloAdmin()
  @Post('examen/:nivel/:numero/corregir')
  corregir(
    @Param('nivel') nivel: string,
    @Param('numero') numero: string,
    @Body() body: { dni?: string; alternativas?: unknown; numericas?: unknown; horaEntrega?: string },
  ) {
    return this.examen.corregirAlumno(nivel, Number(numero), body?.dni || '', body);
  }

  @Responsable()
  @Get('examen/:nivel/:numero')
  async entrega(
    @Param('nivel') nivel: string,
    @Param('numero') numero: string,
    @CurrentUser() usuario: JwtUser,
  ) {
    await this.soloSuSalon(usuario, nivel, numero);
    return this.examen.entregaDe(nivel, Number(numero));
  }

  @Responsable()
  @Get('examen/:nivel/:numero/excel')
  async excelEnviadas(
    @Param('nivel') nivel: string,
    @Param('numero') numero: string,
    @CurrentUser() usuario: JwtUser,
    @Res() res: Response,
  ) {
    await this.soloSuSalon(usuario, nivel, numero);
    const { buffer, nombre } = await this.examen.excelEnviadas(nivel, Number(numero));
    this.enviar(res, buffer, nombre);
  }

  // ------------------------------------------- credenciales de los finalistas

  @SoloAdmin()
  @Get('credencial')
  estadoDeCredenciales() {
    return this.credencial.estado();
  }

  @SoloAdmin()
  @Post('credencial/abrir')
  abrirCredencial(@Body() body: { abierta?: boolean }) {
    return this.credencial.abrir(Boolean(body?.abierta));
  }

  @SoloAdmin()
  @Get('credencial/muestra')
  async muestraCredencial(@Res() res: Response) {
    this.enviarPdf(res, await this.credencial.muestra(), 'muestra-credencial-final.pdf');
  }

  /** Todas, o las de un salón o un turno: lo que imprime la comisión. */
  @SoloAdmin()
  @Get('credencial/pdf')
  async credencialesComision(
    @Query('nivel') nivel: string,
    @Query('salon') salon: string,
    @Res() res: Response,
  ) {
    const pdf = await this.credencial.pdfComision({
      nivel: nivel || undefined,
      salon: salon ? Number(salon) : undefined,
    });
    this.enviarPdf(
      res,
      pdf,
      salon ? `credenciales-salon-${salon}.pdf` : 'credenciales-finalistas.pdf',
    );
  }

  /** Buscar finalistas por colegio, tutor, nombre o DNI. */
  @SoloAdmin()
  @Get('credencial/buscar')
  buscarCredenciales(@Query('q') q: string) {
    return this.credencial.buscar(q);
  }

  /** La de un alumno suelto, sin exigir que la descarga esté abierta. */
  @SoloAdmin()
  @Get('credencial/alumno/:dni')
  async credencialDeAlumno(@Param('dni') dni: string, @Res() res: Response) {
    const pdf = await this.credencial.pdfPorDni(dni, false);
    this.enviarPdf(res, pdf, `credencial-final-${dni}.pdf`);
  }

  /** Le avisa al tutor por su panel que ya puede descargarlas. */
  @SoloAdmin()
  @Post('credencial/avisar/:tutorId')
  avisarCredenciales(@Param('tutorId') tutorId: string, @CurrentUser() usuario: JwtUser) {
    return this.credencial.avisar(tutorId, usuario.nombre || 'La comisión');
  }

  /** Las de una delegación, para atender al tutor que no puede entrar. */
  @SoloAdmin()
  @Get('credencial/delegacion/:tutorId')
  async credencialesDeDelegacion(@Param('tutorId') tutorId: string, @Res() res: Response) {
    const pdf = await this.credencial.pdfDeTutor(tutorId, false);
    this.enviarPdf(res, pdf, 'credenciales-finalistas.pdf');
  }

  // ------------------------------------------------------- resultados finales

  @SoloAdmin()
  @Get('resultados')
  general() {
    return this.resultados.general();
  }

  @SoloAdmin()
  @Get('resultados/top')
  top(@Query('puestos') puestos?: string) {
    return this.resultados.top(Number(puestos) || undefined);
  }

  @SoloAdmin()
  @Get('resultados/premiacion')
  premiacion(@Query('puestos') puestos?: string) {
    return this.resultados.premiacion(Number(puestos) || undefined);
  }

  @SoloAdmin()
  @Get('resultados/buscar')
  buscar(@Query('q') q: string) {
    return this.resultados.buscar(q);
  }

  @SoloAdmin()
  @Post('resultados/publicar')
  publicar(@Body() body: { publicado?: boolean }) {
    return this.resultados.publicar(Boolean(body?.publicado));
  }

  @SoloAdmin()
  @Post('resultados/ajustes')
  ajustes(@Body() body: any) {
    return this.resultados.guardarAjustes(body || {});
  }

  @SoloAdmin()
  @Get('resultados/excel')
  async excelResultados(@Query('solo') solo: string, @Res() res: Response) {
    const { buffer, nombre } = await this.resultados.excel(solo === 'premiados');
    this.enviar(res, buffer, nombre);
  }

  // -------------------------------------------------------------------- apoyos

  /**
   * Un responsable solo toca su aula.
   *
   * El permiso dice que puede subir respuestas; esto dice de qué salón. Sin
   * esta comprobación, cualquiera con `final-salon` podría escribir sobre el
   * envío del aula de al lado.
   */
  private async soloSuSalon(usuario: JwtUser, nivel: string, numero: string) {
    if (await this.final.puedeVerSalon(usuario, nivel, Number(numero))) return;
    throw new ForbiddenException('Ese salón no está a su cargo.');
  }

  private enviarPdf(res: Response, buffer: Buffer, nombre: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.end(buffer);
  }

  private enviar(res: Response, buffer: Buffer, nombre: string) {
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.end(buffer);
  }
}
