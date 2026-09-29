import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, Loader2, Send, Users } from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';

/**
 * Ajustes > Avisos. Correo de la comisión a un grupo de tutores.
 *
 * Antes de mandar se ve a cuántos va y quiénes son, y se puede mandar una
 * prueba a una dirección propia. El envío sale por tandas con pausa: de golpe
 * a cientos de direcciones, el correo termina en spam.
 */
export default function Avisos() {
  const [grupos, setGrupos] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [grupo, setGrupo] = useState('TODOS');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [lista, setLista] = useState(null);
  const [correoPrueba, setCorreoPrueba] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState('');

  const cargar = useCallback(async () => {
    const [g, h] = await Promise.all([api.get('/admin/avisos/grupos'), api.get('/admin/avisos')]);
    setGrupos(g.data);
    setHistorial(h.data);
  }, []);

  useEffect(() => {
    cargar().catch(() => setGrupos([]));
  }, [cargar]);

  // Mientras algo se esté enviando, el historial se refresca solo.
  useEffect(() => {
    if (!historial.some((a) => a.estado === 'ENVIANDO')) return undefined;
    const reloj = setInterval(() => {
      api.get('/admin/avisos').then(({ data }) => setHistorial(data));
    }, 4000);
    return () => clearInterval(reloj);
  }, [historial]);

  if (!grupos) return <Cargando texto="Cargando los avisos" />;

  const elegido = grupos.find((g) => g.id === grupo);

  const verDestinatarios = async () => {
    setError('');
    setProcesando('ver');
    try {
      const { data } = await api.get('/admin/avisos/destinatarios', { params: { grupo } });
      setLista(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar la lista'));
    } finally {
      setProcesando('');
    }
  };

  const probar = async () => {
    setError('');
    setAviso('');
    setProcesando('prueba');
    try {
      await api.post('/admin/avisos/prueba', { para: correoPrueba, asunto, mensaje });
      setAviso(`Prueba enviada a ${correoPrueba}`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo enviar la prueba'));
    } finally {
      setProcesando('');
    }
  };

  const enviar = async () => {
    if (
      !window.confirm(
        `¿Enviar este aviso a ${elegido?.total || 0} tutores? No se puede cancelar a medias.`,
      )
    )
      return;

    setError('');
    setAviso('');
    setProcesando('enviar');
    try {
      const { data } = await api.post('/admin/avisos', { grupo, asunto, mensaje });
      setAviso(`Enviando a ${data.total} tutores. El avance se ve abajo.`);
      setAsunto('');
      setMensaje('');
      await cargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo enviar'));
    } finally {
      setProcesando('');
    }
  };

  const listo = asunto.trim() && mensaje.trim();

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Nuevo aviso</h3>
        <p className="mt-3 text-xl text-slate-600">
          Les llega por correo, con el logo y el formato del concurso.
        </p>

        <div className="mt-8 space-y-6">
          <div>
            <span className="mb-3 block text-xl font-semibold text-slate-800">¿A quiénes?</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {grupos.map((item) => {
                const activo = item.id === grupo;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setGrupo(item.id);
                      setLista(null);
                    }}
                    disabled={item.total === 0}
                    className={`flex items-center justify-between gap-4 rounded-2xl border-2 p-5 text-left transition ${
                      activo
                        ? 'border-granate-600 bg-granate-50'
                        : item.total === 0
                          ? 'cursor-not-allowed border-slate-200 opacity-50'
                          : 'border-slate-200 hover:border-granate-300'
                    }`}
                  >
                    <span className="text-xl text-slate-900">{item.texto}</span>
                    <span
                      className={`shrink-0 text-2xl font-black ${activo ? 'text-granate-700' : 'text-slate-400'}`}
                    >
                      {item.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Campo
            etiqueta="Asunto"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            placeholder="Cambio de fecha de la primera etapa"
          />

          <label className="block">
            <span className="mb-2 block text-xl font-semibold text-slate-800">Mensaje</span>
            <textarea
              rows={8}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder={'Escriba el aviso.\n\nDeje una línea en blanco para separar párrafos.'}
              className="w-full rounded-2xl border-2 border-slate-200 px-5 py-4 text-xl outline-none focus:border-granate-600"
            />
            <span className="mt-2 block text-base text-slate-500">
              Cada tutor lo recibe con su nombre. {mensaje.length} de 4000 caracteres.
            </span>
          </label>

          {error && (
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          )}
          {aviso && (
            <Aviso tipo="exito" icono={CheckCircle2}>
              {aviso}
            </Aviso>
          )}

          {/* Antes de mandar: ver a quiénes va y probarlo con uno mismo. */}
          <div className="rounded-2xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-end gap-4">
              <Boton
                variante="contorno"
                tamano="chico"
                cargando={procesando === 'ver'}
                onClick={verDestinatarios}
              >
                <Users className="h-5 w-5" />
                Ver destinatarios
              </Boton>

              <div className="min-w-[16rem] flex-1">
                <Campo
                  etiqueta="Probar en mi correo"
                  compacto
                  type="email"
                  value={correoPrueba}
                  onChange={(e) => setCorreoPrueba(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <Boton
                variante="contorno"
                tamano="chico"
                disabled={!listo || !correoPrueba.trim()}
                cargando={procesando === 'prueba'}
                onClick={probar}
              >
                <Eye className="h-5 w-5" />
                Enviar prueba
              </Boton>
            </div>

            {lista && (
              <div className="mt-5 max-h-64 overflow-y-auto rounded-2xl bg-white p-4">
                <p className="text-base font-bold text-slate-700">
                  {lista.length} {lista.length === 1 ? 'destinatario' : 'destinatarios'}
                </p>
                <ul className="mt-3 space-y-1">
                  {lista.map((t) => (
                    <li key={t.id} className="text-base text-slate-600">
                      {t.institucion || 'Sin institución'} ·{' '}
                      <span className="text-slate-500">{t.correo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Boton
              disabled={!listo || !elegido?.total}
              cargando={procesando === 'enviar'}
              onClick={enviar}
            >
              <Send className="h-6 w-6" />
              Enviar a {elegido?.total || 0} tutores
            </Boton>
            <p className="text-base text-slate-500">
              Sale por tandas de 15 con pausa, para que no lo marquen como spam.
            </p>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Avisos enviados</h3>
        {historial.length === 0 ? (
          <p className="mt-6 text-xl text-slate-500">Todavía no mandó ninguno.</p>
        ) : (
          <div className="mt-8 space-y-4">
            {historial.map((item) => (
              <div key={item.id} className="rounded-2xl border-2 border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-slate-900">{item.asunto}</p>
                    <p className="mt-1 text-base text-slate-600">
                      {new Date(item.createdAt).toLocaleString('es-PE')}
                      {item.creadoPor && ` · ${item.creadoPor}`}
                    </p>
                  </div>
                  {item.estado === 'ENVIANDO' ? (
                    <Etiqueta className="flex items-center gap-2 bg-sky-100 text-sky-800">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando
                    </Etiqueta>
                  ) : (
                    <Etiqueta
                      className={
                        item.fallidos > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }
                    >
                      {item.fallidos > 0 ? `${item.fallidos} no salieron` : 'Enviado'}
                    </Etiqueta>
                  )}
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-granate-600 transition-all duration-700"
                    style={{
                      width: `${item.total ? ((item.enviados + item.fallidos) / item.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-base text-slate-600">
                  {item.enviados} de {item.total} enviados
                </p>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
