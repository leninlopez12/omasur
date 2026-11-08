import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award, Search } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import { Aviso, Boton, Campo, Cargando } from '../components/Ui.jsx';
import { api, mensajeError } from '../lib/api';

/**
 * Página pública de la final macrorregional.
 *
 * El estudiante escribe su DNI y ve en qué lugar quedó. No hay listas a la
 * vista: cada uno consulta lo suyo, igual que en la etapa institucional.
 *
 * Lo que se responde es el lugar dentro de su ámbito —entre los privados o
 * entre los públicos de su categoría—, porque es como se premia: un colegio
 * estatal no compite contra un grupo de estudio. El puesto entre todos los de
 * la categoría va debajo, en letra chica, para que nadie confunda los dos
 * números.
 */
export default function ResultadosFinal() {
  const [estado, setEstado] = useState(null);
  const [dni, setDni] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    api
      .get('/final/publico')
      .then(({ data }) => setEstado(data))
      .catch(() => setEstado({ activa: false, titulo: '' }));
  }, []);

  const consultar = async (evento) => {
    evento.preventDefault();
    setError('');
    setResultado(null);

    if (!/^\d{6,12}$/.test(dni.trim())) {
      return setError('Escriba el DNI del estudiante, solo números.');
    }

    setBuscando(true);
    try {
      const { data } = await api.get('/final/consulta', { params: { dni: dni.trim() } });
      setResultado(data);
    } catch (e) {
      setError(mensajeError(e, 'No pudimos consultar ese DNI'));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(160deg,#FFF7ED_0%,#FDECEA_32%,#FBE4E8_62%,#FFF1E3_100%)]">
      {/* El mismo granate y naranja aguados de la consulta institucional: es
          la misma casa y la misma página, solo que de la otra etapa. */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute -left-40 -top-24 h-[34rem] w-[34rem] rounded-full bg-granate-400/30 blur-3xl" />
        <span className="absolute -right-40 top-20 h-[38rem] w-[38rem] rounded-full bg-orange-300/40 blur-3xl" />
        <span className="absolute -left-20 bottom-24 h-[30rem] w-[30rem] rounded-full bg-orange-200/50 blur-3xl" />
        <span className="absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-granate-300/30 blur-3xl" />
      </div>

      <div className="relative z-10">
        <Navbar />

        <main className="mx-auto max-w-5xl px-6 py-20 lg:px-10 lg:py-28">
          {!estado ? (
            <Cargando texto="Cargando" />
          ) : !estado.activa ? (
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-balance text-4xl font-black uppercase leading-tight text-granate-600 sm:text-5xl">
                Final macrorregional
              </h1>
              <div className="mt-10 text-left">
                <Aviso tipo="info">
                  La consulta de la final todavía no está habilitada. Vuelva a intentarlo más
                  tarde.
                </Aviso>
              </div>
              <Link
                to="/"
                className="mt-10 inline-flex items-center gap-2 text-xl font-bold text-granate-700 hover:underline"
              >
                <ArrowLeft className="h-6 w-6" />
                Volver al inicio
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-balance text-center text-4xl font-black uppercase leading-tight tracking-tight text-granate-600 sm:text-5xl">
                {estado.titulo}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-balance text-center text-xl text-slate-600">
                Escriba el DNI del estudiante. El lugar se cuenta dentro de su categoría y
                separando los colegios privados de los públicos, que es como se premia.
              </p>

              <form onSubmit={consultar} className="mx-auto mt-12 max-w-xl">
                <Campo
                  etiqueta="DNI del estudiante"
                  icono={Search}
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="12345678"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                />
                <div className="mt-5">
                  <Boton type="submit" tamano="grande" cargando={buscando} className="w-full">
                    Consultar resultado
                  </Boton>
                </div>
              </form>

              {error && (
                <div className="mx-auto mt-8 max-w-xl">
                  <Aviso tipo="info">{error}</Aviso>
                </div>
              )}

              <div className="mt-12 space-y-8">
                {resultado?.map((r, i) => (
                  <Ficha key={i} r={r} />
                ))}
              </div>

              <div className="mt-16 text-center">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-xl font-bold text-granate-700 hover:underline"
                >
                  <ArrowLeft className="h-6 w-6" />
                  Volver al inicio
                </Link>
              </div>
            </>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
}

/**
 * La ficha del finalista.
 *
 * Lo primero y más grande es el lugar entre los suyos; el puntaje va al lado
 * y el puesto general debajo. Quien llega aquí viene a saber en qué puesto
 * quedó, no a sumar aciertos.
 */
function Ficha({ r }) {
  const premiado = r.premiado;
  const fondo = premiado
    ? 'bg-[linear-gradient(135deg,#FFF1E3_0%,#FBE4E8_26%,#F59E0B_66%,#7B1E2B_100%)]'
    : 'bg-[linear-gradient(135deg,#FFF7ED_0%,#FBE4E8_45%,#C97B86_100%)]';

  return (
    <div
      className={`animate-emerger relative overflow-hidden rounded-[2rem] p-1.5 shadow-[0_45px_90px_-35px_rgba(15,23,42,0.55)] ${fondo}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_-10%,rgba(255,255,255,0.85),transparent_55%)]" />

      <div className="relative rounded-[1.6rem] bg-white/95 p-8 backdrop-blur sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-balance text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
              {r.nombres}
            </p>

            <dl className="mt-5 space-y-1.5 text-lg text-slate-600 sm:text-xl">
              <div className="flex flex-wrap gap-2">
                <dt className="font-semibold text-slate-800">DNI:</dt>
                <dd>{r.dni}</dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <dt className="font-semibold text-slate-800">Institución:</dt>
                <dd>
                  {r.institucion} · {r.modalidadTexto}
                </dd>
              </div>
              <div className="flex flex-wrap gap-2">
                <dt className="font-semibold text-slate-800">Categoría:</dt>
                <dd>
                  CAT. {r.categoria} · {r.grado}
                </dd>
              </div>
            </dl>
          </div>

          <div className="shrink-0 rounded-3xl bg-granate-50 px-10 py-7 text-center">
            <p className="text-6xl font-black leading-none text-granate-700 sm:text-7xl">
              {r.puntaje}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-600">puntos</p>
          </div>
        </div>

        {/* El lugar, que es a lo que se viene. */}
        <div className="mt-8 rounded-3xl bg-[linear-gradient(135deg,#FDF3F5_0%,#FBE4E8_40%,#FFE6CE_100%)] p-8 text-center">
          <p className="text-lg font-bold uppercase tracking-[0.2em] text-granate-600 sm:text-xl">
            {r.ambitoTexto} · CAT. {r.categoria}
          </p>
          <p className="mt-2 text-7xl font-black leading-none text-granate-700 sm:text-8xl">
            {r.puestoAmbito}
            <span className="align-top text-4xl sm:text-5xl">º</span>
          </p>
          <p className="mt-3 text-xl font-semibold text-slate-700 sm:text-2xl">
            {r.ambito === 'PRIVADO'
              ? 'entre los colegios privados y grupos de estudio de su categoría'
              : 'entre los colegios públicos de su categoría'}
          </p>
          <p className="mt-1 text-lg text-slate-600">
            De {r.rindieronAmbito} que rindieron en ese grupo
            {r.empatadoAmbito && ' · comparte el lugar con otro estudiante'}
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Dato valor={`${r.puesto}º`} texto={`Entre los ${r.rindieron} de su categoría`} />
          <Dato valor={r.correctas} texto="Respuestas correctas" />
          <Dato valor={r.horaEntrega || '—'} texto="Hora de entrega" />
        </div>

        {premiado && (
          <p className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-amber-500 px-6 py-4 text-center text-xl font-black uppercase tracking-wide text-white sm:text-2xl">
            <Award className="h-8 w-8" />
            Entre los premiados de su categoría
          </p>
        )}
      </div>
    </div>
  );
}

function Dato({ valor, texto }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
      <p className="text-3xl font-black leading-none text-slate-900">{valor}</p>
      <p className="mt-2 text-base text-slate-600">{texto}</p>
    </div>
  );
}
