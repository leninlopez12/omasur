import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from './api';

const NotificacionesContext = createContext(null);

const REINTENTO_MS = 5000;
const DURACION_AVISO_MS = 8000;

/**
 * El envío a revisión es el aviso que exige acción de la comisión: se destaca en
 * la campanita y su tarjeta flotante no se va sola, hay que atenderla o cerrarla.
 */
export const esPrioritaria = (tipo) =>
  tipo === 'INSCRIPCION_ENVIADA' || tipo === 'OBSERVACION_ABSUELTA';

/**
 * Avisos de la comisión: historial para la campanita y flujo en vivo por SSE.
 * El stream usa fetch para poder mandar el token en la cabecera, y se reconecta
 * solo si el servidor se cae o la conexión se corta.
 */
export function NotificacionesProvider({ children }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [enVivo, setEnVivo] = useState(false);
  const [avisos, setAvisos] = useState([]);
  /** Ids ya procesados: evita contar dos veces si llega repetido. */
  const vistos = useRef(new Set());

  const aplicar = useCallback((data) => {
    data.notificaciones.forEach((n) => vistos.current.add(n.id));
    setNotificaciones(data.notificaciones);
    setSinLeer(data.sinLeer);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/notificaciones');
      aplicar(data);
    } catch {
      /* el panel sigue funcionando aunque el historial falle */
    }
  }, [aplicar]);

  const descartarAviso = useCallback((id) => {
    setAvisos((lista) => lista.filter((a) => a.id !== id));
  }, []);

  /** Llega un aviso nuevo: encabeza la lista, suma al contador y salta en pantalla. */
  const recibir = useCallback(
    (notificacion) => {
      if (vistos.current.has(notificacion.id)) return;
      vistos.current.add(notificacion.id);

      setNotificaciones((lista) => [notificacion, ...lista]);
      setSinLeer((n) => n + 1);
      setAvisos((lista) => [...lista, notificacion]);

      if (!esPrioritaria(notificacion.tipo)) {
        setTimeout(() => descartarAviso(notificacion.id), DURACION_AVISO_MS);
      }
    },
    [descartarAviso],
  );

  useEffect(() => {
    // Bandera local a esta ejecución: así el modo estricto de React, que monta
    // dos veces, no deja una conexión huérfana duplicando los avisos.
    let cancelado = false;
    let controlador;
    let reintento;

    const escuchar = async () => {
      const token = localStorage.getItem('omasur_token');
      if (!token || cancelado) return;

      controlador = new AbortController();
      try {
        const respuesta = await fetch('/api/notificaciones/stream', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controlador.signal,
        });
        if (!respuesta.ok || !respuesta.body) throw new Error('sin stream');

        setEnVivo(true);
        const lector = respuesta.body.getReader();
        const decodificador = new TextDecoder();
        let bufer = '';

        while (!cancelado) {
          const { value, done } = await lector.read();
          if (done) break;

          bufer += decodificador.decode(value, { stream: true });
          const bloques = bufer.split('\n\n');
          bufer = bloques.pop() ?? '';

          for (const bloque of bloques) {
            const linea = bloque.split('\n').find((l) => l.startsWith('data:'));
            if (!linea) continue;
            try {
              const mensaje = JSON.parse(linea.slice(5).trim());
              if (mensaje.evento === 'notificacion') recibir(mensaje.notificacion);
            } catch {
              /* bloque incompleto o latido sin datos */
            }
          }
        }
      } catch {
        /* se reintenta abajo */
      } finally {
        if (!cancelado) {
          setEnVivo(false);
          reintento = setTimeout(escuchar, REINTENTO_MS);
        }
      }
    };

    cargar();
    escuchar();

    return () => {
      cancelado = true;
      controlador?.abort();
      clearTimeout(reintento);
    };
  }, [cargar, recibir]);

  const marcarLeida = useCallback(
    async (id) => {
      const { data } = await api.patch(`/notificaciones/${id}/leer`);
      aplicar(data);
    },
    [aplicar],
  );

  const marcarTodasLeidas = useCallback(async () => {
    const { data } = await api.post('/notificaciones/leer-todas');
    aplicar(data);
  }, [aplicar]);

  /** Inscripciones enviadas que la comisión todavía no ha abierto. */
  const porAprobar = useMemo(
    () => notificaciones.filter((n) => esPrioritaria(n.tipo) && !n.leida).length,
    [notificaciones],
  );

  const valor = useMemo(
    () => ({
      notificaciones,
      sinLeer,
      porAprobar,
      enVivo,
      avisos,
      descartarAviso,
      marcarLeida,
      marcarTodasLeidas,
      recargar: cargar,
    }),
    [
      notificaciones,
      sinLeer,
      porAprobar,
      enVivo,
      avisos,
      descartarAviso,
      marcarLeida,
      marcarTodasLeidas,
      cargar,
    ],
  );

  return (
    <NotificacionesContext.Provider value={valor}>{children}</NotificacionesContext.Provider>
  );
}

export function useNotificaciones() {
  const contexto = useContext(NotificacionesContext);
  if (!contexto) throw new Error('useNotificaciones debe usarse dentro de NotificacionesProvider');
  return contexto;
}
