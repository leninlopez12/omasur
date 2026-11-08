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

/** El examen de la final macrorregional. */
export const PERMISOS_FINAL = [
  {
    id: 'final-salon',
    texto: 'Mi salón · final',
    detalle: 'Subir el acta de los salones que tenga a su cargo el día de la final.',
    aviso: 'Qué salón vigila se asigna en Examen final · Salones, no aquí.',
  },
  { id: 'final-salones', texto: 'Salones y horarios', detalle: 'El día, los turnos y quién vigila cada aula.' },
  { id: 'final-reparto', texto: 'Reparto de alumnos', detalle: 'Mover alumnos de salón, abrir y cerrar aulas.' },
  { id: 'final-listas', texto: 'Lista de salones', detalle: 'Bajar las listas que se pegan en la puerta.' },
  {
    id: 'final-clave',
    texto: 'Respuestas correctas',
    detalle: 'Cargar la clave de cada categoría.',
    aviso: 'Deja ver y cambiar las respuestas correctas de la final.',
  },
  { id: 'final-puntaje', texto: 'Puntaje y apertura', detalle: 'Lo que vale cada respuesta y abrir el envío.' },
  { id: 'final-llenar', texto: 'Llenar por salón', detalle: 'Subir el acta de cualquier salón.' },
  { id: 'final-envios', texto: 'Consulta de envíos', detalle: 'Qué salones entregaron, anular y corregir.' },
  { id: 'final-credenciales', texto: 'Credenciales', detalle: 'Abrir las credenciales e imprimirlas.' },
  { id: 'final-busqueda', texto: 'Credenciales de alumnos', detalle: 'Buscar finalistas y mandarles su credencial.' },
  { id: 'final-cred-tutores', texto: 'Credenciales de tutores', detalle: 'Las credenciales de los tutores que acompañan.' },
];

/** Los resultados de la final. */
export const PERMISOS_FINAL_RESULTADOS = [
  { id: 'final-general', texto: 'General', detalle: 'El mejor y el peor puntaje, y cada categoría.' },
  { id: 'final-top', texto: 'Por categoría', detalle: 'Los primeros puestos de cada categoría.' },
  { id: 'final-premiacion', texto: 'Premiación', detalle: 'El orden en que se llama al estrado.' },
  {
    id: 'final-presentacion',
    texto: 'Presentación resultados',
    detalle: 'Las láminas de la premiación para proyectarlas en pantalla grande.',
    aviso: 'Enseña los ganadores de todos los lugares antes de que se anuncien.',
  },
  { id: 'final-consultar', texto: 'Consultar', detalle: 'Buscar cómo le fue a una delegación.' },
  {
    id: 'final-consolidado',
    texto: 'Consolidado general',
    detalle: 'La final entera: los diez primeros, el mejor de cada categoría y los colegios.',
  },
  {
    id: 'final-publicacion',
    texto: 'Publicación y consulta',
    detalle: 'Abrir los resultados a los tutores y al público.',
    aviso: 'Lo que abra aquí lo ve cualquiera en la página pública.',
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
    id: 'supervisores-final',
    texto: 'Examen final',
    detalle: 'Repartir aulas del examen final y el permiso de subir actas.',
    aviso: 'Deja dar y quitar permisos a otros supervisores.',
  },
  {
    id: 'supervisores-cuentas',
    texto: 'Cuentas',
    detalle: 'Crear, borrar y regenerar la clave de los supervisores.',
    aviso: 'Quien entre aquí crea y borra cuentas del equipo.',
  },
  {
    id: 'supervisores-permisos',
    texto: 'Permisos',
    detalle: 'Repartir estos mismos permisos a los demás supervisores.',
    aviso: 'Puede dar permisos a otros, pero nunca cambiar los suyos.',
  },
];

