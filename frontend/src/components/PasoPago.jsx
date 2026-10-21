import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  ImageUp,
  Loader2,
  Trash2,
} from 'lucide-react';
import { api, mensajeError } from '../lib/api';
import { ETIQUETA_GRADO, GRADOS } from '../lib/datos';
import { useAjustes } from '../lib/ajustes';
import QrYape from './QrYape.jsx';
import { Aviso, Boton, Etiqueta, Tarjeta } from './Ui.jsx';

const esPdf = (url = '') => url.toLowerCase().endsWith('.pdf');

/** El check 3D se sirve desde Cloudflare. */
const ICONO_CHECK = '/api/publico/iconos/check.png';
const soles = (valor) => `S/ ${Number(valor || 0).toLocaleString('es-PE')}`;

const ESTADOS_PAGO = {
  EN_REVISION: { texto: 'En revisión', clase: 'bg-sky-100 text-sky-800' },
  APROBADO: { texto: 'Aprobado', clase: 'bg-emerald-100 text-emerald-800' },
  RECHAZADO: { texto: 'Rechazado', clase: 'bg-rose-100 text-rose-800' },
};

const METODOS = {
  YAPE: { texto: 'Yape', logo: '/img/logos_comprobante/Yape.webp' },
  BCP: { texto: 'BCP', logo: '/img/logos_comprobante/bcp.webp' },
};

const NIVELES = [
  { clave: 'PRIMARIA', texto: 'Primaria' },
  { clave: 'SECUNDARIA', texto: 'Secundaria' },
];

/**
 * Pago por partes, en dos pantallas separadas: primero a quiénes cubre el pago
 * y después el comprobante. Mezclarlo todo en una sola hacía la página muy larga.
 */
export default function PasoPago({
  resumen,
  alCambiar,
  pantalla,
  alCambiarPantalla,
  alTerminar,
  alVerInscripciones,
  mostrarHistorial = false,
  conBotonSeguir = true,
}) {
  // La pantalla viene de afuera: son dos pasos distintos de la barra de
  // progreso, no dos pestañas internas. Sin props se maneja solo, para no
  // romper a quien lo use suelto.
  const [pantallaPropia, setPantallaPropia] = useState('seleccion');
  const activa = pantalla ?? pantallaPropia;
  const irA = alCambiarPantalla ?? setPantallaPropia;
  const [alumnos, setAlumnos] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [elegidos, setElegidos] = useState(() => new Set());
  const [error, setError] = useState('');
  const [confirmado, setConfirmado] = useState(null);

  const cargar = useCallback(async () => {
    const [lista, historial] = await Promise.all([api.get('/alumnos'), api.get('/pagos')]);
    setAlumnos(lista.data);
    setPagos(historial.data);
    setElegidos(new Set());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const precio = resumen?.precioPorAlumno || 0;
  const pendientes = useMemo(() => (alumnos || []).filter((a) => !a.paymentId), [alumnos]);
  const total = elegidos.size * precio;

  const anular = async (pago) => {
    setError('');
    try {
      await api.delete(`/pagos/${pago.id}`);
      await cargar();
      irA('seleccion');
      alCambiar?.();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo anular el comprobante'));
    }
  };

  const alEnviar = async (monto) => {
    await cargar();
    alCambiar?.();

    // Donde hay a dónde llevarlo, se muestra la confirmación: un aviso
    // chiquito no alcanzaba para cerrar algo que el tutor esperó hacer.
    if (alVerInscripciones) setConfirmado(monto);
    else alTerminar?.();
  };

  if (!alumnos) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-xl text-slate-500">
        <Loader2 className="h-7 w-7 animate-spin text-granate-600" />
        Cargando sus pagos
      </div>
    );
  }

  if (confirmado !== null) {
    return (
      <Confirmado
        alSeguir={alVerInscripciones}
        detalle={
          <>
            Recibimos su comprobante de{' '}
            <strong className="text-slate-900">{soles(confirmado)}</strong>. La comisión lo
            revisará y le avisará en su panel.
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      )}

      {pendientes.length === 0 ? (
        <Aviso tipo="exito" icono={CheckCircle2} titulo="Todos sus estudiantes están cubiertos">
          Ya no queda nadie por pagar. La comisión revisará sus comprobantes.
        </Aviso>
      ) : activa === 'seleccion' ? (
        <PantallaSeleccion
          pendientes={pendientes}
          elegidos={elegidos}
          alCambiarSeleccion={setElegidos}
          precio={precio}
          total={total}
          alSeguir={() => irA('comprobante')}
          conBotonSeguir={conBotonSeguir}
        />
      ) : elegidos.size === 0 ? (
        // Se puede llegar aqui desde el sidebar sin haber elegido a nadie. Sin
        // este aviso el tutor veia un formulario de S/ 0 que el servidor iba a
        // rechazar despues de que adjuntara la foto.
        <Tarjeta>
          <Aviso tipo="alerta" icono={AlertCircle} titulo="Primero elija a quienes paga">
            Marque en la lista a los estudiantes que cubre este comprobante y el monto se calcula
            solo.
          </Aviso>
          <div className="mt-6">
            <Boton onClick={() => irA('seleccion')}>
              <ArrowLeft className="h-6 w-6" />
              Ir a seleccionar estudiantes
            </Boton>
          </div>
        </Tarjeta>
      ) : (
        <PantallaComprobante
          elegidos={elegidos}
          total={total}
          alVolver={() => irA('seleccion')}
          alEnviar={alEnviar}
        />
      )}

      {/* En el panel el historial tiene su propia sección; aquí solo
          aparece cuando quien usa el componente lo pide. */}
      {mostrarHistorial && <Historial pagos={pagos} alAnular={anular} alCambiar={cargar} />}
    </div>
  );
}

