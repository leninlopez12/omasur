import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface Regla {
  intentos: number;
  segundos: number;
}

const CLAVE = 'limite_peticiones';

/**
 * Cuántas veces puede una misma IP llamar a esta ruta dentro de la ventana.
 * Se usa en las rutas sin sesión (recuperar contraseña) para que nadie pueda
 * dispararlas miles de veces seguidas.
 */
export const Limite = (intentos: number, segundos: number) =>
  SetMetadata(CLAVE, { intentos, segundos } as Regla);

@Injectable()
export class LimitePeticionesGuard implements CanActivate {
  /** Memoria del proceso: suficiente porque la API corre como una sola instancia. */
  private readonly visitas = new Map<string, number[]>();
  private ultimaLimpieza = Date.now();

  constructor(private reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const regla = this.reflector.get<Regla>(CLAVE, contexto.getHandler());
    if (!regla) return true;

    const peticion = contexto.switchToHttp().getRequest();
    const clave = `${contexto.getClass().name}.${contexto.getHandler().name}:${this.origen(peticion)}`;
    const ahora = Date.now();
    const desde = ahora - regla.segundos * 1000;

    this.limpiar(ahora);

    const previas = (this.visitas.get(clave) || []).filter((marca) => marca > desde);

    if (previas.length >= regla.intentos) {
      const espera = Math.ceil((previas[0] + regla.segundos * 1000 - ahora) / 1000);
      throw new HttpException(
        `Demasiados intentos. Espere ${espera > 60 ? Math.ceil(espera / 60) + ' minutos' : espera + ' segundos'} e intente de nuevo.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    previas.push(ahora);
    this.visitas.set(clave, previas);
    return true;
  }

  /**
   * La cabecera `x-forwarded-for` la puede inventar cualquiera, así que solo se
   * usa cuando la API está detrás de un proxy (TRUST_PROXY=true en producción).
   * Si no, se toma la IP real de la conexión.
   */
  private origen(peticion: any): string {
    if (process.env.TRUST_PROXY === 'true') {
      const cabecera = peticion.headers?.['x-forwarded-for'];
      const reenviada = Array.isArray(cabecera) ? cabecera[0] : cabecera;
      const primera = reenviada?.split(',')[0]?.trim();
      if (primera) return primera;
    }
    return (peticion.socket?.remoteAddress || peticion.ip || 'anonimo').trim();
  }

  /** Cada 10 minutos se descartan las marcas viejas para no acumular memoria. */
  private limpiar(ahora: number) {
    if (ahora - this.ultimaLimpieza < 10 * 60 * 1000) return;
    this.ultimaLimpieza = ahora;
    const limite = ahora - 60 * 60 * 1000;
    for (const [clave, marcas] of this.visitas) {
      const vivas = marcas.filter((marca) => marca > limite);
      if (vivas.length) this.visitas.set(clave, vivas);
      else this.visitas.delete(clave);
    }
  }
}
