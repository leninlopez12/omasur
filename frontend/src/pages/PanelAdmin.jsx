import { useState } from 'react';
import PanelLayout from '../layouts/PanelLayout.jsx';
import Campanita from '../components/Campanita.jsx';
import AvisosEnVivo from '../components/AvisosEnVivo.jsx';
import PermisoAvisos from '../components/PermisoAvisos.jsx';
import { NotificacionesProvider } from '../lib/notificaciones.jsx';
import {
  ContenidoComision,
  ETAPA_FINAL,
  ETAPA_INSTITUCIONAL,
  SECCIONES_PANEL,
  SECCION_SUPERVISORES,
  TITULOS_COMISION,
  filtrarSecciones,
} from '../components/SeccionesComision.jsx';

/**
 * Primero la etapa que se está trabajando y después la que ya pasó; lo que no
 * es de una etapa en particular va debajo, como siempre.
 *
 * Pasa por el filtro con `null` —el administrador lo ve todo— para que no le
 * salga la copia de solo lectura de la clave, que existe para el supervisor:
 * él ya tiene al lado la que además deja cambiarla.
 */
const SECCIONES = filtrarSecciones(
  [ETAPA_FINAL, ETAPA_INSTITUCIONAL, ...SECCIONES_PANEL, SECCION_SUPERVISORES],
  null,
);

const TITULOS = {
  ...TITULOS_COMISION,
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
