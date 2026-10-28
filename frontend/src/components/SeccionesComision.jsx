import {
  Award,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GraduationCap as IconoGrado,
  IdCard,
  ImageIcon,
  Landmark,
  LayoutDashboard,
  LogIn,
  Mail,
  Megaphone,
  MessageCircle,
  PencilLine,
  QrCode,
  ReceiptText,
  Search,
  Settings,
  Trophy,
  UserCheck,
  UserCog,
  Users,
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
import {
  ConsultaPublica,
  ConsultarResultados,
  DecidirAlumnos,
  ModuloResultados,
  ResultadosGeneral,
} from './Resultados.jsx';
import { useAjustes } from '../lib/ajustes';

/**
 * Las secciones que comparten el administrador y el supervisor.
 *
 * El administrador ve todo esto siempre; el supervisor, lo que le hayan dado
 * en Resultados · Supervisor a cargo. Por eso cada entrada dice de qué permiso
 * depende: el panel filtra la lista con `filtrarSecciones` y pinta el
 * contenido con `ContenidoComision`, que es el mismo para los dos.
 *
 * El examen no está aquí porque los dos paneles no muestran lo mismo: el
 * supervisor tiene una versión de solo lectura de la clave y no puede anular
 * ni corregir envíos. Cada panel arma ese grupo por su cuenta.
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
      id: 'resultados-consultar',
      texto: 'Consultar y descargar',
      icono: Search,
      permiso: 'resultados-consultar',
    },
    {
      id: 'resultados-encargados',
      texto: 'Supervisor a cargo',
      icono: UserCog,
      permiso: 'resultados-encargados',
    },
    {
      id: 'resultados-publica',
      texto: 'Hacer pública consulta',
      icono: Megaphone,
      permiso: 'resultados-publica',
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
    permiso: 'consultas',
    hijos: [
      { id: 'consulta-tutores', texto: 'Tutores', icono: Users },
      { id: 'consulta-estudiantes', texto: 'Estudiantes', icono: IconoGrado },
    ],
  },
  { id: 'consolidado', texto: 'Consolidado', icono: ClipboardList, permiso: 'consolidado' },
  { id: 'acceder', texto: 'Acceder', icono: LogIn, permiso: 'acceder' },
  {
    id: 'credenciales',
    texto: 'Credenciales',
    icono: IdCard,
    permiso: 'credenciales',
    hijos: [
      { id: 'cred-delegaciones', texto: 'De delegaciones', icono: Users },
      { id: 'cred-tutores', texto: 'De tutores', icono: UserCheck },
    ],
  },
  {
    id: 'ajustes',
    texto: 'Ajustes',
    icono: Settings,
    permiso: 'ajustes',
    hijos: [
      { id: 'ajustes-inscripciones', texto: 'Inscripciones', icono: CalendarCheck },
      { id: 'ajustes-whatsapp', texto: 'Grupo WhatsApp', icono: IconoWhatsApp },
      { id: 'ajustes-boton-wa', texto: 'Botón de WhatsApp', icono: MessageCircle },
      { id: 'ajustes-yape', texto: 'Yape', icono: QrCode },
      { id: 'ajustes-bcp', texto: 'BCP', icono: Landmark },
      { id: 'ajustes-credencial', texto: 'Diseño de credenciales', icono: IdCard },
      { id: 'ajustes-comunicado', texto: 'Comunicado', icono: Megaphone },
      { id: 'ajustes-imagenes', texto: 'Imágenes', icono: ImageIcon },
      { id: 'ajustes-bases', texto: 'Bases del concurso', icono: FileText },
      // Crear supervisores y escribir a todos los tutores se queda en el
      // administrador: con el permiso de ajustes no viene el equipo.
      { id: 'ajustes-supervisores', texto: 'Supervisores', icono: UserCog, soloAdmin: true },
      { id: 'ajustes-avisos', texto: 'Avisos por correo', icono: Mail, soloAdmin: true },
    ],
  },
];

export const TITULOS_COMISION = {
  'resultados-tutores': 'Resultados · Enviadas por los tutores',
  'resultados-comision': 'Resultados · Llenadas por la comisión',
  'resultados-decidir': 'Resultados · Decidir a mano',
  'resultados-general': 'Resultados · General y publicación',
  'resultados-consultar': 'Resultados · Consultar y descargar',
  'resultados-encargados': 'Resultados · Supervisor a cargo',
  'resultados-publica': 'Resultados · Hacer pública la consulta',
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
  'ajustes-supervisores': 'Ajustes · Supervisores',
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
  if (permisos === null) return secciones;

  const cabe = (s) => (!s.permiso || permisos.includes(s.permiso)) && !s.soloAdmin;

  return secciones
    .map((s) => {
      if (!cabe(s)) return null;
      if (!s.hijos) return s;
      const hijos = s.hijos.filter(cabe);
      return hijos.length ? { ...s, hijos } : null;
    })
    .filter(Boolean);
}

/** Todos los ids que quedan después de filtrar, ya aplanados. */
export function idsVisibles(secciones) {
  return secciones.flatMap((s) => (s.hijos ? s.hijos.map((h) => h.id) : [s.id]));
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
      {seccion === 'resultados-tutores' && <ModuloResultados ola="tutores" />}
      {seccion === 'resultados-comision' && <ModuloResultados ola="comision" />}
      {seccion === 'resultados-decidir' && <DecidirAlumnos />}
      {seccion === 'resultados-general' && <ResultadosGeneral />}
      {seccion === 'resultados-consultar' && <ConsultarResultados />}
      {seccion === 'resultados-encargados' && <PermisosSupervisores />}
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
      {seccion === 'ajustes-supervisores' && <Supervisores />}
      {seccion === 'ajustes-avisos' && <Avisos />}
    </>
  );
}
