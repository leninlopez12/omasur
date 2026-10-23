import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Download, Search } from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';
import { GRADOS } from '../lib/datos';

export const sinTildes = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const fecha = (valor) =>
  valor
    ? new Date(valor).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

/** Las cifras de arriba de cada pantalla, siempre con el mismo aspecto. */
function Cifras({ datos }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {datos.map((d) => (
        <div key={d.texto} className="rounded-3xl bg-white p-6 shadow-suave">
          <p className="text-4xl font-black text-granate-700">{d.valor}</p>
          <p className="mt-1 text-base text-slate-600">{d.texto}</p>
        </div>
      ))}
    </div>
  );
}

/** El buscador y los filtros, en una sola fila que se parte en el móvil. */
export function Filtros({ buscar, alBuscar, children, placeholder }) {
  return (
    <Tarjeta>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Campo
          etiqueta="Buscar"
          icono={Search}
          className="xl:col-span-2"
          compacto
          placeholder={placeholder}
          value={buscar}
          onChange={(e) => alBuscar(e.target.value)}
        />
        {children}
      </div>
    </Tarjeta>
  );
}

/**
 * Examen · Entregas recibidas.
 *
 * Lo que ya llegó, con buscador y filtros: en el día del examen esta lista
 * crece rápido y sin filtros no se encuentra nada.
 */
