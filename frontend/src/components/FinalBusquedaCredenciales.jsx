import { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Download,
  Mail,
  Phone,
  Search,
  Users,
} from 'lucide-react';
import { Aviso, Boton, Campo, Etiqueta, Tarjeta } from './Ui.jsx';
import { NIVEL } from './FinalSalones.jsx';
import { api, descargar, mensajeError } from '../lib/api';

/**
 * Final · Búsqueda de credenciales.
 *
 * Para atender al que llama. Casi siempre es un tutor que no puede entrar a su
 * cuenta y necesita que le manden las credenciales de su delegación; a veces
 * es por un alumno suelto. Se busca por colegio, por tutor o por el alumno,
 * se baja lo que haga falta y se le avisa por su panel.
 */
export default function FinalBusquedaCredenciales() {
  const [texto, setTexto] = useState('');
  const [encontrado, setEncontrado] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [procesando, setProcesando] = useState('');

  const buscar = async (evento) => {
    evento.preventDefault();
    setError('');
    setAviso('');
    setEncontrado(null);

    if (texto.trim().length < 2) {
      return setError('Escriba al menos dos letras, o el DNI del estudiante.');
    }

    setBuscando(true);
    try {
      const { data } = await api.get('/final/credencial/buscar', { params: { q: texto.trim() } });
      setEncontrado(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo buscar'));
    } finally {
      setBuscando(false);
    }
  };

  const bajar = async (clave, ruta, nombre) => {
    setError('');
    setProcesando(clave);
    try {
      await descargar(ruta, nombre);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setProcesando('');
    }
  };

  const avisar = async (d) => {
    setError('');
    setAviso('');
    setProcesando(`avisar-${d.tutorId}`);
    try {
      const { data } = await api.post(`/final/credencial/avisar/${d.tutorId}`);
      setAviso(
        `Aviso enviado a ${data.institucion || d.institucion}: le aparece en su campanita.`,
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo avisar'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <Search className="h-9 w-9 text-granate-600" />
          Búsqueda de credenciales
        </h3>
        <p className="mt-2 text-xl text-slate-600">
          Busque por colegio, tutor, nombre del estudiante o DNI. Baje sus credenciales para
          mandárselas, o avísele por su panel de que ya puede descargarlas él mismo.
        </p>

        <form onSubmit={buscar} className="mt-8 flex flex-wrap items-end gap-3">
          <div className="min-w-[20rem] flex-1">
            <Campo
              etiqueta="Buscar"
              icono={Search}
              placeholder="Colegio, tutor, estudiante o DNI"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <Boton type="submit" cargando={buscando}>
            Buscar
          </Boton>
        </form>
      </Tarjeta>

      {aviso && (
        <Aviso tipo="exito" icono={CheckCircle2}>
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      {encontrado && encontrado.length === 0 && (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Nadie entre los finalistas coincide con «{texto}». Recuerde que solo están los que
            clasificaron y ya tienen aula asignada.
          </Aviso>
        </Tarjeta>
      )}

      {encontrado?.map((d) => (
        <Tarjeta key={d.tutorId}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h4 className="text-2xl font-black text-slate-900">{d.institucion}</h4>
              <p className="mt-1 text-base text-slate-600">{d.tutor}</p>
              <p className="mt-1 flex flex-wrap items-center gap-4 text-base text-slate-600">
                {d.celular && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-5 w-5" />
                    {d.celular}
                  </span>
                )}
                {d.correo && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-5 w-5" />
                    {d.correo}
                  </span>
                )}
              </p>
            </div>

            <div className="text-right">
              <p className="text-3xl font-black text-granate-700">{d.total}</p>
              <p className="text-base text-slate-600">
                {d.total === 1 ? 'finalista' : 'finalistas'}
              </p>
            </div>
          </div>

          {!d.porDelegacion && (
            <div className="mt-5">
              <Aviso tipo="info" icono={AlertCircle} compacto>
                La búsqueda dio con {d.finalistas.length} de sus {d.total} finalistas. El PDF de
                la delegación trae a todos.
              </Aviso>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Boton
              cargando={procesando === `pdf-${d.tutorId}`}
              onClick={() =>
                bajar(
                  `pdf-${d.tutorId}`,
                  `/final/credencial/delegacion/${d.tutorId}`,
                  `credenciales-${d.institucion || 'delegacion'}.pdf`,
                )
              }
            >
              <Download className="h-6 w-6" />
              Las {d.total} de la delegación
            </Boton>
            <Boton
              variante="contorno"
              cargando={procesando === `avisar-${d.tutorId}`}
              onClick={() => avisar(d)}
            >
              <Bell className="h-6 w-6" />
              Avisarle por su panel
            </Boton>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[46rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                  <th className="px-4 py-3 text-center font-semibold">Aula</th>
                  <th className="px-4 py-3 text-center font-semibold">N.º</th>
                  <th className="px-4 py-3 font-semibold">Turno y hora</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.finalistas.map((f) => (
                  <tr key={f.dni}>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">{f.nombres}</span>
                      <span className="block text-base text-slate-500">
                        {f.dni} · CAT. {f.categoria} · {f.grado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {f.salon}
                    </td>
                    <td className="px-4 py-3 text-center text-base">{f.puesto}</td>
                    <td className="px-4 py-3">
                      <Etiqueta compacto className="bg-granate-50 text-granate-700">
                        {NIVEL[f.nivel]}
                      </Etiqueta>
                      <span className="mt-1 block text-base text-slate-600">{f.hora}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Boton
                        variante="contorno"
                        tamano="chico"
                        cargando={procesando === `dni-${f.dni}`}
                        onClick={() =>
                          bajar(
                            `dni-${f.dni}`,
                            `/final/credencial/alumno/${f.dni}`,
                            `credencial-${f.dni}.pdf`,
                          )
                        }
                      >
                        <Download className="h-5 w-5" />
                        Solo esta
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ))}

      {!encontrado && (
        <Tarjeta>
          <p className="flex items-start gap-3 text-base text-slate-600">
            <Users className="h-6 w-6 shrink-0 text-granate-600" />
            El aviso por el panel solo se puede mandar cuando las credenciales están abiertas: si
            están cerradas, el tutor vería el aviso y no podría descargar nada.
          </p>
        </Tarjeta>
      )}
    </div>
  );
}
