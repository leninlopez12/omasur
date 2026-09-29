import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { plantillaAviso } from '../mail/mail.plantillas';

/**
 * A quiénes se les puede escribir. Cada grupo responde a una pregunta que la
 * comisión se hace de verdad: "¿a quién le falta pagar?", "¿a quién le aviso
 * que ya entró?".
 */
const GRUPOS = {
  TODOS: { texto: 'Todos los tutores registrados', where: {} },
  APROBADAS: {
    texto: 'Solo delegaciones aprobadas',
    where: { estado: 'APROBADA' as const },
  },
  EN_REVISION: {
    texto: 'Delegaciones esperando revisión',
    where: { estado: 'EN_REVISION' as const },
  },
  OBSERVADAS: {
    texto: 'Delegaciones observadas',
    where: { estado: 'OBSERVADA' as const },
  },
  SIN_ENVIAR: {
    texto: 'Todavía no enviaron su inscripción',
    where: { estado: { in: ['BORRADOR', 'PENDIENTE_PAGO'] as const } },
  },
  SIN_PAGAR: {
    texto: 'Tienen estudiantes sin comprobante',
    where: { students: { some: { paymentId: null } } },
  },
} as const;

export type GrupoAviso = keyof typeof GRUPOS;

/** Tandas chicas y con pausa: un envío de golpe termina marcado como spam. */
const POR_TANDA = 15;
const PAUSA_MS = 4000;

@Injectable()
export class AvisosService {
  private readonly log = new Logger('Avisos');

  constructor(
    private prisma: PrismaService,
    private correo: MailService,
  ) {}

  /** Los grupos con cuánta gente hay en cada uno, para elegir con criterio. */
  async grupos() {
    const entradas = Object.entries(GRUPOS) as [GrupoAviso, (typeof GRUPOS)[GrupoAviso]][];

    return Promise.all(
      entradas.map(async ([id, conf]) => ({
        id,
        texto: conf.texto,
        total: await this.prisma.tutor.count({
          where: { ...(conf.where as any), correo: { not: '' } },
        }),
      })),
    );
  }

  /** Quiénes recibirían el aviso: se muestran los primeros antes de mandar. */
  async destinatarios(grupo: GrupoAviso) {
    const conf = this.grupoValido(grupo);
    const tutores = await this.prisma.tutor.findMany({
      where: { ...(conf.where as any), correo: { not: '' } },
      select: { id: true, correo: true, nombres: true, apellidos: true, institucion: true },
      orderBy: { institucion: 'asc' },
    });
    return tutores;
  }

  /** Prueba: el mismo correo, a una sola dirección, para verlo antes de mandar. */
  async prueba(para: string, asunto: string, mensaje: string) {
    this.validar(asunto, mensaje);
    if (!this.correo.activo) {
      throw new ServiceUnavailableException('El correo no está configurado');
    }

    const armado = plantillaAviso('(vista previa)', asunto, mensaje);
    await this.correo.enviar({ para, ...armado });
    return { ok: true, para };
  }

  /**
   * Manda el aviso. Devuelve enseguida y sigue enviando de fondo: con cientos
   * de tutores, esperar a que termine dejaría la pantalla colgada varios
   * minutos. El avance queda en la base y se consulta desde el historial.
   */
  async enviar(grupo: GrupoAviso, asunto: string, mensaje: string, quien?: string) {
    this.validar(asunto, mensaje);
    if (!this.correo.activo) {
      throw new ServiceUnavailableException('El correo no está configurado');
    }

    const enCurso = await this.prisma.avisoMasivo.count({ where: { estado: 'ENVIANDO' } });
    if (enCurso > 0) {
      throw new BadRequestException('Ya hay un aviso enviándose. Espere a que termine.');
    }

    const tutores = await this.destinatarios(grupo);
    if (tutores.length === 0) {
      throw new BadRequestException('Ese grupo no tiene a nadie con correo registrado');
    }

    const aviso = await this.prisma.avisoMasivo.create({
      data: {
        grupo,
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
        total: tutores.length,
        creadoPor: quien || null,
      },
    });

    void this.repartir(aviso.id, tutores, asunto.trim(), mensaje.trim());

    return { id: aviso.id, total: tutores.length, estado: 'ENVIANDO' };
  }

  historial() {
    return this.prisma.avisoMasivo.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  }

  // --------------------------------------------------------------------

  private async repartir(
    avisoId: string,
    tutores: { correo: string; nombres: string; apellidos: string }[],
    asunto: string,
    mensaje: string,
  ) {
    let enviados = 0;
    let fallidos = 0;

    for (let i = 0; i < tutores.length; i += POR_TANDA) {
      const tanda = tutores.slice(i, i + POR_TANDA);

      for (const tutor of tanda) {
        const nombre = `${tutor.nombres} ${tutor.apellidos}`.trim();
        try {
          const armado = plantillaAviso(nombre, asunto, mensaje);
          await this.correo.enviar({ para: tutor.correo, ...armado });
          enviados += 1;
        } catch (error: any) {
          fallidos += 1;
          this.log.warn(`No salió para ${tutor.correo}: ${error?.message ?? error}`);
        }
      }

      await this.prisma.avisoMasivo
        .update({ where: { id: avisoId }, data: { enviados, fallidos } })
        .catch(() => undefined);

      if (i + POR_TANDA < tutores.length) await this.esperar(PAUSA_MS);
    }

    await this.prisma.avisoMasivo
      .update({
        where: { id: avisoId },
        data: { enviados, fallidos, estado: 'TERMINADO', cerradoEn: new Date() },
      })
      .catch(() => undefined);

    this.log.log(`Aviso ${avisoId}: ${enviados} enviados, ${fallidos} fallidos.`);
  }

  private esperar(ms: number) {
    return new Promise((listo) => setTimeout(listo, ms));
  }

  private grupoValido(grupo: GrupoAviso) {
    const conf = GRUPOS[grupo];
    if (!conf) throw new BadRequestException('Grupo de destinatarios no reconocido');
    return conf;
  }

  private validar(asunto: string, mensaje: string) {
    if (!asunto?.trim()) throw new BadRequestException('Escriba el asunto');
    if (!mensaje?.trim()) throw new BadRequestException('Escriba el mensaje');
    if (asunto.trim().length > 120) throw new BadRequestException('El asunto es muy largo');
    if (mensaje.trim().length > 4000) throw new BadRequestException('El mensaje es muy largo');
  }
}
