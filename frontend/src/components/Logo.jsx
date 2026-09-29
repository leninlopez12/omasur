import { useState } from 'react';

/**
 * Emblema del concurso. Es el mismo que se ve en la pestaña del navegador.
 *
 * Lo usan el navbar de la portada, el sidebar de los tres paneles, el pie de
 * página, la credencial y el asistente de inscripción: cambiándolo aquí cambia
 * en todos. Las rutas de abajo son respaldos por si el archivo se renombra;
 * mientras no exista ninguno se muestra la marca "OM".
 */
const RUTAS = [
  '/img/logo/omasur.jpg',
  '/img/logo.png',
  '/img/logo.jpg',
  '/img/logo.jpeg',
  '/img/logo.webp',
  '/img/logo.svg',
];

export default function Logo({ tamano = 'h-12 w-12', invertido = false }) {
  const [intento, setIntento] = useState(0);

  if (intento >= RUTAS.length) {
    return (
      <span
        className={`flex ${tamano} items-center justify-center rounded-2xl text-xl font-black ${
          invertido ? 'bg-white text-granate-700' : 'bg-granate-600 text-white'
        }`}
      >
        OM
      </span>
    );
  }

  return (
    <img
      src={RUTAS[intento]}
      alt="I OMASUR UNI 2026"
      onError={() => setIntento((n) => n + 1)}
      className={`${tamano} rounded-2xl bg-white object-contain p-0.5`}
    />
  );
}
