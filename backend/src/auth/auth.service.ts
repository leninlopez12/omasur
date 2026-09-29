import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RolStaff } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegistroTutorDto } from './dto';
import { JwtUser } from '../common/decorators';
import { NotificationsService } from '../notifications/notifications.service';

/** Las que vienen escritas en el ejemplo: públicas, inservibles en producción. */
const CLAVES_DE_EJEMPLO = ['Omasur2026!', 'Supervisor2026!'];

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger('Cuentas');

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private notificaciones: NotificationsService,
  ) {}

  /** Crea las cuentas de la comisión (administrador y supervisor) si no existen. */
  async onModuleInit() {
    await this.crearCuenta({
      correo: process.env.ADMIN_EMAIL || 'admin@ipeh.edu.pe',
      password: process.env.ADMIN_PASSWORD || 'Omasur2026!',
      dni: process.env.ADMIN_DNI || '10000001',
      nombre: 'Comisión Organizadora',
      rol: 'ADMIN',
    });
    await this.crearCuenta({
      correo: process.env.SUPERVISOR_EMAIL || 'supervisor@ipeh.edu.pe',
      password: process.env.SUPERVISOR_PASSWORD || 'Supervisor2026!',
      dni: process.env.SUPERVISOR_DNI || '10000002',
      nombre: 'Supervisor de Inscripciones',
      rol: 'SUPERVISOR',
    });
  }

  /**
   * En producción no se crea ninguna cuenta con la clave de ejemplo: sería
   * una puerta abierta y conocida. Si falta el valor, se avisa y no se crea.
   */
  private claveDeSobra(password: string): boolean {
    if (process.env.NODE_ENV !== 'production') return false;
    // Sin variable puesta, arriba se usa la clave de ejemplo: comparar contra
    // ellas cubre tanto "no la definió" como "la dejó tal cual".
    return CLAVES_DE_EJEMPLO.includes(password);
  }

  private async crearCuenta(datos: {
    correo: string;
    password: string;
    dni: string;
    nombre: string;
    rol: RolStaff;
  }) {
    const { correo, password, dni, nombre, rol } = datos;
    const existe = await this.prisma.admin.findUnique({ where: { correo } }).catch(() => null);

    // La cuenta ya estaba creada antes de que existiera el DNI: se lo asignamos.
    if (existe) {
      if (!existe.dni) {
        await this.prisma.admin
          .update({ where: { id: existe.id }, data: { dni } })
          .catch(() => undefined);
      }
      return;
    }

    if (this.claveDeSobra(password)) {
      this.log.error(
        `No se creó la cuenta ${rol} (${correo}): defina ${rol === 'ADMIN' ? 'ADMIN_PASSWORD' : 'SUPERVISOR_PASSWORD'} ` +
          'en el .env con una contraseña propia. Las de ejemplo no se aceptan en producción.',
      );
      return;
    }

    await this.prisma.admin
      .create({ data: { nombre, correo, rol, dni, password: await bcrypt.hash(password, 10) } })
      .catch(() => undefined);
  }

  async registrarTutor(dto: RegistroTutorDto) {
    const correo = dto.correo.toLowerCase().trim();
    const dni = dto.dni.trim();

    if (await this.prisma.tutor.findUnique({ where: { dni } })) {
      throw new ConflictException('Ya existe una cuenta con ese DNI');
    }
    if (await this.prisma.tutor.findUnique({ where: { correo } })) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }

    const tutor = await this.prisma.tutor.create({
      data: {
        ...dto,
        dni,
        correo,
        password: await bcrypt.hash(dto.password, 10),
      },
    });

    await this.notificaciones.crear({
      tipo: 'TUTOR_REGISTRADO',
      titulo: 'Nuevo tutor registrado',
      detalle: tutor.nombres + ' ' + tutor.apellidos + ' creó su cuenta (DNI ' + tutor.dni + ').',
      tutorId: tutor.id,
    });

    return this.emitir({ sub: tutor.id, correo: tutor.correo, rol: 'TUTOR', nombre: tutor.nombres });
  }

  /** Todos entran con su DNI. El correo se acepta solo por compatibilidad. */
  async login(dto: LoginDto) {
    const usuario = dto.usuario.trim();
    const comoCorreo = usuario.toLowerCase();

    const admin =
      (await this.prisma.admin.findUnique({ where: { dni: usuario } })) ??
      (await this.prisma.admin.findUnique({ where: { correo: comoCorreo } }));

    if (admin && (await bcrypt.compare(dto.password, admin.password))) {
      return this.emitir({
        sub: admin.id,
        correo: admin.correo,
        rol: admin.rol,
        nombre: admin.nombre,
      });
    }

    const tutor =
      (await this.prisma.tutor.findUnique({ where: { dni: usuario } })) ??
      (await this.prisma.tutor.findUnique({ where: { correo: comoCorreo } }));

    if (tutor && (await bcrypt.compare(dto.password, tutor.password))) {
      return this.emitir({ sub: tutor.id, correo: tutor.correo, rol: 'TUTOR', nombre: tutor.nombres });
    }

    throw new UnauthorizedException('DNI o contraseña incorrectos');
  }

  async perfil(user: JwtUser) {
    if (user.rol !== 'TUTOR') {
      const admin = await this.prisma.admin.findUnique({ where: { id: user.sub } });
      return { rol: admin?.rol, nombre: admin?.nombre, correo: admin?.correo };
    }
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: user.sub },
      include: { _count: { select: { students: true } } },
    });
    if (!tutor) throw new UnauthorizedException('Sesión inválida');
    const { password, ...datos } = tutor;
    return { rol: 'TUTOR', ...datos };
  }

  private emitir(payload: JwtUser) {
    return {
      access_token: this.jwt.sign(payload),
      usuario: { id: payload.sub, correo: payload.correo, rol: payload.rol, nombre: payload.nombre },
    };
  }
}
