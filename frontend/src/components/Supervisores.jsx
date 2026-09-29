import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Mail,
  MailX,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';

const VACIO = { nombre: '', correo: '', dni: '' };

/**
 * Ajustes > Supervisores. Solo lo ve el administrador.
 *
 * El administrador no inventa la contraseña: el sistema genera una temporal,
 * se la muestra una sola vez para que la entregue, y además le llega por
 * correo al supervisor con el pedido de cambiarla.
 */
export default function Supervisores() {
  const [cuentas, setCuentas] = useState(null);
  const [datos, setDatos] = useState(VACIO);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');
  const [recien, setRecien] = useState(null);

  const cargar = useCallback(async () => {
    const { data } = await api.get('/admin/supervisores');
    setCuentas(data);
  }, []);

  useEffect(() => {
    cargar().catch(() => setCuentas([]));
  }, [cargar]);

  const cambiar = (campo) => (evento) => setDatos({ ...datos, [campo]: evento.target.value });

  const crear = async (evento) => {
    evento.preventDefault();
    setError('');
    setRecien(null);
    setProcesando('crear');
    try {
      const { data } = await api.post('/admin/supervisores', datos);
      setRecien({ ...data, nombre: data.supervisor.nombre });
      setDatos(VACIO);
      await cargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo crear la cuenta'));
    } finally {
      setProcesando('');
    }
  };

  const regenerar = async (cuenta) => {
    if (!window.confirm(`¿Generar una contraseña nueva para ${cuenta.nombre}? La anterior deja de servir.`))
      return;
    setError('');
    setRecien(null);
    setProcesando(cuenta.id);
    try {
      const { data } = await api.post(`/admin/supervisores/${cuenta.id}/clave`);
      setRecien({ ...data, supervisor: cuenta, nombre: cuenta.nombre });
    } catch (e) {
      setError(mensajeError(e, 'No se pudo generar la contraseña'));
    } finally {
      setProcesando('');
    }
  };

  const eliminar = async (cuenta) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${cuenta.nombre}? No podrá volver a ingresar.`))
      return;
    setError('');
    setRecien(null);
    setProcesando(cuenta.id);
    try {
      await api.delete(`/admin/supervisores/${cuenta.id}`);
      await cargar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo eliminar la cuenta'));
    } finally {
      setProcesando('');
    }
  };

  if (!cuentas) return <Cargando texto="Cargando las cuentas" />;

  const supervisores = cuentas.filter((c) => c.rol === 'SUPERVISOR');
  const administradores = cuentas.filter((c) => c.rol === 'ADMIN');

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Nuevo supervisor</h3>
        <p className="mt-3 text-xl text-slate-600">
          Podrá revisar inscripciones y comprobantes, pero no crear otras cuentas.
        </p>

        <form onSubmit={crear} className="mt-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Campo
              etiqueta="Nombre completo"
              required
              value={datos.nombre}
              onChange={cambiar('nombre')}
              className="md:col-span-2"
            />
            <Campo
              etiqueta="Correo electrónico"
              type="email"
              required
              placeholder="supervisor@ejemplo.com"
              value={datos.correo}
              onChange={cambiar('correo')}
            />
            <Campo
              etiqueta="DNI"
              required
              placeholder="12345678"
              value={datos.dni}
              onChange={cambiar('dni')}
              ayuda="Con este DNI ingresará al panel."
            />
          </div>

          {error && (
            <Aviso tipo="error" icono={AlertCircle}>
              {error}
            </Aviso>
          )}

          <Boton type="submit" cargando={procesando === 'crear'}>
            <UserPlus className="h-6 w-6" />
            Crear cuenta
          </Boton>
        </form>
      </Tarjeta>

      {recien && <ClaveTemporal datos={recien} alCerrar={() => setRecien(null)} />}

      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">
          Supervisores ({supervisores.length})
        </h3>

        {supervisores.length === 0 ? (
          <p className="mt-6 text-xl text-slate-500">Todavía no hay supervisores.</p>
        ) : (
          <div className="mt-8 space-y-4">
            {supervisores.map((cuenta) => (
              <div
                key={cuenta.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 p-5"
              >
                <div className="min-w-0">
                  <p className="text-xl font-bold text-slate-900">{cuenta.nombre}</p>
                  <p className="mt-1 text-base text-slate-600">
                    {cuenta.correo} · DNI {cuenta.dni}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Boton
                    variante="contorno"
                    tamano="chico"
                    cargando={procesando === cuenta.id}
                    onClick={() => regenerar(cuenta)}
                  >
                    <KeyRound className="h-5 w-5" />
                    Nueva contraseña
                  </Boton>
                  <Boton
                    variante="peligro"
                    tamano="chico"
                    cargando={procesando === cuenta.id}
                    onClick={() => eliminar(cuenta)}
                  >
                    <Trash2 className="h-5 w-5" />
                    Eliminar
                  </Boton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      {/* Las cuentas de administrador se listan pero no se tocan desde aquí:
          si una pudiera borrar a otra, bastaría entrar con una para quedarse
          con el sistema. */}
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">
          Administradores ({administradores.length})
        </h3>
        <p className="mt-3 text-xl text-slate-600">
          No se administran desde aquí. Para cambiar su contraseña, use «¿Olvidó su contraseña?».
        </p>
        <div className="mt-8 space-y-3">
          {administradores.map((cuenta) => (
            <div key={cuenta.id} className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xl text-slate-800">
                {cuenta.nombre} <span className="text-slate-500">· {cuenta.correo}</span>
              </p>
              <Etiqueta className="bg-granate-100 text-granate-800">Administrador</Etiqueta>
            </div>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

/** La contraseña temporal: se ve una sola vez, después ya no se puede recuperar. */
function ClaveTemporal({ datos, alCerrar }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(datos.claveTemporal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <Tarjeta className="border-2 border-emerald-300 bg-emerald-50">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-3 text-3xl font-black text-emerald-900">
            <CheckCircle2 className="h-8 w-8" />
            Cuenta lista
          </h3>
          <p className="mt-3 text-xl text-emerald-900">
            Contraseña temporal de {datos.nombre}. Anótela ahora: no se vuelve a mostrar.
          </p>
        </div>
        <Boton variante="fantasma" tamano="chico" onClick={alCerrar}>
          Cerrar
        </Boton>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <code className="rounded-2xl bg-white px-6 py-4 font-mono text-3xl font-black tracking-widest text-slate-900">
          {datos.claveTemporal}
        </code>
        <Boton variante="contorno" tamano="chico" onClick={copiar}>
          <Copy className="h-5 w-5" />
          {copiado ? 'Copiada' : 'Copiar'}
        </Boton>
      </div>

      <p className="mt-6 flex items-center gap-3 text-xl text-emerald-900">
        {datos.correoEnviado ? (
          <>
            <Mail className="h-6 w-6 shrink-0" />
            También se la enviamos por correo.
          </>
        ) : (
          <>
            <MailX className="h-6 w-6 shrink-0 text-amber-700" />
            <span className="text-amber-900">
              El correo no está configurado: entréguesela usted mismo.
            </span>
          </>
        )}
      </p>
    </Tarjeta>
  );
}
