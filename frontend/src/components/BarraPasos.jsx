import { Check } from 'lucide-react';

export default function BarraPasos({ pasos, actual }) {
  const porcentaje = (actual / (pasos.length - 1)) * 100;

  return (
    <div className="w-full">
      <div className="relative">
        <div className="absolute left-0 right-0 top-7 h-1.5 rounded-full bg-slate-200" />
        <div
          className="absolute left-0 top-7 h-1.5 rounded-full bg-granate-600 transition-all duration-500"
          style={{ width: `${porcentaje}%` }}
        />

        <ol className="relative flex justify-between">
          {pasos.map((paso, indice) => {
            const completado = indice < actual;
            const activo = indice === actual;
            const Icono = paso.icono;

            return (
              <li key={paso.titulo} className="flex w-full flex-col items-center text-center">
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-white transition-all duration-300 ${
                    completado
                      ? 'bg-granate-600 text-white'
                      : activo
                        ? 'scale-110 bg-granate-600 text-white shadow-suave'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {completado ? <Check className="h-7 w-7" /> : <Icono className="h-7 w-7" />}
                </span>
                <span
                  className={`mt-3 hidden max-w-[10rem] text-xl font-semibold sm:block ${
                    activo || completado ? 'text-granate-700' : 'text-slate-500'
                  }`}
                >
                  {paso.titulo}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="mt-6 text-center text-xl font-semibold text-granate-700 sm:hidden">
        Paso {actual + 1} de {pasos.length}: {pasos[actual].titulo}
      </p>
    </div>
  );
}
