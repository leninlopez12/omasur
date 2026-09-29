import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { HAY_LOGO, LOGO_CID, RUTA_LOGO } from './mail.logo';

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

/**
 * Envío de correos por SMTP. Sirve con Gmail, Brevo o cualquier proveedor.
 * Si no hay credenciales configuradas el sistema no se cae: avisa por consola
 * y sigue funcionando, para que el desarrollo no dependa del correo.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly log = new Logger('Correo');
  private transporte: Transporter | null = null;
  private remitente = '';

  async onModuleInit() {
    const host = process.env.SMTP_HOST?.trim();
    const usuario = process.env.SMTP_USER?.trim();
    const clave = process.env.SMTP_PASS?.trim();
    const puerto = Number(process.env.SMTP_PORT || 587);

    if (!host || !usuario || !clave) {
      this.log.warn('Sin credenciales SMTP: los correos se mostrarán en consola.');
      return;
    }

    this.remitente = process.env.SMTP_FROM?.trim() || `OMASUR UNI 2026 <${usuario}>`;
    this.transporte = nodemailer.createTransport({
      host,
      port: puerto,
      secure: puerto === 465,
      auth: { user: usuario, pass: clave },
    });

    try {
      await this.transporte.verify();
      this.log.log(`Correo listo por ${host}:${puerto} como ${usuario}.`);
      if (HAY_LOGO) this.log.log(`Logo del colegio en la cabecera: ${RUTA_LOGO}`);
      else this.log.warn('No se encontró el logo: los correos saldrán solo con el texto.');
    } catch (error) {
      // No se desactiva: puede ser un corte momentáneo. Se intentará al enviar.
      this.log.warn(`SMTP configurado pero sin responder: ${(error as Error).message}`);
    }
  }

  get activo() {
    return this.transporte !== null;
  }

  /** Devuelve true si el correo salió. Nunca lanza: el flujo no debe romperse. */
  async enviar(correo: Correo): Promise<boolean> {
    if (!this.transporte) {
      this.log.warn(`[correo simulado] Para: ${correo.para} | ${correo.asunto}`);
      this.log.warn(correo.texto);
      return false;
    }

    try {
      const envio = await this.transporte.sendMail({
        from: this.remitente,
        to: correo.para,
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
        // `cid` deja la imagen incrustada en la cabecera y no como archivo suelto.
        attachments: HAY_LOGO
          ? [{ filename: 'logo.png', path: RUTA_LOGO, cid: LOGO_CID, contentDisposition: 'inline' }]
          : [],
      });
      this.log.log(`Correo enviado a ${correo.para} (${envio.messageId}).`);
      return true;
    } catch (error) {
      this.log.error(`No se pudo enviar a ${correo.para}: ${(error as Error).message}`);
      return false;
    }
  }
}
