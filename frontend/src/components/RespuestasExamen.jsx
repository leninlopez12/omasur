import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, PlayCircle, Send, Upload } from 'lucide-react';
import { Aviso, Boton, Cargando, Tarjeta } from './Ui.jsx';
import { Confirmado, SelloConfirmado } from './PasoPago.jsx';
import { api, descargar, mensajeError } from '../lib/api';
import { useAjustes } from '../lib/ajustes';
import { GRADOS } from '../lib/datos';

export const ICONO_EXCEL = '/api/publico/iconos/excel.png';

/** El mismo color de cada alternativa que en el Excel. Ninguno rojo. */
export const COLOR_ALTERNATIVA = {
  A: 'bg-blue-100 text-blue-800',
  B: 'bg-emerald-100 text-emerald-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-violet-100 text-violet-800',
  E: 'bg-cyan-100 text-cyan-800',
  BLANCO: 'bg-slate-200 text-slate-600',
};

/**
 * Panel del tutor > Enviar respuestas del examen.
 *
 * Tres pasos y nada más: baja el Excel con su delegación, lo marca, lo sube.
 * Antes de enviar se le muestra cómo quedó, porque un archivo mal llenado no
 * se puede deshacer una vez corregido.
 */
export default function RespuestasExamen() {
  const [estado, setEstado] = useState(null);
  const [revision, setRevision] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');
  const [enviado, setEnviado] = useState(null);
  const archivoRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/examen/estado');
      setEstado(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar el estado del examen'));
      setEstado({ abierto: false });
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!estado) return <Cargando texto="Cargando" />;

  const bajar = async () => {
    setError('');
    setProcesando('bajar');
    try {
      await descargar('/examen/plantilla');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar el Excel'));
    } finally {
      setProcesando('');
    }
  };

  const elegir = async (evento) => {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    setArchivo(elegido);
    setRevision(null);
    setError('');
    setProcesando('revisar');

    try {
      const formulario = new FormData();
      formulario.append('archivo', elegido);
      const { data } = await api.post('/examen/revisar', formulario);
      setRevision(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo leer el archivo'));
      setArchivo(null);
    } finally {
      setProcesando('');
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  const enviar = async () => {
    const seguro = window.confirm(
      `Va a enviar las respuestas de ${revision.filas.length} estudiantes.\n\n` +
        'Revise que estén bien: después no podrá cambiarlas sin avisar a la comisión. ¿Enviar?',
    );
    if (!seguro) return;

    setError('');
    setProcesando('enviar');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      const { data } = await api.post('/examen/enviar', formulario);
      setEnviado(data.total);
      setRevision(null);
      setArchivo(null);
      await cargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron enviar las respuestas'));
    } finally {
      setProcesando('');
    }
  };

  if (enviado !== null) {
    return (
      <Confirmado
        titulo="Respuestas enviadas"
        detalle={`Recibimos las alternativas de ${enviado} ${
          enviado === 1 ? 'estudiante' : 'estudiantes'
        } de su delegación.`}
        textoBoton="Entendido"
        alSeguir={() => setEnviado(null)}
      />
    );
  }

  if (estado.entrega) {
    const porComision = estado.entrega.porComision;
    return (
      <Tarjeta>
        <div className="py-8 text-center">
          <SelloConfirmado />
          <h3 className="mt-12 text-3xl font-black text-slate-900">
            {porComision ? 'Talonario de respuestas ya revisado' : 'Respuestas enviadas'}
          </h3>
          <p className="mt-3 text-xl text-slate-600">
            {porComision
              ? 'La comisión registró las respuestas de su delegación.'
              : `${estado.entrega.total} ${
                  estado.entrega.total === 1 ? 'estudiante' : 'estudiantes'
                }, el ${new Date(estado.entrega.enviadoEn).toLocaleString('es-PE', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}.`}
          </p>
        </div>
      </Tarjeta>
    );
  }

  if (!estado.abierto) {
    return (
      <Tarjeta>
        <img src={ICONO_EXCEL} alt="" className="h-16 w-16 object-contain" />
        <h3 className="mt-6 text-3xl font-black text-slate-900">Respuestas del examen</h3>
        <div className="mt-6">
          <Aviso tipo="alerta" icono={AlertCircle} titulo="Todavía no está habilitado">
            La comisión abre el envío después del examen. Le avisaremos en su panel.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-8">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-5">
            <img src={ICONO_EXCEL} alt="" className="h-16 w-16 shrink-0 object-contain" />
            <div>
              <h3 className="text-3xl font-black text-slate-900">
                1 · Descargar y llenar las respuestas del examen
              </h3>
              <p className="mt-2 text-xl text-slate-600">
                Llenar las respuestas de toda su delegación correctamente, descargue y súbalo.
              </p>
            </div>
          </div>
          <Boton
            variante="excel"
            className="animate-latido"
            cargando={procesando === 'bajar'}
            onClick={bajar}
          >
            <Download className="h-6 w-6" />
            Descargar Excel
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">2 · Suba el Excel llenado</h3>
        <p className="mt-2 text-xl text-slate-600">
          Marque A, B, C, D, E o BLANCO en cada pregunta.
        </p>

        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          className="mt-8 flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-emerald-300 bg-[linear-gradient(145deg,#F0FDF4_0%,#D7F7E4_45%,#A7F3D0_100%)] px-6 py-12 shadow-[0_18px_36px_-20px_rgba(15,23,42,0.45)] transition hover:border-emerald-500"
        >
          <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/70 shadow-[0_12px_24px_-10px_rgba(15,23,42,0.45)]">
            <Upload className="h-11 w-11 text-emerald-700" />
          </span>
          <span className="text-2xl font-black text-slate-900">
            {archivo ? archivo.name : 'Toque para elegir el Excel'}
          </span>
          <span className="text-lg text-slate-700">Solo el archivo que descargó arriba.</span>
        </button>
        <input
          ref={archivoRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={elegir}
        />

        {procesando === 'revisar' && (
          <div className="mt-6">
            <Cargando texto="Revisando el archivo" />
          </div>
        )}

        {error && (
          <div className="mt-6">
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          </div>
        )}
      </Tarjeta>

      {revision && (
        <Revision
          revision={revision}
          enviando={procesando === 'enviar'}
          alEnviar={enviar}
        />
      )}
    </div>
  );
}

/** Lo que se leyó del archivo, antes de mandarlo. */
function Revision({ revision, enviando, alEnviar }) {
  const { filas, errores, faltantes } = revision;
  const hayErrores = errores.length > 0;

  // Una tabla por categoría y no una sola lista: el tutor revisa el examen
  // que acaba de rendir cada grado, y mezclarlos obliga a buscar fila por fila.
  const categorias = [...new Set(filas.map((f) => f.categoria))].sort().map((categoria) => ({
    categoria,
    alumnos: filas.filter((f) => f.categoria === categoria),
  }));

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">3 · Revise y envíe</h3>

      {hayErrores ? (
        <div className="mt-6">
          <Aviso tipo="error" icono={AlertCircle} titulo={`${errores.length} por corregir`}>
            <ul className="mt-2 space-y-1">
              {errores.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {errores.length > 10 && <li>…y {errores.length - 10} más.</li>}
            </ul>
          </Aviso>
        </div>
      ) : (
        <p className="mt-2 text-xl text-slate-600">
          {filas.length} {filas.length === 1 ? 'estudiante leído' : 'estudiantes leídos'}, sin
          errores.
        </p>
      )}

      {faltantes.length > 0 && (
        <div className="mt-6">
          <Aviso tipo="alerta" icono={AlertCircle} titulo={`${faltantes.length} sin respuestas`}>
            {faltantes.slice(0, 6).join(', ')}
            {faltantes.length > 6 ? ` y ${faltantes.length - 6} más` : ''}. Si no rindieron, puede
            enviar igual.
          </Aviso>
        </div>
      )}

      {categorias.map(({ categoria, alumnos }) => (
        <PorCategoria key={categoria} categoria={categoria} alumnos={alumnos} />
      ))}

      <div className="mt-8 flex justify-end">
        <Boton tamano="grande" cargando={enviando} disabled={hayErrores || filas.length === 0} onClick={alEnviar}>
          <Send className="h-7 w-7" />
          Enviar respuestas
        </Boton>
      </div>
    </Tarjeta>
  );
}

/** El bloque de una categoría dentro de la revisión. */
function PorCategoria({ categoria, alumnos }) {
  const grado = GRADOS.find((g) => g.categoria === categoria);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h4 className="text-2xl font-black text-granate-700">CAT. {categoria}</h4>
        <span className="text-lg text-slate-600">
          {grado?.label} · {alumnos.length}{' '}
          {alumnos.length === 1 ? 'estudiante' : 'estudiantes'}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-slate-200">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="bg-slate-50">
            <tr className="text-base text-slate-500">
              <th className="px-4 py-3 font-semibold">Estudiante</th>
              <th className="px-4 py-3 font-semibold">Respuestas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alumnos.map((fila) => (
              <tr key={fila.dni} className="align-middle">
                <td className="px-4 py-3">
                  <span className="block text-base font-bold text-slate-900">{fila.nombres}</span>
                  <span className="block text-base text-slate-500">{fila.dni}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {fila.respuestas.map((r, i) => (
                      <span
                        key={i}
                        title={`Pregunta ${i + 1}`}
                        className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg px-1.5 text-sm font-bold ${
                          COLOR_ALTERNATIVA[r] || COLOR_ALTERNATIVA.BLANCO
                        }`}
                      >
                        {r === 'BLANCO' ? '–' : r}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * La ventana que recibe al tutor cuando el envío está abierto.
 *
 * Vuelve a salir en cada entrada mientras no haya enviado: es el único aviso
 * que tiene y olvidarse de mandar las respuestas no tiene vuelta atrás. Deja
 * de aparecer en cuanto hay una entrega, sea suya o de la comisión.
 */
export function AvisoExamen({ abierto, yaEnvio, alIr }) {
  const [cerrado, setCerrado] = useState(false);
  const { ajustes } = useAjustes();
  const tutorial = ajustes.tutorialExamen;

  const cerrar = () => setCerrado(true);

  if (cerrado || !abierto || yaEnvio) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={cerrar} />

      <div className="animate-emerger relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-[0_45px_90px_-25px_rgba(15,23,42,0.6)] ring-1 ring-sky-200">
        {/* Celeste, granate y naranja en diagonal, con brillo: el mismo
            relieve que usa el comunicado de la portada. */}
        <div className="relative bg-[linear-gradient(145deg,#E0F2FE_0%,#A5DBFB_28%,#F59E0B_72%,#7B1E2B_100%)] px-6 py-9 text-center sm:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_0%,rgba(255,255,255,0.75),transparent_55%)]" />

          <span className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white/80 shadow-[0_14px_28px_-12px_rgba(15,23,42,0.55)]">
            <img
              src={ICONO_EXCEL}
              alt=""
              className="h-16 w-16 object-contain [filter:drop-shadow(0_8px_12px_rgba(15,23,42,0.35))]"
            />
          </span>

          <h2 className="relative mt-6 text-balance text-2xl font-black leading-tight text-slate-900 sm:text-3xl">
            Ya puede enviar las respuestas del examen
          </h2>
        </div>

        <div className="px-6 py-7 text-center sm:px-10">
          <p className="text-lg text-slate-700 sm:text-xl">
            Descargue el Excel con sus estudiantes, marque las alternativas y súbalo.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Boton
              variante="excel"
              className="animate-latido"
              onClick={async () => {
                await descargar('/examen/plantilla');
              }}
            >
              <FileSpreadsheet className="h-6 w-6" />
              Descargar Excel
            </Boton>
            <Boton
              onClick={() => {
                cerrar();
                alIr();
              }}
            >
              <Send className="h-6 w-6" />
              Enviar respuestas del examen
            </Boton>
          </div>

          {tutorial && (
            <a
              href={tutorial}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center justify-center gap-2 text-lg font-bold text-granate-700 underline underline-offset-4 transition hover:text-granate-900"
            >
              <PlayCircle className="h-6 w-6" />
              Ver tutorial
            </a>
          )}

          <button
            onClick={cerrar}
            className="mt-6 block w-full text-lg font-semibold text-slate-500 transition hover:text-slate-700"
          >
            Después
          </button>
        </div>
      </div>
    </div>
  );
}
