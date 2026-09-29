import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { VistaComprobante } from './PasoPago.jsx';
import { api, mensajeError } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { DEPARTAMENTOS, ESTADOS, ETIQUETA_MODALIDAD } from '../lib/datos';

/** Tarjeta de cifra, reutilizada por los paneles de la comisión. */
export function Metrica({ valor, texto, icono: Icono, destacado = false }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-suave ${
        destacado ? 'border-granate-200 bg-granate-600 text-white' : 'border-slate-200 bg-white'
      }`}
    >
      <Icono className={`h-7 w-7 ${destacado ? 'text-granate-100' : 'text-granate-600'}`} />
      <p className={`mt-3 text-3xl font-black ${destacado ? 'text-white' : 'text-slate-900'}`}>
        {valor}
      </p>
      <p className={`mt-1 text-base ${destacado ? 'text-granate-100' : 'text-slate-600'}`}>{texto}</p>
    </div>
  );
}

/** Listado filtrable de delegaciones. */
export function ListaInscripciones({ alAbrir, estadoInicial = '' }) {
  const [lista, setLista] = useState(null);
  const [filtros, setFiltros] = useState({ estado: estadoInicial, region: '', buscar: '' });

  const cargar = useCallback(async () => {
    const { data } = await api.get('/admin/inscripciones', { params: filtros });
    setLista(data);
  }, [filtros]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  return (
    <div className="space-y-6">
      <Tarjeta className="p-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={filtros.buscar}
              onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })}
              placeholder="Institución, tutor o correo"
              className="w-full rounded-2xl border-2 border-slate-200 py-2.5 pl-11 pr-4 text-base outline-none focus:border-granate-600"
            />
          </div>
          <Selector
            etiqueta=""
            compacto
            value={filtros.estado}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          >
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([clave, valor]) => (
              <option key={clave} value={clave}>
                {valor.texto}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta=""
            compacto
            value={filtros.region}
            onChange={(e) => setFiltros({ ...filtros, region: e.target.value })}
          >
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map((departamento) => (
              <option key={departamento} value={departamento}>
                {departamento}
              </option>
            ))}
          </Selector>
        </div>
      </Tarjeta>

      {!lista ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Tarjeta className="p-6">
          <p className="py-10 text-center text-base text-slate-500">
            No hay inscripciones con esos filtros.
          </p>
        </Tarjeta>
      ) : (
        <div className="grid gap-4">
          {lista.map((fila) => {
            const estado = ESTADOS[fila.estado] || ESTADOS.BORRADOR;
            return (
              <button
                key={fila.id}
                onClick={() => alAbrir(fila.id)}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:-translate-y-1 hover:border-granate-400 hover:shadow-suave"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-xl font-black text-slate-900">
                      {fila.institucion || 'Sin institución'}
                    </p>
                    <p className="mt-1.5 text-base text-slate-600">
                      {fila.nombres} {fila.apellidos} · {fila.celular}
                    </p>
                    <p className="mt-1 text-base text-slate-500">
                      {fila.region} · {fila.provincia} · {fila.distrito}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <Etiqueta compacto className={estado.clase}>{estado.texto}</Etiqueta>
                    <p className="text-base font-bold text-granate-700">
                      {fila.totalAlumnos} estudiantes
                    </p>
                    <p className="text-base text-slate-500">
                      {ETIQUETA_MODALIDAD[fila.modalidad] || fila.modalidad}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Detalle de una delegación con aprobación u observación. */
export function RevisarInscripcion({ id, alVolver, alRevisar }) {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState(null);
  const [observacion, setObservacion] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState('');

  const cargar = useCallback(async () => {
    const { data } = await api.get(`/admin/inscripciones/${id}`);
    setDatos(data);
    setObservacion(data.observacion || '');
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!datos) return <Cargando />;

  const revisar = async (estado) => {
    setError('');
    setMensaje('');
    if (estado === 'OBSERVADA' && !observacion.trim()) {
      return setError('Escriba el motivo de la observación');
    }
    setProcesando(estado);
    try {
      await api.patch(`/admin/inscripciones/${id}/revisar`, { estado, observacion });
      await cargar();
      await alRevisar?.();
      setMensaje(estado === 'APROBADA' ? 'Inscripción aprobada' : 'Inscripción observada');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo actualizar'));
    } finally {
      setProcesando('');
    }
  };

  const revisarComprobante = async (pagoId, nuevoEstado, motivo) => {
    setError('');
    setMensaje('');
    try {
      await api.patch(`/admin/pagos/${pagoId}/revisar`, {
        estado: nuevoEstado,
        observacion: motivo,
      });
      await cargar();
      await alRevisar?.();
      setMensaje(
        nuevoEstado === 'APROBADO' ? 'Comprobante aprobado' : 'Comprobante rechazado',
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo revisar el comprobante'));
      throw e;
    }
  };

  const estado = ESTADOS[datos.estado] || ESTADOS.BORRADOR;
  const pagos = datos.payments || [];
  const porRevisar = pagos.filter((p) => p.estado === 'EN_REVISION').length;
  const montoAprobado = pagos
    .filter((p) => p.estado === 'APROBADO')
    .reduce((suma, p) => suma + p.monto, 0);

  return (
    <div className="space-y-6">
      <Boton variante="fantasma" tamano="chico" onClick={alVolver}>
        <ArrowLeft className="h-5 w-5" />
        Volver al listado
      </Boton>

      <Tarjeta className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h2 className="text-xl font-black text-slate-900">{datos.institucion}</h2>
            <p className="mt-2 text-base text-slate-600">
              {datos.nombres} {datos.apellidos}
            </p>
            <p className="mt-1 text-base text-slate-500">
              {datos.correo} · {datos.celular}
            </p>
            <p className="mt-1 text-base text-slate-500">
              {datos.region} · {datos.provincia} · {datos.distrito}
            </p>
          </div>
          <Etiqueta compacto className={estado.clase}>{estado.texto}</Etiqueta>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metrica valor={datos.students.length} texto="Estudiantes" icono={Users} />
          <Metrica
            valor={ETIQUETA_MODALIDAD[datos.modalidad] || datos.modalidad}
            texto="Modalidad"
            icono={Building2}
          />
          <Metrica
            valor={datos.validacion.puedeEnviar ? 'Cumple' : 'Incompleta'}
            texto="Mínimos"
            icono={ClipboardCheck}
          />
        </div>

        {datos.validacion.errores.length > 0 && (
          <div className="mt-8">
            <Aviso tipo="alerta" icono={AlertCircle} compacto titulo="Requisitos incompletos">
              <ul className="mt-2 space-y-1">
                {datos.validacion.errores.map((texto) => (
                  <li key={texto}>{texto}</li>
                ))}
              </ul>
            </Aviso>
          </div>
        )}

        {datos.respuesta && (
          <div className="mt-6">
            <Aviso tipo="info" icono={MessageSquare} compacto titulo="El tutor absolvió la observación">
              {datos.respuesta}
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_1fr]">
        <Tarjeta className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-xl font-black text-slate-900">
              Comprobantes ({pagos.length})
            </h3>
            {pagos.length > 0 && (
              <p className="text-base text-slate-500">
                {porRevisar} por revisar · Aprobado S/ {montoAprobado}
              </p>
            )}
          </div>

          {/* Uno por uno: el tutor puede pagar por partes y cada voucher se
              aprueba o se rechaza por separado. Antes solo se veía el último. */}
          {pagos.length === 0 ? (
            <p className="mt-6 text-base text-slate-500">Todavía no adjunta comprobante.</p>
          ) : (
            <div className="mt-6 space-y-5">
              {pagos.map((item) => (
                <ComprobanteRevision key={item.id} pago={item} alRevisar={revisarComprobante} />
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta className="p-6">
          <h3 className="text-xl font-black text-slate-900">Revisión</h3>
          <label className="mt-8 block">
            <span className="mb-1.5 block text-base font-semibold text-slate-800">
              Observación (si corresponde)
            </span>
            <textarea
              rows={5}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Motivo de la observación"
              className="w-full rounded-2xl border-2 border-slate-200 px-4 py-2.5 text-base outline-none focus:border-granate-600"
            />
          </label>

          {error && (
            <div className="mt-6">
              <Aviso tipo="error" icono={AlertCircle} compacto>
                {error}
              </Aviso>
            </div>
          )}
          {mensaje && (
            <div className="mt-6">
              <Aviso tipo="exito" icono={CheckCircle2} compacto>
                {mensaje}
              </Aviso>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-4">
            <Boton
              variante="exito"
              tamano="chico"
              cargando={procesando === 'APROBADA'}
              onClick={() => revisar('APROBADA')}
              className="flex-1"
            >
              <CheckCircle2 className="h-5 w-5" />
              Aprobar inscripción
            </Boton>
            <Boton
              variante="peligro"
              tamano="chico"
              cargando={procesando === 'OBSERVADA'}
              onClick={() => revisar('OBSERVADA')}
              className="flex-1"
            >
              <XCircle className="h-5 w-5" />
              Observar
            </Boton>
          </div>
        </Tarjeta>
      </div>

      {/* Deshacer: solo el administrador, y al final de todo para que no se
          toque por descuido mientras se revisa. */}
      {datos.revisadoPor && (
        <p className="text-base text-slate-500">
          Última decisión: {datos.revisadoPor}
          {datos.revisadoEn && ` · ${new Date(datos.revisadoEn).toLocaleString('es-PE')}`}
        </p>
      )}

      {usuario?.rol === 'ADMIN' && (
        <ZonaAdministrador datos={datos} alCambiar={cargar} alVolver={alVolver} />
      )}

      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">
          Estudiantes ({datos.students.length})
        </h3>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-base text-slate-500">
                <th className="pb-3 pr-4 font-semibold">DNI</th>
                <th className="pb-3 pr-4 font-semibold">Estudiante</th>
                <th className="pb-3 font-semibold">Grado</th>
              </tr>
            </thead>
            <tbody>
              {datos.students.map((alumno) => (
                <tr key={alumno.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-base font-bold text-granate-700">{alumno.dni}</td>
                  <td className="py-3 pr-4 text-base text-slate-900">{alumno.nombres}</td>
                  <td className="py-3 text-base text-slate-700">{alumno.gradoLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}

/** Barra horizontal simple para rankings. */
export function Barra({ texto, valor, maximo }) {
  const porcentaje = maximo ? Math.round((valor / maximo) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-base text-slate-700">{texto}</span>
        <span className="text-base font-bold text-granate-700">{valor}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-granate-600 transition-all duration-700"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

const ESTADOS_COMPROBANTE = {
  EN_REVISION: { texto: 'En revisión', clase: 'bg-sky-100 text-sky-800' },
  APROBADO: { texto: 'Aprobado', clase: 'bg-emerald-100 text-emerald-800' },
  RECHAZADO: { texto: 'Rechazado', clase: 'bg-rose-100 text-rose-800' },
};

/**
 * Un comprobante del historial, con su propia decisión.
 *
 * Ya resuelto no vuelve a mostrar los botones: antes quedaba diciendo
 * "Aprobado" con el botón "Aprobar" al lado, y no se sabía si había surtido
 * efecto.
 */
function ComprobanteRevision({ pago, alRevisar }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState('');
  const estado = ESTADOS_COMPROBANTE[pago.estado] || ESTADOS_COMPROBANTE.EN_REVISION;
  const pendiente = pago.estado === 'EN_REVISION';

  const decidir = async (nuevo, texto) => {
    setProcesando(nuevo);
    try {
      await alRevisar(pago.id, nuevo, texto);
      setRechazando(false);
      setMotivo('');
    } catch {
      // El aviso lo muestra la pantalla de revisión.
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="rounded-2xl border-2 border-slate-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xl font-black text-slate-900">S/ {pago.monto}</p>
          <p className="mt-1 text-base text-slate-600">
            {pago.metodo === 'BCP' ? 'BCP' : 'Yape'} · {pago.totalAlumnos}{' '}
            {pago.totalAlumnos === 1 ? 'estudiante' : 'estudiantes'} ·{' '}
            {new Date(pago.createdAt).toLocaleDateString('es-PE')}
          </p>
        </div>
        <Etiqueta className={estado.clase}>{estado.texto}</Etiqueta>
      </div>

      {pago.observacion && (
        <p className="mt-3 text-base text-rose-700">Motivo: {pago.observacion}</p>
      )}

      <div className="mt-4">
        <VistaComprobante url={pago.archivoUrl} alto="max-h-72" />
      </div>

      {pendiente && !rechazando && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Boton
            variante="exito"
            tamano="chico"
            cargando={procesando === 'APROBADO'}
            onClick={() => decidir('APROBADO')}
            className="flex-1"
          >
            <CheckCircle2 className="h-5 w-5" />
            Aprobar
          </Boton>
          <Boton
            variante="peligro"
            tamano="chico"
            onClick={() => setRechazando(true)}
            className="flex-1"
          >
            <XCircle className="h-5 w-5" />
            Rechazar
          </Boton>
        </div>
      )}

      {pendiente && rechazando && (
        <div className="mt-4 space-y-3">
          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo del rechazo (lo verá el tutor)"
            className="w-full rounded-2xl border-2 border-slate-200 px-4 py-2.5 text-base outline-none focus:border-granate-600"
          />
          {!motivo.trim() && (
            <p className="text-base text-slate-500">
              Escriba el motivo: es lo único que el tutor verá para corregir su comprobante.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Boton
              variante="peligro"
              tamano="chico"
              cargando={procesando === 'RECHAZADO'}
              disabled={!motivo.trim()}
              onClick={() => decidir('RECHAZADO', motivo.trim())}
              className="flex-1"
            >
              Confirmar rechazo
            </Boton>
            <Boton
              variante="fantasma"
              tamano="chico"
              onClick={() => {
                setRechazando(false);
                setMotivo('');
              }}
            >
              Cancelar
            </Boton>
          </div>
          <p className="text-base text-slate-500">
            Al rechazarlo, sus estudiantes vuelven a quedar pendientes de pago.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Lo que solo puede el administrador: volver a abrir una decisión ya tomada y,
 * como último recurso, borrar la delegación entera.
 *
 * El borrado pide escribir el nombre de la institución. No es un trámite: al
 * confirmarlo desaparecen los estudiantes, los comprobantes y sus archivos, y
 * no hay forma de recuperarlos.
 */
function ZonaAdministrador({ datos, alCambiar, alVolver }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState('');

  const esperado = (datos.institucion || datos.correo || '').trim().toUpperCase();
  const resuelta = datos.estado === 'APROBADA' || datos.estado === 'OBSERVADA';

  const reabrir = async () => {
    setError('');
    setMensaje('');
    setProcesando('reabrir');
    try {
      await api.patch(`/admin/inscripciones/${datos.id}/reabrir`);
      await alCambiar();
      setMensaje('La inscripción volvió a revisión');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo reabrir'));
    } finally {
      setProcesando('');
    }
  };

  const eliminar = async () => {
    setError('');
    setProcesando('eliminar');
    try {
      await api.delete(`/admin/inscripciones/${datos.id}`, { data: { confirmacion } });
      alVolver();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo eliminar'));
      setProcesando('');
    }
  };

  return (
    <Tarjeta className="border-2 border-rose-200 p-6">
      <h3 className="text-xl font-black text-rose-900">Acciones del administrador</h3>

      {mensaje && (
        <div className="mt-5">
          <Aviso tipo="exito" icono={CheckCircle2} compacto>
            {mensaje}
          </Aviso>
        </div>
      )}
      {error && (
        <div className="mt-5">
          <Aviso tipo="error" icono={AlertCircle} compacto>
            {error}
          </Aviso>
        </div>
      )}

      <div className="mt-6">
        <CorregirDatos datos={datos} alCambiar={alCambiar} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Boton
          variante="contorno"
          tamano="chico"
          disabled={!resuelta}
          cargando={procesando === 'reabrir'}
          onClick={reabrir}
        >
          <RotateCcw className="h-5 w-5" />
          Volver a revisión
        </Boton>
        <p className="text-base text-slate-600">
          {resuelta
            ? 'Deja la decisión sin efecto para volver a evaluarla.'
            : 'Disponible cuando la inscripción ya fue aprobada u observada.'}
        </p>
      </div>

      <div className="mt-8 rounded-2xl bg-rose-50 p-5">
        {!abierto ? (
          <div className="flex flex-wrap items-center gap-4">
            <Boton variante="peligro" tamano="chico" onClick={() => setAbierto(true)}>
              <Trash2 className="h-5 w-5" />
              Eliminar delegación
            </Boton>
            <p className="text-base text-rose-900">
              Borra al tutor, sus {datos.students.length} estudiantes y sus comprobantes.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base text-rose-900">
              Esto no se puede deshacer. Se borran <strong>{datos.students.length} estudiantes</strong>,{' '}
              <strong>{(datos.payments || []).length} comprobantes</strong> y sus archivos. Para
              confirmar, escriba <strong>{esperado}</strong>:
            </p>
            <input
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder={esperado}
              className="w-full rounded-2xl border-2 border-rose-300 px-4 py-2.5 text-base outline-none focus:border-rose-600"
            />
            <div className="flex flex-wrap gap-3">
              <Boton
                variante="peligro"
                tamano="chico"
                disabled={confirmacion.trim().toUpperCase() !== esperado}
                cargando={procesando === 'eliminar'}
                onClick={eliminar}
              >
                <Trash2 className="h-5 w-5" />
                Eliminar definitivamente
              </Boton>
              <Boton
                variante="fantasma"
                tamano="chico"
                onClick={() => {
                  setAbierto(false);
                  setConfirmacion('');
                }}
              >
                Cancelar
              </Boton>
            </div>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

/**
 * Corregir los datos del tutor. Pasa seguido: el colegio mal escrito, un
 * correo con una letra de más. Sin esto había que entrar a la base a mano.
 */
function CorregirDatos({ datos, alCambiar }) {
  const [abierto, setAbierto] = useState(false);
  const [campos, setCampos] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const abrir = () => {
    setCampos({
      institucion: datos.institucion || '',
      nombres: datos.nombres || '',
      apellidos: datos.apellidos || '',
      correo: datos.correo || '',
      celular: datos.celular || '',
      dni: datos.dni || '',
    });
    setError('');
    setMensaje('');
    setAbierto(true);
  };

  const cambiar = (campo) => (evento) => setCampos({ ...campos, [campo]: evento.target.value });

  const guardar = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      await api.patch(`/admin/inscripciones/${datos.id}/datos`, campos);
      await alCambiar();
      setMensaje('Datos corregidos');
      setAbierto(false);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo corregir'));
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Boton variante="contorno" tamano="chico" onClick={abrir}>
          <Pencil className="h-5 w-5" />
          Corregir datos
        </Boton>
        <p className="text-base text-slate-600">
          Institución, nombres, correo, celular o DNI del tutor.
        </p>
        {mensaje && <span className="text-base font-semibold text-emerald-700">{mensaje}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="rounded-2xl bg-slate-50 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Institución"
          compacto
          value={campos.institucion}
          onChange={cambiar('institucion')}
          className="sm:col-span-2"
        />
        <Campo etiqueta="Nombres" compacto value={campos.nombres} onChange={cambiar('nombres')} />
        <Campo
          etiqueta="Apellidos"
          compacto
          value={campos.apellidos}
          onChange={cambiar('apellidos')}
        />
        <Campo etiqueta="Correo" compacto value={campos.correo} onChange={cambiar('correo')} />
        <Campo etiqueta="Celular" compacto value={campos.celular} onChange={cambiar('celular')} />
        <Campo
          etiqueta="DNI"
          compacto
          value={campos.dni}
          onChange={cambiar('dni')}
          ayuda="Con este DNI ingresa el tutor."
        />
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tipo="error" icono={AlertCircle} compacto>
            {error}
          </Aviso>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Boton type="submit" tamano="chico" cargando={guardando}>
          Guardar cambios
        </Boton>
        <Boton variante="fantasma" tamano="chico" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
