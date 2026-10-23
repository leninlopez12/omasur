import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Save, Trash2, Upload } from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { COLOR_ALTERNATIVA } from './RespuestasExamen.jsx';
import { Filtros, sinTildes } from './ExamenEntregas.jsx';
import { Confirmado } from './PasoPago.jsx';
import { api, descargar, mensajeError } from '../lib/api';

const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E', 'BLANCO'];

/**
 * Las delegaciones que rinden, con el estado de su envío.
 *
 * Sale de `/examen/consultas` y no de la lista de credenciales porque aquí
 * siempre hace falta saber quién ya envió: todas estas pantallas se ordenan
 * alrededor de ese dato.
 */
export function useDelegaciones() {
  const [delegaciones, setDelegaciones] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try {
      const { data } = await api.get('/examen/consultas');
      setDelegaciones(data.filas);
      setResumen(data.resumen);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar las delegaciones'));
      setDelegaciones([]);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { delegaciones, resumen, error, recargar };
}

/** El desplegable de delegaciones, con su estado a la vista. */
export function SelectorDelegacion({
  delegaciones,
  value,
  onChange,
  etiqueta = 'Delegación',
  soloEnviadas = false,
}) {
  const lista = soloEnviadas ? delegaciones.filter((d) => d.enviado) : delegaciones;

  return (
    <Selector etiqueta={etiqueta} value={value} onChange={(e) => onChange(e.target.value)}>
      {lista.map((d) => (
        <option key={d.tutorId} value={d.tutorId}>
          {d.institucion} · {d.alumnosAprobados} alumnos
          {d.enviado ? ` · enviado (${d.porComision ? 'comisión' : 'tutor'})` : ' · pendiente'}
        </option>
      ))}
    </Selector>
  );
}

/** El resultado de una corrección, tal como se verá guardado. */
export function Corregido({ resultado }) {
  return (
    <div className="mt-8 space-y-5">
      {resultado.sinClave.length > 0 && (
        <Aviso tipo="alerta" icono={AlertCircle} compacto>
          Sin respuestas correctas cargadas para: CAT. {resultado.sinClave.join(', CAT. ')}. El
          puntaje sale en cero.
        </Aviso>
      )}

      {resultado.errores.length > 0 ? (
        <Aviso tipo="error" icono={AlertCircle} titulo={`${resultado.errores.length} por corregir`}>
          <ul className="mt-2 space-y-1">
            {resultado.errores.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {resultado.errores.length > 8 && <li>…y {resultado.errores.length - 8} más.</li>}
          </ul>
        </Aviso>
      ) : (
        <Aviso tipo="exito" icono={CheckCircle2} compacto>
          {resultado.filas.length} estudiantes leídos, sin errores.
        </Aviso>
      )}

      {resultado.filas.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
          <table className="w-full min-w-[40rem] text-left">
            <thead className="bg-slate-50">
              <tr className="text-base text-slate-500">
                <th className="px-4 py-3 font-semibold">Estudiante</th>
                <th className="px-4 py-3 text-center font-semibold">Cat.</th>
                <th className="px-4 py-3 text-center font-semibold">Bien</th>
                <th className="px-4 py-3 text-center font-semibold">Mal</th>
                <th className="px-4 py-3 text-center font-semibold">Blanco</th>
                <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultado.filas.map((f) => (
                <tr key={f.dni}>
                  <td className="px-4 py-3 text-base text-slate-900">{f.nombres}</td>
                  <td className="px-4 py-3 text-center text-base">{f.categoria}</td>
                  <td className="px-4 py-3 text-center text-base text-emerald-700">{f.correctas}</td>
                  <td className="px-4 py-3 text-center text-base text-rose-700">{f.incorrectas}</td>
                  <td className="px-4 py-3 text-center text-base text-slate-500">{f.blancos}</td>
                  <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                    {f.puntaje}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Examen · Llenar por la delegación.
 *
 * El atajo para las delegaciones que no pueden subir el archivo ellas mismas.
 * Queda marcado como llenado por la comisión, y por eso el tutor deja de ver
 * el aviso de envío en su panel.
 */
export function ExamenLlenar() {
  const { delegaciones, error: errorLista, recargar } = useDelegaciones();
  const [tutorId, setTutorId] = useState('');
  const [buscar, setBuscar] = useState('');
  // Arranca en las que faltan: es la lista que de verdad hay que trabajar.
  const [estado, setEstado] = useState('pendientes');
  const [archivo, setArchivo] = useState(null);
  const [revision, setRevision] = useState(null);
  const [guardado, setGuardado] = useState(null);
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
  if (delegaciones.length === 0) return <SinDelegaciones titulo="Llenar por la delegación" />;

  if (guardado) {
    return (
      <Confirmado
        titulo="Respuestas registradas"
        detalle={`Se guardaron las alternativas de ${guardado.total} estudiantes de ${guardado.institucion}.`}
        textoBoton="Entendido"
        alSeguir={() => setGuardado(null)}
      />
    );
  }

  const delegacion = delegaciones.find((d) => d.tutorId === tutorId);

  const filtradas = delegaciones.filter((d) => {
    const texto = sinTildes(buscar);
    if (texto && !sinTildes(`${d.institucion} ${d.tutor}`).includes(texto)) return false;
    if (estado === 'pendientes' && d.enviado) return false;
    if (estado === 'enviadas' && !d.enviado) return false;
    return true;
  });

  const bajar = async (d) => {
    setProcesando('bajar-' + d.tutorId);
    try {
      await descargar(`/examen/plantilla/${d.tutorId}`, `respuestas-${d.institucion}.xlsx`);
    } finally {
      setProcesando('');
    }
  };

  const elegir = (d) => {
    setTutorId(d.tutorId);
    setArchivo(null);
    setRevision(null);
    setError('');
  };

  const subir = async (evento) => {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    setArchivo(elegido);
    setRevision(null);
    setError('');
    setProcesando('revisar');
    try {
      const formulario = new FormData();
      formulario.append('archivo', elegido);
      const { data } = await api.post(`/examen/revisar/${tutorId}`, formulario);
      setRevision(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo leer el archivo'));
      setArchivo(null);
    } finally {
      setProcesando('');
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  const guardar = async () => {
    const seguro = window.confirm(
      `Va a registrar las respuestas de ${revision.filas.length} estudiantes de ${delegacion.institucion}.\n\n` +
        'Quedará como llenado por la comisión. ¿Guardar?',
    );
    if (!seguro) return;

    setError('');
    setProcesando('guardar');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      const { data } = await api.post(`/examen/enviar/${tutorId}`, formulario);
      setGuardado({ total: data.total, institucion: delegacion.institucion });
      setArchivo(null);
      setRevision(null);
      setTutorId('');
      await recargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar las respuestas'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Llenar por la delegación</h3>
        <p className="mt-2 text-xl text-slate-600">
          Para los tutores que no pueden subir el archivo ellos mismos. Baje su Excel, márquelo y
          súbalo por ellos.
        </p>
      </Tarjeta>

      <Filtros buscar={buscar} alBuscar={setBuscar} placeholder="Institución o tutor">
        <Selector
          etiqueta="Estado"
          compacto
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Todas</option>
          <option value="pendientes">Faltan enviar</option>
          <option value="enviadas">Ya enviaron</option>
        </Selector>
      </Filtros>

      <Tarjeta>
        {filtradas.length === 0 ? (
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Nada que mostrar con estos filtros.
          </Aviso>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[48rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Institución educativa</th>
                  <th className="px-4 py-3 font-semibold">Tutor</th>
                  <th className="px-4 py-3 text-center font-semibold">Alumnos</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((d) => (
                  <tr key={d.tutorId} className={d.tutorId === tutorId ? 'bg-granate-50' : ''}>
                    <td className="px-4 py-3">
                      <span className="block text-base font-semibold text-slate-900">
                        {d.institucion}
                      </span>
                      <span className="block text-base text-slate-500">{d.provincia}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-base text-slate-700">{d.tutor}</span>
                      <span className="block text-base text-slate-500">{d.celular}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-base">{d.alumnosAprobados}</td>
                    <td className="px-4 py-3 text-base">
                      {d.enviado ? (
                        <>
                          <Etiqueta compacto className="bg-emerald-100 text-emerald-800">
                            {d.porComision ? 'Comisión' : 'Tutor'}
                          </Etiqueta>
                          {d.porComision && d.registradoPor && (
                            <span className="mt-1 block text-base text-slate-500">
                              {d.registradoPor}
                            </span>
                          )}
                        </>
                      ) : (
                        <Etiqueta compacto className="bg-amber-100 text-amber-800">
                          Falta
                        </Etiqueta>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Boton
                          variante="excelContorno"
                          tamano="chico"
                          cargando={procesando === 'bajar-' + d.tutorId}
                          onClick={() => bajar(d)}
                        >
                          <Download className="h-5 w-5" />
                          Excel
                        </Boton>
                        <Boton tamano="chico" onClick={() => elegir(d)}>
                          <Upload className="h-5 w-5" />
                          Llenar
                        </Boton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {delegacion && (
        <Tarjeta>
          <h4 className="text-xl font-black text-slate-900">{delegacion.institucion}</h4>
          <p className="mt-1 text-base text-slate-600">
            {delegacion.tutor} · {delegacion.alumnosAprobados} alumnos
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Boton
              variante="excel"
              cargando={procesando === 'bajar-' + delegacion.tutorId}
              onClick={() => bajar(delegacion)}
            >
              <Download className="h-5 w-5" />
              Bajar su Excel
            </Boton>
            <Boton
              variante="contorno"
              cargando={procesando === 'revisar'}
              onClick={() => archivoRef.current?.click()}
            >
              <Upload className="h-5 w-5" />
              {archivo ? archivo.name : 'Subir el Excel llenado'}
            </Boton>
            <input
              ref={archivoRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={subir}
            />
          </div>

          {delegacion.enviado && (
            <div className="mt-6">
              <Aviso tipo="alerta" icono={AlertCircle} compacto>
                Esta delegación ya envió el{' '}
                {new Date(delegacion.enviadoEn).toLocaleString('es-PE', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                . Si guarda otra vez, se reemplaza lo anterior.
              </Aviso>
            </div>
          )}

          {error && (
            <div className="mt-6">
              <Aviso tipo="error" icono={AlertCircle}>
                {error}
              </Aviso>
            </div>
          )}

          {revision && (
            <>
              <Corregido resultado={revision} />
              <div className="mt-8 flex justify-end">
                <Boton
                  tamano="grande"
                  cargando={procesando === 'guardar'}
                  disabled={revision.errores.length > 0 || revision.filas.length === 0}
                  onClick={guardar}
                >
                  <Save className="h-7 w-7" />
                  Guardar por la delegación
                </Boton>
              </div>
            </>
          )}
        </Tarjeta>
      )}
    </div>
  );
}

/**
 * Examen · Anular envío.
 *
 * Borra lo que mandó una delegación para que pueda volver a enviarlo. Es la
 * única salida cuando el tutor subió el archivo equivocado.
 */
export function ExamenAnular() {
  const { delegaciones, error: errorLista, recargar } = useDelegaciones();
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [anulando, setAnulando] = useState('');

  if (errorLista) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {errorLista}
      </Aviso>
    );
  }
  if (!delegaciones) return <Cargando texto="Cargando envíos" />;

  const enviadas = delegaciones.filter((d) => d.enviado);

  const anular = async (delegacion) => {
    const seguro = window.confirm(
      `Se borrarán las respuestas de ${delegacion.institucion} (${delegacion.respondidos} estudiantes).\n\n` +
        'La delegación podrá volver a enviarlas. ¿Anular?',
    );
    if (!seguro) return;

    setError('');
    setMensaje('');
    setAnulando(delegacion.tutorId);
    try {
      await api.delete(`/examen/entregas/${delegacion.tutorId}`);
      setMensaje(`Se anuló el envío de ${delegacion.institucion}.`);
      await recargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo anular el envío'));
    } finally {
      setAnulando('');
    }
  };

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Anular envío</h3>
      <p className="mt-2 text-xl text-slate-600">
        Al anular, la delegación vuelve a ver su pantalla de carga y puede enviar de nuevo.
      </p>

      {error && (
        <div className="mt-6">
          <Aviso tipo="error" icono={AlertCircle}>
            {error}
          </Aviso>
        </div>
      )}
      {mensaje && (
        <div className="mt-6">
          <Aviso tipo="exito" icono={CheckCircle2}>
            {mensaje}
          </Aviso>
        </div>
      )}

      {enviadas.length === 0 ? (
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay envíos que anular.
          </Aviso>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {enviadas.map((d) => (
            <div
              key={d.tutorId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 p-5"
            >
              <div>
                <p className="text-xl font-black text-slate-900">{d.institucion}</p>
                <p className="mt-1 text-base text-slate-600">
                  {d.respondidos} estudiantes ·{' '}
                  {new Date(d.enviadoEn).toLocaleString('es-PE', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}{' '}
                  · llenado por {d.porComision ? 'la comisión' : 'el tutor'}
                </p>
              </div>
              <Boton
                variante="peligro"
                cargando={anulando === d.tutorId}
                onClick={() => anular(d)}
              >
                <Trash2 className="h-5 w-5" />
                Anular envío
              </Boton>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

/**
 * Examen · Corregir respuestas.
 *
 * Se entra a una delegación, se elige al estudiante y se cambian las
 * alternativas una por una. El puntaje se vuelve a calcular al guardar.
 */
export function ExamenCorregir() {
  const { delegaciones, error: errorLista } = useDelegaciones();
  const [tutorId, setTutorId] = useState('');
  const [entrega, setEntrega] = useState(null);
  const [dni, setDni] = useState('');
  const [respuestas, setRespuestas] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviadas = (delegaciones || []).filter((d) => d.enviado);
  const elegida = tutorId || enviadas[0]?.tutorId || '';

  useEffect(() => {
    if (!elegida) return;
    setEntrega(null);
    setDni('');
    setRespuestas(null);
    api
      .get(`/examen/entregas/${elegida}`)
      .then(({ data }) => setEntrega(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar el envío')));
  }, [elegida]);

  if (errorLista) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {errorLista}
      </Aviso>
    );
  }
  if (!delegaciones) return <Cargando texto="Cargando envíos" />;

  if (enviadas.length === 0) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Corregir respuestas</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay envíos que corregir.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  const alumno = entrega?.filas?.find((f) => f.dni === dni);

  const abrir = (fila) => {
    setDni(fila.dni);
    setRespuestas([...fila.respuestas]);
    setMensaje('');
    setError('');
  };

  const marcar = (indice, valor) => {
    const nuevas = [...respuestas];
    nuevas[indice] = valor;
    setRespuestas(nuevas);
  };

  const guardar = async () => {
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      const { data } = await api.patch(`/examen/entregas/${elegida}/${dni}`, { respuestas });
      setEntrega({
        ...entrega,
        filas: entrega.filas.map((f) => (f.dni === dni ? data : f)),
      });
      setMensaje(`${data.nombres}: ${data.correctas} bien, ${data.incorrectas} mal, ${data.puntaje} puntos.`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar la corrección'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Corregir respuestas</h3>
        <p className="mt-2 text-xl text-slate-600">
          Entre a la delegación, elija al estudiante y cambie sus alternativas.
        </p>

        <div className="mt-8 max-w-xl">
          <SelectorDelegacion
            delegaciones={enviadas}
            value={elegida}
            onChange={(id) => {
              setTutorId(id);
              setMensaje('');
            }}
          />
        </div>
      </Tarjeta>

      {!entrega ? (
        <Cargando texto="Cargando la delegación" />
      ) : (
        <Tarjeta>
          <h4 className="text-xl font-black text-slate-900">{entrega.institucion}</h4>

          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[34rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                  <th className="px-4 py-3 text-center font-semibold">Cat.</th>
                  <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entrega.filas.map((f) => (
                  <tr key={f.dni} className={f.dni === dni ? 'bg-granate-50' : ''}>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">{f.nombres}</span>
                      <span className="block text-base text-slate-500">{f.dni}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-base">{f.categoria}</td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {f.puntaje}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Boton variante="contorno" tamano="chico" onClick={() => abrir(f)}>
                        Corregir
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {alumno && respuestas && (
        <Tarjeta>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-xl font-black text-slate-900">{alumno.nombres}</h4>
              <p className="mt-1 text-base text-slate-600">
                DNI {alumno.dni} · CAT. {alumno.categoria}
              </p>
            </div>
            <Etiqueta className="bg-granate-50 text-granate-700">{alumno.puntaje} puntos</Etiqueta>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {respuestas.map((valor, i) => (
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

          {error && (
            <div className="mt-6">
              <Aviso tipo="error" icono={AlertCircle}>
                {error}
              </Aviso>
            </div>
          )}
          {mensaje && (
            <div className="mt-6">
              <Aviso tipo="exito" icono={CheckCircle2}>
                {mensaje}
              </Aviso>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Boton cargando={guardando} onClick={guardar}>
              <Save className="h-6 w-6" />
              Guardar corrección
            </Boton>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

function SinDelegaciones({ titulo }) {
  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">{titulo}</h3>
      <div className="mt-6">
        <Aviso tipo="info" icono={AlertCircle} compacto>
          Todavía no hay delegaciones aprobadas con estudiantes.
        </Aviso>
      </div>
    </Tarjeta>
  );
}
