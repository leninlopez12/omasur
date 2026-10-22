import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap as IconoGrado,
  IdCard,
  Megaphone,
  ImageIcon,
  LayoutDashboard,
  LogIn,
  Mail,
  Landmark,
  MessageCircle,
  QrCode,
  ReceiptText,
  School,
  Search,
  Settings,
  UserCog,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import PanelLayout from '../layouts/PanelLayout.jsx';
import { Boton, Cargando, Etiqueta, Tarjeta } from '../components/Ui.jsx';
import {
  Barra,
  ListaInscripciones,
  Metrica,
  RevisarInscripcion,
} from '../components/Inscripciones.jsx';
import {
  AjusteBases,
  AjusteBcp,
  AjusteWhatsapp,
  AjusteYape,
  CierreInscripciones,
  GruposWhatsApp,
  ImagenesFondo,
} from '../components/Ajustes.jsx';
import { ConsultaEstudiantes, ConsultaTutores } from '../components/Consultas.jsx';
import IconoWhatsApp from '../components/IconoWhatsApp.jsx';
import Campanita from '../components/Campanita.jsx';
import AvisosEnVivo from '../components/AvisosEnVivo.jsx';
import PermisoAvisos from '../components/PermisoAvisos.jsx';
import { NotificacionesProvider } from '../lib/notificaciones.jsx';
import { api, descargar } from '../lib/api';
import { useAjustes } from '../lib/ajustes';
import { ETIQUETA_MODALIDAD_PLURAL } from '../lib/datos';
import RevisarAlumnos from '../components/RevisarAlumnos.jsx';
import Supervisores from '../components/Supervisores.jsx';
import Avisos from '../components/Avisos.jsx';
import Reportes from '../components/Reportes.jsx';
import Abonos from '../components/Abonos.jsx';
import Consolidado from '../components/Consolidado.jsx';
import Acceder from '../components/Acceder.jsx';
import EtapasCredencial from '../components/EtapasCredencial.jsx';
import Comunicados from '../components/Comunicados.jsx';
import CredencialesComision from '../components/CredencialesComision.jsx';

const SECCIONES = [
  { id: 'tablero', texto: 'Tablero', icono: LayoutDashboard },
  { id: 'revisar-alumnos', texto: 'Inscripciones', icono: ReceiptText },
  { id: 'inscripciones', texto: 'Delegaciones', icono: ClipboardCheck },
  { id: 'reportes', texto: 'Reportes', icono: FileSpreadsheet },
  { id: 'abonos', texto: 'Abonos', icono: Wallet },
  {
    id: 'consultas',
    texto: 'Consultas',
    icono: Search,
    hijos: [
      { id: 'consulta-tutores', texto: 'Tutores', icono: Users },
      { id: 'consulta-estudiantes', texto: 'Estudiantes', icono: IconoGrado },
    ],
  },
  { id: 'consolidado', texto: 'Consolidado', icono: ClipboardList },
  { id: 'acceder', texto: 'Acceder', icono: LogIn },
  {
    id: 'credenciales',
    texto: 'Credenciales',
    icono: IdCard,
    hijos: [
      { id: 'cred-delegaciones', texto: 'De delegaciones', icono: Users },
      { id: 'cred-tutores', texto: 'De tutores', icono: UserCheck },
    ],
  },
  {
    id: 'ajustes',
    texto: 'Ajustes',
    icono: Settings,
    hijos: [
      { id: 'ajustes-inscripciones', texto: 'Inscripciones', icono: CalendarCheck },
      { id: 'ajustes-whatsapp', texto: 'Grupo WhatsApp', icono: IconoWhatsApp },
      { id: 'ajustes-boton-wa', texto: 'Botón de WhatsApp', icono: MessageCircle },
      { id: 'ajustes-yape', texto: 'Yape', icono: QrCode },
      { id: 'ajustes-bcp', texto: 'BCP', icono: Landmark },
      { id: 'ajustes-credencial', texto: 'Diseño de credenciales', icono: IdCard },
      { id: 'ajustes-comunicado', texto: 'Comunicado', icono: Megaphone },
      { id: 'ajustes-imagenes', texto: 'Imágenes', icono: ImageIcon },
      { id: 'ajustes-bases', texto: 'Bases del concurso', icono: FileText },
      { id: 'ajustes-supervisores', texto: 'Supervisores', icono: UserCog },
      { id: 'ajustes-avisos', texto: 'Avisos por correo', icono: Mail },
    ],
  },
];