export const PERMISOS_EXAMEN = [
  {
    id: 'examen-respuestas',
    texto: 'Respuestas correctas',
    detalle: 'Cargar y cambiar la clave de cada categoría.',
    aviso: 'Puede cambiar qué respuesta es la correcta.',
  },
  { id: 'examen-puntaje', texto: 'Puntaje', detalle: 'Lo que vale cada respuesta.' },
  { id: 'examen-anular', texto: 'Anular envío', detalle: 'Borrar el envío de una delegación.', aviso: 'Borra lo que ya envió un tutor.' },
  { id: 'examen-corregir', texto: 'Corregir respuestas', detalle: 'Cambiar las respuestas de un alumno.', aviso: 'Cambia lo que un alumno respondió.' },
  { id: 'examen-tutorial', texto: 'Video tutorial', detalle: 'El video que ven los tutores.' },
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

/** Las dos etapas del concurso, con el mismo nombre que en el sidebar. */
export const FINAL = 'Final macrorregional';
export const INSTITUCIONAL = 'Clasificatoria institucional';

/**
 * Los grupos tal como se pintan en la pantalla de reparto.
 *
 * `etapa` es la etapa de la que cuelga el grupo, igual que en el sidebar: el
 * examen y los resultados existen dos veces, uno por etapa, y el nombre del
 * grupo a secas no distingue cuál es cuál. Los grupos sin `etapa` no son de
 * una etapa en particular y van sueltos, también como en el sidebar.
 */
export const GRUPOS_PERMISOS = [
  { titulo: 'Examen final', etapa: FINAL, descripcion: 'El día del examen presencial de la final.', permisos: PERMISOS_FINAL },
  { titulo: 'Resultados finales', etapa: FINAL, descripcion: 'Los puestos de la final y la premiación.', permisos: PERMISOS_FINAL_RESULTADOS },
  { titulo: 'Examen', etapa: INSTITUCIONAL, descripcion: 'Definir la prueba y recibir las respuestas de las delegaciones.', permisos: PERMISOS_EXAMEN },
  { titulo: 'Resultados', etapa: INSTITUCIONAL, descripcion: 'La clasificación de la etapa institucional.', permisos: PERMISOS_RESULTADOS },
  { titulo: 'Panel', descripcion: 'Las pantallas sueltas del panel.', permisos: PERMISOS_PANEL },
  { titulo: 'Consultas', descripcion: 'Buscar personas.', permisos: PERMISOS_CONSULTAS },
  { titulo: 'Credenciales', descripcion: 'Generar credenciales de la etapa institucional.', permisos: PERMISOS_CREDENCIALES },
  { titulo: 'Ajustes', descripcion: 'La configuración del sistema y de la página pública.', permisos: PERMISOS_AJUSTES },
  { titulo: 'Supervisores', descripcion: 'El equipo: las cuentas, sus permisos y el reparto de aulas de la final.', permisos: PERMISOS_SUPERVISORES },
];

/** Los grupos de cada etapa, para pintarlos dentro de ella. */
export const ETAPAS_PERMISOS = [
  {
    titulo: FINAL,
    descripcion: 'El examen presencial del 08 de noviembre y sus resultados.',
    grupos: GRUPOS_PERMISOS.filter((g) => g.etapa === FINAL),
  },
  {
    titulo: INSTITUCIONAL,
    descripcion: 'La etapa de cada colegio: la prueba y quiénes clasificaron a la final.',
    grupos: GRUPOS_PERMISOS.filter((g) => g.etapa === INSTITUCIONAL),
  },
];

/** Lo que no es de una etapa: el panel de siempre. */
export const GRUPOS_SUELTOS = GRUPOS_PERMISOS.filter((g) => !g.etapa);

export const PERMISOS = GRUPOS_PERMISOS.flatMap((g) => g.permisos);

/** Para pintar el nombre de un permiso sin buscar grupo por grupo. */
export const TEXTO_PERMISO = Object.fromEntries(PERMISOS.map((p) => [p.id, p.texto]));
