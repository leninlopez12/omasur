import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Crown,
  Download,
  Eye,
  EyeOff,
  Medal,
  Search,
  TrendingDown,
  Trophy,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { NIVEL } from './FinalSalones.jsx';
import { api, descargar, mensajeError } from '../lib/api';

/** Oro, plata y bronce; del cuarto para abajo, todos iguales. */
const COLOR_PUESTO = {
  1: 'bg-amber-100 text-amber-900 ring-2 ring-amber-300',
  2: 'bg-slate-200 text-slate-800 ring-2 ring-slate-300',
  3: 'bg-orange-100 text-orange-900 ring-2 ring-orange-300',
};
const colorPuesto = (p) => COLOR_PUESTO[p] || 'bg-granate-50 text-granate-800';

function Puesto({ numero, empatado }) {
  return (
    <span
      className={`inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-base font-black ${colorPuesto(
        numero,
      )}`}
      title={empatado ? 'Comparte el puesto por empate' : undefined}
    >
      {numero}
      {empatado && <span className="text-[0.6rem] font-semibold leading-none">=</span>}
    </span>
  );
}

function Alumno({ r, conCategoria = false }) {
  return (
    <div className="flex items-center gap-4">
      <Puesto numero={r.puesto} empatado={r.empatado} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-slate-900">{r.nombres}</p>
        <p className="truncate text-base text-slate-500">
          {r.institucion}
          {conCategoria && ` · CAT. ${r.categoria}`}
          {` · salón ${r.salon}`}
        </p>
      </div>
      <span className="text-xl font-black text-granate-700">{r.puntaje}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

/**
 * Final · General.
 *
 * El tablero del día: cuántos rindieron, quién hizo el mejor puntaje de toda
 * la olimpiada y quién el más bajo, y cada categoría con su mejor y su peor.
 */
export function FinalResultadosGeneral() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/resultados');
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
  if (!datos) return <Cargando texto="Juntando los resultados de la final" />;

  const { categorias, resumen, mejor, peor } = datos;

  const bajar = async (solo) => {
    setProcesando(solo || 'todo');
    try {
      await descargar(`/final/resultados/excel${solo ? `?solo=${solo}` : ''}`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setProcesando('');
    }
  };

  if (resumen.rindieron === 0) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Resultados de la final</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay respuestas de la final. En cuanto los responsables suban las actas de
            sus salones, los puestos aparecen aquí.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Resultados de la final</h3>
        <p className="mt-2 text-xl text-slate-600">
          Cada categoría compite por su cuenta. Aquí no hay corte: la final no clasifica a nadie,
          premia.
        </p>

        {resumen.salonesPendientes > 0 && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto>
              Faltan {resumen.salonesPendientes}{' '}
              {resumen.salonesPendientes === 1 ? 'salón' : 'salones'} por entregar su acta. Los
              puestos todavía pueden moverse.
            </Aviso>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Cifra numero={resumen.rindieron} texto="rindieron la final" />
          <Cifra numero={resumen.categorias} texto="categorías" />
          <Cifra numero={resumen.delegaciones} texto="delegaciones" />
        </div>
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta fondo="bg-amber-50">
          <h4 className="flex items-center gap-3 text-xl font-black text-amber-900">
            <Crown className="h-7 w-7" />
            El mejor puntaje de la olimpiada
          </h4>
          {mejor && (
            <div className="mt-5">
              <p className="text-2xl font-black text-slate-900">{mejor.nombres}</p>
              <p className="mt-1 text-base text-slate-700">{mejor.institucion}</p>
              <p className="mt-1 text-base text-slate-700">
                CAT. {mejor.categoria} · {mejor.grado} · salón {mejor.salon}
              </p>
              <p className="mt-4 text-5xl font-black text-granate-700">{mejor.puntaje}</p>
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <h4 className="flex items-center gap-3 text-xl font-black text-slate-700">
            <TrendingDown className="h-7 w-7" />
            El puntaje más bajo
          </h4>
          {peor && (
            <div className="mt-5">
              <p className="text-2xl font-black text-slate-900">{peor.nombres}</p>
              <p className="mt-1 text-base text-slate-600">{peor.institucion}</p>
              <p className="mt-1 text-base text-slate-600">
                CAT. {peor.categoria} · {peor.grado} · salón {peor.salon}
              </p>
              <p className="mt-4 text-5xl font-black text-slate-400">{peor.puntaje}</p>
            </div>
          )}
        </Tarjeta>
      </div>

      {['SECUNDARIA', 'PRIMARIA'].map((nivel) => {
        const suyas = categorias.filter((c) => c.nivel === nivel);
        if (suyas.length === 0) return null;

        return (
          <Tarjeta key={nivel}>
            <h4 className="text-xl font-black text-slate-900">{NIVEL[nivel]}</h4>
            <div className="mt-6 space-y-4">
              {suyas.map((c) => (
                <div key={c.categoria} className="rounded-2xl border-2 border-slate-200 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-black text-slate-900">
                      CAT. {c.categoria} · {c.grado}
                    </p>
                    <p className="text-base text-slate-500">
                      {c.rindieron} rindieron · {c.delegaciones} delegaciones · promedio{' '}
                      {c.promedio}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-amber-50 p-4">
                      <p className="text-base font-semibold text-amber-900">Mejor</p>
                      <div className="mt-2">
                        <Alumno r={c.mejor} />
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-base font-semibold text-slate-600">Más bajo</p>
                      <div className="mt-2">
                        <Alumno r={c.peor} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Tarjeta>
        );
      })}

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Descargas</h4>
        <div className="mt-6 flex flex-wrap gap-3">
          <Boton variante="excel" cargando={procesando === 'todo'} onClick={() => bajar('')}>
            <Download className="h-6 w-6" />
            Cuadro completo
          </Boton>
          <Boton
            variante="excelContorno"
            cargando={procesando === 'premiados'}
            onClick={() => bajar('premiados')}
          >
            <Download className="h-6 w-6" />
            Solo la premiación
          </Boton>
        </div>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Los primeros puestos, categoría por categoría
// ---------------------------------------------------------------------------

/** Final · Los primeros de cada categoría, para mirarlas una por una. */
export function FinalResultadosTop() {
  const [datos, setDatos] = useState(null);
  const [puestos, setPuestos] = useState(10);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/resultados/top', { params: { puestos } });
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar'));
    }
  }, [puestos]);

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
  if (!datos) return <Cargando texto="Ordenando por categoría" />;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Los primeros de cada categoría</h3>
        <p className="mt-2 text-xl text-slate-600">
          Categoría por categoría, de mayor a menor puntaje. Dos con el mismo puntaje comparten el
          puesto y suben los dos.
        </p>

        <div className="mt-8 max-w-xs">
          <Selector
            etiqueta="Cuántos puestos ver"
            value={puestos}
            onChange={(e) => setPuestos(Number(e.target.value))}
          >
            {[3, 5, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                Los primeros {n}
              </option>
            ))}
          </Selector>
        </div>
      </Tarjeta>

      {datos.length === 0 && (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay respuestas de la final.
          </Aviso>
        </Tarjeta>
      )}

      {['SECUNDARIA', 'PRIMARIA'].map((nivel) => {
        const suyas = datos.filter((c) => c.nivel === nivel);
        if (suyas.length === 0) return null;

        return (
          <div key={nivel} className="space-y-5">
            <h4 className="px-1 text-xl font-black text-slate-900">{NIVEL[nivel]}</h4>
            {suyas.map((c) => (
              <Tarjeta key={c.categoria}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h5 className="flex items-center gap-3 text-xl font-black text-slate-900">
                    <Trophy className="h-6 w-6 text-granate-600" />
                    CAT. {c.categoria} · {c.grado}
                  </h5>
                  <p className="text-base text-slate-500">{c.rindieron} rindieron</p>
                </div>

                <div className="mt-6 space-y-2">
                  {c.alumnos.map((r) => (
                    <div
                      key={r.dni}
                      className={`rounded-2xl border-2 p-4 ${
                        r.puesto <= 3 ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'
                      }`}
                    >
                      <Alumno r={r} />
                    </div>
                  ))}
                </div>
              </Tarjeta>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Premiación
// ---------------------------------------------------------------------------

/**
 * Final · Premiación.
 *
 * Leída al revés, que es como se entrega: primero se llama a los décimos
 * puestos de todas las categorías, después a los novenos, y así hasta los
 * primeros. Cada bloque es una llamada al estrado.
 */
export function FinalPremiacion() {
  const [datos, setDatos] = useState(null);
  const [puestos, setPuestos] = useState(10);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/resultados/premiacion', { params: { puestos } });
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar'));
    }
  }, [puestos]);

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
  if (!datos) return <Cargando texto="Armando la premiación" />;

  const bajar = async () => {
    setBajando(true);
    try {
      await descargar('/final/resultados/excel?solo=premiados');
    } finally {
      setBajando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
              <Medal className="h-9 w-9 text-granate-600" />
              Premiación
            </h3>
            <p className="mt-2 text-xl text-slate-600">
              En el orden en que se llama al estrado: del último puesto al primero, y en cada
              puesto todas las categorías juntas.
            </p>
          </div>
          <Boton variante="excel" cargando={bajando} onClick={bajar}>
            <Download className="h-6 w-6" />
            Descargar
          </Boton>
        </div>

        <div className="mt-8 max-w-xs">
          <Selector
            etiqueta="Cuántos puestos se premian"
            value={puestos}
            onChange={(e) => setPuestos(Number(e.target.value))}
          >
            {[3, 5, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                Los primeros {n}
              </option>
            ))}
          </Selector>
        </div>
      </Tarjeta>

      {datos.puestos.length === 0 && (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay respuestas de la final.
          </Aviso>
        </Tarjeta>
      )}

      {datos.puestos.map((bloque) => (
        <Tarjeta
          key={bloque.puesto}
          fondo={bloque.puesto === 1 ? 'bg-amber-50' : 'bg-white'}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="flex items-center gap-3 text-2xl font-black text-slate-900">
              <Puesto numero={bloque.puesto} />
              {bloque.puesto === 1
                ? 'Primeros puestos'
                : bloque.puesto === 2
                  ? 'Segundos puestos'
                  : bloque.puesto === 3
                    ? 'Terceros puestos'
                    : `Puesto ${bloque.puesto}`}
            </h4>
            <p className="text-base text-slate-500">
              {bloque.alumnos.length}{' '}
              {bloque.alumnos.length === 1 ? 'premiado' : 'premiados'}
            </p>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {bloque.alumnos.map((r) => (
              <div
                key={`${r.categoria}-${r.dni}`}
                className="rounded-2xl border-2 border-slate-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-granate-600 text-base font-black text-white">
                    {r.categoria}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-slate-900">{r.nombres}</p>
                    <p className="truncate text-base text-slate-500">{r.institucion}</p>
                    <p className="truncate text-base text-slate-500">{r.grado}</p>
                  </div>
                  <span className="text-xl font-black text-granate-700">{r.puntaje}</span>
                </div>
                {r.empatado && (
                  <p className="mt-2 text-base text-amber-700">Comparte el puesto por empate.</p>
                )}
              </div>
            ))}
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publicación y consulta
// ---------------------------------------------------------------------------

/** Final · Abrir los resultados a los tutores y la consulta por DNI. */
export function FinalPublicacion() {
  const [datos, setDatos] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [premiados, setPremiados] = useState(10);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState('');

  const [publico, setPublico] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [{ data }, estado] = await Promise.all([
        api.get('/final/resultados'),
        // Lo mismo que ve la portada: dice si la consulta se está viendo de
        // verdad o si la institucional todavía la está tapando.
        api.get('/final/publico').then((r) => r.data),
      ]);
      setDatos(data);
      setPublico(estado);
      setTitulo(data.config.tituloPublico);
      setPremiados(data.config.puestos);
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
  if (!datos) return <Cargando texto="Cargando la publicación" />;

  const { config, resumen } = datos;

  const publicar = async (valor) => {
    if (
      valor &&
      resumen.salonesPendientes > 0 &&
      !window.confirm(
        `Faltan ${resumen.salonesPendientes} salones por entregar.\n\n¿Publicar igual?`,
      )
    ) {
      return;
    }

    setAviso('');
    setProcesando('publicar');
    try {
      const { data } = await api.post('/final/resultados/publicar', { publicado: valor });
      setDatos(data);
      setAviso(
        valor
          ? 'Publicado: cada tutor ya ve los puntajes de su delegación.'
          : 'Retirado: ningún tutor ve los resultados de la final.',
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo publicar'));
    } finally {
      setProcesando('');
    }
  };

  const guardarAjustes = async (cambios) => {
    setAviso('');
    setProcesando('ajustes');
    try {
      await api.post('/final/resultados/ajustes', cambios);
      await cargar();
      setAviso('Guardado');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Publicación y consulta</h3>
        <p className="mt-2 text-xl text-slate-600">
          Son dos cosas distintas: publicar abre los puntajes en la cuenta de cada tutor; la
          consulta por DNI los abre a cualquiera desde la portada.
        </p>
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-xl font-black text-slate-900">A los tutores</h4>
            <p className="mt-2 text-base text-slate-600">
              Cada delegación ve sus propios alumnos, con su puesto dentro de su categoría.
            </p>
          </div>
          <Etiqueta
            compacto
            className={
              config.publicado ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }
          >
            {config.publicado ? 'Publicado' : 'Sin publicar'}
          </Etiqueta>
        </div>

        <div className="mt-6">
          <Boton
            variante={config.publicado ? 'peligro' : 'exito'}
            cargando={procesando === 'publicar'}
            onClick={() => publicar(!config.publicado)}
          >
            {config.publicado ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
            {config.publicado ? 'Ocultar a los tutores' : 'Publicar a los tutores'}
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-xl font-black text-slate-900">Consulta pública por DNI</h4>
            <p className="mt-2 text-base text-slate-600">
              Cualquiera escribe el DNI del estudiante en la portada y ve en qué lugar quedó: entre
              los de su ámbito —privados o públicos— dentro de su categoría, que es como se premia.
              Es para todos los que rindieron la final, no solo para los premiados.
            </p>
          </div>
          <Etiqueta
            compacto
            className={
              publico?.activa
                ? 'bg-emerald-100 text-emerald-800'
                : config.consultaActiva
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
            }
          >
            {publico?.activa ? 'Abierta' : config.consultaActiva ? 'En espera' : 'Cerrada'}
          </Etiqueta>
        </div>

        {/* Dos consultas por DNI en la misma portada confunden a cualquiera,
            así que la de la final espera su turno. El interruptor de aquí ya
            quedó puesto: lo que falta es cerrar la otra. */}
        {publico?.esperando && (
          <div className="mt-5">
            <Aviso tipo="alerta" icono={AlertCircle} compacto titulo="Falta cerrar la institucional">
              La consulta de la etapa institucional sigue abierta y, mientras lo esté, el botón de
              la final no sale en la portada. Ciérrela en Clasificatoria institucional · Resultados
              · General y publicación y esta aparece sola.
            </Aviso>
          </div>
        )}

        {publico?.activa && (
          <div className="mt-5">
            <Aviso tipo="info" icono={CheckCircle2} compacto>
              El botón ya está en la portada y lleva a la página de la final.
            </Aviso>
          </div>
        )}

        <div className="mt-6 space-y-5">
          <Campo
            etiqueta="Título de la página pública"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <Campo
            etiqueta="Puestos que se premian"
            type="number"
            ayuda="Con cuántos puestos se marca a un alumno como premiado."
            className="max-w-xs"
            value={premiados}
            onChange={(e) => setPremiados(e.target.value)}
          />

          <div className="flex flex-wrap gap-3">
            <Boton
              cargando={procesando === 'ajustes'}
              onClick={() => guardarAjustes({ tituloPublico: titulo, puestos: Number(premiados) })}
            >
              Guardar
            </Boton>
            <Boton
              variante={config.consultaActiva ? 'peligro' : 'exito'}
              cargando={procesando === 'ajustes'}
              onClick={() => guardarAjustes({ consultaActiva: !config.consultaActiva })}
            >
              {config.consultaActiva ? 'Cerrar la consulta' : 'Abrir la consulta'}
            </Boton>
          </div>
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
// Consultar una delegación
// ---------------------------------------------------------------------------

/** Final · Consultar: para atender al tutor que llama. */
export function FinalConsultar() {
  const [texto, setTexto] = useState('');
  const [encontrado, setEncontrado] = useState(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);

  const buscar = async (evento) => {
    evento.preventDefault();
    setError('');
    setEncontrado(null);

    if (texto.trim().length < 2) {
      return setError('Escriba al menos dos letras, o el DNI del estudiante.');
    }

    setBuscando(true);
    try {
      const { data } = await api.get('/final/resultados/buscar', { params: { q: texto.trim() } });
      setEncontrado(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo buscar'));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Consultar la final</h3>
        <p className="mt-2 text-xl text-slate-600">
          Busque por institución, tutor, nombre o DNI y vea cómo le fue a esa delegación.
        </p>

        <form onSubmit={buscar} className="mt-8 flex flex-wrap items-end gap-3">
          <div className="min-w-[18rem] flex-1">
            <Campo
              etiqueta="Buscar"
              icono={Search}
              placeholder="Institución, tutor, nombre o DNI"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <Boton type="submit" cargando={buscando}>
            Buscar
          </Boton>
        </form>

        {error && (
          <div className="mt-6">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              {error}
            </Aviso>
          </div>
        )}
      </Tarjeta>

      {encontrado && encontrado.length === 0 && (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Nadie de la final coincide con «{texto}».
          </Aviso>
        </Tarjeta>
      )}

      {encontrado?.map((d) => (
        <Tarjeta key={d.tutorId}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h4 className="text-2xl font-black text-slate-900">{d.institucion}</h4>
              <p className="mt-1 text-base text-slate-600">
                {d.tutor}
                {d.celular && ` · ${d.celular}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-granate-700">{d.premiados}</p>
              <p className="text-base text-slate-600">
                {d.premiados === 1 ? 'premiado' : 'premiados'} de {d.rindieron}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {d.alumnos.map((r) => (
              <div
                key={`${r.categoria}-${r.dni}`}
                className={`rounded-2xl border-2 p-4 ${
                  r.premiado ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'
                }`}
              >
                <Alumno r={r} conCategoria />
              </div>
            ))}
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}

function Cifra({ numero, texto }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 p-5">
      <p className="text-3xl font-black text-slate-900">{numero}</p>
      <p className="text-base text-slate-600">{texto}</p>
    </div>
  );
}
