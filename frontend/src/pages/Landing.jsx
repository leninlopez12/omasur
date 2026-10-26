import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ChevronRight,
  GraduationCap,
  IdCard,
  Lock,
  School,
  UserPlus,
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import { Boton } from '../components/Ui.jsx';
import { CONVENIOS, GRADOS } from '../lib/datos';
import { useAjustes } from '../lib/ajustes';
import IconoWhatsApp from '../components/IconoWhatsApp.jsx';
import BotonWhatsApp from '../components/BotonWhatsApp.jsx';
import Comunicado from '../components/Comunicado.jsx';
import ResultadosPublicos from '../components/ResultadosPublicos.jsx';

const ETAPAS = [
  {
    id: 'institucional',
    nombre: 'Primera etapa',
    subtitulo: 'Institucional clasificatoria',
    lugar: 'En tu institución',
    fecha: '22 de octubre',
    horario: '9:00 a. m. a 5:00 p. m.',
    horarioTexto: 'Horario oficial',
    detalle: '20 preguntas de opción múltiple en 60 minutos',
    puntos: ['Clasifica el 30 % de cada grado'],
  },
  {
    id: 'macrorregional',
    nombre: 'Segunda etapa',
    subtitulo: 'Final macrorregional',
    lugar: 'Juliaca',
    fecha: '08 de noviembre',
    horario: '10:00 a. m. a 11:30 a. m.',
    horarioTexto: 'Hora de la prueba',
    puntos: ['Presentar DNI y credencial oficial', 'Solo los clasificados de la primera etapa'],
  },
];

/**
 * Los premios van amontonados, sin nombre debajo de cada uno: la idea es que
 * se vea el conjunto. Cada clase le da su tamaño, su giro y cuánto se monta
 * sobre el anterior.
 */
const PREMIOS = [
  { imagen: 'constancia.png', clase: 'z-10 h-20 -rotate-12 sm:h-32 lg:h-40' },
  { imagen: 'computer.png', clase: 'z-20 -ml-6 h-24 rotate-6 sm:-ml-8 sm:h-40 lg:h-48' },
  { imagen: 'medal.png', clase: 'z-30 -ml-7 h-28 -rotate-3 sm:-ml-10 sm:h-44 lg:h-56' },
  { imagen: 'mobile.png', clase: 'z-20 -ml-6 h-20 rotate-12 sm:-ml-8 sm:h-32 lg:h-40' },
];

/** Iconos 3D. No están en el proyecto: la API los trae de Cloudflare. */
const ICONOS_3D = '/api/publico/iconos/';

const PASOS = [
  { imagen: 'file2.png', titulo: 'Registra tus datos', detalle: 'Datos del tutor y de la institución' },
  { imagen: 'copy.png', titulo: 'Carga estudiantes', detalle: 'Uno por uno o con el Excel oficial' },
  { imagen: 'payment.png', titulo: 'Adjunta el pago', detalle: 'Foto del comprobante de Yape' },
  { imagen: 'file.png', titulo: 'Descarga credenciales', detalle: 'Para toda la delegación en un PDF' },
];

const REQUISITOS = [
  { icono: School, titulo: 'Institución estatal' },
  { icono: Building2, titulo: 'Institución particular' },
  { icono: GraduationCap, titulo: 'Grupo de estudios' },
];

