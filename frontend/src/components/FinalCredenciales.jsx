import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  IdCard,
} from 'lucide-react';
import { Aviso, Boton, Cargando, Etiqueta, Selector, Tarjeta } from './Ui.jsx';
import { NIVEL } from './FinalSalones.jsx';
import { api, descargar, mensajeError } from '../lib/api';

/**
 * Final · Credenciales de finalistas.
 *
 * La credencial de la final la lleva solo quien clasificó, y sale del reparto
 * de salones: de ahí toma el aula, la hora de su nivel y el número que hace en
 * la lista de su salón, que es por donde el responsable lo busca en la puerta.
 *
 * Mientras no se abra aquí, no la ve nadie: ni el tutor en su cuenta ni la
 * portada muestra el botón.
 */
export default function FinalCredenciales() {
  const [estado, setEstado] = useState(null);
  const [salones, setSalones] = useState([]);
  const [salon, setSalon] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesando, setProcesando] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [cred, reparto] = await Promise.all([
        api.get('/final/credencial'),
        api.get('/final/salones'),
      ]);
      setEstado(cred.data);
      setSalones(reparto.data.salones || []);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar'));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !estado) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!estado) return <Cargando texto="Cargando las credenciales" />;

  const abrir = async (valor) => {
    if (valor && estado.finalistas === 0) {
      setError('Todavía no hay nadie sentado en un salón: la credencial saldría sin aula.');
      return;
    }
    if (
      valor &&
      estado.sinSalon > 0 &&
      !window.confirm(
        `${estado.sinSalon} clasificados todavía no tienen aula y no podrán bajar su credencial.\n\n¿Abrir igual?`,
      )
    ) {
      return;
    }

    setError('');
    setAviso('');
    setProcesando('abrir');
    try {
      const { data } = await api.post('/final/credencial/abrir', { abierta: valor });
      setEstado(data);
      setAviso(
        valor
          ? 'Abiertas: ya aparecen en la portada y en la cuenta de cada tutor.'
          : 'Cerradas: el botón desaparece de la portada y de las cuentas.',
      );
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cambiar'));
    } finally {
      setProcesando('');
    }
  };

  const bajar = async (clave, ruta, nombre) => {
    setError('');
    setProcesando(clave);
    try {
      await descargar(ruta, nombre);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <IdCard className="h-9 w-9 text-granate-600" />
          Credenciales de finalistas
        </h3>
        <p className="mt-2 text-xl text-slate-600">
          Solo para los clasificados a la final. Cada una lleva su aula, el número que hace en la
          lista de ese salón, su nivel y la hora a la que entra. Tarjeta de 9 × 6 cm, sin foto,
          ocho por hoja.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Dato numero={estado.finalistas} texto="finalistas con aula" />
          <Dato numero={estado.salones} texto="salones" />
          <Dato
            numero={estado.sinSalon}
            texto="clasificados sin aula"
            alerta={estado.sinSalon > 0}
          />
        </div>

        {estado.sinSalon > 0 && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto>
              {estado.sinSalon}{' '}
              {estado.sinSalon === 1 ? 'clasificado no tiene aula' : 'clasificados no tienen aula'}
              . Sin aula no hay credencial: siéntelos en Examen final · Reparto de alumnos.
            </Aviso>
          </div>
        )}

        {!estado.sede && (
          <div className="mt-4">
            <Aviso tipo="info" icono={AlertCircle} compacto>
              La sede está vacía y la credencial la imprime. Complétela en Salones y horarios.
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-xl font-black text-slate-900">Entrega</h4>
            <p className="mt-2 text-base text-slate-600">
              Abre el botón «Credencial finalista» en la portada y la sección en la cuenta de cada
              tutor, donde baja las de su delegación de una vez.
            </p>
          </div>
          <Etiqueta
            compacto
            className={
              estado.abierta ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }
          >
            {estado.abierta ? 'Abiertas' : 'Cerradas'}
          </Etiqueta>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Boton
            variante={estado.abierta ? 'peligro' : 'exito'}
            cargando={procesando === 'abrir'}
            onClick={() => abrir(!estado.abierta)}
          >
            {estado.abierta ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
            {estado.abierta ? 'Cerrar las credenciales' : 'Abrir las credenciales'}
          </Boton>
          <Boton
            variante="contorno"
            cargando={procesando === 'muestra'}
            onClick={() =>
              bajar('muestra', '/final/credencial/muestra', 'muestra-credencial-final.pdf')
            }
          >
            <FileText className="h-6 w-6" />
            Ver una de muestra
          </Boton>
        </div>
      </Tarjeta>

      {aviso && (
        <Aviso tipo="info" icono={CheckCircle2}>
          {aviso}
        </Aviso>
      )}
      {error && (
        <Aviso tipo="error" icono={AlertCircle} compacto>
          {error}
        </Aviso>
      )}

      <Tarjeta>
        <h4 className="text-xl font-black text-slate-900">Imprimir</h4>
        <p className="mt-2 text-base text-slate-600">
          Para repartirlas en la mesa de recepción. El PDF de un salón sale en el mismo orden de
          su lista, así se entregan de corrido.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[20rem] flex-1">
            <Selector
              etiqueta="Salón"
              value={salon}
              onChange={(e) => setSalon(e.target.value)}
            >
              <option value="">Todos los salones</option>
              {salones.map((s) => (
                <option key={s.numero} value={s.numero}>
                  SALÓN {s.numero} · {NIVEL[s.nivel]} · CAT. {s.categoria} · {s.total} alumnos
                </option>
              ))}
            </Selector>
          </div>
          <Boton
            variante="primario"
            cargando={procesando === 'pdf'}
            onClick={() =>
              bajar(
                'pdf',
                `/final/credencial/pdf${salon ? `?salon=${salon}` : ''}`,
                salon ? `credenciales-salon-${salon}.pdf` : 'credenciales-finalistas.pdf',
              )
            }
          >
            <Download className="h-6 w-6" />
            Descargar
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

function Dato({ numero, texto, alerta = false }) {
  return (
    <div
      className={`rounded-2xl border-2 p-5 ${
        alerta ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200'
      }`}
    >
      <p className="text-3xl font-black text-slate-900">{numero}</p>
      <p className="text-base text-slate-600">{texto}</p>
    </div>
  );
}
