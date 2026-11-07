import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, Mail, Phone, Search, UserCheck } from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';

const sinTildes = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Final · Credenciales de tutores.
 *
 * El tutor entra a la sede con su delegación, así que le toca credencial igual
 * que a sus alumnos. La suya no lleva aula —va con los suyos— pero sí los
 * salones de su gente y el turno al que tiene que estar.
 *
 * Se baja en bloque para repartir en la mesa, o una institución a la vez
 * cuando alguien la pide por teléfono.
 */
export default function FinalCredencialesTutores() {
  const [tutores, setTutores] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/credencial/tutores');
      setTutores(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const termino = sinTildes(busqueda);
  const filtrados = useMemo(
    () =>
      (tutores || []).filter(
        (t) => !termino || sinTildes(`${t.institucion} ${t.nombres} ${t.dni}`).includes(termino),
      ),
    [tutores, termino],
  );

  if (error && !tutores) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!tutores) return <Cargando texto="Buscando a los tutores de la final" />;

  const bajar = async (clave, params, nombre) => {
    setError('');
    setBajando(clave);
    try {
      const query = new URLSearchParams(params).toString();
      await descargar(`/final/credencial/tutores/pdf${query ? `?${query}` : ''}`, nombre);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setBajando('');
    }
  };

  if (tutores.length === 0) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Credenciales de tutores</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay tutores con finalistas sentados. Arme el reparto en Salones y horarios.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <UserCheck className="h-9 w-9 text-granate-600" />
          Credenciales de tutores
        </h3>
        <p className="mt-2 text-xl text-slate-600">
          La del tutor lleva el mismo diseño que la de sus alumnos: en vez del aula dice TUTOR, y
          abajo los salones donde está su gente y el turno al que debe estar.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Dato numero={tutores.length} texto="tutores con finalistas" />
          <Dato
            numero={tutores.reduce((n, t) => n + t.finalistas, 0)}
            texto="finalistas que acompañan"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[20rem] flex-1">
            <Campo
              etiqueta="Buscar por institución, tutor o DNI"
              icono={Search}
              placeholder="Institución, tutor o DNI"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Boton
            variante="primario"
            cargando={bajando === 'todas'}
            onClick={() => bajar('todas', {}, 'credenciales-tutores.pdf')}
          >
            <Download className="h-6 w-6" />
            Las {tutores.length} en bloque
          </Boton>
          {termino.length >= 2 && filtrados.length > 0 && (
            <Boton
              variante="contorno"
              cargando={bajando === 'filtradas'}
              onClick={() => bajar('filtradas', { q: busqueda.trim() }, 'credenciales-tutores.pdf')}
            >
              <Download className="h-6 w-6" />
              Las {filtrados.length} de la búsqueda
            </Boton>
          )}
        </div>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      <Tarjeta>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-xl font-black text-slate-900">Uno por uno</h4>
          <p className="text-base text-slate-500">
            {filtrados.length === tutores.length
              ? `${tutores.length} tutores`
              : `${filtrados.length} de ${tutores.length}`}
          </p>
        </div>

        {filtrados.length === 0 ? (
          <div className="mt-6">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              Ningún tutor coincide con «{busqueda}».
            </Aviso>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[48rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Institución y tutor</th>
                  <th className="px-4 py-3 text-center font-semibold">Finalistas</th>
                  <th className="px-4 py-3 font-semibold">Aulas y turno</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((t) => (
                  <tr key={t.tutorId}>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">
                        {t.institucion || 'Sin institución'}
                      </span>
                      <span className="block text-base text-slate-600">{t.nombres}</span>
                      <span className="mt-1 flex flex-wrap gap-3 text-base text-slate-500">
                        {t.celular && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {t.celular}
                          </span>
                        )}
                        {t.correo && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {t.correo}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {t.finalistas}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-base font-semibold text-slate-900">
                        {t.salones.join(', ')}
                      </span>
                      <Etiqueta compacto className="mt-1 bg-granate-50 text-granate-700">
                        {t.turnos}
                      </Etiqueta>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Boton
                        variante="contorno"
                        tamano="chico"
                        cargando={bajando === t.tutorId}
                        onClick={() =>
                          bajar(
                            t.tutorId,
                            { tutorId: t.tutorId },
                            `credencial-tutor-${t.dni || t.tutorId}.pdf`,
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
        )}
      </Tarjeta>
    </div>
  );
}

function Dato({ numero, texto }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 p-5">
      <p className="text-3xl font-black text-slate-900">{numero}</p>
      <p className="text-base text-slate-600">{texto}</p>
    </div>
  );
}
