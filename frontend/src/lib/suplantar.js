import { api } from './api';

/**
 * La sesión del administrador mientras presta la del tutor.
 *
 * Se guarda aparte para poder devolvérsela tal cual al volver: si se
 * sobrescribiera la única clave, el administrador quedaría fuera de su panel
 * y tendría que volver a entrar con su contraseña.
 */
const GUARDADA = 'omasur_token_admin';
const TOKEN = 'omasur_token';

/** Entra a la cuenta del tutor y recarga ya dentro de su panel. */
export async function entrarComoTutor(tutorId) {
  const { data } = await api.post(`/admin/acceder/${tutorId}`);

  localStorage.setItem(GUARDADA, localStorage.getItem(TOKEN) || '');
  localStorage.setItem(TOKEN, data.access_token);

  // Recarga entera y no navegación interna: así todas las pantallas vuelven a
  // pedir sus datos con la sesión nueva, sin restos de la anterior.
  window.location.assign('/panel');
}

/** Devuelve la sesión del administrador. */
export function volverAMiCuenta() {
  const propia = localStorage.getItem(GUARDADA);

  if (propia) {
    localStorage.setItem(TOKEN, propia);
    localStorage.removeItem(GUARDADA);
    window.location.assign('/admin');
    return;
  }

  // Sin sesión guardada —por ejemplo, si cerró y abrió el navegador— no queda
  // más que volver a entrar.
  localStorage.removeItem(TOKEN);
  window.location.assign('/ingresar');
}

/** ¿Quedó una sesión de administrador esperando? */
export function hayCuentaGuardada() {
  return Boolean(localStorage.getItem(GUARDADA));
}
