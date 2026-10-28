import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogIn, Menu, UserPlus, X } from 'lucide-react';
import { rutaPorRol, useAuth } from '../lib/auth.jsx';
import { useAjustes } from '../lib/ajustes';
import Logo from './Logo.jsx';

/**
 * Los resultados van primero y subrayados: es lo que todo el mundo viene a
 * buscar cuando salen, y a diferencia de los demás es una página aparte.
 */
const ENLACES = [
  { href: '/resultados_etapa_institucional', texto: 'Resultados', ruta: true },
  { href: '#etapas', texto: 'Etapas' },
  { href: '#premios', texto: 'Premios' },
];

export default function Navbar() {
  const [abierto, setAbierto] = useState(false);
  const [conFondo, setConFondo] = useState(false);
  const { usuario } = useAuth();
  const { ajustes } = useAjustes();
  const navegar = useNavigate();
  // Cerradas las inscripciones, el botón sobra: queda solo el de ingresar.
  const seInscribe = !ajustes.inscripcionesCerradas;

  useEffect(() => {
    const alHacerScroll = () => setConFondo(window.scrollY > 24);
    window.addEventListener('scroll', alHacerScroll);
    return () => window.removeEventListener('scroll', alHacerScroll);
  }, []);

  const irAlPanel = () => navegar(rutaPorRol(usuario?.rol));

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        conFondo ? 'bg-white/95 shadow-suave backdrop-blur' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-10">
        <Link to="/" className="flex items-center gap-3">
          <Logo tamano="h-12 w-12" invertido={!conFondo} />
          <span
            className={`text-xl font-black tracking-tight ${
              conFondo ? 'text-granate-700' : 'text-white'
            }`}
          >
            OMASUR UNI 2026
          </span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {ENLACES.map((enlace) => {
            const estilo = `text-xl transition hover:text-granate-500 ${
              enlace.ruta ? 'font-bold underline underline-offset-8' : 'font-medium'
            } ${conFondo ? 'text-slate-700' : 'text-white/90'}`;

            return enlace.ruta ? (
              <Link key={enlace.href} to={enlace.href} className={estilo}>
                {enlace.texto}
              </Link>
            ) : (
              <a key={enlace.href} href={enlace.href} className={estilo}>
                {enlace.texto}
              </a>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {usuario ? (
            <button
              onClick={irAlPanel}
              className="inline-flex items-center gap-3 rounded-2xl bg-granate-600 px-6 py-3 text-xl font-semibold text-white transition hover:bg-granate-700"
            >
              <LayoutDashboard className="h-6 w-6" />
              Mi panel
            </button>
          ) : (
            <>
              <Link
                to="/ingresar"
                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xl font-semibold transition ${
                  conFondo ? 'text-granate-700 hover:bg-granate-50' : 'text-white hover:bg-white/10'
                }`}
              >
                <LogIn className="h-6 w-6" />
                Ingresar
              </Link>
              {seInscribe && (
                <Link
                  to="/inscripcion"
                  className="inline-flex items-center gap-2 rounded-2xl bg-granate-600 px-6 py-3 text-xl font-semibold text-white shadow-suave transition hover:bg-granate-700"
                >
                  <UserPlus className="h-6 w-6" />
                  Inscribir
                </Link>
              )}
            </>
          )}
        </div>

        <button
          onClick={() => setAbierto((v) => !v)}
          aria-label="Abrir menú"
          className={`rounded-xl p-2 lg:hidden ${conFondo ? 'text-granate-700' : 'text-white'}`}
        >
          {abierto ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
        </button>
      </nav>

      {abierto && (
        <div className="border-t border-slate-100 bg-white px-6 pb-6 pt-2 lg:hidden">
          {ENLACES.map((enlace) => {
            const estilo = `block border-b border-slate-100 py-4 text-xl text-slate-700 ${
              enlace.ruta ? 'font-bold underline underline-offset-4' : 'font-medium'
            }`;

            return enlace.ruta ? (
              <Link
                key={enlace.href}
                to={enlace.href}
                onClick={() => setAbierto(false)}
                className={estilo}
              >
                {enlace.texto}
              </Link>
            ) : (
              <a
                key={enlace.href}
                href={enlace.href}
                onClick={() => setAbierto(false)}
                className={estilo}
              >
                {enlace.texto}
              </a>
            );
          })}
          <div className="mt-5 flex flex-col gap-3">
            <Link
              to="/ingresar"
              className="rounded-2xl border-2 border-granate-600 px-6 py-3 text-center text-xl font-semibold text-granate-700"
            >
              Ingresar
            </Link>
            {seInscribe && (
              <Link
                to="/inscripcion"
                className="rounded-2xl bg-granate-600 px-6 py-3 text-center text-xl font-semibold text-white"
              >
                Inscribir delegación
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
