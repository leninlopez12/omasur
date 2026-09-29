import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

/**
 * Espacio reservado para una imagen real.
 * Coloque el archivo en frontend/public/img/ y quedará visible al instante.
 */
export default function Foto({ src, alt, nota, className = '', alto = 'h-80' }) {
  const [falla, setFalla] = useState(false);

  if (falla || !src) {
    return (
      <div
        className={`flex ${alto} flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-granate-200 bg-granate-50 p-8 text-center ${className}`}
      >
        <ImageIcon className="h-12 w-12 text-granate-400" />
        <p className="text-xl font-semibold text-granate-700">{nota || alt}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFalla(true)}
      className={`${alto} w-full rounded-3xl object-cover shadow-suave ${className}`}
    />
  );
}
