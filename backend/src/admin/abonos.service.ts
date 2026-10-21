import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { escribirEncabezados, escribirTitulo } from '../common/excel';

export interface FiltrosAbonos {
  metodo?: string;
  estado?: string;
  modalidad?: string;
  departamento?: string;
  desde?: string;
  hasta?: string;
  buscar?: string;
}

const METODOS: Record<string, string> = { YAPE: 'Yape', BCP: 'BCP' };

const ESTADOS_PAGO: Record<string, string> = {
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Observado',
};

const MODALIDADES: Record<string, string> = {
  ESTATAL: 'Institución estatal',
  PARTICULAR: 'Institución particular',
  GRUPO_ESTUDIO: 'Grupo de estudio',
};

/** Lo que se suma de un grupo de comprobantes: cuánto y cuántos. */
interface Monto {
  monto: number;
  comprobantes: number;
}

const cero = (): Monto => ({ monto: 0, comprobantes: 0 });

const sumar = (acumulado: Monto, monto: number) => {
  acumulado.monto += monto;
  acumulado.comprobantes += 1;
};

/**
 * Abonos por delegación.
 *
 * El consolidado de siempre mira estudiantes; este mira el dinero, y lo mira
 * por delegación y no por comprobante: una institución que pagó en tres veces
 * aparece una sola vez con su total. Es la vista que hace falta para cuadrar
 * con el estado de cuenta de Yape y con el del banco, que vienen por cuenta y
 * no por alumno.
 */
@Injectable()
export class AbonosService {
  constructor(private prisma: PrismaService) {}

