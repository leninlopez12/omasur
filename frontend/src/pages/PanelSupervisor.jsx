import { useState } from 'react';
import { ClipboardList, Inbox, Search, Upload } from 'lucide-react';
import PanelLayout from '../layouts/PanelLayout.jsx';
import { ExamenLlenar } from '../components/ExamenDelegacion.jsx';
import {
  ExamenConsolidado,
  ExamenConsultas,
  ExamenEntregas,
} from '../components/ExamenEntregas.jsx';
import Campanita from '../components/Campanita.jsx';
import AvisosEnVivo from '../components/AvisosEnVivo.jsx';
import { NotificacionesProvider } from '../lib/notificaciones.jsx';

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
];

const TITULOS = {
  llenar: 'Examen · Llenar por delegación',
  entregas: 'Examen · Entregas recibidas',
  consultas: 'Examen · Consultas de envíos',
  consolidado: 'Examen · Consolidado',
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

  return (
    <PanelLayout
      compacto
      titulo={TITULOS[seccion]}
      secciones={SECCIONES}
      actual={seccion}
      alCambiar={setSeccion}
      acciones={<Campanita />}
    >
      <AvisosEnVivo />

      {seccion === 'entregas' && <ExamenEntregas />}
      {seccion === 'llenar' && <ExamenLlenar />}
      {seccion === 'consultas' && <ExamenConsultas />}
      {seccion === 'consolidado' && <ExamenConsolidado />}
    </PanelLayout>
  );
}
