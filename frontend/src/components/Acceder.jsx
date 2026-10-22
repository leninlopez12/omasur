import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, LogIn, Search, ShieldAlert } from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Tarjeta } from './Ui.jsx';
import { api, mensajeError } from '../lib/api';
import { entrarComoTutor } from '../lib/suplantar';
import { ESTADOS, ETIQUETA_MODALIDAD } from '../lib/datos';

/**
 * Entrar a la cuenta de un tutor.
 *
 * Varios tutores no se manejan con el sistema y piden que les carguen la
 * delegación o les suban el comprobante. Desde aquí el administrador abre su
 * cuenta y hace el trámite por ellos, con los mismos permisos que tendrían.
 *
 * Mientras dure, el panel del tutor muestra una franja con el aviso y el
 * botón para volver; la sesión caduca sola a las cuatro horas y cada entrada
 * queda escrita en el registro del servidor.
 */
export default function Acceder() {
  const [filas, setFilas] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [entrando, setEntrando] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/acceder');
      setFilas(data);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar la lista de tutores'));
      setFilas([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !filas) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!filas) return <Cargando texto="Cargando los tutores" />;

  const entrar = async (fila) => {
    const seguro = window.confirm(
      `Va a entrar a la cuenta de ${fila.tutor} (${fila.institucion}).\n\n` +
        'Todo lo que haga quedará registrado a nombre de ese tutor. ¿Continuar?',
    );
    if (!seguro) return;

    setError('');
    setEntrando(fila.id);
    try {
      await entrarComoTutor(fila.id);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo entrar a esa cuenta'));
      setEntrando('');
    }
  };

  const texto = buscar.trim().toLowerCase();
  const visibles = filas.filter(
    (f) =>
      !texto ||
      f.institucion.toLowerCase().includes(texto) ||
      f.tutor.toLowerCase().includes(texto) ||
      f.correo.toLowerCase().includes(texto) ||
      (f.dni || '').includes(texto),
  );

  return (
    <div className="space-y-8">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <LogIn className="h-9 w-9 text-granate-600" />
          Entrar como tutor
        </h3>
        <p className="mt-3 text-xl text-slate-600">
          Abre la cuenta del tutor con sus mismos permisos, para cargarle estudiantes o adjuntar
          su comprobante cuando no puede hacerlo solo.
        </p>

        <div className="mt-6">
          <Aviso tipo="alerta" icono={ShieldAlert} titulo="Quede claro antes de entrar">
            Todo lo que haga ahí queda registrado como si lo hubiera hecho el tutor. La sesión
            dura cuatro horas y cada entrada se anota en el registro del servidor con su nombre.
          </Aviso>
        </div>

        <label className="mt-8 block max-w-xl">
          <span className="mb-2 block text-xl font-semibold text-slate-800">Buscar</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Institución, tutor, correo o DNI"
              className="w-full rounded-2xl border-2 border-slate-200 py-3 pl-14 pr-5 text-xl outline-none focus:border-granate-600"
            />
          </div>
        </label>
      </Tarjeta>

      {error && (
        <Aviso tipo="error" icono={AlertCircle}>
          {error}
        </Aviso>
      )}

      <Tarjeta className="p-6">
        <p className="mb-5 text-base text-slate-600">
          {visibles.length} de {filas.length} {filas.length === 1 ? 'tutor' : 'tutores'}
        </p>

        <div className="overflow-x-auto rounded-2xl border-2 border-slate-200">
          <table className="w-full min-w-[56rem] text-left">
            <thead className="bg-slate-50">
              <tr className="text-base text-slate-500">
                <th className="px-4 py-3 font-semibold">N.º</th>
                <th className="px-4 py-3 font-semibold">Institución</th>
                <th className="px-4 py-3 font-semibold">Tutor</th>
                <th className="px-4 py-3 font-semibold">Correo</th>
                <th className="px-4 py-3 text-center font-semibold">Alumnos</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((fila, i) => {
                const estado = ESTADOS[fila.estado] || ESTADOS.BORRADOR;

                return (
                  <tr key={fila.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3 text-base text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="block text-base font-bold text-slate-900">
                        {fila.institucion}
                      </span>
                      <span className="block text-base text-slate-500">
                        {ETIQUETA_MODALIDAD[fila.modalidad] || fila.modalidad}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-base text-slate-900">{fila.tutor}</span>
                      <span className="block text-base text-slate-500">
                        {fila.dni ? `DNI ${fila.dni}` : 'Sin DNI'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-base text-slate-600">
                      <span className="block">{fila.correo}</span>
                      <span className="block text-slate-400">{fila.celular}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-xl font-black text-granate-700">
                      {fila.alumnos}
                    </td>
                    <td className="px-4 py-3">
                      <Etiqueta compacto className={estado.clase}>
                        {estado.texto}
                      </Etiqueta>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Boton
                        variante="suave"
                        tamano="chico"
                        cargando={entrando === fila.id}
                        onClick={() => entrar(fila)}
                      >
                        <LogIn className="h-5 w-5" />
                        Entrar a su cuenta
                      </Boton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}
