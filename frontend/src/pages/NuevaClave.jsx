import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound, LogIn } from 'lucide-react';
import { api, mensajeError } from '../lib/api';
import { Aviso, Boton, Campo, Cargando, Tarjeta } from '../components/Ui.jsx';
import PantallaAcceso from '../components/PantallaAcceso.jsx';

const MINIMO = 6;

/** Paso 2 y 3: se abre el enlace del correo y se escribe la nueva contraseña. */
export default function NuevaClave() {
  const { token } = useParams();
  const navegar = useNavigate();
  const [enlace, setEnlace] = useState({ estado: 'verificando', correo: '', nombre: '' });
  const [claves, setClaves] = useState({ password: '', repetir: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await api.get(`/auth/recuperar/${token}`);
        if (vivo) setEnlace({ estado: 'valido', correo: data.correo, nombre: data.nombre });
      } catch (e) {
        if (vivo) {
          setEnlace({ estado: 'invalido', correo: '', nombre: '' });
          setError(mensajeError(e, 'El enlace no es válido'));
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  // Al terminar se vuelve solo al ingreso, para que no haya que buscar el botón.
  useEffect(() => {
    if (!listo) return undefined;
    const reloj = setTimeout(() => navegar('/ingresar', { replace: true }), 6000);
    return () => clearTimeout(reloj);
  }, [listo, navegar]);

  const guardar = async (evento) => {
    evento.preventDefault();
    setError('');

    if (claves.password.length < MINIMO) {
      return setError(`La contraseña debe tener al menos ${MINIMO} caracteres`);
    }
    if (claves.password !== claves.repetir) {
      return setError('Las dos contraseñas no coinciden');
    }

    setGuardando(true);
    try {
      await api.post('/auth/recuperar/confirmar', { token, password: claves.password });
      setListo(true);
    } catch (e) {
      setError(mensajeError(e, 'No pudimos cambiar la contraseña'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PantallaAcceso
      titulo="Nueva contraseña"
      descripcion={
        enlace.estado === 'valido' && !listo ? `Cuenta de ${enlace.correo}` : undefined
      }
      volverA="/ingresar"
      volverTexto="Volver a ingresar"
    >
      <Tarjeta className="mt-8">
        {enlace.estado === 'verificando' && <Cargando texto="Comprobando el enlace" />}

        {enlace.estado === 'invalido' && (
          <div className="space-y-6">
            <Aviso tipo="error" icono={AlertCircle} titulo="Enlace no válido">
              {error}
            </Aviso>
            <Link to="/recuperar" className="block">
              <Boton className="w-full">
                <KeyRound className="h-6 w-6" />
                Pedir un enlace nuevo
              </Boton>
            </Link>
          </div>
        )}

        {enlace.estado === 'valido' && listo && (
          <div className="space-y-6">
            <Aviso tipo="exito" icono={CheckCircle2} titulo="Contraseña cambiada">
              Ya puede ingresar con su DNI y la contraseña nueva.
            </Aviso>
            <Link to="/ingresar" className="block">
              <Boton className="w-full">
                <LogIn className="h-6 w-6" />
                Ingresar ahora
              </Boton>
            </Link>
          </div>
        )}

        {enlace.estado === 'valido' && !listo && (
          <form onSubmit={guardar} className="space-y-6">
            {error && (
              <Aviso tipo="error" icono={AlertCircle}>
                {error}
              </Aviso>
            )}

            <Campo
              etiqueta="Nueva contraseña"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={claves.password}
              onChange={(e) => setClaves({ ...claves, password: e.target.value })}
            />

            <Campo
              etiqueta="Repita la contraseña"
              type="password"
              required
              autoComplete="new-password"
              placeholder="La misma contraseña"
              value={claves.repetir}
              onChange={(e) => setClaves({ ...claves, repetir: e.target.value })}
            />

            <Boton type="submit" cargando={guardando} className="w-full">
              <KeyRound className="h-6 w-6" />
              Guardar contraseña
            </Boton>
          </form>
        )}
      </Tarjeta>
    </PantallaAcceso>
  );
}
