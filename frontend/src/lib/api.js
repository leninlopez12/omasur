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
  const estado = error?.response?.status;
  const data = error?.response?.data;

  // Lo que responde el proxy —no la API— no trae el campo message, así que sin
  // esto un archivo rechazado por tamaño se veía como una falla cualquiera.
  // Si el 413 viene de la API, su mensaje dice el peso exacto y vale más.
  if (estado === 413 && !data?.message) {
    return 'El archivo es demasiado grande para el servidor. Avise a quien administra el servidor: hay que subir el límite de subida (client_max_body_size en Nginx).';
  }
  if (estado === 403 && !data?.message) {
    return 'Su cuenta no tiene permiso para esto. Entre con la cuenta de administrador.';
  }
  if (estado === 502 || estado === 504) {
    return 'El servidor tardó demasiado en responder. Si el archivo es grande, pruebe con una conexión mejor o con uno más liviano.';
  }
  if (!error?.response) {
    return 'No se pudo conectar con el servidor. Revise su conexión y vuelva a intentarlo.';
  }

  if (!data) return porDefecto;
  if (Array.isArray(data.message)) return data.message.join('. ');
  // Algunos proxys devuelven una página HTML: eso no es un mensaje para nadie.
  if (typeof data === 'string') return porDefecto;
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
