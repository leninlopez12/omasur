import {
  ArrowRightLeft,
  Award,
  Ban,
  Calculator,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileSpreadsheet,
  FileText,
  Flag,
  FlaskConical,
  GraduationCap as IconoGrado,
  IdCard,
  ImageIcon,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogIn,
  Mail,
  Medal,
  Megaphone,
  MessageCircle,
  PencilLine,
  Printer,
  School,
  QrCode,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  Upload,
  UserCheck,
  UserCog,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import IconoWhatsApp from './IconoWhatsApp.jsx';
import { ListaInscripciones, RevisarInscripcion } from './Inscripciones.jsx';
import {
  AjusteBases,
  AjusteBcp,
  AjusteWhatsapp,
  AjusteYape,
  CierreInscripciones,
  GruposWhatsApp,
  ImagenesFondo,
} from './Ajustes.jsx';
import { ConsultaEstudiantes, ConsultaTutores } from './Consultas.jsx';
import RevisarAlumnos from './RevisarAlumnos.jsx';
import Supervisores from './Supervisores.jsx';
import Avisos from './Avisos.jsx';
import Reportes from './Reportes.jsx';
import Abonos from './Abonos.jsx';
import Consolidado from './Consolidado.jsx';
import Acceder from './Acceder.jsx';
import EtapasCredencial from './EtapasCredencial.jsx';
import Comunicados from './Comunicados.jsx';
import CredencialesComision from './CredencialesComision.jsx';
import Tablero from './Tablero.jsx';
import PermisosSupervisores from './PermisosSupervisores.jsx';
import SupervisoresFinal from './SupervisoresFinal.jsx';
import TutoresClasificados from './TutoresClasificados.jsx';
import {
  ConsultaPublica,
  ConsultarResultados,
  DecidirAlumnos,
  ModuloResultados,
  ResultadosGeneral,
} from './Resultados.jsx';
import {
  ExamenClave,
  ExamenPrueba,
  ExamenPuntaje,
  ExamenRespuestas,
  ExamenTutorial,
} from './ExamenConfig.jsx';
import {
  ExamenAnular,
  ExamenCorregir,
  ExamenLlenar,
} from './ExamenDelegacion.jsx';
import {
  ExamenConsolidado,
  ExamenConsultas,
  ExamenEntregas,
  ExamenEnviadas,
} from './ExamenEntregas.jsx';
import FinalSalones from './FinalSalones.jsx';
import FinalReparto from './FinalReparto.jsx';
import FinalCredenciales from './FinalCredenciales.jsx';
import FinalListas from './FinalListas.jsx';
import FinalBusquedaCredenciales from './FinalBusquedaCredenciales.jsx';
import FinalCredencialesTutores from './FinalCredencialesTutores.jsx';
import {
  FinalExamenClave,
  FinalExamenEnvios,
  FinalExamenLlenar,
  FinalExamenPuntaje,
} from './FinalExamen.jsx';
import {
  FinalConsultar,
  FinalPremiacion,
  FinalPublicacion,
  FinalResultadosGeneral,
  FinalResultadosTop,
} from './FinalResultados.jsx';
import { useAjustes } from '../lib/ajustes';

/**
 * Las secciones que comparten el administrador y el supervisor.
 *
 * El administrador ve todo esto siempre; el supervisor, lo que le hayan dado
 * en Resultados · Supervisor a cargo. Por eso cada entrada dice de qué permiso
 * depende: el panel filtra la lista con `filtrarSecciones` y pinta el
 * contenido con `ContenidoComision`, que es el mismo para los dos.
 *
 * Los cuatro grupos del examen y los resultados no van sueltos: cada uno
 * cuelga de su etapa —`ETAPA_FINAL` y `ETAPA_INSTITUCIONAL`—, que es lo que
 * los paneles ponen en el sidebar.
 */
export const SECCION_RESULTADOS = {
  id: 'resultados',
  texto: 'Resultados',
  icono: Trophy,
  hijos: [
    {
      id: 'resultados-tutores',
      texto: 'Enviadas por tutores',
      icono: UserCheck,
      permiso: 'resultados-tutores',
    },
    {
      id: 'resultados-comision',
      texto: 'Llenadas por comisión',
      icono: Users,
      permiso: 'resultados-comision',
    },
    {
      id: 'resultados-decidir',
      texto: 'Decidir a mano',
      icono: PencilLine,
      permiso: 'resultados-decidir',
    },
    {
      id: 'resultados-general',
      texto: 'General y publicación',
      icono: Award,
      permiso: 'resultados-general',
    },
    {
      id: 'resultados-clasificados',
      texto: 'Tutores clasificados',
      icono: Medal,
      permiso: 'resultados-clasificados',
    },
    {
      id: 'resultados-consultar',
      texto: 'Consultar y descargar',
      icono: Search,
      permiso: 'resultados-consultar',
    },
    {
      id: 'resultados-publica',
      texto: 'Hacer pública consulta',
      icono: Megaphone,
      permiso: 'resultados-publica',
    },
  ],
};

/**
 * Supervisores: el equipo.
 *
 * Estaba repartido entre Resultados y Ajustes, que no es donde nadie lo
 * buscaría. Las cuentas y los permisos son dos caras de lo mismo, así que van
 * juntas y en su propio sitio.
 */
/**
 * El examen completo: solo el administrador.
 *
 * Define la prueba, la puntúa, anula envíos y corrige respuestas. Cada
 * pantalla se reparte por separado: una cosa es recibir actas y otra decidir
 * qué respuesta es la correcta.
 */
export const SECCION_EXAMEN = {
  id: 'examen',
  texto: 'Examen',
  icono: FileSpreadsheet,
  hijos: [
    { id: 'examen-respuestas', texto: 'Respuestas correctas', icono: ListChecks, permiso: 'examen-respuestas' },
    { id: 'examen-puntaje', texto: 'Puntaje', icono: Calculator, permiso: 'examen-puntaje' },
    { id: 'examen-prueba', texto: 'Probar el envío', icono: FlaskConical, permiso: 'examen-prueba' },
    { id: 'examen-entregas', texto: 'Entregas recibidas', icono: Inbox, permiso: 'examen-entregas' },
    { id: 'examen-llenar', texto: 'Llenar por delegación', icono: Upload, permiso: 'examen-llenar' },
    { id: 'examen-anular', texto: 'Anular envío', icono: Ban, permiso: 'examen-anular' },
    { id: 'examen-corregir', texto: 'Corregir respuestas', icono: PencilLine, permiso: 'examen-corregir' },
    { id: 'examen-consultas', texto: 'Consultas de envíos', icono: Search, permiso: 'examen-consultas' },
    { id: 'examen-consolidado', texto: 'Consolidado', icono: ClipboardList, permiso: 'examen-consolidado' },
    { id: 'examen-enviadas', texto: 'Respuestas enviadas', icono: FileSpreadsheet, permiso: 'examen-enviadas' },
    { id: 'examen-tutorial', texto: 'Video tutorial', icono: Video, permiso: 'examen-tutorial' },
    // La misma clave, sin poder tocarla: es lo que se le da a quien acompaña
    // el examen pero no lo define. Al administrador no se le muestra porque ya
    // tiene la de arriba, que además deja editar.
    {
      id: 'examen-clave',
      texto: 'Ver respuestas correctas',
      icono: ListChecks,
      permiso: 'examen-clave',
      soloSupervisor: true,
    },
  ],
};

/**
 * La etapa final macrorregional, que va arriba de todo.
 *
 * El examen y los resultados de más abajo son los de la etapa institucional,
 * la que ya pasó. Estos dos son los del 08 de noviembre, presencial y en una
 * sola sede, y son lo que se está trabajando ahora: por eso encabezan.
 *
 * Se reparten pantalla por pantalla como el resto: el administrador decide
 * quién entra a cada una desde Supervisores · Permisos.
 */
export const SECCION_EXAMEN_FINAL = {
  id: 'final-examen',
  texto: 'Examen final',
  icono: ClipboardCheck,
  hijos: [
    { id: 'final-salones', texto: 'Salones y horarios', icono: DoorOpen, permiso: 'final-salones' },
    { id: 'final-reparto', texto: 'Reparto de alumnos', icono: ArrowRightLeft, permiso: 'final-reparto' },
    { id: 'final-listas', texto: 'Lista de salones', icono: Printer, permiso: 'final-listas' },
    { id: 'final-clave', texto: 'Respuestas correctas', icono: ListChecks, permiso: 'final-clave' },
    { id: 'final-puntaje', texto: 'Puntaje y apertura', icono: Calculator, permiso: 'final-puntaje' },
    { id: 'final-llenar', texto: 'Llenar por salón', icono: Upload, permiso: 'final-llenar' },
    { id: 'final-envios', texto: 'Consulta de envíos', icono: Inbox, permiso: 'final-envios' },
    { id: 'final-credenciales', texto: 'Credenciales', icono: IdCard, permiso: 'final-credenciales' },
    { id: 'final-busqueda', texto: 'Credenciales de alumnos', icono: Search, permiso: 'final-busqueda' },
    { id: 'final-cred-tutores', texto: 'Credenciales de tutores', icono: UserCheck, permiso: 'final-cred-tutores' },
  ],
};

export const SECCION_RESULTADOS_FINAL = {
  id: 'final-resultados',
  texto: 'Resultados finales',
  icono: Trophy,
  hijos: [
    { id: 'final-general', texto: 'General', icono: Award, permiso: 'final-general' },
    { id: 'final-top', texto: 'Por categoría', icono: Trophy, permiso: 'final-top' },
    { id: 'final-premiacion', texto: 'Premiación', icono: Medal, permiso: 'final-premiacion' },
    { id: 'final-consultar', texto: 'Consultar', icono: Search, permiso: 'final-consultar' },
    { id: 'final-publicacion', texto: 'Publicación y consulta', icono: Megaphone, permiso: 'final-publicacion' },
  ],
};


/**
 * Las dos etapas, cada una con su examen y sus resultados.
 *
 * Antes los cuatro grupos colgaban del sidebar uno tras otro y era fácil
 * confundirse: «Respuestas correctas» sale dos veces, «Consulta de envíos»
 * también, y nada decía de qué etapa era cada una. Metiéndolos dentro de su
 * etapa, el nombre del grupo ya no tiene que cargar con esa distinción.
 *
 * La etapa no es una pantalla: no tiene permiso propio, y lo que se reparte
 * sigue siendo cada pantalla de adentro.
 */
export const ETAPA_FINAL = {
  id: 'etapa-final',
  texto: 'Final macrorregional',
  icono: Flag,
  hijos: [SECCION_EXAMEN_FINAL, SECCION_RESULTADOS_FINAL],
};

export const ETAPA_INSTITUCIONAL = {
  id: 'etapa-institucional',
  texto: 'Clasificatoria institucional',
  icono: School,
  hijos: [SECCION_EXAMEN, SECCION_RESULTADOS],
};

export const SECCION_SUPERVISORES = {
  id: 'supervisores',
  texto: 'Supervisores',
  icono: UserCog,
  hijos: [
    { id: 'supervisores-cuentas', texto: 'Cuentas', icono: UserCheck, permiso: 'supervisores-cuentas' },
    {
      id: 'supervisores-permisos',
      texto: 'Permisos',
      icono: ShieldCheck,
      permiso: 'supervisores-permisos',
    },
    // El atajo del día del examen: las aulas y el permiso de subir actas, que
    // son dos cosas distintas y las dos hacen falta.
    {
      id: 'supervisores-final',
      texto: 'Examen final',
      icono: DoorOpen,
      permiso: 'supervisores-final',
    },
  ],
};

export const SECCIONES_PANEL = [
  { id: 'tablero', texto: 'Tablero', icono: LayoutDashboard, permiso: 'tablero' },
  {
    id: 'revisar-alumnos',
    texto: 'Inscripciones',
    icono: ReceiptText,
    permiso: 'inscripciones',
  },
  { id: 'inscripciones', texto: 'Delegaciones', icono: ClipboardCheck, permiso: 'delegaciones' },
  { id: 'reportes', texto: 'Reportes', icono: FileSpreadsheet, permiso: 'reportes' },
  { id: 'abonos', texto: 'Abonos', icono: Wallet, permiso: 'abonos' },
  {
    id: 'consultas',
    texto: 'Consultas',
    icono: Search,
    hijos: [
      { id: 'consulta-tutores', texto: 'Tutores', icono: Users, permiso: 'consulta-tutores' },
      { id: 'consulta-estudiantes', texto: 'Estudiantes', icono: IconoGrado, permiso: 'consulta-estudiantes' },
    ],
  },
  { id: 'consolidado', texto: 'Consolidado', icono: ClipboardList, permiso: 'consolidado' },
  { id: 'acceder', texto: 'Acceder', icono: LogIn, permiso: 'acceder' },
  {
    id: 'credenciales',
    texto: 'Credenciales',
    icono: IdCard,
    hijos: [
      { id: 'cred-delegaciones', texto: 'De delegaciones', icono: Users, permiso: 'cred-delegaciones' },
      { id: 'cred-tutores', texto: 'De tutores', icono: UserCheck, permiso: 'cred-tutores' },
    ],
  },
  {
    id: 'ajustes',
    texto: 'Ajustes',
    icono: Settings,
    hijos: [
      { id: 'ajustes-inscripciones', texto: 'Inscripciones', icono: CalendarCheck, permiso: 'ajustes-inscripciones' },
      { id: 'ajustes-whatsapp', texto: 'Grupo WhatsApp', icono: IconoWhatsApp, permiso: 'ajustes-whatsapp' },
      { id: 'ajustes-boton-wa', texto: 'Botón de WhatsApp', icono: MessageCircle, permiso: 'ajustes-boton-wa' },
      { id: 'ajustes-yape', texto: 'Yape', icono: QrCode, permiso: 'ajustes-yape' },
      { id: 'ajustes-bcp', texto: 'BCP', icono: Landmark, permiso: 'ajustes-bcp' },
      { id: 'ajustes-credencial', texto: 'Diseño de credenciales', icono: IdCard, permiso: 'ajustes-credencial' },
      { id: 'ajustes-comunicado', texto: 'Comunicado', icono: Megaphone, permiso: 'ajustes-comunicado' },
      { id: 'ajustes-imagenes', texto: 'Imágenes', icono: ImageIcon, permiso: 'ajustes-imagenes' },
      { id: 'ajustes-bases', texto: 'Bases del concurso', icono: FileText, permiso: 'ajustes-bases' },
      // Escribirle a todos los tutores de golpe se queda en el administrador.
      { id: 'ajustes-avisos', texto: 'Avisos por correo', icono: Mail, soloAdmin: true },
    ],
  },
];

export const TITULOS_COMISION = {
  'final-salones': 'Final · Salones y horarios',
  'final-reparto': 'Final · Reparto de alumnos',
  'final-listas': 'Final · Lista de salones para el examen',
  'final-clave': 'Final · Respuestas correctas',
  'final-puntaje': 'Final · Puntaje y apertura',
  'final-llenar': 'Final · Llenar por salón',
  'final-envios': 'Final · Consulta de envíos',
  'final-credenciales': 'Final · Credenciales de finalistas',
  'final-busqueda': 'Final · Búsqueda de credenciales de alumnos',
  'final-cred-tutores': 'Final · Credenciales de tutores',
  'final-general': 'Final · General',
  'final-top': 'Final · Por categoría',
  'final-premiacion': 'Final · Premiación',
  'final-consultar': 'Final · Consultar',
  'final-publicacion': 'Final · Publicación y consulta',
  'examen-respuestas': 'Examen · Respuestas correctas',
  'examen-puntaje': 'Examen · Puntaje',
  'examen-prueba': 'Examen · Probar el envío',
  'examen-entregas': 'Examen · Entregas recibidas',
  'examen-llenar': 'Examen · Llenar por delegación',
  'examen-anular': 'Examen · Anular envío',
  'examen-corregir': 'Examen · Corregir respuestas',
  'examen-consultas': 'Examen · Consultas de envíos',
  'examen-consolidado': 'Examen · Consolidado',
  'examen-enviadas': 'Examen · Respuestas enviadas',
  'examen-tutorial': 'Examen · Video tutorial',
  'examen-clave': 'Examen · Ver respuestas correctas',

  'resultados-tutores': 'Resultados · Enviadas por los tutores',
  'resultados-comision': 'Resultados · Llenadas por la comisión',
  'resultados-decidir': 'Resultados · Decidir a mano',
  'resultados-general': 'Resultados · General y publicación',
  'resultados-clasificados': 'Resultados · Tutores clasificados',
  'resultados-consultar': 'Resultados · Consultar y descargar',
  'resultados-publica': 'Resultados · Hacer pública la consulta',
  'supervisores-cuentas': 'Supervisores · Cuentas',
  'supervisores-permisos': 'Supervisores · Permisos',
  'supervisores-final': 'Supervisores · Examen final',
  tablero: 'Tablero general',
  'revisar-alumnos': 'Inscripciones por alumno',
  inscripciones: 'Delegaciones',
  reportes: 'Reportes',
  abonos: 'Abonos por delegación',
  'consulta-tutores': 'Consultas · Tutores',
  'consulta-estudiantes': 'Consultas · Estudiantes',
  consolidado: 'Consolidado general',
  acceder: 'Entrar como tutor',
  'cred-delegaciones': 'Credenciales de delegaciones',
  'cred-tutores': 'Credenciales de tutores',
  'ajustes-inscripciones': 'Ajustes · Inscripciones',
  'ajustes-whatsapp': 'Ajustes · Grupo WhatsApp',
  'ajustes-boton-wa': 'Ajustes · Botón de WhatsApp',
  'ajustes-yape': 'Ajustes · Yape',
  'ajustes-bcp': 'Ajustes · BCP',
  'ajustes-credencial': 'Ajustes · Diseño de credenciales',
  'ajustes-comunicado': 'Ajustes · Comunicado',
  'ajustes-imagenes': 'Ajustes · Imágenes',
  'ajustes-bases': 'Ajustes · Bases del concurso',
  'ajustes-avisos': 'Ajustes · Avisos por correo',
};

/**
 * Deja la lista en lo que esta persona puede ver.
 *
 * `permisos` en `null` es el administrador: pasa todo. Con una lista, cada
 * entrada sobrevive si su permiso está en ella; un grupo que se queda sin
 * hijos desaparece, para no dejar un título que no abre nada.
 */
export function filtrarSecciones(secciones, permisos) {
  // El administrador pasa todo, salvo lo que existe solo para el supervisor:
  // él ya tiene la versión completa de esa misma pantalla.
  const cabe =
    permisos === null
      ? (s) => !s.soloSupervisor
      : (s) => (!s.permiso || permisos.includes(s.permiso)) && !s.soloAdmin;

  // Baja por niveles porque ahora hay tres: etapa, sección y pantalla.
  const podar = (s) => {
    if (!cabe(s)) return null;
    if (!s.hijos) return s;
    const hijos = s.hijos.map(podar).filter(Boolean);
    return hijos.length ? { ...s, hijos } : null;
  };

  return secciones.map(podar).filter(Boolean);
}

/** Todas las pantallas que quedan después de filtrar, ya aplanadas. */
export function idsVisibles(secciones) {
  return secciones.flatMap((s) => (s.hijos ? idsVisibles(s.hijos) : [s.id]));
}

/**
 * El contenido de las secciones compartidas.
 *
 * Es el mismo componente en los dos paneles, así que un arreglo aquí se ve en
 * los dos. Lo que no es compartido —el examen— lo pinta cada panel aparte.
 */
export function ContenidoComision({ seccion, detalleId, setDetalleId, irA, abrirTutor }) {
  const { ajustes, recargar: recargarAjustes } = useAjustes();

  return (
    <>
      {seccion === 'final-salones' && <FinalSalones />}
      {seccion === 'final-reparto' && <FinalReparto />}
      {seccion === 'final-listas' && <FinalListas />}
      {seccion === 'final-clave' && <FinalExamenClave />}
      {seccion === 'final-puntaje' && <FinalExamenPuntaje />}
      {seccion === 'final-llenar' && <FinalExamenLlenar />}
      {seccion === 'final-envios' && <FinalExamenEnvios />}
      {seccion === 'final-credenciales' && <FinalCredenciales />}
      {seccion === 'final-busqueda' && <FinalBusquedaCredenciales />}
      {seccion === 'final-cred-tutores' && <FinalCredencialesTutores />}
      {seccion === 'final-general' && <FinalResultadosGeneral />}
      {seccion === 'final-top' && <FinalResultadosTop />}
      {seccion === 'final-premiacion' && <FinalPremiacion />}
      {seccion === 'final-consultar' && <FinalConsultar />}
      {seccion === 'final-publicacion' && <FinalPublicacion />}
      {seccion === 'examen-respuestas' && <ExamenRespuestas />}
      {seccion === 'examen-puntaje' && <ExamenPuntaje />}
      {seccion === 'examen-prueba' && <ExamenPrueba />}
      {seccion === 'examen-entregas' && <ExamenEntregas />}
      {seccion === 'examen-llenar' && <ExamenLlenar />}
      {seccion === 'examen-anular' && <ExamenAnular />}
      {seccion === 'examen-corregir' && <ExamenCorregir />}
      {seccion === 'examen-consultas' && <ExamenConsultas />}
      {seccion === 'examen-consolidado' && <ExamenConsolidado />}
      {seccion === 'examen-enviadas' && <ExamenEnviadas />}
      {seccion === 'examen-tutorial' && <ExamenTutorial />}
      {seccion === 'examen-clave' && <ExamenClave />}

      {seccion === 'resultados-tutores' && <ModuloResultados ola="tutores" />}
      {seccion === 'resultados-comision' && <ModuloResultados ola="comision" />}
      {seccion === 'resultados-decidir' && <DecidirAlumnos />}
      {seccion === 'resultados-general' && <ResultadosGeneral />}
      {seccion === 'resultados-clasificados' && <TutoresClasificados />}
      {seccion === 'resultados-consultar' && <ConsultarResultados />}
      {seccion === 'resultados-publica' && <ConsultaPublica />}

      {seccion === 'tablero' && <Tablero irA={irA} />}
      {seccion === 'inscripciones' &&
        (detalleId ? (
          <RevisarInscripcion id={detalleId} alVolver={() => setDetalleId(null)} />
        ) : (
          <ListaInscripciones alAbrir={setDetalleId} />
        ))}
      {seccion === 'revisar-alumnos' &&
        (detalleId ? (
          <RevisarInscripcion id={detalleId} alVolver={() => setDetalleId(null)} />
        ) : (
          <RevisarAlumnos alAbrirTutor={setDetalleId} />
        ))}
      {seccion === 'reportes' && <Reportes />}
      {seccion === 'abonos' && <Abonos />}

      {seccion === 'consulta-tutores' && <ConsultaTutores alAbrirTutor={abrirTutor} />}
      {seccion === 'consulta-estudiantes' && <ConsultaEstudiantes />}
      {seccion === 'consolidado' && <Consolidado />}
      {seccion === 'acceder' && <Acceder />}
      {seccion === 'cred-delegaciones' && <CredencialesComision modo="delegaciones" />}
      {seccion === 'cred-tutores' && <CredencialesComision modo="tutores" />}

      {seccion === 'ajustes-inscripciones' && (
        <CierreInscripciones
          cerradas={ajustes.inscripcionesCerradas}
          cerradasEn={ajustes.cerradasEn}
          alCambiar={recargarAjustes}
        />
      )}
      {seccion === 'ajustes-whatsapp' && (
        <GruposWhatsApp grupos={ajustes.grupos} alCambiar={recargarAjustes} />
      )}
      {seccion === 'ajustes-yape' && (
        <AjusteYape yapeQr={ajustes.yapeQr} yape={ajustes.yape} alCambiar={recargarAjustes} />
      )}
      {seccion === 'ajustes-boton-wa' && (
        <AjusteWhatsapp whatsapp={ajustes.whatsapp} alCambiar={recargarAjustes} />
      )}
      {seccion === 'ajustes-bcp' && <AjusteBcp bcp={ajustes.bcp} alCambiar={recargarAjustes} />}
      {seccion === 'ajustes-credencial' && <EtapasCredencial />}
      {seccion === 'ajustes-comunicado' && <Comunicados />}
      {seccion === 'ajustes-imagenes' && (
        <ImagenesFondo
          imagenHero={ajustes.imagenHero}
          imagenLogin={ajustes.imagenLogin}
          alCambiar={recargarAjustes}
        />
      )}
      {seccion === 'ajustes-bases' && (
        <AjusteBases bases={ajustes.bases} alCambiar={recargarAjustes} />
      )}
      {seccion === 'supervisores-cuentas' && <Supervisores />}
      {seccion === 'supervisores-permisos' && <PermisosSupervisores />}
      {seccion === 'supervisores-final' && <SupervisoresFinal />}
      {seccion === 'ajustes-avisos' && <Avisos />}
    </>
  );
}
