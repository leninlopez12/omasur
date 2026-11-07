import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import Logo from '../components/Logo.jsx';

/**
 * `compacto` reduce la escala del panel: lo usan los paneles de la comisión,
 * que muestran mucha información. El panel del tutor se queda con letra grande.
 *
 * Una sección puede traer `hijos`, y un hijo los suyos: la final macrorregional
 * y la clasificatoria institucional son etapas que llevan secciones dentro, y
 * esas secciones llevan pantallas. Por eso el menú se dibuja solo, nivel por
 * nivel, en vez de dar por hecho que hay dos.
 */
export default function PanelLayout({
  titulo,
  secciones,
  actual,
  alCambiar,
  children,
  // Secciones que van abajo, junto a cerrar sesión, en vez de en la lista.
  seccionesPie = [],
  pie,
  acciones,
  compacto = false,
}) {
  const { usuario, salir } = useAuth();
  const [abierto, setAbierto] = useState(false);

  const t = compacto
    ? {
        ancho: 'w-64',
        item: 'gap-3 rounded-xl px-4 py-2.5 text-base',
        icono: 'h-5 w-5',
        hijo: 'gap-3 rounded-xl py-2 pl-11 pr-4 text-base',
        nieto: 'gap-3 rounded-xl py-2 pl-[3.5rem] pr-3 text-base',
        iconoHijo: 'h-4 w-4',
        chevron: 'h-4 w-4',
        marca: 'text-base',
        titulo: 'text-2xl',
        usuario: 'text-base',
        avatar: 'h-10 w-10 text-base',
        cabecera: 'px-5 py-4 lg:px-8',
        principal: 'px-5 py-6 lg:px-8',
      }
    : {
        ancho: 'w-80',
        item: 'gap-4 rounded-2xl px-5 py-4 text-xl',
        icono: 'h-7 w-7',
        hijo: 'gap-4 rounded-2xl py-3 pl-14 pr-5 text-xl',
        nieto: 'gap-4 rounded-2xl py-3 pl-[4.5rem] pr-4 text-xl',
        iconoHijo: 'h-6 w-6',
        chevron: 'h-5 w-5',
        marca: 'text-xl',
        titulo: 'text-3xl',
        usuario: 'text-xl',
        avatar: 'h-12 w-12 text-xl',
        cabecera: 'px-6 py-5 lg:px-10',
        principal: 'px-6 py-10 lg:px-10',
      };

  const elegir = (id) => {
    alCambiar(id);
    setAbierto(false);
  };

  /** La primera pantalla que se puede abrir dentro de una rama. */
  const primeraPantalla = (seccion) =>
    seccion.hijos?.length ? primeraPantalla(seccion.hijos[0]) : seccion.id;

  /** Si lo que está abierto cuelga de esta rama; así se despliega sola. */
  const contiene = (seccion) => seccion.id === actual || Boolean(seccion.hijos?.some(contiene));

  const sangria = [t.item, t.hijo, t.nieto];
  const tamanoIcono = [t.icono, t.iconoHijo, t.iconoHijo];

  /**
   * Una entrada del menú con lo que lleve dentro.
   *
   * El nivel solo cambia la sangría y el peso de la letra: lo demás es igual sea
   * una etapa, una sección o una pantalla. Al pulsar un grupo se abre su primera
   * pantalla, que es como venía funcionando el menú.
   */
  const pintar = (seccion, nivel) => {
    const { id, texto, icono: Icono, hijos, destacado } = seccion;
    const grupo = Boolean(hijos?.length);
    const dentro = contiene(seccion);

    const colores = dentro
      ? nivel === 0
        ? 'bg-white text-granate-700 shadow-suave'
        : grupo
          ? // Una sección abierta dentro de su etapa: se marca, pero más suave
            // que la pantalla que se está viendo.
            'bg-granate-700 text-white'
          : 'bg-granate-600 text-white'
      : destacado === 'verde'
        ? // Lo bueno también merece saltar a la vista.
          'bg-emerald-600 text-white hover:bg-emerald-500'
        : destacado
          ? // Lo urgente no se pierde entre lo de siempre.
            'bg-amber-500 text-white hover:bg-amber-400'
          : 'text-granate-100 hover:bg-granate-700';

    return (
      <div key={id} className="space-y-1.5">
        <button
          onClick={() => elegir(primeraPantalla(seccion))}
          className={`flex w-full items-center text-left transition ${
            nivel === 0 ? 'font-semibold' : 'font-medium'
          } ${sangria[nivel]} ${colores}`}
        >
          <Icono className={`${tamanoIcono[nivel]} shrink-0`} />
          <span className="min-w-0 flex-1">{texto}</span>
          {grupo &&
            (dentro ? (
              <ChevronDown className={`${t.chevron} shrink-0 opacity-60`} />
            ) : (
              <ChevronRight className={`${t.chevron} shrink-0 opacity-60`} />
            ))}
        </button>

        {dentro && grupo && hijos.map((hijo) => pintar(hijo, nivel + 1))}
      </div>
    );
  };

  const menu = (
    <nav className="flex h-full flex-col">
      <Link to="/" className={`flex items-center gap-3 ${compacto ? 'px-5 py-5' : 'px-6 py-7'}`}>
        <Logo tamano={compacto ? 'h-10 w-10' : 'h-12 w-12'} invertido />
        <span className={`font-black text-white ${t.marca}`}>OMASUR 2026</span>
      </Link>

      <div className="flex-1 space-y-1.5 px-4 py-4">
        {secciones.map((seccion) => pintar(seccion, 0))}
      </div>

      <div className="space-y-1.5 border-t border-granate-700 px-4 py-5">
        {pie}
        {seccionesPie.map(({ id, texto, icono: Icono }) => (
          <button
            key={id}
            onClick={() => elegir(id)}
            className={`flex w-full items-center text-left font-semibold transition ${t.item} ${
              actual === id
                ? 'bg-white text-granate-700 shadow-suave'
                : 'text-granate-100 hover:bg-granate-700'
            }`}
          >
            <Icono className={`${t.icono} shrink-0`} />
            {texto}
          </button>
        ))}
        <button
          onClick={salir}
          className={`flex w-full items-center text-left font-semibold text-granate-100 transition hover:bg-granate-700 ${t.item}`}
        >
          <LogOut className={t.icono} />
          Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    // panel-ajustado baja un escalón toda la letra de adentro (ver index.css).
    <div className="panel-ajustado min-h-screen bg-slate-50 lg:flex">
      <aside
        className={`hidden ${t.ancho} shrink-0 bg-granate-800 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto`}
      >
        {menu}
      </aside>

      {abierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setAbierto(false)} />
          <aside className={`absolute inset-y-0 left-0 ${t.ancho} max-w-[85%] overflow-y-auto bg-granate-800`}>
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar menú"
              className="absolute right-4 top-5 rounded-xl p-2 text-white"
            >
              <X className="h-7 w-7" />
            </button>
            {menu}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className={`flex items-center justify-between gap-5 ${t.cabecera}`}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAbierto(true)}
                aria-label="Abrir menú"
                className="rounded-xl p-2 text-granate-700 lg:hidden"
              >
                <Menu className="h-7 w-7" />
              </button>
              <h1 className={`font-black text-slate-900 ${t.titulo}`}>{titulo}</h1>
            </div>

            <div className="flex items-center gap-3">
              {acciones}

              <div className="hidden items-center gap-3 sm:flex">
                <span
                  className={`flex items-center justify-center rounded-2xl bg-granate-600 font-black text-white ${t.avatar}`}
                >
                  {(usuario?.nombres || usuario?.nombre || 'U').charAt(0).toUpperCase()}
                </span>
                <div className="text-right">
                  <p className={`font-bold text-slate-900 ${t.usuario}`}>
                    {usuario?.nombres || usuario?.nombre}
                  </p>
                  <p className={`text-slate-500 ${t.usuario}`}>{usuario?.correo}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={t.principal}>{children}</main>
      </div>
    </div>
  );
}
