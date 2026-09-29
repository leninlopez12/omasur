import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, MailCheck, Send } from 'lucide-react';
import { api, mensajeError } from '../lib/api';
import { Aviso, Boton, Campo, Tarjeta } from '../components/Ui.jsx';
import PantallaAcceso from '../components/PantallaAcceso.jsx';

/** Paso 1: el tutor escribe su correo y recibe el enlace. */
export default function Recuperar() {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState(null);
  const [enviado, setEnviado] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/recuperar', { correo });
      setEnviado(data.mensaje);
    } catch (e) {
      setError({
        texto: mensajeError(e, 'No pudimos enviar el correo'),
        // 404: el correo no pertenece a ninguna cuenta; ahí conviene ofrecerle
        // el registro en vez de dejarlo probando direcciones.
        sinCuenta: e?.response?.status === 404,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PantallaAcceso
      titulo="Recuperar contraseña"
      descripcion="Le enviaremos un enlace a su correo."
      volverA={null}
      pie={
        <>
          ¿Recordó su contraseña?{' '}
          <Link to="/ingresar" className="font-bold text-granate-700 underline underline-offset-4">
            Ingresar
          </Link>
        </>
      }
    >
      <Tarjeta className="mt-8">
        {enviado ? (
          <div className="space-y-6">
            <Aviso tipo="exito" icono={MailCheck} titulo="Revise su correo">
              {enviado}
            </Aviso>
            <p className="text-xl text-slate-600">
              El enlace vence en una hora y solo puede usarse una vez.
            </p>
            <Boton variante="contorno" className="w-full" onClick={() => setEnviado('')}>
              Escribir otro correo
            </Boton>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-6">
            {error && (
              <Aviso
                tipo="error"
                icono={AlertCircle}
                titulo={error.sinCuenta ? 'Ese correo no existe' : undefined}
              >
                {error.texto}
                {error.sinCuenta && (
                  <Link
                    to="/inscripcion"
                    className="mt-2 block font-bold text-granate-700 underline underline-offset-4"
                  >
                    Inscribir delegación
                  </Link>
                )}
              </Aviso>
            )}

            <Campo
              etiqueta="Correo electrónico"
              type="email"
              required
              autoComplete="email"
              placeholder="correo@ejemplo.com"
              ayuda="El mismo correo que usó al registrarse."
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />

            <Boton type="submit" variante="rojo" cargando={enviando} className="w-full">
              <Send className="h-6 w-6" />
              Enviar enlace
            </Boton>
          </form>
        )}
      </Tarjeta>
    </PantallaAcceso>
  );
}
