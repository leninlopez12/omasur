import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import { Aviso, Boton, Campo, Cargando } from '../components/Ui.jsx';
import { api, mensajeError } from '../lib/api';

const ICONO_CLASIFICA = '/api/publico/iconos/check.png';
const ICONO_NO_CLASIFICA = '/api/publico/iconos/error.png';

/**
 * Página pública de resultados.
 *
 * Una sola cosa: el estudiante escribe su DNI y ve cómo le fue. No hay lista
 * de clasificados a la vista —eso vive en la cuenta de cada tutor—, así que
 * nadie puede hojear los puntajes de los demás.
 */
export default function ResultadosEtapa() {
  const [estado, setEstado] = useState(null);
  const [dni, setDni] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    api
      .get('/resultados/publico')
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
      const { data } = await api.get('/resultados/consulta', { params: { dni: dni.trim() } });
      setResultado(data);
    } catch (e) {
      setError(mensajeError(e, 'No pudimos consultar ese DNI'));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(160deg,#FFF7ED_0%,#FDECEA_32%,#FBE4E8_62%,#FFF1E3_100%)]">
      {/* Granate y naranja aguados, desenfocados de lado a lado: dan el color
          de la casa sin robarle contraste a la ficha, que va en blanco. */}
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
              Resultados
            </h1>
            <div className="mt-10 text-left">
              <Aviso tipo="info">
                La consulta de resultados todavía no está habilitada. Vuelva a intentarlo más
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
 * La ficha del estudiante.
 *
 * El color dice el resultado antes de leer nada: celeste, granate y naranja
 * para quien pasó, gris parejo para quien no. Así nadie confunde una cosa con
 * la otra de un vistazo.
 */
function Ficha({ r }) {
  const fondo = r.clasifica
    ? 'bg-[linear-gradient(135deg,#E0F2FE_0%,#A5DBFB_24%,#F59E0B_68%,#7B1E2B_100%)]'
    : 'bg-[linear-gradient(135deg,#F8FAFC_0%,#E2E8F0_45%,#94A3B8_100%)]';

  return (
    <div
      className={`animate-emerger relative overflow-hidden rounded-[2rem] p-1.5 shadow-[0_45px_90px_-35px_rgba(15,23,42,0.55)] ${fondo}`}
    >
      {/* El brillo de arriba es lo que le da el relieve al contenedor. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_-10%,rgba(255,255,255,0.85),transparent_55%)]" />

      <div className="relative rounded-[1.6rem] bg-white/95 p-8 backdrop-blur sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-6">
            <img
              src={r.clasifica ? ICONO_CLASIFICA : ICONO_NO_CLASIFICA}
              alt=""
              className="h-24 w-24 shrink-0 object-contain [filter:drop-shadow(0_16px_22px_rgba(15,23,42,0.35))] sm:h-28 sm:w-28"
            />

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
                  <dd>{r.institucion}</dd>
                </div>
                <div className="flex flex-wrap gap-2">
                  <dt className="font-semibold text-slate-800">Categoría:</dt>
                  <dd>
                    CAT. {r.categoria} · {r.grado}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div
            className={`shrink-0 rounded-3xl px-10 py-7 text-center ${
              r.clasifica ? 'bg-granate-50' : 'bg-slate-100'
            }`}
          >
            <p
              className={`text-6xl font-black leading-none sm:text-7xl ${
                r.clasifica ? 'text-granate-700' : 'text-slate-500'
              }`}
            >
              {r.puntaje}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-600">puntos</p>
          </div>
        </div>

        <p
          className={`mt-8 rounded-2xl px-6 py-4 text-center text-xl font-black uppercase tracking-wide sm:text-2xl ${
            r.clasifica ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {r.clasifica ? 'Clasificó a la etapa macrorregional' : 'No clasificó en esta etapa'}
        </p>
      </div>
    </div>
  );
}
