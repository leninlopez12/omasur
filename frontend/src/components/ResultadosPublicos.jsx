import { useEffect, useState } from 'react';
import { Award, Search } from 'lucide-react';
import { Aviso, Boton, Campo, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';

/**
 * Lo que va bajo el hero cuando ya hay resultados.
 *
 * Arriba va una sola línea —el título que escribe la comisión— y debajo los
 * clasificados, agrupados como se haya configurado. La consulta por DNI es
 * independiente: puede estar apagada aunque la lista esté publicada.
 */
export default function ResultadosPublicos() {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    api
      .get('/resultados/publicos')
      .then(({ data }) => setDatos(data))
      .catch(() => setDatos(null));
  }, []);

  if (!datos) return null;
  if (!datos.hayAlgo && !datos.consultaActiva) return null;

  return (
    <section id="resultados" className="border-y border-slate-100 bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <h2 className="text-balance text-center text-4xl font-black uppercase leading-tight tracking-tight text-granate-600 sm:text-5xl">
          {datos.titulo}
        </h2>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {datos.hayAlgo && (
            <div className={`space-y-8 ${datos.consultaActiva ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              {datos.bloques.map((b) => (
                <Tarjeta key={b.llave}>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h3 className="text-2xl font-black text-granate-700">{b.titulo}</h3>
                    {b.detalle && <span className="text-lg text-slate-600">{b.detalle}</span>}
                  </div>

                  <ul className="mt-6 divide-y divide-slate-100">
                    {b.alumnos.map((a, i) => (
                      <li key={`${a.nombres}-${i}`} className="flex items-center gap-4 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-granate-50 text-base font-black text-granate-700">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xl font-bold text-slate-900">{a.nombres}</p>
                          <p className="text-base text-slate-600">{a.detalle}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
              ))}
            </div>
          )}

          {datos.consultaActiva && <ConsultaPuntaje sola={!datos.hayAlgo} />}
        </div>
      </div>
    </section>
  );
}

/** Cualquiera puede ver su puntaje con su DNI, haya pasado o no. */
function ConsultaPuntaje({ sola }) {
  const [dni, setDni] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);

  const consultar = async (evento) => {
    evento.preventDefault();
    setError('');
    setResultado(null);

    if (!/^\d{6,12}$/.test(dni.trim())) {
      return setError('Escriba el DNI del estudiante, solo números.');
    }

    setBuscando(true);
    try {
      const { data } = await api.get('/resultados/consulta', { params: { dni: dni.trim() } });
      setResultado(data);
    } catch (e) {
      setError(mensajeError(e, 'No pudimos consultar ese DNI'));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className={sola ? 'lg:col-span-3 lg:mx-auto lg:w-full lg:max-w-xl' : ''}>
      <Tarjeta className="h-fit lg:sticky lg:top-28">
        <h3 className="text-2xl font-black text-slate-900">Consulte su puntaje</h3>
        <p className="mt-2 text-lg text-slate-600">
          Con el DNI del estudiante. Aparece aunque no haya clasificado.
        </p>

        <form onSubmit={consultar} className="mt-6 space-y-4">
          <Campo
            etiqueta="DNI del estudiante"
            icono={Search}
            inputMode="numeric"
            maxLength={12}
            placeholder="12345678"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
          />
          <Boton type="submit" cargando={buscando} className="w-full">
            Ver mi puntaje
          </Boton>
        </form>

        {error && (
          <div className="mt-5">
            <Aviso tipo="info" compacto>
              {error}
            </Aviso>
          </div>
        )}

        {resultado?.map((r, i) => (
          <div
            key={i}
            className={`mt-5 rounded-2xl border-2 p-5 ${
              r.clasifica ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <p className="text-xl font-black text-slate-900">{r.nombres}</p>
            <p className="mt-1 text-base text-slate-600">
              {r.institucion} · CAT. {r.categoria} · {r.grado}
            </p>

            <p className="mt-4 text-5xl font-black text-granate-700">{r.puntaje}</p>
            <p className="text-base text-slate-600">puntos · puesto {r.puesto} en su delegación</p>

            <p
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-black ${
                r.clasifica ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {r.clasifica && <Award className="h-5 w-5" />}
              {r.clasifica ? 'Clasificó a la etapa macrorregional' : 'No clasificó en esta etapa'}
            </p>
          </div>
        ))}
      </Tarjeta>
    </div>
  );
}
