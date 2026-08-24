import type { Measurement } from '../types';

const headers = ['Fecha', 'Hora', 'Jugador', 'Peso (kg)', 'Fatiga', 'Molestias', 'Comentarios'];
const rows = (items: Measurement[]) => items.map((item) => [
  item.date, item.time, item.playerName, item.weight, item.fatigue, item.soreness, item.comments,
]);

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportCsv = (items: Measurement[]) => {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows(items)].map((row) => row.map(escape).join(';')).join('\n');
  download(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), 'zabal-mediciones.csv');
};

export const exportExcel = async (items: Measurement[]) => {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows(items)]);
  sheet['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 44 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Mediciones');
  XLSX.writeFile(workbook, 'zabal-mediciones.xlsx');
};
