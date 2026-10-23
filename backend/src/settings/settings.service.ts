import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/** Datos de la cuenta del BCP, la otra forma de pago además de Yape. */
const CLAVES_BCP = {
  titular: 'bcp_titular',
  cuenta: 'bcp_cuenta',
  cci: 'bcp_cci',
} as const;
/**
 * Botón flotante de WhatsApp de la portada. El número va en formato
 * internacional sin signos (51 + celular) porque así lo pide wa.me.
 */
const CLAVES_WHATSAPP = {
  numero: 'whatsapp_numero',
  mensaje: 'whatsapp_mensaje',
} as const;

/** Lo que se muestra mientras la comisión no configure el suyo. */
const WHATSAPP_POR_DEFECTO = {
  numero: '51928853577',
  mensaje: 'Hola, quiero información sobre el I OMASUR UNI 2026',
};

/** Titular y número de la cuenta Yape, que se muestran junto al QR. */
const CLAVES_YAPE = {
  numero: 'yape_numero',
  titular: 'yape_titular',
} as const;

/** Los que trae el sistema hasta que la comisión los cambie. */
const YAPE_POR_DEFECTO = {
  numero: '928 853 577',
  titular: 'Jhon Arnaldo Mamani Coaquira',
};

/**
 * El comunicado que se abre sobre la portada. Una sola fila con su JSON: es un
 * registro que se lee y se escribe entero.
 */
const CLAVE_COMUNICADO = 'comunicado';

export const ESTILOS_COMUNICADO = ['AVISO', 'IMPORTANTE', 'CELEBRACION', 'SOBRIO'] as const;
export type EstiloComunicado = (typeof ESTILOS_COMUNICADO)[number];

export interface Comunicado {
  titulo: string;
  descripcion: string;
  firma: string;
  estilo: EstiloComunicado;
  publicado: boolean;
  /** Cambia en cada guardado: con él, a quien ya lo cerró se le vuelve a abrir. */
  actualizado: string;
}

const COMUNICADO_VACIO: Comunicado = {
  titulo: '',
  descripcion: '',
  firma: 'Atte.: Comisión Organizadora',
  estilo: 'AVISO',
  publicado: false,
  actualizado: '',
};

const LARGOS_COMUNICADO = { titulo: 90, descripcion: 1200, firma: 80 };

export const CLAVE_CIERRE = 'inscripciones_cerradas';
const CLAVE_CIERRE_FECHA = 'inscripciones_cerradas_en';

/**
 * Archivos que sube la comisión: los dos fondos, el QR de Yape y las bases.
 *
 * Todos viven en Cloudflare. En la base solo queda la referencia interna del
 * archivo; al navegador se le manda la dirección de la API, que es fija y no
 * cambia aunque se reemplace el archivo. Así el bucket sigue cerrado y nadie
 * ve la clave real, que está junto a los comprobantes.
 */
const ARCHIVOS = {
  hero: {
    clave: 'imagen_hero',
    carpeta: 'publico/fondos',
    url: '/api/ajustes/imagenes/hero',
    formato: 'imagen',
  },
  login: {
    clave: 'imagen_login',
    carpeta: 'publico/fondos',
    url: '/api/ajustes/imagenes/login',
    formato: 'imagen',
  },
  yape: {
    clave: 'yape_qr',
    carpeta: 'publico/yape',
    url: '/api/ajustes/yape',
    formato: 'imagen',
  },
  bases: {
    clave: 'bases_archivo',
    carpeta: 'publico/bases',
    url: '/api/ajustes/bases',
    formato: 'pdf',
  },
  // Va impreso en la credencial, a la derecha de la cabecera.
  credencial: {
    clave: 'credencial_logo',
    carpeta: 'publico/credencial',
    url: '/api/ajustes/credencial',
    formato: 'imagen',
  },
  // El tutorial que se le ofrece al tutor al abrirle el envío del examen.
  tutorial: {
    clave: 'tutorial_examen',
    carpeta: 'publico/tutorial',
    url: '/api/ajustes/tutorial',
    formato: 'video',
  },
} as const;

