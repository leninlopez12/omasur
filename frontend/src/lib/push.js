import { api } from './api';

/** El navegador soporta avisos del sistema solo con service worker y Push API. */
export const soportaPush = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const permisoActual = () => (soportaPush() ? Notification.permission : 'unsupported');

function aUint8Array(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(normal);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

async function registrarWorker() {
  const registro = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return registro;
}

/**
 * Pide el permiso al navegador y registra el dispositivo en el servidor.
 * Debe dispararse desde un clic: los navegadores no abren el diálogo solos.
 */
export async function activarAvisos() {
  if (!soportaPush()) return { ok: false, motivo: 'unsupported' };

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return { ok: false, motivo: permiso };

  const { data } = await api.get('/notificaciones/push/clave');
  if (!data?.clave) return { ok: false, motivo: 'sin-clave' };

  const registro = await registrarWorker();
  const suscripcion =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: aUint8Array(data.clave),
    }));

  await api.post('/notificaciones/push/suscribir', suscripcion.toJSON());
  return { ok: true, motivo: 'granted' };
}

/** Si el permiso ya estaba dado, se vuelve a registrar sin molestar al usuario. */
export async function renovarSuscripcion() {
  if (!soportaPush() || Notification.permission !== 'granted') return false;

  try {
    const { data } = await api.get('/notificaciones/push/clave');
    if (!data?.clave) return false;

    const registro = await registrarWorker();
    const suscripcion =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: aUint8Array(data.clave),
      }));

    await api.post('/notificaciones/push/suscribir', suscripcion.toJSON());
    return true;
  } catch {
    return false;
  }
}
