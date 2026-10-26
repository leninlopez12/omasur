import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Layers,
  Scale,
  Trash2,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { Filtros, sinTildes } from './ExamenEntregas.jsx';
import { api, descargar, mensajeError } from '../lib/api';

const ETIQUETA = {
  CLASIFICA: 'Clasifica',
  NO_CLASIFICA: 'No clasifica',
  EN_EVALUACION: 'En evaluación',
  EMPATE: 'Empate',
};

/** Rojo para lo que falta mirar, ámbar para lo que hay que desempatar. */
const COLOR = {
  CLASIFICA: 'bg-emerald-100 text-emerald-800',
  NO_CLASIFICA: 'bg-slate-100 text-slate-600',
  EN_EVALUACION: 'bg-rose-100 text-rose-800',
  EMPATE: 'bg-amber-100 text-amber-800',
};

const TANDAS = {
  tutores: {
    titulo: 'Delegaciones que enviaron sus respuestas',
    detalle: 'Las que subió el propio tutor. Se trabajan y se publican primero.',
  },
  comision: {
    titulo: 'Delegaciones que llenó la comisión',
    detalle: 'Las que subió el equipo por ellas. Van después, ya revisadas.',
  },
};

const PASOS = [
  { id: 'clasificacion', texto: 'Clasificación' },
  { id: 'individuales', texto: 'Individuales' },
  { id: 'empates', texto: 'Empates' },
  { id: 'revisar', texto: 'Revisar' },
  { id: 'publicar', texto: 'Publicar' },
];

/** La tabla de una tanda. */
function useResultados(ola) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try {
      const { data } = await api.get('/resultados', { params: { ola } });
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron calcular los resultados'));
    }
  }, [ola]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, setDatos, error, recargar };
}

