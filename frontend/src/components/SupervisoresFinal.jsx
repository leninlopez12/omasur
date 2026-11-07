import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  DoorOpen,
  Plus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { COLOR_NIVEL, NIVEL, NIVELES } from './FinalSalones.jsx';
import { api, mensajeError } from '../lib/api';

/**
 * Supervisores · Examen final.
 *
 * El atajo del día del examen. Repartir aulas estaba en Salones y horarios,
 * mirando el reparto; esto mira a las personas: cada supervisor con las aulas
 * que le tocaron, en qué turno, y si tiene el permiso para subir su acta.
 *
 * Son dos cosas distintas y las dos hacen falta: el aula la da el reparto y el
 * permiso lo da la lista de permisos. Tener una sin la otra no sirve de nada,
 * así que aquí se ven juntas y se arreglan desde el mismo sitio.
 */
export default function SupervisoresFinal() {
  const [datos, setDatos] = useState(null);
  const [permisos, setPermisos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [reparto, lista] = await Promise.all([
        api.get('/final/salones'),
        api.get('/permisos/supervisores'),
      ]);
      setDatos(reparto.data);
      setPermisos(lista.data);
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
  if (!datos || !permisos) return <Cargando texto="Cruzando aulas y permisos" />;

  const { salones, responsables } = datos;

  const asignar = async (salon, responsableId) => {
    setError('');
    setAviso('');
    setProcesando(salon.id);
    try {
      const { data } = await api.post(
        `/final/salones/${salon.nivel}/${salon.numero}/responsable`,
        { responsableId },
      );
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo asignar'));
    } finally {
      setProcesando('');
    }
  };

  /** Le da el permiso de subir actas sin sacarle lo que ya tenía. */
  const darPermiso = async (supervisor) => {
    setError('');
    setAviso('');
    setProcesando(`permiso-${supervisor.id}`);
    try {
      const { data } = await api.post(`/permisos/supervisores/${supervisor.id}`, {
        permisos: [...new Set([...(supervisor.permisos || []), 'final-salon'])],
      });
      setPermisos(data);
      setAviso(`${supervisor.nombre} ya puede subir el acta de sus salones.`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo dar el permiso'));
    } finally {
      setProcesando('');
    }
  };

  const quitarPermiso = async (supervisor) => {
    setError('');
    setAviso('');
    setProcesando(`permiso-${supervisor.id}`);
    try {
      const { data } = await api.post(`/permisos/supervisores/${supervisor.id}`, {
        permisos: (supervisor.permisos || []).filter((p) => p !== 'final-salon'),
      });
      setPermisos(data);
      setAviso(`${supervisor.nombre} ya no puede subir actas.`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo quitar el permiso'));
    } finally {
      setProcesando('');
    }
  };

  const conSusSalones = responsables.map((r) => {
    const suyos = salones.filter((s) => s.responsableId === r.id);
    const permiso = permisos.find((p) => p.id === r.id);
    return {
      ...r,
      salones: suyos,
      permisos: permiso?.permisos || [],
      puedeSubir: (permiso?.permisos || []).includes('final-salon'),
    };
  });

  const sinResponsable = salones.filter((s) => !s.responsableId);
  const listos = conSusSalones.filter((r) => r.salones.length > 0 && r.puedeSubir).length;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <DoorOpen className="h-9 w-9 text-granate-600" />
          Supervisores del examen final
        </h3>
        <p className="mt-2 text-xl text-slate-600">
          El atajo del día del examen: quién vigila qué aula y quién puede subir su acta. Hacen
          falta las dos cosas, y aquí se arreglan sin ir a dos pantallas.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Dato numero={conSusSalones.length} texto="supervisores" />
          <Dato numero={listos} texto="con aula y permiso" />
          <Dato
            numero={sinResponsable.length}
            texto="aulas sin responsable"
            alerta={sinResponsable.length > 0}
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

      {salones.length === 0 && (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay reparto de salones. Ármelo en Examen final · Salones y horarios.
          </Aviso>
        </Tarjeta>
      )}

      {conSusSalones.map((r) => (
        <Tarjeta key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-granate-50">
                <Users className="h-7 w-7 text-granate-600" />
              </span>
              <div>
                <p className="text-xl font-black text-slate-900">{r.nombre}</p>
                <p className="mt-1 text-base text-slate-600">
                  {r.correo}
                  {r.dni && ` · DNI ${r.dni}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Etiqueta
                compacto
                className={
                  r.puedeSubir ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }
              >
                <ShieldCheck className="mr-1 inline h-4 w-4" />
                {r.puedeSubir ? 'Puede subir actas' : 'Sin permiso para subir'}
              </Etiqueta>
              <Boton
                variante={r.puedeSubir ? 'fantasma' : 'exito'}
                tamano="chico"
                cargando={procesando === `permiso-${r.id}`}
                onClick={() => (r.puedeSubir ? quitarPermiso(r) : darPermiso(r))}
              >
                {r.puedeSubir ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {r.puedeSubir ? 'Quitar' : 'Dar permiso'}
              </Boton>
            </div>
          </div>

          {r.salones.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-slate-50 py-5 text-center text-base text-slate-500">
              Sin aulas asignadas. Désela abajo, en las que están libres.
            </p>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              {r.salones.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 p-4"
                >
                  <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-granate-600 text-white">
                    <span className="text-lg font-black leading-none">{s.numero}</span>
                    <span className="text-[0.6rem]">salón</span>
                  </span>
                  <div>
                    <Etiqueta compacto className={COLOR_NIVEL[s.nivel]}>
                      {NIVEL[s.nivel]} · {s.horario.inicio}
                    </Etiqueta>
                    <p className="mt-1 text-base text-slate-600">
                      {s.total} alumnos
                      {s.categorias.length > 0 &&
                        ` · ${s.categorias.map((c) => `CAT. ${c}`).join(' ')}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => asignar(s, null)}
                    disabled={procesando === s.id || s.conActa}
                    title={s.conActa ? 'Ya entregó su acta' : 'Quitarle este salón'}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {r.salones.length > 0 && !r.puedeSubir && (
            <div className="mt-5">
              <Aviso tipo="alerta" icono={AlertCircle} compacto>
                Tiene aulas pero no el permiso: el día del examen no podrá subir su acta.
              </Aviso>
            </div>
          )}
        </Tarjeta>
      ))}

      {sinResponsable.length > 0 && (
        <Tarjeta fondo="bg-amber-50">
          <h4 className="flex items-center gap-3 text-xl font-black text-amber-900">
            <AlertCircle className="h-6 w-6" />
            Aulas sin responsable ({sinResponsable.length})
          </h4>
          <p className="mt-2 text-base text-amber-900">
            Nadie puede subir el acta de estas aulas. Asígneles alguien antes del examen.
          </p>

          <div className="mt-5 space-y-3">
            {NIVELES.map((nivel) => {
              const suyos = sinResponsable.filter((s) => s.nivel === nivel);
              if (suyos.length === 0) return null;
              return (
                <div key={nivel}>
                  <Etiqueta compacto className={COLOR_NIVEL[nivel]}>
                    {NIVEL[nivel]}
                  </Etiqueta>
                  <div className="mt-3 space-y-3">
                    {suyos.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-amber-200 bg-white p-4"
                      >
                        <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-granate-600 text-white">
                          <span className="text-lg font-black leading-none">{s.numero}</span>
                          <span className="text-[0.6rem]">salón</span>
                        </span>
                        <p className="min-w-[8rem] flex-1 text-base text-slate-600">
                          {s.total} alumnos · {s.horario.inicio} a {s.horario.fin}
                        </p>
                        <div className="min-w-[14rem]">
                          <Selector
                            compacto
                            value=""
                            disabled={procesando === s.id}
                            onChange={(e) => e.target.value && asignar(s, e.target.value)}
                          >
                            <option value="">Asignar a…</option>
                            {responsables.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nombre}
                              </option>
                            ))}
                          </Selector>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Tarjeta>
      )}

      {responsables.length === 0 && (
        <Tarjeta>
          <Aviso tipo="alerta" icono={AlertCircle} compacto>
            No hay cuentas de supervisor. Créelas en Supervisores · Cuentas.
          </Aviso>
        </Tarjeta>
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
