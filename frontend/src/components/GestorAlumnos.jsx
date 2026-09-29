import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { api, descargar, mensajeError } from '../lib/api';
import { ETIQUETA_GRADO, GRADOS, gradosDeNivel } from '../lib/datos';
import { Aviso, Boton, Campo, Selector, Tarjeta } from './Ui.jsx';

const VACIO = { dni: '', nombres: '', grado: '' };

/** El icono 3D de Excel se sirve desde Cloudflare. */
const ICONO_EXCEL = '/api/publico/iconos/excel.png';

const NIVELES = [
  { clave: 'PRIMARIA', texto: 'Primaria' },
  { clave: 'SECUNDARIA', texto: 'Secundaria' },
];

/** "3ro de primaria" -> "3ro prim.": la franja tiene que caber en una línea. */
const gradoCorto = (label) =>
  label.replace(' de primaria', ' prim.').replace(' de secundaria', ' sec.');

export default function GestorAlumnos({ resumen, alCambiar }) {
  // Solo los grados del nivel que declaró la institución: el servidor rechaza
  // los demás, así que no tiene sentido ofrecerlos.
  const grados = gradosDeNivel(resumen?.nivelInstitucion);
  const [alumnos, setAlumnos] = useState([]);
  const [nuevo, setNuevo] = useState(VACIO);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [importacion, setImportacion] = useState(null);
  const archivoRef = useRef(null);

  const cargar = async () => {
    const { data } = await api.get('/alumnos');
    setAlumnos(data);
  };

  useEffect(() => {
    cargar();
  }, []);

  const refrescar = async () => {
    await cargar();
    alCambiar?.();
  };

  const agregar = async (evento) => {
    evento.preventDefault();
    setError('');
    setExito('');
    setGuardando(true);
    try {
      await api.post('/alumnos', nuevo);
      setNuevo(VACIO);
      setExito('Estudiante registrado correctamente');
      await refrescar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo registrar al estudiante'));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id, nombres) => {
    if (!window.confirm(`¿Quitar a ${nombres} de la delegación?`)) return;
    await api.delete(`/alumnos/${id}`);
    await refrescar();
  };

  const subirExcel = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setError('');
    setExito('');
    setImportacion(null);
    setSubiendo(true);
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      const { data } = await api.post('/alumnos/importar', formulario);
      setImportacion(data);
      await refrescar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo leer el archivo'));
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  const filtrados = alumnos.filter((a) => {
    const texto = `${a.nombres} ${a.dni}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  // Los alumnos repartidos por nivel y grado, igual que en el paso del pago:
  // con muchos grados en una sola tabla se pierde de vista quién es de dónde.
  const porNivel = useMemo(
    () =>
      NIVELES.map((nivel) => ({
        ...nivel,
        grados: GRADOS.filter((g) => g.nivel === nivel.clave)
          .map((g) => ({ ...g, alumnos: alumnos.filter((a) => a.grado === g.valor) }))
          .filter((g) => g.alumnos.length > 0),
      })).filter((nivel) => nivel.grados.length > 0),
    [alumnos],
  );

  const totalGrados = porNivel.reduce((suma, n) => suma + n.grados.length, 0);
  // Con un solo grado no hay nada que separar, y buscar cruza todos los grados.
  const agrupado = totalGrados > 1 && !busqueda;

  const [nivelActivo, setNivelActivo] = useState('PRIMARIA');
  const [gradoActivo, setGradoActivo] = useState('');

  const nivel = porNivel.find((n) => n.clave === nivelActivo) || porNivel[0];
  const grado = nivel?.grados.find((g) => g.valor === gradoActivo) || nivel?.grados[0];

  // Al borrar al último de un grado, ese grado desaparece: hay que mover la
  // pestaña o quedaría apuntando a algo que ya no existe.
  useEffect(() => {
    if (!porNivel.length) return;
    if (!porNivel.some((n) => n.clave === nivelActivo)) {
      setNivelActivo(porNivel[0].clave);
      setGradoActivo(porNivel[0].grados[0].valor);
      return;
    }
    const actual = porNivel.find((n) => n.clave === nivelActivo);
    if (!actual.grados.some((g) => g.valor === gradoActivo)) {
      setGradoActivo(actual.grados[0].valor);
    }
  }, [porNivel, nivelActivo, gradoActivo]);

  const enTabla = agrupado ? grado?.alumnos || [] : filtrados;

  const validacion = resumen?.validacion;

  /**
   * Qué falta, en números. Los alumnos "fuera" se deducen restando: porGrado
   * solo trae los grados del nivel declarado, así que si la suma no llega al
   * total es que hay alumnos de un nivel que la institución ya no declara.
   */
  const faltantes = [];
  if (validacion) {
    const enGrados = validacion.porGrado.reduce((suma, g) => suma + g.cantidad, 0);
    const fuera = validacion.total - enGrados;
    const faltan = validacion.minimoTotal - validacion.total;
    const cortos = validacion.porGrado.filter((g) => g.cantidad > 0 && !g.cumple).length;

    if (faltan > 0) faltantes.push(`Faltan ${faltan} estudiantes`);
    if (cortos > 0) faltantes.push(`${cortos} grado${cortos > 1 ? 's' : ''} sin el mínimo`);
    if (fuera > 0) faltantes.push(`${fuera} fuera de su nivel`);
  }

  return (
    <div className="space-y-8">
      {/* Registro múltiple */}
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* El icono 3D viene de Cloudflare, no del sitio. */}
            <img
              src={ICONO_EXCEL}
              alt=""
              className="h-20 w-20 shrink-0 object-contain drop-shadow-md"
            />
            <div>
              <h3 className="text-3xl font-black text-slate-900">Registro múltiple</h3>
              <p className="mt-3 text-xl text-slate-600">
                Descargue el Excel, complételo y súbalo aquí.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Boton
              variante="excelContorno"
              tamano="compacto"
              onClick={() => descargar('/alumnos/plantilla', 'plantilla-omasur-2026.xlsx')}
            >
              <Download className="h-6 w-6" />
              Descargar Excel
            </Boton>
            <Boton
              variante="excel"
              tamano="compacto"
              cargando={subiendo}
              onClick={() => archivoRef.current?.click()}
            >
              <Upload className="h-6 w-6" />
              Subir Excel
            </Boton>
            <input
              ref={archivoRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={subirExcel}
            />
          </div>
        </div>

        {importacion && (
          <div className="mt-8 space-y-4">
            <Aviso
              tipo={importacion.errores.length ? 'alerta' : 'exito'}
              icono={importacion.errores.length ? AlertCircle : CheckCircle2}
              titulo={`${importacion.creados} estudiantes registrados`}
            >
              {importacion.errores.length
                ? `${importacion.errores.length} filas necesitan corrección.`
                : 'Todas las filas se cargaron sin problemas.'}
            </Aviso>

            {importacion.errores.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-2xl border-2 border-rose-100 bg-rose-50 p-6">
                {importacion.errores.map((fallo, i) => (
                  <p key={`${fallo.fila}-${i}`} className="py-1.5 text-xl text-rose-800">
                    Fila {fallo.fila} · {fallo.dni || 'sin DNI'} · {fallo.motivo}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Tarjeta>

      {/* Registro individual */}
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Registrar uno por uno</h3>

        <form onSubmit={agregar} className="mt-8 grid gap-5 lg:grid-cols-[1fr_2fr_1.4fr_auto]">
          <Campo
            etiqueta="DNI"
            required
            inputMode="numeric"
            maxLength={8}
            placeholder="12345678"
            value={nuevo.dni}
            onChange={(e) => setNuevo({ ...nuevo, dni: e.target.value.replace(/\D/g, '') })}
          />
          <Campo
            etiqueta="Nombres y apellidos"
            required
            placeholder="Nombre del estudiante"
            value={nuevo.nombres}
            onChange={(e) => setNuevo({ ...nuevo, nombres: e.target.value })}
          />
          <Selector
            etiqueta="Grado"
            required
            value={nuevo.grado}
            onChange={(e) => setNuevo({ ...nuevo, grado: e.target.value })}
          >
            <option value="">Seleccione</option>
            {grados.map((g) => (
              <option key={g.valor} value={g.valor}>
                CAT. {g.categoria} · {g.label}
              </option>
            ))}
          </Selector>
          <div className="flex items-end">
            <Boton type="submit" cargando={guardando} className="w-full lg:w-auto">
              <Plus className="h-6 w-6" />
              Agregar
            </Boton>
          </div>
        </form>

        {error && (
          <div className="mt-6">
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          </div>
        )}
        {exito && (
          <div className="mt-6">
            <Aviso tipo="exito" icono={CheckCircle2}>
              {exito}
            </Aviso>
          </div>
        )}
      </Tarjeta>

      {/* Avance: todo en una franja, que antes ocupaba media pantalla */}
      {validacion && (
        <Tarjeta className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-xl font-black text-slate-900">Avance</h3>
            <span
              className={`rounded-full px-3 py-1 text-base font-bold ${
                validacion.puedeEnviar
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {validacion.total} de {validacion.minimoTotal}
            </span>

            {validacion.total === 0 ? (
              <span className="text-base text-slate-500">Aún no hay estudiantes.</span>
            ) : (
              <>
                <span className="h-6 w-px bg-slate-200" />
                {validacion.porGrado
                  .filter((g) => g.cantidad > 0)
                  .map((g) => (
                    <span
                      key={g.grado}
                      className={`rounded-full px-3 py-1 text-base font-semibold ${
                        g.cumple ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {gradoCorto(g.label)}{' '}
                      <span className="font-black">
                        {g.cantidad}
                        {g.minimo > 0 && `/${g.minimo}`}
                      </span>
                    </span>
                  ))}
              </>
            )}
          </div>

          {/* Los chips ya dicen qué grado va corto: aquí solo el recuento. El
              detalle completo sigue en el Resumen y en la Confirmación. */}
          {faltantes.length > 0 && (
            <p className="mt-3 flex items-center gap-2 text-base text-amber-800">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{faltantes.join(' · ')}</span>
            </p>
          )}
        </Tarjeta>
      )}

      {/* Listado */}
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
            <Users className="h-9 w-9 text-granate-600" />
            Delegación ({alumnos.length})
          </h3>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o DNI"
                className="w-full rounded-2xl border-2 border-slate-200 py-3 pl-14 pr-5 text-xl outline-none focus:border-granate-600 sm:w-80"
              />
            </div>
            {alumnos.length > 0 && (
              <Boton
                variante="suave"
                tamano="compacto"
                onClick={() => descargar('/alumnos/exportar', 'delegacion-omasur-2026.xlsx')}
              >
                <FileSpreadsheet className="h-6 w-6" />
                Exportar
              </Boton>
            )}
          </div>
        </div>

        {alumnos.length === 0 ? (
          <div className="mt-10 rounded-3xl border-2 border-dashed border-slate-200 py-16 text-center">
            <Users className="mx-auto h-14 w-14 text-slate-300" />
            <p className="mt-5 text-xl text-slate-500">Todavía no hay estudiantes inscritos.</p>
          </div>
        ) : (
          <>
            {/* Con más de un grado se navega como en el paso del pago: primero
                el nivel, después el grado, y la tabla muestra solo ese grado. */}
            {agrupado && (
              <>
                {porNivel.length > 1 && (
                  <div className="mt-8 flex gap-3 rounded-2xl bg-slate-100 p-2">
                    {porNivel.map((item) => {
                      const total = item.grados.reduce((s, g) => s + g.alumnos.length, 0);
                      const activo = item.clave === nivel?.clave;
                      return (
                        <button
                          key={item.clave}
                          type="button"
                          onClick={() => {
                            setNivelActivo(item.clave);
                            setGradoActivo(item.grados[0].valor);
                          }}
                          className={`flex-1 rounded-xl px-5 py-3 text-center transition ${
                            activo
                              ? 'bg-granate-600 text-white shadow-suave'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          <span className="block text-xl font-black">{item.texto}</span>
                          <span
                            className={`block text-base ${activo ? 'text-granate-100' : 'text-slate-500'}`}
                          >
                            {total} {total === 1 ? 'estudiante' : 'estudiantes'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {nivel && (
                  <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                    {nivel.grados.map((item) => {
                      const activo = item.valor === grado?.valor;
                      return (
                        <button
                          key={item.valor}
                          type="button"
                          onClick={() => setGradoActivo(item.valor)}
                          className={`flex shrink-0 items-center gap-3 rounded-2xl border-2 px-4 py-3 transition ${
                            activo
                              ? 'border-granate-600 bg-granate-50'
                              : 'border-slate-200 hover:border-granate-300'
                          }`}
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-granate-600 text-base font-black text-white">
                            {item.categoria}
                          </span>
                          <span className="text-left">
                            <span className="block text-base font-bold text-slate-900">
                              {item.label}
                            </span>
                            <span className="block text-base text-slate-500">
                              {item.alumnos.length}{' '}
                              {item.alumnos.length === 1 ? 'estudiante' : 'estudiantes'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div className={`overflow-x-auto ${agrupado ? 'mt-4' : 'mt-8'}`}>
              <table className="w-full min-w-[46rem] text-left">
                <thead>
                  <tr className="border-b-2 border-slate-100 text-xl text-slate-500">
                    <th className="pb-4 pr-4 font-semibold">DNI</th>
                    <th className="pb-4 pr-4 font-semibold">Estudiante</th>
                    {/* Agrupado la columna sobra: el grado lo dice la pestaña. */}
                    {!agrupado && <th className="pb-4 pr-4 font-semibold">Grado</th>}
                    <th className="pb-4 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {enTabla.map((alumno) => (
                    <tr
                      key={alumno.id}
                      className="border-b border-slate-100 hover:bg-granate-50/60"
                    >
                      <td className="py-5 pr-4 text-xl font-bold text-granate-700">{alumno.dni}</td>
                      <td className="py-5 pr-4 text-xl text-slate-900">{alumno.nombres}</td>
                      {!agrupado && (
                        <td className="py-5 pr-4 text-xl text-slate-700">
                          {ETIQUETA_GRADO[alumno.grado]}
                        </td>
                      )}
                      <td className="py-5 text-right">
                        <button
                          onClick={() => eliminar(alumno.id, alumno.nombres)}
                          aria-label="Quitar estudiante"
                          className="rounded-xl p-3 text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-6 w-6" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {enTabla.length === 0 && (
                <p className="py-10 text-center text-xl text-slate-500">Sin coincidencias.</p>
              )}
            </div>
          </>
        )}
      </Tarjeta>
    </div>
  );
}