function Cifras({ resumen }) {
  const datos = [
    { valor: resumen.estudiantes, texto: 'Estudiantes con puntaje' },
    { valor: resumen.clasifican, texto: 'Clasifican' },
    { valor: resumen.empates, texto: 'Empates por resolver' },
    { valor: resumen.enEvaluacion, texto: 'En evaluación' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {datos.map((d) => (
        <div key={d.texto} className="rounded-3xl bg-white p-6 shadow-suave">
          <p className="text-4xl font-black text-granate-700">{d.valor}</p>
          <p className="mt-1 text-base text-slate-600">{d.texto}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Resultados de una tanda, con sus cinco pasos.
 *
 * Cada tanda es un módulo cerrado: se clasifica, se resuelven los solos y los
 * empates, se revisa el consolidado y recién entonces se publica. Lo que
 * entra en una no mueve el corte de la otra, porque los pozos se arman con
 * los estudiantes de esa tanda nada más.
 */
export function ModuloResultados({ ola }) {
  const [paso, setPaso] = useState('clasificacion');
  const { datos, setDatos, error, recargar } = useResultados(ola);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Calculando los resultados" />;

  const tanda = TANDAS[ola];
  const pendientes = datos.resumen.pendientes;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">{tanda.titulo}</h3>
        <p className="mt-2 text-xl text-slate-600">{tanda.detalle}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {PASOS.map((p) => {
            const pendiente =
              (p.id === 'empates' && datos.resumen.empates > 0) ||
              (p.id === 'individuales' && datos.resumen.enEvaluacion > 0);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaso(p.id)}
                className={`rounded-xl px-4 py-2 text-base font-bold transition ${
                  paso === p.id
                    ? 'bg-granate-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.texto}
                {pendiente && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-sm ${
                      paso === p.id ? 'bg-white/25' : 'bg-amber-200 text-amber-900'
                    }`}
                  >
                    {p.id === 'empates' ? datos.resumen.empates : datos.resumen.enEvaluacion}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Tarjeta>

      {datos.resumen.estudiantes === 0 ? (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay respuestas en esta tanda.
          </Aviso>
        </Tarjeta>
      ) : (
        <>
          {paso === 'clasificacion' && (
            <Clasificacion ola={ola} datos={datos} setDatos={setDatos} recargar={recargar} />
          )}
          {paso === 'individuales' && <Individuales ola={ola} tabla={datos} alCambiar={recargar} />}
          {paso === 'empates' && <Empates ola={ola} alCambiar={recargar} />}
          {paso === 'revisar' && <Revisar ola={ola} resumen={datos.resumen} />}
          {paso === 'publicar' && (
            <Publicar ola={ola} resumen={datos.resumen} pendientes={pendientes} alCambiar={recargar} />
          )}
        </>
      )}
    </div>
  );
}

/** Los tres botones con que se fuerza o se devuelve una decisión. */
function Decision({ alumno, alDecidir, guardando }) {
  const botones = [
    { valor: 'CLASIFICA', texto: 'Clasifica' },
    { valor: 'NO_CLASIFICA', texto: 'No' },
    { valor: null, texto: 'Automático' },
  ];

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {botones.map((b) => {
        const activo =
          b.valor === null ? !alumno.manual : alumno.manual && alumno.estado === b.valor;
        return (
          <button
            key={b.texto}
            type="button"
            disabled={guardando}
            onClick={() => alDecidir(alumno.clave, b.valor)}
            className={`rounded-lg px-2.5 py-1 text-sm font-bold transition disabled:opacity-50 ${
              activo ? 'bg-granate-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {b.texto}
          </button>
        );
      })}
    </div>
  );
}

function Clasificacion({ ola, datos, setDatos, recargar }) {
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const decidir = async (clave, valor) => {
    setAviso('');
    setGuardando(true);
    try {
      const { data } = await api.post(
        '/resultados/decidir',
        { clave, estado: valor },
        { params: { ola } },
      );
      setDatos(data);
    } catch (e) {
      setAviso(mensajeError(e, 'No se pudo guardar la decisión'));
    } finally {
      setGuardando(false);
    }
  };

  const grupos = useMemo(() => {
    const texto = sinTildes(buscar);
    return datos.grupos.filter((g) => {
      if (texto && !sinTildes(`${g.grupoNombre} ${g.tutor}`).includes(texto)) return false;
      if (filtro === 'pendientes' && g.pendientes === 0) return false;
      if (filtro && filtro !== 'pendientes' && g.categoria !== filtro) return false;
      return true;
    });
  }, [datos, buscar, filtro]);

  const categorias = [...new Set(datos.grupos.map((g) => g.categoria))].sort();

  return (
    <div className="space-y-6">
      <Cifras resumen={datos.resumen} />

      {datos.resumen.pendientes > 0 && (
        <Aviso
          tipo="alerta"
          icono={AlertCircle}
          titulo={`${datos.resumen.pendientes} por resolver antes de publicar`}
        >
          Los empates y los que están solos en su categoría necesitan una decisión suya.
        </Aviso>
      )}

      {aviso && (
        <Aviso tipo="error" icono={AlertCircle}>
          {aviso}
        </Aviso>
      )}

      <Filtros buscar={buscar} alBuscar={setBuscar} placeholder="Institución o tutor">
        <Selector etiqueta="Ver" compacto value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todo</option>
          <option value="pendientes">Solo lo pendiente</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              CAT. {c}
            </option>
          ))}
        </Selector>

        <div className="flex items-end">
          <Boton variante="contorno" onClick={recargar}>
            Recalcular
          </Boton>
        </div>
      </Filtros>

      {grupos.length === 0 ? (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Nada que mostrar con estos filtros.
          </Aviso>
        </Tarjeta>
      ) : (
        grupos.map((g) => (
          <Tarjeta key={g.llave}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="text-2xl font-black text-slate-900">{g.grupoNombre}</h4>
                <p className="mt-1 text-base text-slate-600">
                  CAT. {g.categoria} · {g.grado} · {g.tutor}
                </p>
              </div>
              <Etiqueta compacto className="bg-granate-50 text-granate-700">
                {g.clasifican} de {g.total} · {g.cupos} {g.cupos === 1 ? 'cupo' : 'cupos'}
              </Etiqueta>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
              <table className="w-full min-w-[42rem] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-base text-slate-500">
                    <th className="px-4 py-3 text-center font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Estudiante</th>
                    <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {g.alumnos.map((a) => (
                    <tr key={a.clave} className={a.puesto <= g.cupos ? 'bg-emerald-50/40' : ''}>
                      <td className="px-4 py-3 text-center text-base font-black text-slate-500">
                        {a.puesto}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-base font-bold text-slate-900">{a.nombres}</span>
                        <span className="block text-base text-slate-500">
                          {a.dni}
                          {a.agrupado && ' · agrupado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                        {a.puntaje}
                      </td>
                      <td className="px-4 py-3">
                        <Etiqueta compacto className={COLOR[a.estado]}>
                          {ETIQUETA[a.estado]}
                        </Etiqueta>
                      </td>
                      <td className="px-4 py-3">
                        <Decision alumno={a} alDecidir={decidir} guardando={guardando} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        ))
      )}
    </div>
  );
}

/**
 * Los que su tutor inscribió solos en su categoría.
 *
 * A uno solo no se le puede aplicar un porcentaje: queda en evaluación hasta
 * que alguien decida, o hasta que se le junte con una delegación o con otros
 * individuales para que compitan entre ellos.
 */
function Individuales({ ola, tabla, alCambiar }) {
  const [solos, setSolos] = useState(null);
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [anfitriona, setAnfitriona] = useState('');
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/resultados/individuales', { params: { ola } });
      setSolos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar los individuales'));
    }
  }, [ola]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!solos) return <Cargando texto="Buscando estudiantes solos" />;

  // Los miembros se guardan como «tutorId:dni»; el nombre sale de la tabla.
  const nombrePorClave = new Map(
    tabla.grupos.flatMap((g) => g.alumnos.map((a) => [a.clave, a.nombres])),
  );

  const delegaciones = [...new Map(tabla.grupos.map((g) => [g.grupoId, g.grupoNombre])).entries()]
    .filter(([id]) => !id.startsWith('grupo:'))
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));

  // Solo los grupos que tienen a alguien de esta tanda, o los recién creados.
  const grupos = tabla.agrupaciones;

  const hacer = async (accion) => {
    setError('');
    setProcesando(true);
    try {
      await accion();
      await Promise.all([cargar(), alCambiar()]);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo completar la acción'));
    } finally {
      setProcesando(false);
    }
  };

  const crear = (delegacionId) =>
    hacer(async () => {
      await api.post('/resultados/agrupaciones', {
        nombre: delegacionId
          ? delegaciones.find(([id]) => id === delegacionId)?.[1] || 'Agrupación'
          : nombre,
        delegacionId: delegacionId || null,
      });
      setNombre('');
      setAnfitriona('');
    });

  const mover = (grupo, clave) =>
    hacer(() =>
      api.patch(
        `/resultados/agrupaciones/${grupo.id}`,
        { miembros: [...grupo.miembros, clave] },
        { params: { ola } },
      ),
    );

  const sacar = (grupo, clave) =>
    hacer(() =>
      api.patch(
        `/resultados/agrupaciones/${grupo.id}`,
        { miembros: grupo.miembros.filter((m) => m !== clave) },
        { params: { ola } },
      ),
    );

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h4 className="text-2xl font-black text-slate-900">Estudiantes individuales</h4>
        <p className="mt-2 text-xl text-slate-600">
          Son los únicos de su categoría en su delegación. Júntelos con una delegación de esta
          misma tanda que tenga esa categoría, o agrúpelos entre ellos, y el porcentaje se calcula
          solo.
        </p>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      )}

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Crear un grupo</h4>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border-2 border-slate-200 p-5">
            <p className="text-base font-bold text-slate-700">Juntarlos con una delegación</p>
            <Selector
              etiqueta="Delegación"
              compacto
              value={anfitriona}
              onChange={(e) => setAnfitriona(e.target.value)}
            >
              <option value="">Elija una</option>
              {delegaciones.map(([id, texto]) => (
                <option key={id} value={id}>
                  {texto}
                </option>
              ))}
            </Selector>
            <Boton disabled={!anfitriona} cargando={procesando} onClick={() => crear(anfitriona)}>
              <Layers className="h-6 w-6" />
              Crear
            </Boton>
          </div>

          <div className="space-y-4 rounded-2xl border-2 border-slate-200 p-5">
            <p className="text-base font-bold text-slate-700">
              Agruparlos entre ellos (rindieron juntos)
            </p>
            <Campo
              etiqueta="Nombre del grupo"
              compacto
              placeholder="Individuales Juliaca"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Boton disabled={!nombre.trim()} cargando={procesando} onClick={() => crear(null)}>
              <Layers className="h-6 w-6" />
              Crear
            </Boton>
          </div>
        </div>
      </Tarjeta>

      {grupos.length > 0 && (
        <Tarjeta>
          <h4 className="text-xl font-black text-slate-900">Grupos armados</h4>
          <div className="mt-6 space-y-4">
            {grupos.map((g) => (
              <div key={g.id} className="rounded-2xl border-2 border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-slate-900">{g.nombre}</p>
                    <p className="mt-1 text-base text-slate-600">
                      {g.delegacionId ? 'Se suman a esa delegación' : 'Compiten entre ellos'} ·{' '}
                      {g.miembros.length} {g.miembros.length === 1 ? 'estudiante' : 'estudiantes'}
                    </p>
                  </div>
                  <Boton
                    variante="contorno"
                    tamano="chico"
                    cargando={procesando}
                    onClick={() =>
                      hacer(() =>
                        api.delete(`/resultados/agrupaciones/${g.id}`, { params: { ola } }),
                      )
                    }
                  >
                    <Trash2 className="h-5 w-5" />
                    Deshacer
                  </Boton>
                </div>

                {g.miembros.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {g.miembros.map((m) => (
                      <li
                        key={m}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2"
                      >
                        <span className="text-base text-slate-700">
                          {nombrePorClave.get(m) || m.split(':')[1]}
                        </span>
                        <button
                          type="button"
                          disabled={procesando}
                          onClick={() => sacar(g, m)}
                          className="text-base font-bold text-rose-600 hover:underline disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Tarjeta>
      )}

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">
          {solos.length} {solos.length === 1 ? 'estudiante solo' : 'estudiantes solos'}
        </h4>

        {solos.length === 0 ? (
          <div className="mt-6">
            <Aviso tipo="exito" icono={CheckCircle2} compacto>
              No queda nadie solo en su categoría.
            </Aviso>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {solos.map((a) => (
              <div
                key={a.clave}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-5"
              >
                <div>
                  <p className="text-xl font-black text-slate-900">{a.nombres}</p>
                  <p className="mt-1 text-base text-slate-600">
                    {a.institucion} · CAT. {a.categoria} · {a.puntaje} puntos
                  </p>
                </div>

                {grupos.length === 0 ? (
                  <Etiqueta compacto className={COLOR.EN_EVALUACION}>
                    En evaluación
                  </Etiqueta>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {grupos.map((g) => (
                      <Boton
                        key={g.id}
                        variante="contorno"
                        tamano="chico"
                        cargando={procesando}
                        onClick={() => mover(g, a.clave)}
                      >
                        A «{g.nombre}»
                      </Boton>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

/** Dos puntajes iguales por el último cupo: lo decide la comisión. */
function Empates({ ola, alCambiar }) {
  const [empates, setEmpates] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/resultados/empates', { params: { ola } });
      setEmpates(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar los empates'));
    }
  }, [ola]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!empates) return <Cargando texto="Buscando empates" />;

  const decidir = async (clave, estado) => {
    setProcesando(true);
    try {
      await api.post('/resultados/decidir', { clave, estado }, { params: { ola } });
      await Promise.all([cargar(), alCambiar()]);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar la decisión'));
    } finally {
      setProcesando(false);
    }
  };

  const pozos = [...new Set(empates.map((e) => `${e.grupoId}|${e.categoria}`))];

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h4 className="text-2xl font-black text-slate-900">Empates</h4>
        <p className="mt-2 text-xl text-slate-600">
          Mismo puntaje por el último cupo. Elija quién pasa; a los demás márquelos como no
          clasificados.
        </p>
      </Tarjeta>

      {empates.length === 0 ? (
        <Tarjeta>
          <Aviso tipo="exito" icono={CheckCircle2} compacto>
            No hay empates por resolver.
          </Aviso>
        </Tarjeta>
      ) : (
        pozos.map((llave) => {
          const grupo = empates.filter((e) => `${e.grupoId}|${e.categoria}` === llave);
          const primero = grupo[0];

          return (
            <Tarjeta key={llave}>
              <div className="flex flex-wrap items-center gap-3">
                <Scale className="h-7 w-7 text-amber-600" />
                <div>
                  <h4 className="text-2xl font-black text-slate-900">{primero.grupoNombre}</h4>
                  <p className="text-base text-slate-600">
                    CAT. {primero.categoria} · {grupo.length} empatados con {primero.puntaje} puntos
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {grupo.map((a) => (
                  <div
                    key={a.clave}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-5"
                  >
                    <div>
                      <p className="text-xl font-black text-slate-900">{a.nombres}</p>
                      <p className="mt-1 text-base text-slate-600">
                        DNI {a.dni} · puesto {a.puesto}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Boton
                        variante="exito"
                        tamano="chico"
                        cargando={procesando}
                        onClick={() => decidir(a.clave, 'CLASIFICA')}
                      >
                        <Award className="h-5 w-5" />
                        Que pase
                      </Boton>
                      <Boton
                        variante="contorno"
                        tamano="chico"
                        cargando={procesando}
                        onClick={() => decidir(a.clave, 'NO_CLASIFICA')}
                      >
                        No pasa
                      </Boton>
                    </div>
                  </div>
                ))}
              </div>
            </Tarjeta>
          );
        })
      )}
    </div>
  );
}

/** El consolidado de la tanda, antes de dar el visto bueno. */
function Revisar({ ola, resumen }) {
  const [bajando, setBajando] = useState('');

  const bajar = async (solo) => {
    setBajando(solo || 'todo');
    try {
      await descargar(`/resultados/excel?ola=${ola}${solo ? `&solo=${solo}` : ''}`);
    } finally {
      setBajando('');
    }
  };

  return (
    <div className="space-y-6">
      <Cifras resumen={resumen} />

      {resumen.pendientes > 0 ? (
        <Aviso tipo="alerta" icono={AlertCircle} titulo={`Faltan ${resumen.pendientes} por resolver`}>
          Resuelva los empates y los estudiantes en evaluación antes de publicar: hasta entonces no
          cuentan como clasificados.
        </Aviso>
      ) : (
        <Aviso tipo="exito" icono={CheckCircle2}>
          No queda nada pendiente: {resumen.clasifican} clasificados en {resumen.delegaciones}{' '}
          delegaciones.
        </Aviso>
      )}

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Descargas de esta tanda</h4>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border-2 border-slate-200 p-5">
            <p className="text-xl font-black text-slate-900">Consolidado completo</p>
            <p className="mt-2 text-base text-slate-600">
              Todos, con su puesto, su puntaje y su estado. Una hoja por categoría.
            </p>
            <div className="mt-5">
              <Boton variante="excel" cargando={bajando === 'todo'} onClick={() => bajar('')}>
                <Download className="h-6 w-6" />
                Descargar
              </Boton>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-slate-200 p-5">
            <p className="text-xl font-black text-slate-900">Solo los clasificados</p>
            <p className="mt-2 text-base text-slate-600">
              Con su institución y su tutor, numerados por puntaje dentro de cada categoría.
            </p>
            <div className="mt-5">
              <Boton
                variante="excel"
                cargando={bajando === 'clasificados'}
                onClick={() => bajar('clasificados')}
              >
                <Download className="h-6 w-6" />
                Descargar
              </Boton>
            </div>
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}

/** El interruptor de la tanda. */
function Publicar({ ola, resumen, pendientes, alCambiar }) {
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState(false);
  const publicado = resumen.publicado[ola];
  const cuando = resumen.publicadoEn[ola];

  const publicar = async (valor) => {
    if (
      valor &&
      pendientes > 0 &&
      !window.confirm(
        `Todavía hay ${pendientes} casos sin resolver y no saldrán como clasificados.\n\n¿Publicar igual?`,
      )
    ) {
      return;
    }

    setAviso('');
    setProcesando(true);
    try {
      await api.post('/resultados/publicar', { ola, publicado: valor });
      await alCambiar();
      setAviso(valor ? 'Publicado: ya se ve en la portada.' : 'Retirado de la portada.');
    } catch (e) {
      setAviso(mensajeError(e, 'No se pudo cambiar la publicación'));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-6">
      {pendientes > 0 && (
        <Aviso tipo="alerta" icono={AlertCircle} titulo="Hay casos sin resolver">
          {pendientes} estudiantes siguen en empate o en evaluación. Si publica ahora, no
          aparecerán como clasificados.
        </Aviso>
      )}

      {aviso && (
        <Aviso tipo="info" icono={CheckCircle2}>
          {aviso}
        </Aviso>
      )}

      <Tarjeta>
        <div className="flex items-start gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              publicado ? 'bg-emerald-50' : 'bg-slate-100'
            }`}
          >
            {publicado ? (
              <Eye className="h-7 w-7 text-emerald-700" />
            ) : (
              <EyeOff className="h-7 w-7 text-slate-500" />
            )}
          </span>
          <div>
            <h4 className="text-xl font-black text-slate-900">{TANDAS[ola].titulo}</h4>
            <p className="mt-1 text-base text-slate-600">
              {resumen.clasifican} clasificados de {resumen.estudiantes} estudiantes.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Aviso tipo={publicado ? 'exito' : 'info'} compacto>
            {publicado
              ? `Publicado el ${new Date(cuando).toLocaleString('es-PE', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}`
              : 'Todavía no se publica'}
          </Aviso>
        </div>

        <div className="mt-6">
          <Boton
            variante={publicado ? 'peligro' : 'exito'}
            cargando={procesando}
            onClick={() => publicar(!publicado)}
          >
            {publicado ? 'Retirar de la portada' : 'Publicar esta tanda'}
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

/**
 * Resultados · General.
 *
 * El junte de las dos tandas: lo que sale publicado al final es esto, y de
 * aquí salen el consolidado y la lista de clasificados de todo el concurso.
 */
export function ResultadosGeneral() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/resultados/general');
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar el general'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Juntando las dos tandas" />;

  const { tutores, comision, total } = datos;
  const ambas = tutores.publicado.tutores && tutores.publicado.comision;

  const bajar = async (solo) => {
    setProcesando(solo || 'todo');
    try {
      await descargar(`/resultados/excel${solo ? `?solo=${solo}` : ''}`);
    } finally {
      setProcesando('');
    }
  };

  const publicarTodo = async (valor) => {
    if (
      valor &&
      total.pendientes > 0 &&
      !window.confirm(
        `Entre las dos tandas quedan ${total.pendientes} casos sin resolver.\n\n¿Publicar igual?`,
      )
    ) {
      return;
    }

    setAviso('');
    setProcesando('publicar');
    try {
      const { data } = await api.post('/resultados/publicar/general', { publicado: valor });
      setDatos(data);
      setAviso(valor ? 'Publicado todo en la portada.' : 'Retirado todo de la portada.');
    } catch (e) {
      setAviso(mensajeError(e, 'No se pudo publicar'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">General y publicación</h3>
        <p className="mt-2 text-xl text-slate-600">
          Las dos tandas juntas. Revise el consolidado completo y publique todo cuando esté
          conforme.
        </p>
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { datos: tutores, ola: 'tutores' },
          { datos: comision, ola: 'comision' },
        ].map(({ datos: d, ola }) => (
          <Tarjeta key={ola}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xl font-black text-slate-900">{TANDAS[ola].titulo}</h4>
                <p className="mt-2 text-base text-slate-600">
                  {d.clasifican} clasificados de {d.estudiantes} · {d.delegaciones} delegaciones
                </p>
              </div>
              {d.publicado[ola] ? (
                <Etiqueta compacto className="bg-emerald-100 text-emerald-800">
                  Publicada
                </Etiqueta>
              ) : (
                <Etiqueta compacto className="bg-slate-100 text-slate-600">
                  Sin publicar
                </Etiqueta>
              )}
            </div>

            {d.pendientes > 0 && (
              <div className="mt-4">
                <Aviso tipo="alerta" icono={AlertCircle} compacto>
                  {d.pendientes} sin resolver en esta tanda.
                </Aviso>
              </div>
            )}
          </Tarjeta>
        ))}
      </div>

      <Cifras resumen={total} />

      {datos.categorias.length > 0 && (
        <Tarjeta>
          <h4 className="text-xl font-black text-slate-900">Clasificados por categoría</h4>
          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[28rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-center font-semibold">Clasifican</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datos.categorias.map((c) => (
                  <tr key={c.categoria}>
                    <td className="px-4 py-3 text-base font-semibold text-slate-900">
                      CAT. {c.categoria} · {c.grado}
                    </td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {c.clasifican}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Descargas de todo</h4>
        <div className="mt-6 flex flex-wrap gap-3">
          <Boton variante="excel" cargando={procesando === 'todo'} onClick={() => bajar('')}>
            <Download className="h-6 w-6" />
            Consolidado completo
          </Boton>
          <Boton
            variante="excelContorno"
            cargando={procesando === 'clasificados'}
            onClick={() => bajar('clasificados')}
          >
            <Download className="h-6 w-6" />
            Solo los clasificados
          </Boton>
        </div>
      </Tarjeta>

      {aviso && (
        <Aviso tipo="info" icono={CheckCircle2}>
          {aviso}
        </Aviso>
      )}

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Publicación general</h4>
        <p className="mt-2 text-base text-slate-600">
          Enciende o apaga las dos tandas a la vez. Es el paso final, cuando ya revisó todo.
        </p>

        <div className="mt-6">
          <Boton
            variante={ambas ? 'peligro' : 'exito'}
            cargando={procesando === 'publicar'}
            onClick={() => publicarTodo(!ambas)}
          >
            {ambas ? 'Retirar todo de la portada' : 'Publicar los resultados generales'}
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}


/**
 * Resultados · Supervisor a cargo.
 *
 * La sección no es de todo el equipo: el administrador entra siempre y de los
 * supervisores solo entran los que él marque aquí. A los demás no se les
 * muestra ni en el sidebar, y el servidor también se los niega.
 */
export function EncargadosResultados() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState('');

  useEffect(() => {
    api
      .get('/resultados/encargados')
      .then(({ data }) => setLista(data))
      .catch((e) => setError(mensajeError(e, 'No se pudieron cargar los supervisores')));
  }, []);

  if (error && !lista) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!lista) return <Cargando texto="Cargando supervisores" />;

  const cambiar = async (supervisor, aCargo) => {
    setError('');
    setMensaje('');
    setProcesando(supervisor.id);
    try {
      const { data } = await api.post('/resultados/encargados', { id: supervisor.id, aCargo });
      setLista(data);
      setMensaje(
        aCargo
          ? `${supervisor.nombre} ya puede trabajar los resultados.`
          : `${supervisor.nombre} ya no tiene acceso a los resultados.`,
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cambiar el encargado'));
    } finally {
      setProcesando('');
    }
  };

  const aCargo = lista.filter((s) => s.aCargo).length;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Supervisor a cargo</h3>
        <p className="mt-2 text-xl text-slate-600">
          Marque quién puede entrar a Resultados. Los demás supervisores no la verán siquiera.
        </p>
      </Tarjeta>

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

      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-xl font-black text-slate-900">
            {lista.length} {lista.length === 1 ? 'supervisor' : 'supervisores'}
          </h4>
          <Etiqueta compacto className="bg-granate-50 text-granate-700">
            {aCargo} con acceso
          </Etiqueta>
        </div>

        {lista.length === 0 ? (
          <div className="mt-6">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              Todavía no hay supervisores. Créelos en Ajustes · Supervisores.
            </Aviso>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {lista.map((s) => (
              <div
                key={s.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 p-5 ${
                  s.aCargo ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'
                }`}
              >
                <div>
                  <p className="text-xl font-black text-slate-900">{s.nombre}</p>
                  <p className="mt-1 text-base text-slate-600">{s.correo}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Etiqueta
                    compacto
                    className={
                      s.aCargo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }
                  >
                    {s.aCargo ? 'A cargo' : 'Sin acceso'}
                  </Etiqueta>
                  <Boton
                    variante={s.aCargo ? 'contorno' : 'exito'}
                    tamano="chico"
                    cargando={procesando === s.id}
                    onClick={() => cambiar(s, !s.aCargo)}
                  >
                    {s.aCargo ? 'Quitar acceso' : 'Poner a cargo'}
                  </Boton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

/**
 * Resultados · Cómo se publica.
 *
 * El título que se lee en la portada, si la lista se ordena por categoría o
 * por delegación, y si la consulta por DNI está encendida. La consulta va
 * aparte a propósito: se puede mostrar la lista sin abrir los puntajes.
 */
export function AjustesPublicacion() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .get('/resultados/publicos')
      .then(({ data }) =>
        setConfig({
          tituloPublico: data.titulo,
          agrupadoPor: data.agrupadoPor,
          consultaActiva: data.consultaActiva,
        }),
      )
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar la configuración')));
  }, []);

  if (error && !config) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!config) return <Cargando texto="Cargando la configuración" />;

  const guardar = async (cambios, texto) => {
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      const { data } = await api.post('/resultados/ajustes', cambios);
      setConfig({
        tituloPublico: data.tituloPublico,
        agrupadoPor: data.agrupadoPor,
        consultaActiva: data.consultaActiva,
      });
      setMensaje(texto);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Cómo se publica</h3>
        <p className="mt-2 text-xl text-slate-600">
          Lo que se lee en la portada y la forma en que se ordena la lista.
        </p>
      </Tarjeta>

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

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Título de la portada</h4>
        <p className="mt-2 text-base text-slate-600">
          Es lo único que se lee encima de la lista. Puede incluir la fecha.
        </p>

        <div className="mt-6 max-w-2xl">
          <Campo
            etiqueta="Título"
            value={config.tituloPublico}
            onChange={(e) => setConfig({ ...config, tituloPublico: e.target.value })}
            placeholder="RESULTADOS PRIMERA ETAPA INSTITUCIONAL 22 DE OCTUBRE"
          />
        </div>

        <div className="mt-6">
          <Boton
            cargando={guardando}
            onClick={() => guardar({ tituloPublico: config.tituloPublico }, 'Título guardado')}
          >
            Guardar título
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Cómo se agrupa la lista</h4>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              valor: 'categoria',
              titulo: 'Por categoría',
              detalle: 'Un bloque por CAT. A, B, C… y dentro el nombre y su institución.',
            },
            {
              valor: 'delegacion',
              titulo: 'Por delegación',
              detalle: 'Un bloque por institución y dentro sus clasificados con su categoría.',
            },
          ].map((o) => (
            <button
              key={o.valor}
              type="button"
              disabled={guardando}
              onClick={() => guardar({ agrupadoPor: o.valor }, `Se publicará ${o.titulo.toLowerCase()}`)}
              className={`rounded-2xl border-2 p-5 text-left transition disabled:opacity-50 ${
                config.agrupadoPor === o.valor
                  ? 'border-granate-600 bg-granate-50'
                  : 'border-slate-200 hover:border-granate-300'
              }`}
            >
              <p className="text-xl font-black text-slate-900">{o.titulo}</p>
              <p className="mt-2 text-base text-slate-600">{o.detalle}</p>
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h4 className="text-xl font-black text-slate-900">Consulta de puntaje por DNI</h4>
            <p className="mt-2 text-base text-slate-600">
              Va aparte de la lista: puede publicar los clasificados sin abrir todavía los
              puntajes de cada estudiante.
            </p>
          </div>
          <Boton
            variante={config.consultaActiva ? 'peligro' : 'exito'}
            cargando={guardando}
            onClick={() =>
              guardar(
                { consultaActiva: !config.consultaActiva },
                config.consultaActiva ? 'Consulta cerrada' : 'Consulta habilitada',
              )
            }
          >
            {config.consultaActiva ? 'Cerrar la consulta' : 'Habilitar la consulta'}
          </Boton>
        </div>

        <div className="mt-6">
          <Aviso tipo={config.consultaActiva ? 'exito' : 'info'} compacto>
            {config.consultaActiva
              ? 'Cualquiera puede consultar su puntaje con su DNI.'
              : 'La consulta no aparece en la portada.'}
          </Aviso>
        </div>
      </Tarjeta>
    </div>
  );
}
