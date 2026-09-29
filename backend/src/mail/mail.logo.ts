import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Logo del colegio que va en la cabecera de todos los correos.
 *
 * Viaja adjunto dentro del propio mensaje (cid) y no como enlace a una web:
 * así se ve aunque el correo se abra sin internet y sin que Gmail lo bloquee,
 * que es lo que pasa con las imágenes traídas de afuera.
 */
export const LOGO_CID = 'logo-omasur';

/** Se puede apuntar a otro archivo con LOGO_CORREO en el .env. */
const RUTAS = [
  process.env.LOGO_CORREO,
  join(process.cwd(), 'assets', 'logo-correo.png'),
  join(process.cwd(), 'assets', 'logo-correo.jpg'),
  join(process.cwd(), '..', 'frontend', 'public', 'img', 'logo.jpg'),
].filter(Boolean) as string[];

export const RUTA_LOGO = RUTAS.find((ruta) => existsSync(ruta)) || '';

/** Si el archivo no está, la cabecera sale solo con el texto, sin roturas. */
export const HAY_LOGO = RUTA_LOGO !== '';
