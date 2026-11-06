import { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { NIVEL } from './FinalSalones.jsx';
import { api, mensajeError } from '../lib/api';
import { GRADOS } from '../lib/datos';

const sinTildes = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Final · Reparto de alumnos.
 *
 * El reparto automático acomoda a todos de una vez, y casi siempre está bien.
 * Lo que no puede saber es que a dos hermanos conviene separarlos, que un aula
 * tiene una silla rota o que alguien llegó tarde a clasificar. Esto es para
 * eso: mover a uno de salón, abrir un aula más o cerrar la que sobra, sin
 * rehacer todo el reparto.
 *
 * Dos cosas quedan fijas aquí a propósito. Un alumno solo se mueve a un salón
 * de su misma categoría, porque el salón decide qué prueba se reparte en esa
 * puerta. Y un salón que ya entregó su acta no se toca: lo que subió el
 * responsable quedaría atribuido a quien no se sentó ahí.
 */
export default function FinalReparto() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [nueva, setNueva] = useState('A');

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

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando el reparto" />;

  const { salones, resumen, config } = datos;

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

  const mover = (alumno, salon) =>
    accion(
      `mover-${alumno.dni}`,
      () => api.post('/final/salones/mover', { dni: alumno.dni, salon }),
      `${alumno.nombres} pasó al salón ${salon}.`,
    );

  const sacar = (alumno) =>
    accion(
      `sacar-${alumno.dni}`,
      () => api.post('/final/salones/sacar', { dni: alumno.dni }),
      `${alumno.nombres} quedó sin salón.`,
    );

  const abrir = (categoria) =>
    accion(
      'nuevo',
      () => api.post('/final/salones/nuevo', { categoria }),
      `Salón abierto para la CAT. ${categoria}.`,
    );

  const cerrar = (salon) => {
    if (!window.confirm(`¿Cerrar el salón ${salon.numero}?`)) return;
    return accion(
      `borrar-${salon.numero}`,
      () => api.delete(`/final/salones/${salon.numero}`),
      `Salón ${salon.numero} cerrado.`,
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

  const termino = sinTildes(busqueda);
  const coincide = (a) => !termino || sinTildes(`${a.nombres} ${a.dni}`).includes(termino);

  // Las categorías que hoy tienen salón, en el orden del día: secundaria y
  // después primaria, cada una en el orden de los grados.
  const categorias = GRADOS.filter((g) => salones.some((s) => s.categoria === g.categoria)).sort(
    (a, b) =>
      (a.nivel === 'SECUNDARIA' ? 0 : 1) - (b.nivel === 'SECUNDARIA' ? 0 : 1) ||
      a.categoria.localeCompare(b.categoria),
  );

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Reparto de alumnos</h3>
        <p className="mt-2 text-xl text-slate-600">
          Acomode lo que el reparto automático no puede saber: mueva a alguien de salón, abra un
          aula más o cierre la que sobra. Cada cambio se guarda al instante.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <Dato numero={resumen.salones} texto="salones" />
          <Dato numero={resumen.repartidos} texto="sentados" />
          <Dato
            numero={resumen.excedidos}
            texto={`sobre los ${config.capacidad}`}
            alerta={resumen.excedidos > 0}
          />
          <Dato numero={resumen.conActa} texto="ya entregaron" />
        </div>

        <div className="mt-6 max-w-md">
          <Campo
            etiqueta="Buscar un alumno"
            icono={Search}
            placeholder="Nombre o DNI"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </Tarjeta>

      {resumen.sinSalon.length > 0 && (
        <Tarjeta fondo="bg-amber-50">
          <h4 className="flex items-center gap-3 text-xl font-black text-amber-900">
            <AlertCircle className="h-6 w-6" />
            Sin salón ({resumen.sinSalon.length})
          </h4>
          <p className="mt-2 text-base text-amber-900">
            Clasificaron pero no están sentados en ninguna parte. Siéntelos antes de imprimir las
            listas.
          </p>

          <div className="mt-5 space-y-3">
            {resumen.sinSalon.map((a) => (
              <Suelto
                key={a.dni}
                alumno={a}
                // Solo los de su categoría: en otro le tocaría otra prueba.
                salones={salones.filter((s) => s.categoria === a.categoria && !s.conActa)}
                cargando={procesando === `mover-${a.dni}`}
                alMover={(salon) => mover(a, salon)}
              />
            ))}
          </div>
        </Tarjeta>
      )}

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

      {categorias.map((g) => {
        const suyos = salones.filter((s) => s.categoria === g.categoria);
        const total = suyos.reduce((n, s) => n + s.total, 0);

        return (
          <Tarjeta key={g.categoria}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="text-xl font-black text-slate-900">
                  CAT. {g.categoria} · {g.label}
                </h4>
                <p className="mt-1 text-base text-slate-600">
                  {NIVEL[g.nivel === 'SECUNDARIA' ? 'SECUNDARIA' : 'PRIMARIA']} · {total} alumnos
                  en {suyos.length} {suyos.length === 1 ? 'salón' : 'salones'}
                </p>
              </div>
              <Boton
                variante="contorno"
                tamano="chico"
                cargando={procesando === 'nuevo'}
                onClick={() => abrir(g.categoria)}
              >
                <Plus className="h-5 w-5" />
                Abrir un salón
              </Boton>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {suyos.map((s) => (
                <div
                  key={s.numero}
                  className={`rounded-2xl border-2 p-5 ${
                    s.conActa
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : s.excedido
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-granate-600 text-white">
                        <span className="text-lg font-black leading-none">{s.numero}</span>
                        <span className="text-[0.6rem]">salón</span>
                      </span>
                      <div>
                        <p className="text-base font-bold text-slate-900">
                          {s.total} / {config.capacidad}
                        </p>
                        <p className="text-base text-slate-500">
                          {s.horario.inicio} a {s.horario.fin}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {s.conActa && (
                        <Etiqueta compacto className="bg-emerald-100 text-emerald-800">
                          <Lock className="mr-1 inline h-4 w-4" />
                          Entregado
                        </Etiqueta>
                      )}
                      {s.excedido && !s.conActa && (
                        <Etiqueta compacto className="bg-amber-100 text-amber-800">
                          Sobre el cupo
                        </Etiqueta>
                      )}
                      {s.total === 0 && !s.conActa && (
                        <Boton
                          variante="peligro"
                          tamano="chico"
                          cargando={procesando === `borrar-${s.numero}`}
                          onClick={() => cerrar(s)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Boton>
                      )}
                    </div>
                  </div>

                  {s.responsable && (
                    <p className="mt-3 text-base text-slate-600">
                      Responsable: {s.responsable.nombre}
                    </p>
                  )}

                  {s.conActa && (
                    <p className="mt-3 text-base text-emerald-800">
                      Ya subió su acta. Para mover a alguien de aquí, anule ese envío en Consulta
                      de envíos.
                    </p>
                  )}

                  {s.total === 0 ? (
                    <p className="mt-5 rounded-xl bg-slate-50 py-6 text-center text-base text-slate-500">
                      Salón vacío. Mueva gente aquí, o ciérrelo.
                    </p>
                  ) : (
                    <ul className="mt-5 space-y-2">
                      {s.alumnos.map((a) => {
                        const visible = coincide(a);
                        return (
                          <li
                            key={a.dni}
                            className={`rounded-xl border-2 p-3 ${
                              termino && visible
                                ? 'border-granate-300 bg-granate-50'
                                : 'border-slate-100'
                            } ${termino && !visible ? 'opacity-40' : ''}`}
                          >
                            <p className="text-base font-bold text-slate-900">{a.nombres}</p>
                            <p className="text-base text-slate-500">
                              {a.dni} · {a.institucion}
                            </p>

                            {!s.conActa && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <ArrowRightLeft className="h-5 w-5 shrink-0 text-slate-400" />
                                <select
                                  value=""
                                  disabled={procesando === `mover-${a.dni}`}
                                  onChange={(e) => e.target.value && mover(a, Number(e.target.value))}
                                  className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1 text-base text-slate-700 outline-none focus:border-granate-600"
                                >
                                  <option value="">Mover a…</option>
                                  {suyos
                                    .filter((otro) => otro.numero !== s.numero && !otro.conActa)
                                    .map((otro) => (
                                      <option key={otro.numero} value={otro.numero}>
                                        Salón {otro.numero} ({otro.total})
                                      </option>
                                    ))}
                                </select>
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
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Tarjeta>
        );
      })}

      <Tarjeta>
        <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
          <DoorOpen className="h-6 w-6 text-granate-600" />
          Abrir un salón de otra categoría
        </h4>
        <p className="mt-2 text-base text-slate-600">
          Para una categoría que todavía no tiene ninguno. El salón toma el primer número libre.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[18rem] flex-1">
            <Selector etiqueta="Categoría" value={nueva} onChange={(e) => setNueva(e.target.value)}>
              {GRADOS.map((g) => (
                <option key={g.categoria} value={g.categoria}>
                  CAT. {g.categoria} · {g.label}
                </option>
              ))}
            </Selector>
          </div>
          <Boton cargando={procesando === 'nuevo'} onClick={() => abrir(nueva)}>
            <Plus className="h-6 w-6" />
            Abrir
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

/** Un clasificado que no está sentado: solo se le ofrece dónde sentarlo. */
function Suelto({ alumno, salones, cargando, alMover }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-amber-200 bg-white p-4">
      <div className="min-w-[12rem] flex-1">
        <p className="text-base font-bold text-slate-900">{alumno.nombres}</p>
        <p className="text-base text-slate-500">
          {alumno.dni} · CAT. {alumno.categoria}
          {alumno.institucion && ` · ${alumno.institucion}`}
        </p>
      </div>
      {salones.length === 0 ? (
        <p className="text-base text-amber-900">
          No hay salón libre de su categoría: abra uno más abajo.
        </p>
      ) : (
        <select
          value=""
          disabled={cargando}
          onChange={(e) => e.target.value && alMover(Number(e.target.value))}
          className="rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-base text-slate-700 outline-none focus:border-granate-600"
        >
          <option value="">Sentar en…</option>
          {salones.map((s) => (
            <option key={s.numero} value={s.numero}>
              Salón {s.numero} ({s.total})
            </option>
          ))}
        </select>
      )}
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
