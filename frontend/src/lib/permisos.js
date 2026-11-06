/**
 * Catálogo de permisos.
 *
 * Un permiso es una pantalla del panel, no un módulo entero: así el
 * administrador reparte pantalla por pantalla y nadie entra a lo que no le
 * toca por estar en el mismo grupo. Los ids son los mismos que usan el
 * sidebar y `backend/src/permisos/permisos.ts`.
 *
 * `aviso` marca lo que conviene pensar dos veces antes de repartir, y se
 * muestra junto a la casilla para que quien reparte lo lea ahí mismo.
 */

/** La final macrorregional. Lo único repartible es el aula. */
export const PERMISOS_FINAL = [
  {
    id: 'final-salon',
    texto: 'Mi salón · final',
    detalle: 'Subir el acta de los salones que tenga a su cargo el día de la final.',
    aviso: 'Qué salón vigila se asigna en Examen final · Salones, no aquí.',
  },
];

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
    id: 'resultados-clasificados',
    texto: 'Tutores clasificados',
    detalle: 'Los tutores que llevan gente a la final, con sus datos de contacto.',
    aviso: 'Trae DNI, celular y correo de los tutores.',
  },
  {
    id: 'resultados-consultar',
    texto: 'Consultar y descargar',
    detalle: 'Buscar por institución, tutor o DNI y bajar el Excel.',
  },
  {
    id: 'resultados-publica',
    texto: 'Hacer pública consulta',
    detalle: 'Abrir la consulta por DNI y cambiar el título de la página.',
    aviso: 'Lo que abra aquí lo ve cualquiera en la página pública.',
  },
];

export const PERMISOS_SUPERVISORES = [
  {
    id: 'supervisores-permisos',
    texto: 'Permisos',
    detalle: 'Repartir estos mismos permisos a los demás supervisores.',
    aviso: 'Puede dar permisos a otros, pero nunca cambiar los suyos.',
  },
];

export const PERMISOS_EXAMEN = [
  { id: 'examen-llenar', texto: 'Llenar por delegación', detalle: 'Subir el Excel de una delegación.' },
  { id: 'examen-entregas', texto: 'Entregas recibidas', detalle: 'Qué delegaciones ya enviaron.' },
  { id: 'examen-consultas', texto: 'Consultas de envíos', detalle: 'Quiénes enviaron y quiénes faltan.' },
  { id: 'examen-consolidado', texto: 'Consolidado', detalle: 'El consolidado del examen.' },
  { id: 'examen-enviadas', texto: 'Respuestas enviadas', detalle: 'Las respuestas de una delegación.' },
  { id: 'examen-prueba', texto: 'Prueba de envío', detalle: 'Probar un archivo sin guardarlo.' },
  {
    id: 'examen-clave',
    texto: 'Respuestas correctas',
    detalle: 'Ver la clave, sin poder cambiarla.',
    aviso: 'Deja ver las respuestas correctas antes del examen.',
  },
];

export const PERMISOS_CONSULTAS = [
  { id: 'consulta-tutores', texto: 'Tutores', detalle: 'Buscar tutores y ver su delegación.' },
  { id: 'consulta-estudiantes', texto: 'Estudiantes', detalle: 'Buscar estudiantes por nombre o DNI.' },
];

export const PERMISOS_CREDENCIALES = [
  { id: 'cred-delegaciones', texto: 'De delegaciones', detalle: 'Generar las de los estudiantes.' },
  { id: 'cred-tutores', texto: 'De tutores', detalle: 'Generar las de los tutores.' },
];

export const PERMISOS_AJUSTES = [
  { id: 'ajustes-inscripciones', texto: 'Inscripciones', detalle: 'Abrir y cerrar el periodo.', aviso: 'Cerrarlas frena todo registro nuevo.' },
  { id: 'ajustes-whatsapp', texto: 'Grupo WhatsApp', detalle: 'Los grupos que se ofrecen al inscribirse.' },
  { id: 'ajustes-boton-wa', texto: 'Botón de WhatsApp', detalle: 'El número y el mensaje del botón flotante.' },
  { id: 'ajustes-yape', texto: 'Yape', detalle: 'El QR y el número al que se paga.', aviso: 'Es la cuenta a la que llega el dinero.' },
  { id: 'ajustes-bcp', texto: 'BCP', detalle: 'El titular, la cuenta y el CCI.', aviso: 'Es la cuenta a la que llega el dinero.' },
  { id: 'ajustes-credencial', texto: 'Diseño de credenciales', detalle: 'Los textos de la credencial de cada etapa.' },
  { id: 'ajustes-comunicado', texto: 'Comunicado', detalle: 'El aviso que sale en la portada.', aviso: 'Lo ve cualquiera que entre a la página.' },
  { id: 'ajustes-imagenes', texto: 'Imágenes', detalle: 'El fondo de la portada y del ingreso.', aviso: 'Lo ve cualquiera que entre a la página.' },
  { id: 'ajustes-bases', texto: 'Bases del concurso', detalle: 'El PDF de las bases.', aviso: 'Lo ve cualquiera que entre a la página.' },
];

export const PERMISOS_PANEL = [
  { id: 'tablero', texto: 'Tablero', detalle: 'Las métricas del concurso y el estado del sistema.' },
  { id: 'inscripciones', texto: 'Inscripciones', detalle: 'La revisión alumno por alumno.' },
  { id: 'delegaciones', texto: 'Delegaciones', detalle: 'La lista de delegaciones y sus comprobantes.' },
  { id: 'reportes', texto: 'Reportes', detalle: 'Armar y descargar reportes.' },
  { id: 'abonos', texto: 'Abonos', detalle: 'Lo abonado por cada delegación.' },
  { id: 'consolidado', texto: 'Consolidado', detalle: 'El consolidado general de inscritos.' },
  {
    id: 'acceder',
    texto: 'Acceder',
    detalle: 'Entrar a la cuenta de cualquier tutor.',
    aviso: 'Entra a cuentas ajenas; dese solo a quien ya atiende a los tutores.',
  },
];

/** Los grupos tal como se pintan en la pantalla de reparto. */
export const GRUPOS_PERMISOS = [
  { titulo: 'Final macrorregional', descripcion: 'El día del examen presencial.', permisos: PERMISOS_FINAL },
  { titulo: 'Resultados', descripcion: 'La clasificación de la etapa institucional.', permisos: PERMISOS_RESULTADOS },
  { titulo: 'Examen', descripcion: 'La recepción de respuestas, sin poder definir la prueba.', permisos: PERMISOS_EXAMEN },
  { titulo: 'Panel', descripcion: 'Las pantallas sueltas del panel.', permisos: PERMISOS_PANEL },
  { titulo: 'Consultas', descripcion: 'Buscar personas.', permisos: PERMISOS_CONSULTAS },
  { titulo: 'Credenciales', descripcion: 'Generar credenciales de la etapa institucional.', permisos: PERMISOS_CREDENCIALES },
  { titulo: 'Ajustes', descripcion: 'La configuración del sistema y de la página pública.', permisos: PERMISOS_AJUSTES },
  { titulo: 'Supervisores', descripcion: 'El equipo. Crear y borrar cuentas se queda en el administrador.', permisos: PERMISOS_SUPERVISORES },
];

export const PERMISOS = GRUPOS_PERMISOS.flatMap((g) => g.permisos);

/** Para pintar el nombre de un permiso sin buscar grupo por grupo. */
export const TEXTO_PERMISO = Object.fromEntries(PERMISOS.map((p) => [p.id, p.texto]));
