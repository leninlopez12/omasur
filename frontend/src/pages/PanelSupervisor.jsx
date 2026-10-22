import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap as IconoGrado,
  GraduationCap,
  IdCard,
  Megaphone,
  LayoutDashboard,
  MapPin,
  Landmark,
  MessageCircle,
  QrCode,
  ReceiptText,
  RefreshCw,
  School,
  Search,
  Settings,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import PanelLayout from '../layouts/PanelLayout.jsx';
import { Boton, Cargando, Etiqueta, Tarjeta } from '../components/Ui.jsx';
import { ListaInscripciones, RevisarInscripcion } from '../components/Inscripciones.jsx';
import RevisarAlumnos from '../components/RevisarAlumnos.jsx';
import Abonos from '../components/Abonos.jsx';
import Consolidado from '../components/Consolidado.jsx';
import EtapasCredencial from '../components/EtapasCredencial.jsx';
import Comunicados from '../components/Comunicados.jsx';
import CredencialesComision from '../components/CredencialesComision.jsx';
import {
  AjusteBcp,
  AjusteWhatsapp,
  AjusteYape,
  CierreInscripciones,
  GruposWhatsApp,
} from '../components/Ajustes.jsx';
import { ConsultaEstudiantes, ConsultaTutores } from '../components/Consultas.jsx';
import IconoWhatsApp from '../components/IconoWhatsApp.jsx';
import Campanita from '../components/Campanita.jsx';
import AvisosEnVivo from '../components/AvisosEnVivo.jsx';
import PermisoAvisos from '../components/PermisoAvisos.jsx';
import { NotificacionesProvider } from '../lib/notificaciones.jsx';
import { api } from '../lib/api';
import { useAjustes } from '../lib/ajustes';
import { ESTADOS, ETIQUETA_MODALIDAD } from '../lib/datos';

const SECCIONES = [
  { id: 'resumen', texto: 'Resumen', icono: LayoutDashboard },
  { id: 'aprobar', texto: 'Por aprobar', icono: ClipboardCheck },
  { id: 'revisar-alumnos', texto: 'Inscripciones', icono: ReceiptText },
  { id: 'delegaciones', texto: 'Delegaciones', icono: School },
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
    ],
  },
];

const TITULOS = {
  resumen: 'Resumen',
  aprobar: 'Por aprobar',
  'revisar-alumnos': 'Inscripciones por alumno',
  delegaciones: 'Delegaciones',
  abonos: 'Abonos por delegación',
  'consulta-tutores': 'Consultas · Tutores',
  'consulta-estudiantes': 'Consultas · Estudiantes',
  consolidado: 'Consolidado general',
  'cred-delegaciones': 'Credenciales de delegaciones',
  'cred-tutores': 'Credenciales de tutores',
  'ajustes-inscripciones': 'Ajustes · Inscripciones',
  'ajustes-whatsapp': 'Ajustes · Grupo WhatsApp',
  'ajustes-boton-wa': 'Ajustes · Botón de WhatsApp',
  'ajustes-yape': 'Ajustes · Yape',
  'ajustes-bcp': 'Ajustes · BCP',
  'ajustes-credencial': 'Ajustes · Diseño de credenciales',
  'ajustes-comunicado': 'Ajustes · Comunicado',
};

const soles = (valor) => `S/ ${Number(valor || 0).toLocaleString('es-PE')}`;

export default function PanelSupervisor() {
  return (
    <NotificacionesProvider>
      <Contenido />
    </NotificacionesProvider>
  );
}

