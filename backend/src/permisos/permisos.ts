/**
 * Catálogo de permisos.
 *
 * Un permiso es una pantalla del panel —no un módulo entero—, y su id es el
 * mismo que el de la sección en el sidebar del frontend. Así el reparto se
 * hace pantalla por pantalla y la lista de aquí no puede desfasarse de la del
 * sidebar sin que salte a la vista.
 *
 * El administrador los tiene todos sin que nadie se los dé.
 */

/**
 * La etapa final macrorregional.
 *
 *  es distinto de los demás: no abre una pantalla del panel, abre
 * el aula que le tocó al responsable. Qué aula es lo dice el reparto de
 * salones, no el permiso. El resto son las pantallas de siempre.
 */
export const PERMISOS_FINAL = [
  'final-salon',
  'final-salones',
  'final-reparto',
  'final-listas',
  'final-clave',
  'final-puntaje',
  'final-llenar',
  'final-envios',
  'final-credenciales',
  'final-busqueda',
  'final-cred-tutores',
] as const;

/** Resultados de la final macrorregional. */
export const PERMISOS_FINAL_RESULTADOS = [
  'final-general',
  'final-top',
  'final-premiacion',
  'final-consultar',
  'final-publicacion',
] as const;

/** Resultados de la etapa institucional. */
export const PERMISOS_RESULTADOS = [
  'resultados-tutores',
  'resultados-comision',
  'resultados-decidir',
  'resultados-general',
  'resultados-clasificados',
  'resultados-consultar',
  'resultados-publica',
] as const;

/**
 * Supervisores.
 *
 * Repartir permisos lleva el cerrojo de que nadie cambia los suyos. Las
 * cuentas se reparten también, pero conviene pensarlo: quien entre ahí crea y
 * borra supervisores.
 */
export const PERMISOS_SUPERVISORES = [
  'supervisores-permisos',
  'supervisores-cuentas',
  'supervisores-final',
] as const;

/** El examen institucional, pantalla por pantalla. */
export const PERMISOS_EXAMEN = [
  'examen-respuestas',
  'examen-puntaje',
  'examen-anular',
  'examen-corregir',
  'examen-tutorial',
  'examen-llenar',
  'examen-entregas',
  'examen-consultas',
  'examen-consolidado',
  'examen-enviadas',
  'examen-prueba',
  'examen-clave',
] as const;

export const PERMISOS_CONSULTAS = ['consulta-tutores', 'consulta-estudiantes'] as const;

export const PERMISOS_CREDENCIALES = ['cred-delegaciones', 'cred-tutores'] as const;

export const PERMISOS_AJUSTES = [
  'ajustes-inscripciones',
  'ajustes-whatsapp',
  'ajustes-boton-wa',
  'ajustes-yape',
  'ajustes-bcp',
  'ajustes-credencial',
  'ajustes-comunicado',
  'ajustes-imagenes',
  'ajustes-bases',
] as const;

/** Las pantallas que no cuelgan de ningún grupo. */
export const PERMISOS_PANEL = [
  'tablero',
  'inscripciones',
  'delegaciones',
  'reportes',
  'abonos',
  'consolidado',
  'acceder',
] as const;

export const PERMISOS = [
  ...PERMISOS_FINAL,
  ...PERMISOS_FINAL_RESULTADOS,
  ...PERMISOS_RESULTADOS,
  ...PERMISOS_SUPERVISORES,
  ...PERMISOS_EXAMEN,
  ...PERMISOS_CONSULTAS,
  ...PERMISOS_CREDENCIALES,
  ...PERMISOS_AJUSTES,
  ...PERMISOS_PANEL,
] as const;

export type Permiso = (typeof PERMISOS)[number];

/**
 * Lo que valía un permiso viejo, ahora que son por pantalla.
 *
 * Antes se daba el módulo entero —«examen», «ajustes»— y eso sigue guardado
 * en las filas de quien ya tenía permisos. Al leerlas se abre en las pantallas
 * que ese módulo incluía, para que nadie se quede fuera de lo que ya usaba.
 */
export const GRUPOS_VIEJOS: Record<string, readonly string[]> = {
  examen: PERMISOS_EXAMEN,
  consultas: PERMISOS_CONSULTAS,
  credenciales: PERMISOS_CREDENCIALES,
  ajustes: PERMISOS_AJUSTES,
  'resultados-encargados': PERMISOS_SUPERVISORES,
};

/** Descarta lo que no esté en el catálogo: el cuerpo de la petición es ajeno. */
export function limpiarPermisos(lista: unknown): Permiso[] {
  if (!Array.isArray(lista)) return [];
  const validos = new Set<string>(PERMISOS);

  const sueltos = lista.flatMap((x) =>
    typeof x === 'string' ? (GRUPOS_VIEJOS[x] ? [...GRUPOS_VIEJOS[x]] : [x]) : [],
  );
  return [...new Set(sueltos.filter((x): x is Permiso => validos.has(x)))];
}

export function tocaResultados(permisos: string[]) {
  return permisos.some((p) => (PERMISOS_RESULTADOS as readonly string[]).includes(p));
}
