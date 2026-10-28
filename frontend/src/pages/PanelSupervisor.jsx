import { useEffect, useState } from 'react';
import {
  ClipboardList,
  FileSpreadsheet,
  FlaskConical,
  Inbox,
  ListChecks,
  Search,
  Upload,
} from 'lucide-react';
import PanelLayout from '../layouts/PanelLayout.jsx';
import { Aviso, Cargando } from '../components/Ui.jsx';
import { ExamenLlenar } from '../components/ExamenDelegacion.jsx';
import { ExamenClave, ExamenPrueba } from '../components/ExamenConfig.jsx';
import {
  ExamenConsolidado,
  ExamenConsultas,
  ExamenEntregas,
  ExamenEnviadas,
} from '../components/ExamenEntregas.jsx';
import Campanita from '../components/Campanita.jsx';
import AvisosEnVivo from '../components/AvisosEnVivo.jsx';
import {
  ContenidoComision,
  SECCIONES_PANEL,
  SECCION_RESULTADOS,
  TITULOS_COMISION,
  filtrarSecciones,
  idsVisibles,
} from '../components/SeccionesComision.jsx';
import { NotificacionesProvider } from '../lib/notificaciones.jsx';
import { api } from '../lib/api';

/**
 * El examen, recortado.
 *
 * El supervisor acompaña el día del examen: recibe, completa y consulta. Lo
 * que no tiene vuelta atrás —definir la prueba, anular un envío, cambiarle las
 * respuestas a un alumno— queda en manos del administrador, y la clave la ve
 * sin poder tocarla.
 */
const SECCION_EXAMEN = {
  id: 'examen',
  texto: 'Examen',
  icono: FileSpreadsheet,
  permiso: 'examen',
  hijos: [
    { id: 'examen-llenar', texto: 'Llenar por delegación', icono: Upload },
    { id: 'examen-entregas', texto: 'Entregas recibidas', icono: Inbox },
    { id: 'examen-consultas', texto: 'Consultas de envíos', icono: Search },
    { id: 'examen-consolidado', texto: 'Consolidado', icono: ClipboardList },
    { id: 'examen-enviadas', texto: 'Respuestas enviadas', icono: FileSpreadsheet },
    { id: 'examen-prueba', texto: 'Prueba de envío', icono: FlaskConical },
    { id: 'examen-clave', texto: 'Respuestas correctas', icono: ListChecks },
  ],
};

/** El panel completo, antes de quedarse en lo que cada uno tenga permitido. */
const TODAS = [SECCION_RESULTADOS, SECCION_EXAMEN, ...SECCIONES_PANEL];

const TITULOS = {
  ...TITULOS_COMISION,
  'examen-llenar': 'Examen · Llenar por delegación',
  'examen-entregas': 'Examen · Entregas recibidas',
  'examen-consultas': 'Examen · Consultas de envíos',
  'examen-consolidado': 'Examen · Consolidado',
  'examen-enviadas': 'Examen · Respuestas enviadas',
  'examen-prueba': 'Examen · Prueba de envío',
  'examen-clave': 'Examen · Respuestas correctas',
};

export default function PanelSupervisor() {
  return (
    <NotificacionesProvider>
      <Contenido />
    </NotificacionesProvider>
  );
}

/**
 * Panel del supervisor.
 *
 * No hay un panel del supervisor: hay uno por supervisor. El administrador
 * reparte los módulos en Resultados · Supervisor a cargo y aquí se arma el
 * sidebar con lo que le tocó. Si no le tocó nada, se lo dice en una línea en
 * vez de dejarlo mirando un panel vacío.
 */
function Contenido() {
  const [permisos, setPermisos] = useState(null);
  const [seccion, setSeccion] = useState(null);
  const [detalleId, setDetalleId] = useState(null);

  useEffect(() => {
    api
      .get('/permisos/mios')
      .then(({ data }) => setPermisos(data.esAdmin ? null : data.permisos || []))
      .catch(() => setPermisos([]));
  }, []);

  if (permisos === null) return <Cargando texto="Cargando su panel" />;

  const secciones = filtrarSecciones(TODAS, permisos);
  const visibles = idsVisibles(secciones);

  if (visibles.length === 0) {
    return (
      <PanelLayout compacto titulo="Panel" secciones={[]} actual="" alCambiar={() => {}}>
        <Aviso tipo="info">
          Todavía no tiene módulos asignados. El administrador se los habilita desde Resultados ·
          Supervisor a cargo.
        </Aviso>
      </PanelLayout>
    );
  }

  // La primera sección hace de inicio, y también de red: si le quitan el
  // permiso de la que estaba viendo, cae en una que sí puede abrir.
  const actual = visibles.includes(seccion) ? seccion : visibles[0];

  const cambiarSeccion = (id) => {
    setDetalleId(null);
    setSeccion(id);
  };

  const abrirTutor = (tutorId) => {
    if (!visibles.includes('inscripciones')) return;
    setSeccion('inscripciones');
    setDetalleId(tutorId);
  };

  return (
    <PanelLayout
      compacto
      titulo={TITULOS[actual]}
      secciones={secciones}
      actual={actual}
      alCambiar={cambiarSeccion}
      acciones={<Campanita alAbrirTutor={abrirTutor} />}
    >
      <AvisosEnVivo alAbrirTutor={abrirTutor} />

      {actual === 'examen-llenar' && <ExamenLlenar />}
      {actual === 'examen-entregas' && <ExamenEntregas />}
      {actual === 'examen-consultas' && <ExamenConsultas />}
      {actual === 'examen-consolidado' && <ExamenConsolidado />}
      {actual === 'examen-enviadas' && <ExamenEnviadas />}
      {actual === 'examen-prueba' && <ExamenPrueba />}
      {actual === 'examen-clave' && <ExamenClave />}

      <ContenidoComision
        seccion={actual}
        detalleId={detalleId}
        setDetalleId={setDetalleId}
        abrirTutor={abrirTutor}
        irA={(destino, tutorId) => {
          if (!visibles.includes(destino)) return;
          cambiarSeccion(destino);
          if (tutorId) setDetalleId(tutorId);
        }}
      />
    </PanelLayout>
  );
}
