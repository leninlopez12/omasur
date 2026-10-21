import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, IdCard, ImageUp, Trash2, Upload } from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';
import { useAjustes } from '../lib/ajustes';

/** Lo que la comisión escribe y dónde cae en la credencial impresa. */
const CAMPOS = [
  { id: 'etiqueta', etiqueta: 'Nombre de la etapa', ayuda: 'Va en el óvalo bajo la cabecera.' },
  { id: 'titulo', etiqueta: 'Título', ayuda: 'La línea grande de la cabecera.' },
  { id: 'subtitulo', etiqueta: 'Subtítulo', ayuda: 'Debajo del título.' },
  { id: 'organizador', etiqueta: 'Organizador', ayuda: 'La última línea de la cabecera.' },
  { id: 'fecha', etiqueta: 'Fecha del examen', ayuda: 'Recuadro de la derecha.' },
  { id: 'hora', etiqueta: 'Hora de ingreso', ayuda: 'Al lado del grado.' },
  { id: 'lugar', etiqueta: 'Lugar', ayuda: 'Debajo de la institución. Puede quedar vacío.' },
];

const LARGOS = {
  etiqueta: 40,
  titulo: 60,
  subtitulo: 80,
  organizador: 90,
  fecha: 60,
  hora: 40,
  lugar: 90,
  indicaciones: 160,
  pie: 120,
};

/**
 * Panel de la comisión > Credenciales.
 *
 * Las dos etapas del concurso, con los textos de su credencial. Mientras una
 * no esté publicada, sus credenciales no se descargan: así se puede dejar
 * todo escrito y recién abrirlo el día que corresponde.
 */
