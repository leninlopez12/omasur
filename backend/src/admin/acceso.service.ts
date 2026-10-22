import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../common/decorators';

/**
 * Cuánto dura la sesión prestada.
 *
 * Mucho más corta que la de un tutor de verdad: es para resolver algo puntual
 * —cargar unos alumnos, adjuntar un comprobante— y no para quedarse dentro.
 */
const DURACION = '4h';

/**
 * Entrar a la cuenta de un tutor.
 *
 * Varios tutores no se manejan con el sistema y piden que les carguen la
 * delegación o les suban el comprobante. Esto le da al administrador una
 * sesión de tutor legítima, con los mismos permisos que tendría el titular.
 *
 * Tres cosas lo mantienen bajo control: lo puede hacer solo el administrador
 * —ni siquiera el supervisor—, el token sale marcado para que la pantalla
 * avise de quién es la sesión prestada, y cada entrada queda escrita en el
 * registro del servidor con quién entró, a qué cuenta y cuándo.
 */
@Injectable()
export class AccesoService {
  private readonly log = new Logger('Acceso');

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /** Los tutores a los que se puede entrar, con lo necesario para elegir. */
  async tutores(buscar?: string) {
    const where: any = {};
    const texto = buscar?.trim();
    if (texto) {
      where.OR = [
        { institucion: { contains: texto, mode: 'insensitive' } },
        { nombres: { contains: texto, mode: 'insensitive' } },
        { apellidos: { contains: texto, mode: 'insensitive' } },
        { correo: { contains: texto, mode: 'insensitive' } },
        { dni: { contains: texto } },
      ];
    }

    const tutores = await this.prisma.tutor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        dni: true,
        nombres: true,
        apellidos: true,
        correo: true,
        celular: true,
        institucion: true,
        modalidad: true,
        estado: true,
        departamento: true,
        provincia: true,
        createdAt: true,
        _count: { select: { students: true, payments: true } },
      },
    });

    return tutores.map((t) => ({
      id: t.id,
      dni: t.dni,
      tutor: `${t.nombres} ${t.apellidos}`.trim(),
      correo: t.correo,
      celular: t.celular,
      institucion: t.institucion || 'Sin institución',
      modalidad: t.modalidad,
      estado: t.estado,
      departamento: t.departamento,
      provincia: t.provincia,
      alumnos: t._count.students,
      comprobantes: t._count.payments,
      registrado: t.createdAt,
    }));
  }

  /** La sesión prestada: un token de tutor, a nombre del tutor, pero marcado. */
  async entrar(tutorId: string, admin: JwtUser) {
    if (admin.rol !== 'ADMIN') {
      throw new ForbiddenException('Solo el administrador puede entrar a una cuenta de tutor');
    }
    // Una sesión ya prestada no puede prestar otra: si no, el rastro de quién
    // hizo qué se pierde en la primera escala.
    if (admin.actuandoComo) {
      throw new ForbiddenException('Ya está actuando como otro usuario');
    }

    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    const payload: JwtUser = {
      sub: tutor.id,
      correo: tutor.correo,
      rol: 'TUTOR',
      nombre: tutor.nombres,
      actuandoComo: true,
      suplantadoPor: admin.nombre,
    };

    this.log.warn(
      `${admin.nombre} (${admin.correo}) entró a la cuenta de ${tutor.correo} — ` +
        `${tutor.institucion || 'sin institución'}.`,
    );

    return {
      access_token: this.jwt.sign(payload, { expiresIn: DURACION }),
      tutor: {
        id: tutor.id,
        correo: tutor.correo,
        institucion: tutor.institucion || 'Sin institución',
        nombre: `${tutor.nombres} ${tutor.apellidos}`.trim(),
      },
    };
  }
}
