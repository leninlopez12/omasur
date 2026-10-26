import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ResultadosService } from './resultados.service';
import { JwtUser } from '../common/decorators';

/**
 * Resultados no es de todo el equipo.
 *
 * El administrador entra siempre; de los supervisores, solo los que él puso a
 * cargo. Se comprueba contra la lista guardada y no contra el rol, porque dos
 * supervisores tienen el mismo rol y aquí no deben poder lo mismo.
 */
@Injectable()
export class EncargadoGuard implements CanActivate {
  constructor(private resultados: ResultadosService) {}

  async canActivate(contexto: ExecutionContext) {
    const usuario: JwtUser | undefined = contexto.switchToHttp().getRequest().user;

    if (!usuario) throw new ForbiddenException('No tiene permisos para esta acción');
    if (usuario.rol === 'ADMIN') return true;
    if (usuario.rol !== 'SUPERVISOR') {
      throw new ForbiddenException('No tiene permisos para esta acción');
    }

    const { encargados } = await this.resultados.config();
    if (!encargados.includes(usuario.sub)) {
      throw new ForbiddenException('Los resultados están a cargo de otra persona.');
    }

    return true;
  }
}
