import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Download,
  Landmark,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { VistaComprobante } from './PasoPago.jsx';
import { api, descargar, mensajeError } from '../lib/api';

const VACIO = {
  metodo: '',
  estado: '',
  modalidad: '',
  departamento: '',
  desde: '',
  hasta: '',
  buscar: '',
};

const ESTADOS = {
  APROBADO: { texto: 'Aprobado', clase: 'bg-emerald-100 text-emerald-800' },
  EN_REVISION: { texto: 'En revisión', clase: 'bg-sky-100 text-sky-800' },
  RECHAZADO: { texto: 'Observado', clase: 'bg-rose-100 text-rose-800' },
};

const MODALIDADES = [
  { id: 'ESTATAL', texto: 'Institución estatal' },
  { id: 'PARTICULAR', texto: 'Institución particular' },
  { id: 'GRUPO_ESTUDIO', texto: 'Grupo de estudio' },
];

const soles = (valor) => `S/ ${Number(valor || 0).toLocaleString('es-PE')}`;

const fechaHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

/**
 * Abonos por delegación.
 *
 * El consolidado de reportes cuenta estudiantes; esta pantalla cuenta dinero,
 * y lo agrupa por delegación: una institución que pagó en siete veces sale en
 * una sola fila con su total, que es como hay que cuadrarlo contra el estado
 * de cuenta de Yape y el del banco.
 */
export default function Abonos() {
  const [filtros, setFiltros] = useState(VACIO);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async (valores) => {
    setError('');
    try {
      const { data } = await api.get('/admin/abonos', { params: limpiar(valores) });
      setDatos(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar los abonos'));
    }
  }, []);

  // Cada cambio recalcula, con un respiro para no pedir en cada tecla.
  useEffect(() => {
    const reloj = setTimeout(() => cargar(filtros), 400);
    return () => clearTimeout(reloj);
  }, [filtros, cargar]);

  const cambiar = (campo) => (evento) => {
    setFiltros({ ...filtros, [campo]: evento.target.value });
    setAbierta(null);
  };

  const bajar = async () => {
    setBajando(true);
    setError('');
    try {
      const params = new URLSearchParams(limpiar(filtros)).toString();
      await descargar(`/admin/abonos/excel?${params}`, 'abonos-por-delegacion.xlsx');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setBajando(false);
    }
  };

  const activos = Object.values(limpiar(filtros)).length;
  const departamentos = [
    ...new Set((datos?.filas || []).map((f) => f.departamento).filter(Boolean)),
  ].sort();

  return (
    <div className="space-y-8">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h3 className="text-3xl font-black text-slate-900">Abonos por delegación</h3>
            <p className="mt-3 text-xl text-slate-600">
              Cuánto abonó cada institución, por Yape y por BCP, sumando todos sus comprobantes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {activos > 0 && (
              <Boton variante="fantasma" tamano="chico" onClick={() => setFiltros(VACIO)}>
                <RotateCcw className="h-5 w-5" />
                Limpiar filtros
              </Boton>
            )}
            <Boton tamano="chico" cargando={bajando} onClick={bajar}>
              <Download className="h-5 w-5" />
              Descargar Excel
            </Boton>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block xl:col-span-2">
            <span className="mb-2 block text-xl font-semibold text-slate-800">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
              <input
                value={filtros.buscar}
                onChange={cambiar('buscar')}
                placeholder="Institución, tutor o correo"
                className="w-full rounded-2xl border-2 border-slate-200 py-3 pl-14 pr-5 text-xl outline-none focus:border-granate-600"
              />
            </div>
          </label>

          <Selector etiqueta="Método" value={filtros.metodo} onChange={cambiar('metodo')}>
            <option value="">Yape y BCP</option>
            <option value="YAPE">Solo Yape</option>
            <option value="BCP">Solo BCP</option>
          </Selector>

          <Selector etiqueta="Estado" value={filtros.estado} onChange={cambiar('estado')}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([id, e]) => (
              <option key={id} value={id}>
                {e.texto}
              </option>
            ))}
          </Selector>

          <Selector etiqueta="Modalidad" value={filtros.modalidad} onChange={cambiar('modalidad')}>
            <option value="">Todas</option>
            {MODALIDADES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.texto}
              </option>
            ))}
          </Selector>

          <Selector
            etiqueta="Departamento"
            value={filtros.departamento}
            onChange={cambiar('departamento')}
          >
            <option value="">Todos</option>
            {departamentos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Selector>

          <Campo
            etiqueta="Enviados desde"
            value={filtros.desde}
            onChange={cambiar('desde')}
            max={filtros.hasta || undefined}
          />
          <Campo
            etiqueta="Hasta"
            value={filtros.hasta}
            onChange={cambiar('hasta')}
            min={filtros.desde || undefined}
          />
        </div>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      )}

      {!datos ? (
        <Cargando texto="Sumando los abonos" />
      ) : (
        <>
          <Totales totales={datos.totales} descripcion={datos.descripcion} />
          <Tabla
            filas={datos.filas}
            abierta={abierta}
            alAbrir={(id) => setAbierta(abierta === id ? null : id)}
          />
        </>
      )}
    </div>
  );
}

