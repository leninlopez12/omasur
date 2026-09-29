/* Service worker del I OMASUR UNI 2026.
   Entrega los avisos de la comisión aunque la página esté cerrada. */

const PANEL_POR_DEFECTO = '/supervision';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch {
    aviso = {};
  }

  const titulo = aviso.titulo || 'I OMASUR UNI 2026';

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: aviso.detalle || '',
      icon: '/img/logo.png',
      badge: '/img/logo.png',
      // Los avisos que exigen aprobación se quedan hasta que los atiendan.
      requireInteraction: Boolean(aviso.exigeAccion),
      tag: aviso.id || 'omasur',
      renotify: true,
      data: { tutorId: aviso.tutorId || null },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      // Si el panel ya está abierto, lo trae al frente en vez de duplicarlo.
      for (const ventana of ventanas) {
        if (ventana.url.includes('/supervision') || ventana.url.includes('/admin')) {
          return ventana.focus();
        }
      }
      return self.clients.openWindow(PANEL_POR_DEFECTO);
    }),
  );
});
