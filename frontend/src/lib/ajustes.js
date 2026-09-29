import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Imagen del QR que se usa si la comisión todavía no subió una. */
export const QR_YAPE_POR_DEFECTO = '/img/yape.jpg';

/**
 * Ajustes que administra la comisión desde su panel:
 * los grupos de WhatsApp y el QR de Yape.
 */
const VACIO = {
  grupos: [],
  yapeQr: null,
  inscripcionesCerradas: false,
  cerradasEn: null,
  bases: null,
  whatsapp: null,
};

export function useAjustes() {
  const [ajustes, setAjustes] = useState(VACIO);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/ajustes');
      setAjustes(data);
    } catch {
      setAjustes(VACIO);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { ajustes, cargando, recargar: cargar, qrYape: ajustes.yapeQr || QR_YAPE_POR_DEFECTO };
}
