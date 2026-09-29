import { useCallback, useEffect, useState } from 'react';
import { BellRing, Info } from 'lucide-react';
import { Boton } from './Ui.jsx';
import { activarAvisos, permisoActual, renovarSuscripcion, soportaPush } from '../lib/push';

const REVISAR_MS = 5000;

/**
 * Insiste hasta que la comisión acepte los avisos del navegador: mientras el
 * permiso no esté dado, la franja sigue ahí en cada carga del panel.
 *
 * Si el navegador ya fue bloqueado por el usuario no se puede volver a abrir el
 * diálogo desde el código, así que en ese caso se explica cómo reactivarlo.
 */
export default function PermisoAvisos() {
  const [permiso, setPermiso] = useState(permisoActual);
  const [activando, setActivando] = useState(false);

  const revisar = useCallback(() => setPermiso(permisoActual()), []);

  useEffect(() => {
    // Si ya estaba concedido, se renueva la suscripción en silencio.
    if (permisoActual() === 'granted') renovarSuscripcion();

    // El permiso puede cambiarse desde el navegador sin avisar a la página.
    const reloj = setInterval(revisar, REVISAR_MS);
    return () => clearInterval(reloj);
  }, [revisar]);

  if (!soportaPush() || permiso === 'granted') return null;

  const activar = async () => {
    setActivando(true);
    try {
      await activarAvisos();
    } finally {
      setActivando(false);
      revisar();
    }
  };

  if (permiso === 'denied') {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
        <Info className="h-7 w-7 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-amber-900">
            Los avisos están bloqueados en este navegador
          </p>
          <p className="mt-1 text-base text-amber-800">
            Toque el candado junto a la dirección web, permita las notificaciones y recargue
            la página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-granate-600 p-5 text-white">
      <BellRing className="animate-saltar h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-black">Active los avisos del sistema</p>
        <p className="mt-1 text-base text-granate-100">
          Le llegarán las inscripciones por aprobar aunque cierre esta página.
        </p>
      </div>
      <Boton variante="blanco" tamano="chico" cargando={activando} onClick={activar}>
        <BellRing className="h-5 w-5" />
        Activar avisos
      </Boton>
    </div>
  );
}
