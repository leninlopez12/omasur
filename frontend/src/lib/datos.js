import UBIGEO from './ubigeo.json';

/** Departamentos, provincias y distritos del Perú (INEI). */
export const DEPARTAMENTOS = Object.keys(UBIGEO);

export function provinciasDe(departamento) {
  return Object.keys(UBIGEO[departamento] || {});
}

export function distritosDe(departamento, provincia) {
  return UBIGEO[departamento]?.[provincia] || [];
}

export const GRADOS = [
  { valor: 'TERCERO_PRIMARIA', categoria: 'A', nivel: 'PRIMARIA', label: '3ro de primaria' },
  { valor: 'CUARTO_PRIMARIA', categoria: 'B', nivel: 'PRIMARIA', label: '4to de primaria' },
  { valor: 'QUINTO_PRIMARIA', categoria: 'C', nivel: 'PRIMARIA', label: '5to de primaria' },
  { valor: 'SEXTO_PRIMARIA', categoria: 'D', nivel: 'PRIMARIA', label: '6to de primaria' },
  { valor: 'PRIMERO_SECUNDARIA', categoria: 'E', nivel: 'SECUNDARIA', label: '1ro de secundaria' },
  { valor: 'SEGUNDO_SECUNDARIA', categoria: 'F', nivel: 'SECUNDARIA', label: '2do de secundaria' },
  { valor: 'TERCERO_SECUNDARIA', categoria: 'G', nivel: 'SECUNDARIA', label: '3ro de secundaria' },
  { valor: 'CUARTO_SECUNDARIA', categoria: 'H', nivel: 'SECUNDARIA', label: '4to de secundaria' },
  { valor: 'QUINTO_SECUNDARIA', categoria: 'I', nivel: 'SECUNDARIA', label: '5to de secundaria' },
];

export const ETIQUETA_GRADO = Object.fromEntries(GRADOS.map((g) => [g.valor, g.label]));

/**
 * Modalidades de la institución. El precio y los mínimos los decide el
 * servidor; aquí solo viven los textos, en un solo lugar, porque antes cada
 * pantalla resolvía la etiqueta con su propio "si es estatal, si no particular"
 * y al aparecer una tercera modalidad todas quedaban mintiendo.
 */
export const MODALIDADES = [
  { valor: 'ESTATAL', label: 'Institución estatal', corto: 'Estatal', plural: 'Estatales' },
  {
    valor: 'PARTICULAR',
    label: 'Institución particular',
    corto: 'Particular',
    plural: 'Particulares',
  },
  {
    valor: 'GRUPO_ESTUDIO',
    label: 'Grupo de estudio',
    corto: 'Grupo de estudio',
    plural: 'Grupos de estudio',
  },
];

export const ETIQUETA_MODALIDAD = Object.fromEntries(MODALIDADES.map((m) => [m.valor, m.corto]));
export const ETIQUETA_MODALIDAD_PLURAL = Object.fromEntries(
  MODALIDADES.map((m) => [m.valor, m.plural]),
);

/** Niveles en los que puede competir una institución. */
export const NIVELES_INSTITUCION = [
  { valor: 'PRIMARIA', label: 'Solo primaria' },
  { valor: 'SECUNDARIA', label: 'Solo secundaria' },
  { valor: 'AMBOS', label: 'Primaria y secundaria' },
];

export const ETIQUETA_NIVEL = Object.fromEntries(
  NIVELES_INSTITUCION.map((n) => [n.valor, n.label]),
);

/** Los grados que puede usar una institución según el nivel que declaró. */
export function gradosDeNivel(nivelInstitucion) {
  if (!nivelInstitucion || nivelInstitucion === 'AMBOS') return GRADOS;
  return GRADOS.filter((g) => g.nivel === nivelInstitucion);
}

export const ESTADOS = {
  BORRADOR: { texto: 'Borrador', clase: 'bg-slate-100 text-slate-700' },
  PENDIENTE_PAGO: { texto: 'Pago adjuntado', clase: 'bg-amber-100 text-amber-800' },
  EN_REVISION: { texto: 'En revisión', clase: 'bg-sky-100 text-sky-800' },
  APROBADA: { texto: 'Aprobada', clase: 'bg-emerald-100 text-emerald-800' },
  OBSERVADA: { texto: 'Observada', clase: 'bg-rose-100 text-rose-800' },
};

export const CONTACTO = {
  yape: '928 853 577',
  titular: 'Jhon Arnaldo Mamani Coaquira',
  direccion: 'Carretera salida a Arequipa Km. 05',
  web: 'https://ipeh.edu.pe/',
  institucion: 'IES Colegio de Alta Competencia Ingenieritos del Perú "Eduardo de Habich"',
};

/**
 * Convenios institucionales. Coloque cada logo en frontend/public/img/
 * y ajuste el nombre del archivo si usa otro.
 */
export const CONVENIOS = [
  { nombre: 'UNI', logo: '/img/convenio-uni.png' },
  { nombre: 'DREP Puno', logo: '/img/convenio-drep.png' },
  { nombre: 'UGEL San Román', logo: '/img/convenio-ugel.png' },
];

/**
 * Número del botón flotante de WhatsApp. Formato internacional, sin espacios
 * ni el signo +, tal como lo pide wa.me.
 */
export const WHATSAPP_DIRECTO = {
  numero: '51928853577',
  mensaje: 'Hola, quiero información sobre el I OMASUR UNI 2026',
};
