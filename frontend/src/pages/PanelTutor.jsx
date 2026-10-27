import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Download,
  IdCard,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Send,
  ReceiptText,
  Search,
  Settings,
  Trophy,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import PanelLayout from '../layouts/PanelLayout.jsx';
import BarraPasos from '../components/BarraPasos.jsx';
import Campanita from '../components/Campanita.jsx';
import AvisosEnVivo from '../components/AvisosEnVivo.jsx';
import { NotificacionesProvider } from '../lib/notificaciones.jsx';
import GestorAlumnos from '../components/GestorAlumnos.jsx';
import PasoPago, { Confirmado } from '../components/PasoPago.jsx';
import MisInscripciones from '../components/MisInscripciones.jsx';
import RespuestasExamen, { AvisoExamen } from '../components/RespuestasExamen.jsx';
import MiClasificacion from '../components/MiClasificacion.jsx';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Etiqueta,
  Selector,
  SelectorOpciones,
  Tarjeta,
} from '../components/Ui.jsx';
import SelectorUbigeo from '../components/SelectorUbigeo.jsx';
import { api, descargar, mensajeError } from '../lib/api';
import { volverAMiCuenta } from '../lib/suplantar';
import { useAuth } from '../lib/auth.jsx';
import {
  ESTADOS,
  ETIQUETA_MODALIDAD,
  GRADOS,
  ETIQUETA_NIVEL,
  MODALIDADES,
  NIVELES_INSTITUCION,
} from '../lib/datos';

const SECCIONES = [
  { id: 'examen', texto: 'Enviar respuestas del examen', icono: FileSpreadsheet },
  { id: 'clasificacion', texto: 'Clasificación', icono: Trophy },
  { id: 'resumen', texto: 'Resumen', icono: LayoutDashboard },
  { id: 'alumnos', texto: 'Estudiantes', icono: Users },
  { id: 'pago-quienes', texto: 'Seleccionar estudiantes', icono: UserCheck },
  { id: 'pago', texto: 'Comprobante de pago', icono: CreditCard },
  { id: 'historial', texto: 'Inscripciones', icono: ReceiptText },
  { id: 'credenciales', texto: 'Credenciales', icono: IdCard },
  { id: 'mi-credencial', texto: 'Mi credencial', icono: BadgeCheck },
];

/** Va abajo del sidebar, junto a cerrar sesión. */
const SECCIONES_PIE = [{ id: 'datos', texto: 'Mis datos', icono: Settings }];

const TITULOS = {
  examen: 'Respuestas del examen',
  clasificacion: 'Clasificación de mi delegación',
  resumen: 'Resumen de mi inscripción',
  alumnos: 'Mis estudiantes',
  'pago-quienes': 'Pago de la delegación',
  pago: 'Comprobante de pago',
  credenciales: 'Credenciales de mis estudiantes',
  'mi-credencial': 'Mi credencial',
  historial: 'Inscripciones',
  datos: 'Mis datos',
};

export default function PanelTutor() {
  return (
    <NotificacionesProvider>
      <Contenido />
    </NotificacionesProvider>
  );
}

