/**
 * Catálogo de permisos.
 *
 * Cada permiso es un módulo del panel: si el supervisor lo tiene, la opción le
 * aparece en el sidebar y el servidor le deja usar las rutas de esa pantalla.
 * Los ids son los mismos que usa `backend/src/permisos/permisos.ts`.
 *
 * `aviso` marca lo que conviene pensar dos veces antes de repartir, y se
 * muestra junto a la casilla para que quien reparte lo lea ahí mismo.
 */
export const PERMISOS_RESULTADOS = [
  {
    id: 'resultados-tutores',
    texto: 'Enviadas por tutores',
    detalle: 'Ver la clasificación de esa tanda y publicarla a los tutores.',
  },
  {
    id: 'resultados-comision',
    texto: 'Llenadas por comisión',
    detalle: 'La otra tanda, con los individuales y las agrupaciones.',
  },
  {
    id: 'resultados-decidir',
    texto: 'Decidir a mano',
    detalle: 'Cambiar la clasificación de cualquier estudiante.',
    aviso: 'Decide quién pasa a la siguiente etapa.',
  },
  {
    id: 'resultados-general',
    texto: 'General y publicación',
    detalle: 'El consolidado de las dos tandas y su publicación.',
  },
  {
    id: 'resultados-consultar',
    texto: 'Consultar y descargar',
    detalle: 'Buscar por institución, tutor o DNI y bajar el Excel.',
  },
  {
    id: 'resultados-encargados',
    texto: 'Supervisor a cargo',
    detalle: 'Repartir estos mismos permisos a los demás supervisores.',
    aviso: 'Puede dar permisos a otros, pero nunca cambiar los suyos.',
  },
  {
    id: 'resultados-publica',
    texto: 'Hacer pública consulta',
    detalle: 'Abrir la consulta por DNI y cambiar el título de la página.',
    aviso: 'Lo que abra aquí lo ve cualquiera en la página pública.',
  },
];

export const PERMISOS_COMISION = [
  {
    id: 'examen',
    texto: 'Examen',
    detalle: 'Recibir, llenar y consultar los envíos del examen.',
  },
  { id: 'tablero', texto: 'Tablero', detalle: 'Las métricas del concurso y el estado del sistema.' },
  {
    id: 'inscripciones',
    texto: 'Inscripciones',
    detalle: 'La revisión alumno por alumno.',
  },
  {
    id: 'delegaciones',
    texto: 'Delegaciones',
    detalle: 'La lista de delegaciones, su revisión y sus comprobantes.',
  },
  { id: 'reportes', texto: 'Reportes', detalle: 'Armar y descargar reportes.' },
  { id: 'abonos', texto: 'Abonos', detalle: 'Lo abonado por cada delegación.' },
  { id: 'consultas', texto: 'Consultas', detalle: 'Buscar tutores y estudiantes.' },
  { id: 'consolidado', texto: 'Consolidado', detalle: 'El consolidado general de inscritos.' },
  {
    id: 'acceder',
    texto: 'Acceder',
    detalle: 'Entrar a la cuenta de cualquier tutor.',
    aviso: 'Entra a cuentas ajenas; dese solo a quien ya atiende a los tutores.',
  },
  {
    id: 'credenciales',
    texto: 'Credenciales',
    detalle: 'Generar las credenciales de delegaciones y tutores.',
  },
  {
    id: 'ajustes',
    texto: 'Ajustes',
    detalle: 'Cierre de inscripciones, Yape, BCP, WhatsApp, bases, imágenes.',
    aviso: 'Toca la página pública. Crear supervisores y los avisos por correo siguen siendo solo del administrador.',
  },
];

export const PERMISOS = [...PERMISOS_RESULTADOS, ...PERMISOS_COMISION];

/** Para pintar el nombre de un permiso sin buscar en las dos listas. */
export const TEXTO_PERMISO = Object.fromEntries(PERMISOS.map((p) => [p.id, p.texto]));
