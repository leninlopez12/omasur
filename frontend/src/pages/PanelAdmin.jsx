import { useState } from 'react';
import {
  Ban,
  Calculator,
  ClipboardList,
  FileSpreadsheet,
  FlaskConical,
  Inbox,
  ListChecks,
  PencilLine,
  Search,
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
  TITULOS_COMISION,
} from '../components/SeccionesComision.jsx';

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

const SECCIONES = [SECCION_RESULTADOS, SECCION_EXAMEN, ...SECCIONES_PANEL];

const TITULOS = {
  ...TITULOS_COMISION,
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
