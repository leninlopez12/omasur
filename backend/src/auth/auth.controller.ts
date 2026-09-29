import { Body, Controller, Get, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RecuperacionService } from './recuperacion.service';
import {
  LoginDto,
  RegistroTutorDto,
  RestablecerClaveDto,
  SolicitarRecuperacionDto,
} from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators';
import { InscripcionesAbiertasGuard } from '../common/inscripciones.guard';
import { Limite, LimitePeticionesGuard } from '../common/limite.guard';

@Controller('auth')
@UseGuards(LimitePeticionesGuard)
export class AuthController {
  constructor(
    private auth: AuthService,
    private recuperacion: RecuperacionService,
  ) {}

  @UseGuards(InscripcionesAbiertasGuard)
  @Post('registro')
  registro(@Body() dto: RegistroTutorDto) {
    return this.auth.registrarTutor(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  perfil(@CurrentUser() user: JwtUser) {
    return this.auth.perfil(user);
  }

  /** Paso 1: pedir el enlace. Responde siempre igual, exista o no el correo. */
  @Limite(5, 15 * 60)
  @Post('recuperar')
  solicitarRecuperacion(@Body() dto: SolicitarRecuperacionDto, @Ip() ip: string) {
    return this.recuperacion.solicitar(dto.correo, ip);
  }

  /** Paso 2: al abrir el enlace, saber si sigue vigente. */
  @Limite(20, 15 * 60)
  @Get('recuperar/:token')
  verificarEnlace(@Param('token') token: string) {
    return this.recuperacion.verificar(token);
  }

  /** Paso 3: guardar la nueva contraseña y quemar el enlace. */
  @Limite(10, 15 * 60)
  @Post('recuperar/confirmar')
  restablecer(@Body() dto: RestablecerClaveDto) {
    return this.recuperacion.restablecer(dto.token, dto.password);
  }
}
