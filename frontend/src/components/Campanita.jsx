import { useEffect, useRef, useState } from 'react';
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

const COLORES = {
  TUTOR_REGISTRADO: 'bg-sky-100 text-sky-700',
  PAGO_ENVIADO: 'bg-yape-100 text-yape-700',
  INSCRIPCION_ENVIADA: 'bg-emerald-100 text-emerald-700',
  OBSERVACION_ABSUELTA: 'bg-sky-100 text-sky-700',
  INSCRIPCION_APROBADA: 'bg-emerald-100 text-emerald-700',
  INSCRIPCION_OBSERVADA: 'bg-amber-100 text-amber-700',
};

/** "hace 5 min", "hace 2 h", o la fecha si ya pasó más de una semana. */
export function haceCuanto(fecha) {
  const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 7) return `hace ${dias} d`;
  return new Date(fecha).toLocaleDateString('es-PE');
}

export default function Campanita({ alAbrirTutor, alIrAAprobar }) {
  const { notificaciones, sinLeer, enVivo, marcarLeida, marcarTodasLeidas } = useNotificaciones();
  const [abierto, setAbierto] = useState(false);
  /**
   * Los que estaban sin leer al abrir. Abrir la campanita ya los marca leídos,
   * así que sin esta copia el resaltado y el aviso de «por aprobar» se
   * apagarían de golpe delante de quien acaba de abrir el panel.
   */
  const [recienLlegados, setRecienLlegados] = useState(() => new Set());
  const contenedor = useRef(null);

  const cerrarPanel = () => {
    setAbierto(false);
    setRecienLlegados(new Set());
  };

  const abrirPanel = () => {
    if (abierto) return cerrarPanel();
    setRecienLlegados(new Set(notificaciones.filter((n) => !n.leida).map((n) => n.id)));
    if (sinLeer > 0) marcarTodasLeidas().catch(() => {});
    setAbierto(true);
  };

  const esNuevo = (n) => !n.leida || recienLlegados.has(n.id);
  const porAprobar = notificaciones.filter((n) => esPrioritaria(n.tipo) && esNuevo(n)).length;

  useEffect(() => {
    if (!abierto) return;
    const alClicFuera = (evento) => {
      if (!contenedor.current?.contains(evento.target)) cerrarPanel();
    };
    document.addEventListener('mousedown', alClicFuera);
    return () => document.removeEventListener('mousedown', alClicFuera);
  }, [abierto]);

  const abrir = async (notificacion) => {
    if (!notificacion.leida) await marcarLeida(notificacion.id);
    if (notificacion.tutorId && alAbrirTutor) {
      alAbrirTutor(notificacion.tutorId);
      cerrarPanel();
    }
  };

  return (
    <div ref={contenedor} className="relative">
      <button
        onClick={abrirPanel}
        aria-label={sinLeer ? `${sinLeer} avisos sin leer` : 'Avisos'}
        className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-granate-50 hover:text-granate-700"
      >
        <Bell className="h-6 w-6" />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5">
            <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-granate-500" />
            <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-granate-600 text-[0.7rem] font-black text-white">
              {sinLeer > 9 ? '9+' : sinLeer}
            </span>
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-3 w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-suave sm:w-[26rem]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <p className="text-base font-black text-slate-900">Avisos</p>
              <span
                title={enVivo ? 'Conectado en tiempo real' : 'Reconectando'}
                className={`h-2.5 w-2.5 rounded-full ${
                  enVivo ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={cerrarPanel}
                aria-label="Cerrar avisos"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {porAprobar > 0 && (
            <button
              onClick={() => {
                alIrAAprobar?.();
                cerrarPanel();
              }}
              className="flex w-full items-center justify-between gap-3 bg-granate-600 px-5 py-3.5 text-left text-white transition hover:bg-granate-700"
            >
              <span className="flex items-center gap-2.5">
                <Send className="h-5 w-5 shrink-0" />
                <span className="text-base font-black">
                  {porAprobar}{' '}
                  {porAprobar === 1 ? 'inscripción espera' : 'inscripciones esperan'} aprobación
                </span>
              </span>
              <span className="text-sm font-bold uppercase tracking-wide">Ver</span>
            </button>
          )}

          <div className="max-h-[26rem] overflow-y-auto">
            {notificaciones.length === 0 ? (
              <p className="px-5 py-10 text-center text-base text-slate-500">
                Todavía no hay avisos.
              </p>
            ) : (
              notificaciones.map((n) => {
                const Icono = ICONOS[n.tipo] || Bell;
                const urgente = esPrioritaria(n.tipo);

                return (
                  <button
                    key={n.id}
                    onClick={() => abrir(n)}
                    className={`flex w-full gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-granate-50/60 ${
                      urgente ? 'border-l-4 border-l-granate-600' : ''
                    } ${esNuevo(n) ? 'bg-granate-50/40' : ''}`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        urgente
                          ? 'bg-granate-600 text-white'
                          : COLORES[n.tipo] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icono className="h-5 w-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-base font-bold text-slate-900">{n.titulo}</span>
                        {esNuevo(n) && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-granate-600" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-600">{n.detalle}</span>
                      <span className="mt-1 flex items-center gap-2">
                        {urgente && esNuevo(n) && (
                          <span className="rounded-full bg-granate-100 px-2 py-0.5 text-[0.7rem] font-black uppercase tracking-wide text-granate-700">
                            Por aprobar
                          </span>
                        )}
                        <span className="text-sm text-slate-400">{haceCuanto(n.createdAt)}</span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
