import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Modalidad, NivelInstitucion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { CLAVE_CIERRE } from '../settings/settings.service';

/** Las tablas que entran al respaldo, en orden de restauración. */
const TABLAS = [
  'admin',
  'ajuste',
  'grupoWhatsapp',
  'tutor',
  'payment',
  'student',
  'notificacion',
  'tokenRecuperacion',
  'suscripcionPush',
] as const;

/**
 * Lo que el administrador necesita para no depender de nadie: saber si el
 * sistema está sano, sacar un respaldo sin tocar la consola y corregir los
 * datos de un tutor cuando se equivocó al escribirlos.
 */
@Injectable()
export class SistemaService {
  constructor(
    private prisma: PrismaService,
    private correo: MailService,
    private almacenamiento: StorageService,
  ) {}

  /**
   * Diagnóstico: qué está conectado y qué no. La idea es que el administrador
   * se entere de que el correo dejó de andar antes de que se lo diga un tutor.
   */
  async estado() {
    const [cierre, totales, ultimoRespaldo, ultimoCorreo] = await Promise.all([
      this.prisma.ajuste.findUnique({ where: { clave: CLAVE_CIERRE } }),
      this.conteos(),
      this.ultimoRespaldo(),
      this.prisma.tokenRecuperacion.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);

    const enDisco = await this.prisma.payment.count({
      where: { NOT: { archivoUrl: { startsWith: 'r2:' } } },
    });

    return {
      correo: {
        activo: this.correo.activo,
        remitente: process.env.SMTP_FROM || process.env.SMTP_USER || '',
        ultimoEnvio: ultimoCorreo?.createdAt ?? null,
      },
      almacenamiento: {
        enCloudflare: this.almacenamiento.usandoR2,
        bucket: process.env.R2_BUCKET || '',
        // Un comprobante en disco se pierde en el próximo despliegue.
        comprobantesEnDisco: enDisco,
      },
      avisos: { configurado: Boolean(process.env.VAPID_PUBLIC_KEY) },
      inscripciones: { abiertas: cierre?.valor !== 'true' },
      respaldo: ultimoRespaldo,
      entorno: {
        produccion: process.env.NODE_ENV === 'production',
        detrasDeProxy: process.env.TRUST_PROXY === 'true',
      },
      totales,
    };
  }

  /** El respaldo completo, para descargarlo desde el panel. */
  async respaldo() {
    const datos: Record<string, unknown[]> = {};
    const conteo: Record<string, number> = {};

    for (const tabla of TABLAS) {
      const modelo = (this.prisma as any)[tabla];
      if (!modelo) continue;
      datos[tabla] = await modelo.findMany();
      conteo[tabla] = datos[tabla].length;
    }

    return { generado: new Date().toISOString(), conteo, datos };
  }

  /**
   * Corregir los datos de un tutor. Pasa seguido: el nombre del colegio mal
   * escrito, un correo con una letra de más. Sin esto había que entrar a la
   * base a mano.
   */
  async corregirTutor(
    tutorId: string,
    datos: {
      institucion?: string;
      nombres?: string;
      apellidos?: string;
      correo?: string;
      celular?: string;
      dni?: string;
      modalidad?: Modalidad;
      nivelInstitucion?: NivelInstitucion;
      departamento?: string;
      provincia?: string;
      distrito?: string;
    },
  ) {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor) throw new NotFoundException('Inscripción no encontrada');

    const cambios: Record<string, any> = {};

    if (datos.institucion !== undefined) cambios.institucion = datos.institucion.trim();
    if (datos.nombres !== undefined) cambios.nombres = datos.nombres.trim();
    if (datos.apellidos !== undefined) cambios.apellidos = datos.apellidos.trim();
    if (datos.modalidad !== undefined) cambios.modalidad = datos.modalidad;
    if (datos.nivelInstitucion !== undefined) cambios.nivelInstitucion = datos.nivelInstitucion;

    if (datos.departamento !== undefined) {
      cambios.departamento = datos.departamento;
      cambios.region = datos.departamento;
    }
    if (datos.provincia !== undefined) cambios.provincia = datos.provincia;
    if (datos.distrito !== undefined) cambios.distrito = datos.distrito;

    if (datos.celular !== undefined) {
      const celular = datos.celular.trim();
      if (celular && !/^9\d{8}$/.test(celular)) {
        throw new BadRequestException('El celular debe tener 9 dígitos y empezar en 9');
      }
      cambios.celular = celular;
    }

    if (datos.correo !== undefined) {
      const correo = datos.correo.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
        throw new BadRequestException('Correo inválido');
      }
      if (correo !== tutor.correo) await this.correoLibre(correo);
      cambios.correo = correo;
    }

    if (datos.dni !== undefined) {
      const dni = datos.dni.trim();
      if (!/^\d{8}$/.test(dni)) throw new BadRequestException('El DNI debe tener 8 dígitos');
      if (dni !== tutor.dni) await this.dniLibre(dni);
      cambios.dni = dni;
    }

    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException('No hay nada que cambiar');
    }

    const actualizado = await this.prisma.tutor.update({ where: { id: tutorId }, data: cambios });
    const { password, ...resto } = actualizado;
    return resto;
  }

  private async correoLibre(correo: string) {
    const [tutor, staff] = await Promise.all([
      this.prisma.tutor.findUnique({ where: { correo } }),
      this.prisma.admin.findUnique({ where: { correo } }),
    ]);
    if (tutor || staff) throw new ConflictException('Ese correo ya está registrado');
  }

  private async dniLibre(dni: string) {
    const [tutor, staff] = await Promise.all([
      this.prisma.tutor.findUnique({ where: { dni } }),
      this.prisma.admin.findUnique({ where: { dni } }),
    ]);
    if (tutor || staff) throw new ConflictException('Ese DNI ya está registrado');
  }

  private async conteos() {
    const [tutores, alumnos, pagos, supervisores] = await Promise.all([
      this.prisma.tutor.count(),
      this.prisma.student.count(),
      this.prisma.payment.count(),
      this.prisma.admin.count({ where: { rol: 'SUPERVISOR' } }),
    ]);
    return { tutores, alumnos, pagos, supervisores };
  }

  /** Cuándo se guardó el último respaldo en el servidor, si es que hay alguno. */
  private async ultimoRespaldo() {
    const carpeta = join(process.cwd(), 'respaldos');
    try {
      const nombres = (await fs.readdir(carpeta))
        .filter((n) => n.startsWith('omasur-') && n.endsWith('.json'))
        .sort();
      if (nombres.length === 0) return { existe: false, cuando: null, total: 0 };

      const ultimo = nombres[nombres.length - 1];
      const datos = await fs.stat(join(carpeta, ultimo));
      return { existe: true, cuando: datos.mtime, total: nombres.length };
    } catch {
      return { existe: false, cuando: null, total: 0 };
    }
  }
}
