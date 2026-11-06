import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { COLOR_NIVEL, NIVEL, NIVELES } from './FinalSalones.jsx';
import { api, descargar, mensajeError } from '../lib/api';

/**
 * Final · Lista de salones para el examen.
 *
 * Va aparte del reparto a propósito: el reparto se toca hasta el último
 * momento y esto es lo que se imprime cuando ya no se toca más. Una hoja por
 * aula, con su horario, su responsable y su gente en el orden en que se pasa
 * lista. Sin columna de firma, que nadie usaba.
 */
export default function FinalListas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/final/salones');
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Cargando los salones" />;

  const { salones, resumen, config } = datos;

  const bajar = async (clave, params) => {
    setError('');
    setBajando(clave);
    try {
      const query = new URLSearchParams(params).toString();
      await descargar(`/final/listas/excel${query ? `?${query}` : ''}`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setBajando('');
    }
  };

  if (salones.length === 0) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Lista de salones</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay reparto. Ármelo en Salones y horarios y acomódelo en Reparto de
            alumnos; las listas salen de ahí.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <Printer className="h-9 w-9 text-granate-600" />
          Lista de salones para el examen
        </h3>
        <p className="mt-2 text-xl text-slate-600">
          Lo que se imprime y se pega en cada puerta: número, DNI, apellidos y nombres, e
          institución. Una hoja por aula, en el orden en que se pasa lista.
        </p>

        {(resumen.sinSalon.length > 0 || resumen.desfasado) && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto>
              {resumen.sinSalon.length > 0
                ? `${resumen.sinSalon.length} clasificados todavía no tienen salón y no saldrán en ninguna lista.`
                : 'El reparto no cuadra con los clasificados de hoy.'}{' '}
              Termine de acomodar en Reparto de alumnos antes de imprimir.
            </Aviso>
          </div>
        )}

        {resumen.sinResponsable > 0 && (
          <div className="mt-4">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              {resumen.sinResponsable}{' '}
              {resumen.sinResponsable === 1 ? 'salón saldrá' : 'salones saldrán'} con «Sin
              responsable asignado» en la cabecera.
            </Aviso>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Boton variante="excel" cargando={bajando === 'todo'} onClick={() => bajar('todo', {})}>
            <Download className="h-6 w-6" />
            Todas las listas ({resumen.salones} salones)
          </Boton>
          {NIVELES.filter((n) => salones.some((s) => s.nivel === n)).map((n) => (
            <Boton
              key={n}
              variante="excelContorno"
              cargando={bajando === n}
              onClick={() => bajar(n, { nivel: n })}
            >
              <Download className="h-6 w-6" />
              Solo {NIVEL[n].toLowerCase()}
            </Boton>
          ))}
        </div>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      {NIVELES.map((nivel) => {
        const suyos = salones.filter((s) => s.nivel === nivel);
        if (suyos.length === 0) return null;

        return (
          <Tarjeta key={nivel}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
                <Etiqueta compacto className={COLOR_NIVEL[nivel]}>
                  {NIVEL[nivel]}
                </Etiqueta>
                {suyos[0].horario.inicio} a {suyos[0].horario.fin}
              </h4>
              <p className="text-base text-slate-500">
                {suyos.length} {suyos.length === 1 ? 'salón' : 'salones'} ·{' '}
                {suyos.reduce((t, s) => t + s.total, 0)} alumnos
              </p>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-slate-200">
              <table className="w-full min-w-[42rem] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-base text-slate-500">
                    <th className="px-4 py-3 text-center font-semibold">Salón</th>
                    <th className="px-4 py-3 font-semibold">Categorías</th>
                    <th className="px-4 py-3 text-center font-semibold">Alumnos</th>
                    <th className="px-4 py-3 font-semibold">Responsable</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suyos.map((s) => (
                    <tr key={s.id} className={s.total === 0 ? 'opacity-50' : ''}>
                      <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                        {s.numero}
                      </td>
                      <td className="px-4 py-3 text-base text-slate-700">
                        {s.categorias.map((c) => `CAT. ${c}`).join(' · ') || 'Vacío'}
                      </td>
                      <td className="px-4 py-3 text-center text-base">
                        <span className={s.excedido ? 'font-bold text-amber-700' : ''}>
                          {s.total}
                        </span>
                        <span className="text-slate-400"> / {config.capacidad}</span>
                      </td>
                      <td className="px-4 py-3 text-base text-slate-700">
                        {s.responsable?.nombre || (
                          <span className="text-slate-400">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.total > 0 && (
                          <Boton
                            variante="excelContorno"
                            tamano="chico"
                            cargando={bajando === s.id}
                            onClick={() => bajar(s.id, { nivel: s.nivel, salon: s.numero })}
                          >
                            <FileSpreadsheet className="h-5 w-5" />
                            Lista
                          </Boton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        );
      })}
    </div>
  );
}