const TITULOS = {
  tablero: 'Tablero general',
  'revisar-alumnos': 'Inscripciones por alumno',
  inscripciones: 'Delegaciones',
  reportes: 'Reportes',
  abonos: 'Abonos por delegación',
  'consulta-tutores': 'Consultas · Tutores',
  'consulta-estudiantes': 'Consultas · Estudiantes',
  consolidado: 'Consolidado general',
  acceder: 'Entrar como tutor',
  'cred-delegaciones': 'Credenciales de delegaciones',
  'cred-tutores': 'Credenciales de tutores',
  'ajustes-inscripciones': 'Ajustes · Inscripciones',
  'ajustes-whatsapp': 'Ajustes · Grupo WhatsApp',
  'ajustes-boton-wa': 'Ajustes · Botón de WhatsApp',
  'ajustes-yape': 'Ajustes · Yape',
  'ajustes-bcp': 'Ajustes · BCP',
  'ajustes-credencial': 'Ajustes · Diseño de credenciales',
  'ajustes-comunicado': 'Ajustes · Comunicado',
  'ajustes-imagenes': 'Ajustes · Imágenes',
  'ajustes-bases': 'Ajustes · Bases del concurso',
  'ajustes-supervisores': 'Ajustes · Supervisores',
  'ajustes-avisos': 'Ajustes · Avisos por correo',
};

export default function PanelAdmin() {
  return (
    <NotificacionesProvider>
      <Contenido />
    </NotificacionesProvider>
  );
}

function Contenido() {
  const [seccion, setSeccion] = useState('tablero');
  const [detalleId, setDetalleId] = useState(null);
  const { ajustes, recargar: recargarAjustes } = useAjustes();

  const cambiarSeccion = (id) => {
    setDetalleId(null);
    setSeccion(id);
  };

  /** Desde un aviso se salta directo a la delegación que lo originó. */
  const abrirTutor = (tutorId) => {
    setSeccion('inscripciones');
    setDetalleId(tutorId);
  };

  return (
    <PanelLayout
      compacto
      titulo={TITULOS[seccion]}
      secciones={SECCIONES}
      actual={seccion}
      alCambiar={cambiarSeccion}
      acciones={
        <Campanita
          alAbrirTutor={abrirTutor}
          alIrAAprobar={() => cambiarSeccion('inscripciones')}
        />
      }
    >
      <AvisosEnVivo alAbrirTutor={abrirTutor} />
      <PermisoAvisos />

      {seccion === 'tablero' && (
        <Tablero
          irA={(destino, tutorId) => {
            cambiarSeccion(destino);
            if (tutorId) setDetalleId(tutorId);
          }}
        />
      )}
      {seccion === 'inscripciones' &&
        (detalleId ? (
          <RevisarInscripcion id={detalleId} alVolver={() => setDetalleId(null)} />
        ) : (
          <ListaInscripciones alAbrir={setDetalleId} />
        ))}
      {seccion === 'revisar-alumnos' &&
        (detalleId ? (
          <RevisarInscripcion id={detalleId} alVolver={() => setDetalleId(null)} />
        ) : (
          <RevisarAlumnos alAbrirTutor={setDetalleId} />
        ))}
      {seccion === 'reportes' && <Reportes />}
      {seccion === 'abonos' && <Abonos />}

      {seccion === 'consulta-tutores' && <ConsultaTutores alAbrirTutor={abrirTutor} />}
      {seccion === 'consulta-estudiantes' && <ConsultaEstudiantes />}
      {seccion === 'consolidado' && <Consolidado />}
      {seccion === 'acceder' && <Acceder />}
      {seccion === 'cred-delegaciones' && <CredencialesComision modo="delegaciones" />}
      {seccion === 'cred-tutores' && <CredencialesComision modo="tutores" />}

      {seccion === 'ajustes-inscripciones' && (
        <CierreInscripciones
          cerradas={ajustes.inscripcionesCerradas}
          cerradasEn={ajustes.cerradasEn}
          alCambiar={recargarAjustes}
        />
      )}
      {seccion === 'ajustes-whatsapp' && (
        <GruposWhatsApp grupos={ajustes.grupos} alCambiar={recargarAjustes} />
      )}
      {seccion === 'ajustes-yape' && (
        <AjusteYape yapeQr={ajustes.yapeQr} yape={ajustes.yape} alCambiar={recargarAjustes} />
      )}
      {seccion === 'ajustes-boton-wa' && (
        <AjusteWhatsapp whatsapp={ajustes.whatsapp} alCambiar={recargarAjustes} />
      )}
      {seccion === 'ajustes-bcp' && <AjusteBcp bcp={ajustes.bcp} alCambiar={recargarAjustes} />}
      {seccion === 'ajustes-credencial' && <EtapasCredencial />}
      {seccion === 'ajustes-comunicado' && <Comunicados />}
      {seccion === 'ajustes-imagenes' && (
        <ImagenesFondo
          imagenHero={ajustes.imagenHero}
          imagenLogin={ajustes.imagenLogin}
          alCambiar={recargarAjustes}
        />
      )}
      {seccion === 'ajustes-bases' && (
        <AjusteBases bases={ajustes.bases} alCambiar={recargarAjustes} />
      )}
      {seccion === 'ajustes-supervisores' && <Supervisores />}
      {seccion === 'ajustes-avisos' && <Avisos />}
    </PanelLayout>
  );
}

