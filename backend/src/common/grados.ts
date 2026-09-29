import { Grado, Nivel } from '@prisma/client';

export interface GradoInfo {
  grado: Grado;
  categoria: string;
  nivel: Nivel;
  label: string;
}

export const GRADOS: GradoInfo[] = [
  { grado: 'TERCERO_PRIMARIA', categoria: 'A', nivel: 'PRIMARIA', label: '3ro de primaria' },
  { grado: 'CUARTO_PRIMARIA', categoria: 'B', nivel: 'PRIMARIA', label: '4to de primaria' },
  { grado: 'QUINTO_PRIMARIA', categoria: 'C', nivel: 'PRIMARIA', label: '5to de primaria' },
  { grado: 'SEXTO_PRIMARIA', categoria: 'D', nivel: 'PRIMARIA', label: '6to de primaria' },
  { grado: 'PRIMERO_SECUNDARIA', categoria: 'E', nivel: 'SECUNDARIA', label: '1ro de secundaria' },
  { grado: 'SEGUNDO_SECUNDARIA', categoria: 'F', nivel: 'SECUNDARIA', label: '2do de secundaria' },
  { grado: 'TERCERO_SECUNDARIA', categoria: 'G', nivel: 'SECUNDARIA', label: '3ro de secundaria' },
  { grado: 'CUARTO_SECUNDARIA', categoria: 'H', nivel: 'SECUNDARIA', label: '4to de secundaria' },
  { grado: 'QUINTO_SECUNDARIA', categoria: 'I', nivel: 'SECUNDARIA', label: '5to de secundaria' },
];

const BY_GRADO = new Map(GRADOS.map((g) => [g.grado, g]));

const DIACRITICOS = /[̀-ͯ]/g;

/** Acepta el enum, la categoria (A-I) o el texto libre del Excel. */
export function resolverGrado(input: string): GradoInfo | null {
  if (!input) return null;
  const upper = String(input).trim().toUpperCase();

  if (BY_GRADO.has(upper as Grado)) return BY_GRADO.get(upper as Grado);

  const porCategoria = GRADOS.find((g) => g.categoria === upper);
  if (porCategoria) return porCategoria;

  const norm = upper
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const numero = extraerNumero(norm);
  if (!numero) return null;

  if (/PRIM/.test(norm)) {
    return GRADOS.find((g) => g.nivel === 'PRIMARIA' && ordinal(g.label) === numero) || null;
  }
  if (/SEC/.test(norm)) {
    return GRADOS.find((g) => g.nivel === 'SECUNDARIA' && ordinal(g.label) === numero) || null;
  }
  return null;
}

function extraerNumero(texto: string): number | null {
  const digito = texto.match(/(\d)/);
  if (digito) return Number(digito[1]);
  const palabras: Record<string, number> = {
    PRIMERO: 1,
    PRIMER: 1,
    UNO: 1,
    SEGUNDO: 2,
    DOS: 2,
    TERCERO: 3,
    TERCER: 3,
    TRES: 3,
    CUARTO: 4,
    CUATRO: 4,
    QUINTO: 5,
    CINCO: 5,
    SEXTO: 6,
    SEIS: 6,
  };
  for (const [palabra, valor] of Object.entries(palabras)) {
    if (texto.includes(palabra)) return valor;
  }
  return null;
}

function ordinal(label: string): number {
  return Number(label[0]);
}

export function etiquetaGrado(grado: Grado): string {
  return BY_GRADO.get(grado)?.label ?? grado;
}
