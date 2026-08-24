import { appConfig } from '../config';
import type { AttendanceRecord, MatchRecord, Measurement, Player, ReportKind } from '../types';
import { todayKey } from '../utils/date';
import { getAlertLevel } from '../utils/measurements';
import { totalInjuryDays } from '../utils/injuries';
import { addPdfFooters } from './pdfBrand';
import { generatePlayerPdf } from './playerReport';

type ReportOptions = { kind: ReportKind; measurements: Measurement[]; players: Player[]; matches?: MatchRecord[]; attendance?: AttendanceRecord[]; playerId?: string };
type PdfDocument = import('jspdf').jsPDF;
type Rgb = [number, number, number];

const reportTitle: Record<ReportKind, string> = {
  daily: 'Informe de la sesión',
  weekly: 'Tendencias por jugador',
  player: 'Informe individual',
  alerts: 'Informe de alertas',
};

const daysAgoKey = (days: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const valuesFor = (items: Measurement[], key: 'weight' | 'fatigue' | 'soreness') =>
  items.map((item) => item[key]).filter((value): value is number => value !== undefined);

function drawTrendChart(doc: PdfDocument, title: string, items: Measurement[], x: number, y: number, width: number, height: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 54, 95);
  doc.text(title, x, y);

  const chartY = y + 4;
  const chartHeight = height - 9;
  doc.setDrawColor(221, 228, 235);
  doc.setFillColor(249, 251, 253);
  doc.roundedRect(x, chartY, width, chartHeight, 2, 2, 'FD');
  if (!items.length) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(115, 128, 142);
    doc.text('Sin datos en este periodo', x + width / 2, chartY + chartHeight / 2, { align: 'center' });
    return;
  }

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const left = x + 5;
  const right = x + width - 5;
  const top = chartY + 4;
  const bottom = chartY + chartHeight - 7;
  const pointX = (index: number) => sorted.length === 1 ? (left + right) / 2 : left + (right - left) * index / (sorted.length - 1);
  const series: Array<{ key: 'weight' | 'fatigue' | 'soreness'; color: Rgb; min: number; max: number }> = [
    { key: 'weight', color: [41, 110, 175], min: Math.min(...valuesFor(sorted, 'weight'), 0), max: Math.max(...valuesFor(sorted, 'weight'), 1) },
    { key: 'fatigue', color: [211, 146, 0], min: 1, max: 10 },
    { key: 'soreness', color: [200, 66, 79], min: 1, max: 10 },
  ];
  const weights = valuesFor(sorted, 'weight');
  if (weights.length) {
    series[0].min = Math.min(...weights) - 0.5;
    series[0].max = Math.max(...weights) + 0.5;
  }

  series.forEach(({ key, color, min, max }) => {
    let previous: [number, number] | null = null;
    sorted.forEach((item, index) => {
      const value = item[key];
      if (value === undefined) return;
      const px = pointX(index);
      const py = bottom - ((value - min) / Math.max(0.1, max - min)) * (bottom - top);
      doc.setDrawColor(...color);
      doc.setFillColor(...color);
      doc.setLineWidth(0.65);
      if (previous) doc.line(previous[0], previous[1], px, py);
      doc.circle(px, py, 0.8, 'F');
      previous = [px, py];
    });
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(110, 122, 136);
  doc.text(sorted[0].date.slice(5).replace('-', '/'), left, chartY + chartHeight - 2);
  doc.text(sorted.at(-1)!.date.slice(5).replace('-', '/'), right, chartY + chartHeight - 2, { align: 'right' });
}

function drawPlayerBlock(doc: PdfDocument, player: Player, measurements: Measurement[], top: number) {
  const items = measurements.filter((item) => item.playerId === player.id).sort((a, b) => a.date.localeCompare(b.date));
  const weekly = items.filter((item) => item.date >= daysAgoKey(6));
  const monthly = items.filter((item) => item.date >= daysAgoKey(29));
  const latest = items.at(-1);

  doc.setFillColor(22, 54, 95);
  doc.roundedRect(12, top, 186, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(player.name, 18, top + 9);
  doc.setFontSize(7.5);
  doc.text(`${appConfig.teamName} · ${appConfig.season}`, 192, top + 8.5, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(55, 70, 88);
  doc.setFont('helvetica', 'normal');
  const latestText = latest
    ? `Último control ${latest.date}   ·   Peso ${latest.weight ?? '—'} kg   ·   Fatiga ${latest.fatigue ?? '—'}   ·   Molestias ${latest.soreness ?? '—'}`
    : 'Todavía no hay controles registrados para este jugador.';
  doc.text(latestText, 16, top + 22, { maxWidth: 105 });
  const injuryText = player.injuries?.length
    ? `Bajas: ${totalInjuryDays(player)} días en ${player.injuries.length} periodo${player.injuries.length === 1 ? '' : 's'}${player.injured ? ' · BAJA ACTIVA' : ''}`
    : 'Bajas: sin periodos registrados';
  doc.setFont('helvetica', player.injured ? 'bold' : 'normal');
  doc.setTextColor(player.injured ? 174 : 95, player.injured ? 46 : 108, player.injured ? 59 : 124);
  doc.text(injuryText, 192, top + 22, { align: 'right' });

  drawTrendChart(doc, `Tendencia semanal · ${weekly.length} controles`, weekly, 16, top + 29, 178, 40);
  drawTrendChart(doc, `Tendencia mensual · ${monthly.length} controles`, monthly, 16, top + 73, 178, 40);

  const legendY = top + 120;
  const legends: Array<[string, Rgb]> = [['Peso', [41, 110, 175]], ['Fatiga', [211, 146, 0]], ['Molestias', [200, 66, 79]]];
  legends.forEach(([label, color], index) => {
    const x = 18 + index * 34;
    doc.setFillColor(...color);
    doc.circle(x, legendY, 1.1, 'F');
    doc.setTextColor(85, 98, 113);
    doc.setFontSize(7);
    doc.text(label, x + 3, legendY + 1);
  });
  doc.setTextColor(125, 135, 146);
  doc.text(`Generado ${new Date().toLocaleDateString('es-ES')}`, 192, legendY + 1, { align: 'right' });
  doc.setDrawColor(224, 230, 236);
  doc.line(12, top + 128, 198, top + 128);
}

async function generateTrendsReport(measurements: Measurement[], players: Player[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  if (!players.length) {
    doc.text('No hay jugadores para generar el informe.', 14, 20);
  } else {
    players.forEach((player, index) => {
      if (index > 0 && index % 2 === 0) doc.addPage();
      drawPlayerBlock(doc, player, measurements, index % 2 === 0 ? 10 : 151);
    });
  }
  addPdfFooters(doc);
  doc.save(`zabal-tendencias-jugadores-${todayKey()}.pdf`);
}

export const generatePdfReport = async ({ kind, measurements, players, matches = [], attendance = [], playerId }: ReportOptions) => {
  if (kind === 'weekly') return generateTrendsReport(measurements, players);
  if (kind === 'player') {
    const player = players.find((item) => item.id === playerId);
    if (!player) return;
    return generatePlayerPdf(player, measurements, matches, attendance);
  }

  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  let items = [...measurements];
  if (kind === 'daily') items = items.filter((item) => item.date === todayKey());
  if (kind === 'alerts') items = items.filter((item) => getAlertLevel(item) === 'alert');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(22, 54, 95);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setFillColor(246, 202, 59);
  doc.rect(0, 35, 210, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('ZABAL PERFORMANCE', 14, 15);
  doc.setFontSize(10);
  doc.text(`${reportTitle[kind]} · Temporada ${appConfig.season}`, 14, 24);
  doc.setTextColor(35, 49, 66);
  doc.setFontSize(9);
  doc.text(`${appConfig.teamName} · Generado ${new Date().toLocaleString('es-ES')}`, 14, 46);

  const reportPlayers = players;
  const injurySummary = reportPlayers.filter((player) => (player.injuries?.length ?? 0) > 0).map((player) => `${player.name}: ${totalInjuryDays(player)} días${player.injured ? ' (activa)' : ''}`);

  const registered = new Set(items.map((item) => item.playerId)).size;
  const alerts = items.filter((item) => getAlertLevel(item) === 'alert').length;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Mediciones: ${items.length}   Jugadores: ${registered}/${players.length}   Alertas: ${alerts}`, 14, 57);
  if (injurySummary.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(115, 61, 68);
    doc.text(`Bajas: ${injurySummary.join(' · ')}`, 14, 62, { maxWidth: 182 });
  }

  autoTable(doc, {
    startY: injurySummary.length ? 69 : 64,
    head: [['Fecha', 'Jugador', 'Peso', 'Fatiga', 'Molestias', 'Comentarios']],
    body: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => [item.date, item.playerName, item.weight !== undefined ? `${item.weight} kg` : '—', item.fatigue ?? '—', item.soreness ?? '—', item.comments || '—']),
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 34 }, 2: { cellWidth: 18 }, 3: { cellWidth: 14 }, 4: { cellWidth: 17 } },
  });

  if (!items.length) {
    doc.setFont('helvetica', 'normal');
    doc.text('No hay mediciones para los filtros de este informe.', 14, 76);
  }
  addPdfFooters(doc);
  doc.save(`zabal-${kind}-${todayKey()}.pdf`);
};
