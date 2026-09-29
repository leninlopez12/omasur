import IconoWhatsApp from './IconoWhatsApp.jsx';
import { WHATSAPP_DIRECTO } from '../lib/datos';

/**
 * Botón flotante de contacto directo, con aviso pulsante tipo radar.
 *
 * El número y el mensaje los configura la comisión desde su panel; los de
 * `datos.js` son el respaldo para cuando los ajustes todavía no cargaron.
 */
export default function BotonWhatsApp({ whatsapp }) {
  const numero = whatsapp?.numero || WHATSAPP_DIRECTO.numero;
  const mensaje = whatsapp?.mensaje || WHATSAPP_DIRECTO.mensaje;
  const enlace = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  return (
    <a
      href={enlace}
      target="_blank"
      rel="noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="animate-saltar fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-whatsapp-400 via-whatsapp-500 to-whatsapp-700 text-white shadow-suave transition hover:scale-110 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 sm:bottom-8 sm:right-8 sm:h-20 sm:w-20"
    >
      <IconoWhatsApp className="h-9 w-9 sm:h-11 sm:w-11" />

      <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5">
        <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-red-500" />
        <span className="relative inline-flex h-5 w-5 rounded-full border-2 border-white bg-red-600" />
      </span>
    </a>
  );
}
