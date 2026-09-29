import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, XCircle } from 'lucide-react';
import { Aviso, Cargando, Tarjeta } from './Ui.jsx';
import { VistaComprobante } from './PasoPago.jsx';
import TablaInscripciones, { ESTADO_INSCRIPCION } from './TablaInscripciones.jsx';
import { api, mensajeError } from '../lib/api';

const soles = (valor) => `S/ ${Number(valor || 0).toLocaleString('es-PE')}`;

/**
 * Panel del tutor > Inscripciones.
 *
 * El estado real de cada alumno: registrado, en revisión, aprobado u
 * observado. El comprobante es una columna del recorrido, no una sección
 * aparte: quien mira esto quiere saber si su alumno está adentro.
 */
export default function MisInscripciones() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async () => {
    const { data } = await api.get('/tutores/inscripciones');
    setDatos(data);
  }, []);

  useEffect(() => {
    cargar().catch((e) => setError(mensajeError(e, 'No se pudieron cargar sus inscripciones')));
  }, [cargar]);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando sus inscripciones" />;

  const { filas, rechazados } = datos;

  if (filas.length === 0) {
    return (
      <Aviso tipo="info" icono={AlertCircle} titulo="Todavía no hay estudiantes">
        Regístrelos en «Estudiantes» y vuelva aquí para seguir su inscripción.
      </Aviso>
    );
  }

  const cuenta = (clave) => filas.filter((f) => f.estadoInscripcion === clave).length;

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Estado de mi delegación</h3>
        <p className="mt-3 text-xl text-slate-600">
          Registrado → Comprobante enviado → En revisión → Aprobado.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(ESTADO_INSCRIPCION).map(([clave, conf]) => (
            <div key={clave} className="rounded-2xl border-2 border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 shrink-0 rounded-full ${conf.punto}`} />
                <p className="text-3xl font-black text-slate-900">{cuenta(clave)}</p>
              </div>
              <p className="mt-1 text-base text-slate-600">{conf.texto}</p>
            </div>
          ))}
        </div>
      </Tarjeta>

      {/* Un comprobante rechazado suelta a sus alumnos, así que ya no aparece
          al lado de ninguno. Sin esto el tutor no sabría por qué volvieron a
          quedar sin comprobante. */}
      {rechazados.length > 0 && (
        <Tarjeta className="border-2 border-rose-200">
          <h3 className="flex items-center gap-3 text-3xl font-black text-rose-900">
            <XCircle className="h-8 w-8" />
            Comprobantes rechazados
          </h3>
          <p className="mt-3 text-xl text-rose-900">
            Los estudiantes que cubrían volvieron a quedar pendientes. Envíe uno nuevo desde
            «Seleccionar estudiantes».
          </p>

          <div className="mt-6 space-y-3">
            {rechazados.map((pago) => (
              <div key={pago.id} className="rounded-2xl bg-rose-50 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-xl font-bold text-rose-900">
                    {soles(pago.monto)} · {pago.metodo === 'BCP' ? 'BCP' : 'Yape'}
                  </p>
                  <p className="text-base text-rose-700">
                    Enviado el {new Date(pago.createdAt).toLocaleDateString('es-PE')}
                  </p>
                </div>
                {pago.observacion && (
                  <p className="mt-2 text-base text-rose-800">
                    <strong>Motivo:</strong> {pago.observacion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Tarjeta>
      )}

      <TablaInscripciones
        filas={filas}
        textoAccion="Detalle"
        alAbrir={setAbierta}
        vacio="Ningún estudiante coincide con esos filtros."
      />

      {abierta && <Detalle fila={abierta} alCerrar={() => setAbierta(null)} />}
    </div>
  );
}

/** El detalle de un alumno, con su comprobante a la vista. */
function Detalle({ fila, alCerrar }) {
  const estado = ESTADO_INSCRIPCION[fila.estadoInscripcion];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={alCerrar} />

      <div className="animate-emerger relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 shadow-[0_45px_90px_-25px_rgba(15,23,42,0.6)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-3xl font-black text-slate-900">{fila.nombres}</h3>
            <p className="mt-2 text-xl text-slate-600">
              {fila.dni} · {fila.gradoLabel} · CAT. {fila.categoria}
            </p>
          </div>
          <span className={`rounded-full px-4 py-2 text-base font-bold ${estado.chip}`}>
            {estado.texto}
          </span>
        </div>

        {fila.observacion && (
          <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-xl text-rose-800">
            <strong>La comisión dice:</strong> {fila.observacion}
          </p>
        )}

        {fila.pago ? (
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_14rem]">
            <dl className="space-y-3">
              <Dato
                titulo="Comprobante"
                valor={`${soles(fila.pago.monto)} · ${fila.pago.metodo === 'BCP' ? 'BCP' : 'Yape'}`}
              />
              <Dato
                titulo="Enviado el"
                valor={new Date(fila.enviadoEn).toLocaleString('es-PE', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              />
              <Dato titulo="Institución" valor={fila.institucion} />
              <Dato titulo="Tutor" valor={fila.tutorNombre} />
            </dl>
            <VistaComprobante url={fila.pago.archivoUrl} alto="max-h-48" />
          </div>
        ) : (
          <p className="mt-8 text-xl text-slate-600">
            Este estudiante todavía no está en ningún comprobante. Inclúyalo desde «Seleccionar
            estudiantes».
          </p>
        )}

        <div className="mt-8 text-right">
          <button
            onClick={alCerrar}
            className="rounded-2xl px-6 py-3 text-xl font-semibold text-granate-700 transition hover:bg-granate-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Dato({ titulo, valor }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <dt className="text-base text-slate-500">{titulo}:</dt>
      <dd className="text-base font-semibold text-slate-900">{valor}</dd>
    </div>
  );
}
