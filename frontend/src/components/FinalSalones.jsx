import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  DoorOpen,
  RefreshCw,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';

export const NIVEL = { SECUNDARIA: 'Secundaria', PRIMARIA: 'Primaria' };
export const NIVELES = ['SECUNDARIA', 'PRIMARIA'];

export const COLOR_NIVEL = {
  SECUNDARIA: 'bg-sky-100 text-sky-800',
  PRIMARIA: 'bg-emerald-100 text-emerald-800',
};

/**
 * Final macrorregional · Salones y horarios.
 *
 * El día del examen se arma aquí: a qué hora entra cada turno, de a cuántos
 * por aula y quién vigila cada una. Los dos turnos numeran desde el mismo
 * primer salón porque son las mismas aulas: el 101 de las 8:30 y el 101 de las
 * 10:30 son la misma puerta con gente distinta.
 */
export default function FinalSalones() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState('');
  const [borrador, setBorrador] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/salones');
      setDatos(data);
      setBorrador(data.config);
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
  if (!datos || !borrador) return <Cargando texto="Armando el día del examen" />;

  const { salones, resumen, responsables, niveles } = datos;

  const guardarConfig = async () => {
    setError('');
    setAviso('');
    setProcesando('config');
    try {
      const { data } = await api.post('/final/config', borrador);
      setDatos({ ...datos, config: data });
      setBorrador(data);
      setAviso('Horarios y sede guardados');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar'));
    } finally {
      setProcesando('');
    }
  };

  const generar = async () => {
    const texto = resumen.generadoEn
      ? 'Se vuelve a repartir a todos los clasificados y se pierde lo que acomodó a mano.\n\n¿Continuar?'
      : `Se repartirá a ${resumen.clasificados} clasificados en salones de ${borrador.capacidad}. ¿Continuar?`;
    if (!window.confirm(texto)) return;

    setError('');
    setAviso('');
    setProcesando('generar');
    try {
      const { data } = await api.post('/final/salones/generar');
      setDatos(data);
      setAviso(`Reparto armado: ${data.resumen.salones} salones.`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo armar el reparto'));
    } finally {
      setProcesando('');
    }
  };

  const borrar = async () => {
    if (!window.confirm('Se borra el reparto completo, con los responsables asignados.\n\n¿Seguro?')) {
      return;
    }
    setProcesando('borrar');
    try {
      const { data } = await api.delete('/final/salones');
      setDatos(data);
      setAviso('Reparto borrado.');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo borrar'));
    } finally {
      setProcesando('');
    }
  };

  const asignar = async (salon, responsableId) => {
    setError('');
    try {
      const { data } = await api.post(
        `/final/salones/${salon.nivel}/${salon.numero}/responsable`,
        { responsableId },
      );
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo asignar'));
    }
  };

  const cambiarBloque = (nivel, campo, valor) =>
    setBorrador({
      ...borrador,
      bloques: { ...borrador.bloques, [nivel]: { ...borrador.bloques[nivel], [campo]: valor } },
    });

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Salones y horarios</h3>
        <p className="mt-2 text-xl text-slate-600">
          A la final llega quien clasificó en la etapa institucional. Aquí se decide a qué hora
          entra cada turno, de a cuántos por aula y quién la vigila.
        </p>
      </Tarjeta>

      {/* --------------------------------------------------------- el horario */}
      <Tarjeta>
        <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
          <Clock className="h-6 w-6 text-granate-600" />
          El día
        </h4>
        <p className="mt-2 text-base text-slate-600">
          Secundaria rinde primero y primaria después, en las mismas aulas. Por eso los dos turnos
          numeran desde el mismo primer salón.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Campo
            etiqueta="Sede"
            placeholder="Institución donde se rinde"
            value={borrador.sede}
            onChange={(e) => setBorrador({ ...borrador, sede: e.target.value })}
          />
          <Campo
            etiqueta="Fecha"
            placeholder="08 de noviembre de 2026"
            value={borrador.fecha}
            onChange={(e) => setBorrador({ ...borrador, fecha: e.target.value })}
          />
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {NIVELES.map((nivel) => (
            <div key={nivel} className="rounded-2xl border-2 border-slate-200 p-5">
              <Etiqueta compacto className={COLOR_NIVEL[nivel]}>
                {NIVEL[nivel]} · todas las categorías
              </Etiqueta>
              <div className="mt-4 flex items-end gap-3">
                <Campo
                  compacto
                  etiqueta="Desde"
                  value={borrador.bloques[nivel].inicio}
                  onChange={(e) => cambiarBloque(nivel, 'inicio', e.target.value)}
                />
                <Campo
                  compacto
                  etiqueta="Hasta"
                  value={borrador.bloques[nivel].fin}
                  onChange={(e) => cambiarBloque(nivel, 'fin', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Campo
            etiqueta="Alumnos por salón"
            type="number"
            value={borrador.capacidad}
            onChange={(e) => setBorrador({ ...borrador, capacidad: e.target.value })}
          />
          <Campo
            etiqueta="Primer salón de cada turno"
            type="number"
            ayuda="De ahí para arriba, uno por uno, en los dos turnos."
            value={borrador.primerSalon}
            onChange={(e) => setBorrador({ ...borrador, primerSalon: e.target.value })}
          />
        </div>

        <div className="mt-6">
          <Boton cargando={procesando === 'config'} onClick={guardarConfig}>
            Guardar el día
          </Boton>
        </div>
      </Tarjeta>

      {/* --------------------------------------------------------- el reparto */}
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
              <DoorOpen className="h-6 w-6 text-granate-600" />
              El reparto automático
            </h4>
            <p className="mt-2 text-base text-slate-600">
              Categoría por categoría, en orden alfabético, de a {borrador.capacidad}. Después se
              acomoda a mano en Reparto de alumnos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Boton
              variante={resumen.generadoEn ? 'contorno' : 'primario'}
              cargando={procesando === 'generar'}
              onClick={generar}
            >
              <RefreshCw className="h-5 w-5" />
              {resumen.generadoEn ? 'Volver a repartir' : 'Armar el reparto'}
            </Boton>
            {resumen.generadoEn && (
              <Boton variante="peligro" tamano="chico" cargando={procesando === 'borrar'} onClick={borrar}>
                <Trash2 className="h-5 w-5" />
                Borrar
              </Boton>
            )}
          </div>
        </div>

        {resumen.desfasado && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto>
              El reparto tiene {resumen.repartidos} alumnos y hoy hay {resumen.clasificados}{' '}
              clasificados. Siente a los que faltan en Reparto de alumnos, o vuelva a repartir.
            </Aviso>
          </div>
        )}

        {resumen.sinResponsable > 0 && resumen.salones > 0 && (
          <div className="mt-4">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              {resumen.sinResponsable}{' '}
              {resumen.sinResponsable === 1 ? 'salón sin responsable' : 'salones sin responsable'}.
              Sin responsable nadie puede subir sus respuestas.
            </Aviso>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Cifra icono={DoorOpen} numero={resumen.salones} texto="salones" />
          <Cifra icono={Users} numero={resumen.repartidos} texto="alumnos repartidos" />
          <Cifra
            icono={UserCog}
            numero={resumen.salones - resumen.sinResponsable}
            texto="con responsable"
          />
        </div>

        {niveles.some((n) => n.salones > 0) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {niveles.map((n) => (
              <div key={n.nivel} className="rounded-2xl border-2 border-slate-200 p-5">
                <Etiqueta compacto className={COLOR_NIVEL[n.nivel]}>
                  {n.texto}
                </Etiqueta>
                <p className="mt-3 text-xl font-black text-slate-900">
                  {n.horario.inicio} a {n.horario.fin}
                </p>
                <p className="text-base text-slate-600">
                  {n.salones} {n.salones === 1 ? 'salón' : 'salones'} · {n.alumnos} alumnos
                </p>
              </div>
            ))}
          </div>
        )}
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

      {/* ------------------------------------------------ quién vigila cada aula */}
      {NIVELES.map((nivel) => {
        const suyos = salones.filter((s) => s.nivel === nivel);
        if (suyos.length === 0) return null;

        return (
          <Tarjeta key={nivel}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-xl font-black text-slate-900">
                {NIVEL[nivel]} · {suyos[0].horario.inicio} a {suyos[0].horario.fin}
              </h4>
              <p className="text-base text-slate-500">
                salones {suyos[0].numero} al {suyos[suyos.length - 1].numero}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {suyos.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-slate-200 p-4"
                >
                  <span className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-granate-600 text-white">
                    <span className="text-xl font-black leading-none">{s.numero}</span>
                    <span className="text-xs">salón</span>
                  </span>

                  <div className="min-w-[10rem] flex-1">
                    <p className="text-base font-black text-slate-900">
                      {s.categorias.length === 0
                        ? 'Vacío'
                        : s.categorias.map((c) => `CAT. ${c}`).join(' · ')}
                    </p>
                    <p className="text-base text-slate-600">
                      {s.total} {s.total === 1 ? 'alumno' : 'alumnos'}
                      {s.excedido && ' · sobre el cupo'}
                    </p>
                  </div>

                  <div className="min-w-[15rem] flex-1">
                    <Selector
                      compacto
                      etiqueta="Responsable"
                      value={s.responsableId || ''}
                      onChange={(e) => asignar(s, e.target.value || null)}
                    >
                      <option value="">Sin asignar</option>
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
          </Tarjeta>
        );
      })}

      {resumen.salones === 0 && (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            {resumen.clasificados > 0
              ? `Hay ${resumen.clasificados} clasificados esperando. Pulse «Armar el reparto».`
              : 'Todavía no hay clasificados en la etapa institucional.'}
          </Aviso>
        </Tarjeta>
      )}

      {responsables.length === 0 && (
        <Tarjeta>
          <Aviso tipo="alerta" icono={AlertCircle} compacto>
            No hay cuentas de supervisor para poner a cargo de las aulas. Créelas en Ajustes ·
            Supervisores —nombre, DNI y correo— y deles el permiso «Mi salón · final».
          </Aviso>
        </Tarjeta>
      )}
    </div>
  );
}

function Cifra({ icono: Icono, numero, texto }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 p-5">
      <Icono className="h-9 w-9 text-granate-600" />
      <div>
        <p className="text-3xl font-black text-slate-900">{numero}</p>
        <p className="text-base text-slate-600">{texto}</p>
      </div>
    </div>
  );
}
