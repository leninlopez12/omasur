import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, Download, GraduationCap, School, UserMinus } from 'lucide-react';
import { Aviso, Boton, Cargando, Selector, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';
import { GRADOS } from '../lib/datos';

const ALCANCES = [
  { id: 'APROBADOS', texto: 'Solo inscripciones aprobadas' },
  { id: 'EN_PROCESO', texto: 'Aprobadas y en revisión' },
];

/**
 * Consolidado para el día del examen.
 *
 * Responde dos preguntas con los mismos datos: cuántos rinden cada categoría
 * —para repartir aulas— y qué trae cada delegación con su tutor y su celular
 * —para llamarlo ese día—. El Excel baja una hoja por delegación.
 */
export default function Consolidado() {
  const [alcance, setAlcance] = useState('APROBADOS');
  const [categoria, setCategoria] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async (params) => {
    setError('');
    try {
      const { data } = await api.get('/admin/consolidado', { params });
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo armar el consolidado'));
    }
  }, []);

  useEffect(() => {
    setDatos(null);
    setAbierta(null);
    cargar(categoria ? { alcance, categoria } : { alcance });
  }, [alcance, categoria, cargar]);

  const bajar = async () => {
    setBajando(true);
    setError('');
    try {
      const cola = categoria ? `&categoria=${categoria}` : '';
      await descargar(
        `/admin/consolidado/excel?alcance=${alcance}${cola}`,
        categoria
          ? `consolidado-cat-${categoria.toLowerCase()}-omasur-2026.xlsx`
          : 'consolidado-omasur-2026.xlsx',
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setBajando(false);
    }
  };

  return (
    <div className="space-y-8">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h3 className="text-3xl font-black text-slate-900">Consolidado general</h3>
            <p className="mt-3 text-xl text-slate-600">
              Quiénes rinden el examen, por categoría y por delegación.
            </p>
          </div>
          <Boton cargando={bajando} onClick={bajar} disabled={!datos?.totales.alumnos}>
            <Download className="h-6 w-6" />
            Descargar Excel
          </Boton>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Selector
            etiqueta="Qué alumnos entran"
            value={alcance}
            onChange={(e) => setAlcance(e.target.value)}
          >
            {ALCANCES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.texto}
              </option>
            ))}
          </Selector>

          {/* Con una categoría elegida entran solo las delegaciones que
              mandaron a alguien a ella, y de cada una, solo esos alumnos. */}
          <Selector
            etiqueta="Categoría"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {GRADOS.map((g) => (
              <option key={g.categoria} value={g.categoria}>
                CAT. {g.categoria} · {g.label}
              </option>
            ))}
          </Selector>
        </div>

        <p className="mt-4 text-base text-slate-500">
          El Excel trae una hoja de resumen, una hoja por delegación con sus alumnos numerados, y
          una hoja con los que vienen solos.
        </p>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      )}

      {!datos ? (
        <Cargando texto="Armando el consolidado" />
      ) : datos.totales.alumnos === 0 ? (
        <Aviso tipo="info" icono={AlertCircle} titulo="Todavía no hay nadie en esta lista">
          {categoria
            ? 'Ninguna delegación inscribió a alguien en esa categoría con ese criterio.'
            : alcance === 'APROBADOS'
              ? 'Ninguna inscripción está aprobada aún. Pruebe con «Aprobadas y en revisión».'
              : 'Ninguna delegación envió su comprobante todavía.'}
        </Aviso>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Cifra
              icono={GraduationCap}
              valor={datos.totales.alumnos}
              texto="Estudiantes"
              clase="bg-granate-50 text-granate-700"
            />
            <Cifra
              icono={School}
              valor={datos.totales.delegaciones}
              texto="Delegaciones"
              clase="bg-sky-50 text-sky-700"
            />
            <Cifra
              icono={UserMinus}
              valor={datos.totales.individuales}
              texto="Vienen solos"
              clase="bg-amber-50 text-amber-700"
            />
          </div>

          <PorCategoria categorias={datos.categorias} />

          <PorDelegacion
            delegaciones={datos.delegaciones}
            categorias={datos.categorias}
            abierta={abierta}
            alAbrir={(id) => setAbierta(abierta === id ? null : id)}
          />

          {datos.individuales.length > 0 && <Individuales filas={datos.individuales} />}
        </>
      )}
    </div>
  );
}

function Cifra({ icono: Icono, valor, texto, clase }) {
  return (
    <div className={`rounded-2xl p-5 ${clase}`}>
      <Icono className="h-7 w-7" />
      <p className="mt-3 text-4xl font-black leading-none">{valor}</p>
      <p className="mt-2 text-xl font-semibold">{texto}</p>
    </div>
  );
}

