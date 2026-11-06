import { useState } from 'react';
import {
  ArrowRightLeft,
  Award,
  Ban,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileSpreadsheet,
  FlaskConical,
  Inbox,
  IdCard,
  ListChecks,
  Medal,
  Megaphone,
  PencilLine,
  Printer,
  Search,
  Trophy,
  Upload,
  Video,
} from 'lucide-react';
import PanelLayout from '../layouts/PanelLayout.jsx';
import Campanita from '../components/Campanita.jsx';
import AvisosEnVivo from '../components/AvisosEnVivo.jsx';
import PermisoAvisos from '../components/PermisoAvisos.jsx';
import { NotificacionesProvider } from '../lib/notificaciones.jsx';
import {
  ExamenPrueba,
  ExamenPuntaje,
  ExamenRespuestas,
  ExamenTutorial,
} from '../components/ExamenConfig.jsx';
import {
  ExamenAnular,
  ExamenCorregir,
  ExamenLlenar,
} from '../components/ExamenDelegacion.jsx';
import {
  ExamenConsolidado,
  ExamenConsultas,
  ExamenEntregas,
  ExamenEnviadas,
} from '../components/ExamenEntregas.jsx';
import {
  ContenidoComision,
  SECCIONES_PANEL,
  SECCION_RESULTADOS,
  SECCION_SUPERVISORES,
  TITULOS_COMISION,
} from '../components/SeccionesComision.jsx';
import FinalSalones from '../components/FinalSalones.jsx';
import FinalReparto from '../components/FinalReparto.jsx';
import FinalCredenciales from '../components/FinalCredenciales.jsx';
import FinalListas from '../components/FinalListas.jsx';
import FinalBusquedaCredenciales from '../components/FinalBusquedaCredenciales.jsx';
import {
  FinalExamenClave,
  FinalExamenEnvios,
  FinalExamenLlenar,
  FinalExamenPuntaje,
} from '../components/FinalExamen.jsx';
import {
  FinalConsultar,
  FinalPremiacion,
  FinalPublicacion,
  FinalResultadosGeneral,
  FinalResultadosTop,
} from '../components/FinalResultados.jsx';

/**
 * El examen completo: solo el administrador.
 *
 * Define la prueba, la puntúa, anula envíos y corrige respuestas. El panel del
 * supervisor muestra una versión recortada de este mismo grupo.
 */
const SECCION_EXAMEN = {
  id: 'examen',
  texto: 'Examen',
  icono: FileSpreadsheet,
  hijos: [
    { id: 'examen-respuestas', texto: 'Respuestas correctas', icono: ListChecks },
    { id: 'examen-puntaje', texto: 'Puntaje', icono: Calculator },
    { id: 'examen-prueba', texto: 'Probar el envío', icono: FlaskConical },
    { id: 'examen-entregas', texto: 'Entregas recibidas', icono: Inbox },
    { id: 'examen-llenar', texto: 'Llenar por delegación', icono: Upload },
    { id: 'examen-anular', texto: 'Anular envío', icono: Ban },
    { id: 'examen-corregir', texto: 'Corregir respuestas', icono: PencilLine },
    { id: 'examen-consultas', texto: 'Consultas de envíos', icono: Search },
    { id: 'examen-consolidado', texto: 'Consolidado', icono: ClipboardList },
    { id: 'examen-enviadas', texto: 'Respuestas enviadas', icono: FileSpreadsheet },
    { id: 'examen-tutorial', texto: 'Video tutorial', icono: Video },
  ],
};

/**
 * La etapa final macrorregional, que va arriba de todo.
 *
 * El examen y los resultados de más abajo son los de la etapa institucional,
 * la que ya pasó. Estos dos son los del 08 de noviembre, presencial y en una
 * sola sede, y son lo que se está trabajando ahora: por eso encabezan.
 *
 * No se reparten: la clave, el reparto de aulas y la premiación se quedan en
 * el administrador. Lo único que se delega es el aula, y eso le aparece al
 * responsable en su propio panel.
 */
