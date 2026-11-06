import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Download,
  Inbox,
  ListChecks,
  Lock,
  LockOpen,
  Upload,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { COLOR_ALTERNATIVA } from './RespuestasExamen.jsx';
import { NIVEL } from './FinalSalones.jsx';
import { api, descargar, mensajeError } from '../lib/api';
import { GRADOS } from '../lib/datos';

const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E', 'BLANCO'];

/** La configuración del examen final, que es común a las tres pantallas. */
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
 * Una clave por categoría, igual que en la institucional. Lo que cambia es que
 * aquí la prueba puede traer otra cantidad de preguntas, así que eso se
 * declara primero: cambiarlo recorta o rellena las claves ya cargadas.
 */
export function FinalExamenClave() {
  const { config, setConfig, error: errorCarga } = useConfigFinal();
  const [categoria, setCategoria] = useState('E');
  const [clave, setClave] = useState([]);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState('');

  useEffect(() => {
    if (!config) return;
    const guardada = config.claves?.[categoria] || [];
    setClave(
      Array.from({ length: config.preguntas }, (_, i) => guardada[i] || 'BLANCO'),
    );
  }, [config, categoria]);

  if (errorCarga && !config) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {errorCarga}
      </Aviso>
    );
  }
  if (!config) return <Cargando texto="Cargando la clave de la final" />;

  const guardar = async () => {
    setError('');
    setAviso('');
    setGuardando('clave');
    try {
      const { data } = await api.post('/final/examen/clave', { categoria, respuestas: clave });
      setConfig(data);
      setAviso(`Clave de la CAT. ${categoria} guardada`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar la clave'));
    } finally {
      setGuardando('');
    }
  };

  const cambiarPreguntas = async (cantidad) => {
    setError('');
    setAviso('');
    setGuardando('preguntas');
    try {
      const { data } = await api.post('/final/examen/preguntas', { preguntas: cantidad });
      setConfig(data);
      setAviso(`La prueba quedó en ${data.preguntas} preguntas`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cambiar'));
    } finally {
      setGuardando('');
    }
  };

  const marcar = (i, valor) => setClave(clave.map((c, j) => (j === i ? valor : c)));
  const cargadas = Object.keys(config.claves || {}).length;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Respuestas correctas</h3>
        <p className="mt-2 text-xl text-slate-600">
          La clave de la final, una por categoría. Mientras falte la de una categoría, sus
          respuestas se reciben pero quedan sin puntaje.
        </p>
        <p className="mt-4 text-base text-slate-600">
          {cargadas} de {GRADOS.length} categorías con clave cargada.
        </p>
      </Tarjeta>

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Cuántas preguntas trae</h4>
        <p className="mt-2 text-base text-slate-600">
          Cambiarlo recorta o rellena las claves ya cargadas, así que conviene fijarlo antes de
          empezar a marcarlas.
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <Campo
            etiqueta="Preguntas"
            type="number"
            className="w-40"
            defaultValue={config.preguntas}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (n && n !== config.preguntas) cambiarPreguntas(n);
            }}
          />
          <p className="pb-4 text-base text-slate-500">
            Ahora: {config.preguntas} preguntas{guardando === 'preguntas' && ' · guardando…'}
          </p>
        </div>
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[18rem] flex-1">
            <Selector
              etiqueta="Categoría"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {GRADOS.map((g) => (
                <option key={g.categoria} value={g.categoria}>
                  CAT. {g.categoria} · {g.label}
                  {config.claves?.[g.categoria] ? ' ✓' : ''}
                </option>
              ))}
            </Selector>
          </div>
          <Boton cargando={guardando === 'clave'} onClick={guardar}>
            <ListChecks className="h-6 w-6" />
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
      setConfig(data);
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
      setConfig(data);
      setAviso(
        valor
          ? 'Abierto: los responsables ya pueden subir las respuestas de su salón.'
          : 'Cerrado: solo el administrador puede subir respuestas.',
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
          Lo que vale cada respuesta en la final. Se puede cambiar después de recibir los envíos:
          todo se vuelve a calcular con lo que esté puesto aquí.
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-xl font-black text-slate-900">Envío de respuestas</h4>
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
// Subir / probar el envío de un salón
// ---------------------------------------------------------------------------

/**
 * Final · Llenar por salón.
 *
 * El mismo flujo del tutor en la institucional —bajar, marcar, probar, subir—,
 * pero por aula y hecho por la comisión. Probar es obligatorio en la práctica:
 * una vez subido, el acta queda corregida.
 */
export function FinalExamenLlenar({ soloMios = false }) {
  const [salones, setSalones] = useState(null);
  const [numero, setNumero] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [revision, setRevision] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');
  const archivoRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get(soloMios ? '/final/mis-salones' : '/final/salones');
      const lista = data.salones || [];
      setSalones(lista);
      setNumero((actual) => actual || String(lista[0]?.numero || ''));
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
            ? 'Todavía no tiene ningún salón a su cargo. El administrador se los asigna desde Examen final · Salones.'
            : 'Todavía no se armó el reparto de salones.'}
        </Aviso>
      </Tarjeta>
    );
  }

  const salon = salones.find((s) => String(s.numero) === String(numero)) || salones[0];

  const limpiar = () => {
    setArchivo(null);
    setRevision(null);
    if (archivoRef.current) archivoRef.current.value = '';
  };

  const subir = async (evento) => {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    setError('');
    setEnviado(null);
    setArchivo(elegido);
    setProcesando('revisar');
    try {
      const formulario = new FormData();
      formulario.append('archivo', elegido);
      const { data } = await api.post(`/final/examen/${salon.numero}/revisar`, formulario);
      setRevision(data);
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
      const { data } = await api.post(`/final/examen/${salon.numero}/enviar`, formulario);
      setEnviado(data);
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
          Baje el acta de su salón, marque lo que respondió cada alumno y súbala. Antes de
          enviarla verá cómo quedó.
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-3">
          <div className="min-w-[20rem] flex-1">
            <Selector
              etiqueta="Salón"
              value={salon.numero}
              onChange={(e) => {
                setNumero(e.target.value);
                limpiar();
                setEnviado(null);
              }}
            >
              {salones.map((s) => (
                <option key={s.numero} value={s.numero}>
                  SALÓN {s.numero} · CAT. {s.categoria} · {s.grado} · {s.total} alumnos
                </option>
              ))}
            </Selector>
          </div>
          <Boton
            variante="excelContorno"
            onClick={() => descargar(`/final/examen/${salon.numero}/plantilla`)}
          >
            <Download className="h-6 w-6" />
            Bajar el acta
          </Boton>
        </div>

        <div className="mt-5 rounded-2xl border-2 border-slate-200 p-5">
          <p className="text-base font-black text-slate-900">
            SALÓN {salon.numero} · {NIVEL[salon.nivel] || ''} · CAT. {salon.categoria}
          </p>
          <p className="mt-1 text-base text-slate-600">
            {salon.grado} · {salon.total} {salon.total === 1 ? 'alumno' : 'alumnos'}
            {salon.horario && ` · ${salon.horario.inicio} a ${salon.horario.fin}`}
          </p>
        </div>

        <input
          ref={archivoRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={subir}
        />
        <div className="mt-6">
          <Boton
            variante="excel"
            cargando={procesando === 'revisar'}
            onClick={() => archivoRef.current?.click()}
          >
            <Upload className="h-6 w-6" />
            Subir el acta llena
          </Boton>
        </div>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      {enviado && (
        <Aviso tipo="exito" icono={CheckCircle2} titulo="Acta recibida">
          {enviado.total} respuestas guardadas
          {enviado.ausentes > 0 && ` · ${enviado.ausentes} sin presentarse`}.
        </Aviso>
      )}

      {revision && (
        <Tarjeta>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h4 className="text-xl font-black text-slate-900">Así quedó</h4>
              <p className="mt-1 text-base text-slate-600">
                {revision.filas.length} respuestas leídas
                {revision.ausentes.length > 0 && ` · ${revision.ausentes.length} sin presentarse`}
              </p>
            </div>
            {revision.errores.length === 0 && (
              <Boton variante="exito" cargando={procesando === 'enviar'} onClick={enviar}>
                <CheckCircle2 className="h-6 w-6" />
                Enviar el acta
              </Boton>
            )}
          </div>

          {revision.sinClave && (
            <div className="mt-5">
              <Aviso tipo="alerta" icono={AlertCircle} compacto>
                La CAT. {revision.categoria} todavía no tiene clave cargada: las respuestas se
                guardan, pero el puntaje sale en cero hasta que se cargue.
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

          {revision.ausentes.length > 0 && (
            <div className="mt-5">
              <Aviso tipo="info" icono={AlertCircle} compacto>
                Sin respuestas: {revision.ausentes.join(', ')}.
              </Aviso>
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                  <th className="px-4 py-3 text-center font-semibold">Aciertos</th>
                  <th className="px-4 py-3 text-center font-semibold">Errores</th>
                  <th className="px-4 py-3 text-center font-semibold">Blancos</th>
                  <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {revision.filas.map((f) => (
                  <tr key={f.dni}>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">{f.nombres}</span>
                      <span className="block text-base text-slate-500">{f.dni}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-base text-emerald-700">
                      {f.correctas}
                    </td>
                    <td className="px-4 py-3 text-center text-base text-slate-500">
                      {f.incorrectas}
                    </td>
                    <td className="px-4 py-3 text-center text-base text-slate-500">{f.blancos}</td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {f.puntaje}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
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

  const { salones, resumen, porCategoria } = datos;

  const anular = async (numero) => {
    if (!window.confirm(`Se borra el envío del salón ${numero}.\n\n¿Seguro?`)) return;
    setProcesando(`anular-${numero}`);
    try {
      await api.delete(`/final/examen/${numero}`);
      await cargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo anular'));
    } finally {
      setProcesando('');
    }
  };

  const bajar = async (numero) => {
    setProcesando(numero ? `excel-${numero}` : 'excel');
    try {
      await descargar(
        numero ? `/final/examen/${numero}/excel` : '/final/consolidado/excel',
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

      {porCategoria.length > 0 && (
        <Tarjeta>
          <h4 className="text-xl font-black text-slate-900">Por categoría</h4>
          <div className="mt-6 flex flex-wrap gap-3">
            {porCategoria.map((c) => (
              <div
                key={c.categoria}
                className={`rounded-2xl border-2 px-5 py-4 ${
                  c.completo ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'
                }`}
              >
                <p className="text-base font-black text-slate-900">CAT. {c.categoria}</p>
                <p className="text-base text-slate-600">{c.grado}</p>
                <p className="mt-1 text-base text-slate-600">
                  {c.recibidos} de {c.esperados} · {c.salones}{' '}
                  {c.salones === 1 ? 'salón' : 'salones'}
                </p>
              </div>
            ))}
          </div>
        </Tarjeta>
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
          <table className="w-full min-w-[52rem] text-left">
            <thead className="bg-slate-50">
              <tr className="text-base text-slate-500">
                <th className="px-4 py-3 text-center font-semibold">Salón</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Responsable</th>
                <th className="px-4 py-3 text-center font-semibold">Recibidos</th>
                <th className="px-4 py-3 text-center font-semibold">Puntaje alto</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salones.map((s) => (
                <tr key={s.salon} className={s.enviadoEn ? 'bg-emerald-50/40' : ''}>
                  <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                    {s.salon}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-base font-bold text-slate-900">
                      CAT. {s.categoria}
                    </span>
                    <span className="block text-base text-slate-500">{s.grado}</span>
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
                          cargando={procesando === `excel-${s.salon}`}
                          onClick={() => bajar(s.salon)}
                        >
                          <Download className="h-5 w-5" />
                        </Boton>
                        <Boton
                          variante="peligro"
                          tamano="chico"
                          cargando={procesando === `anular-${s.salon}`}
                          onClick={() => anular(s.salon)}
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
