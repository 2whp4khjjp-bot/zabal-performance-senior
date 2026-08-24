import { appConfig } from '../config';
import type { AttendanceRecord, MatchRecord, Measurement, Player } from '../types';
import { formatDate, todayKey } from '../utils/date';
import { analyzePlayer } from '../utils/playerAnalysis';
import { injuryPeriodDays } from '../utils/injuries';
import { addPdfFooters } from './pdfBrand';

type PdfDocument = import('jspdf').jsPDF;
type AutoTable = typeof import('jspdf-autotable').autoTable;

const statusLabel: Record<AttendanceRecord['status'], string> = {
  pending: 'Pendiente', present: 'Asiste', late: 'Llega tarde', justified: 'Falta justificada',
  unjustified: 'Falta sin justificar', individual: 'Trabajo individual', medical: 'Baja médica',
};

function addHeader(doc: PdfDocument, title: string, subtitle: string) {
  doc.setFillColor(22, 54, 95);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setFillColor(246, 202, 59);
  doc.rect(0, 35, 210, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('ZABAL PERFORMANCE', 14, 14);
  doc.setFontSize(10);
  doc.text(title, 14, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(subtitle, 196, 24, { align: 'right' });
}

function metric(doc: PdfDocument, x: number, y: number, width: number, label: string, value: string, note: string) {
  doc.setDrawColor(218, 226, 234);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, 24, 2.5, 2.5, 'FD');
  doc.setTextColor(94, 110, 128);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(label.toUpperCase(), x + 4, y + 6);
  doc.setTextColor(22, 54, 95);
  doc.setFontSize(13);
  doc.text(value, x + 4, y + 14);
  doc.setTextColor(105, 119, 134);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(note, x + 4, y + 20, { maxWidth: width - 8 });
}

function miniTrend(doc: PdfDocument, x: number, y: number, width: number, label: string, values: number[], color: [number, number, number]) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 54, 95);
  doc.text(label, x, y);
  doc.setDrawColor(224, 230, 236);
  doc.setFillColor(250, 251, 253);
  doc.roundedRect(x, y + 3, width, 25, 2, 2, 'FD');
  if (!values.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 132, 145);
    doc.text('Sin datos', x + width / 2, y + 17, { align: 'center' });
    return;
  }
  const shown = values.slice(-12);
  const min = Math.min(...shown);
  const max = Math.max(...shown);
  const left = x + 5;
  const right = x + width - 5;
  const top = y + 8;
  const bottom = y + 24;
  let previous: [number, number] | undefined;
  shown.forEach((value, index) => {
    const px = shown.length === 1 ? (left + right) / 2 : left + index * (right - left) / (shown.length - 1);
    const py = bottom - (value - min) * (bottom - top) / Math.max(1, max - min);
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.setLineWidth(.55);
    if (previous) doc.line(previous[0], previous[1], px, py);
    doc.circle(px, py, .7, 'F');
    previous = [px, py];
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(110, 122, 136);
  doc.text(`${shown.at(-1)}`, right, y + 27, { align: 'right' });
}

function addSectionPage(doc: PdfDocument, title: string, subtitle: string) {
  doc.addPage();
  addHeader(doc, title, subtitle);
  doc.setTextColor(36, 50, 68);
}

function emptySection(doc: PdfDocument, message: string) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(112, 125, 140);
  doc.text(message, 14, 52);
}

