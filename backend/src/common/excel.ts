import * as ExcelJS from 'exceljs';

/** El granate institucional, en el formato que pide ExcelJS. */
export const GRANATE = 'FF7B1E2B';

/**
 * Cabecera de todo Excel que salga del sistema.
 *
 * Un archivo suelto en el correo de alguien no dice de dónde salió ni con qué
 * filtros: estas cinco líneas lo explican antes de que empiece la tabla.
 */
export function escribirTitulo(
  hoja: ExcelJS.Worksheet,
  ancho: number,
  titulo: string,
  descripcion: string,
  total: number,
) {
  const fin = String.fromCharCode(64 + Math.min(ancho, 26));

  hoja.mergeCells(`A1:${fin}1`);
  const marca = hoja.getCell('A1');
  marca.value = 'I - OMASUR UNI 2026';
  marca.font = { bold: true, size: 18, color: { argb: GRANATE } };
  marca.alignment = { horizontal: 'center', vertical: 'middle' };
  hoja.getRow(1).height = 30;

  hoja.mergeCells(`A2:${fin}2`);
  const sub = hoja.getCell('A2');
  sub.value = 'Olimpiada Macrorregional Sur de Matemática';
  sub.font = { size: 11, color: { argb: 'FF6B7280' } };
  sub.alignment = { horizontal: 'center' };

  hoja.mergeCells(`A3:${fin}3`);
  const nombre = hoja.getCell('A3');
  nombre.value = titulo;
  nombre.font = { bold: true, size: 14, color: { argb: 'FF111827' } };
  nombre.alignment = { horizontal: 'center', vertical: 'middle' };
  hoja.getRow(3).height = 24;

  hoja.mergeCells(`A4:${fin}4`);
  const detalle = hoja.getCell('A4');
  detalle.value = descripcion;
  detalle.font = { size: 10, color: { argb: 'FF6B7280' } };
  detalle.alignment = { horizontal: 'center', wrapText: true };

  hoja.mergeCells(`A5:${fin}5`);
  const pie = hoja.getCell('A5');
  const cuando = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
  pie.value = `${total} ${total === 1 ? 'registro' : 'registros'} · Generado el ${cuando}`;
  pie.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
  pie.alignment = { horizontal: 'center' };

  hoja.addRow([]); // Una línea en blanco antes de la tabla.
}

/** Fila de encabezados en granate, fija al desplazarse y con autofiltro. */
export function escribirEncabezados(
  hoja: ExcelJS.Worksheet,
  columnas: { header: string; width: number }[],
) {
  const fila = hoja.addRow(columnas.map((c) => c.header));
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRANATE } };
  fila.alignment = { vertical: 'middle' };
  fila.height = 22;

  hoja.columns = columnas.map((c, i) => ({ width: c.width, key: String(i) })) as any;
  hoja.views = [{ state: 'frozen', ySplit: fila.number }];
  hoja.autoFilter = {
    from: { row: fila.number, column: 1 },
    to: { row: fila.number, column: columnas.length },
  };

  return fila;
}

/** Nombre de archivo legible, con la fecha del día. */
export function nombreArchivo(titulo: string) {
  const base = titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