function Contenido() {
  const [seccion, setSeccion] = useState('resumen');
  const [detalleId, setDetalleId] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const { ajustes, recargar: recargarAjustes } = useAjustes();

  const cargar = useCallback(async () => {
    const { data } = await api.get('/admin/metricas');
    setMetricas(data);
  }, []);

  useEffect(() => {
    cargar();
    const reloj = setInterval(cargar, 30000);
    return () => clearInterval(reloj);
  }, [cargar]);

  const cambiarSeccion = (id) => {
    setDetalleId(null);
    setSeccion(id);
  };

  const revision = (estadoInicial) =>
    detalleId ? (
      <RevisarInscripcion id={detalleId} alVolver={() => setDetalleId(null)} alRevisar={cargar} />
    ) : (
      <ListaInscripciones alAbrir={setDetalleId} estadoInicial={estadoInicial} />
    );

  /** Desde un aviso se salta directo a la delegación que lo originó. */
  const abrirTutor = (tutorId) => {
    setSeccion('delegaciones');
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
          alIrAAprobar={() => cambiarSeccion('aprobar')}
        />
      }
    >
      <AvisosEnVivo alAbrirTutor={abrirTutor} />
      <PermisoAvisos />

      {seccion === 'resumen' &&
        (!metricas ? (
          <Cargando />
        ) : (
          <Resumen
            metricas={metricas}
            alActualizar={cargar}
            alIrAAprobar={() => cambiarSeccion('aprobar')}
          />
        ))}

      {seccion === 'aprobar' && revision('EN_REVISION')}
      {seccion === 'delegaciones' && revision('')}
      {seccion === 'abonos' && <Abonos />}

      {seccion === 'revisar-alumnos' &&
        (detalleId ? (
          <RevisarInscripcion
            id={detalleId}
            alVolver={() => setDetalleId(null)}
            alRevisar={cargar}
          />
        ) : (
          <RevisarAlumnos alAbrirTutor={setDetalleId} />
        ))}

      {seccion === 'consulta-tutores' && <ConsultaTutores alAbrirTutor={abrirTutor} />}
      {seccion === 'consulta-estudiantes' && <ConsultaEstudiantes />}
      {seccion === 'consolidado' && <Consolidado />}
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
    </PanelLayout>
  );
}

/**
 * Resumen del supervisor.
 *
 * Regla de esta pantalla: cada dato aparece UNA sola vez. Lo aprobado y el total
 * no van en dos bloques separados, sino en la misma tarjeta o en la misma barra,
 * con el verde marcando siempre lo ya aprobado.
 */
function Resumen({ metricas, alActualizar, alIrAAprobar }) {
  const [actualizando, setActualizando] = useState(false);

  const refrescar = async () => {
    setActualizando(true);
    try {
      await alActualizar();
    } finally {
      setActualizando(false);
    }
  };

  const ok = metricas.confirmado || {};
  const aprobadoPorRegion = porClave(ok.porRegion, 'region');
  const aprobadoPorModalidad = porClave(ok.porModalidad, 'modalidad');
  const aprobadoPorGrado = porClave(ok.porGrado, 'categoria');

  const maxDepartamento = metricas.porRegion[0]?.total || 1;
  const maxProvincia = metricas.porProvincia[0]?.total || 1;

  return (
    <div className="w-full space-y-5">
      <Pendientes
        cantidad={metricas.enRevision}
        alIr={alIrAAprobar}
        actualizando={actualizando}
        alActualizar={refrescar}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CifraDoble
          icono={GraduationCap}
          aprobado={ok.alumnos ?? 0}
          total={metricas.alumnos}
          titulo="Estudiantes aprobados"
          pie="inscritos"
        />
        <CifraDoble
          icono={Users}
          aprobado={ok.tutores ?? 0}
          total={metricas.tutores}
          titulo="Tutores aprobados"
          pie="registrados"
        />
        <CifraDoble
          icono={School}
          aprobado={ok.colegios ?? 0}
          total={metricas.colegios}
          titulo="Colegios aprobados"
          pie="inscritos"
        />
        <CifraDoble
          icono={Wallet}
          aprobado={ok.recaudado ?? 0}
          total={metricas.recaudado.total}
          titulo="Yape aprobado"
          pie="recibidos"
          moneda
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Bloque titulo="Pagos por Yape" icono={Wallet}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Dato valor={soles(metricas.recaudado.aprobado)} texto="Aprobado" tono="verde" />
            <Dato valor={soles(metricas.recaudado.enRevision)} texto="En revisión" />
            <Dato valor={metricas.recaudado.comprobantes} texto="Comprobantes" />
          </div>
        </Bloque>

        <Bloque titulo="Tipo de colegio" icono={Building2}>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODALIDADES.map(({ clave, texto }) => (
              <Dato
                key={clave}
                valor={totalDe(metricas.porModalidad, 'modalidad', clave)}
                texto={texto}
                pie={aprobados(aprobadoPorModalidad[clave] || 0)}
              />
            ))}
          </div>
        </Bloque>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Bloque titulo="Departamentos" icono={MapPin} leyenda>
          {metricas.porRegion.length === 0 ? (
            <SinDatos />
          ) : (
            metricas.porRegion.map((fila) => (
              <BarraDoble
                key={fila.region}
                texto={fila.region}
                aprobado={aprobadoPorRegion[fila.region] || 0}
                total={fila.total}
                maximo={maxDepartamento}
              />
            ))
          )}
        </Bloque>

        <Bloque titulo="Provincias" icono={MapPin}>
          {metricas.porProvincia.length === 0 ? (
            <SinDatos />
          ) : (
            metricas.porProvincia
              .slice(0, 10)
              .map((fila) => (
                <BarraDoble
                  key={fila.provincia}
                  texto={fila.provincia}
                  aprobado={0}
                  total={fila.total}
                  maximo={maxProvincia}
                  simple
                />
              ))
          )}
        </Bloque>
      </div>

      <Bloque titulo="Estudiantes por categoría" icono={IconoGrado} leyenda>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metricas.porGrado.map((fila) => (
            <Categoria
              key={fila.categoria}
              letra={fila.categoria}
              grado={fila.label}
              total={fila.total}
              aprobado={aprobadoPorGrado[fila.categoria] || 0}
            />
          ))}
        </div>
      </Bloque>

      <Bloque
        titulo={`Delegaciones (${metricas.delegaciones.length})`}
        icono={School}
        pie={`${metricas.promedioPorTutor} alumnos por tutor en promedio`}
      >
        {metricas.delegaciones.length === 0 ? (
          <SinDatos />
        ) : (
          <TablaDelegaciones filas={metricas.delegaciones} />
        )}
      </Bloque>
    </div>
  );
}