function Contenido() {
  const [seccion, setSeccion] = useState('resumen');
  const [resumen, setResumen] = useState(null);
  const [examen, setExamen] = useState(null);
  // La clasificación aparece recién cuando la comisión publica su tanda.
  const [clasificado, setClasificado] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await api.get('/tutores/resumen');
    setResumen(data);
  }, []);

  useEffect(() => {
    cargar();
    api
      .get('/examen/estado')
      .then(({ data }) => setExamen(data))
      .catch(() => setExamen(null));

    api
      .get('/resultados/mi-clasificacion')
      .then(({ data }) => setClasificado(Boolean(data.publicado)))
      .catch(() => setClasificado(false));
  }, [cargar]);

  // El examen solo existe para las delegaciones aprobadas; al resto ni se les
  // nombra. Y se resalta únicamente mientras haya algo que hacer: una vez
  // enviadas las respuestas —o llenadas por la comisión— deja de ser urgente.
  const secciones = SECCIONES.filter(
    (s) =>
      (s.id !== 'examen' || examen?.habilitado) && (s.id !== 'clasificacion' || clasificado),
  ).map((s) =>
    s.id === 'examen' ? { ...s, destacado: Boolean(examen?.abierto && !examen?.entrega) } : s,
  );

  return (
    <PanelLayout
      titulo={TITULOS[seccion]}
      secciones={secciones}
      seccionesPie={SECCIONES_PIE}
      actual={seccion}
      alCambiar={setSeccion}
      acciones={<Campanita />}
    >
      <AvisosEnVivo />
      <FranjaSuplantacion />
      <AvisoExamen
        abierto={examen?.abierto}
        yaEnvio={Boolean(examen?.entrega)}
        alIr={() => setSeccion('examen')}
      />

      {!resumen ? (
        <Cargando texto="Cargando su inscripción" />
      ) : (
        <>
          {seccion === 'resumen' && (
            <SeccionResumen resumen={resumen} alCambiar={cargar} irA={setSeccion} />
          )}
          {seccion === 'alumnos' && <GestorAlumnos resumen={resumen} alCambiar={cargar} />}
          {/* Un solo componente montado para los dos pasos: si se desmontara
              al cambiar de sección, la selección se perdería al volver. */}
          {(seccion === 'pago-quienes' || seccion === 'pago') && (
            <PasoPago
              resumen={resumen}
              alCambiar={cargar}
              pantalla={seccion === 'pago-quienes' ? 'seleccion' : 'comprobante'}
              alCambiarPantalla={(cual) =>
                setSeccion(cual === 'seleccion' ? 'pago-quienes' : 'pago')
              }
              alVerInscripciones={() => setSeccion('historial')}
            />
          )}
          {seccion === 'credenciales' && <SeccionCredenciales resumen={resumen} />}
          {seccion === 'mi-credencial' && <MiCredencial resumen={resumen} />}
          {seccion === 'examen' && examen?.habilitado && <RespuestasExamen />}
          {seccion === 'clasificacion' && clasificado && <MiClasificacion />}
          {seccion === 'historial' && <MisInscripciones />}
          {seccion === 'datos' && <SeccionDatos resumen={resumen} alCambiar={cargar} />}
        </>
      )}
    </PanelLayout>
  );
}

/**
 * La franja que avisa que la sesión es prestada.
 *
 * Va fija arriba y en rojo a propósito: quien está adentro tiene que saber en
 * todo momento que lo que haga va a nombre del tutor, no suyo.
 */
function FranjaSuplantacion() {
  const { usuario } = useAuth();
  if (!usuario?.actuandoComo) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-rose-300 bg-rose-50 px-5 py-4">
      <p className="flex items-center gap-3 text-xl font-bold text-rose-900">
        <ShieldAlert className="h-7 w-7 shrink-0" />
        Está actuando como {usuario.nombres} {usuario.apellidos} ·{' '}
        {usuario.institucion || 'sin institución'}
      </p>
      <Boton variante="peligro" tamano="chico" onClick={volverAMiCuenta}>
        <ArrowLeft className="h-5 w-5" />
        Volver a mi cuenta
      </Boton>
    </div>
  );
}

