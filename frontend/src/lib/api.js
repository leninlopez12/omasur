import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('omasur_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('omasur_token');
    }
    return Promise.reject(error);
  },
);

/** Convierte cualquier error del backend en un texto legible. */
export function mensajeError(error, porDefecto = 'Ocurrió un error, intente nuevamente') {
  const data = error?.response?.data;
  if (!data) return porDefecto;
  if (Array.isArray(data.message)) return data.message.join('. ');
  return data.message || porDefecto;
}

/** Descarga un archivo generado por la API respetando el token. */
export async function descargar(ruta, nombreArchivo) {
  const respuesta = await api.get(ruta, { responseType: 'blob' });
  const url = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo || nombreDeLaRespuesta(respuesta) || 'archivo.xlsx';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** El nombre que puso el servidor en la cabecera, si lo puso. */
function nombreDeLaRespuesta(respuesta) {
  const cabecera = respuesta.headers?.['content-disposition'] || '';
  const encontrado = /filename="?([^";]+)"?/i.exec(cabecera);
  return encontrado ? encontrado[1].trim() : '';
}
