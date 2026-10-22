import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RecuperacionService } from './recuperacion.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { LimitePeticionesGuard } from '../common/limite.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'omasur-dev-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES || '7d' },
    }),
  ],
  providers: [AuthService, RecuperacionService, JwtStrategy, LimitePeticionesGuard],
  controllers: [AuthController],
  // JwtModule sale fuera para que el panel pueda emitir la sesión prestada
  // con la misma clave y la misma configuración, sin repetirla.
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
