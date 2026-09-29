import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, RotateCcw, Search } from 'lucide-react';
import { Aviso, Boton, Cargando, Selector, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';

const VACIO = {
  tipo: 'estudiantes',
  estado: '',
  pago: '',
  situacion: '',
  modalidad: '',
  nivel: '',
  grado: '',
  departamento: '',
  provincia: '',
  distrito: '',
  desde: '',
  hasta: '',
  buscar: '',
};

/** Atajos a lo que la comisión va a pedir una y otra vez. */
const RAPIDOS = [
  { texto: 'Consolidado general', filtros: {} },
  { texto: 'Aún no pagaron', filtros: { pago: 'SIN_PAGAR' } },
  { texto: 'Ya pagaron', filtros: { pago: 'PAGADO' } },
  { texto: 'Pendientes de aprobación', filtros: { estado: 'EN_REVISION' } },
  { texto: 'Aprobadas', filtros: { estado: 'APROBADA' } },
  { texto: 'Con observación', filtros: { estado: 'OBSERVADA' } },
  {
    texto: 'No llegan al mínimo',
    filtros: { tipo: 'delegaciones', situacion: 'INCOMPLETAS' },
  },
  {
    texto: 'Con un solo estudiante',
    filtros: { tipo: 'delegaciones', situacion: 'UNO_SOLO' },
  },
  {
    texto: 'Sin ningún estudiante',
    filtros: { tipo: 'delegaciones', situacion: 'SIN_ESTUDIANTES' },
  },
];

/**
 * Reportes con filtros. En vez de una lista fija de descargas, se arma el
 * reporte: las combinaciones que van a necesitar no se pueden adivinar.
 */
export default function Reportes() {
  const [opciones, setOpciones] = useState(null);
  const [filtros, setFiltros] = useState(VACIO);
  const [vista, setVista] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    api
      .get('/admin/reportes/opciones')
      .then(({ data }) => setOpciones(data))
      .catch(() => setOpciones(false));
  }, []);

  const previsualizar = useCallback(async (valores) => {
    setError('');
    try {
      const { data } = await api.get('/admin/reportes', { params: limpiar(valores) });
      setVista(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo armar el reporte'));
      setVista(null);
    }
  }, []);

  // Cada cambio de filtro recalcula el conteo, con un respiro para no pedir
  // en cada tecla de la búsqueda.
  useEffect(() => {
    const reloj = setTimeout(() => previsualizar(filtros), 400);
    return () => clearTimeout(reloj);
  }, [filtros, previsualizar]);

  if (!opciones) return <Cargando texto="Cargando los reportes" />;

  const cambiar = (campo) => (evento) => setFiltros({ ...filtros, [campo]: evento.target.value });

  const bajar = async () => {
    setBajando(true);
    setError('');
    try {
      const params = new URLSearchParams(limpiar(filtros)).toString();
      await descargar(`/admin/reportes/excel?${params}`, 'reporte-omasur.xlsx');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setBajando(false);
    }
  };

  const activos = Object.entries(limpiar(filtros)).filter(([k]) => k !== 'tipo').length;

  return (
    <div className="space-y-8">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h3 className="text-3xl font-black text-slate-900">Armar reporte</h3>
            <p className="mt-3 text-xl text-slate-600">
              Elija qué necesita y descárguelo en Excel.
            </p>
          </div>
          {activos > 0 && (
            <Boton variante="fantasma" tamano="chico" onClick={() => setFiltros(VACIO)}>
              <RotateCcw className="h-5 w-5" />
              Limpiar filtros
            </Boton>
          )}
        </div>

        {/* Los de siempre, a un clic. */}
        <div className="mt-8">
          <span className="mb-3 block text-xl font-semibold text-slate-800">Los más pedidos</span>
          <div className="flex flex-wrap gap-3">
            {RAPIDOS.map((item) => (
              <button
                key={item.texto}
                type="button"
                onClick={() => setFiltros({ ...VACIO, tipo: 'estudiantes', ...item.filtros })}
                className="rounded-full border-2 border-slate-200 px-5 py-2.5 text-base font-semibold text-slate-700 transition hover:border-granate-400 hover:bg-granate-50"
              >
                {item.texto}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex gap-3 rounded-2xl bg-slate-100 p-2">
          {[
            { id: 'estudiantes', texto: 'Una fila por estudiante' },
            { id: 'delegaciones', texto: 'Una fila por delegación' },
          ].map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              onClick={() => setFiltros({ ...filtros, tipo: opcion.id })}
              className={`flex-1 rounded-xl px-5 py-3 text-center text-xl font-semibold transition ${
                filtros.tipo === opcion.id
                  ? 'bg-granate-600 text-white shadow-suave'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {opcion.texto}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Selector etiqueta="Estado de la inscripción" value={filtros.estado} onChange={cambiar('estado')}>
            <option value="">Cualquiera</option>
            {opciones.estados.map((o) => (
              <option key={o.id} value={o.id}>
                {o.texto}
              </option>
            ))}
          </Selector>

          <Selector etiqueta="Pago" value={filtros.pago} onChange={cambiar('pago')}>
            <option value="">Cualquiera</option>
            {opciones.pagos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.texto}
              </option>
            ))}
          </Selector>

          <Selector etiqueta="Situación" value={filtros.situacion} onChange={cambiar('situacion')}>
            <option value="">Cualquiera</option>
            {opciones.situaciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.texto}
              </option>
            ))}
          </Selector>

          <Selector etiqueta="Modalidad" value={filtros.modalidad} onChange={cambiar('modalidad')}>
            <option value="">Todas</option>
            {opciones.modalidades.map((o) => (
              <option key={o.id} value={o.id}>
                {o.texto}
              </option>
            ))}
          </Selector>

          <Selector etiqueta="Nivel" value={filtros.nivel} onChange={cambiar('nivel')}>
            <option value="">Los dos</option>
            <option value="PRIMARIA">Primaria</option>
            <option value="SECUNDARIA">Secundaria</option>
          </Selector>

          <Selector etiqueta="Grado" value={filtros.grado} onChange={cambiar('grado')}>
            <option value="">Todos</option>
            {opciones.grados.map((o) => (
              <option key={o.id} value={o.id}>
                {o.texto}
              </option>
            ))}
          </Selector>

          <Selector
            etiqueta="Departamento"
            value={filtros.departamento}
            onChange={cambiar('departamento')}
          >
            <option value="">Todos</option>
            {opciones.departamentos.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Selector>

          <Selector etiqueta="Provincia" value={filtros.provincia} onChange={cambiar('provincia')}>
            <option value="">Todas</option>
            {opciones.provincias.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Selector>

          <Selector etiqueta="Distrito" value={filtros.distrito} onChange={cambiar('distrito')}>
            <option value="">Todos</option>
            {opciones.distritos.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Selector>

          <label className="block">
            <span className="mb-2 block text-xl font-semibold text-slate-800">Desde</span>
            <input
              type="date"
              value={filtros.desde}
              onChange={cambiar('desde')}
              className="w-full rounded-2xl border-2 border-slate-200 px-5 py-4 text-xl outline-none focus:border-granate-600"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xl font-semibold text-slate-800">Hasta</span>
            <input
              type="date"
              value={filtros.hasta}
              onChange={cambiar('hasta')}
              className="w-full rounded-2xl border-2 border-slate-200 px-5 py-4 text-xl outline-none focus:border-granate-600"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xl font-semibold text-slate-800">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
              <input
                value={filtros.buscar}
                onChange={cambiar('buscar')}
                placeholder="Nombre, DNI o institución"
                className="w-full rounded-2xl border-2 border-slate-200 py-4 pl-14 pr-5 text-xl outline-none focus:border-granate-600"
              />
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-6">
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          </div>
        )}
      </Tarjeta>

      {vista && (
        <Tarjeta>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <h3 className="text-3xl font-black text-slate-900">{vista.titulo}</h3>
              <p className="mt-2 text-xl text-slate-600">{vista.descripcion}</p>
              <p className="mt-4 text-5xl font-black text-granate-700">
                {vista.total}{' '}
                <span className="text-xl font-semibold text-slate-500">
                  {filtros.tipo === 'delegaciones'
                    ? vista.total === 1
                      ? 'delegación'
                      : 'delegaciones'
                    : vista.total === 1
                      ? 'estudiante'
                      : 'estudiantes'}
                </span>
              </p>
            </div>
            <Boton tamano="grande" disabled={vista.total === 0} cargando={bajando} onClick={bajar}>
              <Download className="h-7 w-7" />
              Descargar Excel
            </Boton>
          </div>

          {vista.total === 0 ? (
            <p className="mt-8 text-xl text-slate-500">
              Ningún registro coincide. Pruebe con menos filtros.
            </p>
          ) : (
            <div className="mt-8 overflow-x-auto rounded-2xl border-2 border-slate-200">
              <table className="w-full min-w-[46rem] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-base text-slate-500">
                    {(vista.columnas || []).slice(0, 7).map((columna) => (
                      <th key={columna.key} className="px-4 py-3 font-semibold">
                        {columna.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vista.muestra.map((fila, i) => (
                    <tr key={i}>
                      {(vista.columnas || []).slice(0, 7).map((columna) => (
                        <td key={columna.key} className="px-4 py-3 text-base text-slate-800">
                          {String(fila[columna.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {vista.total > vista.muestra.length && (
                <p className="bg-slate-50 px-4 py-3 text-base text-slate-500">
                  <FileSpreadsheet className="mr-2 inline h-5 w-5" />
                  Vista previa de {vista.muestra.length}. El Excel trae los {vista.total}.
                </p>
              )}
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  );
}

/** Los filtros vacíos no viajan: ensucian la dirección y el título del reporte. */
function limpiar(filtros) {
  return Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== ''));
}