export async function buildPlayerPdf(player: Player, measurements: Measurement[], matches: MatchRecord[], attendance: AttendanceRecord[]) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const analysis = analyzePlayer(player, measurements, matches, attendance);
  addHeader(doc, 'Informe integral del jugador', `${appConfig.teamName} · ${appConfig.season}`);

  doc.setTextColor(22, 54, 95);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(player.name, 14, 51);
  doc.setFontSize(8);
  doc.setTextColor(100, 114, 130);
  doc.text(`Plantilla Senior · Generado ${new Date().toLocaleString('es-ES')}`, 14, 58);
  if (player.injured) {
    doc.setFillColor(255, 235, 237);
    doc.setTextColor(157, 43, 55);
    doc.roundedRect(150, 44, 46, 16, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('BAJA ACTIVA', 173, 50, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(player.injuries?.find((period) => !period.endDate)?.reason || 'Motivo no indicado', 173, 56, { align: 'center', maxWidth: 40 });
  }

  metric(doc, 14, 67, 43, 'Controles', String(analysis.measurements.length), `${analysis.wellness.highFatigue + analysis.wellness.highSoreness} valores en alerta`);
  metric(doc, 60, 67, 43, 'Peso', analysis.weight.latest === undefined ? '—' : `${analysis.weight.latest} kg`, analysis.weight.change === undefined ? 'Sin tendencia' : `${analysis.weight.change > 0 ? '+' : ''}${analysis.weight.change} kg en el periodo`);
  metric(doc, 106, 67, 43, 'Competición', `${analysis.competition.minutes} min`, `${analysis.competition.goals} goles · ${analysis.competition.starts} titularidades`);
  metric(doc, 152, 67, 44, 'Disponibilidad', `${analysis.availability.injuryDays} días`, `${analysis.availability.lateMinutes} min de retraso`);

  miniTrend(doc, 14, 102, 57, 'Peso (kg)', analysis.measurements.flatMap((item) => item.weight === undefined ? [] : [item.weight]), [41, 110, 175]);
  miniTrend(doc, 76, 102, 57, 'Fatiga (1-10)', analysis.measurements.flatMap((item) => item.fatigue === undefined ? [] : [item.fatigue]), [211, 146, 0]);
  miniTrend(doc, 139, 102, 57, 'Molestias (1-10)', analysis.measurements.flatMap((item) => item.soreness === undefined ? [] : [item.soreness]), [200, 66, 79]);

  doc.setFillColor(22, 54, 95);
  doc.roundedRect(14, 139, 182, 9, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CONCLUSIÓN DEL ANÁLISIS', 18, 145);
  let conclusionY = 155;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.1);
  doc.setTextColor(48, 64, 82);
  analysis.conclusions.forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph, 169) as string[];
    doc.setFillColor(246, 202, 59);
    doc.circle(18, conclusionY - 1.2, .8, 'F');
    doc.text(lines, 22, conclusionY);
    conclusionY += lines.length * 4.2 + 2.2;
  });
  doc.setDrawColor(225, 211, 150);
  doc.setFillColor(255, 250, 230);
  doc.roundedRect(14, Math.min(conclusionY + 1, 268), 182, 12, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(103, 89, 43);
  doc.text('Lectura orientativa basada en los registros disponibles. No constituye un diagnóstico médico ni sustituye la valoración profesional.', 18, Math.min(conclusionY + 8, 275), { maxWidth: 174 });

  addSectionPage(doc, 'Historial de mediciones', `${player.name} · ${analysis.measurements.length} controles`);
  if (analysis.measurements.length) autoTable(doc, {
    startY: 45,
    head: [['Fecha', 'Hora', 'Peso', 'Fatiga', 'Molestias', 'Comentarios']],
    body: [...analysis.measurements].reverse().map((item) => [formatDate(item.date), item.time || '—', item.weight === undefined ? '—' : `${Number(item.weight.toFixed(2))} kg`, item.fatigue ?? '—', item.soreness ?? '—', item.comments || '—']),
    styles: { fontSize: 7.5, cellPadding: 2.1, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [246, 248, 251] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 14 }, 2: { cellWidth: 19 }, 3: { cellWidth: 16 }, 4: { cellWidth: 20 } },
    margin: { top: 28, bottom: 18 },
    didDrawPage: (data) => {
      if (data.pageNumber <= 1) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(22, 54, 95);
      doc.text(`Historial de mediciones · ${player.name} · continuación`, 14, 15);
      doc.setDrawColor(246, 202, 59); doc.setLineWidth(.8); doc.line(14, 20, 196, 20);
    },
  }); else emptySection(doc, 'No hay mediciones registradas para este jugador.');

  addSectionPage(doc, 'Partidos y rendimiento', `${player.name} · ${analysis.competition.minutes} minutos acumulados`);
  if (analysis.matches.length) autoTable(doc, {
    startY: 45,
    head: [['Fecha', 'Rival', 'Tipo', 'Conv.', 'Tit.', 'Min.', 'Goles', 'TA', 'TR']],
    body: [...analysis.matches].reverse().map((match) => {
      const entry = match.minutes.find((item) => item.playerId === player.id)!;
      return [formatDate(match.date), match.opponent, match.type === 'official' ? 'Oficial' : 'Amistoso', entry.calledUp ? 'Sí' : 'No', entry.starter ? 'Sí' : 'No', entry.minutes, entry.goals ?? 0, entry.yellowCards ?? 0, entry.redCards ?? 0];
    }),
    styles: { fontSize: 7.4, cellPadding: 2.1, halign: 'center' },
    headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [246, 248, 251] },
    columnStyles: { 1: { halign: 'left', cellWidth: 47 } },
    margin: { top: 28, bottom: 18 },
    didDrawPage: (data) => {
      if (data.pageNumber <= 1) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(22, 54, 95);
      doc.text(`Partidos y rendimiento · ${player.name} · continuación`, 14, 15);
      doc.setDrawColor(246, 202, 59); doc.setLineWidth(.8); doc.line(14, 20, 196, 20);
    },
  }); else emptySection(doc, 'No hay partidos registrados para este jugador.');

  addSectionPage(doc, 'Disponibilidad y asistencia', `${player.name} · seguimiento de la temporada`);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Periodos de baja', 14, 47);
  if (player.injuries?.length) autoTable(doc, {
    startY: 51,
    head: [['Inicio', 'Final', 'Duración', 'Motivo']],
    body: [...player.injuries].reverse().map((period) => [formatDate(period.startDate), period.endDate ? formatDate(period.endDate) : 'Activa', `${injuryPeriodDays(period)} días`, period.reason || 'No indicado']),
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [246, 248, 251] },
    columnStyles: { 3: { cellWidth: 85 } },
    margin: { bottom: 18 },
  }); else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(112, 125, 140); doc.text('No hay periodos de baja registrados.', 14, 55);
  }
  const injuryTable = doc as PdfDocument & { lastAutoTable?: { finalY: number } };
  const attendanceStart = Math.max(68, (injuryTable.lastAutoTable?.finalY ?? 58) + 12);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(22, 54, 95); doc.text('Asistencia a entrenamientos', 14, attendanceStart);
  if (analysis.attendance.length) autoTable(doc, {
    startY: attendanceStart + 4,
    head: [['Fecha', 'Estado', 'Retraso', 'Observación']],
    body: [...analysis.attendance].reverse().map((item) => [formatDate(item.date), statusLabel[item.status], item.status === 'late' ? `${item.lateMinutes} min` : '—', item.comments || '—']),
    styles: { fontSize: 7.5, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [246, 248, 251] },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 37 }, 2: { cellWidth: 20 } },
    margin: { top: 28, bottom: 18 },
    didDrawPage: (data) => {
      if (data.pageNumber <= 1) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(22, 54, 95);
      doc.text(`Asistencia · ${player.name} · continuación`, 14, 15);
      doc.setDrawColor(246, 202, 59); doc.setLineWidth(.8); doc.line(14, 20, 196, 20);
    },
  }); else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(112, 125, 140); doc.text('No hay registros de asistencia para este jugador.', 14, attendanceStart + 8);
  }

  addPdfFooters(doc);
  return doc;
}

export async function generatePlayerPdf(player: Player, measurements: Measurement[], matches: MatchRecord[], attendance: AttendanceRecord[]) {
  const doc = await buildPlayerPdf(player, measurements, matches, attendance);
  const safeName = player.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`zabal-informe-${safeName}-${todayKey()}.pdf`);
}
