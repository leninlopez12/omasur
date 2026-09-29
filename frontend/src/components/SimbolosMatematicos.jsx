/**
 * Signos matemáticos de adorno para el fondo.
 *
 * Van dibujados como trazos con las puntas redondeadas, no como letras: así se
 * ven suaves y no con esquinas duras. Cada uno lleva su giro, su tamaño y su
 * transparencia, para que el conjunto no parezca un patrón repetido.
 *
 * `compacto` usa menos signos y más pegados a los bordes, para columnas
 * angostas como la del ingreso.
 */
export default function SimbolosMatematicos({ compacto = false }) {
  const lista = compacto ? SIGNOS_COMPACTOS : SIGNOS;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute h-0 w-0">
        <defs>
          <linearGradient id="tintaSigno" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7B1E2B" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>
      </svg>

      {lista.map(({ tipo, clase, giro, opacidad }, indice) => (
        <span
          key={indice}
          className={`absolute ${clase}`}
          style={{ transform: `rotate(${giro}deg)`, opacity: opacidad }}
        >
          <Signo tipo={tipo} />
        </span>
      ))}
    </div>
  );
}

/** Cada signo como trazo, con las puntas y los quiebres redondeados. */
function Signo({ tipo }) {
  const comunes = {
    viewBox: '0 0 100 100',
    fill: 'none',
    stroke: 'url(#tintaSigno)',
    strokeWidth: 9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'h-full w-full',
  };

  if (tipo === 'mas') {
    return (
      <svg {...comunes}>
        <path d="M50 22 L50 78 M22 50 L78 50" />
      </svg>
    );
  }

  if (tipo === 'menos') {
    return (
      <svg {...comunes}>
        <path d="M22 50 L78 50" />
      </svg>
    );
  }

  if (tipo === 'por') {
    return (
      <svg {...comunes}>
        <path d="M28 28 L72 72 M72 28 L28 72" />
      </svg>
    );
  }

  if (tipo === 'entre') {
    return (
      <svg {...comunes}>
        <path d="M24 50 L76 50" />
        <circle cx="50" cy="28" r="5.5" fill="url(#tintaSigno)" stroke="none" />
        <circle cx="50" cy="72" r="5.5" fill="url(#tintaSigno)" stroke="none" />
      </svg>
    );
  }

  // Sumatoria
  return (
    <svg {...comunes}>
      <path d="M74 24 L28 24 L54 50 L28 76 L74 76" />
    </svg>
  );
}

/** Mezcla a propósito: unos bien marcados y otros apenas insinuados. */
const SIGNOS = [
  // Franja izquierda
  { tipo: 'sigma', clase: 'left-[3%] top-[12%] h-28 w-28', giro: -14, opacidad: 0.38 },
  { tipo: 'mas', clase: 'left-[14%] top-[4%] h-16 w-16', giro: 18, opacidad: 0.16 },
  { tipo: 'por', clase: 'left-[17%] top-[27%] h-20 w-20', giro: 24, opacidad: 0.3 },
  { tipo: 'menos', clase: 'left-[5%] top-[40%] h-24 w-24', giro: -28, opacidad: 0.2 },
  { tipo: 'entre', clase: 'left-[16%] top-[54%] h-16 w-16', giro: 10, opacidad: 0.34 },
  { tipo: 'sigma', clase: 'left-[7%] top-[68%] h-20 w-20', giro: 16, opacidad: 0.14 },
  { tipo: 'mas', clase: 'left-[15%] bottom-[10%] h-24 w-24', giro: -20, opacidad: 0.32 },
  { tipo: 'por', clase: 'left-[2%] bottom-[22%] h-16 w-16', giro: 12, opacidad: 0.18 },

  // Franja derecha
  { tipo: 'por', clase: 'right-[4%] top-[18%] h-28 w-28', giro: 18, opacidad: 0.36 },
  { tipo: 'menos', clase: 'right-[16%] top-[8%] h-20 w-20', giro: -24, opacidad: 0.15 },
  { tipo: 'sigma', clase: 'right-[14%] top-[34%] h-24 w-24', giro: 12, opacidad: 0.28 },
  { tipo: 'mas', clase: 'right-[3%] top-[48%] h-20 w-20', giro: -16, opacidad: 0.19 },
  { tipo: 'entre', clase: 'right-[17%] top-[62%] h-16 w-16', giro: 22, opacidad: 0.33 },
  { tipo: 'por', clase: 'right-[6%] bottom-[24%] h-20 w-20', giro: -12, opacidad: 0.16 },
  { tipo: 'sigma', clase: 'right-[15%] bottom-[8%] h-24 w-24', giro: -18, opacidad: 0.3 },
  { tipo: 'mas', clase: 'right-[2%] bottom-[5%] h-16 w-16', giro: 26, opacidad: 0.13 },
];

/** Para columnas angostas: pocos signos y pegados a las orillas. */
const SIGNOS_COMPACTOS = [
  { tipo: 'sigma', clase: 'left-[2%] top-[10%] h-24 w-24', giro: -14, opacidad: 0.32 },
  { tipo: 'mas', clase: 'left-[8%] top-[38%] h-16 w-16', giro: 18, opacidad: 0.16 },
  { tipo: 'por', clase: 'left-[3%] bottom-[14%] h-20 w-20', giro: 22, opacidad: 0.28 },
  { tipo: 'menos', clase: 'left-[10%] bottom-[38%] h-16 w-16', giro: -26, opacidad: 0.14 },
  { tipo: 'por', clase: 'right-[3%] top-[14%] h-24 w-24', giro: 16, opacidad: 0.3 },
  { tipo: 'entre', clase: 'right-[9%] top-[44%] h-16 w-16', giro: -18, opacidad: 0.18 },
  { tipo: 'sigma', clase: 'right-[4%] bottom-[12%] h-20 w-20', giro: 12, opacidad: 0.26 },
  { tipo: 'mas', clase: 'right-[12%] bottom-[34%] h-16 w-16', giro: -22, opacidad: 0.15 },
];
