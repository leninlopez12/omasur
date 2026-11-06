import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Clock, Download, DoorOpen, Search } from 'lucide-react';
import { api, descargar, mensajeError } from '../lib/api';
import { useAjustes } from '../lib/ajustes';
import { Aviso, Boton, Campo, Etiqueta, Tarjeta } from '../components/Ui.jsx';
import Logo from '../components/Logo.jsx';

/**
 * Credencial de la final macrorregional.
 *
 * Es otra página y no la de siempre porque es otra cosa: a la final llega solo
 * quien clasificó, y lo que importa aquí no es acreditar a la delegación sino
 * decirle a cada uno a qué hora entra, a qué aula y qué número hace en la
 * lista de esa aula.
 */
export default function CredencialFinal() {
  const { ajustes } = useAjustes();
  const [dni, setDni] = useState('');
  const [alumno, setAlumno] = useState(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [bajando, setBajando] = useState(false);

  const buscar = async (evento) => {
    evento.preventDefault();
    setError('');
    setAlumno(null);
    setBuscando(true);
    try {
      const { data } = await api.get('/final/credencial/consulta', { params: { dni } });
      setAlumno(data);
    } catch (e) {
      setError(mensajeError(e, 'No encontramos ese DNI entre los finalistas'));
    } finally {
      setBuscando(false);
    }
  };

  const bajar = async () => {
    setError('');
    setBajando(true);
    try {
      await descargar(`/final/credencial/dni/${dni}`, `credencial-final-${dni}.pdf`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar la credencial'));
    } finally {
      setBajando(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-granate-800">
      {ajustes.imagenHero && (
        <img
          src={ajustes.imagenHero}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className={`absolute inset-0 ${ajustes.imagenHero ? 'bg-granate-800/65' : ''}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.12),transparent_55%)]" />
      <div className="absolute -right-24 top-16 h-96 w-96 rounded-full bg-granate-600/40 blur-3xl" />
      <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-granate-500/30 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-6 py-16 lg:px-10">
        <Link to="/" className="inline-flex items-center gap-3 text-xl font-semibold text-white">
          <ArrowLeft className="h-6 w-6" />
          Volver al inicio
        </Link>

        <div className="mt-12 text-center">
          <Logo tamano="mx-auto h-16 w-16" invertido />
          <h1 className="mt-8 text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl">
            Credencial finalista
          </h1>
          <p className="mt-6 text-xl font-medium text-white">
            Final macrorregional. Ingrese su DNI para ver su aula y descargarla.
          </p>
        </div>

        <Tarjeta className="mt-12">
          <form onSubmit={buscar} className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <Campo
              etiqueta="DNI del estudiante"
              required
              inputMode="numeric"
              maxLength={8}
              placeholder="12345678"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
              className="flex-1"
            />
            <Boton type="submit" cargando={buscando}>
              <Search className="h-6 w-6" />
              Buscar
            </Boton>
          </form>

          {error && (
            <div className="mt-6">
              <Aviso tipo="error" icono={AlertCircle}>
                {error}
              </Aviso>
            </div>
          )}

          {alumno && (
            <div className="mt-8 rounded-3xl border-2 border-granate-100 bg-granate-50 p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xl text-slate-600">Finalista</p>
                  <p className="mt-1 text-3xl font-black text-granate-700">{alumno.nombres}</p>
                  <p className="mt-1 text-xl text-slate-600">DNI {alumno.dni}</p>
                </div>
                <Etiqueta className="bg-emerald-100 text-emerald-800">Clasificado</Etiqueta>
              </div>

              {/* El aula y la hora primero: es lo que hay que saber ese día. */}
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-granate-200 bg-white p-6 text-center">
                  <DoorOpen className="mx-auto h-8 w-8 text-granate-600" />
                  <p className="mt-2 text-xl text-slate-600">Aula</p>
                  <p className="text-5xl font-black text-granate-700">{alumno.salon}</p>
                  <p className="mt-2 text-xl text-slate-600">
                    N.º {alumno.puesto} en la lista del salón
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-granate-200 bg-white p-6 text-center">
                  <Clock className="mx-auto h-8 w-8 text-granate-600" />
                  <p className="mt-2 text-xl text-slate-600">{alumno.nivelTexto}</p>
                  <p className="text-3xl font-black text-granate-700">{alumno.hora}</p>
                  {alumno.fecha && <p className="mt-2 text-xl text-slate-600">{alumno.fecha}</p>}
                </div>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <Dato etiqueta="Grado" valor={`${alumno.grado} · CAT. ${alumno.categoria}`} />
                <Dato etiqueta="Institución" valor={alumno.institucion} />
                {alumno.sede && <Dato etiqueta="Sede" valor={alumno.sede} />}
              </div>

              <div className="mt-8">
                <Boton className="w-full" cargando={bajando} onClick={bajar}>
                  <Download className="h-6 w-6" />
                  Descargar credencial
                </Boton>
              </div>
            </div>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <p className="text-xl text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{valor}</p>
    </div>
  );
}
