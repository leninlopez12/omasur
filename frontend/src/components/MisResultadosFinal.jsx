import { useEffect, useState } from 'react';
import { AlertCircle, Award, Crown, FileSpreadsheet, Medal, School, Trophy } from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';

/** Cómo se nombra al grupo del colegio, que es la columna que más miran. */
const plural = (ambitoTexto) => (ambitoTexto === 'Privado' ? 'privados' : 'públicos');

/**
 * Panel del tutor · Resultados de la final macrorregional.
 *
 * Sus finalistas con el puntaje y los dos puestos de cada uno: el de su
 * categoría entre todos —el que se nombró en el acto— y el de su categoría
 * entre los colegios de su misma modalidad, que es con quienes de verdad se
 * compara. Los dos juntos y con «de cuántos» al lado, porque sueltos se
 * confunden y la llamada de después es para preguntar por el otro.
 *
 * Aparece recién cuando la comisión publica: antes de eso la sección no
 * existe en el sidebar.
 */
export default function MisResultadosFinal() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    api
      .get('/final/mi-delegacion')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudieron cargar sus resultados')));
  }, []);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando los resultados de la final" />;

  if (!datos.publicado) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Resultados de la final</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle}>
            Los resultados de la final macrorregional todavía no están publicados.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  if (!datos.resumen) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Resultados de la final</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle}>
            Su delegación no tiene estudiantes en la final macrorregional.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  const bajar = async () => {
    setError('');
    setBajando(true);
    try {
      await descargar('/final/mi-delegacion/excel');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setBajando(false);
    }
  };

  const { resumen } = datos;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50">
              <Crown className="h-8 w-8 text-amber-500" />
            </span>
            <div className="min-w-0">
              <h3 className="text-3xl font-black text-slate-900">{datos.titulo}</h3>
              <p className="mt-2 text-xl text-slate-600">
                {datos.institucion}
                {datos.modalidadTexto && ` · ${datos.modalidadTexto}`}
              </p>
            </div>
          </div>

          <Etiqueta className="bg-amber-100 text-amber-900">
            {resumen.premiados} {resumen.premiados === 1 ? 'premiado' : 'premiados'}
          </Etiqueta>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Cifra icono={School} valor={resumen.rindieron} texto="Rindieron la final" />
          <Cifra icono={Medal} valor={resumen.categorias} texto="Categorías en las que compitió" />
          <Cifra
            icono={Trophy}
            valor={`${resumen.mejor.puesto}º`}
            texto={`Su mejor puesto · CAT. ${resumen.mejor.categoria}`}
          />
        </div>

        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto titulo="Los dos puestos de cada uno">
            Cada estudiante tiene el puesto de su categoría entre todos los que rindieron —el que
            se nombró en el acto— y el puesto de su categoría entre los colegios{' '}
            {plural(datos.ambitoTexto)}, que es el grupo en que compite el suyo. Los dos están en
            la tabla. Premiado es el que quedó entre los {datos.puestos} primeros de su categoría.
          </Aviso>
        </div>

        {error && (
          <div className="mt-5">
            <Aviso tipo="error" icono={AlertCircle} compacto>
              {error}
            </Aviso>
          </div>
        )}

        <div className="mt-6">
          <Boton variante="excel" onClick={bajar} cargando={bajando}>
            <FileSpreadsheet className="h-6 w-6" />
            Descargar en Excel
          </Boton>
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

          <Tabla alumnos={c.alumnos} ambitoTexto={datos.ambitoTexto} />
        </Tarjeta>
      ))}
    </div>
  );
}

