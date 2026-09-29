import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

export function Boton({
  children,
  variante = 'primario',
  tamano = 'normal',
  cargando = false,
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-granate-300';
  const variantes = {
    primario: 'bg-granate-600 text-white hover:bg-granate-700 shadow-suave hover:-translate-y-0.5',
    // El rojo del hero: una variante propia y no una clase suelta, porque
    // dos bg-* en el mismo botón se pisan según el orden del CSS.
    rojo: 'bg-red-400 text-white hover:bg-red-500 shadow-suave hover:-translate-y-0.5',
    blanco: 'bg-white text-granate-700 hover:bg-granate-50 shadow-suave hover:-translate-y-0.5',
    contorno: 'border-2 border-granate-600 text-granate-700 hover:bg-granate-50',
    suave: 'bg-granate-50 text-granate-700 hover:bg-granate-100',
    exito: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-suave',
    excel: 'bg-excel-600 text-white hover:bg-excel-700 shadow-suave hover:-translate-y-0.5',
    excelContorno: 'border-2 border-excel-600 text-excel-600 hover:bg-excel-50',
    peligro: 'bg-rose-600 text-white hover:bg-rose-700',
    fantasma: 'text-granate-700 hover:bg-granate-50',
  };
  const tamanos = {
    normal: 'px-7 py-4 text-xl',
    compacto: 'px-4 py-2.5 text-xl',
    chico: 'px-4 py-2.5 text-base',
    grande: 'px-9 py-5 text-xl',
  };

  return (
    <button
      className={`${base} ${variantes[variante]} ${tamanos[tamano]} ${className}`}
      disabled={cargando || props.disabled}
      {...props}
    >
      {cargando && <Loader2 className={`animate-spin ${tamano === 'chico' ? 'h-5 w-5' : 'h-6 w-6'}`} />}
      {children}
    </button>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  icono: Icono,
  className = '',
  compacto = false,
  ...props
}) {
  const [verClave, setVerClave] = useState(false);
  const texto = compacto ? 'text-base' : 'text-xl';
  const relleno = compacto ? 'px-4 py-2.5' : 'px-5 py-4';
  const espacio = compacto ? 'mb-1.5' : 'mb-2';

  const esClave = props.type === 'password';
  const tipo = esClave && verClave ? 'text' : props.type;
  const espacioOjo = esClave ? (compacto ? 'pr-12' : 'pr-14') : '';
  const espacioIcono = Icono ? (compacto ? 'pl-11' : 'pl-14') : '';

  return (
    <label className={`group block ${className}`}>
      <span className={`${espacio} block font-semibold text-slate-800 ${texto}`}>{etiqueta}</span>

      <span className="relative block">
        {Icono && (
          <Icono
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-granate-600 ${
              compacto ? 'left-3 h-5 w-5' : 'left-4 h-6 w-6'
            }`}
          />
        )}

        <input
          {...props}
          type={tipo}
          className={`w-full rounded-2xl border-2 bg-white text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-granate-600 focus:ring-4 focus:ring-granate-100 ${texto} ${relleno} ${espacioIcono} ${espacioOjo} ${
            error ? 'border-rose-400' : 'border-slate-200'
          }`}
        />

        {esClave && (
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
            className={`absolute top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-500 transition hover:text-granate-700 ${
              compacto ? 'right-2' : 'right-3'
            }`}
          >
            {verClave ? (
              <EyeOff className={compacto ? 'h-5 w-5' : 'h-6 w-6'} />
            ) : (
              <Eye className={compacto ? 'h-5 w-5' : 'h-6 w-6'} />
            )}
          </button>
        )}
      </span>

      {ayuda && !error && <span className={`mt-2 block text-slate-500 ${texto}`}>{ayuda}</span>}
      {error && <span className={`mt-2 block font-medium text-rose-600 ${texto}`}>{error}</span>}
    </label>
  );
}

export function Selector({ etiqueta, children, error, className = '', compacto = false, ...props }) {
  const texto = compacto ? 'text-base' : 'text-xl';
  const relleno = compacto ? 'px-4 py-2.5' : 'px-5 py-4';

  return (
    <label className={`block ${className}`}>
      {etiqueta && (
        <span className={`${compacto ? 'mb-1.5' : 'mb-2'} block font-semibold text-slate-800 ${texto}`}>
          {etiqueta}
        </span>
      )}
      <select
        className={`w-full appearance-none rounded-2xl border-2 bg-white text-slate-900 outline-none transition focus:border-granate-600 focus:ring-4 focus:ring-granate-100 ${texto} ${relleno} ${
          error ? 'border-rose-400' : 'border-slate-200'
        }`}
        {...props}
      >
        {children}
      </select>
      {error && <span className={`mt-1.5 block font-medium text-rose-600 ${texto}`}>{error}</span>}
    </label>
  );
}

/**
 * `fondo` reemplaza el color de la tarjeta. Va aparte de `className` porque dos
 * utilidades de fondo en la misma clase compiten y Tailwind puede quedarse con
 * la equivocada, dejando el texto blanco sobre blanco.
 */
export function Tarjeta({ children, className = '', fondo = 'bg-white' }) {
  return (
    <div className={`rounded-3xl border border-slate-200 ${fondo} p-8 shadow-suave ${className}`}>
      {children}
    </div>
  );
}

export function Aviso({ tipo = 'info', titulo, children, icono: Icono, compacto = false }) {
  const estilos = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    exito: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    alerta: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  };
  const texto = compacto ? 'text-base' : 'text-xl';

  return (
    <div
      className={`flex gap-3 rounded-2xl border-2 ${compacto ? 'p-4' : 'p-6'} ${estilos[tipo]}`}
    >
      {Icono && <Icono className={`shrink-0 ${compacto ? 'h-6 w-6' : 'h-8 w-8'}`} />}
      <div className="space-y-1">
        {titulo && <p className={`font-bold ${texto}`}>{titulo}</p>}
        <div className={texto}>{children}</div>
      </div>
    </div>
  );
}

export function Etiqueta({ children, className = '', compacto = false }) {
  return (
    <span
      className={`inline-flex rounded-full font-semibold ${
        compacto ? 'px-3 py-1 text-sm' : 'px-4 py-1.5 text-xl'
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function Cargando({ texto = 'Cargando' }) {
  return (
    <div className="flex items-center justify-center gap-4 py-20 text-xl text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin text-granate-600" />
      {texto}
    </div>
  );
}

/**
 * Lista desplegable con la lista propia, no la del sistema operativo.
 *
 * Por fuera es el mismo campo de siempre; lo que cambia es el panel que se
 * abre, que sí se puede diseñar (el navegador no deja dar estilo a un
 * <option>). Y no lleva opción vacía: una vez elegido algo, no hay forma de
 * volver a "Seleccione".
 */
export function SelectorOpciones({
  etiqueta,
  ayuda,
  opciones,
  valor,
  alElegir,
  marcador = 'Seleccione',
  error,
  className = '',
  disabled = false,
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const elegida = opciones.find((o) => o.valor === valor);

  // Se cierra al tocar fuera o con Escape, como cualquier desplegable.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    };
    const tecla = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div className={className} ref={caja}>
      {etiqueta && (
        <span className="mb-2 block text-xl font-semibold text-slate-800">{etiqueta}</span>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAbierto((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 text-left text-xl outline-none transition focus:border-granate-600 focus:ring-4 focus:ring-granate-100 ${
            disabled ? 'cursor-not-allowed bg-slate-50' : 'bg-white'
          } ${error ? 'border-rose-400' : abierto ? 'border-granate-600' : 'border-slate-200'}`}
        >
          <span
            className={
              disabled ? 'text-slate-500' : elegida ? 'text-slate-900' : 'text-slate-400'
            }
          >
            {elegida ? elegida.label : marcador}
          </span>
          {disabled ? (
            <Lock className="h-5 w-5 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown
              className={`h-6 w-6 shrink-0 text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
            />
          )}
        </button>

        {abierto && (
          <ul
            role="listbox"
            className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-[0_24px_50px_-18px_rgba(15,23,42,0.45)]"
          >
            {opciones.map(({ valor: v, label }) => {
              const activa = v === valor;
              return (
                <li key={v}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activa}
                    onClick={() => {
                      alElegir(v);
                      setAbierto(false);
                    }}
                    className={`w-full truncate rounded-xl px-4 py-3 text-left text-xl transition ${
                      activa
                        ? 'bg-granate-50 font-bold text-granate-800'
                        : 'text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {ayuda && !error && <span className="mt-1.5 block text-base text-slate-500">{ayuda}</span>}
      {error && <span className="mt-1.5 block text-xl font-medium text-rose-600">{error}</span>}
    </div>
  );
}
