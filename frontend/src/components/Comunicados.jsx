import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Megaphone } from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Tarjeta } from './Ui.jsx';
import Comunicado, { ESTILOS } from './Comunicado.jsx';
import { api, mensajeError } from '../lib/api';

const LARGOS = { titulo: 90, descripcion: 1200, firma: 80 };

/**
 * Panel de la comisión > Comunicados.
 *
 * Un comunicado a la vez: el que esté publicado se abre sobre la portada
 * apenas alguien entra. Se edita, se mira al costado cómo va a quedar y se
 * publica o se retira.
 */
export default function Comunicados() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState('');

  useEffect(() => {
    api
      .get('/ajustes/comunicado')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar el comunicado')));
  }, []);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando el comunicado" />;

  const cambiar = (campo) => (evento) => {
    setDatos({ ...datos, [campo]: evento.target.value });
    setMensaje('');
  };

  const guardar = async (cambios, textoOk) => {
    setError('');
    setMensaje('');
    setGuardando(cambios.publicado === undefined ? 'guardar' : 'publicar');
    try {
      const { data } = await api.post('/ajustes/comunicado', { ...datos, ...cambios });
      setDatos(data);
      setMensaje(textoOk);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar'));
    } finally {
      setGuardando('');
    }
  };

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <Megaphone className="h-9 w-9 text-granate-600" />
          Comunicado de la portada
        </h3>
        <p className="mt-3 text-xl text-slate-600">
          Se abre sobre la página principal apenas alguien entra. Cada vez que lo edite se les
          vuelve a mostrar, incluso a quienes ya lo habían cerrado.
        </p>

        <div className="mt-6">
          <Aviso
            tipo={datos.publicado ? 'exito' : 'info'}
            icono={datos.publicado ? CheckCircle2 : AlertCircle}
            compacto
          >
            {datos.publicado
              ? 'Publicado: se está mostrando en la portada.'
              : 'Sin publicar: nadie lo ve todavía.'}
          </Aviso>
        </div>
      </Tarjeta>

      <div className="grid gap-8 xl:grid-cols-2">
        <Tarjeta>
          <h4 className="text-xl font-black text-slate-900">Contenido</h4>

          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              guardar({}, 'Comunicado guardado');
            }}
            className="mt-6 space-y-6"
          >
            <Campo
              etiqueta="Título"
              placeholder="Cambio de fecha de la primera etapa"
              maxLength={LARGOS.titulo}
              value={datos.titulo || ''}
              onChange={cambiar('titulo')}
            />

            <label className="block">
              <span className="mb-2 block text-xl font-semibold text-slate-800">Descripción</span>
              <textarea
                rows={7}
                maxLength={LARGOS.descripcion}
                value={datos.descripcion || ''}
                onChange={cambiar('descripcion')}
                placeholder="Escriba aquí el comunicado. Puede dejar líneas en blanco para separar párrafos."
                className="w-full rounded-2xl border-2 border-slate-200 px-5 py-4 text-xl outline-none focus:border-granate-600"
              />
              <span className="mt-1.5 block text-base text-slate-500">
                Se respetan los saltos de línea. {(datos.descripcion || '').length} de{' '}
                {LARGOS.descripcion}.
              </span>
            </label>

            <Campo
              etiqueta="Firma"
              ayuda="La última línea, alineada a la derecha."
              placeholder="Atte.: Comisión Organizadora"
              maxLength={LARGOS.firma}
              value={datos.firma || ''}
              onChange={cambiar('firma')}
            />

            <div>
              <span className="mb-3 block text-xl font-semibold text-slate-800">
                Forma del comunicado
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(ESTILOS).map(([clave, estilo]) => {
                  const activo = (datos.estilo || 'AVISO') === clave;

                  return (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => setDatos({ ...datos, estilo: clave })}
                      className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
                        activo
                          ? 'border-granate-600 bg-granate-50'
                          : 'border-slate-200 hover:border-granate-300'
                      }`}
                    >
                      {/* Una muestra del degradado: el icono es el mismo en todos. */}
                      <span
                        className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br shadow-[0_6px_12px_-6px_rgba(15,23,42,0.5)] ${estilo.miniatura}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-base font-black text-slate-900">
                          {estilo.nombre}
                        </span>
                        <span className="block text-base text-slate-600">{estilo.detalle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <Aviso tipo="error" icono={AlertCircle}>
                {error}
              </Aviso>
            )}
            {mensaje && (
              <Aviso tipo="exito" icono={CheckCircle2}>
                {mensaje}
              </Aviso>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <Boton type="submit" cargando={guardando === 'guardar'}>
                Guardar cambios
              </Boton>

              <Boton
                type="button"
                variante={datos.publicado ? 'peligro' : 'exito'}
                cargando={guardando === 'publicar'}
                disabled={!datos.titulo?.trim() && !datos.publicado}
                onClick={() =>
                  guardar(
                    { publicado: !datos.publicado },
                    datos.publicado
                      ? 'Comunicado retirado de la portada'
                      : 'Comunicado publicado: ya se abre en la portada',
                  )
                }
              >
                {datos.publicado ? 'Retirar de la portada' : 'Publicar en la portada'}
              </Boton>
            </div>
          </form>
        </Tarjeta>

        <div>
          <h4 className="text-xl font-black text-slate-900">Así se va a ver</h4>
          <p className="mt-2 text-base text-slate-600">
            La ventana se adapta sola al celular; aquí se muestra sin el fondo oscuro.
          </p>

          <div className="mt-6 flex justify-center rounded-3xl bg-slate-100 p-5">
            {datos.titulo?.trim() ? (
              <Comunicado comunicado={datos} previo />
            ) : (
              <p className="py-16 text-center text-xl text-slate-500">
                Escriba el título y aparecerá aquí.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
