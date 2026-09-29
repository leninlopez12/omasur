import { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Aviso, Cargando } from './Ui.jsx';
import TablaInscripciones, { ESTADO_INSCRIPCION } from './TablaInscripciones.jsx';
import { api, mensajeError } from '../lib/api';

/**
 * Panel del supervisor > Revisar inscripciones.
 *
 * Un alumno por fila, con su tutor y su comprobante. La decisión sigue siendo
 * por delegación —así lo exige el pago—, así que «Revisar» abre la pantalla
 * de la delegación a la que pertenece ese alumno.
 */
export default function RevisarAlumnos({ alAbrirTutor }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const { data } = await api.get('/admin/revisar');
    setFilas(data);
  }, []);

  useEffect(() => {
    cargar().catch((e) => setError(mensajeError(e, 'No se pudo cargar la revisión')));
  }, [cargar]);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!filas) return <Cargando texto="Cargando las inscripciones" />;

  const cuenta = (clave) => filas.filter((f) => f.estadoInscripcion === clave).length;
  const pendientes = cuenta('EN_REVISION');

  return (
    <div className="space-y-6">
      {pendientes > 0 && (
        <Aviso tipo="alerta" icono={AlertCircle} titulo={`${pendientes} esperando revisión`}>
          Abra «Revisar» en cualquiera de ellos para ver el comprobante y decidir.
        </Aviso>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(ESTADO_INSCRIPCION).map(([clave, conf]) => (
          <div key={clave} className="rounded-2xl border-2 border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 shrink-0 rounded-full ${conf.punto}`} />
              <p className="text-3xl font-black text-slate-900">{cuenta(clave)}</p>
            </div>
            <p className="mt-1 text-base text-slate-600">{conf.texto}</p>
          </div>
        ))}
      </div>

      <TablaInscripciones
        filas={filas}
        conTutor
        textoAccion="Revisar"
        alAbrir={(fila) => alAbrirTutor(fila.tutorId)}
        vacio="Ningún estudiante coincide con esos filtros."
      />
    </div>
  );
}
