import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import Logo from '../components/Logo.jsx';

/**
 * `compacto` reduce la escala del panel: lo usan los paneles de la comisión,
 * que muestran mucha información. El panel del tutor se queda con letra grande.
 * Una sección puede traer `hijos` y estos aparecen dentro del mismo sidebar.
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
        iconoHijo: 'h-4 w-4',
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
        iconoHijo: 'h-6 w-6',
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

  const menu = (
    <nav className="flex h-full flex-col">
      <Link to="/" className={`flex items-center gap-3 ${compacto ? 'px-5 py-5' : 'px-6 py-7'}`}>
        <Logo tamano={compacto ? 'h-10 w-10' : 'h-12 w-12'} invertido />
        <span className={`font-black text-white ${t.marca}`}>OMASUR 2026</span>
      </Link>

      <div className="flex-1 space-y-1.5 px-4 py-4">
        {secciones.map((seccion) => {
          const { id, texto, icono: Icono, hijos } = seccion;
          const activoHijo = hijos?.some((h) => h.id === actual);
          const activo = actual === id || activoHijo;

          return (
            <div key={id} className="space-y-1.5">
              <button
                onClick={() => elegir(hijos?.length ? hijos[0].id : id)}
                className={`flex w-full items-center text-left font-semibold transition ${t.item} ${
                  activo
                    ? 'bg-white text-granate-700 shadow-suave'
                    : 'text-granate-100 hover:bg-granate-700'
                }`}
              >
                <Icono className={`${t.icono} shrink-0`} />
                {texto}
              </button>

              {activo &&
                hijos?.map(({ id: idHijo, texto: textoHijo, icono: IconoHijo }) => (
                  <button
                    key={idHijo}
                    onClick={() => elegir(idHijo)}
                    className={`flex w-full items-center text-left font-medium transition ${t.hijo} ${
                      actual === idHijo
                        ? 'bg-granate-600 text-white'
                        : 'text-granate-100 hover:bg-granate-700'
                    }`}
                  >
                    <IconoHijo className={`${t.iconoHijo} shrink-0`} />
                    {textoHijo}
                  </button>
                ))}
            </div>
          );
        })}
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