function SeccionResumen({ resumen, alCambiar, irA }) {
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const estado = ESTADOS[resumen.estado] || ESTADOS.BORRADOR;

  const enviar = async () => {
    setError('');
    setEnviando(true);
    try {
      await api.post('/tutores/enviar');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo enviar la inscripción'));
    } finally {
      setEnviando(false);
    }
  };

  const listaPasos = [
    { texto: 'Institución educativa completa', ok: resumen.pasos.datosCompletos, ir: 'datos' },
    { texto: 'Mínimos por grado cumplidos', ok: resumen.pasos.alumnosCompletos, ir: 'alumnos' },
    { texto: 'Comprobante de pago adjunto', ok: resumen.pasos.pagoAdjunto, ir: 'pago-quienes' },
    { texto: 'Inscripción enviada a revisión', ok: resumen.pasos.enviada, ir: 'resumen' },
  ];

  if (corrigiendo && resumen.estado === 'OBSERVADA') {
    return (
      <CorregirObservacion
        resumen={resumen}
        alCambiar={alCambiar}
        alSalir={() => setCorrigiendo(false)}
        alTerminar={() => {
          setCorrigiendo(false);
          irA('historial');
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xl text-slate-500">{resumen.institucion}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">
              {ETIQUETA_MODALIDAD[resumen.modalidad] || resumen.modalidad} ·{' '}
              {ETIQUETA_NIVEL[resumen.nivelInstitucion] || 'Primaria y secundaria'}
            </h2>
          </div>
          <Etiqueta className={estado.clase}>{estado.texto}</Etiqueta>
        </div>

        {resumen.estado === 'OBSERVADA' && (
          <div className="mt-8">
            <AbsolverObservacion
              resumen={resumen}
              alCambiar={alCambiar}
              alCorregir={() => setCorrigiendo(true)}
              alTerminar={() => irA('historial')}
            />
          </div>
        )}

        {resumen.estado !== 'OBSERVADA' && resumen.respuesta && (
          <div className="mt-8">
            <Aviso tipo="info" icono={MessageSquare} titulo="Su respuesta a la observación">
              {resumen.respuesta}
            </Aviso>
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <Indicador valor={resumen.validacion.total} texto="Estudiantes" />
          <Indicador valor={resumen.validacion.minimoTotal} texto="Mínimo requerido" />
          <Indicador valor={`S/ ${resumen.totalPagar}`} texto="Total a pagar" />
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Avance de la inscripción</h3>
        <div className="mt-8 space-y-4">
          {listaPasos.map((paso) => (
            <button
              key={paso.texto}
              onClick={() => irA(paso.ir)}
              className="flex w-full items-center gap-5 rounded-2xl border-2 border-slate-100 p-6 text-left transition hover:border-granate-300 hover:bg-granate-50"
            >
              {paso.ok ? (
                <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-9 w-9 shrink-0 text-amber-500" />
              )}
              <span className="text-xl text-slate-800">{paso.texto}</span>
            </button>
          ))}
        </div>

        {resumen.validacion.errores.length > 0 && (
          <div className="mt-8">
            <Aviso tipo="alerta" icono={AlertCircle} titulo="Falta completar">
              <ul className="mt-2 space-y-1">
                {resumen.validacion.errores.map((mensaje) => (
                  <li key={mensaje}>{mensaje}</li>
                ))}
              </ul>
            </Aviso>
          </div>
        )}

        {error && (
          <div className="mt-8">
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          </div>
        )}

        {!resumen.pasos.enviada && (
          <div className="mt-8 flex justify-end">
            <Boton
              tamano="grande"
              cargando={enviando}
              onClick={enviar}
              disabled={!resumen.validacion.puedeEnviar || !resumen.pasos.pagoAdjunto}
            >
              <Send className="h-7 w-7" />
              Enviar inscripción
            </Boton>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

/**
 * El tutor responde a la observación y su delegación vuelve a revisión.
 *
 * Aparece en dos sitios: en el resumen, con el motivo y el botón para entrar a
 * corregir, y como último paso de la corrección, donde el motivo ya se mostró
 * arriba y solo queda escribir qué cambió.
 */
function AbsolverObservacion({
  resumen,
  alCambiar,
  alCorregir,
  alVolver,
  alTerminar,
  conMotivo = true,
}) {
  const [respuesta, setRespuesta] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const absolver = async (evento) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.post('/tutores/absolver', { respuesta });
      setRespuesta('');
      setEnviado(true);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo enviar su respuesta'));
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <Confirmado
        titulo="Respuesta enviada"
        detalle="Su delegación volvió a la cola de revisión. La comisión la mirará de nuevo y le avisará en su panel."
        alSeguir={async () => {
          await alCambiar();
          alTerminar?.();
        }}
      />
    );
  }

  return (
    <div className="rounded-3xl border-2 border-amber-200 bg-amber-50 p-8">
      {conMotivo && (
        <>
          <p className="flex items-center gap-3 text-xl font-bold text-amber-900">
            <AlertCircle className="h-8 w-8 shrink-0" />
            Observación de la comisión
          </p>
          <p className="mt-3 text-xl text-amber-900">{resumen.observacion}</p>

          {/* Escribir qué corrigió no corrige nada: de aquí sale el camino
              para cambiar estudiantes y comprobante antes de responder. */}
          <p className="mt-6 text-xl text-amber-900">
            ¿Necesita cambiar estudiantes o el comprobante? Entre a corregir y al final vuelve
            aquí. Si no hay nada que cambiar, responda y envíe sin más.
          </p>
        </>
      )}

      <form onSubmit={absolver} className={conMotivo ? 'mt-8' : ''}>
        <label className="block">
          <span className="mb-2 block text-xl font-semibold text-slate-800">
            Cuéntenos cómo lo corrigió
          </span>
          <textarea
            rows={4}
            required
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder="Ejemplo: ya corregí el DNI del estudiante y volví a subir el comprobante."
            className="w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-xl outline-none focus:border-granate-600"
          />
        </label>

        {error && (
          <div className="mt-6">
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-4">
          {alVolver && (
            <Boton type="button" variante="fantasma" onClick={alVolver} className="mr-auto">
              <ArrowLeft className="h-6 w-6" />
              Atrás
            </Boton>
          )}
          {alCorregir && (
            <Boton type="button" variante="contorno" onClick={alCorregir}>
              <Wrench className="h-6 w-6" />
              Corregir mi inscripción
            </Boton>
          )}
          <Boton type="submit" cargando={enviando}>
            <Send className="h-6 w-6" />
            Absolver y enviar a revisión
          </Boton>
        </div>
      </form>
    </div>
  );
}

/**
 * Corrección guiada de una delegación observada.
 *
 * La observación sola no alcanzaba: el tutor leía el motivo, escribía cómo lo
 * había corregido… y no tenía dónde corregirlo. Esto lo lleva por los mismos
 * pasos del registro —estudiantes, a quiénes paga, comprobante— y recién al
 * final le pide la respuesta.
 *
 * Nada de esto cambia el estado: mientras no toque «Absolver y enviar a
 * revisión», la delegación sigue observada. Se puede salir a medio camino y
 * volver cuando quiera; lo que ya corrigió queda guardado.
 */
function CorregirObservacion({ resumen, alCambiar, alSalir, alTerminar }) {
  const [paso, setPaso] = useState(0);

  const irA = (siguiente) => {
    setPaso(siguiente);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Corregir mi inscripción</h2>
          <p className="mt-2 text-xl text-slate-600">
            Vuelve a revisión solo cuando usted lo envíe.
          </p>
        </div>
        <Boton variante="fantasma" onClick={alSalir}>
          <ArrowLeft className="h-6 w-6" />
          Salir sin enviar
        </Boton>
      </div>

      <div className="py-2">
        <BarraPasos pasos={PASOS_CORRECCION} actual={paso} />
      </div>

      {/* El motivo acompaña todos los pasos: es lo que hay que resolver. */}
      <Aviso tipo="alerta" icono={AlertCircle} titulo="Observación de la comisión">
        {resumen.observacion}
      </Aviso>

      {paso === 0 && (
        <div className="space-y-8">
          <GestorAlumnos resumen={resumen} alCambiar={alCambiar} />
          <NavegacionCorreccion
            alVolver={alSalir}
            textoVolver="Salir sin enviar"
            alSeguir={() => irA(1)}
            textoSeguir="Ir al pago"
          />
        </div>
      )}

      {/* Los dos pasos del pago comparten el componente montado: si se
          desmontara al cambiar de paso, la selección se perdería. */}
      {(paso === 1 || paso === 2) && (
        <div className="space-y-8">
          <PasoPago
            resumen={resumen}
            alCambiar={alCambiar}
            pantalla={paso === 1 ? 'seleccion' : 'comprobante'}
            alCambiarPantalla={(cual) => irA(cual === 'seleccion' ? 1 : 2)}
            // Al mandar el comprobante sigue a la respuesta: la inscripción
            // todavía no está reenviada, así que no corresponde festejarla.
            alTerminar={() => irA(3)}
            // Aquí el historial va en los dos pasos, no solo en el del
            // comprobante: para volver a elegir estudiantes que ya están
            // cubiertos hay que anular antes el comprobante que los cubre, y
            // ese botón vive en el historial.
            mostrarHistorial
            conBotonSeguir={false}
          />
          <NavegacionCorreccion
            alVolver={() => irA(paso - 1)}
            alSeguir={() => irA(paso + 1)}
            textoSeguir={paso === 1 ? 'Ir al comprobante' : 'Escribir la respuesta'}
          />
        </div>
      )}

      {paso === 3 && (
        <RespuestaObservacion
          resumen={resumen}
          alCambiar={alCambiar}
          alVolver={() => irA(2)}
          alTerminar={alTerminar}
        />
      )}
    </div>
  );
}

const PASOS_CORRECCION = [
  { titulo: 'Estudiantes', icono: Users },
  { titulo: 'Seleccionar estudiantes', icono: UserCheck },
  { titulo: 'Comprobante de pago', icono: CreditCard },
  { titulo: 'Enviar a revisión', icono: Send },
];

function NavegacionCorreccion({ alVolver, textoVolver = 'Atrás', alSeguir, textoSeguir }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Boton variante="fantasma" onClick={alVolver}>
        <ArrowLeft className="h-6 w-6" />
        {textoVolver}
      </Boton>
      <Boton tamano="grande" onClick={alSeguir}>
        {textoSeguir}
        <ArrowRight className="h-7 w-7" />
      </Boton>
    </div>
  );
}

/** Último paso de la corrección: contar qué cambió y volver a la cola. */
function RespuestaObservacion({ resumen, alCambiar, alVolver, alTerminar }) {
  const cobertura = resumen.cobertura || { pagados: 0, pendientes: 0 };

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Así quedó su delegación</h3>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <Indicador valor={resumen.validacion.total} texto="Estudiantes" />
          <Indicador valor={cobertura.pagados} texto="Con comprobante" />
          <Indicador valor={`S/ ${cobertura.pagados * resumen.precioPorAlumno}`} texto="Pagado" />
        </div>

        {cobertura.pendientes > 0 && (
          <div className="mt-8">
            <Aviso tipo="alerta" icono={AlertCircle}>
              Quedan {cobertura.pendientes}{' '}
              {cobertura.pendientes === 1 ? 'estudiante' : 'estudiantes'} sin comprobante. Puede
              enviarlos igual y pagar después, o volver al paso anterior.
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <AbsolverObservacion
        resumen={resumen}
        alCambiar={alCambiar}
        alVolver={alVolver}
        alTerminar={alTerminar}
        conMotivo={false}
      />
    </div>
  );
}

/**
 * La credencial del propio tutor.
 *
 * Lleva su nombre, su DNI, su institución y cuántos estudiantes trae: la
 * necesita para entrar a la sede igual que sus alumnos. Sale en el mismo
 * formato que la de ellos, de la etapa que la comisión tenga publicada.
 */
function MiCredencial({ resumen }) {
  const [etapas, setEtapas] = useState(null);
  const [etapa, setEtapa] = useState('');
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState('');
  const habilitado = resumen.estado === 'APROBADA';

  useEffect(() => {
    if (!habilitado) return;
    api
      .get('/credenciales/etapas')
      .then(({ data }) => {
        setEtapas(data);
        if (data.length) setEtapa(data[data.length - 1].clave);
      })
      .catch(() => setEtapas([]));
  }, [habilitado]);

  if (!habilitado) {
    return (
      <Tarjeta>
        <BadgeCheck className="h-14 w-14 text-granate-600" />
        <h3 className="mt-6 text-3xl font-black text-slate-900">Mi credencial</h3>
        <div className="mt-6">
          <Aviso tipo="alerta" icono={AlertCircle} titulo="Pendiente de aprobación">
            Se habilita cuando la comisión apruebe su inscripción. Siga el avance en
            «Inscripciones».
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  if (!etapas) return <Cargando texto="Cargando su credencial" />;

  const bajar = async () => {
    setError('');
    setBajando(true);
    try {
      await descargar('/credenciales/mi-credencial?etapa=' + etapa, 'mi-credencial.pdf');
    } catch {
      setError('No se pudo generar su credencial');
    } finally {
      setBajando(false);
    }
  };

  return (
    <Tarjeta>
      <BadgeCheck className="h-14 w-14 text-granate-600" />
      <h3 className="mt-6 text-3xl font-black text-slate-900">Mi credencial</h3>
      <p className="mt-3 text-xl text-slate-600">
        La suya, como tutor responsable de {resumen.institucion}. Preséntela el día del examen
        junto con su DNI.
      </p>

      {etapas.length === 0 ? (
        <div className="mt-8">
          <Aviso tipo="alerta" icono={AlertCircle} titulo="Todavía no está publicada">
            La comisión la habilita antes de cada etapa. Le avisaremos en su panel.
          </Aviso>
        </div>
      ) : (
        <>
          {etapas.length > 1 ? (
            <div className="mt-8 max-w-md">
              <Selector etiqueta="Etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                {etapas.map((e) => (
                  <option key={e.clave} value={e.clave}>
                    {e.etiqueta} · {e.fecha}
                  </option>
                ))}
              </Selector>
            </div>
          ) : (
            <p className="mt-6 text-xl font-semibold text-granate-700">
              {etapas[0].etiqueta} · {etapas[0].fecha}
            </p>
          )}

          {error && (
            <div className="mt-6">
              <Aviso tipo="error" icono={AlertCircle}>
                {error}
              </Aviso>
            </div>
          )}

          <div className="mt-8">
            <Boton tamano="grande" cargando={bajando} onClick={bajar}>
              <Download className="h-7 w-7" />
              Descargar mi credencial
            </Boton>
          </div>
        </>
      )}
    </Tarjeta>
  );
}

function SeccionCredenciales({ resumen }) {
  const [filas, setFilas] = useState(null);
  const [nivel, setNivel] = useState('');
  const [grado, setGrado] = useState('');
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [descargando, setDescargando] = useState('');
  const [error, setError] = useState('');
  // Las etapas que la comisión ya publicó: puede haber una, las dos o ninguna.
  const [etapas, setEtapas] = useState(null);
  const [etapa, setEtapa] = useState('');
  const habilitado = resumen.estado === 'APROBADA';

  useEffect(() => {
    if (!habilitado) return;
    api
      .get('/tutores/inscripciones')
      .then(({ data }) => setFilas(data.filas.filter((f) => f.estadoInscripcion === 'APROBADA')))
      .catch(() => setFilas([]));
    api
      .get('/credenciales/etapas')
      .then(({ data }) => {
        setEtapas(data);
        // La última publicada es la que está por rendirse.
        if (data.length) setEtapa(data[data.length - 1].clave);
      })
      .catch(() => setEtapas([]));
  }, [habilitado]);

  if (!habilitado) {
    return (
      <Tarjeta>
        <IdCard className="h-14 w-14 text-granate-600" />
        <h3 className="mt-6 text-3xl font-black text-slate-900">Credenciales</h3>
        <div className="mt-6">
          <Aviso tipo="alerta" icono={AlertCircle} titulo="Pendiente de aprobación">
            Se habilitan cuando la comisión apruebe su inscripción. Siga el avance en
            «Inscripciones».
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  if (!filas || !etapas) return <Cargando texto="Cargando su delegación" />;

  if (etapas.length === 0) {
    return (
      <Tarjeta>
        <IdCard className="h-14 w-14 text-granate-600" />
        <h3 className="mt-6 text-3xl font-black text-slate-900">Credenciales</h3>
        <div className="mt-6">
          <Aviso tipo="alerta" icono={AlertCircle} titulo="Todavía no están publicadas">
            La comisión las habilita antes de cada etapa. Le avisaremos en su panel.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  const texto = buscar.trim().toLowerCase();
  const visibles = filas.filter((f) => {
    if (nivel && f.nivel !== nivel) return false;
    if (grado && f.grado !== grado) return false;
    if (!texto) return true;
    return f.nombres.toLowerCase().includes(texto) || f.dni.includes(texto);
  });

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / 20));
  const actual = Math.min(pagina, totalPaginas);
  const enPagina = visibles.slice((actual - 1) * 20, actual * 20);

  // El PDF respeta los filtros de pantalla: «Secundaria, 2.º grado» baja solo
  // esas credenciales y no un cuadernillo entero para recortar tres.
  const bajarFiltradas = async () => {
    setError('');
    setDescargando('filtradas');
    try {
      const params = new URLSearchParams({ etapa });
      if (nivel) params.set('nivel', nivel);
      if (grado) params.set('grado', grado);
      await descargar(
        '/credenciales/delegacion?' + params.toString(),
        'credenciales-omasur-2026.pdf',
      );
    } catch {
      setError('No se pudieron generar esas credenciales');
    } finally {
      setDescargando('');
    }
  };

  const bajarUna = async (fila) => {
    setError('');
    setDescargando(fila.id);
    try {
      await descargar(
        '/credenciales/dni/' + fila.dni + '?etapa=' + etapa,
        'credencial-' + fila.dni + '.pdf',
      );
    } catch {
      setError('No se pudo generar la credencial de ' + fila.nombres);
    } finally {
      setDescargando('');
    }
  };

  const gradosDelNivel = nivel ? GRADOS.filter((g) => g.nivel === nivel) : GRADOS;
  const filtrando = Boolean(nivel || grado);

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Credenciales</h3>
        <p className="mt-3 text-xl text-slate-600">
          Solo los estudiantes con inscripción aprobada.
        </p>

        {etapas.length > 1 ? (
          <div className="mt-8 max-w-md">
            <Selector
              etiqueta="Etapa"
              value={etapa}
              onChange={(e) => setEtapa(e.target.value)}
            >
              {etapas.map((e) => (
                <option key={e.clave} value={e.clave}>
                  {e.etiqueta} · {e.fecha}
                </option>
              ))}
            </Selector>
          </div>
        ) : (
          <p className="mt-4 text-xl font-semibold text-granate-700">
            {etapas[0].etiqueta} · {etapas[0].fecha}
          </p>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-xl font-semibold text-slate-800">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
              <input
                value={buscar}
                onChange={(e) => {
                  setBuscar(e.target.value);
                  setPagina(1);
                }}
                placeholder="Nombre o DNI"
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

          <Selector
            etiqueta="Grado"
            value={grado}
            onChange={(e) => {
              setGrado(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            {gradosDelNivel.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.label}
              </option>
            ))}
          </Selector>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xl text-slate-600">
            {visibles.length} de {filas.length} aprobados
          </p>
          <Boton
            cargando={descargando === 'filtradas'}
            disabled={visibles.length === 0}
            onClick={bajarFiltradas}
          >
            <Download className="h-6 w-6" />
            {filtrando ? 'Descargar estas ' + visibles.length : 'Descargar todas'}
          </Boton>
        </div>

        {error && (
          <div className="mt-6">
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <Tarjeta>
        {visibles.length === 0 ? (
          <p className="py-10 text-center text-xl text-slate-500">
            Ningún estudiante aprobado coincide con esos filtros.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {enPagina.map((fila) => (
                <div
                  key={fila.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold text-slate-900">{fila.nombres}</p>
                    <p className="mt-1 text-base text-slate-500">
                      {fila.dni} · {fila.nivelLabel} · {fila.gradoLabel} · CAT. {fila.categoria}
                    </p>
                  </div>
                  <Boton
                    variante="contorno"
                    tamano="chico"
                    cargando={descargando === fila.id}
                    onClick={() => bajarUna(fila)}
                  >
                    <Download className="h-5 w-5" />
                    Descargar credencial
                  </Boton>
                </div>
              ))}
            </div>

            {totalPaginas > 1 && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
          </>
        )}
      </Tarjeta>
    </div>
  );
}

function SeccionDatos({ resumen, alCambiar }) {
  const { recargar } = useAuth();
  const [datos, setDatos] = useState(null);
  const [correo, setCorreo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  /**
   * Se piden los datos al servidor cada vez que se abre la sección.
   * Antes se llenaba con la copia guardada al iniciar sesión, y como esa copia
   * no se actualizaba al completar el asistente, el tutor veía la institución
   * y la ubicación en blanco.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await api.get('/auth/perfil');
        if (!vivo) return;
        setDatos({
          nombres: data.nombres || '',
          apellidos: data.apellidos || '',
          celular: data.celular || '',
          institucion: data.institucion || '',
          modalidad: data.modalidad || 'ESTATAL',
          nivelInstitucion: data.nivelInstitucion || 'AMBOS',
          departamento: data.departamento || '',
          provincia: data.provincia || '',
          distrito: data.distrito || '',
        });
        setCorreo(data.correo || '');
      } catch (e) {
        if (vivo) setError(mensajeError(e, 'No se pudieron cargar sus datos'));
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (!datos) {
    return error ? (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    ) : (
      <Cargando texto="Cargando sus datos" />
    );
  }

  const alumnos = resumen?.validacion?.total || 0;
  const comprobantes = resumen?.cobertura?.comprobantes || 0;
  const bloqueado = alumnos > 0 || comprobantes > 0;
  const motivoBloqueo = comprobantes
    ? 'La modalidad y el nivel quedaron fijos al enviar su comprobante de pago: de ellos sale el monto.'
    : `La modalidad y el nivel quedaron fijos porque ya registró ${alumnos === 1 ? 'un estudiante' : alumnos + ' estudiantes'}: de ellos salen el precio por estudiante y los mínimos.`;

  const cambiar = (campo) => (evento) => setDatos({ ...datos, [campo]: evento.target.value });

  const guardar = async (evento) => {
    evento.preventDefault();
    setMensaje('');
    setError('');
    setGuardando(true);
    try {
      await api.patch('/tutores/datos', datos);
      await recargar();
      await alCambiar();
      setMensaje('Datos actualizados correctamente');
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar los datos'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="space-y-8">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Datos del tutor</h3>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Campo etiqueta="Nombres" required value={datos.nombres} onChange={cambiar('nombres')} />
          <Campo
            etiqueta="Apellidos"
            required
            value={datos.apellidos}
            onChange={cambiar('apellidos')}
          />
          <Campo
            etiqueta="Celular"
            required
            maxLength={9}
            value={datos.celular}
            onChange={(e) => setDatos({ ...datos, celular: e.target.value.replace(/\D/g, '') })}
          />
          <Campo etiqueta="Correo" value={correo} disabled />
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Institución educativa</h3>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Campo
            etiqueta="Nombre de la institución"
            required
            value={datos.institucion}
            onChange={cambiar('institucion')}
            className="md:col-span-2"
          />
          {/* De la modalidad sale el precio por estudiante y del nivel los
              mínimos. Con alumnos ya registrados quedan bajo llave: si no, se
              podía inscribir como estatal, pagar a S/ 12 y luego pasarse a
              particular. */}
          <SelectorOpciones
            etiqueta="Modalidad"
            opciones={MODALIDADES}
            valor={datos.modalidad}
            alElegir={(v) => setDatos({ ...datos, modalidad: v })}
            disabled={bloqueado}
          />
          <SelectorOpciones
            etiqueta="Nivel en el que participa"
            opciones={NIVELES_INSTITUCION}
            valor={datos.nivelInstitucion}
            alElegir={(v) => setDatos({ ...datos, nivelInstitucion: v })}
            disabled={bloqueado}
          />

          {bloqueado && (
            <div className="md:col-span-2">
              <Aviso tipo="info" icono={Lock} compacto>
                {motivoBloqueo} Para corregirlos, escriba a la comisión organizadora.
              </Aviso>
            </div>
          )}
          <SelectorUbigeo
            valores={datos}
            alCambiar={(ubigeo) => setDatos({ ...datos, ...ubigeo })}
          />
        </div>
      </Tarjeta>

      {mensaje && (
        <Aviso tipo="exito" icono={CheckCircle2}>
          {mensaje}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      )}

      <div className="flex justify-end">
        <Boton type="submit" cargando={guardando} tamano="grande">
          Guardar cambios
        </Boton>
      </div>
    </form>
  );
}

function Indicador({ valor, texto }) {
  return (
    <div className="rounded-2xl bg-granate-50 p-7 text-center">
      <p className="text-5xl font-black text-granate-700">{valor}</p>
      <p className="mt-3 text-xl text-slate-600">{texto}</p>
    </div>
  );
}