/**
 * Tablero del administrador: la foto completa del concurso en una pantalla.
 *
 * Lleva todo lo que ve el supervisor y además lo que solo le toca a él —
 * el dinero, el estado de cada comprobante, el equipo y la actividad reciente.
 */
function Tablero({ irA }) {
  const [metricas, setMetricas] = useState(null);
  const [soloAprobadas, setSoloAprobadas] = useState(false);

  useEffect(() => {
    api.get('/admin/metricas').then(({ data }) => setMetricas(data));
  }, []);

  if (!metricas) return <Cargando texto="Calculando métricas" />;

  const vista = soloAprobadas ? metricas.confirmado : metricas;
  const estados = metricas.porEstadoInscripcion;
  const porRevisar = estados.EN_REVISION;
  const soles = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE')}`;

  return (
    <div className="space-y-6">
      <EstadoDelSistema />

      {porRevisar > 0 && (
        <button
          onClick={() => irA('inscripciones')}
          className="flex w-full flex-wrap items-center justify-between gap-4 rounded-3xl bg-granate-600 p-6 text-left text-white transition hover:bg-granate-700"
        >
          <div className="flex items-center gap-4">
            <ClipboardCheck className="h-10 w-10 shrink-0" />
            <div>
              <p className="text-2xl font-black">
                {porRevisar} {porRevisar === 1 ? 'delegación espera' : 'delegaciones esperan'} su
                revisión
              </p>
              <p className="mt-1 text-base text-granate-100">
                Toque para abrir la lista de inscripciones.
              </p>
            </div>
          </div>
          <span className="text-base font-bold text-granate-100">Revisar →</span>
        </button>
      )}

      {/* Inscrito vs confirmado: el mismo tablero contando solo lo aprobado. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-100 p-2">
        {[
          { valor: false, texto: 'Todo lo inscrito' },
          { valor: true, texto: 'Solo lo aprobado' },
        ].map((opcion) => (
          <button
            key={opcion.texto}
            onClick={() => setSoloAprobadas(opcion.valor)}
            className={`flex-1 rounded-xl px-5 py-3 text-center text-base font-bold transition ${
              soloAprobadas === opcion.valor
                ? 'bg-granate-600 text-white shadow-suave'
                : 'text-slate-600 hover:bg-white'
            }`}
          >
            {opcion.texto}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica valor={vista.tutores} texto="Delegaciones" icono={School} />
        <Metrica valor={vista.alumnos} texto="Estudiantes" icono={Users} />
        <Metrica valor={vista.colegios} texto="Instituciones" icono={Building2} />
        <Metrica valor={vista.promedioPorTutor} texto="Promedio por delegación" icono={IconoGrado} />
      </div>

      {/* --- Dinero: solo el administrador lo ve completo --- */}
      <Tarjeta className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-xl font-black text-slate-900">Recaudación</h3>
          <p className="text-base text-slate-500">
            {metricas.recaudado.comprobantes}{' '}
            {metricas.recaudado.comprobantes === 1 ? 'comprobante' : 'comprobantes'}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Dinero
            texto="Aprobado"
            monto={metricas.recaudado.aprobado}
            cantidad={metricas.recaudado.porEstado.APROBADO.total}
            clase="bg-emerald-50 text-emerald-800"
          />
          <Dinero
            texto="En revisión"
            monto={metricas.recaudado.enRevision}
            cantidad={metricas.recaudado.porEstado.EN_REVISION.total}
            clase="bg-sky-50 text-sky-800"
          />
          <Dinero
            texto="Rechazado"
            monto={metricas.recaudado.rechazado}
            cantidad={metricas.recaudado.porEstado.RECHAZADO.total}
            clase="bg-rose-50 text-rose-800"
          />
        </div>

        <div className="mt-6 rounded-2xl border-2 border-slate-200 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-base font-semibold text-slate-700">Estudiantes con pago enviado</p>
            <p className="text-base text-slate-600">
              {metricas.cobertura.pagados} de {metricas.alumnos}
            </p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-granate-600 transition-all duration-700"
              style={{
                width: `${metricas.alumnos ? (metricas.cobertura.pagados / metricas.alumnos) * 100 : 0}%`,
              }}
            />
          </div>
          {metricas.cobertura.pendientes > 0 && (
            <p className="mt-3 text-base text-amber-800">
              {metricas.cobertura.pendientes} sin comprobante todavía.
            </p>
          )}
        </div>
      </Tarjeta>

      {/* --- En qué punto está cada delegación --- */}
      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">Estado de las delegaciones</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { id: 'BORRADOR', texto: 'Borrador', clase: 'bg-slate-100 text-slate-700' },
            { id: 'PENDIENTE_PAGO', texto: 'Pago adjuntado', clase: 'bg-amber-100 text-amber-800' },
            { id: 'EN_REVISION', texto: 'En revisión', clase: 'bg-sky-100 text-sky-800' },
            { id: 'APROBADA', texto: 'Aprobadas', clase: 'bg-emerald-100 text-emerald-800' },
            { id: 'OBSERVADA', texto: 'Observadas', clase: 'bg-rose-100 text-rose-800' },
          ].map((fila) => (
            <div key={fila.id} className={`rounded-2xl p-5 ${fila.clase}`}>
              <p className="text-3xl font-black">{estados[fila.id]}</p>
              <p className="mt-1 text-base font-semibold">{fila.texto}</p>
            </div>
          ))}
        </div>
      </Tarjeta>

      <div className="grid gap-6 xl:grid-cols-2">
        <Tarjeta className="p-6">
          <h3 className="text-xl font-black text-slate-900">Por departamento</h3>
          <div className="mt-5 space-y-4">
            {vista.porRegion.length === 0 && (
              <p className="text-base text-slate-500">Sin inscripciones todavía.</p>
            )}
            {vista.porRegion.map((fila) => (
              <Barra
                key={fila.region}
                texto={fila.region}
                valor={fila.total}
                maximo={vista.porRegion[0].total}
              />
            ))}
          </div>
        </Tarjeta>

        <Tarjeta className="p-6">
          <h3 className="text-xl font-black text-slate-900">Por provincia</h3>
          <div className="mt-5 space-y-4">
            {(metricas.porProvincia || []).length === 0 && (
              <p className="text-base text-slate-500">Sin inscripciones todavía.</p>
            )}
            {(metricas.porProvincia || []).slice(0, 8).map((fila) => (
              <Barra
                key={fila.provincia}
                texto={fila.provincia}
                valor={fila.total}
                maximo={metricas.porProvincia[0].total}
              />
            ))}
          </div>
        </Tarjeta>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Tarjeta className="p-6">
          <h3 className="text-xl font-black text-slate-900">Por categoría</h3>
          <div className="mt-5 space-y-4">
            {vista.porGrado.map((fila) => (
              <Barra
                key={fila.categoria}
                texto={`CAT. ${fila.categoria} · ${fila.label}`}
                valor={fila.total}
                maximo={Math.max(1, ...vista.porGrado.map((g) => g.total))}
              />
            ))}
          </div>
        </Tarjeta>

        <div className="space-y-6">
          <Tarjeta className="p-6">
            <h3 className="text-xl font-black text-slate-900">Por modalidad</h3>
            <div className="mt-5 space-y-4">
              {vista.porModalidad.length === 0 && (
                <p className="text-base text-slate-500">Sin datos aún.</p>
              )}
              {vista.porModalidad.map((fila) => (
                <Barra
                  key={fila.modalidad}
                  texto={ETIQUETA_MODALIDAD_PLURAL[fila.modalidad] || fila.modalidad}
                  valor={fila.total}
                  maximo={Math.max(1, ...vista.porModalidad.map((m) => m.total))}
                />
              ))}
            </div>
          </Tarjeta>

          <Tarjeta className="p-6">
            <h3 className="text-xl font-black text-slate-900">Por nivel</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-granate-50 p-5">
                <p className="text-3xl font-black text-granate-700">
                  {metricas.porNivel.PRIMARIA}
                </p>
                <p className="mt-1 text-base text-slate-600">Primaria</p>
              </div>
              <div className="rounded-2xl bg-granate-50 p-5">
                <p className="text-3xl font-black text-granate-700">
                  {metricas.porNivel.SECUNDARIA}
                </p>
                <p className="mt-1 text-base text-slate-600">Secundaria</p>
              </div>
            </div>
          </Tarjeta>
        </div>
      </div>

      {/* --- Lo último que pasó, con acceso directo --- */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Tarjeta className="p-6">
          <h3 className="text-xl font-black text-slate-900">Últimas delegaciones</h3>
          <div className="mt-5 space-y-2">
            {metricas.recientes.tutores.length === 0 && (
              <p className="text-base text-slate-500">Todavía no hay registros.</p>
            )}
            {metricas.recientes.tutores.map((fila) => (
              <button
                key={fila.id}
                onClick={() => irA('inscripciones', fila.id)}
                className="flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold text-slate-900">
                    {fila.institucion || 'Sin institución'}
                  </span>
                  <span className="block truncate text-base text-slate-500">{fila.tutor}</span>
                </span>
                <span className="shrink-0 text-base text-slate-400">{cuando(fila.cuando)}</span>
              </button>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta className="p-6">
          <h3 className="text-xl font-black text-slate-900">Últimos comprobantes</h3>
          <div className="mt-5 space-y-2">
            {metricas.recientes.pagos.length === 0 && (
              <p className="text-base text-slate-500">Todavía no hay comprobantes.</p>
            )}
            {metricas.recientes.pagos.map((fila) => (
              <button
                key={fila.id}
                onClick={() => irA('inscripciones', fila.tutorId)}
                className="flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold text-slate-900">
                    {soles(fila.monto)} · {fila.metodo === 'BCP' ? 'BCP' : 'Yape'}
                  </span>
                  <span className="block truncate text-base text-slate-500">
                    {fila.institucion || 'Sin institución'}
                  </span>
                </span>
                <Etiqueta className={CLASE_PAGO[fila.estado] || CLASE_PAGO.EN_REVISION}>
                  {TEXTO_PAGO[fila.estado] || 'En revisión'}
                </Etiqueta>
              </button>
            ))}
          </div>
        </Tarjeta>
      </div>

      {/* --- Solo el administrador: el equipo y los atajos --- */}
      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">Comisión y accesos</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-granate-50 p-5">
            <p className="text-3xl font-black text-granate-700">
              {metricas.equipo.administradores}
            </p>
            <p className="mt-1 text-base text-slate-600">Administradores</p>
          </div>
          <button
            onClick={() => irA('ajustes-supervisores')}
            className="rounded-2xl bg-granate-50 p-5 text-left transition hover:bg-granate-100"
          >
            <p className="text-3xl font-black text-granate-700">{metricas.equipo.supervisores}</p>
            <p className="mt-1 text-base text-slate-600">Supervisores →</p>
          </button>
          <button
            onClick={() => irA('reportes')}
            className="rounded-2xl bg-slate-50 p-5 text-left transition hover:bg-slate-100"
          >
            <FileSpreadsheet className="h-7 w-7 text-granate-600" />
            <p className="mt-3 text-base font-semibold text-slate-800">Descargar consolidado →</p>
          </button>
          <button
            onClick={() => irA('ajustes-inscripciones')}
            className="rounded-2xl bg-slate-50 p-5 text-left transition hover:bg-slate-100"
          >
            <CalendarCheck className="h-7 w-7 text-granate-600" />
            <p className="mt-3 text-base font-semibold text-slate-800">
              Abrir o cerrar inscripciones →
            </p>
          </button>
        </div>
      </Tarjeta>
    </div>
  );
}

const CLASE_PAGO = {
  EN_REVISION: 'bg-sky-100 text-sky-800',
  APROBADO: 'bg-emerald-100 text-emerald-800',
  RECHAZADO: 'bg-rose-100 text-rose-800',
};

const TEXTO_PAGO = {
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
};

/** "hace 3 h", "ayer": más corto de leer que una fecha completa. */
function cuando(iso) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 60) return `hace ${Math.max(1, minutos)} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}

function Dinero({ texto, monto, cantidad, clase }) {
  return (
    <div className={`rounded-2xl p-5 ${clase}`}>
      <p className="text-3xl font-black">S/ {Number(monto || 0).toLocaleString('es-PE')}</p>
      <p className="mt-1 text-base font-semibold">{texto}</p>
      <p className="mt-1 text-base opacity-80">
        {cantidad} {cantidad === 1 ? 'comprobante' : 'comprobantes'}
      </p>
    </div>
  );
}



/**
 * Estado del sistema: qué está conectado y qué no.
 *
 * Va primero en el tablero a propósito. La idea es que el administrador se
 * entere de que el correo dejó de andar antes de que se lo diga un tutor.
 */
function EstadoDelSistema() {
  const [estado, setEstado] = useState(null);
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    api
      .get('/admin/estado')
      .then(({ data }) => setEstado(data))
      .catch(() => setEstado(false));
  }, []);

  if (!estado) return null;

  const respaldar = async () => {
    setBajando(true);
    try {
      const marca = new Date().toISOString().slice(0, 10);
      await descargar('/admin/respaldo', `respaldo-omasur-${marca}.json`);
    } finally {
      setBajando(false);
    }
  };

  const puntos = [
    {
      ok: estado.correo.activo,
      texto: 'Correo',
      detalle: estado.correo.activo ? estado.correo.remitente : 'Sin configurar: no salen avisos',
    },
    {
      ok: estado.almacenamiento.enCloudflare,
      texto: 'Archivos',
      detalle: estado.almacenamiento.enCloudflare
        ? `Cloudflare · ${estado.almacenamiento.bucket}`
        : 'En el disco del servidor: se pierden al desplegar',
    },
    {
      ok: estado.almacenamiento.comprobantesEnDisco === 0,
      texto: 'Comprobantes',
      detalle:
        estado.almacenamiento.comprobantesEnDisco === 0
          ? 'Todos en Cloudflare'
          : `${estado.almacenamiento.comprobantesEnDisco} todavía en disco`,
    },
    {
      ok: estado.respaldo.existe && dias(estado.respaldo.cuando) <= 1,
      texto: 'Respaldo',
      detalle: estado.respaldo.existe
        ? `Último: ${cuando(estado.respaldo.cuando)}`
        : 'Nunca se hizo uno',
    },
  ];

  const problemas = puntos.filter((p) => !p.ok).length;

  return (
    <Tarjeta className={`p-6 ${problemas ? 'border-2 border-amber-300' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-900">
          Estado del sistema
          {problemas > 0 && (
            <span className="ml-3 text-base font-bold text-amber-700">
              {problemas} {problemas === 1 ? 'cosa por revisar' : 'cosas por revisar'}
            </span>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Etiqueta
            className={
              estado.inscripciones.abiertas
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-700'
            }
          >
            {estado.inscripciones.abiertas ? 'Inscripciones abiertas' : 'Inscripciones cerradas'}
          </Etiqueta>
          <Boton variante="contorno" tamano="chico" cargando={bajando} onClick={respaldar}>
            <Download className="h-5 w-5" />
            Descargar respaldo
          </Boton>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {puntos.map((punto) => (
          <div
            key={punto.texto}
            className={`rounded-2xl p-5 ${punto.ok ? 'bg-emerald-50' : 'bg-amber-50'}`}
          >
            <div className="flex items-center gap-3">
              {punto.ok ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-6 w-6 shrink-0 text-amber-600" />
              )}
              <p
                className={`text-base font-black ${punto.ok ? 'text-emerald-900' : 'text-amber-900'}`}
              >
                {punto.texto}
              </p>
            </div>
            <p className={`mt-2 text-base ${punto.ok ? 'text-emerald-800' : 'text-amber-800'}`}>
              {punto.detalle}
            </p>
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

/** Días transcurridos, para saber si el respaldo quedó viejo. */
function dias(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}
