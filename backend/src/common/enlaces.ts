/**
 * El comprobante siempre se entrega por la API, nunca con la clave del
 * almacenamiento ni con una URL firmada que caduque o se pueda reenviar.
 */
export function conEnlace<T extends { id: string; archivoUrl: string }>(pago: T | null) {
  if (!pago) return null;
  const { archivoUrl, ...resto } = pago;
  return { ...resto, archivoUrl: `/api/pagos/${pago.id}/archivo` };
}
