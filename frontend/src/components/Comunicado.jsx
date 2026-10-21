import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/** El foco 3D que encabeza todos los comunicados. Vive en Cloudflare. */
const ICONO = '/api/publico/iconos/buld.png';

/**
 * Las formas que puede tomar un comunicado.
 *
 * Cambian el color de la cabecera, no el icono: el foco 3D es el mismo
 * siempre, y es lo que hace que se reconozca como comunicado de la comisión.
 * Los degradados van en diagonal y con un brillo encima para que la cabecera
 * se vea con relieve y no como una banda plana.
 */
export const ESTILOS = {
  AVISO: {
    nombre: 'Celeste',
    detalle: 'Celeste bebé en degradado. El de siempre.',
    cabecera: 'bg-[linear-gradient(145deg,#F0F9FF_0%,#CFEBFD_30%,#A5DBFB_62%,#6FC6F5_100%)]',
    titulo: 'text-slate-900',
    caja: 'bg-white/70',
    anillo: 'ring-sky-200',
    firma: 'text-sky-800',
    miniatura: 'from-[#F0F9FF] to-[#6FC6F5]',
  },
  IMPORTANTE: {
    nombre: 'Importante',
    detalle: 'Rojo y con más peso. Para lo urgente.',
    cabecera: 'bg-[linear-gradient(145deg,#F87171_0%,#DC2626_38%,#A3121C_72%,#5A121C_100%)]',
    titulo: 'text-white',
    caja: 'bg-white/20',
    anillo: 'ring-rose-200',
    firma: 'text-rose-700',
    miniatura: 'from-[#F87171] to-[#5A121C]',
  },
  CELEBRACION: {
    nombre: 'Celebración',
    detalle: 'Cálido y festivo. Para resultados y felicitaciones.',
    cabecera: 'bg-[linear-gradient(145deg,#FDE68A_0%,#FBBF24_32%,#F97316_68%,#E11D48_100%)]',
    titulo: 'text-white',
    caja: 'bg-white/25',
    anillo: 'ring-amber-200',
    firma: 'text-orange-700',
    miniatura: 'from-[#FDE68A] to-[#E11D48]',
  },
  SOBRIO: {
    nombre: 'Sobrio',
    detalle: 'Gris claro, sin color. Para lo institucional.',
    cabecera: 'bg-[linear-gradient(145deg,#F8FAFC_0%,#E2E8F0_38%,#CBD5E1_72%,#94A3B8_100%)]',
    titulo: 'text-slate-900',
    caja: 'bg-white/70',
    anillo: 'ring-slate-200',
    firma: 'text-slate-700',
    miniatura: 'from-[#F8FAFC] to-[#94A3B8]',
  },
};

/** Lo que ya cerró el visitante, para no abrírselo de nuevo en cada página. */
const MEMORIA = 'omasur_comunicado_visto';

/**
 * El comunicado sobre la portada.
 *
 * Se abre solo al entrar y se cierra con la X, con Escape o tocando fuera.
 * Una vez cerrado no vuelve a aparecer, hasta que la comisión lo edite: cada
 * guardado cambia su marca de tiempo y con eso se vuelve a mostrar.
 *
 * Con `previo` se dibuja como una tarjeta más de la página, sin fondo oscuro
 * ni cierre: así el panel muestra exactamente lo mismo que verá la gente.
 */
export default function Comunicado({ comunicado, previo = false }) {
  const [abierto, setAbierto] = useState(previo);

  useEffect(() => {
    if (previo) return;
    if (!comunicado?.titulo) return;

    let visto = '';
    try {
      visto = localStorage.getItem(MEMORIA) || '';
    } catch {
      // Navegador con el almacenamiento bloqueado: se muestra igual.
    }
    setAbierto(visto !== comunicado.actualizado);
  }, [comunicado, previo]);

  const cerrar = () => {
    setAbierto(false);
    try {
      localStorage.setItem(MEMORIA, comunicado?.actualizado || '');
    } catch {
      /* si no se puede recordar, se volverá a abrir: no es grave */
    }
  };

  useEffect(() => {
    if (previo || !abierto) return;
    const alPulsar = (evento) => evento.key === 'Escape' && cerrar();
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [abierto, previo]);

  if (!comunicado?.titulo || !abierto) return null;

  const estilo = ESTILOS[comunicado.estilo] || ESTILOS.AVISO;

  const tarjeta = (
    <div
      className={`${
        previo ? '' : 'animate-emerger'
      } relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-[0_45px_90px_-25px_rgba(15,23,42,0.6)] ring-1 ${estilo.anillo}`}
    >
      <div className={`relative px-6 py-8 text-center sm:px-10 sm:py-10 ${estilo.cabecera}`}>
        {/* El brillo de arriba y la sombra de abajo le dan el relieve. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.75),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />

        {!previo && (
          <button
            onClick={cerrar}
            aria-label="Cerrar el comunicado"
            className={`absolute right-4 top-4 z-10 rounded-xl p-2 transition hover:bg-black/10 ${estilo.titulo}`}
          >
            <X className="h-6 w-6" />
          </button>
        )}

        <span
          className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl shadow-[0_12px_24px_-10px_rgba(15,23,42,0.45)] sm:h-24 sm:w-24 ${estilo.caja}`}
        >
          <img
            src={ICONO}
            alt=""
            className="h-14 w-14 object-contain [filter:drop-shadow(0_8px_12px_rgba(15,23,42,0.35))] sm:h-16 sm:w-16"
          />
        </span>

        <h2
          className={`relative mt-6 text-balance text-2xl font-black leading-tight sm:text-3xl ${estilo.titulo}`}
        >
          {comunicado.titulo}
        </h2>
      </div>

      <div className="px-6 py-7 sm:px-10 sm:py-8">
        {/* Se respetan los saltos de línea tal como los escribió la comisión. */}
        {comunicado.descripcion && (
          <p className="whitespace-pre-line text-lg leading-relaxed text-slate-700 sm:text-xl">
            {comunicado.descripcion}
          </p>
        )}

        {comunicado.firma && (
          <p className={`mt-7 text-right text-lg font-bold sm:text-xl ${estilo.firma}`}>
            {comunicado.firma}
          </p>
        )}

        {!previo && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={cerrar}
              className="rounded-2xl bg-slate-900 px-8 py-3 text-lg font-bold text-white transition hover:bg-slate-700"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (previo) return tarjeta;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={cerrar} />
      <div className="relative my-auto flex w-full justify-center">{tarjeta}</div>
    </div>
  );
}