export default function Landing() {
  const [nivel, setNivel] = useState('PRIMARIA');
  const [etapaActiva, setEtapaActiva] = useState('institucional');
  const etapa = ETAPAS.find((e) => e.id === etapaActiva);
  const { ajustes } = useAjustes();
  const grupos = ajustes.grupos;
  const cerradas = ajustes.inscripcionesCerradas;

  return (
    <div className="min-h-screen scroll-smooth bg-white">
      <Navbar />

      {/* 1. EL CONCURSO */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-granate-800">
        {ajustes.imagenHero && (
          <img
            src={ajustes.imagenHero}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Velo granate: mantiene el color institucional y la letra legible sobre la foto. */}
        <div className={`absolute inset-0 ${ajustes.imagenHero ? 'bg-granate-800/80' : ''}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_55%)]" />
        <div className="absolute -right-24 top-24 h-96 w-96 rounded-full bg-granate-600/40 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-granate-500/30 blur-3xl" />

        <div className="relative mx-auto w-full max-w-7xl px-6 py-32 text-center lg:px-10">
          <p className="animate-aparecer text-2xl font-semibold text-white sm:text-3xl">
            Olimpiada Macrorregional Sur de Matemática
          </p>

          {/* whitespace-nowrap: sin esto "I -" quedaba solo en una línea en celular. */}
          <h1 className="animate-aparecer mt-8 whitespace-nowrap text-5xl font-black leading-none tracking-tight text-white sm:text-7xl md:text-8xl">
            I - OMASUR
            {/* Rojo claro: sigue la familia del granate del fondo, pero con
                bastante más luz para que destaque sobre el degradado. */}
            <span className="mt-3 block text-red-400">UNI 2026</span>
          </h1>

          <div className="animate-aparecer mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/inscripcion">
              <Boton variante="blanco" tamano="grande">
                {cerradas ? <Lock className="h-7 w-7" /> : <UserPlus className="h-7 w-7" />}
                {cerradas ? 'Inscripciones culminadas' : 'Inscribir delegación'}
              </Boton>
            </Link>
            <Link to="/credencial">
              <Boton
                tamano="grande"
                className="border-2 border-white/60 bg-transparent text-white hover:bg-white/10"
              >
                <IdCard className="h-7 w-7" />
                Mi credencial
              </Boton>
            </Link>
          </div>

          {/* El PDF lo sube el administrador; sin bases cargadas no hay botón
              que lleve a un enlace roto. Se abre aparte para no sacar al
              visitante de la portada. */}
          {ajustes.bases && (
            <a
              href={ajustes.bases.url}
              target="_blank"
              rel="noreferrer"
              className="animate-aparecer mt-8 inline-flex items-center gap-4 rounded-2xl bg-white px-8 py-5 text-2xl font-black text-slate-900 shadow-suave transition hover:-translate-y-0.5"
            >
              <img
                src={ICONOS_3D + 'pdf.png'}
                alt=""
                className="h-11 w-11 shrink-0 object-contain"
              />
              Bases del concurso
            </a>
          )}

        </div>
      </section>

      {/* FECHA LÍMITE */}
      {/* Franja de borde a borde justo debajo de la portada: el plazo es lo
          primero que hay que saber, y el rojo claro es el mismo de «UNI 2026». */}
      <div className="relative z-10 w-full bg-granate-700 px-6 py-4 text-center">
        <p className="text-2xl font-black uppercase leading-tight tracking-tight text-red-400 sm:text-3xl">
          Inscripciones hasta el lunes 19 de octubre de 2026
        </p>
      </div>

      <ResultadosPublicos />

      {/* 2. QUIÉNES PARTICIPAN */}
      {/* z-10 y sin overflow: la imagen 3D se desborda sobre la sección de abajo. */}
      <section id="concurso" className="relative z-10 mx-auto max-w-7xl px-6 py-32 lg:px-10 lg:py-40">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="text-center">
            <h2 className="text-5xl font-black leading-tight text-granate-600">
              I - OMASUR UNI 2026
            </h2>
            <p className="mt-6 text-xl leading-relaxed text-slate-600">
              Es una iniciativa de la IES Colegio de Alta Competencia Ingenieritos del Perú
              Eduardo de Habich, en convenio con la Universidad Nacional de Ingeniería, que
              busca fortalecer las competencias matemáticas, promover la excelencia académica
              y descubrir nuevos talentos en las regiones del sur del Perú.
            </p>
          </div>

          {/* Sin marco y desbordada hacia abajo: pisa un poco la sección
              siguiente, que es lo que le da el efecto. Las luces van antes que
              la imagen en el orden del HTML, así quedan por detrás sin recurrir
              a z-index. */}
          <div className="relative mx-auto -mb-24 w-full max-w-2xl lg:-mb-36">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-[22%] top-[18%] h-64 w-64 -translate-x-1/2 rounded-full bg-granate-400/35 blur-3xl" />
              <div className="absolute bottom-[14%] right-[18%] h-64 w-64 translate-x-1/2 rounded-full bg-orange-300/45 blur-3xl" />
            </div>

            <img
              src={ICONOS_3D + 'matematica.png'}
              alt="Materiales de matemática"
              className="relative w-full object-contain drop-shadow-[0_28px_28px_rgba(15,23,42,0.25)]"
            />
          </div>
        </div>
      </section>

      {/* 3. CATEGORÍAS Y REQUISITOS */}
      <section
        id="participantes"
        className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-rose-100 to-granate-200 py-24"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8),transparent_60%)]" />
        <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-white/50 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-orange-200/50 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
          <div className="text-center">
            <span className="text-2xl font-black uppercase tracking-widest text-granate-600">
              Participantes
            </span>
            <h2 className="mt-4 text-5xl font-black text-slate-900">Categorías</h2>
          </div>

          <div className="mt-12 flex justify-center">
            <div className="inline-flex rounded-2xl bg-white p-2 shadow-[0_14px_30px_-14px_rgba(15,23,42,0.4)]">
              {['PRIMARIA', 'SECUNDARIA'].map((opcion) => (
                <button
                  key={opcion}
                  onClick={() => setNivel(opcion)}
                  className={`rounded-xl px-8 py-3 text-xl font-semibold transition ${
                    nivel === opcion
                      ? 'bg-granate-600 text-white shadow-suave'
                      : 'text-slate-600 hover:text-granate-700'
                  }`}
                >
                  {opcion === 'PRIMARIA' ? 'Primaria' : 'Secundaria'}
                </button>
              ))}
            </div>
          </div>

          {/* La letra de la categoría hace de todo: antes estaba el recuadro
              granate y además el texto "CAT. A", que decían lo mismo. */}
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GRADOS.filter((g) => g.nivel === nivel).map((grado) => (
              <div
                key={grado.valor}
                className="flex items-center gap-6 rounded-3xl border-t border-white bg-white p-7 shadow-[0_18px_38px_-16px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-18px_rgba(15,23,42,0.45)]"
              >
                <span className="text-center">
                  <span className="block text-base font-bold uppercase tracking-widest text-slate-400">
                    cat.
                  </span>
                  <span className="block text-5xl font-black leading-none text-granate-600">
                    {grado.categoria}
                  </span>
                </span>
                <p className="text-xl font-bold text-slate-900">{grado.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {REQUISITOS.map(({ icono: Icono, titulo }) => (
              <div
                key={titulo}
                className="rounded-3xl border-t border-white bg-white p-8 shadow-[0_18px_38px_-16px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-18px_rgba(15,23,42,0.45)]"
              >
                <Icono className="h-10 w-10 text-granate-600" />
                <p className="mt-5 text-3xl font-black text-slate-900">{titulo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ETAPAS */}
      <section id="etapas" className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="text-center">
          <h2 className="text-5xl font-black text-granate-600">Cronograma</h2>
          <p className="mt-4 text-5xl font-black text-slate-900">Dos etapas</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-5">
            {ETAPAS.map((item) => {
              const activa = item.id === etapaActiva;
              return (
                <button
                  key={item.id}
                  onClick={() => setEtapaActiva(item.id)}
                  className={`w-full rounded-3xl border-2 p-8 text-left transition ${
                    activa
                      ? 'border-granate-600 bg-granate-600 text-white shadow-suave'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-granate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-3xl font-black">{item.nombre}</p>
                      <p className={`mt-1 text-xl ${activa ? 'text-granate-100' : 'text-slate-600'}`}>
                        {item.subtitulo}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-8 w-8 transition ${activa ? 'translate-x-1' : 'text-granate-400'}`}
                    />
                  </div>
                  <p className={`mt-6 text-3xl font-black ${activa ? 'text-white' : 'text-granate-600'}`}>
                    {item.fecha}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-suave lg:p-10">
            {/* Los datos de la etapa como bloques que se reparten el ancho: con
                dos o con tres llenan la fila igual, sin quedar sueltos. */}
            <div className="flex flex-wrap gap-4">
              <div className="flex min-w-[13rem] flex-1 items-center gap-4 rounded-2xl bg-slate-50 p-5">
                <img src={ICONOS_3D + 'calendar.png'} alt="" className="h-14 w-14 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-xl font-black text-slate-900">{etapa.fecha}</p>
                  <p className="text-xl text-slate-600">{etapa.lugar}</p>
                </div>
              </div>

              <div className="flex min-w-[13rem] flex-1 items-center gap-4 rounded-2xl bg-slate-50 p-5">
                <img src={ICONOS_3D + 'clock.png'} alt="" className="h-14 w-14 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-xl font-black text-slate-900">{etapa.horario}</p>
                  <p className="text-xl text-slate-600">{etapa.horarioTexto}</p>
                </div>
              </div>
            </div>

            {/* El dato central de la prueba, en grande y al medio. */}
            {/* Viñetas con el foco 3D en lugar del punto. Sobre blanco, sin
                fondo ni recuadro. */}
            <ul className="mt-6 space-y-4">
              {[...etapa.puntos, etapa.detalle].filter(Boolean).map((punto) => (
                <li key={punto} className="flex items-center gap-4">
                  <img
                    src={ICONOS_3D + 'buld.png'}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 shrink-0 object-contain"
                  />
                  <span className="text-2xl font-bold text-slate-900">{punto}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. CONVENIOS */}
      <section id="convenios" className="border-y border-slate-100 bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <h2 className="text-center text-5xl font-black">
            <span className="text-granate-600">Convenios</span>{' '}
            <span className="text-slate-900">institucionales</span>
          </h2>

          <div className="mt-14 grid items-center justify-items-center gap-12 sm:grid-cols-3 lg:gap-16">
            {CONVENIOS.map((convenio) => (
              <LogoConvenio key={convenio.nombre} convenio={convenio} />
            ))}
          </div>
        </div>
      </section>

      {/* 6. PREMIOS */}
      <section
        id="premios"
        className="relative overflow-hidden bg-gradient-to-br from-granate-50 via-granate-100 to-granate-200 py-24"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.7),transparent_60%)]" />

        <div className="relative mx-auto max-w-5xl px-6 text-center lg:px-10">
          <h2 className="text-5xl font-black text-slate-900">Premiación</h2>
          <p className="mx-auto mt-5 max-w-2xl text-xl text-slate-700">
            Para los primeros puestos y los puestos de mérito de cada categoría.
          </p>

          {/* Amontonados y superpuestos, no uno por casilla: se lee como un
              conjunto de premios y no como una lista. */}
          <div className="mt-14 flex items-end justify-center">
            {PREMIOS.map(({ imagen, clase }) => (
              <img
                key={imagen}
                src={ICONOS_3D + imagen}
                alt=""
                loading="lazy"
                className={`object-contain drop-shadow-[0_18px_20px_rgba(15,23,42,0.28)] transition duration-300 hover:-translate-y-3 ${clase}`}
              />
            ))}
          </div>

          {/* Las imágenes muestran el tipo de premio; esta línea lo nombra,
              que es lo que el visitante viene a leer. */}
          <p className="mt-12 text-2xl font-bold text-slate-800 sm:text-3xl">
            Laptops, tablets, diplomas, medallas, gallardetes, RD y muchos premios más.
          </p>
        </div>
      </section>

      {/* 7. INSCRIPCIÓN */}
      <section id="inscripcion" className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="text-center">
          <h2 className="text-5xl font-black text-slate-900">Solo el tutor inscribe</h2>

          {cerradas && (
            <div className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-4 rounded-3xl bg-granate-600 px-8 py-6 text-white">
              <Lock className="h-8 w-8 shrink-0" />
              <p className="text-xl font-bold">Las inscripciones ya fueron culminadas</p>
            </div>
          )}
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-20 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {PASOS.map(({ imagen, titulo, detalle }, indice) => (
            <div
              key={titulo}
              className="group relative rounded-3xl border-t border-white bg-gradient-to-b from-white to-slate-50 p-8 shadow-[0_18px_38px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200 transition duration-300 hover:-translate-y-2 hover:shadow-[0_30px_55px_-18px_rgba(123,30,43,0.45)] hover:ring-granate-300"
            >
              {/* El número va hueco: sin recuadro ni relleno, solo el contorno
                  de la cifra, con -webkit-text-stroke sobre texto transparente. */}
              {/* Tapa blanca: corta el filo de la tarjeta justo donde lo cruza
                  el número, para que no se vea la línea partida por detrás. */}
              <span className="pointer-events-none absolute -right-1 -top-1 h-10 w-28 rounded-tr-3xl bg-white" />

              <span className="pointer-events-none absolute -top-12 right-5 z-10 select-none text-8xl font-black leading-none text-transparent [-webkit-text-stroke:3px_#7B1E2B]">
                {indice + 1}
              </span>

              {/* La sombra bajo la imagen es lo que la hace parecer apoyada. */}
              <img
                src={ICONOS_3D + imagen}
                alt=""
                loading="lazy"
                className="h-24 w-24 object-contain drop-shadow-[0_12px_14px_rgba(15,23,42,0.28)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-105"
              />

              <p className="mt-6 text-xl font-bold text-slate-900">{titulo}</p>
              <p className="mt-2 text-xl text-slate-600">{detalle}</p>
            </div>
          ))}
        </div>

      </section>

      {/* 8. GRUPOS DE WHATSAPP */}
      <section
        id="whatsapp"
        className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-green-100 to-emerald-200 py-24"
      >
        {/* Luces difusas: dan la sensación de volumen sobre el fondo plano. */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8),transparent_60%)]" />
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/60 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-whatsapp-400/30 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-10">
          <h2 className="text-4xl font-black text-whatsapp-700">
            Grupos de WhatsApp acerca del concurso OMASUR
          </h2>
          <p className="mt-6 text-xl text-slate-600">Más abajo puedes unirte.</p>

          <div className="mt-12 grid gap-5">
            {grupos.length === 0 ? (
              <GrupoWhatsApp grupo={{ nombre: 'Primer grupo aperturado', enlace: '' }} />
            ) : (
              grupos.map((grupo) => <GrupoWhatsApp key={grupo.id} grupo={grupo} />)
            )}
          </div>
        </div>
      </section>

      <Footer />
      <BotonWhatsApp whatsapp={ajustes.whatsapp} />
      <Comunicado comunicado={ajustes.comunicado} />
    </div>
  );
}

/** Logo de convenio, sin marco: la imagen completa y sin recortes. */
function LogoConvenio({ convenio }) {
  const [falla, setFalla] = useState(false);

  if (falla) {
    return <p className="text-xl text-slate-400">{convenio.logo}</p>;
  }

  return (
    <img
      src={convenio.logo}
      alt={convenio.nombre}
      onError={() => setFalla(true)}
      className="max-h-32 w-full max-w-xs object-contain lg:max-h-40"
    />
  );
}

function GrupoWhatsApp({ grupo }) {
  const disponible = Boolean(grupo.enlace) && !grupo.lleno;

  const estado = grupo.lleno ? 'Grupo lleno' : grupo.enlace ? 'Unirme al grupo' : 'Próximamente';

  const contenido = (
    <>
      {/* Relieve: degradado diagonal, un brillo arriba y sombra propia abajo. */}
      <span className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-whatsapp-400 via-whatsapp-500 to-whatsapp-700 text-white shadow-[0_14px_26px_-8px_rgba(7,94,84,0.85),inset_0_2px_6px_rgba(255,255,255,0.55)]">
        <span className="pointer-events-none absolute inset-x-3 top-2 h-6 rounded-full bg-white/35 blur-md" />
        <IconoWhatsApp className="relative h-11 w-11 drop-shadow-[0_3px_4px_rgba(7,94,84,0.7)]" />
      </span>
      <div className="min-w-0 text-left">
        <p className="text-xl font-black text-slate-900">{grupo.nombre}</p>
        <p className="mt-1 text-xl text-whatsapp-600">{estado}</p>
      </div>
      {disponible && <ChevronRight className="ml-auto h-9 w-9 text-whatsapp-600" />}
    </>
  );

  // Tarjeta blanca en relieve: sombra profunda abajo y un filo claro arriba,
  // que es lo que hace que parezca despegada del fondo.
  const estilo =
    'flex items-center gap-6 rounded-3xl border-t border-white bg-gradient-to-b from-white to-slate-50 p-8 shadow-[0_20px_40px_-16px_rgba(7,94,84,0.45)] ring-1 ring-black/5 transition duration-300';

  return disponible ? (
    <a
      href={grupo.enlace}
      target="_blank"
      rel="noreferrer"
      className={`${estilo} hover:-translate-y-1.5 hover:shadow-[0_30px_55px_-18px_rgba(7,94,84,0.55)]`}
    >
      {contenido}
    </a>
  ) : (
    <div className={estilo}>{contenido}</div>
  );
}