/** Campo de fecha: el mismo alto y borde que los desplegables de al lado. */
function Campo({ etiqueta, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xl font-semibold text-slate-800">{etiqueta}</span>
      <input
        type="date"
        {...props}
        className="w-full rounded-2xl border-2 border-slate-200 px-5 py-3 text-xl outline-none focus:border-granate-600"
      />
    </label>
  );
}

/** Las cifras de arriba: primero por dónde entró, después en qué estado está. */
function Totales({ totales, descripcion }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Cifra
          icono={Wallet}
          titulo="Yape"
          monto={totales.yape.monto}
          pie={`${totales.yape.comprobantes} comprobantes`}
          clase="bg-yape-50 text-yape-700"
        />
        <Cifra
          icono={Landmark}
          titulo="BCP"
          monto={totales.bcp.monto}
          pie={`${totales.bcp.comprobantes} comprobantes`}
          clase="bg-sky-50 text-sky-700"
        />
        <Cifra
          titulo="Total abonado"
          monto={totales.general.monto}
          pie={`${totales.general.comprobantes} comprobantes`}
          clase="bg-granate-50 text-granate-700"
        />
        <Cifra
          titulo="Delegaciones"
          valor={totales.delegaciones}
          pie={`${totales.estudiantesCubiertos} estudiantes cubiertos`}
          clase="bg-slate-100 text-slate-700"
        />
      </div>

      <Tarjeta className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h4 className="text-xl font-black text-slate-900">Según el estado del comprobante</h4>
          <p className="text-base text-slate-500">{descripcion}</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Estado texto="Aprobado" datos={totales.aprobado} clase="bg-emerald-50 text-emerald-800" />
          <Estado texto="En revisión" datos={totales.enRevision} clase="bg-sky-50 text-sky-800" />
          <Estado texto="Observado" datos={totales.rechazado} clase="bg-rose-50 text-rose-800" />
        </div>
      </Tarjeta>
    </div>
  );
}

function Cifra({ icono: Icono, titulo, monto, valor, pie, clase }) {
  return (
    <div className={`rounded-2xl p-5 ${clase}`}>
      <div className="flex items-center gap-3">
        {Icono && <Icono className="h-6 w-6" />}
        <p className="text-xl font-bold">{titulo}</p>
      </div>
      <p className="mt-3 text-4xl font-black leading-none">
        {valor !== undefined ? valor : soles(monto)}
      </p>
      <p className="mt-2 text-base opacity-80">{pie}</p>
    </div>
  );
}

function Estado({ texto, datos, clase }) {
  return (
    <div className={`rounded-2xl p-5 ${clase}`}>
      <p className="text-3xl font-black leading-none">{soles(datos.monto)}</p>
      <p className="mt-2 text-base font-semibold">
        {texto} · {datos.comprobantes}{' '}
        {datos.comprobantes === 1 ? 'comprobante' : 'comprobantes'}
      </p>
    </div>
  );
}

