import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  Building2,
  Crown,
  Download,
  Landmark,
  Layers,
  School,
  Sigma,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { Aviso, Boton, Cargando, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';

/**
 * El consolidado de la final: todo lo que se pregunta cuando termina el acto.
 *
 * Quién hizo el mejor examen del día, quién el de cada categoría, cómo
 * quedaron estatales y particulares por separado y qué colegio se lleva la
 * jornada. Nada está guardado: sale de los mismos puntajes que la premiación,
 * así que corregir una clave lo arrastra entero.
 */
export default function FinalConsolidado() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    api
      .get('/final/resultados/consolidado')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo armar el consolidado')));
  }, []);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Armando el consolidado" />;

  const bajar = async () => {
    setBajando(true);
    try {
      await descargar('/final/resultados/consolidado/excel');
    } finally {
      setBajando(false);
    }
  };

  const { resumen } = datos;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
              <Layers className="h-9 w-9 text-granate-600" />
              Consolidado general
            </h3>
            <p className="mt-2 text-xl text-slate-600">
              La final entera en una pantalla: el mejor examen del día, el de cada categoría,
              estatales y particulares por separado y cómo quedó cada colegio.
            </p>
          </div>
          <Boton variante="excel" cargando={bajando} onClick={bajar}>
            <Download className="h-6 w-6" />
            Descargar Excel
          </Boton>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra icono={Users} valor={resumen.rindieron} texto="Rindieron la final" />
          <Cifra icono={School} valor={resumen.delegaciones} texto="Delegaciones" />
          <Cifra icono={Layers} valor={resumen.categorias} texto="Categorías con alumnos" />
          <Cifra icono={Sigma} valor={resumen.promedio} texto="Promedio general" />
        </div>

        {resumen.salonesPendientes > 0 && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto titulo="Todavía faltan actas">
              Quedan {resumen.salonesPendientes} salón(es) por entregar. Hasta que lleguen todos,
              estos números pueden moverse.
            </Aviso>
          </div>
        )}
      </Tarjeta>

      {datos.mejorGeneral && <MejorDelDia alumno={datos.mejorGeneral} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {datos.ambitos.map((a) => (
          <TarjetaAmbito key={a.id} ambito={a} />
        ))}
      </div>

      <DiezPrimeros top={datos.top} />
      <PorCategoria categorias={datos.categorias} />
      <Colegios colegios={datos.colegios} destacados={datos.destacados} />
    </div>
  );
}

function Cifra({ icono: Icono, valor, texto }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-suave">
      <Icono className="h-7 w-7 text-granate-600" />
      <p className="mt-3 text-4xl font-black text-slate-900">{valor}</p>
      <p className="text-base text-slate-600">{texto}</p>
    </div>
  );
}

/** El mejor puntaje de toda la final, sin separar categorías ni ámbitos. */
function MejorDelDia({ alumno }) {
  return (
    <Tarjeta className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <div className="flex flex-wrap items-center gap-6">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-amber-400 text-amber-950 shadow-suave">
          <Crown className="h-11 w-11" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold uppercase tracking-widest text-amber-700">
            El mejor examen del día
          </p>
          <p className="mt-1 text-4xl font-black uppercase leading-tight text-slate-900">
            {alumno.nombres}
          </p>
          <p className="mt-2 text-xl text-slate-600">
            {alumno.institucion} · categoría {alumno.categoria} · {alumno.grado} ·{' '}
            {alumno.ambitoTexto}
          </p>
        </div>
        <Puntos valor={alumno.puntaje} grande />
      </div>
    </Tarjeta>
  );
}

function Puntos({ valor, grande = false }) {
  return (
    <p
      className={`shrink-0 font-black text-granate-600 ${grande ? 'text-6xl' : 'text-3xl'}`}
    >
      {valor}
      <span className="ml-2 text-xl font-bold uppercase tracking-widest text-granate-400">pts</span>
    </p>
  );
}

const ICONO_AMBITO = { PRIVADO: Building2, PUBLICO: Landmark };

function TarjetaAmbito({ ambito }) {
  const Icono = ICONO_AMBITO[ambito.id] || School;

  return (
    <Tarjeta className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="flex items-center gap-3 text-2xl font-black text-slate-900">
            <Icono className="h-7 w-7 text-granate-600" />
            {ambito.texto}
          </h4>
          <p className="mt-1 text-base text-slate-600">{ambito.detalle}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Dato valor={ambito.rindieron} texto="Rindieron" />
        <Dato valor={ambito.instituciones} texto="Instituciones" />
        <Dato valor={ambito.promedio} texto="Promedio" />
      </div>

      {ambito.mejor ? (
        <div className="mt-5 rounded-2xl bg-granate-50 p-5">
          <p className="text-base font-bold uppercase tracking-widest text-granate-500">
            Su mejor puntaje
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-black uppercase leading-tight text-slate-900">
                {ambito.mejor.nombres}
              </p>
              <p className="mt-1 text-base text-slate-600">
                {ambito.mejor.institucion} · categoría {ambito.mejor.categoria}
              </p>
            </div>
            <Puntos valor={ambito.mejor.puntaje} />
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-base text-slate-500">
          Todavía no rindió nadie de este ámbito.
        </p>
      )}
    </Tarjeta>
  );
}