/**
 * El check 3D con su resplandor rojo y naranja.
 *
 * Vive aparte porque lo usan las dos confirmaciones —la del panel y la del
 * asistente— y tenían que quedar idénticas. Las manchas son de color lleno y
 * difuminado: con degradado radial más blur el color se suavizaba dos veces y
 * casi no se veía.
 */
export function SelloConfirmado() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-1/2 top-4 h-72 w-72 -translate-x-1/2 sm:h-80 sm:w-80">
        <span className="animate-respirar absolute -left-6 top-4 h-48 w-48 rounded-full bg-rose-600/70 blur-2xl" />
        <span
          className="animate-respirar absolute -right-4 top-0 h-44 w-44 rounded-full bg-orange-500/75 blur-2xl"
          style={{ animationDelay: '1.3s' }}
        />
        <span
          className="animate-respirar absolute bottom-6 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-400/70 blur-2xl"
          style={{ animationDelay: '2.2s' }}
        />
      </div>

      <div className="animate-flotar relative">
        <img
          src={ICONO_CHECK}
          alt=""
          className="animate-sello mx-auto h-40 w-40 object-contain [filter:drop-shadow(0_22px_28px_rgba(22,101,52,0.45))] sm:h-48 sm:w-48"
        />
      </div>
    </div>
  );
}

/**
 * Lo que ve el tutor apenas manda algo que cierra un trámite.
 *
 * Va como ventana emergente y no como una tarjeta más de la página: el envío
 * es el final de un trámite largo y merece ocupar toda la pantalla, no
 * quedar perdido entre el formulario que acaba de llenar.
 *
 * El resplandor de atrás respira y el check entra con rebote. La quietud
 * hacía que pareciera una captura y no algo que acababa de pasar.
 *
 * La usan el envío del comprobante y la respuesta a una observación, por eso
 * el texto entra por props.
 */
