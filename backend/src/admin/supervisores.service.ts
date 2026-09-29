import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { plantillaCuentaNueva } from '../mail/mail.plantillas';

/**
 * Cuentas de supervisor, que crea el administrador.
 *
 * El administrador nunca inventa la contraseña: el sistema genera una
 * temporal, se la muestra una sola vez para que pueda entregarla, y además le
 * manda un correo al supervisor para que ponga la suya. Así nadie queda
 * anotando claves ajenas en un papel.
 */
@Injectable()
export class SupervisoresService {
  private readonly log = new Logger('Supervisores');

  constructor(
    private prisma: PrismaService,
    private correo: MailService,
  ) {}

  listar() {
    return this.prisma.admin.findMany({
      orderBy: [{ rol: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, nombre: true, correo: true, dni: true, rol: true, createdAt: true },
    });
  }

  async crear(datos: { nombre?: string; correo?: string; dni?: string }) {
    const nombre = (datos.nombre || '').trim();
    const correo = (datos.correo || '').trim().toLowerCase();
    const dni = (datos.dni || '').trim();

    if (!nombre) throw new BadRequestException('Escriba el nombre del supervisor');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new BadRequestException('Correo inválido');
    if (!/^\d{8}$/.test(dni)) throw new BadRequestException('El DNI debe tener 8 dígitos');

    await this.comprobarLibre(correo, dni);

    const clave = this.claveTemporal();
    const creado = await this.prisma.admin.create({
      data: { nombre, correo, dni, rol: 'SUPERVISOR', password: await bcrypt.hash(clave, 10) },
      select: { id: true, nombre: true, correo: true, dni: true, rol: true, createdAt: true },
    });

    const enviado = this.avisar(nombre, correo, clave);
    this.log.log(`Supervisor creado: ${correo} (correo ${enviado ? 'enviado' : 'no enviado'}).`);

    return { supervisor: creado, claveTemporal: clave, correoEnviado: enviado };
  }

  /** Vuelve a generar la clave: para cuando el supervisor la perdió. */
  async regenerarClave(id: string) {
    const cuenta = await this.soloSupervisor(id);
    const clave = this.claveTemporal();

    await this.prisma.admin.update({
      where: { id },
      data: { password: await bcrypt.hash(clave, 10) },
    });

    // Los enlaces de recuperación que anduvieran dando vueltas dejan de servir.
    await this.prisma.tokenRecuperacion.updateMany({
      where: { cuentaId: id, usadoEn: null },
      data: { usadoEn: new Date() },
    });

    const enviado = this.avisar(cuenta.nombre, cuenta.correo, clave);
    this.log.log(`Clave regenerada para ${cuenta.correo}.`);

    return { claveTemporal: clave, correoEnviado: enviado };
  }

  async eliminar(id: string, quienPide: string) {
    if (id === quienPide) {
      throw new BadRequestException('No puede eliminar su propia cuenta');
    }
    const cuenta = await this.soloSupervisor(id);

    await this.prisma.tokenRecuperacion.deleteMany({ where: { cuentaId: id } });
    await this.prisma.admin.delete({ where: { id } });

    this.log.log(`Supervisor eliminado: ${cuenta.correo}.`);
    return { ok: true };
  }

  /**
   * Solo se tocan cuentas de supervisor. Las de administrador se dejan fuera a
   * propósito: si un administrador pudiera borrar a otro, bastaría entrar con
   * una cuenta para quedarse con el sistema.
   */
  private async soloSupervisor(id: string) {
    const cuenta = await this.prisma.admin.findUnique({ where: { id } });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    if (cuenta.rol !== 'SUPERVISOR') {
      throw new BadRequestException('Solo se pueden administrar cuentas de supervisor');
    }
    return cuenta;
  }

  /** El correo y el DNI no se pueden repetir, ni entre la comisión ni con un tutor. */
  private async comprobarLibre(correo: string, dni: string) {
    const [staffCorreo, staffDni, tutorCorreo, tutorDni] = await Promise.all([
      this.prisma.admin.findUnique({ where: { correo } }),
      this.prisma.admin.findUnique({ where: { dni } }),
      this.prisma.tutor.findUnique({ where: { correo } }),
      this.prisma.tutor.findUnique({ where: { dni } }),
    ]);

    if (staffCorreo || tutorCorreo) throw new ConflictException('Ese correo ya está registrado');
    if (staffDni || tutorDni) throw new ConflictException('Ese DNI ya está registrado');
  }

  /** Doce caracteres al azar, sin los que se confunden al dictarlos. */
  private claveTemporal(): string {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = randomBytes(12);
    return Array.from(bytes, (b) => letras[b % letras.length]).join('');
  }

  /**
   * El correo sale en segundo plano. Esperarlo dejaba la pantalla diez
   * segundos pensando, y la clave se muestra igual ahí mismo: el correo es
   * la comodidad, no la vía principal.
   */
  private avisar(nombre: string, correo: string, clave: string): boolean {
    if (!this.correo.activo) return false;

    const mensaje = plantillaCuentaNueva(nombre, correo, clave);
    void this.correo
      .enviar({ para: correo, ...mensaje })
      .catch((error) => this.log.warn(`No se pudo avisar a ${correo}: ${error?.message ?? error}`));

    return true;
  }
}