/** La tabla de una categoría, con el puesto general y el de su modalidad. */
function Tabla({ alumnos, ambitoTexto }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
      <table className="w-full min-w-[46rem] text-left">
        <thead className="bg-slate-50">
          <tr className="text-base text-slate-500">
            <th className="px-4 py-3 font-semibold">Estudiante</th>
            <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
            <th className="px-4 py-3 text-center font-semibold">
              Puesto entre los {plural(ambitoTexto)}
            </th>
            <th className="px-4 py-3 text-center font-semibold">En toda la categoría</th>
            <th className="px-4 py-3 font-semibold">Premiación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {alumnos.map((a) => (
            <tr key={a.dni} className={a.premiado ? 'bg-amber-50/60' : ''}>
              <td className="px-4 py-3">
                <span className="block text-base font-bold text-slate-900">{a.nombres}</span>
                <span className="block text-base text-slate-500">{a.dni}</span>
              </td>
              <td className="px-4 py-3 text-center text-2xl font-black text-granate-700">
                {a.puntaje}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-2xl font-black text-slate-900">{a.puestoAmbito}º</span>
                <span className="mt-0.5 block text-base text-slate-500">
                  de {a.rindieronAmbito}
                  {a.empatadoAmbito && ' · empate'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-xl font-black text-slate-600">{a.puesto}º</span>
                <span className="mt-0.5 block text-base text-slate-500">
                  de {a.rindieron}
                  {a.empatado && ' · empate'}
                </span>
              </td>
              <td className="px-4 py-3">
                {a.premiado ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1 text-base font-black text-white">
                    <Award className="h-5 w-5" />
                    Premiado
                  </span>
                ) : (
                  <Etiqueta compacto className="bg-slate-100 text-slate-600">
                    Participó
                  </Etiqueta>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cifra({ icono: Icono, valor, texto }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-5 py-4">
      <div className="flex items-center gap-3">
        <Icono className="h-7 w-7 shrink-0 text-granate-600" />
        <span className="text-3xl font-black leading-none text-slate-900">{valor}</span>
      </div>
      <p className="mt-2 text-base text-slate-600">{texto}</p>
    </div>
  );
}

/**
 * La ventana que recibe al tutor cuando se publica la final.
 *
 * Trae la tabla dentro, no solo el aviso: el tutor entra a ver cómo le fue y
 * lo primero que pide es la lista de sus alumnos con el puesto. Sale una vez
 * por publicación —si la comisión vuelve a publicar porque corrigió algo,
 * aparece de nuevo— y nunca insiste al día siguiente con lo mismo.
 */
export function AvisoResultadosFinal({ datos, alIr }) {
  const [cerrado, setCerrado] = useState(false);
  const [bajando, setBajando] = useState(false);

  const publicadoEn = datos?.publicadoEn;
  // La fecha llega después de la primera pintada, así que la memoria se
  // consulta en cada una: guardarla al montar la leería con la clave vacía.
  if (!datos?.publicado || !datos.resumen || !publicadoEn || cerrado) return null;

  const memoria = `omasur_final_resultados_${publicadoEn}`;
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

  const bajar = async () => {
    setBajando(true);
    try {
      await descargar('/final/mi-delegacion/excel');
    } catch {
      /* el detalle del error se ve en la sección, con su aviso */
    } finally {
      setBajando(false);
    }
  };

  const alumnos = datos.categorias.flatMap((c) => c.alumnos);
  const grupo = plural(datos.ambitoTexto);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={cerrar} />

      <div className="animate-emerger relative my-auto w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_45px_90px_-25px_rgba(15,23,42,0.6)] ring-1 ring-amber-200">
        <div className="relative bg-[linear-gradient(145deg,#FFF7ED_0%,#FDE68A_35%,#F59E0B_70%,#7B1E2B_100%)] px-6 py-8 text-center sm:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_0%,rgba(255,255,255,0.78),transparent_55%)]" />

          <span className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/85 shadow-[0_14px_28px_-12px_rgba(15,23,42,0.55)]">
            <Crown className="h-12 w-12 text-amber-600" />
          </span>

          <h2 className="relative mt-5 text-balance text-2xl font-black uppercase leading-tight tracking-tight text-slate-900 sm:text-3xl">
            {datos.titulo}
          </h2>
          <p className="relative mt-2 text-lg font-semibold text-slate-800">
            {datos.institucion}
            {datos.modalidadTexto && ` · ${datos.modalidadTexto}`}
          </p>
        </div>

        <div className="px-5 py-7 sm:px-9">
          <p className="text-center text-lg text-slate-700 sm:text-xl">
            Sus {datos.resumen.rindieron}{' '}
            {datos.resumen.rindieron === 1 ? 'estudiante' : 'estudiantes'} que rindieron la final,
            con su puesto entre los colegios {grupo} de su categoría y entre todos los de su
            categoría.
          </p>

          <div className="mt-6 max-h-[22rem] overflow-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                  <th className="px-4 py-3 text-center font-semibold">Cat.</th>
                  <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Entre los {grupo}
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">En su categoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alumnos.map((a) => (
                  <tr key={`${a.categoria}-${a.dni}`} className={a.premiado ? 'bg-amber-50/60' : ''}>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">{a.nombres}</span>
                      <span className="block text-base text-slate-500">
                        {a.dni}
                        {a.premiado && ' · premiado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-base font-black text-granate-700">
                      {a.categoria}
                    </td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {a.puntaje}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xl font-black text-slate-900">{a.puestoAmbito}º</span>
                      <span className="block text-base text-slate-500">
                        de {a.rindieronAmbito}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-lg font-black text-slate-600">{a.puesto}º</span>
                      <span className="block text-base text-slate-500">de {a.rindieron}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Boton
              onClick={() => {
                cerrar();
                alIr();
              }}
            >
              <Trophy className="h-6 w-6" />
              Ver el detalle completo
            </Boton>
            <Boton variante="excelContorno" onClick={bajar} cargando={bajando}>
              <FileSpreadsheet className="h-6 w-6" />
              Descargar en Excel
            </Boton>
          </div>

          <button
            onClick={cerrar}
            className="mt-5 block w-full text-lg font-semibold text-slate-500 transition hover:text-slate-700"
          >
            Después
          </button>
        </div>
      </div>
    </div>
  );
}
