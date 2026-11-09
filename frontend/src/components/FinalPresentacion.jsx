import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Crown,
  FastForward,
  FileSpreadsheet,
  Keyboard,
  Landmark,
  Layers,
  Maximize2,
  Medal,
  Minimize2,
  MonitorPlay,
  Play,
  RotateCcw,
  School,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { Aviso, Boton, Cargando, Selector, Tarjeta } from './Ui.jsx';
import { api, descargar, mensajeError } from '../lib/api';

/** Hasta qué lugar se lanza la serpentina al terminar de nombrar. */
const PODIO = 3;

/**
 * Cada cuánto aparece el siguiente premiado. Se elige en el tablero del acto
 * y vale para todas las láminas; queda guardado en este navegador porque es
 * la preferencia de quien proyecta, no un ajuste del concurso.
 */
const VELOCIDADES = [
  { valor: 250, texto: 'Muy rápida · un cuarto de segundo' },
  { valor: 400, texto: 'Rápida · casi medio segundo' },
  { valor: 700, texto: 'Normal · poco menos de un segundo' },
  { valor: 1100, texto: 'Pausada · más de un segundo' },
];
const CLAVE_VELOCIDAD = 'omasur.presentacion.velocidad';

const velocidadGuardada = () => {
  try {
    const n = Number(localStorage.getItem(CLAVE_VELOCIDAD));
    return VELOCIDADES.some((v) => v.valor === n) ? n : 400;
  } catch {
    return 400;
  }
};

/**
 * La premiación de la final, para proyectarla.
 *
 * Son dos pantallas distintas y por eso cuelgan por separado del menú: el
 * tablero —los números, la velocidad, cómo se maneja y el orden del acto— y
 * la lámina, que no lleva nada alrededor porque es lo que se proyecta.
 *
 * La lámina se dibuja a un ancho fijo —1600— y se escala a lo que haya, de
 * modo que lo que se ve en el panel es exactamente lo que se ve en el
 * proyector, sin sorpresas de última hora.
 */
export default function FinalPresentacion({ lamina: pedida, irA }) {
  // El sustento del premio mayor no se proyecta: es una pantalla del panel,
  // sale de otra consulta y no necesita las veintiuna láminas del acto.
  if (pedida === 'campeones-sustento') return <Sustento />;
  // Las descargas tampoco: son el archivo de después del acto.
  if (pedida === 'excel') return <Descargas />;
  return <Proyeccion pedida={pedida} irA={irA} />;
}

function Proyeccion({ pedida, irA }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/final/resultados/presentacion')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo armar la presentación')));
  }, []);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Armando la presentación" />;

  if (pedida === 'tablero') return <Tablero datos={datos} irA={irA} />;
  return <Acto datos={datos} pedida={pedida} irA={irA} />;
}

// --------------------------------------------------------------- el tablero

/**
 * Todo lo que no es la lámina: cuántos rindieron, a qué velocidad se nombra,
 * cómo se maneja y en qué orden va el acto.
 *
 * Vive en su propia pantalla porque mezclado con la lámina estorbaba: quien
 * entra a «Primer lugar» va a proyectar, no a leer instrucciones.
 */