export type ArchivoAdministrado = keyof typeof ARCHIVOS;
/** Los dos fondos, que el panel administra juntos. */
export type TipoImagen = 'hero' | 'login';

type Formato = 'imagen' | 'pdf' | 'video';

const MAXIMOS: Record<Formato, number> = {
  imagen: 8 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

const POR_DEFECTO: Record<Formato, string> = {
  imagen: 'imagen.jpg',
  pdf: 'bases.pdf',
  video: 'tutorial.mp4',
};

/** Sufijos con los que se guardan los datos de cada archivo. */
const DATOS = ['_nombre', '_mime', '_tamano', '_actualizado'];

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private almacenamiento: StorageService,
  ) {}

  /** Lo que necesita la web pública: grupos, QR, imágenes y si la inscripción sigue abierta. */
  async publicos() {
    const [
      grupos,
      cierre,
      fecha,
      titular,
      cuenta,
      cci,
      waNumero,
      waMensaje,
      yapeNumero,
      yapeTitular,
      hero,
      login,
      yape,
      bases,
      logoCredencial,
      tutorial,
      comunicado,
    ] = await Promise.all([
      this.prisma.grupoWhatsapp.findMany({ orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVE_CIERRE } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVE_CIERRE_FECHA } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVES_BCP.titular } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVES_BCP.cuenta } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVES_BCP.cci } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVES_WHATSAPP.numero } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVES_WHATSAPP.mensaje } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVES_YAPE.numero } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVES_YAPE.titular } }),
      this.datosArchivo('hero'),
      this.datosArchivo('login'),
      this.datosArchivo('yape'),
      this.datosArchivo('bases'),
      this.datosArchivo('credencial'),
      this.datosArchivo('tutorial'),
      this.comunicado(),
    ]);

    return {
      grupos,
      bcp: {
        titular: titular?.valor || '',
        cuenta: cuenta?.valor || '',
        cci: cci?.valor || '',
      },
      whatsapp: {
        numero: waNumero?.valor || WHATSAPP_POR_DEFECTO.numero,
        mensaje: waMensaje?.valor || WHATSAPP_POR_DEFECTO.mensaje,
      },
      inscripcionesCerradas: cierre?.valor === 'true',
      cerradasEn: cierre?.valor === 'true' ? fecha?.valor || null : null,
      // Los fondos y el QR viajan como una sola dirección, que es lo único que
      // la portada necesita. El panel además recibe el detalle completo.
      imagenHero: hero?.url || null,
      imagenLogin: login?.url || null,
      yapeQr: yape?.url || null,
      yape: {
        numero: yapeNumero?.valor || YAPE_POR_DEFECTO.numero,
        titular: yapeTitular?.valor || YAPE_POR_DEFECTO.titular,
      },
      archivos: { hero, login, yape, bases, credencial: logoCredencial, tutorial },
      // El botón «Ver tutorial» del aviso del examen solo aparece si hay video.
      tutorialExamen: tutorial?.url || null,
      // Solo si está publicado: un borrador no tiene por qué salir al público.
      comunicado: comunicado.publicado && comunicado.titulo ? comunicado : null,
      bases,
    };
  }

  // --------------------------------------------------------------------
  // Archivos administrados
  // --------------------------------------------------------------------

  /**
   * Sube o reemplaza uno de los archivos. Si ya había uno, el anterior se
   * borra de Cloudflare para que no se acumulen versiones sueltas.
   */
  async guardarArchivo(tipo: ArchivoAdministrado, archivo: Express.Multer.File) {
    const conf = ARCHIVOS[tipo];
    if (!archivo) throw new BadRequestException('Debe adjuntar el archivo');

    const maximo = MAXIMOS[conf.formato];
    if (archivo.size > maximo) {
      const pesa = Math.ceil(archivo.size / 1024 / 1024);
      throw new BadRequestException(
        `El archivo pesa ${pesa} MB y el máximo es ${maximo / 1024 / 1024} MB`,
      );
    }
    this.validarContenido(conf.formato, archivo);

    const anterior = await this.prisma.ajuste.findUnique({ where: { clave: conf.clave } });
    const referencia = await this.almacenamiento.guardar(archivo, conf.carpeta);

    await Promise.all([
      this.guardar(conf.clave, referencia),
      this.guardar(conf.clave + '_nombre', this.nombreLimpio(archivo.originalname, conf.formato)),
      this.guardar(conf.clave + '_mime', archivo.mimetype || ''),
      this.guardar(conf.clave + '_tamano', String(archivo.size)),
      this.guardar(conf.clave + '_actualizado', new Date().toISOString()),
    ]);

    // El viejo se borra recién cuando el nuevo ya quedó registrado: si la
    // subida falla, el que estaba publicado sigue en pie.
    if (anterior?.valor && anterior.valor !== referencia) {
      await this.almacenamiento.eliminar(anterior.valor);
    }

    return this.datosArchivo(tipo);
  }

  /** Quita el archivo de Cloudflare y de la base. */
  async quitarArchivo(tipo: ArchivoAdministrado) {
    const conf = ARCHIVOS[tipo];
    const actual = await this.prisma.ajuste.findUnique({ where: { clave: conf.clave } });
    if (!actual?.valor) throw new NotFoundException('No hay ningún archivo publicado');

    await this.prisma.ajuste.deleteMany({
      where: { clave: { in: [conf.clave, ...DATOS.map((s) => conf.clave + s)] } },
    });
    await this.almacenamiento.eliminar(actual.valor);

    return null;
  }

  /** La referencia interna, solo para que el controlador entregue el archivo. */
  async referenciaArchivo(tipo: ArchivoAdministrado) {
    const conf = ARCHIVOS[tipo];
    const [archivo, nombre, mime] = await Promise.all([
      this.prisma.ajuste.findUnique({ where: { clave: conf.clave } }),
      this.prisma.ajuste.findUnique({ where: { clave: conf.clave + '_nombre' } }),
      this.prisma.ajuste.findUnique({ where: { clave: conf.clave + '_mime' } }),
    ]);
    if (!archivo?.valor) return null;

    return {
      referencia: archivo.valor,
      nombre: nombre?.valor || POR_DEFECTO[conf.formato as Formato],
      mime: mime?.valor || '',
      formato: conf.formato as Formato,
    };
  }

  /** Lo que sí puede ver el navegador: nunca la clave del archivo. */
  private async datosArchivo(tipo: ArchivoAdministrado) {
    const conf = ARCHIVOS[tipo];
    const [archivo, nombre, tamano, fecha] = await Promise.all([
      this.prisma.ajuste.findUnique({ where: { clave: conf.clave } }),
      this.prisma.ajuste.findUnique({ where: { clave: conf.clave + '_nombre' } }),
      this.prisma.ajuste.findUnique({ where: { clave: conf.clave + '_tamano' } }),
      this.prisma.ajuste.findUnique({ where: { clave: conf.clave + '_actualizado' } }),
    ]);
    if (!archivo?.valor) return null;

    // La dirección es siempre la misma, así que lleva la marca de tiempo: sin
    // ella el navegador seguiría mostrando el archivo anterior tras cambiarlo.
    const marca = fecha?.valor ? Date.parse(fecha.valor) : NaN;

    return {
      url: conf.url + (Number.isNaN(marca) ? '' : `?v=${marca}`),
      nombre: nombre?.valor || '',
      tamano: Number(tamano?.valor || 0),
      actualizado: fecha?.valor || null,
    };
  }

  /**
   * El nombre puede mentir sobre el contenido: se revisan los primeros bytes,
   * que es lo que de verdad distingue un PDF de un PNG disfrazado.
   */
  private validarContenido(formato: Formato, archivo: Express.Multer.File) {
    const cabeza = archivo.buffer?.subarray(0, 12);
    if (!cabeza?.length) throw new BadRequestException('El archivo llegó vacío');

    if (formato === 'pdf') {
      if (cabeza.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new BadRequestException('El archivo no es un PDF válido');
      }
      return;
    }

    if (formato === 'video') {
      // El 'ftyp' del MP4 suele ir en el byte 4, pero algunos grabadores meten
      // antes una caja propia: se busca en el arranque y no en una posición
      // fija, que es lo que hacía rebotar videos perfectamente válidos.
      const inicio = archivo.buffer.subarray(0, 64);
      const esMp4 = inicio.toString('latin1').includes('ftyp');
      const esWebm =
        inicio[0] === 0x1a && inicio[1] === 0x45 && inicio[2] === 0xdf && inicio[3] === 0xa3;

      if (!esMp4 && !esWebm) {
        throw new BadRequestException(
          'El archivo no es un video MP4 o WEBM. Si lo grabó con un celular, conviértalo a MP4 antes de subirlo.',
        );
      }
      return;
    }

    const esJpg = cabeza[0] === 0xff && cabeza[1] === 0xd8 && cabeza[2] === 0xff;
    const esPng = cabeza.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n';
    const esWebp =
      cabeza.subarray(0, 4).toString('latin1') === 'RIFF' &&
      cabeza.subarray(8, 12).toString('latin1') === 'WEBP';

    if (!esJpg && !esPng && !esWebp) {
      throw new BadRequestException('El archivo no es una imagen JPG, PNG o WEBP');
    }
  }

  /** Sin rutas ni caracteres raros: este nombre viaja en una cabecera HTTP. */
  private nombreLimpio(original: string, formato: Formato) {
    const porDefecto = POR_DEFECTO[formato];
    const base = (original || porDefecto).split(/[\\/]/).pop() || porDefecto;
    const limpio = base
      .replace(/[^a-zA-Z0-9._ -]/g, '')
      .trim()
      .slice(0, 80);
    if (!limpio) return porDefecto;
    if (formato === 'pdf' && !limpio.toLowerCase().endsWith('.pdf')) return porDefecto;
    if (formato === 'video' && !/\.(mp4|m4v|webm)$/i.test(limpio)) return porDefecto;
    return limpio;
  }

  // --------------------------------------------------------------------
  // Resto de ajustes
  // --------------------------------------------------------------------

  /** Culmina o reabre el periodo de inscripciones para todos los tutores. */
  async cambiarCierre(cerradas: boolean) {
    await this.guardar(CLAVE_CIERRE, cerradas ? 'true' : 'false');
    await this.guardar(CLAVE_CIERRE_FECHA, cerradas ? new Date().toISOString() : '');
    return { inscripcionesCerradas: cerradas };
  }

  private async guardar(clave: string, valor: string) {
    await this.prisma.ajuste.upsert({
      where: { clave },
      create: { clave, valor },
      update: { valor },
    });
  }

  async crearGrupo(datos: { nombre: string; enlace?: string }) {
    const total = await this.prisma.grupoWhatsapp.count();
    return this.prisma.grupoWhatsapp.create({
      data: {
        nombre: datos.nombre.trim(),
        enlace: datos.enlace?.trim() || '',
        orden: total,
      },
    });
  }

  async actualizarGrupo(id: string, datos: { nombre?: string; enlace?: string; lleno?: boolean }) {
    const grupo = await this.prisma.grupoWhatsapp.findUnique({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    return this.prisma.grupoWhatsapp.update({
      where: { id },
      data: {
        nombre: datos.nombre?.trim() ?? grupo.nombre,
        enlace: datos.enlace !== undefined ? datos.enlace.trim() : grupo.enlace,
        lleno: datos.lleno ?? grupo.lleno,
      },
    });
  }

  async eliminarGrupo(id: string) {
    const grupo = await this.prisma.grupoWhatsapp.findUnique({ where: { id } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    await this.prisma.grupoWhatsapp.delete({ where: { id } });
    return { ok: true };
  }

  /** Cuenta del BCP que se le muestra al tutor cuando elige pagar por banco. */
  async guardarBcp(datos: { titular?: string; cuenta?: string; cci?: string }) {
    const limpio = {
      titular: (datos.titular || '').trim(),
      cuenta: (datos.cuenta || '').trim(),
      cci: (datos.cci || '').trim(),
    };

    await Promise.all([
      this.guardar(CLAVES_BCP.titular, limpio.titular),
      this.guardar(CLAVES_BCP.cuenta, limpio.cuenta),
      this.guardar(CLAVES_BCP.cci, limpio.cci),
    ]);

    return { bcp: limpio };
  }

  /** El comunicado tal cual está guardado, publicado o no. Lo ve la comisión. */
  async comunicado(): Promise<Comunicado> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVE_COMUNICADO } });
    if (!fila?.valor) return { ...COMUNICADO_VACIO };

    try {
      return { ...COMUNICADO_VACIO, ...JSON.parse(fila.valor) };
    } catch {
      // Un JSON roto no puede dejar la portada sin cargar.
      return { ...COMUNICADO_VACIO };
    }
  }

  async guardarComunicado(datos: Partial<Comunicado>): Promise<Comunicado> {
    const actual = await this.comunicado();
    const nuevo: Comunicado = { ...actual };

    for (const [campo, largo] of Object.entries(LARGOS_COMUNICADO)) {
      if (datos[campo as keyof Comunicado] === undefined) continue;
      const valor = String(datos[campo as keyof Comunicado] ?? '').trim();
      if (valor.length > largo) {
        throw new BadRequestException(`Ese campo no debe pasar de ${largo} caracteres`);
      }
      (nuevo as any)[campo] = valor;
    }

    if (datos.estilo && ESTILOS_COMUNICADO.includes(datos.estilo)) nuevo.estilo = datos.estilo;
    if (datos.publicado !== undefined) nuevo.publicado = Boolean(datos.publicado);

    if (nuevo.publicado && !nuevo.titulo) {
      throw new BadRequestException('Escriba el título antes de publicar el comunicado');
    }

    // La marca de tiempo cambia en cada guardado: así el visitante que ya lo
    // había cerrado vuelve a verlo cuando la comisión lo corrige.
    nuevo.actualizado = new Date().toISOString();

    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE_COMUNICADO },
      create: { clave: CLAVE_COMUNICADO, valor: JSON.stringify(nuevo) },
      update: { valor: JSON.stringify(nuevo) },
    });

    return nuevo;
  }

  /**
   * Titular y número de la cuenta Yape.
   *
   * El número se guarda tal como lo escriban —con espacios si quieren— porque
   * aquí solo se muestra para que el tutor lo copie; no se arma ningún enlace
   * con él, a diferencia del de WhatsApp.
   */
  async guardarYape(datos: { numero?: string; titular?: string }) {
    const numero = (datos.numero || '').trim();
    const titular = (datos.titular || '').trim();

    if (numero.replace(/\D/g, '').length < 6) {
      throw new BadRequestException('Escriba el número de la cuenta Yape');
    }
    if (!titular) throw new BadRequestException('Escriba el nombre del titular');
    if (numero.length > 40 || titular.length > 120) {
      throw new BadRequestException('El número o el nombre son demasiado largos');
    }

    await Promise.all([
      this.guardar(CLAVES_YAPE.numero, numero),
      this.guardar(CLAVES_YAPE.titular, titular),
    ]);

    return { yape: { numero, titular } };
  }

  /**
   * Número y mensaje del botón flotante de WhatsApp.
   *
   * El número se guarda solo con dígitos: wa.me rechaza espacios, guiones y el
   * «+». Si escriben los 9 dígitos del celular peruano se le antepone el 51,
   * que es el error más fácil de cometer.
   */
  async guardarWhatsapp(datos: { numero?: string; mensaje?: string }) {
    const soloDigitos = (datos.numero || '').replace(/\D/g, '');
    const numero = /^9\d{8}$/.test(soloDigitos) ? `51${soloDigitos}` : soloDigitos;

    if (numero.length < 8 || numero.length > 15) {
      throw new BadRequestException(
        'Escriba el número con código de país, por ejemplo 51928853577',
      );
    }

    const mensaje = (datos.mensaje || '').trim();
    if (!mensaje) throw new BadRequestException('Escriba el mensaje con el que abrirá el chat');
    if (mensaje.length > 300) {
      throw new BadRequestException('El mensaje no debe pasar de 300 caracteres');
    }

    await Promise.all([
      this.guardar(CLAVES_WHATSAPP.numero, numero),
      this.guardar(CLAVES_WHATSAPP.mensaje, mensaje),
    ]);

    return { whatsapp: { numero, mensaje } };
  }
}
