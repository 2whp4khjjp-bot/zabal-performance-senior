import { appConfig } from '../config';
import type { InjuryPeriod, Player } from '../types';
import { todayKey } from '../utils/date';
import { injuryPeriodDays } from '../utils/injuries';
import { addPdfFooters } from './pdfBrand';

type PlayerInjurySummary = {
  player: Player;
  active: boolean;
  periods: number;
  days: number;
  currentReason: string;
};

type InjuryHistoryRow = {
  player: Player;
  period: InjuryPeriod;
  days: number;
};

export const buildTeamInjuryReportData = (players: Player[], today = todayKey()) => {
  const roster = players.filter((player) => player.active && !player.staffMember);
  const summary: PlayerInjurySummary[] = roster.map((player) => {
    const injuries = player.injuries ?? [];
    const activePeriod = injuries.find((period) => !period.endDate);
    return {
      player,
      active: Boolean(activePeriod || player.injured),
      periods: injuries.length,
      days: injuries.reduce((sum, period) => sum + injuryPeriodDays(period, today), 0),
      currentReason: activePeriod?.reason || '',
    };
  });
  const history: InjuryHistoryRow[] = roster.flatMap((player) => (player.injuries ?? []).map((period) => ({
    player,
    period,
    days: injuryPeriodDays(period, today),
  }))).sort((a, b) => b.period.startDate.localeCompare(a.period.startDate) || a.player.name.localeCompare(b.player.name, 'es'));

  return {
    roster,
    summary,
    history,
    activeCount: summary.filter((item) => item.active).length,
    affectedCount: summary.filter((item) => item.periods > 0).length,
    totalDays: history.reduce((sum, item) => sum + item.days, 0),
  };
};

const compactDate = (value?: string) => value ? value.split('-').reverse().join('/') : '—';

export async function createTeamInjuriesPdf(players: Player[]) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const report = buildTeamInjuryReportData(players);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  doc.setFillColor(22, 54, 95);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setFillColor(246, 202, 59);
  doc.rect(0, 36, 210, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('ZABAL PERFORMANCE', 14, 15);
  doc.setFontSize(10);
  doc.text(`Informe de bajas de la plantilla · Temporada ${appConfig.season}`, 14, 25);
  doc.setTextColor(35, 49, 66);
  doc.setFontSize(9);
  doc.text(`${appConfig.teamName} · Generado ${new Date().toLocaleString('es-ES')}`, 14, 47);

  const metrics = [
    ['Plantilla', report.roster.length],
    ['Bajas activas', report.activeCount],
    ['Con historial', report.affectedCount],
    ['Días acumulados', report.totalDays],
  ] as const;
  metrics.forEach(([label, value], index) => {
    const x = 14 + index * 46;
    doc.setFillColor(index === 1 && report.activeCount ? 255 : 244, index === 1 && report.activeCount ? 237 : 247, index === 1 && report.activeCount ? 238 : 250);
    doc.roundedRect(x, 53, 42, 17, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(index === 1 && report.activeCount ? 174 : 22, index === 1 && report.activeCount ? 46 : 54, index === 1 && report.activeCount ? 59 : 95);
    doc.text(String(value), x + 4, 61);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(98, 112, 128);
    doc.text(label, x + 4, 67);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(22, 54, 95);
  doc.text('Estado completo de la plantilla', 14, 80);
  autoTable(doc, {
    startY: 85,
    head: [['Jugador', 'Estado actual', 'Periodos', 'Días', 'Motivo actual']],
    body: report.summary.map((item) => [
      item.player.name,
      item.active ? 'BAJA ACTIVA' : 'Disponible',
      item.periods,
      item.days,
      item.active ? item.currentReason || 'No indicado' : '—',
    ]),
    styles: { fontSize: 7.2, cellPadding: 1.7, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 248, 251] },
    columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 29 }, 2: { cellWidth: 20 }, 3: { cellWidth: 18 }, 4: { cellWidth: 67 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1 && data.cell.raw === 'BAJA ACTIVA') {
        data.cell.styles.textColor = [174, 46, 59];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { top: 15, bottom: 18, left: 14, right: 14 },
  });

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(22, 54, 95);
  doc.text('Historial completo de bajas', 14, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(98, 112, 128);
  doc.text(`${report.history.length} periodos registrados en la temporada`, 14, 27);

  if (report.history.length) {
    autoTable(doc, {
      startY: 33,
      head: [['Jugador', 'Inicio', 'Alta', 'Días', 'Motivo']],
      body: report.history.map((item) => [
        item.player.name,
        compactDate(item.period.startDate),
        item.period.endDate ? compactDate(item.period.endDate) : 'ACTIVA',
        item.days,
        item.period.reason || 'No indicado',
      ]),
      styles: { fontSize: 7.6, cellPadding: 2.4, overflow: 'linebreak' },
      headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 248, 251] },
      columnStyles: { 0: { cellWidth: 47 }, 1: { cellWidth: 25 }, 2: { cellWidth: 25 }, 3: { cellWidth: 18 }, 4: { cellWidth: 67 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2 && data.cell.raw === 'ACTIVA') {
          data.cell.styles.textColor = [174, 46, 59];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { top: 15, bottom: 18, left: 14, right: 14 },
    });
  } else {
    doc.setFontSize(10);
    doc.text('No hay periodos de baja registrados para esta plantilla.', 14, 43);
  }

  addPdfFooters(doc);
  return doc;
}

export async function generateTeamInjuriesPdf(players: Player[]) {
  const doc = await createTeamInjuriesPdf(players);
  doc.save(`zabal-informe-bajas-plantilla-${todayKey()}.pdf`);
}