/** Cuántos rinden cada categoría: lo primero al repartir aulas. */
function PorCategoria({ categorias }) {
  return (
    <Tarjeta className="p-6">
      <h4 className="text-xl font-black text-slate-900">
        {categorias.length === 1 ? 'Inscritos en la categoría' : 'Inscritos por categoría'}
      </h4>

      <div className="mt-5 overflow-x-auto rounded-2xl border-2 border-slate-200">
        <table className="w-full min-w-[34rem] text-left">
          <thead className="bg-slate-50">
            <tr className="text-base text-slate-500">
              <th className="px-4 py-3 font-semibold">Cat.</th>
              <th className="px-4 py-3 font-semibold">Grado</th>
              <th className="px-4 py-3 font-semibold">Nivel</th>
              <th className="px-4 py-3 text-center font-semibold">Inscritos</th>
              <th className="px-4 py-3 text-center font-semibold">Delegaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categorias.map((c) => (
              <tr key={c.categoria} className={c.alumnos ? '' : 'text-slate-400'}>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-base font-black ${
                      c.alumnos ? 'bg-granate-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {c.categoria}
                  </span>
                </td>
                <td className="px-4 py-3 text-base">{c.label}</td>
                <td className="px-4 py-3 text-base">
                  {c.nivel === 'PRIMARIA' ? 'Primaria' : 'Secundaria'}
                </td>
                <td className="px-4 py-3 text-center text-xl font-black">
                  {c.alumnos || '—'}
                </td>
                <td className="px-4 py-3 text-center text-base">{c.delegaciones || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

/** Qué trae cada delegación, categoría por categoría. */
function PorDelegacion({ delegaciones, categorias, abierta, alAbrir }) {
  const cats = categorias.map((c) => c.categoria);

  return (
    <Tarjeta className="p-6">
      <h4 className="text-xl font-black text-slate-900">Qué trae cada delegación</h4>
      <p className="mt-2 text-base text-slate-600">
        Toque una fila para ver sus alumnos.
      </p>

      <div className="mt-5 overflow-x-auto rounded-2xl border-2 border-slate-200">
        <table className="w-full min-w-[56rem] text-left">
          <thead className="bg-slate-50">
            <tr className="text-base text-slate-500">
              <th className="px-4 py-3 font-semibold">N.º</th>
              <th className="px-4 py-3 font-semibold">Institución educativa</th>
              <th className="px-4 py-3 font-semibold">Tutor</th>
              <th className="px-4 py-3 font-semibold">Celular</th>
              {cats.map((c) => (
                <th key={c} className="px-2 py-3 text-center font-semibold">
                  {c}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-semibold">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {delegaciones.map((d, i) => (
              <Fila
                key={d.tutorId}
                numero={i + 1}
                delegacion={d}
                cats={cats}
                abierta={abierta === d.tutorId}
                alAbrir={() => alAbrir(d.tutorId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

function Fila({ numero, delegacion: d, cats, abierta, alAbrir }) {
  const porCategoria = {};
  for (const alumno of d.alumnos) {
    (porCategoria[alumno.categoria] ||= []).push(alumno);
  }

  return (
    <>
      <tr onClick={alAbrir} className="cursor-pointer align-top transition hover:bg-granate-50/60">
        <td className="px-4 py-3 text-base text-slate-500">{numero}</td>
        <td className="px-4 py-3">
          <span className="block text-base font-bold text-slate-900">{d.institucion}</span>
          <span className="block text-base text-slate-500">{d.modalidadLabel}</span>
        </td>
        <td className="px-4 py-3 text-base text-slate-700">{d.tutor}</td>
        <td className="px-4 py-3 text-base text-slate-600">{d.celular}</td>
        {cats.map((c) => (
          <td key={c} className="px-2 py-3 text-center text-base">
            {d.porCategoria[c] ? (
              <span className="font-black text-slate-900">{d.porCategoria[c]}</span>
            ) : (
              <span className="text-slate-300">·</span>
            )}
          </td>
        ))}
        <td className="px-4 py-3 text-center text-xl font-black text-granate-700">{d.total}</td>
        <td className="px-4 py-3 text-right">
          <ChevronDown
            className={`inline h-5 w-5 text-slate-400 transition ${abierta ? 'rotate-180' : ''}`}
          />
        </td>
      </tr>

      {abierta && (
        <tr>
          <td colSpan={cats.length + 6} className="bg-slate-50 px-4 py-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(porCategoria).map(([categoria, alumnos]) => (
                <div key={categoria} className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                  <p className="text-base font-black text-granate-700">
                    CAT. {categoria} · {alumnos.length}{' '}
                    {alumnos.length === 1 ? 'inscrito' : 'inscritos'}
                  </p>
                  <ol className="mt-3 space-y-1">
                    {alumnos.map((a, i) => (
                      <li key={a.id} className="text-base text-slate-700">
                        <span className="text-slate-400">{i + 1}.</span> {a.nombres}{' '}
                        <span className="text-slate-400">· {a.dni}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Los que su delegación manda solos a esa categoría. */
function Individuales({ filas }) {
  return (
    <Tarjeta className="p-6">
      <h4 className="text-xl font-black text-slate-900">Vienen solos</h4>
      <p className="mt-2 text-base text-slate-600">
        Su delegación aporta un único inscrito en esa categoría.
      </p>

      <div className="mt-5 overflow-x-auto rounded-2xl border-2 border-slate-200">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="bg-slate-50">
            <tr className="text-base text-slate-500">
              <th className="px-4 py-3 font-semibold">N.º</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Estudiante</th>
              <th className="px-4 py-3 font-semibold">Institución</th>
              <th className="px-4 py-3 font-semibold">Tutor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f, i) => (
              <tr key={f.dni} className="align-top">
                <td className="px-4 py-3 text-base text-slate-500">{i + 1}</td>
                <td className="px-4 py-3 text-base text-slate-700">{f.label}</td>
                <td className="px-4 py-3">
                  <span className="block text-base font-bold text-slate-900">{f.nombres}</span>
                  <span className="block text-base text-slate-500">{f.dni}</span>
                </td>
                <td className="px-4 py-3 text-base text-slate-700">{f.institucion}</td>
                <td className="px-4 py-3 text-base text-slate-600">
                  <span className="block">{f.tutor}</span>
                  <span className="block text-slate-400">{f.celular}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}
