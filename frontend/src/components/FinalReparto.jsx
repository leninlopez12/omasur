import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  DoorOpen,
  Lock,
  Plus,
  Search,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { COLOR_NIVEL, NIVEL, NIVELES } from './FinalSalones.jsx';
import { api, mensajeError } from '../lib/api';

const sinTildes = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Final · Reparto de alumnos.
 *
 * El reparto automático acomoda a todos de una vez y casi siempre está bien.
 * Lo que no puede saber es que a dos hermanos conviene separarlos, que un aula
 * tiene una silla rota o que alguien llegó tarde a clasificar.
 *
 * Se trabaja de a un salón: arriba los salones del turno como fichas, con su
 * número y cuántos llevan, y abajo solo el que se eligió. Con cincuenta aulas
 * una lista corrida no se puede leer.
 *
 * Dentro del turno se mueve a quien sea a donde sea, aunque el aula lleve otra
 * categoría: cada examen se corrige con la clave del alumno. De turno no se le
 * cambia, porque el turno decide a qué hora rinde.
 */
export default function FinalReparto() {
  const [datos, setDatos] = useState(null);
  const [nivel, setNivel] = useState('SECUNDARIA');
  const [elegido, setElegido] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/salones');
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar el reparto'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const salones = datos?.salones || [];
  const delTurno = useMemo(() => salones.filter((s) => s.nivel === nivel), [salones, nivel]);

  // El salón elegido se sigue por su id: si se recarga el reparto, la ficha
  // sigue siendo la misma aunque el objeto sea otro.
  const salon = delTurno.find((s) => s.id === elegido) || delTurno[0] || null;

  const termino = sinTildes(busqueda);
  const encontrados = useMemo(() => {
    if (termino.length < 2) return [];
    return salones
      .flatMap((s) => s.alumnos.map((a) => ({ ...a, salon: s })))
      .filter((a) => sinTildes(`${a.nombres} ${a.dni} ${a.institucion}`).includes(termino))
      .slice(0, 40);
  }, [salones, termino]);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando el reparto" />;

  const { resumen, config } = datos;

  /** Toda acción es la misma: pide, guarda y vuelve con el reparto entero. */
  const accion = async (clave, peticion, mensaje) => {
    setError('');
    setAviso('');
    setProcesando(clave);
    try {
      const { data } = await peticion();
      setDatos(data);
      if (mensaje) setAviso(mensaje);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar el cambio'));
    } finally {
      setProcesando('');
    }
  };

  const mover = (alumno, destino) =>
    accion(
      `mover-${alumno.dni}`,
      () =>
        api.post('/final/salones/mover', {
          dni: alumno.dni,
          nivel: destino.nivel,
          salon: destino.numero,
        }),
      `${alumno.nombres} pasó al salón ${destino.numero}.`,
    );

  const sacar = (alumno) =>
    accion(
      `sacar-${alumno.dni}`,
      () => api.post('/final/salones/sacar', { dni: alumno.dni }),
      `${alumno.nombres} quedó sin salón.`,
    );

  const abrir = () =>
    accion('nuevo', () => api.post('/final/salones/nuevo', { nivel }), 'Salón abierto.');

  const cerrar = (s) => {
    if (!window.confirm(`¿Cerrar el salón ${s.numero} de ${NIVEL[s.nivel].toLowerCase()}?`)) return;
    return accion(
      `borrar-${s.id}`,
      () => api.delete(`/final/salones/${s.nivel}/${s.numero}`),
      `Salón ${s.numero} cerrado.`,
    );
  };

  if (salones.length === 0) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Reparto de alumnos</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay reparto que acomodar. Ármelo primero en Examen final · Salones y
            horarios.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Reparto de alumnos</h3>
        <p className="mt-2 text-xl text-slate-600">
          Elija un turno, después un salón, y acomode a su gente. Cada cambio se guarda al
          instante; cuando termine, baje las listas definitivas en Lista de salones.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <Dato numero={resumen.salones} texto="salones" />
          <Dato numero={resumen.repartidos} texto="sentados" />
          <Dato
            numero={resumen.excedidos}
            texto={`sobre los ${config.capacidad}`}
            alerta={resumen.excedidos > 0}
          />
          <Dato
            numero={resumen.sinSalon.length}
            texto="sin salón"
            alerta={resumen.sinSalon.length > 0}
          />
        </div>

        <div className="mt-6 max-w-lg">
          <Campo
            etiqueta="Buscar un alumno en todo el reparto"
            icono={Search}
            placeholder="Nombre, DNI o institución"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </Tarjeta>

      {aviso && (
        <Aviso tipo="info" icono={CheckCircle2} compacto>
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      {/* ----------------------------------------------- el buscador manda */}
      {termino.length >= 2 && (
        <Tarjeta>
          <h4 className="text-xl font-black text-slate-900">
            {encontrados.length === 0
              ? `Nadie coincide con «${busqueda}»`
              : `${encontrados.length} ${encontrados.length === 1 ? 'coincidencia' : 'coincidencias'}`}
          </h4>

          <div className="mt-5 space-y-3">
            {encontrados.map((a) => (
              <div
                key={a.dni}
                className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-slate-200 p-4"
              >
                <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-granate-600 text-white">
                  <span className="text-lg font-black leading-none">{a.salon.numero}</span>
                  <span className="text-[0.6rem]">{NIVEL[a.salon.nivel].slice(0, 3)}.</span>
                </span>
                <div className="min-w-[12rem] flex-1">
                  <p className="text-base font-bold text-slate-900">{a.nombres}</p>
                  <p className="text-base text-slate-500">
                    {a.dni} · CAT. {a.categoria} · {a.institucion}
                  </p>
                </div>
                <Boton
                  variante="suave"
                  tamano="chico"
                  onClick={() => {
                    setNivel(a.salon.nivel);
                    setElegido(a.salon.id);
                    setBusqueda('');
                  }}
                >
                  Ir a su salón
                </Boton>
                {!a.salon.conActa && (
                  <MoverA
                    alumno={a}
                    actual={a.salon}
                    salones={salones.filter((s) => s.nivel === a.salon.nivel)}
                    cargando={procesando === `mover-${a.dni}`}
                    alMover={mover}
                  />
                )}
              </div>
            ))}
          </div>
        </Tarjeta>
      )}

      {/* ---------------------------------------------------- sin salón */}
      {resumen.sinSalon.length > 0 && (
        <Tarjeta fondo="bg-amber-50">
          <h4 className="flex items-center gap-3 text-xl font-black text-amber-900">
            <AlertCircle className="h-6 w-6" />
            Sin salón ({resumen.sinSalon.length})
          </h4>
          <p className="mt-2 text-base text-amber-900">
            Clasificaron pero no están sentados. Siéntelos antes de bajar las listas.
          </p>

          <div className="mt-5 space-y-3">
            {resumen.sinSalon.map((a) => {
              const posibles = salones.filter((s) => s.nivel === a.nivel && !s.conActa);
              return (
                <div
                  key={a.dni}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-amber-200 bg-white p-4"
                >
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-base font-bold text-slate-900">{a.nombres}</p>
                    <p className="text-base text-slate-500">
                      {a.dni} · CAT. {a.categoria} · {NIVEL[a.nivel]}
                    </p>
                  </div>
                  {posibles.length === 0 ? (
                    <p className="text-base text-amber-900">
                      No hay salón libre en su turno: abra uno.
                    </p>
                  ) : (
                    <MoverA
                      alumno={a}
                      salones={posibles}
                      texto="Sentar en…"
                      cargando={procesando === `mover-${a.dni}`}
                      alMover={mover}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Tarjeta>
      )}

      {/* ---------------------------------------------- el turno y sus aulas */}
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {NIVELES.map((n) => {
              const cuantos = salones.filter((s) => s.nivel === n);
              const activo = n === nivel;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setNivel(n);
                    setElegido(null);
                  }}
                  className={`rounded-2xl border-2 px-5 py-3 text-left transition ${
                    activo
                      ? 'border-granate-600 bg-granate-50'
                      : 'border-slate-200 hover:border-granate-300'
                  }`}
                >
                  <span className="block text-base font-black text-slate-900">{NIVEL[n]}</span>
                  <span className="block text-base text-slate-500">
                    {cuantos.length} {cuantos.length === 1 ? 'salón' : 'salones'} ·{' '}
                    {cuantos.reduce((t, s) => t + s.total, 0)} alumnos
                  </span>
                </button>
              );
            })}
          </div>

          <Boton variante="contorno" tamano="chico" cargando={procesando === 'nuevo'} onClick={abrir}>
            <Plus className="h-5 w-5" />
            Abrir un salón de {NIVEL[nivel].toLowerCase()}
          </Boton>
        </div>

        {delTurno.length === 0 ? (
          <div className="mt-6">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              Este turno no tiene salones todavía.
            </Aviso>
          </div>
        ) : (
          <>
            <p className="mt-6 text-base text-slate-600">
              {delTurno[0].horario.inicio} a {delTurno[0].horario.fin} · elija un salón:
            </p>

            {/* Las fichas: el número y cuántos lleva, de un vistazo. */}
            <div className="mt-4 flex flex-wrap gap-2">
              {delTurno.map((s) => {
                const activo = salon?.id === s.id;
                const color = s.conActa
                  ? 'border-emerald-300 bg-emerald-50'
                  : s.excedido
                    ? 'border-amber-300 bg-amber-50'
                    : s.total === 0
                      ? 'border-dashed border-slate-300 bg-white'
                      : 'border-slate-200 bg-white';

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setElegido(s.id)}
                    className={`w-24 rounded-2xl border-2 px-2 py-3 text-center transition hover:-translate-y-0.5 ${
                      activo ? 'border-granate-600 bg-granate-50 shadow-suave' : color
                    }`}
                  >
                    <span className="block text-xl font-black text-slate-900">{s.numero}</span>
                    <span
                      className={`block text-base ${
                        s.excedido ? 'font-bold text-amber-700' : 'text-slate-500'
                      }`}
                    >
                      {s.total}/{config.capacidad}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {s.categorias.join(' ') || '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Tarjeta>

      {/* ------------------------------------------------- el salón elegido */}
      {salon && (
        <Tarjeta>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-granate-600 text-white">
                <span className="text-2xl font-black leading-none">{salon.numero}</span>
                <span className="text-base">salón</span>
              </span>
              <div>
                <p className="text-xl font-black text-slate-900">
                  {salon.total} de {config.capacidad} · {NIVEL[salon.nivel]}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-base text-slate-600">
                  <Etiqueta compacto className={COLOR_NIVEL[salon.nivel]}>
                    {salon.horario.inicio} a {salon.horario.fin}
                  </Etiqueta>
                  {salon.categorias.map((c) => (
                    <Etiqueta key={c} compacto className="bg-granate-50 text-granate-700">
                      CAT. {c}
                    </Etiqueta>
                  ))}
                </p>
                {salon.responsable && (
                  <p className="mt-2 text-base text-slate-600">
                    Responsable: {salon.responsable.nombre}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {salon.conActa && (
                <Etiqueta compacto className="bg-emerald-100 text-emerald-800">
                  <Lock className="mr-1 inline h-4 w-4" />
                  Entregado
                </Etiqueta>
              )}
              {salon.excedido && !salon.conActa && (
                <Etiqueta compacto className="bg-amber-100 text-amber-800">
                  Sobre el cupo
                </Etiqueta>
              )}
              {salon.total === 0 && !salon.conActa && (
                <Boton
                  variante="peligro"
                  tamano="chico"
                  cargando={procesando === `borrar-${salon.id}`}
                  onClick={() => cerrar(salon)}
                >
                  <Trash2 className="h-5 w-5" />
                  Cerrar salón
                </Boton>
              )}
            </div>
          </div>

          {salon.conActa && (
            <div className="mt-5">
              <Aviso tipo="exito" icono={Lock} compacto>
                Este salón ya subió su acta. Para mover a alguien, anule ese envío en Consulta de
                envíos.
              </Aviso>
            </div>
          )}

          {salon.mezclado && !salon.conActa && (
            <div className="mt-5">
              <Aviso tipo="info" icono={AlertCircle} compacto>
                Este salón lleva {salon.categorias.length} categorías. No hay problema: cada
                alumno se corrige con la clave de la suya, y el acta trae su columna de categoría.
              </Aviso>
            </div>
          )}

          {salon.total === 0 ? (
            <p className="mt-6 rounded-2xl bg-slate-50 py-10 text-center text-xl text-slate-500">
              Salón vacío. Mueva gente aquí desde otro salón, o ciérrelo.
            </p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border-2 border-slate-200">
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-3">
                <Users className="h-5 w-5 text-slate-400" />
                <span className="text-base font-semibold text-slate-500">
                  En el orden de la lista que se imprime
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {salon.alumnos.map((a, i) => (
                  <li key={a.dni} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-8 shrink-0 text-center text-base font-black text-slate-400">
                      {i + 1}
                    </span>
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-base font-bold text-slate-900">{a.nombres}</p>
                      <p className="text-base text-slate-500">
                        {a.dni} · CAT. {a.categoria} · {a.institucion}
                      </p>
                    </div>

                    {!salon.conActa && (
                      <div className="flex items-center gap-2">
                        <MoverA
                          alumno={a}
                          actual={salon}
                          salones={delTurno}
                          cargando={procesando === `mover-${a.dni}`}
                          alMover={mover}
                        />
                        <button
                          type="button"
                          onClick={() => sacar(a)}
                          disabled={procesando === `sacar-${a.dni}`}
                          title="Sacarlo del salón sin ponerlo en otro"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        >
                          <UserMinus className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Tarjeta>
      )}

      <Tarjeta>
        <p className="flex items-start gap-3 text-base text-slate-600">
          <DoorOpen className="h-6 w-6 shrink-0 text-granate-600" />
          Dentro de un turno puede mover a quien sea al salón que sea, aunque lleve otra
          categoría. Lo único que no se cambia es el turno: de él sale la hora a la que entra, y
          esa hora ya está impresa en su credencial.
        </p>
      </Tarjeta>
    </div>
  );
}

/** El selector de destino, que es el mismo en los tres sitios donde aparece. */
function MoverA({ alumno, actual, salones, cargando, alMover, texto = 'Mover a…' }) {
  const destinos = salones.filter((s) => s.id !== actual?.id && !s.conActa);
  if (destinos.length === 0) return null;

  return (
    <span className="flex items-center gap-2">
      <ArrowRightLeft className="h-5 w-5 shrink-0 text-slate-400" />
      <select
        value=""
        disabled={cargando}
        onChange={(e) => {
          const destino = destinos.find((s) => s.id === e.target.value);
          if (destino) alMover(alumno, destino);
        }}
        className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1.5 text-base text-slate-700 outline-none focus:border-granate-600 disabled:opacity-50"
      >
        <option value="">{texto}</option>
        {destinos.map((s) => (
          <option key={s.id} value={s.id}>
            Salón {s.numero} ({s.total})
          </option>
        ))}
      </select>
    </span>
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