const SECCION_EXAMEN_FINAL = {
  id: 'final-examen',
  texto: 'Examen final',
  icono: ClipboardCheck,
  hijos: [
    { id: 'final-salones', texto: 'Salones y horarios', icono: DoorOpen },
    { id: 'final-reparto', texto: 'Reparto de alumnos', icono: ArrowRightLeft },
    { id: 'final-listas', texto: 'Lista de salones', icono: Printer },
    { id: 'final-clave', texto: 'Respuestas correctas', icono: ListChecks },
    { id: 'final-puntaje', texto: 'Puntaje y apertura', icono: Calculator },
    { id: 'final-llenar', texto: 'Llenar por salón', icono: Upload },
    { id: 'final-envios', texto: 'Consulta de envíos', icono: Inbox },
    { id: 'final-credenciales', texto: 'Credenciales', icono: IdCard },
    { id: 'final-busqueda', texto: 'Búsqueda de credenciales', icono: Search },
  ],
};

const SECCION_RESULTADOS_FINAL = {
  id: 'final-resultados',
  texto: 'Resultados finales',
  icono: Trophy,
  hijos: [
    { id: 'final-general', texto: 'General', icono: Award },
    { id: 'final-top', texto: 'Por categoría', icono: Trophy },
    { id: 'final-premiacion', texto: 'Premiación', icono: Medal },
    { id: 'final-consultar', texto: 'Consultar', icono: Search },
    { id: 'final-publicacion', texto: 'Publicación y consulta', icono: Megaphone },
  ],
};

const SECCIONES = [
  SECCION_EXAMEN_FINAL,
  SECCION_RESULTADOS_FINAL,
  SECCION_RESULTADOS,
  SECCION_EXAMEN,
  ...SECCIONES_PANEL, SECCION_SUPERVISORES,
];

const TITULOS = {
  ...TITULOS_COMISION,
  'final-salones': 'Final · Salones y horarios',
  'final-reparto': 'Final · Reparto de alumnos',
  'final-listas': 'Final · Lista de salones para el examen',
  'final-clave': 'Final · Respuestas correctas',
  'final-puntaje': 'Final · Puntaje y apertura',
  'final-llenar': 'Final · Llenar por salón',
  'final-envios': 'Final · Consulta de envíos',
  'final-credenciales': 'Final · Credenciales de finalistas',
  'final-busqueda': 'Final · Búsqueda de credenciales',
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
};

export default function PanelAdmin() {
  return (
    <NotificacionesProvider>
      <Contenido />
    </NotificacionesProvider>
  );
}

function Contenido() {
  const [seccion, setSeccion] = useState('tablero');
  const [detalleId, setDetalleId] = useState(null);

  const cambiarSeccion = (id) => {
    setDetalleId(null);
    setSeccion(id);
  };

  /** Desde un aviso se salta directo a la delegación que lo originó. */
  const abrirTutor = (tutorId) => {
    setSeccion('inscripciones');
    setDetalleId(tutorId);
  };

  return (
    <PanelLayout
      compacto
      titulo={TITULOS[seccion]}
      secciones={SECCIONES}
      actual={seccion}
      alCambiar={cambiarSeccion}
      acciones={
        <Campanita
          alAbrirTutor={abrirTutor}
          alIrAAprobar={() => cambiarSeccion('inscripciones')}
        />
      }
    >
      <AvisosEnVivo alAbrirTutor={abrirTutor} />
      <PermisoAvisos />

      {seccion === 'final-salones' && <FinalSalones />}
      {seccion === 'final-reparto' && <FinalReparto />}
      {seccion === 'final-listas' && <FinalListas />}
      {seccion === 'final-clave' && <FinalExamenClave />}
      {seccion === 'final-puntaje' && <FinalExamenPuntaje />}
      {seccion === 'final-llenar' && <FinalExamenLlenar />}
      {seccion === 'final-envios' && <FinalExamenEnvios />}
      {seccion === 'final-credenciales' && <FinalCredenciales />}
      {seccion === 'final-busqueda' && <FinalBusquedaCredenciales />}

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

      <ContenidoComision
        seccion={seccion}
        detalleId={detalleId}
        setDetalleId={setDetalleId}
        abrirTutor={abrirTutor}
        irA={(destino, tutorId) => {
          cambiarSeccion(destino);
          if (tutorId) setDetalleId(tutorId);
        }}
      />
    </PanelLayout>
  );
}
