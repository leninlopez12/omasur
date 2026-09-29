import { Modalidad, NivelInstitucion } from '@prisma/client';
import { GRADOS } from './grados';

export interface ResumenGrado {
  grado: string;
  label: string;
  categoria: string;
  nivel: string;
  cantidad: number;
  minimo: number;
  cumple: boolean;
}

export interface ValidacionDelegacion {
  total: number;
  minimoTotal: number;
  cumpleTotal: boolean;
  soloUnNivel: boolean;
  porGrado: ResumenGrado[];
  errores: string[];
  puedeEnviar: boolean;
}

/**
 * Mínimo de estudiantes por grado. Los grupos de estudio no tienen exigencia
 * por grado: pueden repartir sus 15 como quieran, o llevarlos todos en uno.
 */
const MIN_POR_GRADO: Record<Modalidad, number> = {
  ESTATAL: 5,
  PARTICULAR: 10,
  GRUPO_ESTUDIO: 0,
};

/** Mínimo total cuando la institución compite en los dos niveles. */
const MIN_TOTAL: Record<Modalidad, number> = {
  ESTATAL: 30,
  PARTICULAR: 60,
  GRUPO_ESTUDIO: 15,
};

/** Con un solo nivel el mínimo baja a 15, cualquiera sea la modalidad. */
const MIN_TOTAL_UN_NIVEL = 15;

/** Los grados que puede usar la institución según el nivel que declaró. */
export function gradosPermitidos(nivel: NivelInstitucion) {
  if (nivel === 'AMBOS') return GRADOS;
  return GRADOS.filter((g) => g.nivel === nivel);
}

/**
 * Los mínimos que le tocan a una delegación. Se saca aparte porque la
 * plantilla de Excel los imprime en sus instrucciones, y tienen que ser los
 * mismos que después aplica la validación.
 */
export function minimosDe(modalidad: Modalidad, nivelInstitucion: NivelInstitucion) {
  // El mínimo lo manda el nivel que declaró la institución, no el que se
  // deduzca de los alumnos cargados hasta ahora: si no, una delegación de dos
  // niveles a medio llenar se validaría con el mínimo del nivel único.
  const unNivel = nivelInstitucion !== 'AMBOS';
  const total =
    modalidad === 'GRUPO_ESTUDIO'
      ? MIN_TOTAL.GRUPO_ESTUDIO
      : unNivel
        ? MIN_TOTAL_UN_NIVEL
        : MIN_TOTAL[modalidad];

  return { total, porGrado: MIN_POR_GRADO[modalidad], unNivel };
}

export function validarDelegacion(
  alumnos: { grado: string; nivel: string }[],
  modalidad: Modalidad,
  nivelInstitucion: NivelInstitucion = 'AMBOS',
): ValidacionDelegacion {
  const { total: minimoTotal, porGrado: minGrado, unNivel } = minimosDe(modalidad, nivelInstitucion);

  const permitidos = gradosPermitidos(nivelInstitucion);
  const porGrado: ResumenGrado[] = permitidos.map((g) => {
    const cantidad = alumnos.filter((a) => a.grado === g.grado).length;
    return {
      grado: g.grado,
      label: g.label,
      categoria: g.categoria,
      nivel: g.nivel,
      cantidad,
      minimo: minGrado,
      // Un grado vacío no estorba: solo se exige el mínimo al que se usa.
      cumple: cantidad === 0 || minGrado === 0 || cantidad >= minGrado,
    };
  });

  const errores: string[] = [];
  const total = alumnos.length;

  if (total < minimoTotal) {
    errores.push(`Debe inscribir al menos ${minimoTotal} estudiantes en total (tiene ${total}).`);
  }
  for (const g of porGrado) {
    if (!g.cumple) {
      errores.push(`${g.label}: mínimo ${g.minimo} estudiantes (tiene ${g.cantidad}).`);
    }
  }

  // Alumnos de un nivel que la institución no declaró: quedan fuera de
  // "porGrado", así que sin este aviso desaparecerían del conteo sin explicar.
  const fuera = alumnos.filter((a) => !permitidos.some((g) => g.grado === a.grado));
  if (fuera.length) {
    errores.push(
      `Tiene ${fuera.length} estudiante(s) en un nivel que su institución ya no declara. ` +
        'Cámbielos de grado o ajuste el nivel en sus datos.',
    );
  }

  return {
    total,
    minimoTotal,
    cumpleTotal: total >= minimoTotal,
    soloUnNivel: unNivel,
    porGrado,
    errores,
    puedeEnviar: errores.length === 0,
  };
}

/**
 * Costo de inscripción por estudiante, según la modalidad de la institución.
 * Estatal (pública) S/ 12 · Particular y grupos de estudio S/ 17.
 */
export function precioPorAlumno(modalidad: Modalidad): number {
  return modalidad === 'ESTATAL'
    ? Number(process.env.PRECIO_ESTATAL || 12)
    : Number(process.env.PRECIO_PARTICULAR || 17);
}