export function ExamenEntregas() {
  const [entregas, setEntregas] = useState(null);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [llenadoPor, setLlenadoPor] = useState('');
  const [categoria, setCategoria] = useState('');

  useEffect(() => {
    api
      .get('/examen/entregas')
      .then(({ data }) => setEntregas(data))
      .catch((e) => setError(mensajeError(e, 'No se pudieron cargar las entregas')));
  }, []);

  const filtradas = useMemo(() => {
    if (!entregas) return [];
    const texto = sinTildes(buscar);
    return entregas.filter((e) => {
      if (texto && !sinTildes(e.institucion).includes(texto)) return false;
      if (llenadoPor === 'tutor' && e.porComision) return false;
      if (llenadoPor === 'comision' && !e.porComision) return false;
      if (categoria && !e.categorias.includes(categoria)) return false;
      return true;
    });
  }, [entregas, buscar, llenadoPor, categoria]);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!entregas) return <Cargando texto="Cargando entregas" />;

  const estudiantes = filtradas.reduce((s, e) => s + e.total, 0);

  return (
    <div className="space-y-6">
      <Cifras
        datos={[
          { valor: entregas.length, texto: 'Delegaciones que enviaron' },
          { valor: entregas.reduce((s, e) => s + e.total, 0), texto: 'Estudiantes corregidos' },
          {
            valor: entregas.filter((e) => e.porComision).length,
            texto: 'Llenadas por la comisión',
          },
          { valor: filtradas.length, texto: 'En el filtro actual' },
        ]}
      />

      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Institución educativa"
      >
        <Selector
          etiqueta="Llenado por"
          compacto
          value={llenadoPor}
          onChange={(e) => setLlenadoPor(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="tutor">El tutor</option>
          <option value="comision">La comisión</option>
        </Selector>
        <Selector
          etiqueta="Categoría"
          compacto
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          <option value="">Todas</option>
          {GRADOS.map((g) => (
            <option key={g.categoria} value={g.categoria}>
              CAT. {g.categoria}
            </option>
          ))}
        </Selector>
      </Filtros>

      <Tarjeta>
        {filtradas.length === 0 ? (
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Nada que mostrar con estos filtros.
          </Aviso>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[48rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Delegación</th>
                  <th className="px-4 py-3 font-semibold">Categorías</th>
                  <th className="px-4 py-3 text-center font-semibold">Estudiantes</th>
                  <th className="px-4 py-3 text-center font-semibold">Promedio</th>
                  <th className="px-4 py-3 text-center font-semibold">Más alto</th>
                  <th className="px-4 py-3 font-semibold">Llenado por</th>
                  <th className="px-4 py-3 font-semibold">Enviado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((e) => (
                  <tr key={e.tutorId}>
                    <td className="px-4 py-3 text-base font-semibold text-slate-900">
                      {e.institucion}
                    </td>
                    <td className="px-4 py-3 text-base text-slate-600">
                      {e.categorias.join(', ')}
                    </td>
                    <td className="px-4 py-3 text-center text-base">{e.total}</td>
                    <td className="px-4 py-3 text-center text-base">{e.promedio}</td>
                    <td className="px-4 py-3 text-center text-base font-black text-granate-700">
                      {e.puntajeAlto}
                    </td>
                    <td className="px-4 py-3 text-base">
                      {e.porComision ? (
                        <>
                          <Etiqueta compacto className="bg-amber-100 text-amber-800">
                            Comisión
                          </Etiqueta>
                          {e.registradoPor && (
                            <span className="mt-1 block text-base text-slate-500">
                              {e.registradoPor}
                            </span>
                          )}
                        </>
                      ) : (
                        <Etiqueta compacto className="bg-emerald-100 text-emerald-800">
                          Tutor
                        </Etiqueta>
                      )}
                    </td>
                    <td className="px-4 py-3 text-base text-slate-600">{fecha(e.enviadoEn)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr className="text-base font-black text-slate-900">
                  <td className="px-4 py-3" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-center">{estudiantes}</td>
                  <td className="px-4 py-3" colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

/**
 * Examen · Consultas.
 *
 * Quiénes enviaron y, sobre todo, qué instituciones faltan. Se mide contra
 * las delegaciones aprobadas con alumnos aprobados: son las que rinden.
 */
export function ExamenConsultas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    api
      .get('/examen/consultas')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar la consulta')));
  }, []);

  const filtradas = useMemo(() => {
    if (!datos) return [];
    const texto = sinTildes(buscar);
    return datos.filas.filter((f) => {
      if (texto && !sinTildes(`${f.institucion} ${f.tutor}`).includes(texto)) return false;
      if (estado === 'enviadas' && !f.enviado) return false;
      if (estado === 'pendientes' && f.enviado) return false;
      return true;
    });
  }, [datos, buscar, estado]);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando la consulta" />;

  const { resumen } = datos;

  return (
    <div className="space-y-6">
      <Cifras
        datos={[
          { valor: resumen.delegaciones, texto: 'Delegaciones que rinden' },
          { valor: resumen.enviadas, texto: 'Ya enviaron' },
          { valor: resumen.pendientes, texto: 'Faltan enviar' },
          { valor: `${resumen.respondidos} / ${resumen.alumnos}`, texto: 'Estudiantes con respuestas' },
        ]}
      />

      <Filtros buscar={buscar} alBuscar={setBuscar} placeholder="Institución o tutor">
        <Selector
          etiqueta="Estado"
          compacto
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Todas</option>
          <option value="enviadas">Ya enviaron</option>
          <option value="pendientes">Faltan</option>
        </Selector>

        <div className="flex items-end">
          <Boton
            variante="excel"
            cargando={bajando}
            onClick={async () => {
              setBajando(true);
              try {
                await descargar('/examen/consultas/excel', 'envios-examen.xlsx');
              } finally {
                setBajando(false);
              }
            }}
          >
            <Download className="h-5 w-5" />
            Excel
          </Boton>
        </div>
      </Filtros>

      <Tarjeta>
        {filtradas.length === 0 ? (
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Nada que mostrar con estos filtros.
          </Aviso>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[52rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Institución educativa</th>
                  <th className="px-4 py-3 font-semibold">Tutor</th>
                  <th className="px-4 py-3 font-semibold">Celular</th>
                  <th className="px-4 py-3 text-center font-semibold">Alumnos</th>
                  <th className="px-4 py-3 text-center font-semibold">Respondieron</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Enviado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((f) => (
                  <tr key={f.tutorId} className={f.enviado ? '' : 'bg-amber-50/60'}>
                    <td className="px-4 py-3">
                      <span className="block text-base font-semibold text-slate-900">
                        {f.institucion}
                      </span>
                      <span className="block text-base text-slate-500">{f.provincia}</span>
                    </td>
                    <td className="px-4 py-3 text-base text-slate-700">{f.tutor}</td>
                    <td className="px-4 py-3 text-base text-slate-600">{f.celular}</td>
                    <td className="px-4 py-3 text-center text-base">{f.alumnosAprobados}</td>
                    <td className="px-4 py-3 text-center text-base">{f.respondidos}</td>
                    <td className="px-4 py-3">
                      {f.enviado ? (
                        <>
                          <span className="inline-flex items-center gap-2 text-base font-bold text-emerald-700">
                            <CheckCircle2 className="h-5 w-5" />
                            {f.porComision ? 'Comisión' : 'Tutor'}
                          </span>
                          {f.porComision && f.registradoPor && (
                            <span className="mt-1 block text-base text-slate-500">
                              {f.registradoPor}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-base font-bold text-amber-700">
                          <Clock className="h-5 w-5" />
                          Falta
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-base text-slate-600">{fecha(f.enviadoEn)}</td>
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

/**
 * Examen · Consolidado.
 *
 * Todo lo recibido junto: por categoría y estudiante por estudiante, de mayor
 * a menor puntaje. El orden ya anticipa el ponderado, que se hará aparte.
 */
export function ExamenConsolidado() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('');
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    api
      .get('/examen/consolidado')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar el consolidado')));
  }, []);

  const filtrados = useMemo(() => {
    if (!datos) return [];
    const texto = sinTildes(buscar);
    return datos.alumnos.filter((a) => {
      if (categoria && a.categoria !== categoria) return false;
      if (texto && !sinTildes(`${a.nombres} ${a.dni} ${a.institucion}`).includes(texto)) return false;
      return true;
    });
  }, [datos, buscar, categoria]);

  if (error) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando el consolidado" />;

  return (
    <div className="space-y-6">
      <Cifras
        datos={[
          { valor: datos.resumen.delegaciones, texto: 'Delegaciones con respuestas' },
          { valor: datos.resumen.alumnos, texto: 'Estudiantes corregidos' },
          { valor: datos.categorias.length, texto: 'Categorías con datos' },
          { valor: datos.resumen.porComision, texto: 'Llenadas por la comisión' },
        ]}
      />

      {datos.categorias.length > 0 && (
        <Tarjeta>
          <h4 className="text-xl font-black text-slate-900">Por categoría</h4>
          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[32rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-center font-semibold">Estudiantes</th>
                  <th className="px-4 py-3 text-center font-semibold">Promedio</th>
                  <th className="px-4 py-3 text-center font-semibold">Más alto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datos.categorias.map((c) => (
                  <tr key={c.categoria}>
                    <td className="px-4 py-3 text-base font-semibold text-slate-900">
                      CAT. {c.categoria} · {c.grado}
                    </td>
                    <td className="px-4 py-3 text-center text-base">{c.alumnos}</td>
                    <td className="px-4 py-3 text-center text-base">{c.promedio}</td>
                    <td className="px-4 py-3 text-center text-base font-black text-granate-700">
                      {c.maximo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      <Filtros buscar={buscar} alBuscar={setBuscar} placeholder="Estudiante, DNI o institución">
        <Selector
          etiqueta="Categoría"
          compacto
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          <option value="">Todas</option>
          {datos.categorias.map((c) => (
            <option key={c.categoria} value={c.categoria}>
              CAT. {c.categoria}
            </option>
          ))}
        </Selector>

        <div className="flex items-end">
          <Boton
            variante="excel"
            cargando={bajando}
            onClick={async () => {
              setBajando(true);
              try {
                await descargar('/examen/consolidado/excel', 'consolidado-examen.xlsx');
              } finally {
                setBajando(false);
              }
            }}
          >
            <Download className="h-5 w-5" />
            Excel
          </Boton>
        </div>
      </Filtros>

      <Tarjeta>
        {filtrados.length === 0 ? (
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay respuestas que consolidar.
          </Aviso>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
            <table className="w-full min-w-[48rem] text-left">
              <thead className="bg-slate-50">
                <tr className="text-base text-slate-500">
                  <th className="px-4 py-3 text-center font-semibold">N°</th>
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                  <th className="px-4 py-3 font-semibold">Institución</th>
                  <th className="px-4 py-3 text-center font-semibold">Cat.</th>
                  <th className="px-4 py-3 text-center font-semibold">Bien</th>
                  <th className="px-4 py-3 text-center font-semibold">Mal</th>
                  <th className="px-4 py-3 text-center font-semibold">Blanco</th>
                  <th className="px-4 py-3 text-center font-semibold">Puntaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((a, i) => (
                  <tr key={`${a.dni}-${a.categoria}`}>
                    <td className="px-4 py-3 text-center text-base text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">{a.nombres}</span>
                      <span className="block text-base text-slate-500">{a.dni}</span>
                    </td>
                    <td className="px-4 py-3 text-base text-slate-600">{a.institucion}</td>
                    <td className="px-4 py-3 text-center text-base">{a.categoria}</td>
                    <td className="px-4 py-3 text-center text-base text-emerald-700">
                      {a.correctas}
                    </td>
                    <td className="px-4 py-3 text-center text-base text-rose-700">
                      {a.incorrectas}
                    </td>
                    <td className="px-4 py-3 text-center text-base text-slate-500">{a.blancos}</td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {a.puntaje}
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
