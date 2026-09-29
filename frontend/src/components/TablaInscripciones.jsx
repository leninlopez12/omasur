import { useMemo, useState } from 'react';
import { ArrowDownUp, Eye, Search } from 'lucide-react';
import { Boton, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { GRADOS } from '../lib/datos';

/** El recorrido completo, en el orden en que ocurre. */
export const ESTADO_INSCRIPCION = {
  REGISTRADO: { texto: 'Registrado', chip: 'bg-slate-200 text-slate-700', punto: 'bg-slate-400' },
  EN_REVISION: { texto: 'En revisión', chip: 'bg-amber-100 text-amber-800', punto: 'bg-amber-400' },
  APROBADA: {
    texto: 'Inscripción aprobada',
    chip: 'bg-emerald-100 text-emerald-800',
    punto: 'bg-emerald-500',
  },
  OBSERVADA: { texto: 'Observada', chip: 'bg-rose-100 text-rose-800', punto: 'bg-rose-500' },
};

export const ESTADO_COMPROBANTE = {
  SIN_ENVIAR: { texto: 'Sin enviar', chip: 'bg-slate-200 text-slate-700' },
  EN_REVISION: { texto: 'En revisión', chip: 'bg-sky-100 text-sky-800' },
  APROBADO: { texto: 'Aprobado', chip: 'bg-emerald-100 text-emerald-800' },
  RECHAZADO: { texto: 'Rechazado', chip: 'bg-rose-100 text-rose-800' },
};

const POR_PAGINA = 25;

/**
 * Tabla de inscripciones, alumno por fila.
 *
 * La usan el tutor (su delegación) y el supervisor (todas), con las mismas
 * columnas salvo la del tutor responsable. Trae filtros, orden y paginado
 * porque con cientos de alumnos una lista suelta no se puede leer.
 */
export default function TablaInscripciones({
  filas,
  conTutor = false,
  textoAccion = 'Ver',
  alAbrir,
  vacio = 'Todavía no hay estudiantes.',
}) {
  const [buscar, setBuscar] = useState('');
  const [nivel, setNivel] = useState('');
  const [grado, setGrado] = useState('');
  const [estado, setEstado] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [pagina, setPagina] = useState(1);

  const visibles = useMemo(() => {
    const texto = buscar.trim().toLowerCase();

    const lista = filas.filter((f) => {
      if (nivel && f.nivel !== nivel) return false;
      if (grado && f.grado !== grado) return false;
      if (estado && f.estadoInscripcion !== estado) return false;
      if (!texto) return true;
      return (
        f.nombres.toLowerCase().includes(texto) ||
        f.dni.includes(texto) ||
        (conTutor && (f.institucion || '').toLowerCase().includes(texto))
      );
    });

    // Sin comprobante no hay fecha de envío: esos van al final, porque
    // ordenar por "lo último enviado" no dice nada de quien no envió.
    return [...lista].sort((a, b) => {
      const ta = a.enviadoEn ? new Date(a.enviadoEn).getTime() : null;
      const tb = b.enviadoEn ? new Date(b.enviadoEn).getTime() : null;
      if (ta === null && tb === null) return a.nombres.localeCompare(b.nombres);
      if (ta === null) return 1;
      if (tb === null) return -1;
      return orden === 'recientes' ? tb - ta : ta - tb;
    });
  }, [filas, buscar, nivel, grado, estado, orden, conTutor]);

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const actual = Math.min(pagina, totalPaginas);
  const enPagina = visibles.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);

  const cambiar = (accion) => (evento) => {
    accion(evento.target.value);
    setPagina(1);
  };

  const gradosDelNivel = nivel ? GRADOS.filter((g) => g.nivel === nivel) : GRADOS;

  return (
    <Tarjeta>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="block xl:col-span-2">
          <span className="mb-2 block text-xl font-semibold text-slate-800">Buscar</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
            <input
              value={buscar}
              onChange={cambiar(setBuscar)}
              placeholder={conTutor ? 'Nombre, DNI o institución' : 'Nombre o DNI'}
              className="w-full rounded-2xl border-2 border-slate-200 py-3 pl-14 pr-5 text-xl outline-none focus:border-granate-600"
            />
          </div>
        </label>

        <Selector
          etiqueta="Nivel"
          value={nivel}
          onChange={(e) => {
            setNivel(e.target.value);
            setGrado('');
            setPagina(1);
          }}
        >
          <option value="">Todos</option>
          <option value="PRIMARIA">Primaria</option>
          <option value="SECUNDARIA">Secundaria</option>
        </Selector>

        <Selector etiqueta="Grado" value={grado} onChange={cambiar(setGrado)}>
          <option value="">Todos</option>
          {gradosDelNivel.map((g) => (
            <option key={g.valor} value={g.valor}>
              {g.label}
            </option>
          ))}
        </Selector>

        <Selector etiqueta="Estado" value={estado} onChange={cambiar(setEstado)}>
          <option value="">Todos</option>
          {Object.entries(ESTADO_INSCRIPCION).map(([id, conf]) => (
            <option key={id} value={id}>
              {conf.texto}
            </option>
          ))}
        </Selector>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xl text-slate-600">
          {visibles.length} de {filas.length}{' '}
          {filas.length === 1 ? 'estudiante' : 'estudiantes'}
        </p>
        <Boton
          variante="contorno"
          tamano="chico"
          onClick={() => setOrden(orden === 'recientes' ? 'antiguos' : 'recientes')}
        >
          <ArrowDownUp className="h-5 w-5" />
          {orden === 'recientes' ? 'Más recientes primero' : 'Más antiguos primero'}
        </Boton>
      </div>

      {visibles.length === 0 ? (
        <p className="py-12 text-center text-xl text-slate-500">{vacio}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
          <table className="w-full min-w-[60rem] text-left">
            <thead className="bg-slate-50">
              <tr className="text-base text-slate-500">
                <th className="px-4 py-3 font-semibold">N.º</th>
                <th className="px-4 py-3 font-semibold">Estudiante</th>
                {conTutor && <th className="px-4 py-3 font-semibold">Tutor</th>}
                <th className="px-4 py-3 font-semibold">Nivel</th>
                <th className="px-4 py-3 font-semibold">Grado</th>
                <th className="px-4 py-3 font-semibold">Comprobante</th>
                <th className="px-4 py-3 font-semibold">Enviado</th>
                <th className="px-4 py-3 font-semibold">Inscripción</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enPagina.map((fila, i) => {
                const insc = ESTADO_INSCRIPCION[fila.estadoInscripcion];
                const comp = ESTADO_COMPROBANTE[fila.estadoComprobante];

                return (
                  <tr key={fila.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3 text-base text-slate-500">
                      {(actual - 1) * POR_PAGINA + i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">
                        {fila.nombres}
                      </span>
                      <span className="block text-base text-slate-500">{fila.dni}</span>
                    </td>
                    {conTutor && (
                      <td className="px-4 py-3">
                        <span className="block text-base text-slate-900">{fila.institucion}</span>
                        <span className="block text-base text-slate-500">{fila.tutorNombre}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-base text-slate-700">{fila.nivelLabel}</td>
                    <td className="px-4 py-3 text-base text-slate-700">{fila.gradoLabel}</td>
                    <td className="px-4 py-3">
                      <Etiqueta compacto className={comp.chip}>
                        {comp.texto}
                      </Etiqueta>
                    </td>
                    <td className="px-4 py-3 text-base text-slate-600">
                      {fila.enviadoEn ? (
                        <>
                          <span className="block">
                            {new Date(fila.enviadoEn).toLocaleDateString('es-PE')}
                          </span>
                          <span className="block text-slate-400">
                            {new Date(fila.enviadoEn).toLocaleTimeString('es-PE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${insc.punto}`} />
                        <Etiqueta compacto className={insc.chip}>
                          {insc.texto}
                        </Etiqueta>
                      </span>
                      {fila.observacion && (
                        <span className="mt-1 block max-w-xs text-base text-rose-700">
                          {fila.observacion}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {alAbrir && (
                        <Boton variante="suave" tamano="chico" onClick={() => alAbrir(fila)}>
                          <Eye className="h-5 w-5" />
                          {textoAccion}
                        </Boton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPaginas > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
              <p className="text-base text-slate-600">
                Página {actual} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <Boton
                  variante="contorno"
                  tamano="chico"
                  disabled={actual === 1}
                  onClick={() => setPagina(actual - 1)}
                >
                  Anterior
                </Boton>
                <Boton
                  variante="contorno"
                  tamano="chico"
                  disabled={actual === totalPaginas}
                  onClick={() => setPagina(actual + 1)}
                >
                  Siguiente
                </Boton>
              </div>
            </div>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
