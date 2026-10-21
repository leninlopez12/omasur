import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ClaveEtapa = 'INSTITUCIONAL' | 'MACRORREGIONAL';

/** Lo que la comisión puede escribir en la credencial de cada etapa. */
export interface Etapa {
  clave: ClaveEtapa;
  etiqueta: string;
  titulo: string;
  subtitulo: string;
  organizador: string;
  fecha: string;
  hora: string;
  lugar: string;
  indicaciones: string;
  pie: string;
  publicada: boolean;
}

/** Cada etapa es una fila de `Ajuste` con su JSON: no hace falta tabla nueva. */
const CLAVES: Record<ClaveEtapa, string> = {
  INSTITUCIONAL: 'credencial_institucional',
  MACRORREGIONAL: 'credencial_macrorregional',
};

/**
 * Los textos con los que sale el sistema. Mientras nadie los edite, la
 * credencial se imprime con esto, así que son los de siempre.
 */
const POR_DEFECTO: Record<ClaveEtapa, Omit<Etapa, 'clave'>> = {
  INSTITUCIONAL: {
    etiqueta: 'ETAPA INSTITUCIONAL',
    titulo: 'I - OMASUR UNI 2026',
    subtitulo: 'Olimpiada Macrorregional Sur de Matemática',
    organizador: 'IES Ingenieritos del Perú "Eduardo de Habich"',
    fecha: '22 de octubre de 2026',
    hora: '9:00 a. m.',
    lugar: 'En su propia institución educativa',
    indicaciones: 'Presentar junto con el DNI. Portar lápiz 2B, borrador y tajador.',
    pie: 'Esta credencial es personal e intransferible.',
    publicada: false,
  },
  MACRORREGIONAL: {
    etiqueta: 'ETAPA MACRORREGIONAL',
    titulo: 'I - OMASUR UNI 2026',
    subtitulo: 'Olimpiada Macrorregional Sur de Matemática',
    organizador: 'IES Ingenieritos del Perú "Eduardo de Habich"',
    fecha: '08 de noviembre de 2026',
    hora: '9:00 a. m.',
    lugar: 'Sede macrorregional · Juliaca',
    indicaciones: 'Presentar junto con el DNI. Portar lápiz 2B, borrador y tajador.',
    pie: 'Esta credencial es personal e intransferible.',
    publicada: false,
  },
};

/** Lo que el tutor puede escribir de largo en cada campo. */
const LARGOS: Record<string, number> = {
  etiqueta: 40,
  titulo: 60,
  subtitulo: 80,
  organizador: 90,
  fecha: 60,
  hora: 40,
  lugar: 90,
  indicaciones: 160,
  pie: 120,
};

/**
 * Las dos etapas del concurso y los textos de su credencial.
 *
 * Se guardan como JSON en `Ajuste`, una fila por etapa: son dos registros que
 * se leen enteros y se escriben enteros, así que una tabla propia no aportaba
 * nada. Mientras una etapa no esté publicada, su credencial no se descarga.
 */
@Injectable()
export class EtapasService {
  constructor(private prisma: PrismaService) {}

  async todas(): Promise<Etapa[]> {
    return Promise.all([this.una('INSTITUCIONAL'), this.una('MACRORREGIONAL')]);
  }

  async una(clave: ClaveEtapa): Promise<Etapa> {
    const fila = await this.prisma.ajuste.findUnique({ where: { clave: CLAVES[clave] } });
    let guardado: Partial<Etapa> = {};

    if (fila?.valor) {
      // Un JSON corrupto no puede dejar sin credencial a nadie: se ignora y
      // se cae a los valores por defecto.
      try {
        guardado = JSON.parse(fila.valor);
      } catch {
        guardado = {};
      }
    }

    // `clave` al final: si el JSON guardado trae una vieja, manda la real.
    const { clave: _ignorada, ...resto } = guardado;
    return { ...POR_DEFECTO[clave], ...resto, clave };
  }

  async guardar(clave: ClaveEtapa, datos: Partial<Etapa>): Promise<Etapa> {
    const actual = await this.una(clave);
    const nueva: Etapa = { ...actual };

    for (const campo of Object.keys(LARGOS)) {
      if (datos[campo as keyof Etapa] === undefined) continue;
      const valor = String(datos[campo as keyof Etapa] ?? '').trim();

      // Cualquiera puede quedar vacío: el que no tiene dato no se imprime, y
      // su rótulo tampoco. Solo se controla que no se pasen de largo.
      if (valor.length > LARGOS[campo]) {
        throw new BadRequestException(
          `El campo «${campo}» no debe pasar de ${LARGOS[campo]} caracteres`,
        );
      }
      (nueva as any)[campo] = valor;
    }

    if (datos.publicada !== undefined) nueva.publicada = Boolean(datos.publicada);

    await this.prisma.ajuste.upsert({
      where: { clave: CLAVES[clave] },
      create: { clave: CLAVES[clave], valor: JSON.stringify(nueva) },
      update: { valor: JSON.stringify(nueva) },
    });

    return nueva;
  }

  /** Las que el tutor puede descargar hoy. */
  async publicadas(): Promise<Etapa[]> {
    return (await this.todas()).filter((e) => e.publicada);
  }

  /**
   * La etapa con la que se imprime. Sin `clave` se usa la última publicada,
   * que es la que está por rendirse.
   */
  async paraImprimir(clave?: string): Promise<Etapa> {
    const publicadas = await this.publicadas();
    if (publicadas.length === 0) {
      throw new BadRequestException(
        'La comisión todavía no publicó las credenciales de ninguna etapa.',
      );
    }

    if (clave) {
      const pedida = publicadas.find((e) => e.clave === clave);
      if (!pedida) {
        throw new BadRequestException('Esa etapa todavía no tiene las credenciales publicadas.');
      }
      return pedida;
    }

    return publicadas[publicadas.length - 1];
  }

  esClave(valor?: string): valor is ClaveEtapa {
    return valor === 'INSTITUCIONAL' || valor === 'MACRORREGIONAL';
  }
}
