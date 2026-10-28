import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, UserCog } from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';
import { PERMISOS_COMISION, PERMISOS_RESULTADOS } from '../lib/permisos';

/**
 * Resultados · Supervisor a cargo.
 *
 * El panel del supervisor no es uno solo: se arma con lo que tenga marcado
 * aquí. Lo que no esté marcado no le aparece en el sidebar y el servidor
 * también se lo niega, así que no basta con saberse la dirección.
 *
 * Se guarda al pulsar «Guardar permisos» y no casilla por casilla: repartir
 * accesos es de las cosas que conviene revisar antes de confirmar.
 */
export default function PermisosSupervisores() {
  const [lista, setLista] = useState(null);
  const [borrador, setBorrador] = useState({});
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState('');

  useEffect(() => {
    api
      .get('/permisos/supervisores')
      .then(({ data }) => {
        setLista(data);
        setBorrador(Object.fromEntries(data.map((s) => [s.id, s.permisos])));
      })
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

  const marcar = (id, permiso, valor) => {
    setMensaje('');
    setBorrador((previo) => {
      const suyos = previo[id] || [];
      return {
        ...previo,
        [id]: valor ? [...new Set([...suyos, permiso])] : suyos.filter((p) => p !== permiso),
      };
    });
  };

  const marcarGrupo = (id, grupo, valor) => {
    setMensaje('');
    setBorrador((previo) => {
      const suyos = previo[id] || [];
      const ids = grupo.map((p) => p.id);
      return {
        ...previo,
        [id]: valor
          ? [...new Set([...suyos, ...ids])]
          : suyos.filter((p) => !ids.includes(p)),
      };
    });
  };

  const guardar = async (supervisor) => {
    setError('');
    setMensaje('');
    setGuardando(supervisor.id);
    try {
      const { data } = await api.post(`/permisos/supervisores/${supervisor.id}`, {
        permisos: borrador[supervisor.id] || [],
      });
      setLista(data);
      setBorrador(Object.fromEntries(data.map((s) => [s.id, s.permisos])));
      const cuantos = (data.find((s) => s.id === supervisor.id)?.permisos || []).length;
      setMensaje(
        cuantos === 0
          ? `${supervisor.nombre} se queda sin acceso al panel.`
          : `${supervisor.nombre}: ${cuantos} ${cuantos === 1 ? 'módulo' : 'módulos'} en su panel.`,
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar los permisos'));
    } finally {
      setGuardando('');
    }
  };

  const conAcceso = lista.filter((s) => s.permisos.length > 0).length;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-granate-50">
            <UserCog className="h-8 w-8 text-granate-600" />
          </span>
          <div>
            <h3 className="text-3xl font-black text-slate-900">Supervisor a cargo</h3>
            <p className="mt-2 text-xl text-slate-600">
              Marque qué módulos le aparecen a cada supervisor en su panel. Lo que no marque no lo
              verá ni podrá usar.
            </p>
          </div>
        </div>
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
            {conAcceso} con acceso
          </Etiqueta>
        </div>

        {lista.length === 0 && (
          <div className="mt-6">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              Todavía no hay supervisores. Créelos en Ajustes · Supervisores.
            </Aviso>
          </div>
        )}
      </Tarjeta>

      {lista.map((s) => (
        <Supervisor
          key={s.id}
          supervisor={s}
          marcados={borrador[s.id] || []}
          guardando={guardando === s.id}
          alMarcar={(permiso, valor) => marcar(s.id, permiso, valor)}
          alMarcarGrupo={(grupo, valor) => marcarGrupo(s.id, grupo, valor)}
          alGuardar={() => guardar(s)}
        />
      ))}
    </div>
  );
}

/** La ficha de un supervisor con sus dos grupos de casillas. */
function Supervisor({ supervisor, marcados, guardando, alMarcar, alMarcarGrupo, alGuardar }) {
  const guardados = supervisor.permisos;
  // Comparar como conjuntos: el orden de las casillas no es un cambio.
  const cambiado =
    marcados.length !== guardados.length || marcados.some((p) => !guardados.includes(p));

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-black text-slate-900">{supervisor.nombre}</p>
          <p className="mt-1 text-base text-slate-600">{supervisor.correo}</p>
        </div>

        <Etiqueta
          compacto
          className={
            marcados.length ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }
        >
          {marcados.length === 0
            ? 'Sin acceso'
            : `${marcados.length} ${marcados.length === 1 ? 'módulo' : 'módulos'}`}
        </Etiqueta>
      </div>

      <Grupo
        titulo="Resultados"
        descripcion="La clasificación y su publicación."
        permisos={PERMISOS_RESULTADOS}
        marcados={marcados}
        alMarcar={alMarcar}
        alMarcarTodo={(valor) => alMarcarGrupo(PERMISOS_RESULTADOS, valor)}
      />

      <Grupo
        titulo="Resto del panel"
        descripcion="Las mismas pantallas del administrador."
        permisos={PERMISOS_COMISION}
        marcados={marcados}
        alMarcar={alMarcar}
        alMarcarTodo={(valor) => alMarcarGrupo(PERMISOS_COMISION, valor)}
      />

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t-2 border-slate-100 pt-6">
        <Boton
          variante="exito"
          cargando={guardando}
          disabled={!cambiado}
          onClick={alGuardar}
        >
          Guardar permisos
        </Boton>
        {cambiado && (
          <span className="text-base font-semibold text-amber-700">Hay cambios sin guardar.</span>
        )}
      </div>
    </Tarjeta>
  );
}

/** Un grupo de casillas con su atajo de «todos». */
function Grupo({ titulo, descripcion, permisos, marcados, alMarcar, alMarcarTodo }) {
  const puestos = permisos.filter((p) => marcados.includes(p.id)).length;
  const todos = puestos === permisos.length;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h5 className="text-xl font-black text-granate-700">{titulo}</h5>
          <p className="mt-1 text-base text-slate-500">{descripcion}</p>
        </div>
        <button
          type="button"
          onClick={() => alMarcarTodo(!todos)}
          className="text-base font-bold text-granate-700 transition hover:underline"
        >
          {todos ? 'Quitar todos' : 'Marcar todos'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {permisos.map((p) => {
          const puesto = marcados.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition ${
                puesto
                  ? 'border-emerald-300 bg-emerald-50/60'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={puesto}
                onChange={(e) => alMarcar(p.id, e.target.checked)}
                className="mt-1 h-6 w-6 shrink-0 accent-emerald-600"
              />
              <span className="min-w-0">
                <span className="block text-lg font-black text-slate-900">{p.texto}</span>
                <span className="mt-0.5 block text-base text-slate-600">{p.detalle}</span>
                {p.aviso && (
                  <span className="mt-2 flex items-start gap-1.5 text-base font-semibold text-amber-700">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    {p.aviso}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
