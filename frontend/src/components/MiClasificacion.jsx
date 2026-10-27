import { useEffect, useState } from 'react';
import { AlertCircle, Award, Trophy } from 'lucide-react';
import { Aviso, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';

/**
 * Panel del tutor · Clasificación.
 *
 * Sus estudiantes con su puntaje y si pasaron. Aparece recién cuando la
 * comisión publica la tanda en que compitió su delegación: antes de eso la
 * sección no existe en el sidebar.
 */
export default function MiClasificacion() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/resultados/mi-clasificacion')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar su clasificación')));
  }, []);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando su clasificación" />;

  if (!datos.publicado) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Clasificación</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle}>
            Los resultados de su delegación todavía no están publicados.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-granate-50">
              <Trophy className="h-8 w-8 text-granate-600" />
            </span>
            <div>
              <h3 className="text-3xl font-black text-slate-900">Clasificación</h3>
              <p className="mt-2 text-xl text-slate-600">{datos.institucion}</p>
            </div>
          </div>

          <Etiqueta className="bg-emerald-100 text-emerald-800">
            {datos.resumen.clasifican} de {datos.resumen.estudiantes}{' '}
            {datos.resumen.clasifican === 1 ? 'clasificado' : 'clasificados'}
          </Etiqueta>
        </div>
      </Tarjeta>

      {datos.categorias.map((c) => (
        <Tarjeta key={c.categoria}>
          <div className="flex flex-wrap items-baseline gap-3">
            <h4 className="text-2xl font-black text-granate-700">CAT. {c.categoria}</h4>
            <span className="text-lg text-slate-600">
              {c.grado} · {c.alumnos.length}{' '}
              {c.alumnos.length === 1 ? 'estudiante' : 'estudiantes'}
            </span>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[34rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 text-center font-semibold">Puesto</th>
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                  <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
                  <th className="px-4 py-3 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.alumnos.map((a) => (
                  <tr key={a.dni} className={a.clasifica ? 'bg-emerald-50/50' : ''}>
                    <td className="px-4 py-3 text-center text-xl font-black text-slate-500">
                      {a.puesto}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">{a.nombres}</span>
                      <span className="block text-base text-slate-500">
                        {a.dni}
                        {a.compitioEn && ` · compitió con ${a.compitioEn}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-2xl font-black text-granate-700">
                      {a.puntaje}
                    </td>
                    <td className="px-4 py-3">
                      {a.clasifica ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-base font-black text-white">
                          <Award className="h-5 w-5" />
                          Clasificó
                        </span>
                      ) : a.enEvaluacion ? (
                        <Etiqueta compacto className="bg-rose-100 text-rose-800">
                          En evaluación
                        </Etiqueta>
                      ) : (
                        <Etiqueta compacto className="bg-slate-100 text-slate-600">
                          No clasificó
                        </Etiqueta>
                      )}
                      {a.empatado && (
                        <span className="mt-1 block text-base text-amber-700">pasó por empate</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}
