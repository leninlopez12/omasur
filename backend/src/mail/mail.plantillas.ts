import { HAY_LOGO, LOGO_CID } from './mail.logo';

const GRANATE = '#7B1E2B';
const FONDO = '#f6f4f5';

/**
 * Cabecera: a la izquierda el nombre del concurso, a la derecha el logo del
 * colegio sobre una placa blanca (el escudo es rojo y sobre el granate no se
 * leería). Va en tabla de dos celdas porque los correos no entienden flexbox.
 */
function cabecera() {
  const logo = HAY_LOGO
    ? `<td align="right" valign="middle" width="76" style="padding-left:16px;">
         <table role="presentation" cellpadding="0" cellspacing="0" align="right">
           <tr><td align="center" valign="middle" style="background:#ffffff;border-radius:14px;padding:8px;">
             <img src="cid:${LOGO_CID}" width="56" height="56" alt="Colegio Eduardo de Habich"
                  style="display:block;width:56px;height:56px;border:0;outline:none;text-decoration:none;">
           </td></tr>
         </table>
       </td>`
    : '';

  return `<tr><td style="background:${GRANATE};padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle">
                <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:.5px;">I OMASUR UNI 2026</p>
                <p style="margin:6px 0 0;color:#f0d9dd;font-size:14px;">Olimpiada Macro Regional Sur de Matem&aacute;tica</p>
              </td>
              ${logo}
            </tr>
          </table>
        </td></tr>`;
}

