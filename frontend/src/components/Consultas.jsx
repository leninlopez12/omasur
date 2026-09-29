import { useCallback, useEffect, useState } from 'react';
import { Download, IdCard, Search, Users } from 'lucide-react';
import { Boton, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { api, descargar } from '../lib/api';
import { ESTADOS, ETIQUETA_MODALIDAD, GRADOS } from '../lib/datos';

/** Buscador + filtro de estado, compartido por las dos consultas. */
function Filtros({ filtros, alCambiar, marcador, children }) {
  return (
    <Tarjeta className="p-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={filtros.buscar}
            onChange={(e) => alCambiar({ ...filtros, buscar: e.target.value })}
            placeholder={marcador}
            className="w-full rounded-2xl border-2 border-slate-200 py-2.5 pl-11 pr-4 text-base outline-none focus:border-granate-600"
          />
        </div>

        <Selector
          etiqueta=""
          compacto
          value={filtros.estado}
          onChange={(e) => alCambiar({ ...filtros, estado: e.target.value })}
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([clave, valor]) => (
            <option key={clave} value={clave}>
              {valor.texto}
            </option>
          ))}
        </Selector>

        {children}
      </div>
    </Tarjeta>
  );
}

function Encabezados({ columnas }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 text-base text-slate-500">
        {columnas.map((c) => (
          <th key={c} className="pb-3 pr-4 font-semibold">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Estado({ valor }) {
  const estado = ESTADOS[valor] || ESTADOS.BORRADOR;
  return (
    <Etiqueta compacto className={estado.clase}>
      {estado.texto}
    </Etiqueta>
  );
}

/** Consultas > Tutores */
export function ConsultaTutores({ alAbrirTutor }) {
  const [filtros, setFiltros] = useState({ buscar: '', estado: '' });
  const [datos, setDatos] = useState(null);

  const cargar = useCallback(async () => {
    const { data } = await api.get('/admin/tutores', { params: filtros });
    setDatos(data);
  }, [filtros]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  return (
    <div className="space-y-6">
      <Filtros filtros={filtros} alCambiar={setFiltros} marcador="Nombre, DNI o institución" />

      {!datos ? (
        <Cargando />
      ) : (
        <Tarjeta className="p-6">
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Users className="h-6 w-6 text-granate-600" />
            Tutores ({datos.total})
          </h3>

          {datos.tutores.length === 0 ? (
            <p className="mt-5 text-base text-slate-500">Sin resultados.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left">
                <Encabezados
                  columnas={[
                    'DNI',
                    'Tutor',
                    'Institución',
                    'Ubicación',
                    'Modalidad',
                    'Alumnos',
                    'Estado',
                  ]}
                />
                <tbody>
                  {datos.tutores.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => alAbrirTutor?.(t.id)}
                      className="cursor-pointer border-b border-slate-100 hover:bg-granate-50/60"
                    >
                      <td className="py-3 pr-4 text-base text-slate-700">{t.dni || '—'}</td>
                      <td className="py-3 pr-4 text-base font-bold text-slate-900">{t.nombre}</td>
                      <td className="py-3 pr-4 text-base text-slate-700">
                        {t.institucion || 'Sin institución'}
                      </td>
                      <td className="py-3 pr-4 text-base text-slate-600">
                        {t.departamento || '—'}
                        {t.provincia ? ` · ${t.provincia}` : ''}
                      </td>
                      <td className="py-3 pr-4 text-base text-slate-600">
                        {ETIQUETA_MODALIDAD[t.modalidad] || t.modalidad}
                      </td>
                      <td className="py-3 pr-4 text-base font-black text-granate-700">
                        {t.alumnos}
                      </td>
                      <td className="py-3 pr-4">
                        <Estado valor={t.estado} />
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

/** Consultas > Estudiantes */
export function ConsultaEstudiantes() {
  const [filtros, setFiltros] = useState({ buscar: '', estado: '', grado: '' });
  const [datos, setDatos] = useState(null);
  const [bajando, setBajando] = useState('');

  const cargar = useCallback(async () => {
    const { data } = await api.get('/admin/estudiantes', { params: filtros });
    setDatos(data);
  }, [filtros]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  const bajarCredencial = async (alumno) => {
    setBajando(alumno.id);
    try {
      await descargar(`/credenciales/dni/${alumno.dni}`, `credencial-${alumno.dni}.pdf`);
    } finally {
      setBajando('');
    }
  };

  return (
    <div className="space-y-6">
      <Filtros filtros={filtros} alCambiar={setFiltros} marcador="Nombre, DNI, código o colegio">
        <Selector
          etiqueta=""
          compacto
          value={filtros.grado}
          onChange={(e) => setFiltros({ ...filtros, grado: e.target.value })}
        >
          <option value="">Todos los grados</option>
          {GRADOS.map((g) => (
            <option key={g.valor} value={g.valor}>
              CAT. {g.categoria} · {g.label}
            </option>
          ))}
        </Selector>
      </Filtros>

      {!datos ? (
        <Cargando />
      ) : (
        <Tarjeta className="p-6">
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <IdCard className="h-6 w-6 text-granate-600" />
            Estudiantes ({datos.total})
          </h3>

          {datos.alumnos.length === 0 ? (
            <p className="mt-5 text-base text-slate-500">Sin resultados.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[64rem] text-left">
                <Encabezados
                  columnas={[
                    'DNI',
                    'Estudiante',
                    'Grado',
                    'Institución',
                    'Estado',
                    'Credencial',
                  ]}
                />
                <tbody>
                  {datos.alumnos.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-granate-50/60">
                      <td className="py-3 pr-4 text-base font-bold text-granate-700">{a.dni}</td>
                      <td className="py-3 pr-4 text-base font-bold text-slate-900">{a.nombres}</td>
                      <td className="py-3 pr-4 text-base text-slate-600">
                        {a.gradoLabel}
                        <span className="ml-1 text-slate-400">· CAT. {a.categoria}</span>
                      </td>
                      <td className="py-3 pr-4 text-base text-slate-600">
                        {a.institucion || 'Sin institución'}
                      </td>
                      <td className="py-3 pr-4">
                        <Estado valor={a.estado} />
                      </td>
                      <td className="py-3 pr-4">
                        {a.credencialLista ? (
                          <Boton
                            variante="suave"
                            tamano="chico"
                            cargando={bajando === a.id}
                            onClick={() => bajarCredencial(a)}
                          >
                            <Download className="h-5 w-5" />
                            Descargar
                          </Boton>
                        ) : (
                          <span className="text-base text-slate-400">Al aprobarse</span>
                        )}
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
