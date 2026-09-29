import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  IdCard,
  LayoutDashboard,
  Lock,
  Mail,
  Phone,
  School,
  UserCheck,
  Send,
  User,
  Users,
} from 'lucide-react';
import { api, mensajeError } from '../lib/api';
import { rutaPorRol, useAuth } from '../lib/auth.jsx';
import { useAjustes } from '../lib/ajustes';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  SelectorOpciones,
  Tarjeta,
} from '../components/Ui.jsx';
import BarraPasos from '../components/BarraPasos.jsx';
import GestorAlumnos from '../components/GestorAlumnos.jsx';
import PasoPago, { SelloConfirmado, VistaComprobante } from '../components/PasoPago.jsx';
import SelectorUbigeo from '../components/SelectorUbigeo.jsx';
import Logo from '../components/Logo.jsx';
import SimbolosMatematicos from '../components/SimbolosMatematicos.jsx';
import { ETIQUETA_GRADO, MODALIDADES, NIVELES_INSTITUCION } from '../lib/datos';

const PASOS = [
  { titulo: 'Institución educativa', icono: School },
  { titulo: 'Estudiantes', icono: Users },
  { titulo: 'Seleccionar estudiantes', icono: UserCheck },
  { titulo: 'Comprobante', icono: CreditCard },
  { titulo: 'Confirmación', icono: CheckCircle2 },
];