function Tablero({ datos, irA }) {
  const { laminas, resumen } = datos;
  const [velocidad, setVelocidad] = useState(velocidadGuardada);

  const guardarVelocidad = (valor) => {
    setVelocidad(valor);
    try {
      localStorage.setItem(CLAVE_VELOCIDAD, String(valor));
    } catch {
      /* si el navegador no deja guardar, vale para esta sesión y basta */
    }
  };

  const abrir = (i) => irA?.(`final-pres-${laminas[i].id}`);

  return (
    <div className="space-y-6">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
              <MonitorPlay className="h-9 w-9 text-granate-600" />
              Tablero del acto
            </h3>
            <p className="mt-2 text-xl text-slate-600">
              La premiación se proyecta en {laminas.length} láminas, del décimo lugar al primero
              y en cada lugar primero el privado y después el público. La última es el premio
              mayor: campeones de campeones. Cada una se abre desde el menú, o desde el orden del
              acto que está más abajo.
            </p>
          </div>
          <Boton onClick={() => abrir(0)}>
            <Play className="h-6 w-6" />
            Empezar el acto
          </Boton>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Cifra icono={Users} valor={resumen.rindieron} texto="Rindieron la final" />
          <Cifra icono={Building2} valor={resumen.privados} texto="De colegios privados" />
          <Cifra icono={Landmark} valor={resumen.publicos} texto="De colegios públicos" />
        </div>

        <div className="mt-6 max-w-md">
          <Selector
            etiqueta="Velocidad al nombrar a los premiados"
            compacto
            value={velocidad}
            onChange={(e) => guardarVelocidad(Number(e.target.value))}
            ayuda="Vale para todas las láminas y queda guardada en este navegador."
          >
            {VELOCIDADES.map((v) => (
              <option key={v.valor} value={v.valor}>
                {v.texto}
              </option>
            ))}
          </Selector>
        </div>

        {resumen.salonesPendientes > 0 && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto titulo="Todavía faltan actas">
              Quedan {resumen.salonesPendientes} salón(es) por entregar. Hasta que lleguen todos,
              los puestos pueden moverse: no proyecte esto como definitivo.
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <ComoSeManeja />
      <Indice laminas={laminas} indice={-1} ir={abrir} />
    </div>
  );
}

const TECLAS = [
  ['← →', 'Pasar de una lámina a la otra'],
  ['Enter', 'Nombrar a los premiados, o repetir'],
  ['Inicio / Fin', 'Saltar al décimo o al primer lugar'],
  ['F11', 'Ocupar todo el monitor'],
  ['Esc', 'Salir de la pantalla grande'],
];

const PREMIOS = [
  ['Primer lugar', 'Serpentina dorada', 'from-amber-200 to-amber-400'],
  ['Segundo lugar', 'Serpentina plateada', 'from-slate-200 to-slate-400'],
  ['Tercer lugar', 'Serpentina de bronce', 'from-orange-200 to-orange-400'],
];

/** Lo que hay que saber antes de pararse delante del auditorio. */
function ComoSeManeja() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Tarjeta className="p-6">
        <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
          <Keyboard className="h-6 w-6 text-granate-600" />
          Cómo se maneja
        </h4>
        <p className="mt-1 text-base text-slate-600">
          La lámina abre vacía: los premiados salen al tocar <strong>Iniciar</strong>, uno detrás
          de otro. Si el acto va con retraso, el mismo botón los muestra todos de golpe.
        </p>
        <dl className="mt-5 space-y-2">
          {TECLAS.map(([tecla, hace]) => (
            <div key={tecla} className="flex items-center gap-4">
              <dt className="w-32 shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-center text-base font-bold text-slate-700">
                {tecla}
              </dt>
              <dd className="min-w-0 flex-1 text-base text-slate-600">{hace}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <Tarjeta className="p-6">
        <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
          <Sparkles className="h-6 w-6 text-granate-600" />
          El remate del podio
        </h4>
        <p className="mt-1 text-base text-slate-600">
          En los tres primeros lugares, cuando termina de nombrarse al último premiado, cae
          serpentina sobre toda la pantalla con el color del puesto.
        </p>
        <ul className="mt-5 space-y-2">
          {PREMIOS.map(([lugar, premio, degradado]) => (
            <li key={lugar} className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-3">
              <span className={`h-8 w-8 shrink-0 rounded-full bg-gradient-to-br ${degradado}`} />
              <span className="text-base font-bold text-slate-800">{lugar}</span>
              <span className="text-base text-slate-600">{premio}</span>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}

function Cifra({ icono: Icono, valor, texto }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-suave">
      <Icono className="h-7 w-7 text-granate-600" />
      <p className="mt-3 text-4xl font-black text-slate-900">{valor}</p>
      <p className="text-base text-slate-600">{texto}</p>
    </div>
  );
}

/** El guion del acto: las láminas en fila, para saltar a cualquiera. */
function Indice({ laminas, indice, ir }) {
  return (
    <Tarjeta className="p-6">
      <h4 className="text-xl font-black text-slate-900">Orden del acto</h4>
      <p className="mt-1 text-base text-slate-600">
        Del décimo lugar al primero, y al final el premio mayor. Toque cualquiera para abrirla.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {laminas.map((l, i) => (
          <button
            key={l.id}
            onClick={() => ir(i)}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-base font-semibold transition ${
              i === indice
                ? 'bg-granate-600 text-white'
                : 'bg-slate-50 text-slate-700 hover:bg-granate-50'
            }`}
          >
            <span className="min-w-0 flex-1">
              {l.titulo} · {l.ambitoTexto}
            </span>
            <span className={i === indice ? 'text-granate-100' : 'text-slate-400'}>
              {l.premiados}
            </span>
          </button>
        ))}
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------------------- el acto

function Acto({ datos, pedida, irA }) {
  const { laminas } = datos;
  const pedido = Math.max(
    0,
    laminas.findIndex((l) => l.id === pedida),
  );

  const [indice, setIndice] = useState(pedido);
  const [pantalla, setPantalla] = useState(false);
  const [velocidad] = useState(velocidadGuardada);
  const [mostradas, setMostradas] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [fiesta, setFiesta] = useState(false);
  const escenario = useRef(null);
  const reloj = useRef(null);
  const ultimoToque = useRef(0);

  const lamina = laminas[indice];
  const total = lamina.premiados;

  // El sidebar manda: si el administrador toca otra lámina en el menú, la
  // presentación salta ahí aunque esté a media proyección.
  useEffect(() => setIndice(pedido), [pedido]);

  /**
   * Moverse también mueve el sidebar: durante el acto se pasa con las
   * flechas, y al volver al panel el menú tiene que señalar lo que quedó en
   * pantalla y no lo último que se tocó con el ratón.
   */
  const ir = useCallback(
    (destino) => {
      const n = Math.min(laminas.length - 1, Math.max(0, destino));
      setIndice(n);
      irA?.(`final-pres-${laminas[n].id}`);
    },
    [laminas, irA],
  );

  // ------------------------------------------------------- nombrar uno a uno

  const detener = useCallback(() => {
    clearInterval(reloj.current);
    reloj.current = null;
    setCorriendo(false);
  }, []);

  /** Al cambiar de lámina se empieza de cero: nadie nombrado y sin serpentina. */
  useEffect(() => {
    detener();
    setMostradas(0);
    setFiesta(false);
  }, [lamina.id, detener]);

  useEffect(() => detener, [detener]);

  /**
   * El botón hace las tres cosas que hacen falta en el estrado: empezar,
   * soltarlos todos de golpe si el acto va con retraso, y repetir si alguien
   * pide ver otra vez el cuadro.
   */
  const reproducir = useCallback(() => {
    if (!total) return;

    // Dos toques seguidos son un resbalón, no una orden: el segundo borraría
    // la lista que el primero acaba de completar, y delante del auditorio eso
    // no tiene arreglo.
    const ahora = performance.now();
    if (ahora - ultimoToque.current < 400) return;
    ultimoToque.current = ahora;

    // La condición es la misma que decide la etiqueta del botón: si dice
    // «mostrarlos todos», tiene que mostrarlos todos. Mirar el reloj en vez
    // del estado dejaba la puerta abierta a que no coincidieran.
    if (corriendo) {
      detener();
      setMostradas(total);
      return;
    }

    setFiesta(false);
    setMostradas(0);
    setCorriendo(true);

    let n = 0;
    reloj.current = setInterval(() => {
      n += 1;
      setMostradas(n);
      if (n >= total) detener();
    }, velocidad);
  }, [total, velocidad, corriendo, detener]);

  // La serpentina entra cuando ya están todos nombrados, no antes: es el
  // remate del lugar, no un adorno de fondo.
  useEffect(() => {
    if (total > 0 && mostradas >= total && lamina.puesto <= PODIO) setFiesta(true);
  }, [mostradas, total, lamina.puesto]);

  const estado = corriendo ? 'corriendo' : mostradas >= total && total > 0 ? 'listo' : 'inicio';

  // ---------------------------------------------------------- pantalla grande

  /**
   * «Pantalla completa» son dos cosas a la vez.
   *
   * La lámina pasa a ocupar toda la ventana por CSS —eso funciona siempre,
   * también cuando el panel corre dentro de otra aplicación que no concede la
   * pantalla completa del navegador— y además se pide esa pantalla completa,
   * que es la que quita la barra de direcciones en el proyector. Si no la dan,
   * lo primero ya dejó la lámina sola delante del auditorio.
   */
  const abrirPantalla = () => {
    setPantalla(true);
    escenario.current?.requestFullscreen?.().catch(() => {});
  };

  const cerrarPantalla = useCallback(() => {
    setPantalla(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  const alternarPantalla = () => (pantalla ? cerrarPantalla() : abrirPantalla());

  // Salir de la pantalla completa del navegador saca también de la lámina: si
  // no, se quedaría tapando el panel sin que se entienda por qué.
  useEffect(() => {
    const ver = () => {
      if (!document.fullscreenElement) setPantalla(false);
    };
    document.addEventListener('fullscreenchange', ver);
    return () => document.removeEventListener('fullscreenchange', ver);
  }, []);

  // Mientras se proyecta, lo de detrás no se mueve.
  useEffect(() => {
    if (!pantalla) return undefined;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, [pantalla]);

  // Las teclas de siempre en una presentación. No se roban al que está
  // escribiendo en un campo, que aquí no los hay pero el panel sí.
  useEffect(() => {
    const tecla = (e) => {
      const campo = e.target?.tagName;
      if (campo === 'INPUT' || campo === 'TEXTAREA' || campo === 'SELECT') return;

      const teclas = {
        ArrowRight: () => ir(indice + 1),
        ArrowDown: () => ir(indice + 1),
        PageDown: () => ir(indice + 1),
        ' ': () => ir(indice + 1),
        ArrowLeft: () => ir(indice - 1),
        ArrowUp: () => ir(indice - 1),
        PageUp: () => ir(indice - 1),
        Home: () => ir(0),
        End: () => ir(laminas.length - 1),
        Enter: () => reproducir(),
        Escape: () => cerrarPantalla(),
      };
      if (teclas[e.key]) {
        e.preventDefault();
        teclas[e.key]();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [indice, ir, laminas.length, reproducir, cerrarPantalla]);

  return (
    <div
      ref={escenario}
      className={`overflow-hidden ${
        pantalla ? 'fixed inset-0 z-50' : 'relative aspect-[16/9] w-full rounded-3xl shadow-suave'
      }`}
    >
      <Escenario lamina={lamina} mostradas={mostradas} fiesta={fiesta} />

      {estado === 'inicio' && total > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={reproducir}
            className="pointer-events-auto inline-flex animate-latido items-center gap-4 rounded-full bg-granate-600 px-14 py-6 text-3xl font-black uppercase tracking-widest text-white shadow-suave transition hover:bg-granate-700"
          >
            <Play className="h-9 w-9" />
            Iniciar
          </button>
        </div>
      )}

      <Mando
        indice={indice}
        total={laminas.length}
        lamina={lamina}
        pantalla={pantalla}
        estado={estado}
        ir={ir}
        reproducir={reproducir}
        alternarPantalla={alternarPantalla}
      />
    </div>
  );
}

// --------------------------------------------------------------- el escenario

/**
 * El lienzo de la lámina.
 *
 * El ancho es fijo —1600— y el alto es el que pida el contenido, con 900 de
 * mínimo para que una lámina corta siga siendo un 16:9. Después se escala
 * entero a lo que haya: así una categoría de más o un nombre muy largo
 * encogen la lámina en vez de salirse por abajo, que es justo lo que no
 * puede pasar delante del auditorio.
 */
const ANCHO = 1600;
const ALTO = 900;

/**
 * El fondo: granate bebé pasando a naranja bebé.
 *
 * Es el color de la olimpiada rebajado hasta donde un proyector lo aguanta:
 * a pantalla completa un granate fuerte cansa la vista y se come el texto,
 * y en pastel el nombre del ganador se lee desde el fondo del auditorio.
 */
const FONDO =
  'linear-gradient(135deg, #FDF3F5 0%, #FBE4E8 26%, #F7D9D4 48%, #FFE6CE 76%, #FFD6AE 100%)';

function Escenario({ lamina, mostradas, fiesta }) {
  const caja = useRef(null);
  const lienzo = useRef(null);
  const [escala, setEscala] = useState(1);
  const [giro, setGiro] = useState({ x: 0, y: 0 });

  // La lámina se escala a lo que quepa, centrada: igual en el panel que a
  // pantalla completa, con las bandas del proyector si el alto no cuadra.
  useLayoutEffect(() => {
    const medir = () => {
      const r = caja.current?.getBoundingClientRect();
      // offsetHeight y no el rect: el rect ya viene con la escala aplicada y
      // medirse a sí mismo escalado no converge nunca.
      const alto = lienzo.current?.offsetHeight || ALTO;
      if (r?.width) setEscala(Math.min(r.width / ANCHO, r.height / alto));
    };
    medir();
    const observador = new ResizeObserver(medir);
    if (caja.current) observador.observe(caja.current);
    if (lienzo.current) observador.observe(lienzo.current);
    return () => observador.disconnect();
  }, []);

  /** El ratón inclina la escena; sin esto el 3D no se nota y parece una foto. */
  const seguir = (e) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    setGiro({
      x: (0.5 - (e.clientY - r.top) / r.height) * 9,
      y: ((e.clientX - r.left) / r.width - 0.5) * 12,
    });
  };

  return (
    <div
      ref={caja}
      onPointerMove={seguir}
      onPointerLeave={() => setGiro({ x: 0, y: 0 })}
      className="absolute inset-0 select-none"
      style={{ background: FONDO, perspective: '1800px' }}
    >
      <Resplandores />

      <div
        ref={lienzo}
        className="absolute left-1/2 top-1/2"
        style={{
          width: ANCHO,
          minHeight: ALTO,
          transform: `translate(-50%, -50%) scale(${escala}) rotateX(${giro.x}deg) rotateY(${giro.y}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 260ms ease-out',
        }}
      >
        <Lamina key={lamina.id} lamina={lamina} mostradas={mostradas} />
      </div>

      <Serpentina puesto={lamina.puesto} activa={fiesta} />
    </div>
  );
}

/** Dos manchas de color que respiran detrás de todo: dan profundidad al fondo. */
function Resplandores() {
  return (
    <>
      <div className="pointer-events-none absolute -left-40 -top-40 h-[42rem] w-[42rem] animate-respirar rounded-full bg-granate-200/60 blur-3xl" />
      <div
        className="pointer-events-none absolute -bottom-52 -right-32 h-[46rem] w-[46rem] animate-respirar rounded-full bg-orange-200/60 blur-3xl"
        style={{ animationDelay: '1.4s' }}
      />
    </>
  );
}

// ------------------------------------------------------------------ la lámina

/** Las columnas de la tabla, en un solo sitio: cabecera y filas no pueden bailar. */
const COLUMNAS = 'grid-cols-[15rem_minmax(0,1fr)_minmax(0,0.78fr)_9rem]';

/**
 * Y las del premio mayor, que premia a la delegación y no al alumno: lugar,
 * quién la lleva, de qué colegio, de qué modalidad y con cuántos puntos.
 */
const COLUMNAS_CAMPEONES = 'grid-cols-[16rem_minmax(0,1fr)_minmax(0,0.92fr)_14rem_9rem]';

function Lamina({ lamina, mostradas }) {
  const campeonato = lamina.tipo === 'campeones';
  const primero = lamina.puesto === 1 && !campeonato;

  // La tabla es una lista plana: en el estrado se nombra premiado por
  // premiado, no categoría por categoría, y un empate son dos renglones.
  const filas = campeonato
    ? lamina.campeones || []
    : lamina.categorias.flatMap((c) =>
        c.alumnos.map((a) => ({ ...a, categoria: c.categoria, grado: c.grado })),
      );

  return (
    <div
      className="flex min-h-[900px] w-full animate-giroEntrada flex-col px-20 pb-40 pt-14"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <header className="text-center" style={{ transform: 'translateZ(70px)' }}>
        <div className="flex items-center justify-center gap-4">
          {campeonato ? (
            <span className="inline-flex items-center gap-4 rounded-full bg-amber-400/90 px-10 py-3 text-[2.1rem] font-black uppercase tracking-[0.3em] text-amber-950 shadow-suave">
              <Crown className="h-10 w-10" />
              {lamina.ambitoTexto}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full bg-white/75 px-10 py-3 text-[2.1rem] font-black uppercase tracking-[0.3em] text-granate-700 shadow-suave backdrop-blur">
                {lamina.ambitoTexto}
              </span>
              {primero && (
                <span className="inline-flex items-center gap-3 rounded-full bg-amber-400/90 px-8 py-3 text-[2.1rem] font-black uppercase tracking-[0.3em] text-amber-950 shadow-suave">
                  <Crown className="h-9 w-9" />
                  Campeones
                </span>
              )}
            </>
          )}
        </div>

        <h1
          className={`mt-5 font-black leading-[0.95] tracking-tight text-granate-700 drop-shadow-sm ${
            campeonato ? 'text-[4.8rem]' : 'text-[5.4rem]'
          }`}
        >
          {lamina.titulo}
        </h1>
        <p className="mt-2 text-3xl font-bold uppercase tracking-[0.3em] text-granate-500">
          {lamina.subtitulo}
        </p>
        {campeonato && (
          <p className="mx-auto mt-4 max-w-5xl text-2xl font-medium text-granate-600">
            {lamina.detalle}
          </p>
        )}
      </header>

      {filas.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p
            className="rounded-3xl bg-white/70 px-14 py-10 text-4xl font-semibold text-granate-700 shadow-suave backdrop-blur"
            style={{ transform: 'translateZ(50px)' }}
          >
            {campeonato
              ? 'Todavía no hay delegaciones con puntos.'
              : 'Este lugar todavía no tiene a nadie.'}
          </p>
        </div>
      ) : (
        <div className="mt-9 flex-1" style={{ transformStyle: 'preserve-3d' }}>
          <div
            className={`grid ${campeonato ? COLUMNAS_CAMPEONES : COLUMNAS} items-end gap-7 px-9 pb-3 text-xl font-bold uppercase tracking-[0.2em] text-granate-500`}
            style={{ transform: 'translateZ(40px)' }}
          >
            {campeonato ? (
              <>
                <span>Lugar</span>
                <span>Tutor de la delegación</span>
                <span>Institución educativa</span>
                <span>Modalidad</span>
                <span className="text-right">Puntos</span>
              </>
            ) : (
              <>
                <span>Categoría</span>
                <span>Estudiante</span>
                <span>Institución educativa</span>
                <span className="text-right">Puntaje</span>
              </>
            )}
          </div>

          <div className="space-y-3" style={{ transformStyle: 'preserve-3d' }}>
            {filas.map((f, i) =>
              campeonato ? (
                <FilaCampeon key={f.puesto} campeon={f} visible={i < mostradas} />
              ) : (
                <Fila key={`${f.categoria}-${f.dni}`} fila={f} visible={i < mostradas} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** El metal de cada lugar del campeonato, para que se reconozca de lejos. */
const METAL = {
  1: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950',
  2: 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800',
  3: 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950',
};

/**
 * Una delegación campeona: su lugar, su tutor, su colegio y su modalidad.
 *
 * El nombre del tutor va grande y el del colegio debajo en la misma fila
 * porque el premio es de los dos, pero al estrado sube una persona y es a
 * quien se llama por el micrófono.
 */
function FilaCampeon({ campeon, visible }) {
  return (
    <div
      className={`grid ${COLUMNAS_CAMPEONES} items-center gap-7 rounded-[1.75rem] border border-white/80 bg-white/75 px-9 py-6 shadow-suave backdrop-blur ${
        visible ? 'animate-entrarFila' : 'opacity-0'
      }`}
    >
      <div className="flex items-center gap-4">
        <span
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-black shadow-suave ${
            METAL[campeon.puesto] || 'bg-granate-600 text-white'
          }`}
        >
          {campeon.puesto}
        </span>
        <span className="text-xl font-bold uppercase leading-tight tracking-widest text-granate-600">
          {campeon.ordinal}
        </span>
      </div>

      <p className="text-[2rem] font-black uppercase leading-[1.05] text-slate-900">
        {campeon.tutor}
        {campeon.empatado && (
          <span className="ml-4 align-middle text-xl font-bold uppercase tracking-widest text-amber-600">
            empate
          </span>
        )}
      </p>

      <p className="text-xl font-semibold leading-tight text-slate-700">{campeon.institucion}</p>

      <p className="text-xl font-bold uppercase leading-tight tracking-wide text-granate-600">
        {campeon.modalidadTexto}
      </p>

      <p className="text-right text-[2rem] font-black leading-none text-granate-600">
        {campeon.puntos}
        <span className="ml-2 text-lg font-bold uppercase tracking-widest text-granate-400">
          pts
        </span>
      </p>
    </div>
  );
}

/**
 * Un premiado: categoría, nombre, colegio y puntaje.
 *
 * Nada más. En el estrado se lee en voz alta lo que está en la pantalla, y
 * cada dato de adorno es un dato que alguien va a leer por equivocación.
 *
 * Mientras no le toca, el renglón está ahí pero invisible: así la tabla no
 * crece de golpe en golpe y la lámina no se reescala en mitad del anuncio.
 */
function Fila({ fila, visible }) {
  return (
    <div
      className={`grid ${COLUMNAS} items-center gap-7 rounded-[1.75rem] border border-white/80 bg-white/75 px-9 py-5 shadow-suave backdrop-blur ${
        visible ? 'animate-entrarFila' : 'opacity-0'
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-granate-600 text-3xl font-black text-white">
          {fila.categoria}
        </span>
        <span className="text-xl font-semibold leading-tight text-slate-700">{fila.grado}</span>
      </div>

      <p className="text-[2rem] font-black uppercase leading-[1.05] text-slate-900">
        {fila.nombres}
        {fila.empatado && (
          <span className="ml-4 align-middle text-xl font-bold uppercase tracking-widest text-amber-600">
            empate
          </span>
        )}
      </p>

      <p className="text-xl font-medium leading-tight text-slate-600">{fila.institucion}</p>

      <p className="text-right text-[2rem] font-black leading-none text-granate-600">
        {fila.puntaje}
        <span className="ml-2 text-lg font-bold uppercase tracking-widest text-granate-400">
          pts
        </span>
      </p>
    </div>
  );
}

// --------------------------------------------------------------- la serpentina

/**
 * El color de cada lugar del podio. Oro, plata y bronce: el premio se
 * reconoce por el color antes de que nadie lea el titular.
 */
const COLORES_PODIO = {
  1: ['#F7C948', '#FFE08A', '#D9A404', '#FFF4D0', '#C08A00'],
  2: ['#C8CED8', '#EDF1F6', '#9AA3AF', '#FFFFFF', '#7C8695'],
  3: ['#CD7F32', '#E8A86B', '#9C5A1E', '#F3D3B0', '#B06C2A'],
};

const DURACION = 5200;
const APAGADO = 1400;

/**
 * Serpentina sobre toda la pantalla cuando se termina de nombrar al podio.
 *
 * Va en un canvas y no en elementos del DOM: son trescientas cintas
 * girando a la vez y con divs el navegador del proyector se arrodilla.
 * Dos cañones desde las esquinas de abajo y una lluvia desde arriba, que es
 * como cae de verdad.
 */
function Serpentina({ puesto, activa }) {
  const tela = useRef(null);

  useEffect(() => {
    const paleta = COLORES_PODIO[puesto];
    const canvas = tela.current;
    if (!activa || !paleta || !canvas) return undefined;

    const ancho = canvas.offsetWidth;
    const alto = canvas.offsetHeight;
    if (!ancho || !alto) return undefined;

    const ctx = canvas.getContext('2d');
    const nitidez = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = ancho * nitidez;
    canvas.height = alto * nitidez;
    ctx.scale(nitidez, nitidez);

    const azar = (a, b) => a + Math.random() * (b - a);
    const cintas = [];
    const soltar = (x, y, vx, vy, cuantas) => {
      for (let i = 0; i < cuantas; i++) {
        cintas.push({
          x: x + azar(-40, 40),
          y: y + azar(-30, 30),
          vx: vx + azar(-2.6, 2.6),
          vy: vy + azar(-3, 3),
          giro: azar(0, Math.PI * 2),
          vGiro: azar(-0.24, 0.24),
          largo: azar(18, 46),
          grueso: azar(5, 13),
          fase: azar(0, Math.PI * 2),
          color: paleta[Math.floor(Math.random() * paleta.length)],
        });
      }
    };

    soltar(0, alto, 8, -14, 80);
    soltar(ancho, alto, -8, -14, 80);
    soltar(ancho / 2, -40, 0, 2, 60);
    for (let i = 0; i < 60; i++) soltar(azar(0, ancho), azar(-alto, -40), 0, azar(1, 3.5), 1);

    const arranque = performance.now();
    let cuadro;

    const pintar = (ahora) => {
      const t = ahora - arranque;
      ctx.clearRect(0, 0, ancho, alto);
      if (t > DURACION) return;

      const opacidad = t > DURACION - APAGADO ? (DURACION - t) / APAGADO : 1;

      for (const c of cintas) {
        c.vy += 0.2; // gravedad
        c.vx *= 0.992; // y el aire, que frena
        c.vy *= 0.994;
        c.fase += 0.15;
        c.x += c.vx + Math.sin(c.fase) * 1.5;
        c.y += c.vy;
        c.giro += c.vGiro;

        ctx.save();
        ctx.globalAlpha = opacidad;
        ctx.translate(c.x, c.y);
        ctx.rotate(c.giro);
        // El pliegue: la cinta se encoge y se estira al voltearse, que es lo
        // que la distingue de un confeti cuadrado cayendo.
        ctx.scale(1, Math.max(0.12, Math.abs(Math.cos(c.fase))));
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.grueso / 2, -c.largo / 2, c.grueso, c.largo);
        ctx.restore();
      }

      cuadro = requestAnimationFrame(pintar);
    };

    cuadro = requestAnimationFrame(pintar);
    return () => {
      cancelAnimationFrame(cuadro);
      ctx.clearRect(0, 0, ancho, alto);
    };
  }, [activa, puesto]);

  if (!COLORES_PODIO[puesto]) return null;
  return <canvas ref={tela} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

// ------------------------------------------------------------------- el mando

const REPRODUCCION = {
  inicio: { icono: Play, etiqueta: 'Iniciar' },
  corriendo: { icono: FastForward, etiqueta: 'Mostrarlos todos' },
  listo: { icono: RotateCcw, etiqueta: 'Repetir' },
};

/**
 * Los controles. A pantalla completa se esconden solos a los tres segundos:
 * lo que tiene que quedar delante del auditorio es la lámina, no las flechas.
 */
function Mando({ indice, total, lamina, pantalla, estado, ir, reproducir, alternarPantalla }) {
  const [visible, setVisible] = useState(true);
  const { icono: IconoPlay, etiqueta } = REPRODUCCION[estado];

  useEffect(() => {
    if (!pantalla) {
      setVisible(true);
      return undefined;
    }
    let reloj;
    const despertar = () => {
      setVisible(true);
      clearTimeout(reloj);
      reloj = setTimeout(() => setVisible(false), 3000);
    };
    despertar();
    window.addEventListener('pointermove', despertar);
    window.addEventListener('keydown', despertar);
    return () => {
      clearTimeout(reloj);
      window.removeEventListener('pointermove', despertar);
      window.removeEventListener('keydown', despertar);
    };
  }, [pantalla]);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-5 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-white/80 p-2 pr-5 shadow-suave backdrop-blur">
        <BotonRedondo
          etiqueta="Lámina anterior"
          onClick={() => ir(indice - 1)}
          disabled={indice === 0}
        >
          <ChevronLeft className="h-6 w-6" />
        </BotonRedondo>
        <BotonRedondo
          etiqueta="Lámina siguiente"
          onClick={() => ir(indice + 1)}
          disabled={indice === total - 1}
        >
          <ChevronRight className="h-6 w-6" />
        </BotonRedondo>

        <BotonRedondo etiqueta={etiqueta} onClick={reproducir} disabled={!lamina.premiados} destacado>
          <IconoPlay className="h-6 w-6" />
        </BotonRedondo>

        <span className="whitespace-nowrap pl-2 text-base font-semibold text-granate-700">
          {indice + 1} de {total} · {lamina.titulo} · {lamina.ambitoTexto}
        </span>
        {pantalla && (
          <span className="hidden whitespace-nowrap border-l border-granate-200 pl-5 text-base text-granate-500 xl:inline">
            Flechas para pasar · Enter para nombrar · F11 para todo el monitor · Esc para salir
          </span>
        )}
        <BotonRedondo etiqueta="Pantalla completa" onClick={alternarPantalla}>
          {pantalla ? <Minimize2 className="h-6 w-6" /> : <Maximize2 className="h-6 w-6" />}
        </BotonRedondo>
      </div>
    </div>
  );
}

// ----------------------------------------------- el sustento del premio mayor

/**
 * Por qué son campeones de campeones.
 *
 * La lámina del acto dice quiénes son y se pasa en veinte segundos; esto es
 * lo que hay que tener abierto cuando un tutor venga a preguntar por qué no
 * fue él: la escala, la tabla entera y, delegación por delegación, qué alumno
 * sumó cuánto. Nada está guardado, así que corregir una clave lo arrastra.
 */
function Sustento() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/final/resultados/campeones')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo armar el campeonato')));
  }, []);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Sumando los puntos de cada delegación" />;

  const { resumen } = datos;

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <Crown className="h-9 w-9 text-amber-500" />
          Campeones de campeones
        </h3>
        <p className="mt-2 max-w-4xl text-xl text-slate-600">
          El premio mayor no es de un alumno sino de la delegación: suma cada uno de sus
          estudiantes que entró entre los {datos.puestosQueSuman} primeros de su categoría. Por eso
          lo gana quien reparte premiados en muchas categorías y no quien trajo una sola estrella.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra icono={School} valor={resumen.delegaciones} texto="Delegaciones en la final" />
          <Cifra icono={Trophy} valor={resumen.conPuntos} texto="Con alguien entre los diez" />
          <Cifra icono={Layers} valor={resumen.categorias} texto="Categorías con alumnos" />
          <Cifra icono={Users} valor={resumen.rindieron} texto="Rindieron la final" />
        </div>

        {resumen.salonesPendientes > 0 && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto titulo="Todavía faltan actas">
              Quedan {resumen.salonesPendientes} salón(es) por entregar. Un puesto que se mueva
              cambia los puntos, así que esto no es definitivo hasta que lleguen todas.
            </Aviso>
          </div>
        )}
      </Tarjeta>

      <ComoSeGana escala={datos.escala} puestos={datos.puestosQueSuman} />

      {datos.podio.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {datos.podio.map((c) => (
            <TarjetaCampeon key={c.tutorId} campeon={c} />
          ))}
        </div>
      )}

      <TablaCampeonato tabla={datos.tabla} />
    </div>
  );
}

/** La escala de puntos y el criterio, escritos para poder leerlos en voz alta. */
function ComoSeGana({ escala, puestos }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Tarjeta className="p-6">
        <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
          <Medal className="h-6 w-6 text-granate-600" />
          Lo que vale cada puesto
        </h4>
        <p className="mt-1 text-base text-slate-600">
          Por cada alumno que quedó entre los {puestos} primeros de su categoría. Más abajo del
          décimo no suma nada.
        </p>
        <ul className="mt-5 space-y-2">
          {escala.map((e) => (
            <li
              key={e.texto}
              className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
            >
              <span className="text-base font-bold text-slate-800">{e.texto}</span>
              <span className="text-xl font-black text-granate-600">
                {e.puntos}
                <span className="ml-1 text-sm font-bold uppercase tracking-widest text-granate-400">
                  pts
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta className="p-6">
        <h4 className="flex items-center gap-3 text-xl font-black text-slate-900">
          <ClipboardList className="h-6 w-6 text-granate-600" />
          Cómo se desempata
        </h4>
        <p className="mt-1 text-base text-slate-600">
          En este orden, y nada más. Si dos delegaciones coinciden en los cinco, comparten el
          lugar: el día del acto no se inventa un desempate que nadie acordó.
        </p>
        <ol className="mt-5 space-y-2">
          {[
            'Los puntos sumados',
            'En cuántas categorías distintas puntuó',
            'Cuántos primeros puestos trajo',
            'Cuántos segundos',
            'Cuántos terceros',
          ].map((texto, i) => (
            <li key={texto} className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-granate-600 text-base font-black text-white">
                {i + 1}
              </span>
              <span className="text-base font-semibold text-slate-700">{texto}</span>
            </li>
          ))}
        </ol>
      </Tarjeta>
    </div>
  );
}

const BORDE_METAL = {
  1: 'border-amber-300 bg-amber-50',
  2: 'border-slate-300 bg-slate-50',
  3: 'border-orange-300 bg-orange-50',
};

/** Uno de los tres campeones, con el detalle de dónde salieron sus puntos. */
function TarjetaCampeon({ campeon }) {
  return (
    <div
      className={`rounded-3xl border-2 p-6 shadow-suave ${
        BORDE_METAL[campeon.puesto] || 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-black ${
            METAL[campeon.puesto] || 'bg-granate-600 text-white'
          }`}
        >
          {campeon.puesto}
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold uppercase tracking-widest text-granate-600">
            {campeon.puesto === 1 ? 'Campeón de campeones' : `${campeon.puesto}° lugar`}
          </p>
          <p className="text-base text-slate-500">{campeon.modalidadTexto}</p>
        </div>
      </div>

      <p className="mt-4 text-2xl font-black uppercase leading-tight text-slate-900">
        {campeon.tutor || 'Sin tutor registrado'}
      </p>
      <p className="text-lg font-semibold leading-tight text-slate-600">{campeon.institucion}</p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Dato valor={campeon.puntos} texto="Puntos" />
        <Dato valor={campeon.categorias} texto="Categorías" />
        <Dato valor={campeon.premiados} texto="Premiados" />
      </div>

      <ul className="mt-5 space-y-1.5">
        {campeon.alumnos.map((a) => (
          <li
            key={`${a.categoria}-${a.dni}`}
            className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-granate-600 text-base font-black text-white">
              {a.categoria}
            </span>
            <span className="min-w-0 flex-1 truncate text-base font-semibold uppercase text-slate-800">
              {a.nombres}
            </span>
            <span className="shrink-0 text-base text-slate-500">{a.puesto}°</span>
            <span className="shrink-0 text-base font-black text-granate-600">+{a.puntos}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dato({ valor, texto }) {
  return (
    <div className="rounded-xl bg-white/80 p-2 text-center">
      <p className="text-2xl font-black text-slate-900">{valor}</p>
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{texto}</p>
    </div>
  );
}

/**
 * El campeonato completo, con el sustento de cada delegación a un toque.
 *
 * Están todas las que sumaron algo, no solo las tres premiadas: la pregunta
 * que se repite después del acto es «¿y nosotros en qué quedamos?».
 */
function TablaCampeonato({ tabla }) {
  const [abierta, setAbierta] = useState(null);

  if (tabla.length === 0) {
    return (
      <Tarjeta className="p-6">
        <p className="text-base text-slate-500">
          Todavía ninguna delegación tiene alumnos entre los diez primeros de su categoría.
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="p-6">
      <h4 className="flex items-center gap-3 text-2xl font-black text-slate-900">
        <Trophy className="h-7 w-7 text-granate-600" />
        El campeonato completo
      </h4>
      <p className="mt-1 text-base text-slate-600">
        Todas las delegaciones que sumaron puntos. Toque una para ver qué alumno le dio cada
        punto.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-slate-200">
              {['#', 'Tutor de la delegación', 'Institución educativa', 'Modalidad', 'Cat.', 'Premiados', 'Puntos'].map(
                (t) => (
                  <th
                    key={t}
                    className="pb-2 pr-4 text-base font-bold uppercase tracking-widest text-granate-500"
                  >
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tabla.map((d) => {
              const desplegada = abierta === d.tutorId;
              return [
                <tr
                  key={d.tutorId}
                  onClick={() => setAbierta(desplegada ? null : d.tutorId)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-granate-50"
                >
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex h-11 w-11 flex-col items-center justify-center rounded-xl text-base font-black ${
                        METAL[d.puesto] || 'bg-granate-50 text-granate-800'
                      }`}
                      title={d.empatado ? 'Comparte el lugar' : undefined}
                    >
                      {d.puesto}
                      {d.empatado && (
                        <span className="text-[0.6rem] font-bold uppercase">emp.</span>
                      )}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-lg font-bold uppercase text-slate-900">
                    {d.tutor || 'Sin tutor registrado'}
                  </td>
                  <td className="py-3 pr-4 text-base text-slate-600">{d.institucion}</td>
                  <td className="py-3 pr-4 text-base font-semibold text-slate-700">
                    {d.modalidadTexto}
                  </td>
                  <td className="py-3 pr-4 text-base font-semibold text-slate-700">
                    {d.categorias}
                  </td>
                  <td className="py-3 pr-4 text-base text-slate-600">
                    {d.premiados} de {d.rindieron}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2 text-xl font-black text-granate-600">
                      {d.puntos}
                      <ChevronDown
                        className={`h-5 w-5 text-slate-400 transition ${
                          desplegada ? 'rotate-180' : ''
                        }`}
                      />
                    </span>
                  </td>
                </tr>,
                desplegada && (
                  <tr key={`${d.tutorId}-detalle`} className="border-b border-slate-100">
                    <td colSpan={7} className="bg-slate-50 px-4 py-4">
                      <p className="text-base font-bold uppercase tracking-widest text-granate-500">
                        De dónde salen sus {d.puntos} puntos
                      </p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {d.alumnos.map((a) => (
                          <div
                            key={`${a.categoria}-${a.dni}`}
                            className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-suave"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-granate-600 text-base font-black text-white">
                              {a.categoria}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-bold uppercase text-slate-800">
                                {a.nombres}
                              </p>
                              <p className="text-sm text-slate-500">
                                {a.grado} · {a.puesto}° puesto · {a.puntaje} de puntaje
                                {a.empatado ? ' · empate' : ''}
                              </p>
                            </div>
                            <span className="shrink-0 text-lg font-black text-granate-600">
                              +{a.puntos}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

// ------------------------------------------------------- resultados en Excel

/**
 * Presentación · Resultados en Excel.
 *
 * Lo que se reparte cuando el acto termina: el orden completo de cada
 * categoría, separado en públicos y privados, que es como se premia. Aquí no
 * se proyecta nada; esta pantalla solo descarga.
 *
 * El índice de arriba no es un resultado más: dice cuántas hojas trae el
 * archivo y con cuánta gente dentro, para que quien lo baja sepa de antemano
 * si está completo antes de mandarlo por correo a los colegios.
 */
function Descargas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState('');

  useEffect(() => {
    api
      .get('/final/resultados/ambitos')
      .then(({ data }) => setDatos(data))
      .catch((e) => setError(mensajeError(e, 'No se pudo armar el cuadro')));
  }, []);

  if (error && !datos) {
    return (
      <Aviso tipo="error" icono={AlertCircle}>
        {error}
      </Aviso>
    );
  }
  if (!datos) return <Cargando texto="Contando los resultados de cada categoría" />;

  const bajar = async (ambito) => {
    setError('');
    setBajando(ambito || 'todo');
    try {
      await descargar(`/final/resultados/excel-ambitos${ambito ? `?ambito=${ambito}` : ''}`);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo descargar'));
    } finally {
      setBajando('');
    }
  };

  const { resumen } = datos;

  if (resumen.rindieron === 0) {
    return (
      <Tarjeta>
        <h3 className="text-3xl font-black text-slate-900">Resultados en Excel</h3>
        <div className="mt-6">
          <Aviso tipo="info" icono={AlertCircle} compacto>
            Todavía no hay respuestas de la final. En cuanto los responsables suban las actas de
            sus salones, el archivo se puede descargar desde aquí.
          </Aviso>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-6">
      <Tarjeta>
        <h3 className="flex items-center gap-3 text-3xl font-black text-slate-900">
          <FileSpreadsheet className="h-9 w-9 text-excel-600" />
          Resultados en Excel
        </h3>
        <p className="mt-2 max-w-4xl text-xl text-slate-600">
          Todo el orden de la final por categoría y por modalidad: una hoja por cada categoría
          dentro de los públicos y otra dentro de los privados —los grupos de estudio van con los
          privados—, más una hoja con todos para filtrar a mano. Cada fila lleva su puesto en su
          ámbito y el puesto que se nombró en el acto, para que los dos números se puedan leer sin
          confundirlos.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Cifra icono={Users} valor={resumen.rindieron} texto="Rindieron la final" />
          <Cifra icono={Layers} valor={resumen.hojas} texto="Hojas trae el archivo completo" />
          <Cifra icono={Medal} valor={datos.puestos} texto="Puestos se premian por categoría" />
        </div>

        {resumen.salonesPendientes > 0 && (
          <div className="mt-6">
            <Aviso tipo="alerta" icono={AlertCircle} compacto titulo="Todavía faltan actas">
              Quedan {resumen.salonesPendientes} salón(es) por entregar. Lo que se baje ahora
              puede cambiar cuando lleguen, así que conviene esperar antes de repartirlo.
            </Aviso>
          </div>
        )}

        {error && (
          <div className="mt-5">
            <Aviso tipo="error" icono={AlertCircle} compacto>
              {error}
            </Aviso>
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-4">
          <Boton variante="excel" onClick={() => bajar('')} cargando={bajando === 'todo'}>
            <FileSpreadsheet className="h-6 w-6" />
            Todo · por categoría y modalidad
          </Boton>
          <Boton
            variante="excelContorno"
            onClick={() => bajar('PUBLICO')}
            cargando={bajando === 'PUBLICO'}
          >
            <Landmark className="h-6 w-6" />
            Solo los públicos
          </Boton>
          <Boton
            variante="excelContorno"
            onClick={() => bajar('PRIVADO')}
            cargando={bajando === 'PRIVADO'}
          >
            <Building2 className="h-6 w-6" />
            Solo los privados
          </Boton>
        </div>
      </Tarjeta>

      <div className="grid gap-6 lg:grid-cols-2">
        {datos.ambitos.map((a) => (
          <HojasDelAmbito key={a.id} ambito={a} />
        ))}
      </div>
    </div>
  );
}

/** Lo que trae el archivo de un ámbito, categoría por categoría. */
function HojasDelAmbito({ ambito }) {
  const Icono = ambito.id === 'PUBLICO' ? Landmark : Building2;

  return (
    <Tarjeta className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icono className="h-7 w-7 shrink-0 text-granate-600" />
          <div>
            <h4 className="text-xl font-black text-slate-900">{ambito.texto}</h4>
            <p className="mt-1 text-base text-slate-600">{ambito.detalle}</p>
          </div>
        </div>
        <span className="shrink-0 text-2xl font-black text-granate-700">{ambito.total}</span>
      </div>

      {ambito.categorias.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-base text-slate-600">
          Nadie de este ámbito rindió la final.
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border-2 border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr className="text-base text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Hoja</th>
                <th className="px-4 py-2.5 font-semibold">Grado</th>
                <th className="px-4 py-2.5 text-center font-semibold">Estudiantes</th>
                <th className="px-4 py-2.5 text-center font-semibold">Mejor puntaje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ambito.categorias.map((c) => (
                <tr key={c.categoria}>
                  <td className="px-4 py-2.5 text-base font-black text-granate-700">
                    CAT. {c.categoria}
                  </td>
                  <td className="px-4 py-2.5 text-base text-slate-600">{c.grado}</td>
                  <td className="px-4 py-2.5 text-center text-base font-bold text-slate-900">
                    {c.total}
                  </td>
                  <td className="px-4 py-2.5 text-center text-base font-bold text-granate-700">
                    {c.mejor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

function BotonRedondo({ children, etiqueta, destacado = false, ...props }) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition disabled:opacity-40 ${
        destacado
          ? 'bg-granate-600 text-white hover:bg-granate-700'
          : 'bg-white text-granate-700 hover:bg-granate-100'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