function Tabla({ filas, abierta, alAbrir }) {
  if (filas.length === 0) {
    return (
      <Aviso tipo="info" icono={AlertCircle} titulo="Ningún abono con esos filtros">
        Pruebe ampliando el rango de fechas o quitando el método.
      </Aviso>
    );
  }

  return (
    <Tarjeta>
      <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
        <table className="w-full min-w-[62rem] text-left">
          <thead className="bg-slate-50">
            <tr className="text-base text-slate-500">
              <th className="px-4 py-3 font-semibold">N.º</th>
              <th className="px-4 py-3 font-semibold">Delegación</th>
              <th className="px-4 py-3 text-right font-semibold">Yape</th>
              <th className="px-4 py-3 text-right font-semibold">BCP</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-center font-semibold">Comp.</th>
              <th className="px-4 py-3 font-semibold">Último envío</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((fila, i) => (
              <Fila
                key={fila.tutorId}
                numero={i + 1}
                fila={fila}
                abierta={abierta === fila.tutorId}
                alAbrir={() => alAbrir(fila.tutorId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

function Fila({ numero, fila, abierta, alAbrir }) {
  return (
    <>
      <tr className="align-top hover:bg-slate-50">
        <td className="px-4 py-3 text-base text-slate-500">{numero}</td>
        <td className="px-4 py-3">
          <span className="block text-base font-bold text-slate-900">{fila.institucion}</span>
          <span className="block text-base text-slate-500">
            {fila.tutor} · {fila.modalidadLabel}
          </span>
          {fila.departamento && (
            <span className="block text-base text-slate-400">
              {fila.departamento}
              {fila.provincia ? ` · ${fila.provincia}` : ''}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <Monto datos={fila.yape} />
        </td>
        <td className="px-4 py-3 text-right">
          <Monto datos={fila.bcp} />
        </td>
        <td className="px-4 py-3 text-right text-xl font-black text-granate-700">
          {soles(fila.total)}
        </td>
        <td className="px-4 py-3 text-center text-base font-bold text-slate-700">
          {fila.comprobantes}
        </td>
        <td className="px-4 py-3 text-base text-slate-600">
          <span className="block">{fechaHora(fila.ultimoEnvio)}</span>
          {fila.comprobantes > 1 && (
            <span className="block text-slate-400">
              el primero: {fechaHora(fila.primerEnvio)}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <Boton variante="suave" tamano="chico" onClick={alAbrir}>
            <ChevronDown className={`h-5 w-5 transition ${abierta ? 'rotate-180' : ''}`} />
            {abierta ? 'Cerrar' : 'Ver'}
          </Boton>
        </td>
      </tr>

      {/* El detalle: cada comprobante con su hora, que es lo que se compara
          contra el movimiento del estado de cuenta. */}
      {abierta && (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-4 py-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {fila.pagos.map((pago) => (
                <Comprobante key={pago.id} pago={pago} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Monto({ datos }) {
  if (!datos.comprobantes) return <span className="text-base text-slate-300">—</span>;
  return (
    <>
      <span className="block text-base font-bold text-slate-900">{soles(datos.monto)}</span>
      <span className="block text-base text-slate-500">
        {datos.comprobantes} {datos.comprobantes === 1 ? 'envío' : 'envíos'}
      </span>
    </>
  );
}

function Comprobante({ pago }) {
  const estado = ESTADOS[pago.estado] || ESTADOS.EN_REVISION;

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xl font-black text-slate-900">{soles(pago.monto)}</span>
        <Etiqueta compacto className={estado.clase}>
          {estado.texto}
        </Etiqueta>
      </div>
      <p className="mt-1 text-base text-slate-600">
        {pago.metodoLabel} · {pago.estudiantes}{' '}
        {pago.estudiantes === 1 ? 'estudiante' : 'estudiantes'}
      </p>
      <p className="text-base text-slate-500">{fechaHora(pago.enviadoEn)}</p>
      {pago.observacion && (
        <p className="mt-2 text-base text-rose-700">Motivo: {pago.observacion}</p>
      )}
      <div className="mt-3">
        <VistaComprobante url={pago.archivoUrl} alto="max-h-40" />
      </div>
    </div>
  );
}

function limpiar(filtros) {
  return Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== ''));
}