/** Marco común: los correos usan tablas y estilos en línea por compatibilidad. */
function marco(titulo: string, cuerpo: string) {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:${FONDO};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        ${cabecera()}
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 18px;color:#1f2937;font-size:22px;">${titulo}</h1>
          ${cuerpo}
        </td></tr>
        <tr><td style="background:#faf7f8;padding:20px 32px;border-top:1px solid #eee;">
          <p style="margin:0;color:#7a7a7a;font-size:12px;line-height:18px;">
            IES Colegio de Alta Competencia Ingenieritos del Per&uacute; &laquo;Eduardo de Habich&raquo;<br>
            Este es un mensaje autom&aacute;tico, por favor no lo responda.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function plantillaRecuperacion(nombre: string, enlace: string, minutos: number) {
  const html = marco(
    'Restablecer su contrase&ntilde;a',
    `<p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:26px;">Hola <strong>${nombre}</strong>:</p>
     <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:26px;">
       Recibimos una solicitud para cambiar la contrase&ntilde;a de su cuenta. Presione el bot&oacute;n
       y escriba su nueva contrase&ntilde;a.
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
       <tr><td align="center" style="background:${GRANATE};border-radius:12px;">
         <a href="${enlace}" style="display:inline-block;padding:16px 36px;color:#ffffff;font-size:17px;font-weight:bold;text-decoration:none;">
           Crear nueva contrase&ntilde;a
         </a>
       </td></tr>
     </table>
     <p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:22px;">
       El enlace vence en <strong>${minutos} minutos</strong> y solo puede usarse una vez.
     </p>
     <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:22px;">
       Si el bot&oacute;n no funciona, copie y pegue esta direcci&oacute;n en su navegador:
     </p>
     <p style="margin:0 0 24px;word-break:break-all;"><a href="${enlace}" style="color:${GRANATE};font-size:13px;">${enlace}</a></p>
     <p style="margin:0;padding:14px 16px;background:#fff7ed;border-left:4px solid #f59e0b;color:#7c2d12;font-size:14px;line-height:22px;">
       Si usted no pidi&oacute; este cambio, ignore este mensaje: su contrase&ntilde;a actual seguir&aacute; funcionando.
     </p>`,
  );

  const texto = [
    `Hola ${nombre}:`,
    '',
    'Recibimos una solicitud para cambiar la contraseña de su cuenta en I OMASUR UNI 2026.',
    'Abra este enlace para escribir su nueva contraseña:',
    enlace,
    '',
    `El enlace vence en ${minutos} minutos y solo puede usarse una vez.`,
    'Si usted no pidió este cambio, ignore este mensaje.',
  ].join('\n');

  return { asunto: 'Restablecer su contraseña - I OMASUR UNI 2026', html, texto };
}

export function plantillaClaveCambiada(nombre: string, cuando: string) {
  const html = marco(
    'Su contrase&ntilde;a fue cambiada',
    `<p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:26px;">Hola <strong>${nombre}</strong>:</p>
     <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:26px;">
       La contrase&ntilde;a de su cuenta se cambi&oacute; correctamente el <strong>${cuando}</strong>.
       Ya puede ingresar a su panel con su DNI y la nueva contrase&ntilde;a.
     </p>
     <p style="margin:0;padding:14px 16px;background:#fef2f2;border-left:4px solid #dc2626;color:#7f1d1d;font-size:14px;line-height:22px;">
       Si usted no hizo este cambio, comun&iacute;quese de inmediato con la comisi&oacute;n organizadora.
     </p>`,
  );

  const texto = [
    `Hola ${nombre}:`,
    '',
    `La contraseña de su cuenta en I OMASUR UNI 2026 se cambió el ${cuando}.`,
    'Ya puede ingresar con su DNI y la nueva contraseña.',
    '',
    'Si usted no hizo este cambio, comuníquese de inmediato con la comisión organizadora.',
  ].join('\n');

  return { asunto: 'Su contraseña fue cambiada - I OMASUR UNI 2026', html, texto };
}

/**
 * Aviso de cuenta nueva para un supervisor. Lleva la clave temporal porque es
 * la única forma de que entre la primera vez; el correo le insiste en
 * cambiarla apenas ingrese.
 */
export function plantillaCuentaNueva(nombre: string, correo: string, clave: string) {
  const html = marco(
    'Su cuenta de supervisor',
    `<p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:26px;">Hola <strong>${nombre}</strong>:</p>
     <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:26px;">
       La comisi&oacute;n organizadora le cre&oacute; una cuenta de <strong>supervisor</strong> en
       I OMASUR UNI 2026. Ingrese con estos datos:
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;background:#f8fafc;border-radius:12px;">
       <tr>
         <td style="padding:16px 20px;color:#374151;font-size:15px;line-height:26px;">
           Correo: <strong>${correo}</strong><br>
           Contrase&ntilde;a temporal:
           <strong style="font-family:monospace;font-size:18px;letter-spacing:1px;">${clave}</strong>
         </td>
       </tr>
     </table>
     <p style="margin:0;padding:14px 16px;background:#fffbeb;border-left:4px solid #f59e0b;color:#78350f;font-size:14px;line-height:22px;">
       Esta contrase&ntilde;a es provisional. Al entrar, use
       &laquo;&iquest;Olvid&oacute; su contrase&ntilde;a?&raquo; para poner una suya.
     </p>`,
  );

  const texto = [
    `Hola ${nombre}:`,
    '',
    'La comisión organizadora le creó una cuenta de supervisor en I OMASUR UNI 2026.',
    '',
    `Correo: ${correo}`,
    `Contraseña temporal: ${clave}`,
    '',
    'Esta contraseña es provisional. Al entrar, use «¿Olvidó su contraseña?» para poner una suya.',
  ].join('\n');

  return { asunto: 'Su cuenta de supervisor - I OMASUR UNI 2026', html, texto };
}

/**
 * Aviso de la comisión a los tutores. El texto lo escribe quien manda, así
 * que se escapa y los saltos de línea se vuelven párrafos: nadie va a estar
 * escribiendo HTML en un cuadro de texto.
 */
export function plantillaAviso(nombre: string, asunto: string, mensaje: string) {
  const parrafos = mensaje
    .split(/\n{2,}/)
    .map((bloque) => escapar(bloque.trim()).replace(/\n/g, '<br>'))
    .filter(Boolean)
    .map(
      (bloque) =>
        `<p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:26px;">${bloque}</p>`,
    )
    .join('');

  const html = marco(
    escapar(asunto),
    `<p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:26px;">Hola <strong>${escapar(nombre)}</strong>:</p>
     ${parrafos}
     <p style="margin:24px 0 0;color:#6b7280;font-size:14px;line-height:22px;">
       Comisi&oacute;n Organizadora &middot; I OMASUR UNI 2026
     </p>`,
  );

  const texto = [`Hola ${nombre}:`, '', mensaje, '', 'Comisión Organizadora · I OMASUR UNI 2026'].join(
    '\n',
  );

  return { asunto: `${asunto} - I OMASUR UNI 2026`, html, texto };
}

/** El mensaje lo escribe una persona: no puede colarse etiquetas en el correo. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
