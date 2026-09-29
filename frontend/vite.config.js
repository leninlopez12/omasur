import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `%SITIO%` del index.html se reemplaza al construir.
 *
 * Las vistas previas de WhatsApp, Facebook y X piden la dirección completa de
 * la imagen; el robot que las arma no ejecuta JavaScript, así que no se puede
 * resolver en el navegador. Antes de publicar, ponga el dominio real en
 * VITE_SITIO_URL. Sin esa variable quedan direcciones relativas, que la
 * mayoría de robots resuelve igual contra la página que está leyendo.
 */
function direccionDelSitio(sitio) {
  return {
    name: 'direccion-del-sitio',
    transformIndexHtml: (html) => html.replaceAll('%SITIO%', sitio),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sitio = (env.VITE_SITIO_URL || '').replace(/\/$/, '');

  return {
    plugins: [react(), direccionDelSitio(sitio)],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
  };
});
