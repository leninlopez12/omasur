import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import * as express from 'express';

const produccion = process.env.NODE_ENV === 'production';

/**
 * De dónde se aceptan peticiones. En producción se exige la lista explícita:
 * si falta, no se habilita ningún origen externo, que es lo correcto cuando la
 * web se sirve desde este mismo servidor.
 */
function origenes(): string[] {
  const valor = process.env.FRONTEND_URL || (produccion ? '' : 'http://localhost:5173');
  return valor
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Revisión antes de levantar el servidor.
 *
 * Lo que compromete la seguridad detiene el arranque; lo que solo degrada el
 * servicio se avisa y sigue. La clave de sesiones es el caso grave: sin ella
 * se usaría la de desarrollo, que está escrita en el repositorio, y cualquiera
 * podría fabricarse un token de administrador.
 */
function revisarProduccion() {
  if (!produccion) return;

  const clave = process.env.JWT_SECRET || '';
  if (clave.length < 32) {
    console.error(
      [
        '',
        'No se puede arrancar: falta JWT_SECRET o es demasiado corta (mínimo 32 caracteres).',
        'Genérela con:',
        `  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  const avisos: string[] = [];
  if (!process.env.SITIO_URL) {
    avisos.push(
      'SITIO_URL está vacío: los enlaces para recuperar la contraseña saldrán apuntando a localhost.',
    );
  }
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET) {
    avisos.push(
      'Cloudflare R2 sin configurar: los comprobantes quedarán en el disco del servidor y se ' +
        'pierden en cada despliegue.',
    );
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    avisos.push('Correo sin configurar: nadie podrá recuperar su contraseña.');
  }
  if (process.env.TRUST_PROXY !== 'true') {
    avisos.push(
      'TRUST_PROXY no está en true: detrás de un proxy, el límite de intentos de ingreso se ' +
        'puede burlar cambiando de cabecera.',
    );
  }

  for (const aviso of avisos) console.warn('AVISO: ' + aviso);
}

async function bootstrap() {
  revisarProduccion();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const permitidos = origenes();
  if (permitidos.length) {
    app.enableCors({ origin: permitidos, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  // Cabeceras básicas. No se añade nada que rompa las imágenes ni el visor de
  // comprobantes, que se cargan desde este mismo origen.
  app.use((_req: express.Request, res: express.Response, siguiente: express.NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    if (produccion) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    siguiente();
  });

  // La carpeta uploads/ ya NO se publica: guardaba comprobantes, y cualquiera
  // con la dirección podía abrirlos sin sesión. Los archivos antiguos que
  // queden ahí se siguen leyendo desde el servidor por /api/pagos/:id/archivo.

  // Con la web compilada al lado, este mismo servicio la entrega: así el
  // frontend y la API comparten origen y las direcciones /api/... funcionan
  // sin proxy ni CORS.
  // Solo en producción (o si se apunta a mano con WEB_DIST): en desarrollo la
  // web la sirve Vite, y entregar aquí una copia compilada vieja confunde.
  const web = resolve(process.env.WEB_DIST || join(process.cwd(), '..', 'frontend', 'dist'));
  const servirWeb = produccion || Boolean(process.env.WEB_DIST);
  if (servirWeb && existsSync(join(web, 'index.html'))) {
    app.use(express.static(web, { index: false, maxAge: produccion ? '1y' : 0 }));
    // El index nunca se cachea: si no, tras un despliegue el navegador sigue
    // pidiendo los archivos viejos, que ya no existen.
    app.use((peticion: express.Request, respuesta: express.Response, siguiente) => {
      if (peticion.method !== 'GET' || peticion.path.startsWith('/api')) return siguiente();
      respuesta.setHeader('Cache-Control', 'no-cache');
      respuesta.sendFile(join(web, 'index.html'));
    });
    console.log(`Web servida desde ${web}`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  // Node corta una petición a los 5 minutos. Subir el video del tutorial por
  // una conexión lenta tarda más que eso, y el corte se veía como una falla
  // sin causa. Quince minutos alcanzan de sobra para los 100 MB que se aceptan.
  const servidor = app.getHttpServer();
  servidor.requestTimeout = 15 * 60 * 1000;
  servidor.headersTimeout = 16 * 60 * 1000;
  console.log(`OMASUR API escuchando en el puerto ${port}, bajo /api`);
}
bootstrap();
