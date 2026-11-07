import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Clock, Download, DoorOpen, IdCard } from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';

const NIVEL = { SECUNDARIA: 'Secundaria', PRIMARIA: 'Primaria' };

/**
 * Panel del tutor · Credencial FINALISTAS.
 *
 * Los suyos que clasificaron a la final, con el aula y la hora que les tocó, y
 * un botón que baja todas sus credenciales en un PDF. No tiene que preguntar
 * quién clasificó ni pedirlas una por una.
 */
export default function CredencialesFinalistas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/mis-finalistas');
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
  if (!datos) return <Cargando texto="Buscando a sus finalistas" />;

  const bajar = async () => {
    setError('');
    setBajando(true);
    try {
      await descargar('/final/mis-finalistas/credenciales', 'credenciales-finalistas.pdf');
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron descargar'));
    } finally {
      setBajando(false);
    }
  };

  if (!datos.abierta) {
    return (
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <IdCard className="h-9 w-9 text-granate-600" />
          Credencial FINALISTAS
        </h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle}>
            La comisión todavía no habilitó las credenciales de la final. En cuanto las abra,
            aquí le aparecerán los suyos con su aula y su hora.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  // Agrupadas por salón: es como se entregan y como se sientan ese día.
  const porSalon = [...new Set(datos.finalistas.map((f) => f.salon))]
    .sort((a, b) => a - b)
    .map((numero) => ({
      numero,
      alumnos: datos.finalistas
        .filter((f) => f.salon === numero)
        .sort((a, b) => a.puesto - b.puesto),
    }));

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
              <IdCard className="h-9 w-9 text-granate-600" />
              Credencial FINALISTAS
            </h3>
            <p className="mt-2 text-xl text-slate-600">
              Sus estudiantes que clasificaron a la final macrorregional
              {datos.fecha && ` del ${datos.fecha}`}
              {datos.sede && ` · ${datos.sede}`}.
            </p>
          </div>
          {datos.finalistas.length > 0 && (
            <Boton cargando={bajando} onClick={bajar}>
              <Download className="h-6 w-6" />
              Descargar todas
            </Boton>
          )}
        </div>

        {datos.finalistas.length === 0 ? (
          <div className="mt-6">
            <Aviso tipo="info" icono={AlertCircle}>
              Su delegación no tiene estudiantes con aula asignada en la final. Si cree que es un
              error, escriba a la comisión.
            </Aviso>
          </div>
        ) : (
          <p className="mt-6 text-xl text-slate-700">
            <span className="text-3xl font-black text-granate-700">
              {datos.finalistas.length}
            </span>{' '}
            {datos.finalistas.length === 1 ? 'finalista' : 'finalistas'} en{' '}
            {porSalon.length} {porSalon.length === 1 ? 'salón' : 'salones'}.
          </p>
        )}
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      {porSalon.map((s) => (
        <Tarjeta key={s.numero}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-granate-600 text-white">
              <span className="text-2xl font-black leading-none">{s.numero}</span>
              <span className="text-base">aula</span>
            </span>
            <div>
              <p className="text-xl font-black text-slate-900">
                CAT. {s.alumnos[0].categoria} · {s.alumnos[0].grado}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-base text-slate-600">
                <Etiqueta compacto className="bg-granate-50 text-granate-700">
                  {NIVEL[s.alumnos[0].nivel]}
                </Etiqueta>
                <span className="flex items-center gap-1">
                  <Clock className="h-5 w-5" />
                  {s.alumnos[0].hora}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[30rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 text-center font-semibold">N.º en la lista</th>
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.alumnos.map((a) => (
                  <tr key={a.dni}>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {a.puesto}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">{a.nombres}</span>
                      <span className="block text-base text-slate-500">{a.dni}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ))}

      {datos.finalistas.length > 0 && (
        <Tarjeta>
          <p className="flex items-start gap-3 text-base text-slate-600">
            <DoorOpen className="h-6 w-6 shrink-0 text-granate-600" />
            Cada credencial trae el aula, el número de lista y la hora de entrada. Imprímalas y
            recórtelas: salen ocho por hoja, de 9 × 6 cm.
          </p>
        </Tarjeta>
      )}
    </div>
  );
}

/**
 * El aviso emergente de las credenciales de la final.
 *
 * Sale una sola vez por tutor: en cuanto lo cierra queda anotado y no vuelve a
 * aparecer. Es el mismo trato que se le da al aviso de clasificados, porque es
 * lo mismo: algo que pasó una vez y hay que enterarse sí o sí.
 */
export function AvisoFinalistas({ abierta, finalistas, alIr }) {
  const [cerrado, setCerrado] = useState(false);
  if (!abierta || !finalistas || cerrado) return null;

  const memoria = 'omasur_credencial_final';
  let visto = false;
  try {
    visto = localStorage.getItem(memoria) === 'si';
  } catch {
    visto = false;
  }
  if (visto) return null;

  const cerrar = () => {
    setCerrado(true);
    try {
      localStorage.setItem(memoria, 'si');
    } catch {
      /* sin memoria vuelve a salir: no es grave */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={cerrar} />

      <div className="animate-emerger relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-[0_45px_90px_-25px_rgba(15,23,42,0.6)] ring-1 ring-granate-200">
        <div className="relative bg-[linear-gradient(145deg,#FBEEF0_0%,#E8B4BE_35%,#C06A7A_70%,#7B1E2B_100%)] px-6 py-9 text-center sm:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_0%,rgba(255,255,255,0.75),transparent_55%)]" />

          <span className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white/85 shadow-[0_14px_28px_-12px_rgba(15,23,42,0.55)]">
            <IdCard className="h-14 w-14 text-granate-700" />
          </span>

          <h2 className="relative mt-6 text-4xl font-black uppercase leading-none tracking-tight text-white">
            Credenciales de finalistas
          </h2>
          <p className="relative mt-4 text-xl font-semibold text-white">
            Ya puede descargar la credencial de sus {finalistas}{' '}
            {finalistas === 1 ? 'finalista' : 'finalistas'}.
          </p>
        </div>

        <div className="px-6 py-8 sm:px-10">
          <p className="text-xl text-slate-700">
            Cada una trae el aula que le tocó, el número que hace en la lista de ese salón y la
            hora a la que entra. Imprímalas y recórtelas antes del día del examen: sin credencial
            no se entra a la sede.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Boton
              onClick={() => {
                cerrar();
                alIr?.();
              }}
            >
              <Download className="h-6 w-6" />
              Ver mis finalistas
            </Boton>
            <Boton variante="contorno" onClick={cerrar}>
              Más tarde
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}
