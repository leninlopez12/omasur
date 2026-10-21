import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  ImageUp,
  Link2,
  Lock,
  Plus,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { Aviso, Boton, Campo, Etiqueta, Tarjeta } from './Ui.jsx';
import QrYape from './QrYape.jsx';
import IconoWhatsApp from './IconoWhatsApp.jsx';
import { api, mensajeError } from '../lib/api';
import { QR_YAPE_POR_DEFECTO } from '../lib/ajustes';

/** Ajustes > Imágenes: fondos del hero y del ingreso. Solo administrador. */
export function ImagenesFondo({ imagenHero, imagenLogin, alCambiar }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SubirFondo
        tipo="hero"
        titulo="Fondo de la portada"
        detalle="Recomendado 1920 × 1080 px. Va detrás del granate."
        url={imagenHero}
        proporcion="aspect-video"
        alCambiar={alCambiar}
      />
      <SubirFondo
        tipo="login"
        titulo="Fondo del ingreso"
        detalle="Mitad izquierda de la pantalla de ingreso."
        url={imagenLogin}
        proporcion="aspect-[4/3]"
        alCambiar={alCambiar}
      />
    </div>
  );
}

function SubirFondo({ tipo, titulo, detalle, url, proporcion, alCambiar }) {
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState('');
  const archivoRef = useRef(null);

  const elegir = (evento) => {
    const seleccionado = evento.target.files?.[0];
    if (!seleccionado) return;
    setArchivo(seleccionado);
    setVista(URL.createObjectURL(seleccionado));
  };

  const subir = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    if (!archivo) return setError('Elija la imagen');

    setProcesando('subir');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      await api.post(`/ajustes/imagenes/${tipo}`, formulario);
      setArchivo(null);
      setVista('');
      setMensaje('Imagen publicada');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir la imagen'));
    } finally {
      setProcesando('');
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  const quitar = async () => {
    if (!window.confirm('¿Borrar la imagen de Cloudflare y dejar solo el fondo granate?')) return;
    setError('');
    setMensaje('');
    setProcesando('quitar');
    try {
      await api.delete(`/ajustes/imagenes/${tipo}`);
      setMensaje('Imagen borrada de Cloudflare');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo quitar la imagen'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <Tarjeta className="p-6">
      <h3 className="text-xl font-black text-slate-900">{titulo}</h3>
      <p className="mt-2 text-base text-slate-600">{detalle}</p>

      <div className={`mt-5 overflow-hidden rounded-2xl bg-granate-800 ${proporcion}`}>
        {vista || url ? (
          <img src={vista || url} alt="" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-base font-semibold text-granate-100">Solo fondo granate</p>
          </div>
        )}
      </div>

      <form onSubmit={subir} className="mt-5 space-y-4">
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-granate-300 bg-granate-50 px-5 py-5 transition hover:border-granate-500 hover:bg-granate-100"
        >
          <ImageUp className="h-7 w-7 text-granate-600" />
          <span className="text-base font-semibold text-granate-700">
            {archivo ? archivo.name : 'Toque para elegir la imagen'}
          </span>
        </button>
        <input ref={archivoRef} type="file" accept="image/*" className="hidden" onChange={elegir} />

        {error && (
          <Aviso tipo="error" icono={AlertCircle} compacto>
            {error}
          </Aviso>
        )}
        {mensaje && (
          <Aviso tipo="exito" icono={CheckCircle2} compacto>
            {mensaje}
          </Aviso>
        )}

        <div className="flex flex-wrap gap-3">
          <Boton type="submit" tamano="chico" cargando={procesando === 'subir'}>
            <Upload className="h-5 w-5" />
            Publicar imagen
          </Boton>
          {url && (
            <Boton
              type="button"
              variante="peligro"
              tamano="chico"
              cargando={procesando === 'quitar'}
              onClick={quitar}
            >
              <Trash2 className="h-5 w-5" />
              Quitar
            </Boton>
          )}
        </div>
      </form>
    </Tarjeta>
  );
}

/** Ajustes > Inscripciones: culminar o reabrir el periodo. */
export function CierreInscripciones({ cerradas, cerradasEn, alCambiar }) {
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);

  const cambiar = async (nuevoEstado) => {
    const aviso = nuevoEstado
      ? '¿Culminar las inscripciones? Ningún tutor podrá registrarse ni modificar su delegación.'
      : '¿Reabrir las inscripciones?';
    if (!window.confirm(aviso)) return;

    setError('');
    setMensaje('');
    setProcesando(true);
    try {
      await api.post('/ajustes/inscripciones', { cerradas: nuevoEstado });
      setMensaje(nuevoEstado ? 'Inscripciones culminadas' : 'Inscripciones reabiertas');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cambiar el estado'));
    } finally {
      setProcesando(false);
    }
  };

  const fecha = cerradasEn ? new Date(cerradasEn).toLocaleString('es-PE') : null;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">Estado actual</h3>

        <div className="mt-5 flex items-center gap-4">
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
              cerradas ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {cerradas ? <Lock className="h-7 w-7" /> : <Unlock className="h-7 w-7" />}
          </span>
          <div>
            <p className="text-xl font-black text-slate-900">
              {cerradas ? 'Inscripciones culminadas' : 'Inscripciones abiertas'}
            </p>
            <p className="mt-1 text-base text-slate-600">
              {cerradas
                ? fecha
                  ? `Cerradas el ${fecha}`
                  : 'Los tutores ya no pueden inscribir.'
                : 'Los tutores pueden registrarse e inscribir.'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Aviso tipo={cerradas ? 'alerta' : 'info'} icono={AlertCircle} compacto>
            {cerradas
              ? 'La comisión sigue revisando y aprobando las delegaciones ya enviadas.'
              : 'Al culminar, se bloquea el registro de tutores, la carga de estudiantes, el comprobante y el envío.'}
          </Aviso>
        </div>
      </Tarjeta>

      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">
          {cerradas ? 'Reabrir inscripciones' : 'Culminar inscripciones'}
        </h3>
        <p className="mt-2 text-base text-slate-600">
          {cerradas
            ? 'Los tutores volverán a inscribir con normalidad.'
            : 'Se cierra el periodo para todos los tutores.'}
        </p>

        {error && (
          <div className="mt-5">
            <Aviso tipo="error" icono={AlertCircle} compacto>
              {error}
            </Aviso>
          </div>
        )}
        {mensaje && (
          <div className="mt-5">
            <Aviso tipo="exito" icono={CheckCircle2} compacto>
              {mensaje}
            </Aviso>
          </div>
        )}

        <div className="mt-6">
          <Boton
            variante={cerradas ? 'primario' : 'peligro'}
            tamano="chico"
            cargando={procesando}
            onClick={() => cambiar(!cerradas)}
          >
            {cerradas ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            {cerradas ? 'Reabrir inscripciones' : 'Culminar inscripciones'}
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

/** Ajustes > Grupo WhatsApp */
export function GruposWhatsApp({ grupos, alCambiar }) {
  const [nuevo, setNuevo] = useState({ nombre: '', enlace: '' });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const crear = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      await api.post('/ajustes/grupos', nuevo);
      setNuevo({ nombre: '', enlace: '' });
      setMensaje('Grupo aperturado');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo crear el grupo'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">Aperturar grupo</h3>

        <form onSubmit={crear} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr_auto]">
          <Campo
            etiqueta="Nombre"
            required
            compacto
            placeholder="Primer grupo aperturado"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
          />
          <Campo
            etiqueta="Enlace de invitación"
            compacto
            placeholder="https://chat.whatsapp.com/..."
            value={nuevo.enlace}
            onChange={(e) => setNuevo({ ...nuevo, enlace: e.target.value })}
          />
          <div className="flex items-end">
            <Boton type="submit" cargando={guardando} tamano="chico" className="w-full lg:w-auto">
              <Plus className="h-5 w-5" />
              Aperturar
            </Boton>
          </div>
        </form>

        {error && (
          <div className="mt-5">
            <Aviso tipo="error" icono={AlertCircle} compacto>
              {error}
            </Aviso>
          </div>
        )}
        {mensaje && (
          <div className="mt-5">
            <Aviso tipo="exito" icono={CheckCircle2} compacto>
              {mensaje}
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">Grupos ({grupos.length})</h3>

        {grupos.length === 0 ? (
          <p className="mt-5 text-base text-slate-500">Todavía no hay grupos aperturados.</p>
        ) : (
          <div className="mt-5 space-y-4">
            {grupos.map((grupo) => (
              <FilaGrupo key={grupo.id} grupo={grupo} alCambiar={alCambiar} />
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

function FilaGrupo({ grupo, alCambiar }) {
  const [enlace, setEnlace] = useState(grupo.enlace || '');
  const [procesando, setProcesando] = useState('');

  const actualizar = async (datos, accion) => {
    setProcesando(accion);
    try {
      await api.patch(`/ajustes/grupos/${grupo.id}`, datos);
      await alCambiar();
    } finally {
      setProcesando('');
    }
  };

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar el grupo "${grupo.nombre}"?`)) return;
    setProcesando('borrar');
    try {
      await api.delete(`/ajustes/grupos/${grupo.id}`);
      await alCambiar();
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-bold text-slate-900">{grupo.nombre}</p>
        <Etiqueta
          compacto
          className={grupo.lleno ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}
        >
          {grupo.lleno ? 'Lleno' : grupo.enlace ? 'Abierto' : 'Sin enlace'}
        </Etiqueta>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <Campo
          etiqueta="Enlace de invitación"
          compacto
          placeholder="https://chat.whatsapp.com/..."
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          className="flex-1"
        />
        <Boton
          variante="suave"
          tamano="chico"
          cargando={procesando === 'enlace'}
          onClick={() => actualizar({ enlace }, 'enlace')}
        >
          <Link2 className="h-5 w-5" />
          Guardar enlace
        </Boton>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Boton
          variante={grupo.lleno ? 'contorno' : 'suave'}
          tamano="chico"
          cargando={procesando === 'lleno'}
          onClick={() => actualizar({ lleno: !grupo.lleno }, 'lleno')}
        >
          {grupo.lleno ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          {grupo.lleno ? 'Reabrir grupo' : 'Marcar como lleno'}
        </Boton>
        <Boton
          variante="peligro"
          tamano="chico"
          cargando={procesando === 'borrar'}
          onClick={eliminar}
        >
          <Trash2 className="h-5 w-5" />
          Eliminar
        </Boton>
      </div>
    </div>
  );
}

/** Ajustes > Yape */
export function AjusteYape({ yapeQr, yape, alCambiar }) {
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState('');
  const archivoRef = useRef(null);

  const elegir = (evento) => {
    const seleccionado = evento.target.files?.[0];
    if (!seleccionado) return;
    setArchivo(seleccionado);
    setVista(URL.createObjectURL(seleccionado));
  };

  const subir = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    if (!archivo) return setError('Elija la imagen del QR');

    setProcesando('subir');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      await api.post('/ajustes/yape', formulario);
      setArchivo(null);
      setVista('');
      setMensaje('QR actualizado en toda la web');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir la imagen'));
    } finally {
      setProcesando('');
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  const quitar = async () => {
    if (!window.confirm('¿Borrar el QR? Se elimina de Cloudflare y vuelve el de por defecto.'))
      return;
    setError('');
    setMensaje('');
    setProcesando('quitar');
    try {
      await api.delete('/ajustes/yape');
      setMensaje('QR borrado de Cloudflare');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo borrar el QR'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">QR publicado</h3>
        <p className="mt-2 text-base text-slate-600">
          Se muestra en la portada y en el paso de pago.
        </p>
        <QrYape
          src={yapeQr || QR_YAPE_POR_DEFECTO}
          className="mx-auto mt-6 w-full max-w-[15rem] border border-slate-200"
          etiqueta={yapeQr ? 'Subido por la comisión' : 'Imagen por defecto'}
          compacto
        />

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-base text-slate-600">{yape?.titular || '—'}</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{yape?.numero || '—'}</p>
        </div>
      </Tarjeta>

      <Tarjeta className="p-6">
        <h3 className="text-xl font-black text-slate-900">Cambiar QR</h3>
        <p className="mt-2 text-base text-slate-600">Imagen cuadrada en JPG, PNG o WEBP.</p>

        <form onSubmit={subir} className="mt-6 space-y-5">
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-yape-300 bg-yape-100/60 px-5 py-9 transition hover:border-yape-500 hover:bg-yape-100"
          >
            {vista ? (
              <img src={vista} alt="Vista previa" className="max-h-48 rounded-xl object-contain" />
            ) : (
              <ImageUp className="h-11 w-11 text-yape-600" />
            )}
            <span className="text-base font-semibold text-yape-700">
              {archivo ? archivo.name : 'Toque para elegir la imagen'}
            </span>
          </button>
          <input
            ref={archivoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={elegir}
          />

          {error && (
            <Aviso tipo="error" icono={AlertCircle} compacto>
              {error}
            </Aviso>
          )}
          {mensaje && (
            <Aviso tipo="exito" icono={CheckCircle2} compacto>
              {mensaje}
            </Aviso>
          )}

          <div className="flex flex-wrap gap-3">
            <Boton
              type="submit"
              cargando={procesando === 'subir'}
              tamano="chico"
              className="flex-1"
            >
              <Upload className="h-5 w-5" />
              {yapeQr ? 'Reemplazar QR' : 'Publicar QR'}
            </Boton>
            {yapeQr && (
              <Boton
                type="button"
                variante="contorno"
                tamano="chico"
                onClick={quitar}
                cargando={procesando === 'quitar'}
              >
                <Trash2 className="h-5 w-5" />
                Borrar
              </Boton>
            )}
          </div>
        </form>
      </Tarjeta>

      <div className="xl:col-span-2">
        <DatosDeYape yape={yape} alCambiar={alCambiar} />
      </div>
    </div>
  );
}

/**
 * Titular y número de la cuenta Yape.
 *
 * Van aparte del QR porque se cambian por motivos distintos: la foto, cuando
 * Yape la regenera; el nombre y el número, cuando cambia quién recauda.
 */
function DatosDeYape({ yape, alCambiar }) {
  const [datos, setDatos] = useState({
    titular: yape?.titular || '',
    numero: yape?.numero || '',
  });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (evento) => setDatos({ ...datos, [campo]: evento.target.value });

  const guardar = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      await api.post('/ajustes/yape/datos', datos);
      setMensaje('Datos de la cuenta actualizados');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron guardar los datos'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta className="p-6">
      <h3 className="text-xl font-black text-slate-900">Datos de la cuenta</h3>
      <p className="mt-2 text-base text-slate-600">
        Aparecen junto al QR cuando el tutor elige pagar por Yape.
      </p>

      <form onSubmit={guardar} className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            etiqueta="Titular de la cuenta"
            placeholder="Nombre como figura en Yape"
            value={datos.titular}
            onChange={cambiar('titular')}
          />
          <Campo
            etiqueta="Número de Yape"
            placeholder="928 853 577"
            value={datos.numero}
            onChange={cambiar('numero')}
          />
        </div>

        {error && (
          <Aviso tipo="error" icono={AlertCircle} compacto>
            {error}
          </Aviso>
        )}
        {mensaje && (
          <Aviso tipo="exito" icono={CheckCircle2} compacto>
            {mensaje}
          </Aviso>
        )}

        <Boton type="submit" cargando={guardando} tamano="chico">
          Guardar datos
        </Boton>
      </form>
    </Tarjeta>
  );
}

/** Cuenta del BCP que ve el tutor cuando elige pagar por banco. */
export function AjusteBcp({ bcp, alCambiar }) {
  const [datos, setDatos] = useState({
    titular: bcp?.titular || '',
    cuenta: bcp?.cuenta || '',
    cci: bcp?.cci || '',
  });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (evento) => setDatos({ ...datos, [campo]: evento.target.value });

  const guardar = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      await api.post('/ajustes/bcp', datos);
      setMensaje('Cuenta del BCP actualizada');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar la cuenta'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Cuenta del BCP</h3>
      <p className="mt-3 text-xl text-slate-600">
        Mientras esté vacía, el tutor solo podrá pagar por Yape.
      </p>

      <form onSubmit={guardar} className="mt-8 space-y-6">
        <Campo
          etiqueta="Titular de la cuenta"
          placeholder="Nombre como figura en el banco"
          value={datos.titular}
          onChange={cambiar('titular')}
        />
        <Campo
          etiqueta="Número de cuenta"
          placeholder="000-0000000000-0-00"
          value={datos.cuenta}
          onChange={cambiar('cuenta')}
        />
        <Campo
          etiqueta="CCI (para transferencias de otros bancos)"
          placeholder="00200000000000000000"
          value={datos.cci}
          onChange={cambiar('cci')}
        />

        {error && (
          <Aviso tipo="error" icono={AlertCircle}>
            {error}
          </Aviso>
        )}
        {mensaje && (
          <Aviso tipo="exito" icono={CheckCircle2}>
            {mensaje}
          </Aviso>
        )}

        <Boton type="submit" cargando={guardando}>
          Guardar cuenta
        </Boton>
      </form>
    </Tarjeta>
  );
}

/**
 * Ajustes > Botón de WhatsApp: a qué número escribe el botón flotante de la
 * portada y con qué texto abre el chat.
 *
 * El número se guarda con código de país porque así lo exige wa.me; si escriben
 * los nueve dígitos del celular, el servidor le antepone el 51.
 */
export function AjusteWhatsapp({ whatsapp, alCambiar }) {
  const [datos, setDatos] = useState({
    numero: whatsapp?.numero || '',
    mensaje: whatsapp?.mensaje || '',
  });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (evento) => setDatos({ ...datos, [campo]: evento.target.value });

  const guardar = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      await api.post('/ajustes/whatsapp', datos);
      setMensaje('Botón de WhatsApp actualizado');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo guardar el botón'));
    } finally {
      setGuardando(false);
    }
  };

  const digitos = (datos.numero || '').replace(/\D/g, '');
  const prueba = `https://wa.me/${digitos}?text=${encodeURIComponent(datos.mensaje || '')}`;

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Botón de WhatsApp</h3>
      <p className="mt-3 text-xl text-slate-600">
        El botón verde de la esquina de la portada. Abre el chat con el mensaje ya escrito.
      </p>

      <form onSubmit={guardar} className="mt-8 space-y-6">
        <Campo
          etiqueta="Número con código de país"
          placeholder="51928853577"
          value={datos.numero}
          onChange={cambiar('numero')}
        />

        <label className="block">
          <span className="mb-2 block text-xl font-semibold text-slate-800">
            Mensaje con el que abre el chat
          </span>
          <textarea
            rows={3}
            maxLength={300}
            value={datos.mensaje}
            onChange={cambiar('mensaje')}
            placeholder="Hola, quiero información sobre el I OMASUR UNI 2026"
            className="w-full rounded-2xl border-2 border-slate-200 px-5 py-4 text-xl outline-none focus:border-granate-600"
          />
          <span className="mt-2 block text-base text-slate-500">
            Lo escribe el visitante sin teclear nada. {(datos.mensaje || '').length} de 300.
          </span>
        </label>

        {error && (
          <Aviso tipo="error" icono={AlertCircle}>
            {error}
          </Aviso>
        )}
        {mensaje && (
          <Aviso tipo="exito" icono={CheckCircle2}>
            {mensaje}
          </Aviso>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Boton type="submit" cargando={guardando}>
            Guardar botón
          </Boton>
          {digitos.length >= 8 && (
            <a
              href={prueba}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xl font-semibold text-granate-700 hover:underline"
            >
              <IconoWhatsApp className="h-6 w-6" />
              Probar el chat
            </a>
          )}
        </div>
      </form>
    </Tarjeta>
  );
}

/**
 * Ajustes > Bases: el PDF que enlaza el botón del hero de la portada.
 *
 * Mientras no haya un archivo publicado el botón no aparece en la portada, así
 * que nadie se topa con un enlace roto.
 */
export function AjusteBases({ bases, alCambiar }) {
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState('');
  const archivoRef = useRef(null);

  const elegir = (evento) => {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    setError('');
    setMensaje('');
    setArchivo(elegido);
  };

  const limpiar = () => {
    setArchivo(null);
    if (archivoRef.current) archivoRef.current.value = '';
  };

  const subir = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');
    if (!archivo) return setError('Elija el archivo PDF');

    setProcesando('subir');
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      await api.post('/ajustes/bases', formulario);
      limpiar();
      setMensaje(bases ? 'Bases reemplazadas' : 'Bases publicadas');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir el archivo'));
    } finally {
      setProcesando('');
    }
  };

  const quitar = async () => {
    if (!window.confirm('¿Quitar las bases? El botón desaparecerá de la portada.')) return;
    setError('');
    setMensaje('');
    setProcesando('quitar');
    try {
      await api.delete('/ajustes/bases');
      setMensaje('Bases retiradas de la portada');
      await alCambiar();
    } catch (e) {
      setError(mensajeError(e, 'No se pudo quitar el archivo'));
    } finally {
      setProcesando('');
    }
  };

  return (
    <Tarjeta>
      <h3 className="text-3xl font-black text-slate-900">Bases del concurso</h3>
      <p className="mt-3 text-xl text-slate-600">
        Archivo PDF, hasta 20 MB. Es el que abre el botón de la portada.
      </p>

      <div className="mt-8 rounded-2xl border-2 border-slate-200 p-6">
        {bases ? (
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-granate-50">
              <FileText className="h-9 w-9 text-granate-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-black text-slate-900">{bases.nombre}</p>
              <p className="mt-1 text-base text-slate-600">
                {pesoLegible(bases.tamano)} · Publicado el {fechaLegible(bases.actualizado)}
              </p>
            </div>
            <a
              href={bases.url}
              target="_blank"
              rel="noreferrer"
              className="text-base font-bold text-granate-700 underline underline-offset-4"
            >
              Ver el archivo
            </a>
          </div>
        ) : (
          <p className="text-xl text-slate-500">
            Todavía no hay bases publicadas: el botón no se muestra en la portada.
          </p>
        )}
      </div>

      <form onSubmit={subir} className="mt-6 space-y-5">
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-granate-300 bg-granate-50 px-5 py-6 transition hover:border-granate-500 hover:bg-granate-100"
        >
          <Upload className="h-7 w-7 text-granate-600" />
          <span className="text-base font-semibold text-granate-700">
            {archivo ? archivo.name : 'Toque para elegir el PDF'}
          </span>
        </button>
        <input
          ref={archivoRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={elegir}
        />

        {error && (
          <Aviso tipo="error" icono={AlertCircle}>
            {error}
          </Aviso>
        )}
        {mensaje && (
          <Aviso tipo="exito" icono={CheckCircle2}>
            {mensaje}
          </Aviso>
        )}

        <div className="flex flex-wrap gap-3">
          <Boton type="submit" cargando={procesando === 'subir'}>
            <Upload className="h-6 w-6" />
            {bases ? 'Reemplazar bases' : 'Publicar bases'}
          </Boton>
          {bases && (
            <Boton
              type="button"
              variante="contorno"
              onClick={quitar}
              cargando={procesando === 'quitar'}
            >
              <Trash2 className="h-6 w-6" />
              Quitar
            </Boton>
          )}
        </div>
      </form>
    </Tarjeta>
  );
}

function pesoLegible(bytes) {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  // Math.round dejaba en "0 KB" cualquier archivo de menos de 512 bytes.
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function fechaLegible(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
