import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Hash,
  Inbox,
  ListChecks,
  Lock,
  LockOpen,
  Send,
  Upload,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { COLOR_ALTERNATIVA } from './RespuestasExamen.jsx';
import { COLOR_NIVEL, NIVEL } from './FinalSalones.jsx';
import { api, descargar, mensajeError } from '../lib/api';

const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E', 'BLANCO'];

/** La configuración del examen final, que es común a las pantallas. */
function useConfigFinal() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/examen/config');
      setConfig(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar la configuración'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { config, setConfig, error, recargar: cargar };
}

// ---------------------------------------------------------------------------
// Respuestas correctas
// ---------------------------------------------------------------------------

/**
 * Final · Respuestas correctas.
 *
 * La prueba tiene dos tramos: las de alternativa, que se marcan, y cinco de
 * respuesta numérica, donde se escribe el número. Secundaria trae quince de
 * alternativa y primaria diez, así que la pantalla se arma con la forma de la
 * categoría elegida y no con una cantidad fija.
 */
export function FinalExamenClave() {
  const { config, setConfig, error: errorCarga } = useConfigFinal();
  const [categoria, setCategoria] = useState('E');
  const [alternativas, setAlternativas] = useState([]);
  const [numericas, setNumericas] = useState([]);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const forma = config?.estructura?.find((e) => e.categoria === categoria);

  useEffect(() => {
    if (!config || !forma) return;
    const guardada = config.claves?.[categoria] || {};
    setAlternativas(
      Array.from({ length: forma.alternativas }, (_, i) => guardada.alternativas?.[i] || 'BLANCO'),
    );
    setNumericas(
      Array.from({ length: forma.numericas }, (_, i) => guardada.numericas?.[i] || ''),
    );
  }, [config, categoria, forma]);

  if (errorCarga && !config) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {errorCarga}
      </Aviso>
    );
  }
  if (!config || !forma) return <Cargando texto="Cargando la clave de la final" />;

  const guardar = async () => {
    setError('');
    setAviso('');
    setGuardando(true);
    try {
      const { data } = await api.post('/final/examen/clave', {
        categoria,
        clave: { alternativas, numericas },
      });
      setConfig({ ...data, estructura: config.estructura });
      setAviso(`Clave de la CAT. ${categoria} guardada`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar la clave'));
    } finally {
      setGuardando(false);
    }
  };

  const marcar = (i, valor) => setAlternativas(alternativas.map((c, j) => (j === i ? valor : c)));
  const escribir = (i, valor) =>
    setNumericas(numericas.map((c, j) => (j === i ? valor.slice(0, 20) : c)));

  const cargadas = Object.keys(config.claves || {}).length;
  const completa =
    (config.claves?.[categoria]?.numericas || []).some(Boolean) ||
    (config.claves?.[categoria]?.alternativas || []).some((a) => a !== 'BLANCO');

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Respuestas correctas</h3>
        <p className="mt-2 text-xl text-slate-600">
          La clave de la final, una por categoría. Mientras falte la de una categoría, sus
          respuestas se reciben pero quedan sin puntaje.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {['SECUNDARIA', 'PRIMARIA'].map((nivel) => {
            const ejemplo = config.estructura.find((e) => e.nivel === nivel);
            if (!ejemplo) return null;
            return (
              <div key={nivel} className="rounded-2xl border-2 border-slate-200 p-5">
                <Etiqueta compacto className={COLOR_NIVEL[nivel]}>
                  {NIVEL[nivel]}
                </Etiqueta>
                <p className="mt-3 text-xl font-black text-slate-900">
                  {ejemplo.total} preguntas
                </p>
                <p className="text-base text-slate-600">
                  {ejemplo.alternativas} de alternativa (A–E) + {ejemplo.numericas} de respuesta
                  numérica
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-base text-slate-600">
          {cargadas} de {config.estructura.length} categorías con clave cargada.
        </p>
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[20rem] flex-1">
            <Selector
              etiqueta="Categoría"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {config.estructura.map((g) => (
                <option key={g.categoria} value={g.categoria}>
                  CAT. {g.categoria} · {g.grado} · {g.total} preguntas
                  {config.claves?.[g.categoria] ? ' ✓' : ''}
                </option>
              ))}
            </Selector>
          </div>
          <Boton cargando={guardando} onClick={guardar}>
            <ListChecks className="h-6 w-6" />
            Guardar CAT. {categoria}
          </Boton>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Etiqueta compacto className={COLOR_NIVEL[forma.nivel]}>
            {forma.nivelTexto}
          </Etiqueta>
          <span className="text-base text-slate-600">
            {forma.alternativas} de alternativa + {forma.numericas} numéricas ={' '}
            <strong>{forma.total} preguntas</strong>
          </span>
          {completa && (
            <Etiqueta compacto className="bg-emerald-100 text-emerald-800">
              Ya tiene clave
            </Etiqueta>
          )}
        </div>

        {/* -------------------------------------------------- las de marcar */}
        <h4 className="mt-8 flex items-center gap-3 text-xl font-black text-slate-900">
          <ListChecks className="h-6 w-6 text-granate-600" />
          De alternativa · 1 a {forma.alternativas}
        </h4>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {alternativas.map((valor, i) => (
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

        {/* ------------------------------------------------ las de escribir */}
        <h4 className="mt-8 flex items-center gap-3 text-xl font-black text-slate-900">
          <Hash className="h-6 w-6 text-granate-600" />
          De respuesta numérica · {forma.alternativas + 1} a {forma.total}
        </h4>
        <p className="mt-2 text-base text-slate-600">
          Aquí no hay alternativas: el alumno escribe el número. Se compara como número, así que
          «07», «7» y «7.0» cuentan igual.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {numericas.map((valor, i) => (
            <div key={i} className="rounded-2xl border-2 border-slate-200 p-3">
              <span className="block text-base font-black text-granate-700">
                {forma.alternativas + i + 1}
              </span>
              <input
                value={valor}
                inputMode="decimal"
                placeholder="—"
                onChange={(e) => escribir(i, e.target.value)}
                className="mt-2 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-center text-xl font-bold text-slate-900 outline-none transition focus:border-granate-600 focus:ring-4 focus:ring-granate-100"
              />
            </div>
          ))}
        </div>
      </Tarjeta>

      {aviso && (
        <Aviso tipo="info" icono={CheckCircle2}>
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Puntaje y apertura
// ---------------------------------------------------------------------------

/** Final · Puntaje, y el interruptor que abre el envío a los responsables. */
export function FinalExamenPuntaje() {
  const { config, setConfig, error: errorCarga } = useConfigFinal();
  const [borrador, setBorrador] = useState(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');

  useEffect(() => {
    if (config) setBorrador(config.puntajes);
  }, [config]);

  if (errorCarga && !config) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {errorCarga}
      </Aviso>
    );
  }
  if (!config || !borrador) return <Cargando texto="Cargando el puntaje" />;

  const guardar = async () => {
    setError('');
    setAviso('');
    setProcesando('puntaje');
    try {
      const { data } = await api.post('/final/examen/puntajes', borrador);
      setConfig({ ...data, estructura: config.estructura });
      setAviso('Puntaje guardado');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar'));
    } finally {
      setProcesando('');
    }
  };

  const abrir = async (valor) => {
    setError('');
    setAviso('');
    setProcesando('abrir');
    try {
      const { data } = await api.post('/final/examen/abrir', { abierto: valor });
      setConfig({ ...data, estructura: config.estructura });
      setAviso(
        valor
          ? 'Abierto: los responsables ya pueden subir el acta de su salón.'
          : 'Cerrado: solo el administrador puede subir actas.',
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cambiar'));
    } finally {
      setProcesando('');
    }
  };

  const campos = [
    { id: 'correcta', texto: 'Respuesta correcta', ayuda: 'Lo que suma cada acierto.' },
    { id: 'incorrecta', texto: 'Respuesta incorrecta', ayuda: 'Normalmente resta.' },
    { id: 'blanco', texto: 'En blanco', ayuda: 'Lo habitual es cero.' },
  ];

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Puntaje</h3>
        <p className="mt-2 text-xl text-slate-600">
          Lo que vale cada respuesta, igual para las de alternativa y para las numéricas. Se puede
          cambiar después de recibir las actas: todo se vuelve a calcular.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {campos.map((c) => (
            <Campo
              key={c.id}
              etiqueta={c.texto}
              ayuda={c.ayuda}
              type="number"
              value={borrador[c.id]}
              onChange={(e) => setBorrador({ ...borrador, [c.id]: e.target.value })}
            />
          ))}
        </div>

        <div className="mt-6">
          <Boton cargando={procesando === 'puntaje'} onClick={guardar}>
            Guardar puntaje
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
          <Clock className="h-6 w-6 text-granate-600" />
          El tiempo desempata
        </h4>
        <p className="mt-2 text-base text-slate-600">
          El acta de cada salón pide la hora a la que entregó cada alumno. A igual puntaje pasa
          primero quien terminó antes, así que no hace falta inventar ningún criterio extra.
        </p>
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-xl font-black text-slate-900">Envío de actas</h4>
            <p className="mt-2 text-base text-slate-600">
              Mientras esté cerrado, solo el administrador puede subir un salón. Ábralo el día del
              examen, cuando los responsables tengan sus actas.
            </p>
          </div>
          <Etiqueta
            compacto
            className={config.abierto ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}
          >
            {config.abierto ? 'Abierto' : 'Cerrado'}
          </Etiqueta>
        </div>

        <div className="mt-6">
          <Boton
            variante={config.abierto ? 'peligro' : 'exito'}
            cargando={procesando === 'abrir'}
            onClick={() => abrir(!config.abierto)}
          >
            {config.abierto ? <Lock className="h-6 w-6" /> : <LockOpen className="h-6 w-6" />}
            {config.abierto ? 'Cerrar el envío' : 'Abrir el envío'}
          </Boton>
        </div>
      </Tarjeta>

      {aviso && (
        <Aviso tipo="info" icono={CheckCircle2}>
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subir el acta de un salón
// ---------------------------------------------------------------------------

/**
 * Final · Llenar por salón.
 *
 * Bajar el acta, marcarla, probarla y subirla. Probar es obligatorio en la
 * práctica: una vez subida, queda corregida.
 */
export function FinalExamenLlenar({ soloMios = false }) {
  const [salones, setSalones] = useState(null);
  const [id, setId] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [revision, setRevision] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');
  const [encima, setEncima] = useState(false);
  const [sello, setSello] = useState(false);
  const archivoRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get(soloMios ? '/final/mis-salones' : '/final/salones');
      const lista = data.salones || [];
      setSalones(lista);
      setId((actual) => actual || lista[0]?.id || '');
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar los salones'));
    }
  }, [soloMios]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !salones) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!salones) return <Cargando texto="Cargando los salones" />;

  if (salones.length === 0) {
    return (
      <Tarjeta>
        <Aviso tipo="info" icono={AlertCircle} compacto>
          {soloMios
            ? 'Todavía no tiene ningún salón a su cargo. El administrador se los asigna desde Examen final · Salones y horarios.'
            : 'Todavía no se armó el reparto de salones.'}
        </Aviso>
      </Tarjeta>
    );
  }

  const salon = salones.find((s) => s.id === id) || salones[0];
  const base = `/final/examen/${salon.nivel}/${salon.numero}`;

  const limpiar = () => {
    setArchivo(null);
    setRevision(null);
    if (archivoRef.current) archivoRef.current.value = '';
  };

  const subir = async (evento) => {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    await revisarArchivo(elegido);
  };

  /** Lo mismo venga del botón o de arrastrarlo encima. */
  const revisarArchivo = async (elegido) => {
    setError('');
    setEnviado(null);
    setArchivo(elegido);
    setProcesando('revisar');
    try {
      const formulario = new FormData();
      formulario.append('archivo', elegido);
      const { data } = await api.post(`${base}/revisar`, formulario);
      setRevision(data);
      setEncima(false);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo leer el archivo'));
      limpiar();
    } finally {
      setProcesando('');
    }
  };

  const enviar = async () => {
    setError('');
    setProcesando('enviar');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      const { data } = await api.post(`${base}/enviar`, formulario);
      setEnviado(data);
      setSello(true);
      limpiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo enviar'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">
          {soloMios ? 'Respuestas de mi salón' : 'Llenar por salón'}
        </h3>
        <p className="mt-2 text-xl text-slate-600">
          Baje el acta de su salón, marque lo que respondió cada alumno —incluida la hora a la que
          entregó— y súbala. Antes de enviarla verá cómo quedó.
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-3">
          <div className="min-w-[22rem] flex-1">
            <Selector
              etiqueta="Salón"
              value={salon.id}
              onChange={(e) => {
                setId(e.target.value);
                limpiar();
                setEnviado(null);
                setSello(false);
              }}
            >
              {salones.map((s) => (
                <option key={s.id} value={s.id}>
                  SALÓN {s.numero} · {NIVEL[s.nivel]} · {s.total} alumnos
                  {s.categorias?.length ? ` · CAT. ${s.categorias.join(', ')}` : ''}
                </option>
              ))}
            </Selector>
          </div>
          <Boton variante="excelContorno" onClick={() => descargar(`${base}/plantilla`)}>
            <Download className="h-6 w-6" />
            Bajar el acta
          </Boton>
        </div>

        <div className="mt-5 rounded-2xl border-2 border-slate-200 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-granate-600 text-white">
              <span className="text-xl font-black leading-none">{salon.numero}</span>
              <span className="text-xs">salón</span>
            </span>
            <div>
              <p className="text-base font-black text-slate-900">
                {NIVEL[salon.nivel]}
                {salon.categorias?.length
                  ? ` · ${salon.categorias.map((c) => `CAT. ${c}`).join(' · ')}`
                  : ''}
              </p>
              <p className="mt-1 text-base text-slate-600">
                {salon.total} {salon.total === 1 ? 'alumno' : 'alumnos'}
                {salon.horario && ` · ${salon.horario.inicio} a ${salon.horario.fin}`}
              </p>
            </div>
          </div>
        </div>

        <input ref={archivoRef} type="file" accept=".xlsx" className="hidden" onChange={subir} />
        <BandaSubir
          cargando={procesando === 'revisar'}
          encima={encima}
          setEncima={setEncima}
          alElegir={() => archivoRef.current?.click()}
          alSoltar={revisarArchivo}
        />
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      {enviado && (
        <Aviso tipo="exito" icono={CheckCircle2} titulo="Respuestas entregadas">
          El acta del salón {salon.numero} quedó registrada con {enviado.total}{' '}
          {enviado.total === 1 ? 'alumno' : 'alumnos'}
          {enviado.sinHora > 0 && ` · ${enviado.sinHora} sin hora de entrega`}.
        </Aviso>
      )}

      {sello && enviado && (
        <SelloEntregado entregado={enviado} salon={salon} alCerrar={() => setSello(false)} />
      )}

      {revision && (
        <Tarjeta>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h4 className="text-xl font-black text-slate-900">Lo que se va a entregar</h4>
              <p className="mt-1 text-base text-slate-600">
                {revision.filas.length} {revision.filas.length === 1 ? 'alumno' : 'alumnos'} con sus
                respuestas, tal como las leyó el sistema. Revíselas antes de entregar.
              </p>
            </div>
            {revision.errores.length === 0 && (
              <Boton variante="exito" cargando={procesando === 'enviar'} onClick={enviar}>
                <Send className="h-6 w-6" />
                Entregar respuestas
              </Boton>
            )}
          </div>

          {revision.sinClave.length > 0 && (
            <div className="mt-5">
              <Aviso tipo="alerta" icono={AlertCircle} compacto>
                Sin clave cargada: {revision.sinClave.map((c) => `CAT. ${c}`).join(', ')}. Las
                respuestas se guardan, pero el puntaje sale en cero hasta que se cargue.
              </Aviso>
            </div>
          )}

          {revision.errores.length > 0 && (
            <div className="mt-5">
              <Aviso tipo="error" icono={AlertCircle} titulo="Corrija el archivo antes de enviarlo">
                <ul className="mt-2 space-y-1">
                  {revision.errores.slice(0, 12).map((x, i) => (
                    <li key={i}>· {x}</li>
                  ))}
                  {revision.errores.length > 12 && <li>· y {revision.errores.length - 12} más.</li>}
                </ul>
              </Aviso>
            </div>
          )}

          {revision.sinHora.length > 0 && (
            <div className="mt-5">
              <Aviso tipo="alerta" icono={Clock} compacto>
                Sin hora de entrega: {revision.sinHora.join(', ')}. Entran igual, pero en un
                empate quedan detrás de quienes sí la tienen.
              </Aviso>
            </div>
          )}

          {revision.ausentes.length > 0 && (
            <div className="mt-5">
              <Aviso tipo="info" icono={AlertCircle} compacto>
                Sin respuestas: {revision.ausentes.join(', ')}.
              </Aviso>
            </div>
          )}

          <TablaDelActa filas={revision.filas} />

          {revision.errores.length === 0 && (
            <div className="mt-6 flex justify-end">
              <Boton variante="exito" cargando={procesando === 'enviar'} onClick={enviar}>
                <Send className="h-6 w-6" />
                Entregar respuestas
              </Boton>
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  );
}

/**
 * La banda de subir: grande y a rayas, que es lo primero que hay que
 * encontrar el día del examen y con prisa nadie busca un botón pequeño.
 */
function BandaSubir({ cargando, encima, setEncima, alElegir, alSoltar }) {
  const rayas = encima
    ? 'repeating-linear-gradient(135deg, #D3EADD 0 16px, #ECF6F0 16px 32px)'
    : 'repeating-linear-gradient(135deg, #ECF6F0 0 16px, #FFFFFF 16px 32px)';

  const soltar = (e) => {
    e.preventDefault();
    setEncima(false);
    const archivo = e.dataTransfer?.files?.[0];
    if (archivo) alSoltar(archivo);
  };

  return (
    <button
      type="button"
      onClick={alElegir}
      disabled={cargando}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
      style={{ backgroundImage: rayas }}
      className={`mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-4 border-dashed py-10 transition disabled:opacity-60 ${
        encima ? 'border-excel-600 scale-[1.01]' : 'border-excel-600/40 hover:border-excel-600'
      }`}
    >
      <span className="flex items-center gap-4 text-3xl font-black uppercase tracking-[0.2em] text-excel-700">
        <Upload className={`h-9 w-9 ${cargando ? 'animate-saltar' : ''}`} />
        {cargando ? 'Leyendo el acta…' : 'Subir Excel'}
      </span>
      <span className="text-base font-semibold text-excel-600">
        Toque aquí o arrastre el archivo · solo .xlsx
      </span>
    </button>
  );
}

/**
 * El mismo color que pinta el Excel al escribir la respuesta.
 *
 * Están repetidos a propósito en los dos sitios —aquí y en el servicio que
 * arma el acta— porque son dos lenguajes distintos; lo que no puede pasar es
 * que no coincidan: el responsable acaba de ver esos colores en su hoja.
 */
const COLOR_CASILLA = {
  A: 'bg-blue-100 text-blue-900',
  B: 'bg-green-100 text-green-900',
  C: 'bg-amber-100 text-amber-900',
  D: 'bg-purple-100 text-purple-900',
  E: 'bg-rose-100 text-rose-900',
  BLANCO: 'bg-slate-200 text-slate-500',
};

/**
 * Lo subido, con la misma forma que el Excel: una fila por alumno y una
 * columna por pregunta, numeradas igual.
 *
 * Sin aciertos ni puntaje. El responsable de aula transcribe lo que marcó el
 * chico; si ve la nota antes de entregar, acaba corrigiendo el acta en vez de
 * copiarla.
 */
function TablaDelActa({ filas }) {
  if (filas.length === 0) return null;

  const alternativas = filas[0].alternativas?.length || 0;
  const numericas = filas[0].numericas?.length || 0;

  const th = 'px-2 py-2 text-center text-base font-bold';

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
      <table className="w-full border-collapse whitespace-nowrap">
        <thead>
          <tr className="bg-granate-600 text-white">
            <th className={`${th} w-12`}>N°</th>
            <th className={`${th} text-left`}>DNI</th>
            <th className={`${th} text-left`}>APELLIDOS Y NOMBRES</th>
            <th className={th}>CAT.</th>
            {Array.from({ length: alternativas }, (_, i) => (
              <th key={`a${i}`} className={`${th} w-9`}>
                {i + 1}
              </th>
            ))}
            {Array.from({ length: numericas }, (_, i) => (
              <th key={`n${i}`} className={`${th} w-12 bg-granate-700`}>
                {alternativas + i + 1}
              </th>
            ))}
            <th className={th}>HORA</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, fila) => (
            <tr key={f.dni} className={fila % 2 ? 'bg-slate-50' : 'bg-white'}>
              <td className="px-2 py-2 text-center text-base text-slate-500">{fila + 1}</td>
              <td className="px-2 py-2 text-base text-slate-600">{f.dni}</td>
              <td className="px-2 py-2 text-base font-bold text-slate-900">{f.nombres}</td>
              <td className="px-2 py-2 text-center text-base font-semibold text-slate-700">
                {f.categoria}
              </td>

              {(f.alternativas || []).map((r, i) => (
                <td key={`a${i}`} className="p-0.5">
                  <span
                    className={`flex h-8 items-center justify-center rounded text-base font-black ${
                      COLOR_CASILLA[r] || 'bg-slate-100 text-slate-300'
                    }`}
                  >
                    {r === 'BLANCO' ? '–' : r}
                  </span>
                </td>
              ))}

              {(f.numericas || []).map((r, i) => (
                <td key={`n${i}`} className="p-0.5">
                  <span
                    className={`flex h-8 items-center justify-center rounded px-1 text-base font-black ${
                      r ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-300'
                    }`}
                  >
                    {r || '–'}
                  </span>
                </td>
              ))}

              <td className="px-2 py-2 text-center text-base">
                {f.horaEntrega || <span className="font-semibold text-amber-700">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Granate bebé a naranja bebé: el mismo fondo de la premiación. */
const FONDO_SELLO =
  'linear-gradient(135deg, #FDF3F5 0%, #FBE4E8 28%, #F7D9D4 52%, #FFE6CE 78%, #FFD6AE 100%)';

/**
 * La ventana de entregado: el disco llega girando sobre su eje y el visto se
 * dibuja solo encima.
 *
 * Sale por delante de todo a propósito. Es el único momento del día en que el
 * responsable sabe que ya terminó con su aula, y un avisito en un rincón se
 * pasa por alto justo cuando no hay que pasarlo por alto.
 */
function SelloEntregado({ entregado, salon, alCerrar }) {
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [alCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={alCerrar}
      className="fixed inset-0 z-50 flex items-center justify-center bg-granate-900/45 p-6 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: FONDO_SELLO, perspective: '900px' }}
        className="animate-emerger relative w-full max-w-xl overflow-hidden rounded-[2.5rem] p-10 text-center shadow-[0_40px_90px_-20px_rgba(123,30,43,0.55)]"
      >
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 animate-respirar rounded-full bg-granate-200/70 blur-3xl" />
        <div
          className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 animate-respirar rounded-full bg-orange-200/70 blur-3xl"
          style={{ animationDelay: '1.2s' }}
        />

        <div className="relative mx-auto h-36 w-36" style={{ transformStyle: 'preserve-3d' }}>
          <span className="absolute inset-0 animate-radar rounded-full bg-granate-300/70" />
          <div
            className="absolute inset-0 animate-girarCheck rounded-full bg-gradient-to-br from-granate-500 via-granate-600 to-granate-800 p-7 shadow-[0_26px_50px_-14px_rgba(123,30,43,0.8)] ring-4 ring-white/70"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <svg viewBox="0 0 48 48" className="h-full w-full">
              <path
                d="M12 25 l9 9 l15 -18"
                fill="none"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-trazarCheck"
                style={{ strokeDasharray: 40 }}
              />
            </svg>
          </div>
        </div>

        <h4 className="relative mt-8 text-4xl font-black uppercase tracking-tight text-granate-700">
          Respuestas entregadas
        </h4>
        <p className="relative mx-auto mt-3 max-w-md text-xl text-granate-800">
          El acta del <strong>salón {salon.numero}</strong> quedó registrada con{' '}
          <strong>{entregado.total}</strong> {entregado.total === 1 ? 'alumno' : 'alumnos'}.
        </p>

        {(entregado.ausentes > 0 || entregado.sinHora > 0) && (
          <p className="relative mt-3 text-base font-semibold text-granate-600">
            {entregado.ausentes > 0 && `${entregado.ausentes} sin presentarse`}
            {entregado.ausentes > 0 && entregado.sinHora > 0 && ' · '}
            {entregado.sinHora > 0 && `${entregado.sinHora} sin hora de entrega`}.
          </p>
        )}

        <p className="relative mt-6 text-base text-granate-700/80">
          Si se equivocó en algo, avise a la comisión: ellos anulan el envío y usted vuelve a
          subirla.
        </p>

        <div className="relative mt-7">
          <Boton onClick={alCerrar}>Listo</Boton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consulta de envíos y consolidado
// ---------------------------------------------------------------------------

/** Final · Consulta de envíos: el tablero de la mañana, salón por salón. */
export function FinalExamenEnvios() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/consolidado');
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Mirando qué salones entregaron" />;

  const { salones, resumen, porNivel } = datos;

  const anular = async (s) => {
    if (!window.confirm(`Se borra el acta del salón ${s.salon} de ${s.nivelTexto}.\n\n¿Seguro?`)) {
      return;
    }
    setProcesando(`anular-${s.id}`);
    try {
      await api.delete(`/final/examen/${s.nivel}/${s.salon}`);
      await cargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo anular'));
    } finally {
      setProcesando('');
    }
  };

  const bajar = async (s) => {
    setProcesando(s ? `excel-${s.id}` : 'excel');
    try {
      await descargar(
        s ? `/final/examen/${s.nivel}/${s.salon}/excel` : '/final/consolidado/excel',
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Consulta de envíos</h3>
        <p className="mt-2 text-xl text-slate-600">
          Qué salones ya entregaron su acta y cuáles faltan. Hasta que no estén todos, los puestos
          de la final todavía pueden moverse.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <Dato numero={resumen.entregados} texto={`de ${resumen.salones} salones`} />
          <Dato numero={resumen.recibidos} texto={`de ${resumen.esperados} respuestas`} />
          <Dato numero={resumen.ausentes} texto="sin presentarse" />
          <Dato
            numero={resumen.pendientes}
            texto="salones pendientes"
            alerta={resumen.pendientes > 0}
          />
        </div>

        {resumen.pendientes === 0 && resumen.salones > 0 && (
          <div className="mt-6">
            <Aviso tipo="exito" icono={CheckCircle2} compacto>
              Todos los salones entregaron. Los resultados de la final ya son definitivos.
            </Aviso>
          </div>
        )}

        <div className="mt-6">
          <Boton variante="excel" cargando={procesando === 'excel'} onClick={() => bajar()}>
            <Download className="h-6 w-6" />
            Consolidado
          </Boton>
        </div>
      </Tarjeta>

      {porNivel.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {porNivel.map((n) => (
            <Tarjeta key={n.nivel}>
              <Etiqueta compacto className={COLOR_NIVEL[n.nivel]}>
                {n.texto}
              </Etiqueta>
              <p className="mt-3 text-xl font-black text-slate-900">
                {n.entregados} de {n.salones} salones
              </p>
              <p className="text-base text-slate-600">
                {n.recibidos} de {n.esperados} respuestas
              </p>
            </Tarjeta>
          ))}
        </div>
      )}

      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      <Tarjeta>
        <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
          <Inbox className="h-6 w-6 text-granate-600" />
          Salón por salón
        </h4>

        <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
          <table className="w-full min-w-[54rem] text-left">
            <thead className="bg-slate-50">
              <tr className="text-base text-slate-500">
                <th className="px-4 py-3 text-center font-semibold">Salón</th>
                <th className="px-4 py-3 font-semibold">Turno</th>
                <th className="px-4 py-3 font-semibold">Responsable</th>
                <th className="px-4 py-3 text-center font-semibold">Recibidos</th>
                <th className="px-4 py-3 text-center font-semibold">Puntaje alto</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salones.map((s) => (
                <tr key={s.id} className={s.enviadoEn ? 'bg-emerald-50/40' : ''}>
                  <td className="px-4 py-3 text-center">
                    <span className="block text-xl font-black text-granate-700">{s.salon}</span>
                    <span className="block text-base text-slate-500">
                      {s.categorias.join(', ') || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Etiqueta compacto className={COLOR_NIVEL[s.nivel]}>
                      {s.nivelTexto}
                    </Etiqueta>
                  </td>
                  <td className="px-4 py-3 text-base text-slate-700">
                    {s.responsable || <span className="text-rose-600">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-base">
                    {s.recibidos} / {s.esperados}
                    {s.ausentes > 0 && (
                      <span className="block text-base text-amber-700">
                        {s.ausentes} ausente{s.ausentes > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-base font-bold text-granate-700">
                    {s.enviadoEn ? s.puntajeAlto : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Etiqueta
                      compacto
                      className={
                        s.enviadoEn
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }
                    >
                      {s.enviadoEn ? 'Entregado' : 'Pendiente'}
                    </Etiqueta>
                  </td>
                  <td className="px-4 py-3">
                    {s.enviadoEn && (
                      <div className="flex justify-end gap-2">
                        <Boton
                          variante="excelContorno"
                          tamano="chico"
                          cargando={procesando === `excel-${s.id}`}
                          onClick={() => bajar(s)}
                        >
                          <Download className="h-5 w-5" />
                        </Boton>
                        <Boton
                          variante="peligro"
                          tamano="chico"
                          cargando={procesando === `anular-${s.id}`}
                          onClick={() => anular(s)}
                        >
                          <Ban className="h-5 w-5" />
                        </Boton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}

function Dato({ numero, texto, alerta = false }) {
  return (
    <div
      className={`rounded-2xl border-2 p-5 ${
        alerta ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200'
      }`}
    >
      <p className="text-3xl font-black text-slate-900">{numero}</p>
      <p className="text-base text-slate-600">{texto}</p>
    </div>
  );
}
