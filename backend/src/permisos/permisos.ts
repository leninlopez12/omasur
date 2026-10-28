/**
 * Catálogo de permisos.
 *
 * Un permiso es un módulo del panel: si el supervisor lo tiene, la opción le
 * aparece en el sidebar y el servidor le deja usar las rutas de esa pantalla.
 * El administrador los tiene todos sin que nadie se los dé.
 *
 * Los ids son los mismos que usan los paneles del frontend, así que la lista
 * de aquí y la del sidebar no pueden desfasarse sin que salte a la vista.
 */
export const PERMISOS_RESULTADOS = [
  'resultados-tutores',
  'resultados-comision',
  'resultados-decidir',
  'resultados-general',
  'resultados-consultar',
  'resultados-encargados',
  'resultados-publica',
] as const;

export const PERMISOS_COMISION = [
  'examen',
  'tablero',
  'inscripciones',
  'delegaciones',
  'reportes',
  'abonos',
  'consultas',
  'consolidado',
  'acceder',
  'credenciales',
  'ajustes',
] as const;

export const PERMISOS = [...PERMISOS_RESULTADOS, ...PERMISOS_COMISION] as const;

export type Permiso = (typeof PERMISOS)[number];

/** Descarta lo que no esté en el catálogo: el cuerpo de la petición es ajeno. */
export function limpiarPermisos(lista: unknown): Permiso[] {
  if (!Array.isArray(lista)) return [];
  const validos = new Set<string>(PERMISOS);
  return [...new Set(lista.filter((x): x is Permiso => typeof x === 'string' && validos.has(x)))];
}

/** Un supervisor está a cargo de los resultados si tiene al menos uno. */
export function tocaResultados(permisos: string[]) {
  return permisos.some((p) => (PERMISOS_RESULTADOS as readonly string[]).includes(p));
}
