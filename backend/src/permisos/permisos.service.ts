import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../common/decorators';
import { limpiarPermisos, Permiso, PERMISOS_RESULTADOS, tocaResultados } from './permisos';

const CLAVE = 'permisos_supervisores';
/** De aquí se arrastra la lista vieja, de cuando el cargo era todo o nada. */
const CLAVE_RESULTADOS = 'resultados_config';

/** Lo que podía todo supervisor antes de que los permisos existieran. */
const HEREDADOS: Permiso[] = ['examen'];

type Mapa = Record<string, Permiso[]>;

/**
 * Qué puede ver y hacer cada supervisor.
 *
 * Vive en una fila de ajustes, como el resto de la configuración: un objeto
 * con el id del supervisor y la lista de módulos que le tocan. Nadie nace con
 * permisos; el administrador los reparte uno por uno.
 */
@Injectable()
export class PermisosService {
  private log = new Logger('Permisos');

  constructor(private prisma: PrismaService) {}

  /** El mapa completo, ya arrastrado lo que hubiera de la versión anterior. */
  async todos(): Promise<Mapa> {
    const [fila, resultados] = await Promise.all([
      this.prisma.ajuste.findUnique({ where: { clave: CLAVE } }),
      this.prisma.ajuste.findUnique({ where: { clave: CLAVE_RESULTADOS } }),
    ]);

    const mapa: Mapa = {};
    if (fila?.valor) {
      try {
        const guardado = JSON.parse(fila.valor) as Record<string, unknown>;
        for (const [id, lista] of Object.entries(guardado || {})) {
          mapa[id] = limpiarPermisos(lista);
        }
      } catch {
        this.log.warn('Los permisos guardados no se pudieron leer; se parte de cero.');
      }
    }

    // Antes el cargo de resultados era una sola lista sin detalle. A quien
    // estuviera ahí y todavía no tenga permisos propios se le dan todos los de
    // resultados, que es lo que de hecho veía.
    if (resultados?.valor) {
      try {
        const encargados: string[] = JSON.parse(resultados.valor)?.encargados || [];
        for (const id of encargados) {
          if (!mapa[id]) mapa[id] = [...PERMISOS_RESULTADOS, ...HEREDADOS];
        }
      } catch {
        /* si esa fila está rota no es asunto de esta pantalla */
      }
    }

    return mapa;
  }

  /**
   * Los permisos de un supervisor.
   *
   * Quien no tiene fila es alguien de antes de que existieran los permisos:
   * le queda el examen, que es lo que todo supervisor podía hacer entonces.
   * En cuanto el administrador le guarde algo —aunque sea nada— manda su
   * fila y este arrastre deja de aplicar.
   */
  async de(id: string): Promise<Permiso[]> {
    const mapa = await this.todos();
    return mapa[id] || [...HEREDADOS];
  }

  /** Lo que pregunta cada panel al entrar: el administrador lo puede todo. */
  async mios(usuario: JwtUser) {
    if (usuario.rol === 'ADMIN') return { esAdmin: true, permisos: [] as Permiso[] };
    if (usuario.rol !== 'SUPERVISOR') return { esAdmin: false, permisos: [] as Permiso[] };
    return { esAdmin: false, permisos: await this.de(usuario.sub) };
  }

  /** Para los guardias: el administrador pasa; el supervisor, si lo tiene. */
  async tiene(usuario: JwtUser | undefined, permisos: readonly string[]) {
    if (!usuario) return false;
    if (usuario.rol === 'ADMIN') return true;
    if (usuario.rol !== 'SUPERVISOR') return false;

    const suyos = await this.de(usuario.sub);
    return permisos.some((p) => suyos.includes(p as Permiso));
  }

  async estaACargoDeResultados(usuario: JwtUser) {
    if (usuario.rol === 'ADMIN') return true;
    if (usuario.rol !== 'SUPERVISOR') return false;
    return tocaResultados(await this.de(usuario.sub));
  }

  /** La tabla de la pantalla: cada supervisor con lo que tiene marcado. */
  async supervisores() {
    const [mapa, supervisores] = await Promise.all([
      this.todos(),
      this.prisma.admin.findMany({
        where: { rol: 'SUPERVISOR' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nombre: true, correo: true },
      }),
    ]);

    return supervisores.map((s) => ({ ...s, permisos: mapa[s.id] || [...HEREDADOS] }));
  }

  /**
   * Guarda lo que marcó el administrador.
   *
   * `quien` es el que está cambiando: un supervisor con permiso para repartir
   * permisos no puede tocar los suyos, porque entonces el reparto no tendría
   * techo y se daría solo lo que le falte.
   */
  async guardar(id: string, lista: unknown, quien?: JwtUser) {
    const supervisor = await this.prisma.admin.findUnique({ where: { id } });
    if (!supervisor || supervisor.rol !== 'SUPERVISOR') {
      throw new NotFoundException('Ese supervisor no existe');
    }
    if (quien && quien.rol !== 'ADMIN' && quien.sub === id) {
      throw new ForbiddenException('No puede cambiar sus propios permisos');
    }

    const permisos = limpiarPermisos(lista);
    const mapa = await this.todos();
    mapa[id] = permisos;

    await this.prisma.ajuste.upsert({
      where: { clave: CLAVE },
      create: { clave: CLAVE, valor: JSON.stringify(mapa) },
      update: { valor: JSON.stringify(mapa) },
    });

    this.log.warn(
      `${supervisor.nombre}: ${permisos.length ? permisos.join(', ') : 'sin permisos'}.`,
    );
    return this.supervisores();
  }
}
