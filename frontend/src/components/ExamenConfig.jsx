import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Upload } from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Selector, Tarjeta } from './Ui.jsx';
import { COLOR_ALTERNATIVA, ICONO_EXCEL } from './RespuestasExamen.jsx';
import { Corregido, SelectorDelegacion, useDelegaciones } from './ExamenDelegacion.jsx';
import { api, descargar, mensajeError } from '../lib/api';
import { GRADOS } from '../lib/datos';

export const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E', 'BLANCO'];
export const PREGUNTAS = 20;

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
                Marque la clave de cada categoría y abra el envío.
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
        Se aplica al corregir. Si lo cambia, vuelva a pedirle el archivo a quien ya envió.
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

  const elegida = tutorId || delegaciones[0].tutorId;

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
        <SelectorDelegacion delegaciones={delegaciones} value={elegida} onChange={setTutorId} />

        <div className="flex flex-wrap items-end gap-3">
          <Boton
            variante="excel"
            cargando={procesando === 'bajar'}
            onClick={async () => {
              setProcesando('bajar');
              try {
                await descargar(`/examen/plantilla/${elegida}`, 'respuestas-prueba.xlsx');
              } finally {
                setProcesando('');
              }
            }}
          >
            <Download className="h-5 w-5" />
            Bajar su Excel
          </Boton>
          <Boton
            variante="contorno"
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
