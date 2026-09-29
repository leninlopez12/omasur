import { Link } from 'react-router-dom';
import { Globe, MapPin, Phone } from 'lucide-react';
import { CONTACTO } from '../lib/datos';
import Logo from './Logo.jsx';

export default function Footer() {
  return (
    <footer className="bg-granate-800 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-3 lg:px-10">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Logo tamano="h-12 w-12" invertido />
            <span className="text-xl font-black">I - OMASUR UNI 2026</span>
          </div>
          <p className="text-xl text-granate-100">
            Organiza la IES Ingenieritos del Perú "Eduardo de Habich", en convenio con la UNI.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-xl font-bold">Contacto</p>
          <p className="flex items-center gap-3 text-xl text-granate-100">
            <Phone className="h-6 w-6" /> {CONTACTO.yape}
          </p>
          <p className="flex items-center gap-3 text-xl text-granate-100">
            <MapPin className="h-6 w-6" /> {CONTACTO.direccion}
          </p>
          <a
            href={CONTACTO.web}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 text-xl text-white underline decoration-granate-300 underline-offset-4"
          >
            <Globe className="h-6 w-6" /> ipeh.edu.pe
          </a>
        </div>

        <div className="space-y-4">
          <p className="text-xl font-bold">Accesos</p>
          <Link to="/inscripcion" className="block text-xl text-granate-100 hover:text-white">
            Inscribir delegación
          </Link>
          <Link to="/credencial" className="block text-xl text-granate-100 hover:text-white">
            Descargar mi credencial
          </Link>
          <Link to="/ingresar" className="block text-xl text-granate-100 hover:text-white">
            Ingresar al panel
          </Link>
        </div>
      </div>

      <div className="border-t border-granate-700 px-6 py-6 text-center text-xl text-granate-200">
        © 2026 {CONTACTO.institucion}
      </div>
    </footer>
  );
}
