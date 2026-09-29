import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, LogIn } from 'lucide-react';
import { api, mensajeError } from '../lib/api';
import { rutaPorRol, useAuth } from '../lib/auth.jsx';
import { Aviso, Boton, Campo, Tarjeta } from '../components/Ui.jsx';
import PantallaAcceso from '../components/PantallaAcceso.jsx';

export default function Ingresar() {
  const { usuario, guardarSesion } = useAuth();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) navegar(rutaPorRol(usuario.rol), { replace: true });
  }, [usuario, navegar]);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/login', datos);
      await guardarSesion(data.access_token);
      navegar(rutaPorRol(data.usuario.rol), { replace: true });
    } catch (e) {
      setError(mensajeError(e, 'No pudimos iniciar sesión'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PantallaAcceso
      titulo="Iniciar sesión"
      claseTitulo="text-4xl text-center text-red-400"
      volverA={null}
      pie={
        <>
          ¿Aún no se registró?{' '}
          <Link
            to="/inscripcion"
            className="font-bold text-granate-700 underline underline-offset-4"
          >
            Inscribir delegación
          </Link>
        </>
      }
    >
      <Tarjeta className="mt-8">
        <form onSubmit={enviar} className="space-y-6">
          {error && (
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          )}

          <Campo
            etiqueta="DNI"
            required
            autoComplete="username"
            placeholder="12345678"
            value={datos.usuario}
            onChange={(e) => setDatos({ ...datos, usuario: e.target.value })}
          />

          <Campo
            etiqueta="Contraseña"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Su contraseña"
            value={datos.password}
            onChange={(e) => setDatos({ ...datos, password: e.target.value })}
          />

          <div className="text-right">
            <Link
              to="/recuperar"
              className="text-xl font-semibold text-red-400 underline underline-offset-4"
            >
              ¿Olvidó su contraseña?
            </Link>
          </div>

          <Boton type="submit" variante="rojo" cargando={enviando} className="w-full">
            <LogIn className="h-6 w-6" />
            Ingresar
          </Boton>
        </form>
      </Tarjeta>
    </PantallaAcceso>
  );
}
