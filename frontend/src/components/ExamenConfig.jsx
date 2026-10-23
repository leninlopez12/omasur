import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Search, Trash2, Upload, Video } from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Selector, Tarjeta } from './Ui.jsx';
import { COLOR_ALTERNATIVA, ICONO_EXCEL } from './RespuestasExamen.jsx';
import { Corregido, SelectorDelegacion, useDelegaciones } from './ExamenDelegacion.jsx';
import { sinTildes } from './ExamenEntregas.jsx';
import { api, descargar, mensajeError } from '../lib/api';
import { useAjustes } from '../lib/ajustes';
import { GRADOS } from '../lib/datos';

export const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E', 'BLANCO'];
export const PREGUNTAS = 20;

/** Lo mismo que acepta la API: conviene avisarlo antes de subir 100 MB en vano. */
const TOPE_VIDEO = 100 * 1024 * 1024;

/**
 * La configuración del examen, compartida por las pantallas que la tocan.
 *
 * Cada una la pide por su cuenta al abrirse: son pantallas distintas del
 * sidebar y no hay forma de que una vea la copia vieja de la otra.
 */
export function useConfigExamen() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState('');
  const [mensaje, setMensaje] = useState('');
  // Qué acción dejó el último aviso: cada tarjeta muestra solo el suyo, para
  // que el resultado aparezca junto al botón que se tocó.
  const [ultimo, setUltimo] = useState('');

  useEffect(() => {
    api
      .get('/examen/config')
      .then(({ data }) => setConfig(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar la configuración')));
  }, []);

  const guardar = useCallback(async (cambios, textoOk, etiqueta = 'guardar') => {
    setError('');
    setMensaje('');
    setUltimo(etiqueta);
    setGuardando(etiqueta);
    try {
      const { data } = await api.post('/examen/config', cambios);
      setConfig(data);
      setMensaje(textoOk);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar'));
    } finally {
      setGuardando('');
    }
  }, []);

  return { config, setConfig, error, mensaje, ultimo, guardando, guardar };
}

/** El mismo pie de avisos en todas las pantallas que guardan algo. */
function Resultado({ error, mensaje }) {
  if (!error && !mensaje) return null;
  return (
    <div className="mt-6">
      {error ? (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      ) : (
        <Aviso tipo="exito" icono={CheckCircle2}>
          {mensaje}
        </Aviso>
      )}
    </div>
  );
}

/**
 * Examen · Respuestas correctas.
 *
 * La clave de cada categoría y el interruptor que abre el envío. Van juntos
 * porque no se puede abrir sin haber cargado al menos una clave.
 */
export function ExamenRespuestas() {
  const { config, setConfig, error, mensaje, ultimo, guardando, guardar } = useConfigExamen();
  const [categoria, setCategoria] = useState('A');

  if (error && !config) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!config) return <Cargando texto="Cargando el examen" />;

  const clave = config.claves[categoria] || Array(PREGUNTAS).fill('BLANCO');
  const cargadas = Object.keys(config.claves).length;

  const marcar = (indice, valor) => {
    const nueva = [...clave];
    nueva[indice] = valor;
    setConfig({ ...config, claves: { ...config.claves, [categoria]: nueva } });
  };

  return (
    <div className="space-y-8">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-5">
            <img src={ICONO_EXCEL} alt="" className="h-14 w-14 shrink-0 object-contain" />
            <div>
              <h3 className="text-3xl font-black text-slate-900">Respuestas correctas</h3>
              <p className="mt-2 text-xl text-slate-600">
                Marque la clave de cada categoría y abra el envío. Si corrige una respuesta
                después, todo lo ya entregado se vuelve a calificar solo.
              </p>
            </div>
          </div>

          <Boton
            variante={config.publicado ? 'peligro' : 'exito'}
            cargando={guardando === 'publicar'}
            disabled={!config.publicado && cargadas === 0}
            onClick={() =>
              guardar(
                { publicado: !config.publicado },
                config.publicado
                  ? 'Envío cerrado: los tutores ya no pueden subir respuestas'
                  : 'Envío abierto: los tutores ya pueden subir sus respuestas',
                'publicar',
              )
            }
          >
            {config.publicado ? 'Cerrar el envío' : 'Abrir el envío'}
          </Boton>
        </div>

        <div className="mt-6">
          <Aviso
            tipo={config.publicado ? 'exito' : 'info'}
            icono={config.publicado ? CheckCircle2 : AlertCircle}
            compacto
          >
            {config.publicado ? 'Abierto' : 'Cerrado'}. {cargadas}{' '}
            {cargadas === 1 ? 'categoría cargada' : 'categorías cargadas'}.
            {!config.publicado && cargadas === 0 &&
              ' Cargue las respuestas de al menos una categoría para poder abrir el envío.'}
          </Aviso>
        </div>

        {ultimo === 'publicar' && <Resultado error={error} mensaje={mensaje} />}
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-sm flex-1">
            <Selector
              etiqueta="Categoría"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {GRADOS.map((g) => (
                <option key={g.categoria} value={g.categoria}>
                  CAT. {g.categoria} · {g.label}
                  {config.claves[g.categoria] ? ' ✓' : ''}
                </option>
              ))}
            </Selector>
          </div>
          <Boton
            cargando={guardando === 'guardar'}
            onClick={() =>
              guardar(
                { claves: { [categoria]: clave } },
                `Respuestas de la CAT. ${categoria} guardadas`,
              )
            }
          >
            Guardar CAT. {categoria}
          </Boton>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {clave.map((valor, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base font-black text-slate-700">
                {i + 1}
              </span>
              <div className="flex flex-wrap gap-1">
                {ALTERNATIVAS.map((alt) => (
                  <button
                    key={alt}
                    type="button"
                    onClick={() => marcar(i, alt)}
                    className={`rounded-lg px-2 py-1 text-sm font-bold transition ${
                      valor === alt
                        ? `${COLOR_ALTERNATIVA[alt]} ring-2 ring-slate-900/30`
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {alt === 'BLANCO' ? '–' : alt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {ultimo === 'guardar' && <Resultado error={error} mensaje={mensaje} />}
      </Tarjeta>
    </div>
  );
}

/** Examen · Puntaje. Cuánto suma o resta cada caso. */
export function ExamenPuntaje() {
  const { config, error, mensaje, guardando, guardar } = useConfigExamen();
  const [puntajes, setPuntajes] = useState(null);

  useEffect(() => {
    if (config && !puntajes) setPuntajes(config.puntajes);
  }, [config, puntajes]);

  if (error && !config) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!config || !puntajes) return <Cargando texto="Cargando el puntaje" />;

  const cambiar = (campo) => (evento) => setPuntajes({ ...puntajes, [campo]: evento.target.value });

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Puntaje</h3>
      <p className="mt-2 text-xl text-slate-600">
        Se aplica a todo, también a lo ya entregado: al cambiarlo se recalculan los puntajes.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <Campo
          etiqueta="Respuesta correcta"
          type="number"
          value={puntajes.correcta}
          onChange={cambiar('correcta')}
        />
        <Campo
          etiqueta="En blanco"
          type="number"
          value={puntajes.blanco}
          onChange={cambiar('blanco')}
        />
        <Campo
          etiqueta="Respuesta incorrecta"
          type="number"
          value={puntajes.incorrecta}
          onChange={cambiar('incorrecta')}
        />
      </div>

      <div className="mt-6">
        <Boton
          cargando={guardando === 'guardar'}
          onClick={() =>
            guardar(
              {
                puntajes: {
                  correcta: Number(puntajes.correcta),
                  blanco: Number(puntajes.blanco),
                  incorrecta: Number(puntajes.incorrecta),
                },
              },
              'Puntaje actualizado',
            )
          }
        >
          Guardar puntaje
        </Boton>
      </div>

      <Resultado error={error} mensaje={mensaje} />
    </Tarjeta>
  );
}

/**
 * Examen · Probar el envío.
 *
 * Se elige una delegación, se baja su Excel, se llena y se sube aquí. Corrige
 * y muestra el resultado sin guardar nada ni abrir el envío.
 */
export function ExamenPrueba() {
  const { delegaciones, error: errorLista } = useDelegaciones();
  const [tutorId, setTutorId] = useState('');
  const [buscar, setBuscar] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');
  const archivoRef = useRef(null);

  if (errorLista) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {errorLista}
      </Aviso>
    );
  }
  if (!delegaciones) return <Cargando texto="Cargando delegaciones" />;

  if (delegaciones.length === 0) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Probar el envío</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Cuando haya delegaciones aprobadas podrá ensayar con una de ellas.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  const texto = sinTildes(buscar);
  const filtradas = texto
    ? delegaciones.filter((d) => sinTildes(`${d.institucion} ${d.tutor}`).includes(texto))
    : delegaciones;

  // Si lo que se buscó deja fuera a la elegida, manda la primera del filtro:
  // así no se ensaya con una delegación que ya no está en pantalla.
  const elegida = filtradas.some((d) => d.tutorId === tutorId)
    ? tutorId
    : filtradas[0]?.tutorId || '';

  const subir = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setError('');
    setResultado(null);
    setProcesando('subir');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      const { data } = await api.post(`/examen/probar?tutorId=${elegida}`, formulario);
      setResultado(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo leer el archivo'));
    } finally {
      setProcesando('');
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Probar el envío</h3>
      <p className="mt-2 text-xl text-slate-600">
        Baje el Excel de una delegación, márquelo y súbalo aquí. No guarda nada.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Campo
          etiqueta="Buscar delegación"
          icono={Search}
          placeholder="Institución o tutor"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        {filtradas.length === 0 ? (
          <div className="flex items-end">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              Ninguna delegación coincide con lo buscado.
            </Aviso>
          </div>
        ) : (
          <SelectorDelegacion delegaciones={filtradas} value={elegida} onChange={setTutorId} />
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Boton
            variante="excel"
            disabled={!elegida}
            cargando={procesando === 'bajar'}
            onClick={async () => {
              setProcesando('bajar');
              try {
                await descargar(`/examen/plantilla/${elegida}`);
              } finally {
                setProcesando('');
              }
            }}
          >
            <Download className="h-5 w-5" />
            Bajar el Excel de la delegación
          </Boton>
          <Boton
            variante="contorno"
            disabled={!elegida}
            cargando={procesando === 'subir'}
            onClick={() => archivoRef.current?.click()}
          >
            <Upload className="h-5 w-5" />
            Subir para probar
          </Boton>
          <input
            ref={archivoRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={subir}
          />
        </div>
      </div>

      {error && (
        <div className="mt-6">
          <Aviso tipo="error" icono={AlertCircle}>
            {error}
          </Aviso>
        </div>
      )}

      {resultado && <Corregido resultado={resultado} />}
    </Tarjeta>
  );
}

/** Los rótulos cortos del cuadro de claves: 3P, 4P … 5S. */
const CORTO = {
  A: '3P',
  B: '4P',
  C: '5P',
  D: '6P',
  E: '1S',
  F: '2S',
  G: '3S',
  H: '4S',
  I: '5S',
};

/**
 * Examen · Respuestas correctas, de solo lectura.
 *
 * Es la misma clave que carga el administrador, en el cuadro de siempre: una
 * fila por pregunta y una columna por categoría. Aquí no se toca nada, y por
 * eso el supervisor puede consultarla sin riesgo de alterarla.
 */
export function ExamenClave() {
  const { config, error } = useConfigExamen();

  if (error && !config) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!config) return <Cargando texto="Cargando las respuestas" />;

  const conClave = GRADOS.filter((g) => config.claves[g.categoria]);

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Respuestas correctas</h3>
      <p className="mt-2 text-xl text-slate-600">
        Solo para consultarlas. Las carga el administrador.
      </p>

      {conClave.length === 0 ? (
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay respuestas cargadas.
          </Aviso>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border-2 border-slate-300">
          <table className="w-full min-w-[36rem] border-collapse text-center">
            <thead>
              <tr className="bg-yellow-300">
                <th className="border border-slate-300 px-3 py-2 text-left text-base font-black text-slate-900">
                  PREGUNTA
                </th>
                {conClave.map((g) => (
                  <th
                    key={g.categoria}
                    title={g.label}
                    className="border border-slate-300 px-3 py-2 text-base font-black text-slate-900"
                  >
                    {CORTO[g.categoria]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: PREGUNTAS }, (_, i) => (
                <tr key={i} className="odd:bg-white even:bg-slate-50">
                  <td className="border border-slate-300 px-3 py-1.5 text-base font-black text-rose-600">
                    {i + 1}
                  </td>
                  {conClave.map((g) => {
                    const valor = config.claves[g.categoria][i];
                    return (
                      <td
                        key={g.categoria}
                        className="border border-slate-300 px-3 py-1.5 text-base font-black text-rose-600"
                      >
                        {valor === 'BLANCO' ? '–' : valor}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

/**
 * Examen · Video tutorial.
 *
 * El video vive en Cloudflare, igual que las bases. Mientras no haya uno, el
 * aviso que recibe el tutor no muestra el botón «Ver tutorial».
 */
export function ExamenTutorial() {
  const { ajustes, recargar } = useAjustes();
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState('');
  const [avance, setAvance] = useState(0);
  const archivoRef = useRef(null);

  const video = ajustes.archivos?.tutorial || null;

  /** Lo que se puede revisar sin gastar una subida entera. */
  const revisar = (elegido) => {
    if (!/\.(mp4|m4v|webm)$/i.test(elegido.name)) {
      const tiene = elegido.name.includes('.') ? elegido.name.split('.').pop() : 'sin extensión';
      return `El archivo es «${tiene}» y solo se aceptan MP4 o WEBM. Conviértalo y vuelva a intentarlo.`;
    }
    if (elegido.size > TOPE_VIDEO) {
      const pesa = Math.ceil(elegido.size / 1024 / 1024);
      return `El video pesa ${pesa} MB y el máximo es ${TOPE_VIDEO / 1024 / 1024} MB. Comprímalo o recórtelo.`;
    }
    if (elegido.size === 0) return 'El archivo llegó vacío. Vuelva a elegirlo.';
    return '';
  };

  const subir = async () => {
    if (!archivo) return setError('Elija el video');

    const problema = revisar(archivo);
    if (problema) return setError(problema);

    setError('');
    setMensaje('');
    setAvance(0);
    setProcesando('subir');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      await api.post('/ajustes/tutorial', formulario, {
        // Un video tarda: sin esto la pantalla parece colgada y se recarga a
        // medio camino, que es la forma más fácil de que no suba nunca.
        timeout: 15 * 60 * 1000,
        onUploadProgress: (evento) => {
          if (evento.total) setAvance(Math.round((evento.loaded / evento.total) * 100));
        },
      });
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = '';
      setMensaje('Tutorial publicado: los tutores ya ven el botón «Ver tutorial»');
      await recargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir el video'));
    } finally {
      setProcesando('');
      setAvance(0);
    }
  };

  const quitar = async () => {
    if (!window.confirm('¿Quitar el tutorial? El botón desaparecerá del aviso.')) return;
    setError('');
    setMensaje('');
    setProcesando('quitar');
    try {
      await api.delete('/ajustes/tutorial');
      setMensaje('Tutorial retirado');
      await recargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo quitar el video'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Video tutorial</h3>
      <p className="mt-2 text-xl text-slate-600">
        Video MP4 o WEBM, hasta 100 MB. Aparece como «Ver tutorial» en el aviso del examen.
      </p>

      <div className="mt-8 rounded-2xl border-2 border-slate-200 p-6">
        {video ? (
          <>
            <div className="flex flex-wrap items-center gap-5">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-granate-50">
                <Video className="h-9 w-9 text-granate-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-black text-slate-900">{video.nombre}</p>
                <p className="mt-1 text-base text-slate-600">
                  {Math.max(1, Math.round(video.tamano / 1024 / 1024))} MB
                </p>
              </div>
            </div>
            <video src={video.url} controls className="mt-6 w-full rounded-2xl bg-slate-900" />
          </>
        ) : (
          <p className="text-xl text-slate-500">
            Todavía no hay tutorial: el botón no se muestra en el aviso.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-5">
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-granate-300 bg-granate-50 px-5 py-6 transition hover:border-granate-500 hover:bg-granate-100"
        >
          <Upload className="h-7 w-7 text-granate-600" />
          <span className="text-base font-semibold text-granate-700">
            {archivo
              ? `${archivo.name} · ${Math.max(1, Math.round(archivo.size / 1024 / 1024))} MB`
              : 'Toque para elegir el video'}
          </span>
        </button>

        {procesando === 'subir' && (
          <div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-granate-600 transition-all"
                style={{ width: `${avance}%` }}
              />
            </div>
            <p className="mt-2 text-base text-slate-600">
              {avance < 100
                ? `Subiendo… ${avance}%. No cierre esta página.`
                : 'Guardando en Cloudflare…'}
            </p>
          </div>
        )}
        <input
          ref={archivoRef}
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          className="hidden"
          onChange={(e) => {
            const elegido = e.target.files?.[0];
            if (!elegido) return;
            setMensaje('');
            setArchivo(elegido);
            setError(revisar(elegido));
          }}
        />

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

        <div className="flex flex-wrap gap-3">
          <Boton cargando={procesando === 'subir'} onClick={subir}>
            <Upload className="h-6 w-6" />
            {video ? 'Reemplazar tutorial' : 'Publicar tutorial'}
          </Boton>
          {video && (
            <Boton variante="contorno" cargando={procesando === 'quitar'} onClick={quitar}>
              <Trash2 className="h-6 w-6" />
              Quitar
            </Boton>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}
