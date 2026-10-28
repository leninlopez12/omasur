import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Inscripcion from './pages/Inscripcion.jsx';
import Ingresar from './pages/Ingresar.jsx';
import Recuperar from './pages/Recuperar.jsx';
import NuevaClave from './pages/NuevaClave.jsx';
import Credencial from './pages/Credencial.jsx';
import ResultadosEtapa from './pages/ResultadosEtapa.jsx';
import PanelTutor from './pages/PanelTutor.jsx';
import PanelAdmin from './pages/PanelAdmin.jsx';
import PanelSupervisor from './pages/PanelSupervisor.jsx';
import { Cargando } from './components/Ui.jsx';
import { rutaPorRol, useAuth } from './lib/auth.jsx';

function RutaProtegida({ rol, children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando texto="Verificando sesión" />;
  if (!usuario) return <Navigate to="/ingresar" replace />;
  if (rol && usuario.rol !== rol) return <Navigate to={rutaPorRol(usuario.rol)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/inscripcion" element={<Inscripcion />} />
      <Route path="/ingresar" element={<Ingresar />} />
      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/recuperar/:token" element={<NuevaClave />} />
      <Route path="/credencial" element={<Credencial />} />
      <Route path="/resultados_etapa_institucional" element={<ResultadosEtapa />} />
      <Route
        path="/panel/*"
        element={
          <RutaProtegida rol="TUTOR">
            <PanelTutor />
          </RutaProtegida>
        }
      />
      <Route
        path="/supervision/*"
        element={
          <RutaProtegida rol="SUPERVISOR">
            <PanelSupervisor />
          </RutaProtegida>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RutaProtegida rol="ADMIN">
            <PanelAdmin />
          </RutaProtegida>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
