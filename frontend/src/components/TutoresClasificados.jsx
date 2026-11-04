import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, Phone, Search, Users } from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';
import { sinTildes } from './ExamenEntregas.jsx';

const MODALIDAD = {
  ESTATAL: 'Estatal',
  PARTICULAR: 'Particular',
  GRUPO_ESTUDIO: 'Grupo de estudio',
};

const COLOR_MODALIDAD = {
  ESTATAL: 'bg-sky-100 text-sky-800',
  PARTICULAR: 'bg-amber-100 text-amber-800',
  GRUPO_ESTUDIO: 'bg-violet-100 text-violet-800',
};

/**
 * Resultados · Tutores clasificados.
 *
 * La etapa institucional la corre cada delegación por su cuenta. Después hay
 * que convocar a los que pasaron, y para eso no sirve la tabla de alumnos:
 * hace falta la lista de tutores, cada uno una sola vez, con el número al que
 * se le llama. Eso es esta pantalla, y el Excel que sale de ella.
 */
export default function TutoresClasificados() {
  const [datos, setDatos] = useState(null);
  const [categoria, setCategoria] = useState('');
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/resultados/tutores-clasificados', {
        params: categoria ? { categoria } : {},
      });
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar la lista'));
    }
  }, [categoria]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const bajar = async (cual) => {
    setBajando(cual || 'todas');
    try {
      await descargar(
        `/resultados/tutores-clasificados/excel${cual ? `?categoria=${cual}` : ''}`,
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setBajando('');
    }
  };

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Juntando a los clasificados" />;

  const { categorias, resumen } = datos;

  // El filtro de la caja es solo de la pantalla: el Excel baja la lista
  // completa de la categoría elegida, no lo que quedó a la vista.
  const buscado = sinTildes(texto);
  const tutores = buscado
    ? datos.tutores.filter((t) =>
        [t.nombres, t.institucion, t.dni, t.celular, t.correo, t.distrito]
          .map((c) => sinTildes(c || ''))
          .some((c) => c.includes(buscado)),
      )
    : datos.tutores;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Tutores clasificados</h3>
        <p className="mt-2 text-xl text-slate-600">
          Los tutores que llevan al menos un estudiante a la final macrorregional del 08 de
          noviembre. Cada uno aparece una sola vez, aunque clasifique en varias categorías.
        </p>

        {resumen.pendientes > 0 && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto>
              Quedan {resumen.pendientes} {resumen.pendientes === 1 ? 'caso' : 'casos'} sin
              resolver entre las dos tandas. Esta lista puede cambiar: resuélvalos antes de
              convocar.
            </Aviso>
          </div>
        )}

        {!resumen.publicado && resumen.pendientes === 0 && (
          <div className="mt-6">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              Los resultados todavía no están publicados a los tutores. La lista ya es la
              definitiva del cálculo, pero ellos aún no la ven.
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-5 sm:grid-cols-2">
        <Tarjeta>
          <div className="flex items-center gap-4">
            <Users className="h-10 w-10 text-granate-600" />
            <div>
              <p className="text-4xl font-black text-slate-900">{resumen.tutores}</p>
              <p className="text-base text-slate-600">
                {resumen.tutores === 1 ? 'tutor clasificado' : 'tutores clasificados'}
                {categoria && ` en CAT. ${categoria}`}
              </p>
            </div>
          </div>
        </Tarjeta>
        <Tarjeta>
          <div className="flex items-center gap-4">
            <Phone className="h-10 w-10 text-granate-600" />
            <div>
              <p className="text-4xl font-black text-slate-900">{resumen.clasificados}</p>
              <p className="text-base text-slate-600">
                {resumen.clasificados === 1
                  ? 'estudiante clasificado'
                  : 'estudiantes clasificados'}
              </p>
            </div>
          </div>
        </Tarjeta>
      </div>

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Ver y descargar</h4>
        <p className="mt-2 text-base text-slate-600">
          Elija una categoría para trabajarla sola, o déjelo en todas para la lista de
          convocatoria completa.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <Selector
            etiqueta="Categoría"
            className="min-w-[16rem] flex-1"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.categoria} value={c.categoria}>
                CAT. {c.categoria} · {c.grado} · {c.tutores}{' '}
                {c.tutores === 1 ? 'tutor' : 'tutores'}
              </option>
            ))}
          </Selector>

          <div className="min-w-[16rem] flex-1">
            <Campo
              etiqueta="Buscar en la lista"
              icono={Search}
              placeholder="Tutor, institución, DNI o celular"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Boton variante="excel" cargando={bajando === 'todas'} onClick={() => bajar('')}>
            <Download className="h-6 w-6" />
            Todas las categorías
          </Boton>
          <Boton
            variante="excelContorno"
            disabled={!categoria}
            cargando={bajando === categoria}
            onClick={() => bajar(categoria)}
          >
            <Download className="h-6 w-6" />
            {categoria ? `Solo CAT. ${categoria}` : 'Solo una categoría'}
          </Boton>
        </div>
        <p className="mt-3 text-base text-slate-500">
          El de todas las categorías trae una hoja con la lista completa y una hoja por
          categoría. El de una sola trae esa hoja.
        </p>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      {datos.tutores.length === 0 ? (
        <Tarjeta>
          <Aviso tipo="info" icono={AlertCircle} compacto>
            {categoria
              ? `Todavía no hay tutores con clasificados en la CAT. ${categoria}.`
              : 'Todavía no hay tutores con estudiantes clasificados.'}
          </Aviso>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-xl font-black text-slate-900">
              {categoria ? `CAT. ${categoria}` : 'Todas las categorías'}
            </h4>
            <p className="text-base text-slate-500">
              {tutores.length === datos.tutores.length
                ? `${tutores.length} ${tutores.length === 1 ? 'tutor' : 'tutores'}`
                : `${tutores.length} de ${datos.tutores.length}`}
            </p>
          </div>

          {tutores.length === 0 ? (
            <div className="mt-6">
              <Aviso tipo="info" icono={AlertCircle} compacto>
                Nadie en la lista coincide con «{texto}».
              </Aviso>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
              <table className="w-full min-w-[58rem] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-base text-slate-500">
                    <th className="px-4 py-3 text-center font-semibold">N°</th>
                    <th className="px-4 py-3 font-semibold">Tutor</th>
                    <th className="px-4 py-3 font-semibold">Institución</th>
                    <th className="px-4 py-3 font-semibold">Celular</th>
                    <th className="px-4 py-3 font-semibold">Categorías</th>
                    <th className="px-4 py-3 text-center font-semibold">Clasificados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tutores.map((t, i) => (
                    <tr key={t.tutorId}>
                      <td className="px-4 py-3 text-center text-base text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="block text-base font-bold text-slate-900">
                          {t.nombres}
                        </span>
                        <span className="block text-base text-slate-500">
                          DNI {t.dni || 'sin registrar'}
                        </span>
                        {t.correo && (
                          <span className="block text-base text-slate-500">{t.correo}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-base font-semibold text-slate-900">
                          {t.institucion || 'Sin institución'}
                        </span>
                        <Etiqueta
                          compacto
                          className={`mt-1 ${
                            COLOR_MODALIDAD[t.modalidad] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {MODALIDAD[t.modalidad] || 'Sin tipo'}
                        </Etiqueta>
                        {(t.provincia || t.distrito) && (
                          <span className="mt-1 block text-base text-slate-500">
                            {[t.distrito, t.provincia].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-base font-semibold text-slate-900">
                        {t.celular || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.categorias.map((c) => (
                            <Etiqueta
                              key={c}
                              compacto
                              className="bg-granate-50 text-granate-700"
                            >
                              {c}
                            </Etiqueta>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                        {t.clasificados}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