export function Confirmado({
  titulo = 'Inscripción enviada',
  detalle,
  textoBoton = 'Ver mis inscripciones',
  alSeguir,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* El fondo se oscurece y se desenfoca: la atención va a la ventana. */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      <div className="animate-emerger relative w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-[0_45px_90px_-25px_rgba(15,23,42,0.6)]">
        {/* Filo claro arriba y sombra abajo: el borde deja de ser plano. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/80" />

        {/* Un lavado cálido arriba para que el resplandor tenga sobre qué
            asentarse: sobre blanco puro se perdía. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(254,215,170,0.55),transparent)]" />

        <div className="relative px-6 py-14 text-center sm:px-14 sm:py-16">
          <SelloConfirmado />

          <h3 className="relative mt-10 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            {titulo}
          </h3>
          <p className="relative mx-auto mt-5 max-w-md text-xl text-slate-600">{detalle}</p>

          <div className="relative mt-10">
            <Boton tamano="grande" onClick={alSeguir}>
              {textoBoton}
              <ArrowRight className="h-7 w-7" />
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pantalla 1

/**
 * Selección en tres franjas horizontales: nivel, grado y la tabla del grado
 * elegido. Así no hay que bajar por una lista larga para encontrar a alguien.
 */
function PantallaSeleccion({
  pendientes,
  elegidos,
  alCambiarSeleccion,
  precio,
  total,
  alSeguir,
  conBotonSeguir = true,
}) {
  const porNivel = useMemo(
    () =>
      NIVELES.map((nivel) => {
        const grados = GRADOS.filter((g) => g.nivel === nivel.clave)
          .map((g) => ({ ...g, alumnos: pendientes.filter((a) => a.grado === g.valor) }))
          .filter((g) => g.alumnos.length > 0);
        return { ...nivel, grados };
      }).filter((nivel) => nivel.grados.length > 0),
    [pendientes],
  );

  const [nivelActivo, setNivelActivo] = useState(porNivel[0]?.clave || 'PRIMARIA');
  const [gradoActivo, setGradoActivo] = useState(porNivel[0]?.grados[0]?.valor || '');

  // Al pagar un grado entero desaparece de la lista: hay que mover la pestaña.
  const nivel = porNivel.find((n) => n.clave === nivelActivo) || porNivel[0];
  const grado = nivel?.grados.find((g) => g.valor === gradoActivo) || nivel?.grados[0];

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

  const marcar = (ids, poner) =>
    alCambiarSeleccion((previos) => {
      const copia = new Set(previos);
      ids.forEach((id) => (poner ? copia.add(id) : copia.delete(id)));
      return copia;
    });

  const todos = () => alCambiarSeleccion(new Set(pendientes.map((a) => a.id)));
  const ninguno = () => alCambiarSeleccion(new Set());

  const cuenta = (lista) => lista.filter((id) => elegidos.has(id)).length;
  const idsDelGrado = grado ? grado.alumnos.map((a) => a.id) : [];
  const marcadosDelGrado = cuenta(idsDelGrado);

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-3xl font-black text-slate-900">¿A quiénes paga ahora?</h3>
        <div className="flex gap-3">
          <Boton type="button" variante="suave" tamano="chico" onClick={todos}>
            Todos
          </Boton>
          <Boton type="button" variante="suave" tamano="chico" onClick={ninguno}>
            Ninguno
          </Boton>
        </div>
      </div>
      {/* Franja 1: los niveles, uno al lado del otro. */}
      <div className="mt-8 flex gap-3 rounded-2xl bg-slate-100 p-2">
        {porNivel.map((item) => {
          const ids = item.grados.flatMap((g) => g.alumnos.map((a) => a.id));
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
                activo ? 'bg-granate-600 text-white shadow-suave' : 'text-slate-600 hover:bg-white'
              }`}
            >
              <span className="block text-xl font-black">{item.texto}</span>
              <span className={`block text-base ${activo ? 'text-granate-100' : 'text-slate-500'}`}>
                {cuenta(ids)} de {ids.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Franja 2: los grados de ese nivel, también en horizontal. */}
      {nivel && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {nivel.grados.map((item) => {
            const ids = item.alumnos.map((a) => a.id);
            const marcados = cuenta(ids);
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
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-base font-black ${
                    marcados > 0 ? 'bg-emerald-600 text-white' : 'bg-granate-600 text-white'
                  }`}
                >
                  {item.categoria}
                </span>
                <span className="text-left">
                  <span className="block text-base font-bold text-slate-900">{item.label}</span>
                  <span className="block text-base text-slate-500">
                    {marcados} de {ids.length}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Franja 3: la tabla del grado elegido. */}
      {grado && (
        <div className="mt-4 overflow-hidden rounded-2xl border-2 border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr className="text-base text-slate-500">
                <th className="w-16 py-3 pl-4">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={
                      marcadosDelGrado === idsDelGrado.length
                        ? true
                        : marcadosDelGrado > 0
                          ? 'mixed'
                          : false
                    }
                    aria-label={`Marcar ${grado.label}`}
                    onClick={() => marcar(idsDelGrado, marcadosDelGrado < idsDelGrado.length)}
                  >
                    <Casilla
                      marcada={marcadosDelGrado === idsDelGrado.length}
                      parcial={marcadosDelGrado > 0 && marcadosDelGrado < idsDelGrado.length}
                    />
                  </button>
                </th>
                <th className="py-3 pr-4 font-semibold">Estudiante</th>
                <th className="py-3 pr-4 font-semibold">DNI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grado.alumnos.map((alumno) => {
                const marcado = elegidos.has(alumno.id);
                return (
                  <tr
                    key={alumno.id}
                    onClick={() => marcar([alumno.id], !marcado)}
                    className={`cursor-pointer transition ${
                      marcado ? 'bg-granate-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 pl-4">
                      <span role="checkbox" aria-checked={marcado} aria-label={alumno.nombres}>
                        <Casilla marcada={marcado} />
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-base font-semibold text-slate-900">
                      {alumno.nombres}
                    </td>
                    <td className="py-3 pr-4 text-base text-slate-600">{alumno.dni}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-granate-50 p-6">
        <div>
          <p className="text-xl text-slate-600">
            {elegidos.size} {elegidos.size === 1 ? 'estudiante' : 'estudiantes'} × {soles(precio)}
          </p>
          <p className="mt-1 text-xl text-slate-600">A pagar con este comprobante</p>
        </div>
        <p className="text-5xl font-black text-granate-700">{soles(total)}</p>
      </div>

      {conBotonSeguir && (
        <div className="mt-8 flex justify-end">
          <Boton type="button" tamano="grande" disabled={elegidos.size === 0} onClick={alSeguir}>
            Continuar al comprobante
            <ArrowRight className="h-7 w-7" />
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}

/**
 * Solo el dibujo de la casilla: quien recibe el clic es la fila entera de la
 * tabla, para que tocar el nombre del alumno también lo marque.
 */
function Casilla({ marcada, parcial = false }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition ${
        marcada || parcial
          ? 'border-granate-600 bg-granate-600 text-white'
          : 'border-slate-300 bg-white'
      }`}
    >
      {parcial ? (
        <span className="h-0.5 w-3.5 rounded-full bg-white" />
      ) : marcada ? (
        <CheckCircle2 className="h-5 w-5" />
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------- pantalla 2

/** Método de pago y foto del comprobante, ya con la selección hecha. */
function PantallaComprobante({ elegidos, total, alVolver, alEnviar }) {
  const [metodo, setMetodo] = useState('YAPE');
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);
  const archivoRef = useRef(null);
  const { ajustes, qrYape, yape } = useAjustes();

  const elegirArchivo = (evento) => {
    const seleccionado = evento.target.files?.[0];
    if (!seleccionado) return;
    setArchivo(seleccionado);
    setVista(seleccionado.type.startsWith('image/') ? URL.createObjectURL(seleccionado) : '');
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    setExito('');
    if (!archivo) return setError('Adjunte la foto del comprobante');

    setEnviando(true);
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      formulario.append('metodo', metodo);
      formulario.append('alumnos', JSON.stringify([...elegidos]));
      await api.post('/pagos', formulario);
      setExito(`Comprobante de ${soles(total)} recibido correctamente`);
      setArchivo(null);
      setVista('');
      await alEnviar(total);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo registrar el comprobante'));
    } finally {
      setEnviando(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-8">
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-3xl font-black text-slate-900">¿Cómo pagó?</h3>
          <Boton type="button" variante="fantasma" tamano="chico" onClick={alVolver}>
            <ArrowLeft className="h-5 w-5" />
            Cambiar estudiantes
          </Boton>
        </div>
        <p className="mt-3 text-xl text-slate-600">
          {elegidos.size} {elegidos.size === 1 ? 'estudiante' : 'estudiantes'} ·{' '}
          <span className="font-black text-granate-700">{soles(total)}</span>
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <OpcionMetodo
            activo={metodo === 'YAPE'}
            alElegir={() => setMetodo('YAPE')}
            metodo="YAPE"
            detalle={yape.numero}
          />
          <OpcionMetodo
            activo={metodo === 'BCP'}
            alElegir={() => setMetodo('BCP')}
            metodo="BCP"
            detalle={ajustes.bcp?.cuenta || 'Cuenta por publicar'}
          />
        </div>

        <div className="mt-8">
          {metodo === 'YAPE' ? (
            <DatosYape qr={qrYape} datos={yape} />
          ) : (
            <DatosBcp bcp={ajustes.bcp} />
          )}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Adjuntar comprobante</h3>
        <p className="mt-3 text-xl text-slate-600">Foto legible en JPG, PNG o PDF.</p>

        <div className="mt-8 space-y-6">
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-granate-300 bg-granate-50/60 px-6 py-12 transition hover:border-granate-500 hover:bg-granate-50"
          >
            {vista ? (
              <img src={vista} alt="Vista previa" className="max-h-72 rounded-2xl object-contain" />
            ) : (
              <ImageUp className="h-14 w-14 text-granate-600" />
            )}
            <span className="text-xl font-semibold text-granate-700">
              {archivo ? archivo.name : 'Toque para elegir la imagen'}
            </span>
          </button>
          <input
            ref={archivoRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={elegirArchivo}
          />

          {error && (
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          )}
          {exito && (
            <Aviso tipo="exito" icono={CheckCircle2}>
              {exito}
            </Aviso>
          )}

          <Boton type="submit" cargando={enviando} className="w-full" tamano="grande">
            <CreditCard className="h-7 w-7" />
            Enviar comprobante de {soles(total)}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}

// ------------------------------------------------------------------- comunes

/** Cuánto lleva pagado y cuánto le falta, de un vistazo. */
function OpcionMetodo({ activo, alElegir, metodo, detalle }) {
  const { texto, logo } = METODOS[metodo];

  return (
    <button
      type="button"
      onClick={alElegir}
      className={`flex items-center gap-4 rounded-3xl border-2 p-5 text-left transition ${
        activo
          ? 'border-granate-600 bg-granate-50 shadow-suave'
          : 'border-slate-200 hover:border-granate-300'
      }`}
    >
      <LogoMetodo metodo={metodo} className="h-16 w-28" />
      <span className="min-w-0">
        <span className="block text-xl font-black text-slate-900">{texto}</span>
        <span className="block truncate text-base text-slate-600">{detalle}</span>
      </span>
      {activo && <CheckCircle2 className="ml-auto h-7 w-7 shrink-0 text-granate-600" />}
    </button>
  );
}

/**
 * Logo de la marca. Va con `object-cover` porque las imágenes traen su propio
 * fondo (morado el de Yape, azul el del BCP) y así llenan el recuadro entero.
 */
function LogoMetodo({ metodo, className = '' }) {
  const { texto, logo } = METODOS[metodo];
  return (
    <img
      src={logo}
      alt={texto}
      className={`shrink-0 rounded-2xl border border-slate-200 object-cover ${className}`}
    />
  );
}

/**
 * El QR puede ser el .jpg por defecto o el que subió la comisión, que llega
 * por la API sin extensión: sin esto el archivo se guardaba como .png aunque
 * fuera un JPG.
 */
function nombreQr(qr = '') {
  const ext = (qr.split('?')[0].match(/\.(png|jpe?g|webp)$/i) || [])[0] || '';
  return 'qr-yape-omasur' + ext.toLowerCase();
}

function DatosYape({ qr, datos }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-yape-500 via-yape-600 to-yape-800 p-8 text-white">
      <div className="flex items-start justify-between gap-4">
        <LogoMetodo metodo="YAPE" className="h-14 w-24 border-white/20" />
        {/* Para escanearlo desde otro teléfono hace falta tener el QR aparte. */}
        <a
          href={qr}
          download={nombreQr(qr)}
          aria-label="Descargar el QR"
          title="Descargar el QR"
          className="rounded-2xl bg-white/15 p-3 transition hover:bg-white/25"
        >
          <Download className="h-7 w-7" />
        </a>
      </div>
      <p className="mt-5 text-xl text-yape-100">{datos.titular}</p>
      <p className="mt-3 text-5xl font-black tracking-tight">{datos.numero}</p>
      <QrYape src={qr} className="mx-auto mt-8 w-full max-w-[15rem]" />
    </div>
  );
}

function DatosBcp({ bcp }) {
  if (!bcp?.cuenta) {
    return (
      <Aviso tipo="alerta" icono={AlertCircle}>
        La comisión todavía no publicó la cuenta del BCP. Use Yape por ahora.
      </Aviso>
    );
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-sky-700 via-sky-800 to-slate-900 p-8 text-white">
      <LogoMetodo metodo="BCP" className="h-14 w-24 border-white/20" />
      {bcp.titular && <p className="mt-5 text-xl text-sky-100">{bcp.titular}</p>}
      <p className="mt-5 text-base uppercase tracking-widest text-sky-200">Cuenta</p>
      <p className="text-4xl font-black tracking-tight">{bcp.cuenta}</p>
      {bcp.cci && (
        <>
          <p className="mt-6 text-base uppercase tracking-widest text-sky-200">CCI</p>
          <p className="text-3xl font-black tracking-tight">{bcp.cci}</p>
        </>
      )}
    </div>
  );
}

/** Todos los comprobantes enviados, con lo que cubre cada uno. */
function Historial({ pagos, alAnular, alCambiar }) {
  if (pagos.length === 0) return null;

  const suma = (estado) =>
    pagos.filter((p) => p.estado === estado).reduce((total, p) => total + p.monto, 0);

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Comprobantes enviados</h3>

      {/* Las cifras primero: es lo que el tutor viene a mirar. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Cifra texto="Aprobado" monto={suma('APROBADO')} clase="bg-emerald-50 text-emerald-800" />
        <Cifra texto="En revisión" monto={suma('EN_REVISION')} clase="bg-sky-50 text-sky-800" />
        <div className="rounded-2xl bg-slate-50 p-5">
          <p className="text-3xl font-black text-slate-900">{pagos.length}</p>
          <p className="mt-1 text-base font-semibold text-slate-600">
            {pagos.length === 1 ? 'comprobante' : 'comprobantes'}
          </p>
        </div>
      </div>

      {/* Uno por fila y cerrados: con la foto siempre abierta, tres
          comprobantes ocupaban tres pantallas. */}
      <div className="mt-6 space-y-3">
        {pagos.map((pago) => (
          <Comprobante key={pago.id} pago={pago} alAnular={alAnular} alCambiar={alCambiar} />
        ))}
      </div>
    </Tarjeta>
  );
}

function Cifra({ texto, monto, clase }) {
  return (
    <div className={`rounded-2xl p-5 ${clase}`}>
      <p className="text-3xl font-black">{soles(monto)}</p>
      <p className="mt-1 text-base font-semibold">{texto}</p>
    </div>
  );
}

/** Franja de color a la izquierda: el estado se reconoce sin leer. */
const FRANJA = {
  EN_REVISION: 'border-l-sky-400',
  APROBADO: 'border-l-emerald-500',
  RECHAZADO: 'border-l-rose-500',
};

function Comprobante({ pago, alAnular, alCambiar }) {
  const [abierto, setAbierto] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const archivoRef = useRef(null);
  const estado = ESTADOS_PAGO[pago.estado] || ESTADOS_PAGO.EN_REVISION;
  const metodo = METODOS[pago.metodo] || METODOS.YAPE;

  const reemplazar = async (evento) => {
    const nuevo = evento.target.files?.[0];
    if (!nuevo) return;
    setCambiando(true);
    try {
      const formulario = new FormData();
      formulario.append('archivo', nuevo);
      await api.put(`/pagos/${pago.id}/archivo`, formulario);
      await alCambiar();
    } finally {
      setCambiando(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border-2 border-l-8 border-slate-200 transition ${
        FRANJA[pago.estado] || FRANJA.EN_REVISION
      }`}
    >
      {/* La fila entera abre y cierra: no hace falta apuntarle a una flechita. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-slate-50"
      >
        <MiniaturaComprobante url={pago.archivoUrl} />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xl font-black text-slate-900">{soles(pago.monto)}</span>
            <LogoMetodo
              metodo={pago.metodo in METODOS ? pago.metodo : 'YAPE'}
              className="h-6 w-10"
            />
          </span>
          <span className="mt-1 block text-base text-slate-600">
            {pago.totalAlumnos} {pago.totalAlumnos === 1 ? 'estudiante' : 'estudiantes'} ·{' '}
            {new Date(pago.createdAt).toLocaleDateString('es-PE', {
              day: '2-digit',
              month: 'short',
            })}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <Etiqueta compacto className={estado.clase}>
            {estado.texto}
          </Etiqueta>
          <ChevronDown
            className={`h-6 w-6 text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {pago.observacion && (
        <p className="border-t border-slate-100 bg-rose-50 px-4 py-3 text-base text-rose-800">
          {pago.observacion}
        </p>
      )}

      {abierto && (
        <div className="border-t border-slate-100 p-4">
          <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
            <div>
              <p className="text-base font-bold text-slate-700">
                {metodo.texto} · {pago.totalAlumnos}{' '}
                {pago.totalAlumnos === 1 ? 'estudiante' : 'estudiantes'}
              </p>
              <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl bg-slate-50">
                {pago.alumnos.map((alumno) => (
                  <li
                    key={alumno.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
                      {alumno.nombres}
                    </span>
                    <span className="shrink-0 text-base text-slate-500">
                      {alumno.dni} · {ETIQUETA_GRADO[alumno.grado] || alumno.gradoLabel}
                    </span>
                  </li>
                ))}
              </ul>

              {pago.estado !== 'APROBADO' && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Boton
                    variante="contorno"
                    tamano="chico"
                    cargando={cambiando}
                    onClick={() => archivoRef.current?.click()}
                  >
                    <ImageUp className="h-5 w-5" />
                    Cambiar foto
                  </Boton>
                  <input
                    ref={archivoRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={reemplazar}
                  />
                  <Boton variante="peligro" tamano="chico" onClick={() => alAnular(pago)}>
                    <Trash2 className="h-5 w-5" />
                    Anular
                  </Boton>
                </div>
              )}
            </div>

            <VistaComprobante url={pago.archivoUrl} alto="max-h-60" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Trae el comprobante con la sesión y lo deja en memoria. Se comparte entre
 * la vista grande y la miniatura para no pedir el mismo archivo dos veces con
 * dos códigos distintos.
 */
function useArchivo(url) {
  const [archivo, setArchivo] = useState({ estado: 'cargando', src: '', tipo: '' });

  useEffect(() => {
    if (!url) return undefined;

    let vivo = true;
    let objeto = '';

    (async () => {
      try {
        const { data } = await api.get(url.replace(/^\/api/, ''), { responseType: 'blob' });
        if (!vivo) return;
        objeto = URL.createObjectURL(data);
        setArchivo({ estado: 'listo', src: objeto, tipo: data.type });
      } catch {
        if (vivo) setArchivo({ estado: 'error', src: '', tipo: '' });
      }
    })();

    return () => {
      vivo = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [url]);

  return archivo;
}

/** Miniatura cuadrada, para reconocer el comprobante de un vistazo. */
function MiniaturaComprobante({ url }) {
  const archivo = useArchivo(url);
  const esPdfArchivo = archivo.tipo === 'application/pdf' || esPdf(url);

  if (archivo.estado === 'listo' && !esPdfArchivo) {
    return (
      <img
        src={archivo.src}
        alt=""
        className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 object-cover"
      />
    );
  }

  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
      {archivo.estado === 'cargando' ? (
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      ) : (
        <FileText className="h-7 w-7 text-slate-400" />
      )}
    </span>
  );
}

export function VistaComprobante({ url, alto = 'max-h-96' }) {
  const [archivo, setArchivo] = useState({ estado: 'cargando', src: '', tipo: '' });

  useEffect(() => {
    if (!url) return undefined;

    let vivo = true;
    let objeto = '';

    (async () => {
      try {
        const { data } = await api.get(url.replace(/^\/api/, ''), { responseType: 'blob' });
        if (!vivo) return;
        objeto = URL.createObjectURL(data);
        setArchivo({ estado: 'listo', src: objeto, tipo: data.type });
      } catch {
        if (vivo) setArchivo({ estado: 'error', src: '', tipo: '' });
      }
    })();

    return () => {
      vivo = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [url]);

  if (archivo.estado === 'cargando') {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-8 text-base text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-granate-600" />
        Cargando comprobante
      </div>
    );
  }

  if (archivo.estado === 'error') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-rose-200 bg-rose-50 p-6 text-base text-rose-800">
        <AlertCircle className="h-6 w-6 shrink-0" />
        No se pudo cargar el comprobante.
      </div>
    );
  }

  if (archivo.tipo === 'application/pdf' || esPdf(url)) {
    return (
      <a
        href={archivo.src}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-6 transition hover:border-granate-400"
      >
        <FileText className="h-10 w-10 text-granate-600" />
        <span className="text-xl font-semibold text-granate-700">Abrir comprobante en PDF</span>
      </a>
    );
  }

  return (
    <a href={archivo.src} target="_blank" rel="noreferrer" className="block">
      <img
        src={archivo.src}
        alt="Comprobante de pago"
        className={`w-full rounded-2xl border-2 border-white bg-white object-contain ${alto}`}
      />
    </a>
  );
}
