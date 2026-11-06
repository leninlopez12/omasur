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
 * Lo único que se reparte es el aula del responsable, y es distinto de todos
 * los demás: no abre un módulo, abre el aula que le tocó. Qué aula es lo dice
 * el reparto de salones, no el permiso.
 *
 * Lo demás de la final —la clave, el reparto, la premiación— se queda en el
 * administrador y no hay forma de concederlo.
 */
export const PERMISOS_FINAL = ['final-salon'] as const;

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
 * Repartir permisos sí se delega —con el cerrojo de que nadie cambia los
 * suyos—; crear y borrar cuentas no, que es la llave del equipo entero.
 */
export const PERMISOS_SUPERVISORES = ['supervisores-permisos'] as const;

/** El examen institucional, en la versión recortada del supervisor. */
export const PERMISOS_EXAMEN = [
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
