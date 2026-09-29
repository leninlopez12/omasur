import { useState } from 'react';
import { QrCode } from 'lucide-react';

/**
 * QR de Yape sobre fondo blanco, cuadrado y sin recortes.
 * La comisión lo sube desde Ajustes; si no hay ninguno se usa el de public/img.
 */
export default function QrYape({ src, className = '', etiqueta = 'Escanea para yapear', compacto = false }) {
  const [falla, setFalla] = useState(false);

  return (
    <div className={`rounded-3xl bg-white p-5 shadow-suave ${className}`}>
      {falla || !src ? (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
          <QrCode className="h-12 w-12 text-slate-400" />
          <p className={`font-semibold text-slate-500 ${compacto ? 'text-base' : 'text-xl'}`}>
            QR pendiente de cargar
          </p>
        </div>
      ) : (
        <img
          src={src}
          alt="Código QR para pagar por Yape"
          onError={() => setFalla(true)}
          className="aspect-square w-full rounded-2xl object-contain"
        />
      )}

      {etiqueta && (
        <p className={`mt-3 text-center font-semibold text-yape-700 ${compacto ? 'text-base' : 'text-xl'}`}>
          {etiqueta}
        </p>
      )}
    </div>
  );
}
