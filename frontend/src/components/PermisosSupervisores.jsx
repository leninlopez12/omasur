import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Search,
  ShieldAlert,
  UserCog,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';
import { ETAPAS_PERMISOS, GRUPOS_PERMISOS, GRUPOS_SUELTOS, PERMISOS } from '../lib/permisos';

const sinTildes = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Supervisores · Permisos.
 *
 * El panel del supervisor no es uno solo: se arma con lo que tenga marcado
 * aquí. Lo que no esté marcado no le aparece en el sidebar y el servidor
 * también se lo niega, así que no basta con saberse la dirección.
 *
 * Se entra por el docente y no por la lista de permisos: son más de cuarenta
 * pantallas, y verlas todas para cada supervisor a la vez no se podía leer.
 * Primero se elige a quién, después se le marca lo suyo, y los grupos se
 * abren de a uno.
 */
export default function PermisosSupervisores() {
  const [lista, setLista] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [borrador, setBorrador] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(GRUPOS_PERMISOS[0]?.titulo || '');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .get('/permisos/supervisores')
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

  const supervisor = lista.find((s) => s.id === elegido) || null;

  const abrir = (s) => {
    setElegido(s.id);
    setBorrador(s.permisos);
    setMensaje('');
    setError('');
    setAbierto(GRUPOS_PERMISOS[0]?.titulo || '');
  };

  const marcar = (permiso, valor) => {
    setMensaje('');
    setBorrador((previo) =>
      valor ? [...new Set([...previo, permiso])] : previo.filter((p) => p !== permiso),
    );
  };

  const marcarGrupo = (grupo, valor) => {
    setMensaje('');
    const ids = grupo.map((p) => p.id);
    setBorrador((previo) =>
      valor ? [...new Set([...previo, ...ids])] : previo.filter((p) => !ids.includes(p)),
    );
  };

  const guardar = async () => {
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      const { data } = await api.post(`/permisos/supervisores/${supervisor.id}`, {
        permisos: borrador,
      });
      setLista(data);
      const cuantos = (data.find((s) => s.id === supervisor.id)?.permisos || []).length;
      setBorrador(data.find((s) => s.id === supervisor.id)?.permisos || []);
      setMensaje(
        cuantos === 0
          ? `${supervisor.nombre} se queda sin acceso al panel.`
          : `${supervisor.nombre}: ${cuantos} ${cuantos === 1 ? 'pantalla' : 'pantallas'} en su panel.`,
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar los permisos'));
    } finally {
      setGuardando(false);
    }
  };

  // ------------------------------------------------------ la lista de docentes

  if (!supervisor) {
    const termino = sinTildes(busqueda);
    const filtrados = lista.filter(
      (s) => !termino || sinTildes(`${s.nombre} ${s.correo}`).includes(termino),
    );
    const conAcceso = lista.filter((s) => s.permisos.length > 0).length;

    return (
      <div className="space-y-6">
        <Cabecera />

        <Tarjeta>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-[18rem] flex-1">
              <Campo
                etiqueta="Buscar un supervisor"
                icono={Search}
                placeholder="Nombre o correo"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <p className="pb-4 text-base text-slate-600">
              {lista.length} {lista.length === 1 ? 'supervisor' : 'supervisores'} ·{' '}
              {conAcceso} con acceso
            </p>
          </div>
        </Tarjeta>

        {error && (
          <Aviso tipo="error" icono={AlertCircle} compacto>
            {error}
          </Aviso>
        )}

        {lista.length === 0 ? (
          <Tarjeta>
            <Aviso tipo="info" icono={AlertCircle} compacto>
              Todavía no hay supervisores. Créelos en Supervisores · Cuentas.
            </Aviso>
          </Tarjeta>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtrados.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => abrir(s)}
                className="rounded-3xl border-2 border-slate-200 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-granate-400 hover:shadow-suave"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black text-slate-900">{s.nombre}</p>
                    <p className="mt-1 truncate text-base text-slate-600">{s.correo}</p>
                  </div>
                  <ChevronRight className="h-6 w-6 shrink-0 text-slate-400" />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Etiqueta
                    compacto
                    className={
                      s.permisos.length
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }
                  >
                    {s.permisos.length === 0
                      ? 'Sin acceso'
                      : `${s.permisos.length} de ${PERMISOS.length} pantallas`}
                  </Etiqueta>
                  {ETAPAS_PERMISOS.filter((e) =>
                    e.grupos.some((g) => g.permisos.some((p) => s.permisos.includes(p.id))),
                  ).map((e) => (
                    <Etiqueta key={e.titulo} compacto className="bg-granate-50 text-granate-700">
                      {e.titulo}
                    </Etiqueta>
                  ))}
                  {GRUPOS_SUELTOS.filter((g) =>
                    g.permisos.some((p) => s.permisos.includes(p.id)),
                  ).map((g) => (
                    <Etiqueta key={g.titulo} compacto className="bg-slate-100 text-slate-700">
                      {g.titulo}
                    </Etiqueta>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------- el reparto de uno solo

  const guardados = supervisor.permisos;
  const cambiado =
    borrador.length !== guardados.length || borrador.some((p) => !guardados.includes(p));

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-granate-50">
              <UserCog className="h-8 w-8 text-granate-600" />
            </span>
            <div>
              <p className="text-3xl font-black text-slate-900">{supervisor.nombre}</p>
              <p className="mt-1 text-base text-slate-600">{supervisor.correo}</p>
              <Etiqueta
                compacto
                className={`mt-3 ${
                  borrador.length ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {borrador.length === 0
                  ? 'Sin acceso'
                  : `${borrador.length} de ${PERMISOS.length} pantallas`}
              </Etiqueta>
            </div>
          </div>

          <Boton variante="contorno" tamano="chico" onClick={() => setElegido(null)}>
            <ArrowLeft className="h-5 w-5" />
            Otro supervisor
          </Boton>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Boton variante="exito" cargando={guardando} disabled={!cambiado} onClick={guardar}>
            <CheckCircle2 className="h-6 w-6" />
            Guardar permisos
          </Boton>
          {cambiado && (
            <Boton variante="fantasma" tamano="chico" onClick={() => setBorrador(guardados)}>
              Descartar
            </Boton>
          )}
          <Boton
            variante="fantasma"
            tamano="chico"
            onClick={() => setBorrador(borrador.length ? [] : PERMISOS.map((p) => p.id))}
          >
            {borrador.length ? 'Quitar todo' : 'Marcar todo'}
          </Boton>
        </div>

        {cambiado && (
          <p className="mt-4 text-base text-amber-700">
            Hay cambios sin guardar. Si sale de aquí se pierden.
          </p>
        )}
      </Tarjeta>

      {mensaje && (
        <Aviso tipo="info" icono={CheckCircle2} compacto>
          {mensaje}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      {ETAPAS_PERMISOS.map((etapa) => {
        const suyos = etapa.grupos.flatMap((g) => g.permisos);
        const marcados = suyos.filter((p) => borrador.includes(p.id)).length;
        const todos = marcados === suyos.length;

        return (
          <div key={etapa.titulo} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-granate-800 px-7 py-5">
              <div className="min-w-0">
                <p className="text-2xl font-black text-white">{etapa.titulo}</p>
                <p className="mt-1 text-base text-granate-100">{etapa.descripcion}</p>
              </div>

              <div className="flex items-center gap-3">
                <Etiqueta compacto className="bg-white/20 text-white">
                  {marcados} de {suyos.length}
                </Etiqueta>
                <Boton variante="blanco" tamano="chico" onClick={() => marcarGrupo(suyos, !todos)}>
                  {todos ? 'Quitar la etapa' : 'Marcar la etapa'}
                </Boton>
              </div>
            </div>

            <div className="space-y-3 border-l-4 border-granate-200 pl-4">
              {etapa.grupos.map((g) => (
                <GrupoPermisos
                  key={g.titulo}
                  grupo={g}
                  desplegado={abierto === g.titulo}
                  alDesplegar={() => setAbierto(abierto === g.titulo ? '' : g.titulo)}
                  borrador={borrador}
                  marcar={marcar}
                  marcarGrupo={marcarGrupo}
                />
              ))}
            </div>
          </div>
        );
      })}

      {GRUPOS_SUELTOS.map((g) => (
        <GrupoPermisos
          key={g.titulo}
          grupo={g}
          desplegado={abierto === g.titulo}
          alDesplegar={() => setAbierto(abierto === g.titulo ? '' : g.titulo)}
          borrador={borrador}
          marcar={marcar}
          marcarGrupo={marcarGrupo}
        />
      ))}
    </div>
  );
}

/**
 * Un grupo de pantallas, plegado hasta que se le pide.
 *
 * Son cerca de sesenta: abiertas todas a la vez no se leían. El contador de
 * arriba dice cuántas lleva marcadas sin tener que desplegarlo.
 */
function GrupoPermisos({ grupo, desplegado, alDesplegar, borrador, marcar, marcarGrupo }) {
  const marcados = grupo.permisos.filter((p) => borrador.includes(p.id)).length;
  const todos = marcados === grupo.permisos.length;

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={alDesplegar}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {desplegado ? (
            <ChevronDown className="h-6 w-6 shrink-0 text-granate-600" />
          ) : (
            <ChevronRight className="h-6 w-6 shrink-0 text-slate-400" />
          )}
          <span className="min-w-0">
            <span className="block text-xl font-black text-slate-900">{grupo.titulo}</span>
            <span className="block text-base text-slate-600">{grupo.descripcion}</span>
          </span>
        </button>

        <div className="flex items-center gap-3">
          <Etiqueta
            compacto
            className={
              marcados === 0
                ? 'bg-slate-100 text-slate-600'
                : todos
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
            }
          >
            {marcados} de {grupo.permisos.length}
          </Etiqueta>
          <Boton variante="suave" tamano="chico" onClick={() => marcarGrupo(grupo.permisos, !todos)}>
            {todos ? 'Quitar' : 'Marcar todo'}
          </Boton>
        </div>
      </div>

      {desplegado && (
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {grupo.permisos.map((p) => {
            const marcado = borrador.includes(p.id);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition ${
                  marcado ? 'border-granate-300 bg-granate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={(e) => marcar(p.id, e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-granate-600"
                />
                <span className="min-w-0">
                  <span className="block text-base font-bold text-slate-900">{p.texto}</span>
                  <span className="block text-base text-slate-600">{p.detalle}</span>
                  {p.aviso && (
                    <span className="mt-1 flex items-start gap-1.5 text-base text-amber-700">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      {p.aviso}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </Tarjeta>
  );
}

function Cabecera() {
  return (
    <Tarjeta>
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-granate-50">
          <UserCog className="h-8 w-8 text-granate-600" />
        </span>
        <div>
          <h3 className="text-3xl font-black text-slate-900">Permisos</h3>
          <p className="mt-2 text-xl text-slate-600">
            Elija un supervisor y marque pantalla por pantalla qué ve en su panel. Lo que no
            marque no le aparece en el sidebar y el servidor también se lo niega.
          </p>
        </div>
      </div>
    </Tarjeta>
  );
}