  async resumen(filtros: FiltrosAbonos) {
    const pagos = await this.prisma.payment.findMany({
      where: this.filtro(filtros),
      orderBy: { createdAt: 'asc' },
      include: {
        tutor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            institucion: true,
            modalidad: true,
            estado: true,
            departamento: true,
            provincia: true,
            correo: true,
            celular: true,
          },
        },
        _count: { select: { students: true } },
      },
    });

    const porTutor = new Map<string, any>();

    for (const pago of pagos) {
      const t = pago.tutor;
      if (!porTutor.has(t.id)) {
        porTutor.set(t.id, {
          tutorId: t.id,
          institucion: t.institucion || 'Sin institución',
          tutor: `${t.nombres} ${t.apellidos}`.trim(),
          correo: t.correo,
          celular: t.celular,
          modalidad: t.modalidad,
          modalidadLabel: MODALIDADES[t.modalidad] || t.modalidad,
          estadoDelegacion: t.estado,
          departamento: t.departamento,
          provincia: t.provincia,
          yape: cero(),
          bcp: cero(),
          aprobado: cero(),
          enRevision: cero(),
          rechazado: cero(),
          total: 0,
          comprobantes: 0,
          // Los rechazados no cubren a nadie: sumarlos inflaría la cuenta.
          estudiantesCubiertos: 0,
          primerEnvio: pago.createdAt,
          ultimoEnvio: pago.createdAt,
          pagos: [],
        });
      }

      const fila = porTutor.get(t.id);
      const monto = pago.monto || 0;

      sumar(pago.metodo === 'BCP' ? fila.bcp : fila.yape, monto);
      if (pago.estado === 'APROBADO') sumar(fila.aprobado, monto);
      else if (pago.estado === 'RECHAZADO') sumar(fila.rechazado, monto);
      else sumar(fila.enRevision, monto);

      fila.total += monto;
      fila.comprobantes += 1;
      if (pago.estado !== 'RECHAZADO') fila.estudiantesCubiertos += pago._count.students;
      if (pago.createdAt < fila.primerEnvio) fila.primerEnvio = pago.createdAt;
      if (pago.createdAt > fila.ultimoEnvio) fila.ultimoEnvio = pago.createdAt;

      fila.pagos.push({
        id: pago.id,
        metodo: pago.metodo,
        metodoLabel: METODOS[pago.metodo] || pago.metodo,
        monto,
        estado: pago.estado,
        estadoLabel: ESTADOS_PAGO[pago.estado] || pago.estado,
        observacion: pago.observacion,
        operacion: pago.operacion,
        estudiantes: pago._count.students,
        enviadoEn: pago.createdAt,
        revisadoPor: pago.revisadoPor,
        revisadoEn: pago.revisadoEn,
        archivoUrl: `/api/pagos/${pago.id}/archivo`,
      });
    }

    // De mayor a menor abonado: arriba queda lo que más mueve la caja.
    const filas = [...porTutor.values()].sort((a, b) => b.total - a.total);

    return {
      filas,
      totales: this.totales(filas),
      descripcion: this.descripcion(filtros),
    };
  }

  async excel(filtros: FiltrosAbonos): Promise<Buffer> {
    const { filas, totales } = await this.resumen(filtros);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'I OMASUR UNI 2026';
    const hoja = libro.addWorksheet('Abonos');

    const columnas = [
      { header: 'N°', width: 6 },
      { header: 'INSTITUCIÓN', width: 36 },
      { header: 'TUTOR', width: 30 },
      { header: 'MODALIDAD', width: 20 },
      { header: 'DEPARTAMENTO', width: 16 },
      { header: 'YAPE S/', width: 12 },
      { header: 'N° YAPE', width: 10 },
      { header: 'BCP S/', width: 12 },
      { header: 'N° BCP', width: 10 },
      { header: 'TOTAL S/', width: 12 },
      { header: 'COMPROBANTES', width: 14 },
      { header: 'APROBADO S/', width: 13 },
      { header: 'EN REVISIÓN S/', width: 14 },
      { header: 'OBSERVADO S/', width: 13 },
      { header: 'ESTUDIANTES', width: 12 },
      { header: 'PRIMER ENVÍO', width: 20 },
      { header: 'ÚLTIMO ENVÍO', width: 20 },
    ];

    escribirTitulo(hoja, columnas.length, 'Abonos por delegación', this.descripcion(filtros), filas.length);
    escribirEncabezados(hoja, columnas);

    filas.forEach((f, i) => {
      hoja.addRow([
        i + 1,
        f.institucion,
        f.tutor,
        f.modalidadLabel,
        f.departamento || '',
        f.yape.monto,
        f.yape.comprobantes,
        f.bcp.monto,
        f.bcp.comprobantes,
        f.total,
        f.comprobantes,
        f.aprobado.monto,
        f.enRevision.monto,
        f.rechazado.monto,
        f.estudiantesCubiertos,
        this.fecha(f.primerEnvio),
        this.fecha(f.ultimoEnvio),
      ]);
    });

    // Fila de cierre con los totales: es lo que se compara con el banco.
    hoja.addRow([]);
    const cierre = hoja.addRow([
      '',
      'TOTALES',
      '',
      '',
      '',
      totales.yape.monto,
      totales.yape.comprobantes,
      totales.bcp.monto,
      totales.bcp.comprobantes,
      totales.general.monto,
      totales.general.comprobantes,
      totales.aprobado.monto,
      totales.enRevision.monto,
      totales.rechazado.monto,
      totales.estudiantesCubiertos,
      '',
      '',
    ]);
    cierre.font = { bold: true };

    return (await libro.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // --------------------------------------------------------------------

  private totales(filas: any[]) {
    const vacio = () => ({ monto: 0, comprobantes: 0 });
    const t = {
      yape: vacio(),
      bcp: vacio(),
      general: vacio(),
      aprobado: vacio(),
      enRevision: vacio(),
      rechazado: vacio(),
      delegaciones: filas.length,
      estudiantesCubiertos: 0,
    };

    for (const f of filas) {
      for (const clave of ['yape', 'bcp', 'aprobado', 'enRevision', 'rechazado'] as const) {
        t[clave].monto += f[clave].monto;
        t[clave].comprobantes += f[clave].comprobantes;
      }
      t.general.monto += f.total;
      t.general.comprobantes += f.comprobantes;
      t.estudiantesCubiertos += f.estudiantesCubiertos;
    }

    return t;
  }

  private filtro(f: FiltrosAbonos) {
    const where: any = {};

    if (f.metodo && METODOS[f.metodo]) where.metodo = f.metodo;
    if (f.estado && ESTADOS_PAGO[f.estado]) where.estado = f.estado;

    // El rango va por el día completo: "hasta el 19" incluye el 19 entero.
    const desde = this.dia(f.desde);
    const hasta = this.dia(f.hasta, true);
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = desde;
      if (hasta) where.createdAt.lte = hasta;
    }

    const tutor: any = {};
    if (f.modalidad && MODALIDADES[f.modalidad]) tutor.modalidad = f.modalidad;
    if (f.departamento) tutor.departamento = f.departamento;
    if (f.buscar?.trim()) {
      const buscar = f.buscar.trim();
      tutor.OR = [
        { institucion: { contains: buscar, mode: 'insensitive' } },
        { nombres: { contains: buscar, mode: 'insensitive' } },
        { apellidos: { contains: buscar, mode: 'insensitive' } },
        { correo: { contains: buscar, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(tutor).length) where.tutor = tutor;

    return where;
  }

  /** "2026-10-19" → el inicio (o el final) de ese día en Lima. */
  private dia(valor?: string, finDelDia = false) {
    if (!valor?.trim()) return undefined;
    const fecha = new Date(`${valor.trim()}T${finDelDia ? '23:59:59.999' : '00:00:00.000'}-05:00`);
    return Number.isNaN(fecha.getTime()) ? undefined : fecha;
  }

  private fecha(valor: Date | null) {
    if (!valor) return '';
    return new Date(valor).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  private descripcion(f: FiltrosAbonos) {
    const partes: string[] = [];
    if (f.metodo && METODOS[f.metodo]) partes.push(`Método: ${METODOS[f.metodo]}`);
    if (f.estado && ESTADOS_PAGO[f.estado]) partes.push(`Estado: ${ESTADOS_PAGO[f.estado]}`);
    if (f.modalidad && MODALIDADES[f.modalidad]) partes.push(MODALIDADES[f.modalidad]);
    if (f.departamento) partes.push(`Departamento: ${f.departamento}`);
    if (f.desde || f.hasta) {
      partes.push(`Enviados del ${f.desde || 'inicio'} al ${f.hasta || 'hoy'}`);
    }
    if (f.buscar?.trim()) partes.push(`Búsqueda: "${f.buscar.trim()}"`);

    return partes.length ? partes.join(' · ') : 'Sin filtros: todos los comprobantes';
  }
}