function Dato({ valor, texto }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-2xl font-black text-slate-900">{valor}</p>
      <p className="text-base text-slate-600">{texto}</p>
    </div>
  );
}

// ----------------------------------------------------------- los diez primeros

const TABLAS = [
  { id: 'general', texto: 'General' },
  { id: 'privado', texto: 'Privado' },
  { id: 'publico', texto: 'Público' },
];

/**
 * Los diez primeros por puntaje, sin separar categorías.
 *
 * Es otra tabla que la de la premiación —ahí el puesto es dentro de la
 * categoría—, y por eso se dice en el encabezado: dos números distintos con
 * el mismo nombre confunden a cualquiera.
 */
function DiezPrimeros({ top }) {
  const [cual, setCual] = useState('general');
  const filas = top[cual] || [];

  return (
    <Tarjeta className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="flex items-center gap-3 text-2xl font-black text-slate-900">
            <Trophy className="h-7 w-7 text-granate-600" />
            Los diez primeros
          </h4>
          <p className="mt-1 text-base text-slate-600">
            Por puntaje y mezclando todas las categorías. No es el puesto de la premiación, que se
            cuenta dentro de cada categoría.
          </p>
        </div>
        <div className="flex gap-2 rounded-full bg-slate-100 p-1">
          {TABLAS.map((t) => (
            <button
              key={t.id}
              onClick={() => setCual(t.id)}
              className={`rounded-full px-5 py-2 text-base font-semibold transition ${
                cual === t.id ? 'bg-granate-600 text-white' : 'text-slate-600 hover:bg-white'
              }`}
            >
              {t.texto}
            </button>
          ))}
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-base text-slate-500">
          Todavía no hay resultados en esta tabla.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <Encabezados textos={['#', 'Estudiante', 'Institución educativa', 'Cat.', 'Puntaje']} />
            <tbody>
              {filas.map((r) => (
                <tr key={r.dni} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4">
                    <Posicion numero={r.posicion} empatado={r.empatado} />
                  </td>
                  <td className="py-3 pr-4 text-lg font-bold uppercase text-slate-900">
                    {r.nombres}
                  </td>
                  <td className="py-3 pr-4 text-base text-slate-600">{r.institucion}</td>
                  <td className="py-3 pr-4 text-base font-semibold text-slate-700">
                    {r.categoria}
                  </td>
                  <td className="py-3 text-lg font-black text-granate-600">{r.puntaje}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

function Encabezados({ textos }) {
  return (
    <thead>
      <tr className="border-b-2 border-slate-200">
        {textos.map((t) => (
          <th
            key={t}
            className="pb-2 pr-4 text-base font-bold uppercase tracking-widest text-granate-500"
          >
            {t}
          </th>
        ))}
      </tr>
    </thead>
  );
}

const COLOR_POSICION = {
  1: 'bg-amber-100 text-amber-900 ring-2 ring-amber-300',
  2: 'bg-slate-200 text-slate-800 ring-2 ring-slate-300',
  3: 'bg-orange-100 text-orange-900 ring-2 ring-orange-300',
};

function Posicion({ numero, empatado }) {
  return (
    <span
      className={`inline-flex h-11 w-11 flex-col items-center justify-center rounded-xl text-base font-black ${
        COLOR_POSICION[numero] || 'bg-granate-50 text-granate-800'
      }`}
      title={empatado ? 'Comparte la posición' : undefined}
    >
      {numero}
      {empatado && <span className="text-[0.6rem] font-bold uppercase">emp.</span>}
    </span>
  );
}

// ------------------------------------------------------------- por categoría

function PorCategoria({ categorias }) {
  return (
    <Tarjeta className="p-6">
      <h4 className="flex items-center gap-3 text-2xl font-black text-slate-900">
        <Award className="h-7 w-7 text-granate-600" />
        El mejor de cada categoría
      </h4>
      <p className="mt-1 text-base text-slate-600">
        El primer puesto de cada categoría y, dentro de ella, el primero de cada ámbito.
      </p>

      {categorias.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-base text-slate-500">
          Todavía no rindió nadie.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {categorias.map((c) => (
            <div key={c.categoria} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-granate-600 text-2xl font-black text-white">
                  {c.categoria}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-black text-slate-900">{c.grado}</p>
                  <p className="text-base text-slate-600">
                    {c.rindieron} rindieron · promedio {c.promedio}
                  </p>
                </div>
                <div className="min-w-0 flex-1 text-right sm:text-left">
                  <p className="text-base font-bold uppercase tracking-widest text-granate-500">
                    Mejor de la categoría
                  </p>
                  <p className="text-xl font-black uppercase leading-tight text-slate-900">
                    {c.mejor.nombres}
                  </p>
                  <p className="text-base text-slate-600">{c.mejor.institucion}</p>
                </div>
                <Puntos valor={c.mejor.puntaje} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MejorDeAmbito titulo="Mejor privado" alumno={c.mejorPrivado} />
                <MejorDeAmbito titulo="Mejor público" alumno={c.mejorPublico} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

function MejorDeAmbito({ titulo, alumno }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-base font-bold uppercase tracking-widest text-slate-500">{titulo}</p>
      {alumno ? (
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-base font-bold uppercase text-slate-800">
            {alumno.nombres}
          </span>
          <span className="shrink-0 text-lg font-black text-granate-600">{alumno.puntaje}</span>
        </div>
      ) : (
        <p className="mt-1 text-base text-slate-400">Nadie de este ámbito</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ colegios

const DESTACADOS = [
  ['mejorPuntaje', 'Mejor puntaje', 'El colegio del mejor examen', 'mejor', Trophy],
  ['mejorPromedio', 'Mejor promedio', 'El más parejo de arriba abajo', 'promedio', TrendingUp],
  ['masPuntos', 'Más puntos en total', 'La suma de toda su delegación', 'total', Sigma],
];

/**
 * «El colegio con mayor puntaje» son tres cosas distintas y las tres valen:
 * el del mejor examen, el más parejo y el que más suma. Se dan las tres
 * antes que elegir una por la comisión.
 */
function Colegios({ colegios, destacados }) {
  return (
    <Tarjeta className="p-6">
      <h4 className="flex items-center gap-3 text-2xl font-black text-slate-900">
        <School className="h-7 w-7 text-granate-600" />
        Las instituciones
      </h4>
      <p className="mt-1 text-base text-slate-600">
        Ordenadas por su mejor puntaje. Un promedio alto con pocos alumnos no es lo mismo que uno
        alto con treinta: por eso va al lado cuántos rindieron.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {DESTACADOS.map(([clave, titulo, detalle, campo, Icono]) => {
          const c = destacados[clave];
          if (!c) return null;
          return (
            <div
              key={clave}
              className="rounded-2xl border-2 border-granate-200 bg-granate-50 p-5"
            >
              <p className="flex items-center gap-2 text-base font-bold uppercase tracking-widest text-granate-600">
                <Icono className="h-5 w-5" />
                {titulo}
              </p>
              <p className="mt-2 text-xl font-black leading-tight text-slate-900">
                {c.institucion}
              </p>
              <p className="text-base text-slate-600">
                {c.ambitoTexto} · {c.rindieron} alumno(s)
              </p>
              <p className="mt-3 text-3xl font-black text-granate-600">{c[campo]}</p>
              <p className="text-base text-slate-500">{detalle}</p>
            </div>
          );
        })}
      </div>

      {colegios.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-base text-slate-500">
          Todavía no rindió ninguna institución.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left">
            <Encabezados
              textos={[
                'Institución educativa',
                'Ámbito',
                'Rindieron',
                'Mejor',
                'Su mejor alumno',
                'Promedio',
                'Total',
                'En el podio',
              ]}
            />
            <tbody>
              {colegios.map((c) => (
                <tr key={c.institucion} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4 text-lg font-bold text-slate-900">{c.institucion}</td>
                  <td className="py-3 pr-4 text-base text-slate-600">{c.ambitoTexto}</td>
                  <td className="py-3 pr-4 text-base text-slate-700">{c.rindieron}</td>
                  <td className="py-3 pr-4 text-lg font-black text-granate-600">{c.mejor}</td>
                  <td className="py-3 pr-4 text-base uppercase text-slate-700">
                    {c.mejorAlumno}
                    <span className="ml-2 text-slate-400">· cat. {c.mejorCategoria}</span>
                  </td>
                  <td className="py-3 pr-4 text-base text-slate-700">{c.promedio}</td>
                  <td className="py-3 pr-4 text-base text-slate-700">{c.total}</td>
                  <td className="py-3 text-base font-bold text-slate-700">{c.enPodio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}