export default function Inscripcion() {
  const { usuario, cargando, guardarSesion, recargar } = useAuth();
  const { ajustes, cargando: cargandoAjustes } = useAjustes();
  const navegar = useNavigate();
  const [paso, setPaso] = useState(0);
  const [resumen, setResumen] = useState(null);

  const cargarResumen = useCallback(async () => {
    const { data } = await api.get('/tutores/resumen');
    setResumen(data);
    return data;
  }, []);

  useEffect(() => {
    if (cargando) return;
    if (usuario && usuario.rol !== 'TUTOR') {
      navegar(rutaPorRol(usuario.rol), { replace: true });
      return;
    }
    if (usuario?.rol === 'TUTOR') cargarResumen();
  }, [usuario, cargando, navegar, cargarResumen]);

  if (cargando || cargandoAjustes) return <Cargando texto="Preparando su inscripción" />;

  const registrado = usuario?.rol === 'TUTOR';

  if (ajustes.inscripcionesCerradas) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Cabecera registrado={registrado} />
        <main className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
          <InscripcionesCerradas registrado={registrado} />
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {!registrado && <SimbolosMatematicos />}

      <Cabecera registrado={registrado} />

      <main className="relative mx-auto max-w-6xl px-6 py-12 lg:px-10">
        {!registrado ? (
          <Registro alRegistrar={guardarSesion} />
        ) : !resumen ? (
          <Cargando texto="Cargando su inscripción" />
        ) : (
          <>
            <div className="mb-14">
              <BarraPasos pasos={PASOS} actual={paso} />
            </div>

            {paso === 0 && (
              <PasoInstitucion
                resumen={resumen}
                alGuardar={async () => {
                  // También se refresca la sesión: si no, "Mis datos" seguiría
                  // mostrando la copia vieja, sin institución ni ubicación.
                  await Promise.all([cargarResumen(), recargar()]);
                  setPaso(1);
                }}
              />
            )}

            {paso === 1 && (
              <div className="space-y-8">
                <Encabezado titulo="Registre a sus estudiantes" />
                <GestorAlumnos resumen={resumen} alCambiar={cargarResumen} />
                <Navegacion
                  alVolver={() => setPaso(0)}
                  alSeguir={() => setPaso(2)}
                  siguienteInactivo={!resumen?.validacion?.total}
                  textoSiguiente="Ir al pago"
                />
              </div>
            )}

{/* Los pasos 2 y 3 comparten el mismo componente montado: si se
                desmontara al cambiar de paso, la selección de estudiantes se
                perdería al volver atrás. */}
            {(paso === 2 || paso === 3) && (
              <div className="space-y-8">
                <Encabezado
                  titulo={paso === 2 ? 'Pago de la delegación' : 'Comprobante de pago'}
                />
                <PasoPago
                  resumen={resumen}
                  alCambiar={cargarResumen}
                  pantalla={paso === 2 ? 'seleccion' : 'comprobante'}
                  alCambiarPantalla={(cual) => setPaso(cual === 'seleccion' ? 2 : 3)}
                  alTerminar={() => setPaso(4)}
                  // El historial va solo en el paso del comprobante: en
                  // "Seleccionar estudiantes" estorbaba.
                  mostrarHistorial={paso === 3}
                  // En el asistente el paso se pasa desde la barra de abajo
                  // («Ir al comprobante»): el botón de la tarjeta sobraba.
                  conBotonSeguir={false}
                />
                {/* El paso siempre deja seguir: el tutor puede pagar por
                    partes y no está obligado a marcar a alguien ahora. */}
                {paso === 2 ? (
                  <Navegacion
                    alVolver={() => setPaso(1)}
                    alSeguir={() => setPaso(3)}
                    textoSiguiente="Ir al comprobante"
                  />
                ) : (
                  <Navegacion
                    alVolver={() => setPaso(2)}
                    alSeguir={() => setPaso(4)}
                    siguienteInactivo={!resumen?.pago}
                    textoSiguiente="Revisar y enviar"
                  />
                )}
              </div>
            )}

            {paso === 4 && (
              <PasoConfirmacion
                resumen={resumen}
                alCambiar={cargarResumen}
                alVolver={() => setPaso(3)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Cabecera({ registrado }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
        <Link to="/" className="flex items-center gap-3">
          <Logo tamano="h-12 w-12" />
          <span className="text-xl font-black text-granate-700">OMASUR UNI 2026</span>
        </Link>
        {registrado ? (
          <Link
            to="/panel"
            className="inline-flex items-center gap-3 text-xl font-semibold text-granate-700"
          >
            <LayoutDashboard className="h-6 w-6" />
            Mi panel
          </Link>
        ) : (
          <Link
            to="/ingresar"
            className="inline-flex items-center gap-3 text-xl font-semibold text-granate-700"
          >
            <ArrowLeft className="h-6 w-6" />
            Ya tengo cuenta
          </Link>
        )}
      </div>
    </header>
  );
}

/** La comisión ya culminó el periodo de inscripción. */
function InscripcionesCerradas({ registrado }) {
  return (
    <Tarjeta className="text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-granate-600 text-white">
        <Lock className="h-9 w-9" />
      </span>
      <h1 className="mt-8 text-5xl font-black text-slate-900">Inscripciones culminadas</h1>
      <p className="mx-auto mt-6 max-w-xl text-xl text-slate-600">
        El periodo de inscripción al I - OMASUR UNI 2026 ya cerró.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        {registrado ? (
          <Link to="/panel">
            <Boton tamano="grande">
              <LayoutDashboard className="h-7 w-7" />
              Ver mi inscripción
            </Boton>
          </Link>
        ) : (
          <Link to="/ingresar">
            <Boton tamano="grande">
              <LayoutDashboard className="h-7 w-7" />
              Ingresar a mi panel
            </Boton>
          </Link>
        )}
        <Link to="/credencial">
          <Boton variante="contorno" tamano="grande">
            <IdCard className="h-7 w-7" />
            Mi credencial
          </Boton>
        </Link>
      </div>
    </Tarjeta>
  );
}

function Encabezado({ titulo, detalle }) {
  return (
    <div>
      <h1 className="text-3xl font-black text-slate-900">{titulo}</h1>
      <p className="mt-3 text-xl text-slate-600">{detalle}</p>
    </div>
  );
}

function Navegacion({ alVolver, alSeguir, siguienteInactivo, textoSiguiente }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Boton variante="fantasma" onClick={alVolver}>
        <ArrowLeft className="h-6 w-6" />
        Atrás
      </Boton>
      <Boton onClick={alSeguir} disabled={siguienteInactivo}>
        {textoSiguiente}
        <ArrowRight className="h-6 w-6" />
      </Boton>
    </div>
  );
}

/** Creación de la cuenta del tutor. Va antes del asistente, sin barra de pasos. */
/** Creación de la cuenta del tutor. Va antes del asistente, sin barra de pasos. */
function Registro({ alRegistrar }) {
  const [datos, setDatos] = useState({
    dni: '',
    nombres: '',
    apellidos: '',
    celular: '',
    correo: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (evento) => setDatos((d) => ({ ...d, [campo]: evento.target.value }));

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/registro', datos);
      await alRegistrar(data.access_token);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo completar el registro'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="animate-aparecer mx-auto max-w-3xl">
      <div className="text-center">
        <h1 className="text-4xl font-black leading-none tracking-tight text-slate-900 sm:text-5xl">
          Cree su <span className="text-red-400">cuenta</span>
        </h1>
      </div>

      <form onSubmit={enviar} className="relative mt-10 space-y-6">
        {/* La tarjeta lleva una franja granate arriba y un borde que se enciende
            al escribir: el formulario se sentía una caja blanca sin vida. */}
        <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-suave transition-colors duration-300 focus-within:border-granate-300">
          <div className="h-1.5 bg-gradient-to-r from-granate-700 via-granate-500 to-granate-700" />

          <div className="p-7">
            <h3 className="text-xl font-black text-slate-900">Datos personales</h3>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Campo
                compacto
                etiqueta="DNI"
                icono={IdCard}
                required
                inputMode="numeric"
                maxLength={8}
                placeholder="12345678"
                value={datos.dni}
                onChange={(e) => setDatos({ ...datos, dni: e.target.value.replace(/\D/g, '') })}
                className="md:col-span-2"
              />
              <Campo
                compacto
                etiqueta="Nombres"
                icono={User}
                required
                value={datos.nombres}
                onChange={cambiar('nombres')}
              />
              <Campo
                compacto
                etiqueta="Apellidos"
                icono={User}
                required
                value={datos.apellidos}
                onChange={cambiar('apellidos')}
              />
              <Campo
                compacto
                etiqueta="Celular"
                icono={Phone}
                required
                inputMode="numeric"
                maxLength={9}
                placeholder="928853577"
                value={datos.celular}
                onChange={(e) => setDatos({ ...datos, celular: e.target.value.replace(/\D/g, '') })}
              />
              <Campo
                compacto
                etiqueta="Correo electrónico"
                icono={Mail}
                type="email"
                required
                placeholder="tutor@correo.com"
                value={datos.correo}
                onChange={cambiar('correo')}
              />
              <Campo
                compacto
                etiqueta="Contraseña"
                icono={Lock}
                type="password"
                required
                minLength={6}
                ayuda="Mínimo 6 caracteres, la usará para entrar."
                value={datos.password}
                onChange={cambiar('password')}
                className="md:col-span-2"
              />
            </div>
          </div>
        </div>

        {error && (
          <Aviso tipo="error" icono={AlertCircle}>
            {error}
          </Aviso>
        )}

        <Boton type="submit" variante="rojo" cargando={enviando} className="w-full">
          Crear cuenta y continuar
          <ArrowRight className="h-6 w-6" />
        </Boton>
      </form>

      <p className="relative mt-6 text-center text-xl text-slate-600">
        ¿Ya tiene cuenta?{' '}
        <Link to="/ingresar" className="font-bold text-granate-700 underline underline-offset-4">
          Ingresar
        </Link>
      </p>
    </div>
  );
}

/** Paso 1 del asistente. */
function PasoInstitucion({ resumen, alGuardar }) {
  // La base trae ESTATAL y AMBOS por defecto. Si el tutor todavía no guardó
  // su institución, se muestran sin marcar para que elija a conciencia; una
  // vez elegido ya no hay forma de volver a dejarlo en blanco.
  const primeraVez = !resumen.institucion;

  // Con alumnos o comprobantes de por medio, la modalidad y el nivel quedan
  // bajo llave: cambiarlos movería el precio ya pagado y los mínimos exigidos.
  const bloqueado =
    (resumen.validacion?.total || 0) > 0 || (resumen.cobertura?.comprobantes || 0) > 0;

  const [datos, setDatos] = useState({
    institucion: resumen.institucion || '',
    modalidad: primeraVez ? '' : resumen.modalidad || '',
    nivelInstitucion: primeraVez ? '' : resumen.nivelInstitucion || '',
    departamento: resumen.departamento || '',
    provincia: resumen.provincia || '',
    distrito: resumen.distrito || '',
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    // Las tarjetas no tienen opción vacía, así que el "required" del
    // desplegable ya no cubre el caso de no haber elegido nada.
    if (!datos.modalidad) return setError('Elija la modalidad de su institución');
    if (!datos.nivelInstitucion) return setError('Elija el nivel en el que participa');

    setEnviando(true);
    try {
      await api.patch('/tutores/datos', datos);
      await alGuardar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar los datos'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Institución educativa"
        detalle="Datos del colegio o grupo de estudios."
      />

      <form onSubmit={enviar} className="space-y-8">
        <Tarjeta>
          <div className="grid gap-6 md:grid-cols-2">
            <Campo
              etiqueta="Nombre de la institución"
              required
              value={datos.institucion}
              onChange={(e) => setDatos({ ...datos, institucion: e.target.value })}
              className="md:col-span-2"
            />
            {/* El nivel decide qué grados podrá usar después y el mínimo de
                estudiantes, y la modalidad el precio por estudiante: por eso
                van juntos y por eso se cierran en cuanto hay delegación. */}
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
                  La modalidad y el nivel ya no se pueden cambiar: de ellos salen el precio por
                  estudiante y los mínimos de su delegación. Para corregirlos, escriba a la
                  comisión organizadora.
                </Aviso>
              </div>
            )}
            <SelectorUbigeo
              valores={datos}
              alCambiar={(ubigeo) => setDatos({ ...datos, ...ubigeo })}
            />
          </div>
        </Tarjeta>

        {error && (
          <Aviso tipo="error" icono={AlertCircle}>
            {error}
          </Aviso>
        )}

        <div className="flex justify-end">
          <Boton type="submit" cargando={enviando} tamano="grande">
            Continuar
            <ArrowRight className="h-7 w-7" />
          </Boton>
        </div>
      </form>
    </div>
  );
}

function PasoConfirmacion({ resumen, alCambiar, alVolver }) {
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

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

  const cobertura = resumen?.cobertura || { pagados: 0, pendientes: 0, montoPendiente: 0 };
  const precio = resumen?.precioPorAlumno || 0;

  if (resumen?.pasos?.enviada) {
    return (
      <Tarjeta className="relative overflow-hidden text-center">
        {/* Un lavado cálido arriba para que el resplandor tenga sobre qué
            asentarse: sobre blanco puro se perdía. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(254,215,170,0.55),transparent)]" />

        <SelloConfirmado />

        <h1 className="relative mt-10 text-5xl font-black text-slate-900">Inscripción enviada</h1>
        <p className="relative mx-auto mt-6 max-w-2xl text-xl text-slate-600">
          La comisión revisará su delegación y su comprobante.
        </p>

        {/* Lo pagado, no lo que cuesta la delegación entera: con pagos por
            partes eran cifras distintas y aquí salía la que no era. */}
        <div className="relative mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
          <Resumen
            valor={`${cobertura.pagados} de ${resumen.validacion.total}`}
            texto="Estudiantes pagados"
          />
          <Resumen valor={`S/ ${cobertura.pagados * precio}`} texto="Pagado" />
          <Resumen
            valor={resumen.estado === 'APROBADA' ? 'Aprobada' : 'En revisión'}
            texto="Estado"
          />
        </div>

        {cobertura.pendientes > 0 && (
          <p className="relative mx-auto mt-8 max-w-2xl text-xl text-amber-800">
            Todavía faltan {cobertura.pendientes}{' '}
            {cobertura.pendientes === 1 ? 'estudiante' : 'estudiantes'} por pagar ·{' '}
            S/ {cobertura.montoPendiente}. Puede enviar otro comprobante desde su panel.
          </p>
        )}

        <div className="relative mt-12 flex justify-center">
          <Link to="/panel">
            <Boton tamano="grande">
              <LayoutDashboard className="h-7 w-7" />
              Ir a mi panel
            </Boton>
          </Link>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Revise y envíe"
        detalle="Esto es lo que recibirá la comisión."
      />

      <ComprobantesAEnviar />

      {error && (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Boton variante="fantasma" onClick={alVolver}>
          <ArrowLeft className="h-6 w-6" />
          Atrás
        </Boton>
        <Boton tamano="grande" cargando={enviando} onClick={enviar}>
          <Send className="h-7 w-7" />
          Enviar inscripción
        </Boton>
      </div>
    </div>
  );
}

/**
 * Lo que de verdad se manda: por quiénes se pagó y con qué comprobante.
 * Los mínimos no van aquí — se ven en Estudiantes, y quien decide si la
 * delegación alcanza es la comisión al revisarla.
 */
function ComprobantesAEnviar() {
  const [pagos, setPagos] = useState(null);

  useEffect(() => {
    api
      .get('/pagos')
      .then(({ data }) => setPagos(data))
      .catch(() => setPagos([]));
  }, []);

  if (!pagos) return <Cargando texto="Cargando sus comprobantes" />;

  if (pagos.length === 0) {
    return (
      <Aviso tipo="alerta" icono={AlertCircle}>
        Todavía no adjuntó ningún comprobante.
      </Aviso>
    );
  }

  return (
    <div className="space-y-6">
      {pagos.map((pago) => (
        <Tarjeta key={pago.id}>
          <div className="grid gap-8 md:grid-cols-[1fr_16rem]">
            <div>
              <p className="text-xl text-slate-500">
                Comprobante por {pago.metodo === 'BCP' ? 'BCP' : 'Yape'}
              </p>
              <p className="mt-1 text-5xl font-black text-granate-700">S/ {pago.monto}</p>

              <p className="mt-8 text-xl font-semibold text-slate-800">
                Está pagando por {pago.alumnos.length}{' '}
                {pago.alumnos.length === 1 ? 'estudiante' : 'estudiantes'}
              </p>
              <ul className="mt-4 space-y-2">
                {pago.alumnos.map((alumno) => (
                  <li key={alumno.id} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-xl text-slate-900">{alumno.nombres}</span>
                    <span className="text-base text-slate-500">
                      {alumno.dni} · {ETIQUETA_GRADO[alumno.grado]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* El archivo se trae con la sesión y se muestra desde memoria:
                un <img src> apuntando a la API daría 401, porque el navegador
                no manda el token en la carga de una imagen. */}
            <VistaComprobante url={pago.archivoUrl} alto="max-h-80" />
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}

function Resumen({ valor, texto }) {
  return (
    <div className="rounded-2xl bg-granate-50 p-6 text-center">
      <p className="text-3xl font-black text-granate-700">{valor}</p>
      <p className="mt-2 text-xl text-slate-600">{texto}</p>
    </div>
  );
}
