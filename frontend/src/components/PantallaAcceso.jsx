import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAjustes } from '../lib/ajustes';
import SimbolosMatematicos from './SimbolosMatematicos.jsx';

/**
 * Pantalla partida que comparten ingresar y recuperar contraseña: a la
 * izquierda la imagen del concurso, a la derecha el formulario.
 */
export default function PantallaAcceso({
  titulo,
  claseTitulo = 'text-3xl text-slate-900',
  descripcion,
  volverA = '/',
  volverTexto = 'Volver al inicio',
  children,
  pie,
}) {
  const { ajustes } = useAjustes();

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 items-center overflow-hidden bg-granate-800 p-10 lg:flex xl:p-16">
        {ajustes.imagenLogin && (
          <img
            src={ajustes.imagenLogin}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-granate-800/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.14),transparent_55%)]" />

        <div className="relative">
          {/* whitespace-nowrap: sin esto "I -" quedaba solo en una línea. */}
          <h1 className="whitespace-nowrap text-6xl font-black leading-none tracking-tight text-white xl:text-7xl 2xl:text-8xl">
            I - OMASUR
            {/* Mismo rojo que el hero de la página principal. */}
            <span className="mt-3 block text-red-400">UNI 2026</span>
          </h1>
        </div>
      </div>

      {/* El lado blanco lleva los mismos signos de fondo que la inscripción. */}
      <div className="relative flex w-full items-center justify-center overflow-hidden bg-white p-6 lg:w-1/2 lg:p-16">
        <SimbolosMatematicos compacto />

        <div className="relative w-full max-w-lg">
          {/* Con volverA en null la pantalla va sin el enlace de regreso. */}
          {volverA && (
            <Link
              to={volverA}
              className="mb-10 inline-flex items-center gap-3 text-xl font-semibold text-granate-700"
            >
              <ArrowLeft className="h-6 w-6" />
              {volverTexto}
            </Link>
          )}

          <h2 className={`font-black ${claseTitulo}`}>{titulo}</h2>
          {descripcion && <p className="mt-4 text-xl text-slate-600">{descripcion}</p>}

          {children}

          {pie && <div className="mt-8 text-center text-xl text-slate-600">{pie}</div>}
        </div>
      </div>
    </div>
  );
}
