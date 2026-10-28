import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, Eye, EyeOff, IdCard, Search, Users } from 'lucide-react';
import { Aviso, Boton, Cargando, Selector, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';

const ETIQUETA_MODALIDAD = {
  ESTATAL: 'Institución estatal',
  PARTICULAR: 'Institución particular',
  GRUPO_ESTUDIO: 'Grupo de estudio',
};

/**
 * Credenciales que baja la comisión para enviárselas al tutor.
 *
 * No todos los tutores se manejan con el panel: esta pantalla permite que el
 * supervisor les arme el PDF y se lo mande por interno. Son los mismos
 * archivos que el tutor vería en su panel, no una versión aparte.
 *
 * `modo` decide qué se baja: las de los alumnos de la delegación o la del
 * propio tutor.
 */
export default function CredencialesComision({ modo = 'delegaciones' }) {
  const deAlumnos = modo === 'delegaciones';

  const [filas, setFilas] = useState(null);
  const [etapas, setEtapas] = useState(null);
  const [etapa, setEtapa] = useState('');
  const [buscar, setBuscar] = useState('');
  const [bajando, setBajando] = useState('');
  const [error, setError] = useState('');
  const [publica, setPublica] = useState(null);
  const [cambiando, setCambiando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [lista, publicadas] = await Promise.all([
        api.get('/credenciales/delegaciones'),
        api.get('/credenciales/etapas'),
      ]);
      setFilas(lista.data);
      setEtapas(publicadas.data);
      if (deAlumnos) {
        const { data } = await api.get('/credenciales/publica');
        setPublica(data.activa);
      }
      if (publicadas.data.length) setEtapa(publicadas.data[publicadas.data.length - 1].clave);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar las delegaciones'));
      setFilas([]);
      setEtapas([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !filas) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!filas || !etapas) return <Cargando texto="Cargando las delegaciones aprobadas" />;

  const bajar = async (clave, ruta, nombre) => {
    setError('');
    setBajando(clave);
    try {
      await descargar(`${ruta}?etapa=${etapa}`, nombre);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo generar el PDF'));
    } finally {
      setBajando('');
    }
  };

  const texto = buscar.trim().toLowerCase();
  const visibles = filas.filter(
    (f) =>
      !texto ||
      f.institucion.toLowerCase().includes(texto) ||
      f.tutor.toLowerCase().includes(texto) ||
      (f.dni || '').includes(texto),
  );

  const nombreArchivo = (fila) =>
    `${deAlumnos ? 'credenciales' : 'credencial-tutor'}-${fila.institucion
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}.pdf`;

  const cambiarPublica = async (activa) => {
    setError('');
    setCambiando(true);
    try {
      const { data } = await api.post('/credenciales/publica', { activa });
      setPublica(data.activa);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cambiar la credencial pública'));
    } finally {
      setCambiando(false);
    }
  };

  return (
    <div className="space-y-8">
      {deAlumnos && publica !== null && (
        <Tarjeta>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                  publica ? 'bg-emerald-50' : 'bg-slate-100'
                }`}
              >
                {publica ? (
                  <Eye className="h-7 w-7 text-emerald-700" />
                ) : (
                  <EyeOff className="h-7 w-7 text-slate-500" />
                )}
              </span>
              <div>
                <h3 className="text-2xl font-black text-slate-900">Credencial en la portada</h3>
                <p className="mt-1 text-base text-slate-600">
                  Abre el botón «Mi credencial» de la portada. La baja únicamente quien clasificó
                  a la siguiente etapa; al resto se le avisa que no clasificó.
                </p>
              </div>
            </div>

            <Boton
              variante={publica ? 'peligro' : 'exito'}
              cargando={cambiando}
              onClick={() => cambiarPublica(!publica)}
            >
              {publica ? 'Cerrar la credencial' : 'Abrir la credencial'}
            </Boton>
          </div>

          <div className="mt-6">
            <Aviso tipo={publica ? 'exito' : 'info'} compacto>
              {publica
                ? 'Abierta: el botón sale en la portada y responde solo a los clasificados.'
                : 'Cerrada: el botón no sale en la portada y nadie puede descargarla.'}
            </Aviso>
          </div>
        </Tarjeta>
      )}

      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
              {deAlumnos ? (
                <Users className="h-9 w-9 text-granate-600" />
              ) : (
                <IdCard className="h-9 w-9 text-granate-600" />
              )}
              {deAlumnos ? 'Credenciales de delegaciones' : 'Credenciales de tutores'}
            </h3>
            <p className="mt-3 text-xl text-slate-600">
              {deAlumnos
                ? 'El PDF con todos los alumnos aprobados de cada delegación, listo para enviárselo al tutor.'
                : 'La credencial de cada tutor, para los que no pueden descargarla ellos mismos.'}
            </p>
          </div>

          {!deAlumnos && etapas.length > 0 && filas.length > 0 && (
            <Boton
              cargando={bajando === 'todas'}
              onClick={() =>
                bajar('todas', '/credenciales/tutores', 'credenciales-de-tutores.pdf')
              }
            >
              <Download className="h-6 w-6" />
              Descargar todas
            </Boton>
          )}
        </div>

        {etapas.length === 0 ? (
          <div className="mt-8">
            <Aviso tipo="alerta" icono={AlertCircle} titulo="Ninguna etapa está publicada">
              Publique una etapa en «Ajustes › Diseño de credenciales» y aquí podrá descargarlas.
            </Aviso>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xl font-semibold text-slate-800">Buscar</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
                <input
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Institución, tutor o DNI"
                  className="w-full rounded-2xl border-2 border-slate-200 py-3 pl-14 pr-5 text-xl outline-none focus:border-granate-600"
                />
              </div>
            </label>

            {etapas.length > 1 ? (
              <Selector etiqueta="Etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                {etapas.map((e) => (
                  <option key={e.clave} value={e.clave}>
                    {e.etiqueta} · {e.fecha}
                  </option>
                ))}
              </Selector>
            ) : (
              <div>
                <span className="mb-2 block text-xl font-semibold text-slate-800">Etapa</span>
                <p className="py-3 text-xl font-semibold text-granate-700">
                  {etapas[0].etiqueta} · {etapas[0].fecha}
                </p>
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      )}

      {filas.length === 0 ? (
        <Aviso tipo="info" icono={AlertCircle} titulo="Todavía no hay delegaciones aprobadas">
          Aquí aparecen en cuanto la comisión apruebe su inscripción.
        </Aviso>
      ) : (
        <Tarjeta className="p-6">
          <p className="mb-5 text-base text-slate-600">
            {visibles.length} de {filas.length}{' '}
            {filas.length === 1 ? 'delegación aprobada' : 'delegaciones aprobadas'}
          </p>

          <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[52rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">N.º</th>
                  <th className="px-4 py-3 font-semibold">Institución</th>
                  <th className="px-4 py-3 font-semibold">Tutor</th>
                  <th className="px-4 py-3 font-semibold">Contacto</th>
                  <th className="px-4 py-3 text-center font-semibold">Alumnos</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map((fila, i) => (
                  <tr key={fila.tutorId} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3 text-base text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">
                        {fila.institucion}
                      </span>
                      <span className="block text-base text-slate-500">
                        {ETIQUETA_MODALIDAD[fila.modalidad] || fila.modalidad}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-base text-slate-900">{fila.tutor}</span>
                      <span className="block text-base text-slate-500">
                        {fila.dni ? `DNI ${fila.dni}` : 'Sin DNI'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-base text-slate-600">
                      <span className="block">{fila.celular}</span>
                      <span className="block text-slate-400">{fila.correo}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {fila.alumnosAprobados}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Boton
                        variante="suave"
                        tamano="chico"
                        cargando={bajando === fila.tutorId}
                        disabled={
                          etapas.length === 0 || (deAlumnos && fila.alumnosAprobados === 0)
                        }
                        onClick={() =>
                          bajar(
                            fila.tutorId,
                            deAlumnos
                              ? `/credenciales/delegaciones/${fila.tutorId}`
                              : `/credenciales/tutores/${fila.tutorId}`,
                            nombreArchivo(fila),
                          )
                        }
                      >
                        <Download className="h-5 w-5" />
                        {deAlumnos
                          ? `Alumnos (${fila.alumnosAprobados})`
                          : 'Credencial del tutor'}
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
