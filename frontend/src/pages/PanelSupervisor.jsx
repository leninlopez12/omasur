import { useEffect, useState } from 'react';
import {
  Award,
  ClipboardList,
  FileSpreadsheet,
  FlaskConical,
  Inbox,
  ListChecks,
  Search,
  Trophy,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import PanelLayout from '../layouts/PanelLayout.jsx';
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
  ConsultarResultados,
  ModuloResultados,
  ResultadosGeneral,
} from '../components/Resultados.jsx';
import { NotificacionesProvider } from '../lib/notificaciones.jsx';
import { api } from '../lib/api';

/**
 * Panel del supervisor: solo el examen.
 *
 * El supervisor acompaña el día del examen: recibe, completa y consulta. Lo
 * que no tiene vuelta atrás —definir la prueba, anular un envío, cambiarle las
 * respuestas a un alumno— queda en manos del administrador.
 */
const SECCIONES = [
  { id: 'llenar', texto: 'Llenar por delegación', icono: Upload },
  { id: 'entregas', texto: 'Entregas recibidas', icono: Inbox },
  { id: 'consultas', texto: 'Consultas de envíos', icono: Search },
  { id: 'consolidado', texto: 'Consolidado', icono: ClipboardList },
  { id: 'enviadas', texto: 'Respuestas enviadas', icono: FileSpreadsheet },
  { id: 'prueba', texto: 'Prueba de envío', icono: FlaskConical },
  { id: 'clave', texto: 'Respuestas correctas', icono: ListChecks },
];

/** Solo para el supervisor que el administrador puso a cargo. */
const SECCION_RESULTADOS = {
  id: 'resultados',
  texto: 'Resultados',
  icono: Trophy,
  hijos: [
    { id: 'res-tutores', texto: 'Enviadas por tutores', icono: UserCheck },
    { id: 'res-comision', texto: 'Llenadas por comisión', icono: Users },
    { id: 'res-general', texto: 'General y publicación', icono: Award },
    { id: 'res-consultar', texto: 'Consultar y descargar', icono: Search },
  ],
};

const TITULOS = {
  llenar: 'Examen · Llenar por delegación',
  entregas: 'Examen · Entregas recibidas',
  consultas: 'Examen · Consultas de envíos',
  consolidado: 'Examen · Consolidado',
  enviadas: 'Examen · Respuestas enviadas',
  prueba: 'Examen · Prueba de envío',
  clave: 'Examen · Respuestas correctas',
  'res-tutores': 'Resultados · Enviadas por los tutores',
  'res-comision': 'Resultados · Llenadas por la comisión',
  'res-general': 'Resultados · General y publicación',
  'res-consultar': 'Resultados · Consultar y descargar',
};

export default function PanelSupervisor() {
  return (
    <NotificacionesProvider>
      <Contenido />
    </NotificacionesProvider>
  );
}

function Contenido() {
  const [seccion, setSeccion] = useState('llenar');
  // El administrador decide quién ve los resultados; aquí solo se pregunta.
  const [aCargo, setACargo] = useState(false);

  useEffect(() => {
    api
      .get('/resultados/acceso')
      .then(({ data }) => setACargo(Boolean(data.puede)))
      .catch(() => setACargo(false));
  }, []);

  const secciones = aCargo ? [SECCION_RESULTADOS, ...SECCIONES] : SECCIONES;

  return (
    <PanelLayout
      compacto
      titulo={TITULOS[seccion]}
      secciones={secciones}
      actual={seccion}
      alCambiar={setSeccion}
      acciones={<Campanita />}
    >
      <AvisosEnVivo />

      {seccion === 'entregas' && <ExamenEntregas />}
      {seccion === 'llenar' && <ExamenLlenar />}
      {seccion === 'consultas' && <ExamenConsultas />}
      {seccion === 'consolidado' && <ExamenConsolidado />}

      {aCargo && (
        <>
          {seccion === 'res-tutores' && <ModuloResultados ola="tutores" />}
          {seccion === 'res-comision' && <ModuloResultados ola="comision" />}
          {seccion === 'res-general' && <ResultadosGeneral />}
          {seccion === 'res-consultar' && <ConsultarResultados />}
        </>
      )}
      {seccion === 'enviadas' && <ExamenEnviadas />}
      {seccion === 'prueba' && <ExamenPrueba />}
      {seccion === 'clave' && <ExamenClave />}
    </PanelLayout>
  );
}
