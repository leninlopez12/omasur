import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Download, Search } from 'lucide-react';
import { api, descargar, mensajeError } from '../lib/api';
import { useAjustes } from '../lib/ajustes';
import { Aviso, Boton, Campo, Etiqueta, Tarjeta } from '../components/Ui.jsx';
import Logo from '../components/Logo.jsx';

export default function Credencial() {
  const { ajustes } = useAjustes();
  const [dni, setDni] = useState('');
  const [alumno, setAlumno] = useState(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const buscar = async (evento) => {
    evento.preventDefault();
    setError('');
    setAlumno(null);
    setBuscando(true);
    try {
      const { data } = await api.get(`/credenciales/consulta/${dni}`);
      setAlumno(data);
    } catch (e) {
      setError(mensajeError(e, 'No encontramos ese DNI'));
    } finally {
      setBuscando(false);
    }
  };

  const bajarPdf = async () => {
    setError('');
    setDescargando(true);
    try {
      await descargar(`/credenciales/dni/${dni}`, `credencial-${dni}.pdf`);
    } catch {
      setError('La inscripción de su institución aún no ha sido aprobada');
    } finally {
      setDescargando(false);
    }
  };

  return (
    // `relative` para que la imagen y los velos se recorten dentro de la página
    // y no contra la ventana.
    <div className="relative min-h-screen overflow-hidden bg-granate-800">
      {/* La misma imagen de la portada, para que las dos pantallas se vean de la misma casa. */}
      {ajustes.imagenHero && (
        <img
          src={ajustes.imagenHero}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Velo granate: mantiene el color institucional y la letra legible sobre la foto. */}
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
          {/* En celular no cabe más de 5xl: "CREDENCIAL" se salía de la pantalla. */}
          <h1 className="mt-8 text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
            Mi credencial
          </h1>
          {/* Blanco y no granate-100: con el velo más bajo, el rosado se perdía sobre la foto. */}
          <p className="mt-6 text-xl font-medium text-white">Ingrese su DNI para descargarla.</p>
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
                  <p className="text-xl text-slate-600">DNI</p>
                  <p className="mt-1 text-3xl font-black text-granate-700">{alumno.dni}</p>
                </div>
                <Etiqueta className="bg-emerald-100 text-emerald-800">Habilitada</Etiqueta>
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <Dato etiqueta="Estudiante" valor={alumno.nombres} />
                <Dato etiqueta="Grado" valor={`${alumno.grado} · CAT. ${alumno.categoria}`} />
                <Dato etiqueta="Institución" valor={alumno.institucion} />
              </div>

              <div className="mt-8">
                <Boton className="w-full" cargando={descargando} onClick={bajarPdf}>
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
