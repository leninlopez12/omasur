import {
  AlertCircle,
  Bell,
  CheckCircle2,
  CreditCard,
  MessageSquare,
  Send,
  UserPlus,
  X,
} from 'lucide-react';
import { esPrioritaria, useNotificaciones } from '../lib/notificaciones.jsx';

const ICONOS = {
  TUTOR_REGISTRADO: UserPlus,
  PAGO_ENVIADO: CreditCard,
  INSCRIPCION_ENVIADA: Send,
  OBSERVACION_ABSUELTA: MessageSquare,
  INSCRIPCION_APROBADA: CheckCircle2,
  INSCRIPCION_OBSERVADA: AlertCircle,
};

/**
 * Tarjetas que saltan en la esquina cuando llega un aviso nuevo.
 * Las de inscripción enviada se quedan hasta que alguien las atienda.
 */
export default function AvisosEnVivo({ alAbrirTutor }) {
  const { avisos, descartarAviso, marcarLeida } = useNotificaciones();

  if (avisos.length === 0) return null;

  const abrir = async (aviso) => {
    descartarAviso(aviso.id);
    if (!aviso.leida) await marcarLeida(aviso.id);
    if (aviso.tutorId && alAbrirTutor) alAbrirTutor(aviso.tutorId);
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[22rem] flex-col gap-3">
      {avisos.map((aviso) => {
        const Icono = ICONOS[aviso.tipo] || Bell;
        const urgente = esPrioritaria(aviso.tipo);

        return (
          <div
            key={aviso.id}
            className={`animate-aparecer pointer-events-auto rounded-2xl shadow-suave ${
              urgente
                ? 'border-2 border-granate-700 bg-granate-600 text-white'
                : 'border border-granate-200 bg-white'
            }`}
          >
            <div className="flex gap-3 p-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  urgente ? 'bg-white/20 text-white' : 'bg-granate-600 text-white'
                }`}
              >
                <Icono className="h-5 w-5" />
              </span>

              <button onClick={() => abrir(aviso)} className="min-w-0 flex-1 text-left">
                {urgente && (
                  <span className="mb-1 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[0.7rem] font-black uppercase tracking-wide">
                    Requiere aprobación
                  </span>
                )}
                <p className={`text-base font-bold ${urgente ? 'text-white' : 'text-slate-900'}`}>
                  {aviso.titulo}
                </p>
                <p className={`mt-0.5 text-sm ${urgente ? 'text-granate-100' : 'text-slate-600'}`}>
                  {aviso.detalle}
                </p>
              </button>

              <button
                onClick={() => descartarAviso(aviso.id)}
                aria-label="Descartar aviso"
                className={`h-fit rounded-lg p-1 transition ${
                  urgente ? 'text-granate-200 hover:bg-white/15' : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {urgente && (
              <button
                onClick={() => abrir(aviso)}
                className="w-full rounded-b-2xl bg-white/15 py-2.5 text-sm font-black uppercase tracking-wide transition hover:bg-white/25"
              >
                Revisar ahora
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