const MODALIDADES = [
  { clave: 'ESTATAL', texto: 'Estatales' },
  { clave: 'PARTICULAR', texto: 'Particulares' },
  { clave: 'GRUPO_ESTUDIO', texto: 'Grupos de estudio' },
];

/** Convierte [{region:'Puno', total:2}] en {Puno: 2} para poder cruzarlo. */
function porClave(lista, campo) {
  return (lista || []).reduce((acumulado, fila) => {
    acumulado[fila[campo]] = fila.total;
    return acumulado;
  }, {});
}

function totalDe(lista, campo, valor) {
  return (lista || []).find((fila) => fila[campo] === valor)?.total || 0;
}

const aprobados = (cantidad) => `${cantidad} ${cantidad === 1 ? 'aprobado' : 'aprobados'}`;

/**
 * Lo primero de la pantalla: lo único que el supervisor tiene que hacer hoy.
 */
function Pendientes({ cantidad, alIr, actualizando, alActualizar }) {
  const hay = cantidad > 0;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 p-5 ${
        hay ? 'border-granate-200 bg-granate-50' : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      <div className="flex items-center gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            hay ? 'bg-granate-600' : 'bg-emerald-600'
          }`}
        >
          {hay ? (
            <ClipboardCheck className="h-6 w-6 text-white" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-white" />
          )}
        </span>
        <div>
          <p className={`text-xl font-black ${hay ? 'text-granate-800' : 'text-emerald-800'}`}>
            {hay ? `${cantidad} esperando su aprobación` : 'Nada pendiente de aprobar'}
          </p>
          <p className="mt-0.5 text-base text-slate-600">
            {hay ? 'Delegaciones enviadas a revisión' : 'Todas las delegaciones están al día'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Boton variante="suave" tamano="chico" cargando={actualizando} onClick={alActualizar}>
          <RefreshCw className="h-5 w-5" />
          Actualizar
        </Boton>
        {hay && (
          <Boton tamano="chico" onClick={alIr}>
            <ClipboardCheck className="h-5 w-5" />
            Revisar
          </Boton>
        )}
      </div>
    </div>
  );
}

/**
 * Una sola tarjeta por concepto: arriba lo aprobado, abajo de cuánto sale.
 * Antes eran dos bloques con las mismas etiquetas y se prestaba a confusión.
 */
function CifraDoble({ icono: Icono, aprobado, total, titulo, pie, moneda = false }) {
  const parte = total > 0 ? Math.round((aprobado / total) * 100) : 0;
  const mostrar = (valor) => (moneda ? soles(valor) : valor);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-suave">
      <div className="flex items-center justify-between">
        <Icono className="h-7 w-7 text-emerald-600" />
        <span className="text-base font-bold text-slate-400">{parte}%</span>
      </div>

      <p className="mt-3 text-4xl font-black leading-none text-emerald-700">{mostrar(aprobado)}</p>
      <p className="mt-2 text-xl font-bold leading-tight text-slate-900">{titulo}</p>
      <p className="mt-1 text-base text-slate-500">
        de {mostrar(total)} {pie}
      </p>

      {/* mt-auto deja todas las barras a la misma altura aunque un título ocupe dos líneas. */}
      <div className="mt-auto pt-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-700"
            style={{ width: `${parte}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Caja con título. Todo el resumen usa esta misma caja para que nada desentone. */
function Bloque({ titulo, icono: Icono, pie, leyenda = false, children }) {
  return (
    <Tarjeta className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-3 text-xl font-black text-slate-900">
          {Icono && <Icono className="h-6 w-6 text-granate-600" />}
          {titulo}
        </h3>
        {leyenda && (
          <span className="flex items-center gap-2 text-base text-slate-500">
            <span className="h-3 w-3 rounded-full bg-emerald-600" />
            aprobado
          </span>
        )}
      </div>
      {pie && <p className="mt-1 text-base text-slate-500">{pie}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </Tarjeta>
  );
}

/**
 * Barra con dos tramos: el verde es lo aprobado y el granate lo que falta
 * aprobar. Así no hace falta repetir el mismo gráfico en dos tarjetas.
 */
function BarraDoble({ texto, aprobado, total, maximo, simple = false }) {
  const ancho = maximo ? Math.round((total / maximo) * 100) : 0;
  const verde = total ? Math.round((aprobado / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-base text-slate-700">{texto}</span>
        {/* "1 de 4" y no "1 4", que se leía como catorce. */}
        <span className="shrink-0 text-base font-bold text-slate-900">
          {!simple && aprobado > 0 && (
            <>
              <span className="font-black text-emerald-700">{aprobado}</span>
              <span className="mx-1 font-normal text-slate-400">de</span>
            </>
          )}
          {total}
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-granate-600" style={{ width: `${ancho}%` }}>
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-700"
            style={{ width: `${verde}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Las nueve categorías del concurso, de la A a la I. */
function Categoria({ letra, grado, total, aprobado }) {
  const vacia = total === 0;

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 ${
        vacia ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-black ${
          vacia ? 'bg-slate-200 text-slate-400' : 'bg-granate-600 text-white'
        }`}
      >
        {letra}
      </span>
      <div className="min-w-0">
        <p className="text-base text-slate-600">{grado}</p>
        {/* Mismo formato que las barras: verde "de" total, para no leerlo pegado. */}
        <p className="text-xl font-black text-slate-900">
          {aprobado > 0 && (
            <>
              <span className="text-emerald-700">{aprobado}</span>
              <span className="mx-1 text-base font-normal text-slate-400">de</span>
            </>
          )}
          {total}
        </p>
      </div>
    </div>
  );
}

function Dato({ valor, texto, pie, tono = 'gris' }) {
  return (
    <div
      className={`rounded-2xl p-4 ${tono === 'verde' ? 'bg-emerald-50' : 'bg-slate-50'}`}
    >
      <p
        className={`text-2xl font-black leading-none ${
          tono === 'verde' ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {valor}
      </p>
      <p className="mt-2 text-base text-slate-600">{texto}</p>
      {pie && <p className="mt-0.5 text-base font-semibold text-emerald-700">{pie}</p>}
    </div>
  );
}

function TablaDelegaciones({ filas }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-left">
        <thead>
          <tr className="border-b border-slate-200 text-base text-slate-500">
            <th className="pb-3 pr-4 font-semibold">Institución</th>
            <th className="pb-3 pr-4 font-semibold">Tutor</th>
            <th className="pb-3 pr-4 font-semibold">Ubicación</th>
            <th className="pb-3 pr-4 font-semibold">Colegio</th>
            <th className="pb-3 pr-4 font-semibold">Alumnos</th>
            <th className="pb-3 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const estado = ESTADOS[fila.estado] || ESTADOS.BORRADOR;
            return (
              <tr key={fila.id} className="border-b border-slate-100 hover:bg-granate-50/60">
                <td className="py-3 pr-4 text-base font-bold text-slate-900">
                  {fila.institucion || 'Sin institución'}
                </td>
                <td className="py-3 pr-4 text-base text-slate-700">{fila.tutor}</td>
                <td className="py-3 pr-4 text-base text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-granate-500" />
                    {fila.departamento || '—'}
                    {fila.provincia ? ` · ${fila.provincia}` : ''}
                  </span>
                </td>
                <td className="py-3 pr-4 text-base text-slate-600">
                  {ETIQUETA_MODALIDAD[fila.modalidad] || fila.modalidad}
                </td>
                <td className="py-3 pr-4 text-base font-black text-granate-700">{fila.alumnos}</td>
                <td className="py-3">
                  <Etiqueta compacto className={estado.clase}>
                    {estado.texto}
                  </Etiqueta>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SinDatos() {
  return <p className="text-base text-slate-500">Todavía no hay datos.</p>;
}