export default function EtapasCredencial() {
  const [etapas, setEtapas] = useState(null);
  const [actual, setActual] = useState('INSTITUCIONAL');
  const [error, setError] = useState('');
  const { ajustes, recargar } = useAjustes();

  const cargar = async () => {
    try {
      const { data } = await api.get('/credenciales/etapas/todas');
      setEtapas(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar las etapas'));
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!etapas) return <Cargando texto="Cargando las etapas" />;

  const etapa = etapas.find((e) => e.clave === actual);

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <IdCard className="h-9 w-9 text-granate-600" />
          Credenciales
        </h3>
        <p className="mt-3 text-xl text-slate-600">
          Cada etapa tiene su propia credencial. Edítela, mire la muestra y publíquela para que
          los tutores puedan descargarla.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {etapas.map((e) => (
            <button
              key={e.clave}
              onClick={() => setActual(e.clave)}
              className={`rounded-2xl border-2 p-5 text-left transition ${
                e.clave === actual
                  ? 'border-granate-600 bg-granate-50'
                  : 'border-slate-200 hover:border-granate-300'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xl font-black text-slate-900">{e.etiqueta}</span>
                <Etiqueta
                  compacto
                  className={
                    e.publicada
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }
                >
                  {e.publicada ? 'Publicada' : 'Sin publicar'}
                </Etiqueta>
              </div>
              <p className="mt-2 text-base text-slate-600">
                {e.fecha} · {e.hora}
              </p>
            </button>
          ))}
        </div>
      </Tarjeta>

      <LogoCredencial logo={ajustes.archivos?.credencial} alCambiar={recargar} />

      <Formulario key={etapa.clave} etapa={etapa} alGuardar={cargar} />
    </div>
  );
}

/**
 * El logo impreso a la derecha de la cabecera.
 *
 * Vive en Cloudflare como las demás imágenes del sistema; es el mismo para
 * las dos etapas, porque es el de la institución y no el del examen.
 */
function LogoCredencial({ logo, alCambiar }) {
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState('');
  const archivoRef = useRef(null);

  const elegir = (evento) => {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    setArchivo(elegido);
    setVista(URL.createObjectURL(elegido));
    setMensaje('');
  };

  const subir = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    if (!archivo) return setError('Elija la imagen del logo');

    setProcesando('subir');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      await api.post('/ajustes/credencial', formulario);
      setArchivo(null);
      setVista('');
      setMensaje('Logo publicado: ya sale en las credenciales');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir la imagen'));
    } finally {
      setProcesando('');
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  const quitar = async () => {
    if (!window.confirm('¿Quitar el logo? Se borra de Cloudflare y la credencial sale sin él.')) {
      return;
    }
    setError('');
    setMensaje('');
    setProcesando('quitar');
    try {
      await api.delete('/ajustes/credencial');
      setMensaje('Logo quitado');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo quitar el logo'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <Tarjeta>
      <h4 className="text-xl font-black text-slate-900">Logo de la credencial</h4>
      <p className="mt-2 text-base text-slate-600">
        Se imprime a la derecha de la cabecera, en las dos etapas. Cuadrado y con fondo claro se
        ve mejor sobre el granate.
      </p>

      <form onSubmit={subir} className="mt-6 grid gap-6 md:grid-cols-[14rem_1fr]">
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-granate-700 p-6">
          {vista || logo?.url ? (
            <img
              src={vista || logo.url}
              alt="Logo de la credencial"
              className="max-h-28 w-auto object-contain"
            />
          ) : (
            <span className="text-base text-granate-100">Sin logo</span>
          )}
        </div>

        <div className="space-y-5">
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-granate-300 bg-granate-50 px-5 py-7 transition hover:border-granate-500 hover:bg-granate-100"
          >
            <ImageUp className="h-10 w-10 text-granate-600" />
            <span className="text-base font-semibold text-granate-700">
              {archivo ? archivo.name : 'Toque para elegir la imagen'}
            </span>
          </button>
          <input
            ref={archivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={elegir}
          />

          {error && (
            <Aviso tipo="error" icono={AlertCircle} compacto>
              {error}
            </Aviso>
          )}
          {mensaje && (
            <Aviso tipo="exito" icono={CheckCircle2} compacto>
              {mensaje}
            </Aviso>
          )}

          <div className="flex flex-wrap gap-3">
            <Boton type="submit" tamano="chico" cargando={procesando === 'subir'}>
              <Upload className="h-5 w-5" />
              {logo ? 'Reemplazar logo' : 'Publicar logo'}
            </Boton>
            {logo && (
              <Boton
                type="button"
                variante="contorno"
                tamano="chico"
                cargando={procesando === 'quitar'}
                onClick={quitar}
              >
                <Trash2 className="h-5 w-5" />
                Quitar
              </Boton>
            )}
          </div>
        </div>
      </form>
    </Tarjeta>
  );
}

function Formulario({ etapa, alGuardar }) {
  const [datos, setDatos] = useState(etapa);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState('');

  const cambiar = (campo) => (evento) => {
    setDatos({ ...datos, [campo]: evento.target.value });
    setMensaje('');
  };

  const guardar = async (cambios, textoOk) => {
    setError('');
    setMensaje('');
    setGuardando(cambios.publicada === undefined ? 'guardar' : 'publicar');
    try {
      const { data } = await api.post(`/credenciales/etapas/${etapa.clave}`, cambios);
      setDatos(data);
      setMensaje(textoOk);
      await alGuardar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar'));
    } finally {
      setGuardando('');
    }
  };

  // La muestra se abre en otra pestaña: es un PDF, no una pantalla más.
  const verMuestra = async () => {
    setError('');
    try {
      const { data } = await api.get(`/credenciales/etapas/${etapa.clave}/muestra`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo abrir la muestra'));
    }
  };

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h4 className="text-xl font-black text-slate-900">{datos.etiqueta}</h4>
          <p className="mt-2 text-base text-slate-600">
            Lo que escriba aquí sale impreso en la credencial de cada estudiante. El campo que
            deje vacío no se imprime, y su título tampoco.
          </p>
        </div>
        <Boton variante="contorno" tamano="chico" onClick={verMuestra}>
          <Eye className="h-5 w-5" />
          Ver muestra
        </Boton>
      </div>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          guardar(datos, 'Credencial actualizada');
        }}
        className="mt-8 space-y-6"
      >
        <div className="grid gap-6 md:grid-cols-2">
          {CAMPOS.map((campo) => (
            <Campo
              key={campo.id}
              etiqueta={campo.etiqueta}
              ayuda={campo.ayuda}
              maxLength={LARGOS[campo.id]}
              value={datos[campo.id] || ''}
              onChange={cambiar(campo.id)}
            />
          ))}
        </div>

        <label className="block">
          <span className="mb-2 block text-xl font-semibold text-slate-800">Indicaciones</span>
          <textarea
            rows={2}
            maxLength={LARGOS.indicaciones}
            value={datos.indicaciones || ''}
            onChange={cambiar('indicaciones')}
            className="w-full rounded-2xl border-2 border-slate-200 px-5 py-4 text-xl outline-none focus:border-granate-600"
          />
          <span className="mt-1.5 block text-base text-slate-500">
            Bajo la línea del pie. {(datos.indicaciones || '').length} de {LARGOS.indicaciones}.
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-xl font-semibold text-slate-800">Nota al pie</span>
          <textarea
            rows={2}
            maxLength={LARGOS.pie}
            value={datos.pie || ''}
            onChange={cambiar('pie')}
            className="w-full rounded-2xl border-2 border-slate-200 px-5 py-4 text-xl outline-none focus:border-granate-600"
          />
          <span className="mt-1.5 block text-base text-slate-500">
            La última línea, en cursiva. Puede quedar vacía.
          </span>
        </label>

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
            variante={datos.publicada ? 'peligro' : 'exito'}
            cargando={guardando === 'publicar'}
            onClick={() =>
              guardar(
                { publicada: !datos.publicada },
                datos.publicada
                  ? 'Credencial retirada: los tutores ya no pueden descargarla'
                  : 'Credencial publicada: los tutores ya pueden descargarla',
              )
            }
          >
            {datos.publicada ? 'Retirar la publicación' : 'Publicar esta etapa'}
          </Boton>
        </div>
      </form>

      <div className="mt-6">
        <Aviso tipo={datos.publicada ? 'exito' : 'info'} icono={AlertCircle} compacto>
          {datos.publicada
            ? 'Está publicada: los tutores la ven en «Credenciales» y pueden descargar los PDF.'
            : 'Sin publicar: los tutores todavía no pueden descargar esta credencial.'}
        </Aviso>
      </div>
    </Tarjeta>
  );
}
