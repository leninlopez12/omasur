import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { plantillaClaveCambiada, plantillaRecuperacion } from '../mail/mail.plantillas';

/** Minutos que dura el enlace enviado por correo. */
const VIGENCIA_MINUTOS = Number(process.env.RECUPERACION_MINUTOS || 60);

/** Cuántos enlaces puede pedir un mismo correo dentro de una hora. */
const MAXIMO_POR_HORA = 3;

interface Cuenta {
  id: string;
  correo: string;
  nombre: string;
  esStaff: boolean;
}

@Injectable()
export class RecuperacionService {
  private readonly log = new Logger('Recuperación');

  constructor(
    private prisma: PrismaService,
    private correo: MailService,
  ) {}

  /**
   * Paso 1: el usuario escribe su correo y se le manda el enlace.
   *
   * Se le dice con todas sus letras si el correo está registrado o no. Eso
   * permite que alguien pruebe direcciones para averiguar quién está inscrito,
   * y por eso el límite por IP del controlador es lo que impide hacerlo en
   * cantidad. Se eligió así para que un tutor que se equivoca al escribir se
   * entere en el momento, en vez de quedarse esperando un correo que no llega.
   */
  async solicitar(correoCrudo: string, ip?: string) {
    const correo = correoCrudo.toLowerCase().trim();

    await this.limpiarVencidos();

    const cuenta = await this.buscarCuenta(correo);
    if (!cuenta) {
      this.log.warn(`Pedido de recuperación para un correo no registrado (${this.ocultar(correo)}).`);
      throw new NotFoundException(
        'Ese correo no está registrado. Revise que esté bien escrito o inscriba su delegación.',
      );
    }

    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
    const recientes = await this.prisma.tokenRecuperacion.count({
      where: { correo, createdAt: { gte: haceUnaHora } },
    });
    if (recientes >= MAXIMO_POR_HORA) {
      this.log.warn(`Demasiados pedidos seguidos para ${this.ocultar(correo)}: no se envía otro.`);
      throw new HttpException(
        'Ya le enviamos un enlace hace poco. Revise su correo, incluida la carpeta de spam, y espere una hora antes de pedir otro.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Un solo enlace vivo por cuenta: al pedir uno nuevo, los anteriores mueren.
    await this.anularPendientes(cuenta.id);

    const token = randomBytes(32).toString('hex');
    const registro = await this.prisma.tokenRecuperacion.create({
      data: {
        tokenHash: this.hash(token),
        correo,
        cuentaId: cuenta.id,
        esStaff: cuenta.esStaff,
        expiraEn: new Date(Date.now() + VIGENCIA_MINUTOS * 60 * 1000),
        ip: ip?.slice(0, 60),
      },
    });

    const enlace = `${this.baseWeb()}/recuperar/${token}`;
    const mensaje = plantillaRecuperacion(cuenta.nombre, enlace, VIGENCIA_MINUTOS);
    const enviado = await this.correo.enviar({ para: cuenta.correo, ...mensaje });

    // Si el correo no salió, el enlace se descarta: así no gasta su cupo ni
    // queda un enlace vivo que nadie recibió.
    if (!enviado && this.correo.activo) {
      await this.prisma.tokenRecuperacion
        .delete({ where: { id: registro.id } })
        .catch(() => undefined);
      throw new ServiceUnavailableException(
        'No pudimos enviar el correo en este momento. Intente nuevamente en unos minutos.',
      );
    }

    return {
      ok: true,
      correo: this.ocultar(cuenta.correo),
      mensaje: `Le enviamos el enlace a ${this.ocultar(cuenta.correo)}. Revise también la carpeta de spam.`,
    };
  }

  /**
   * Paso 2: al abrir el enlace se comprueba que siga vivo, para poder mostrar
   * un mensaje claro antes de que el usuario escriba nada.
   */
  async verificar(token: string) {
    const registro = await this.buscarToken(token);
    return {
      valido: true,
      correo: this.ocultar(registro.correo),
      nombre: registro.nombre,
    };
  }

  /**
   * Paso 3: se guarda la nueva contraseña. El token se marca usado dentro de la
   * misma operación, así dos clics simultáneos no pueden gastarlo dos veces.
   */
  async restablecer(token: string, password: string) {
    const registro = await this.buscarToken(token);

    const gastado = await this.prisma.tokenRecuperacion.updateMany({
      where: { id: registro.id, usadoEn: null, expiraEn: { gt: new Date() } },
      data: { usadoEn: new Date() },
    });

    if (gastado.count !== 1) {
      throw new BadRequestException('Este enlace ya fue utilizado. Solicite uno nuevo.');
    }

    const cifrada = await bcrypt.hash(password, 10);

    if (registro.esStaff) {
      await this.prisma.admin.update({
        where: { id: registro.cuentaId },
        data: { password: cifrada },
      });
    } else {
      await this.prisma.tutor.update({
        where: { id: registro.cuentaId },
        data: { password: cifrada },
      });
    }

    // Cualquier otro enlace que siguiera dando vueltas queda inservible.
    await this.anularPendientes(registro.cuentaId);

    const cuando = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const aviso = plantillaClaveCambiada(registro.nombre, cuando);
    await this.correo.enviar({ para: registro.correo, ...aviso });

    this.log.log(`Contraseña restablecida para ${this.ocultar(registro.correo)}.`);
    return { ok: true, mensaje: 'Su contraseña se cambió correctamente. Ya puede ingresar.' };
  }

  // ---------------------------------------------------------------- internos

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Busca el token y devuelve además el nombre de la persona dueña de la cuenta. */
  private async buscarToken(token: string) {
    const limpio = (token || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(limpio)) {
      throw new BadRequestException('El enlace no es válido. Solicite uno nuevo.');
    }

    const calculado = this.hash(limpio);
    const registro = await this.prisma.tokenRecuperacion.findUnique({
      where: { tokenHash: calculado },
    });

    if (!registro || !this.mismoToken(registro.tokenHash, calculado)) {
      throw new BadRequestException('El enlace no es válido. Solicite uno nuevo.');
    }
    if (registro.usadoEn) {
      throw new BadRequestException('Este enlace ya fue utilizado. Solicite uno nuevo.');
    }
    if (registro.expiraEn.getTime() < Date.now()) {
      throw new BadRequestException('El enlace venció. Solicite uno nuevo.');
    }

    const cuenta = registro.esStaff
      ? await this.prisma.admin.findUnique({ where: { id: registro.cuentaId } })
      : await this.prisma.tutor.findUnique({ where: { id: registro.cuentaId } });

    if (!cuenta) throw new BadRequestException('La cuenta ya no existe.');

    const nombre =
      'nombres' in cuenta ? `${cuenta.nombres} ${cuenta.apellidos}`.trim() : cuenta.nombre;
    return { ...registro, nombre, correo: cuenta.correo };
  }

  /** Comparación en tiempo constante, por prolijidad con datos sensibles. */
  private mismoToken(guardado: string, calculado: string) {
    const a = Buffer.from(guardado);
    const b = Buffer.from(calculado);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async buscarCuenta(correo: string): Promise<Cuenta | null> {
    const tutor = await this.prisma.tutor.findUnique({ where: { correo } });
    if (tutor) {
      return {
        id: tutor.id,
        correo: tutor.correo,
        nombre: `${tutor.nombres} ${tutor.apellidos}`.trim(),
        esStaff: false,
      };
    }

    const staff = await this.prisma.admin.findUnique({ where: { correo } });
    if (staff) {
      return { id: staff.id, correo: staff.correo, nombre: staff.nombre, esStaff: true };
    }

    return null;
  }

  private anularPendientes(cuentaId: string) {
    return this.prisma.tokenRecuperacion.updateMany({
      where: { cuentaId, usadoEn: null },
      data: { usadoEn: new Date() },
    });
  }

  /** Los enlaces vencidos hace más de un día ya no sirven ni para el historial. */
  private limpiarVencidos() {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.tokenRecuperacion
      .deleteMany({ where: { expiraEn: { lt: ayer } } })
      .catch(() => undefined);
  }

  /** ho****@gmail.com: sirve para confirmar el correo sin mostrarlo entero. */
  private ocultar(correo: string) {
    const [usuario, dominio] = correo.split('@');
    if (!dominio) return '****';
    const visible = usuario.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(usuario.length - 2, 2))}@${dominio}`;
  }

  /**
   * La dirección pública del sitio, para armar el enlace del correo.
   *
   * Manda SITIO_URL. FRONTEND_URL queda solo como respaldo: sirve para CORS y
   * en producción suele estar vacío —la web la entrega este mismo servidor—,
   * así que fiarse de él dejaba los enlaces apuntando a localhost.
   */
  private baseWeb() {
    const url = process.env.SITIO_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    return url.split(',')[0].trim().replace(/\/+$/, '');
  }
}
