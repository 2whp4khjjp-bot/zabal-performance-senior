import { appConfig } from '../config';
import type { MatchRecord, Player } from '../types';
import { todayKey } from '../utils/date';
import { buildMatchTotals, buildSeasonRankings, type MatchTotalRow } from '../utils/matchStatistics';
import { addPdfFooters } from './pdfBrand';

export const generateMinutesPdf = async (players: Player[], matches: MatchRecord[]) => {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const totals = new Map(players.filter((player) => !player.staffMember).map((player) => [player.id, {
    player, callUps: 0, starts: 0, appearances: 0, minutes: 0,
  }]));
  matches.forEach((match) => match.minutes.forEach((entry) => {
    const total = totals.get(entry.playerId);
    if (!total) return;
    if (entry.calledUp) total.callUps += 1;
    if (entry.starter) total.starts += 1;
    if (entry.minutes > 0) total.appearances += 1;
    total.minutes += entry.minutes;
  }));
  const rows = [...totals.values()].sort((a, b) => a.player.order - b.player.order);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  doc.setFillColor(22, 54, 95);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setFillColor(246, 202, 59);
  doc.rect(0, 35, 210, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('ZABAL PERFORMANCE', 14, 15);
  doc.setFontSize(10);
  doc.text(`Informe de minutos · Temporada ${appConfig.season}`, 14, 24);
  doc.setTextColor(35, 49, 66);
  doc.setFontSize(9);
  doc.text(`${appConfig.teamName} · Generado ${new Date().toLocaleString('es-ES')}`, 14, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  doc.text(`Partidos: ${matches.length}   Jugadores: ${rows.length}   Minutos acumulados: ${totalMinutes}`, 14, 57);

  autoTable(doc, {
    startY: 64,
    head: [['Jugador', 'Conv.', 'Tit.', 'PJ', 'Minutos', 'Media/PJ']],
    body: rows.map((row) => [
      row.player.name, row.callUps, row.starts, row.appearances, row.minutes,
      row.appearances ? (row.minutes / row.appearances).toFixed(1) : '—',
    ]),
    margin: { bottom: 18 },
    styles: { fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 70 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' }, 4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 25, halign: 'right' },
    },
  });
  addPdfFooters(doc);
  doc.save(`zabal-minutos-${todayKey()}.pdf`);
};

export const generateSeasonStatisticsPdf = async (players: Player[], matches: MatchRecord[]) => {
  const { jsPDF } = await import('jspdf');
  const totals = buildMatchTotals(players, matches);
  const rankings = buildSeasonRankings(totals);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  doc.setFillColor(22, 54, 95);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setFillColor(246, 202, 59);
  doc.rect(0, 35, 210, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('ZABAL PERFORMANCE', 14, 15);
  doc.setFontSize(10);
  doc.text(`Informe estadístico · Temporada ${appConfig.season}`, 14, 24);
  doc.setTextColor(35, 49, 66);
  doc.setFontSize(9);
  doc.text(`${appConfig.teamName} · ${matches.length} partidos registrados · Generado ${new Date().toLocaleString('es-ES')}`, 14, 47);

  const drawRanking = (x: number, y: number, width: number, title: string, items: MatchTotalRow[], value: (item: MatchTotalRow) => string) => {
    doc.setFillColor(247, 249, 251);
    doc.setDrawColor(217, 227, 236);
    doc.roundedRect(x, y, width, 104, 3, 3, 'FD');
    doc.setFillColor(22, 54, 95);
    doc.roundedRect(x, y, width, 15, 3, 3, 'F');
    doc.rect(x, y + 9, width, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, x + 6, y + 9.5);
    const visible = items.slice(0, 8);
    visible.forEach((item, index) => {
      const rowY = y + 24 + index * 9.2;
      if (index > 0) {
        doc.setDrawColor(226, 232, 238);
        doc.line(x + 6, rowY - 5.7, x + width - 6, rowY - 5.7);
      }
      doc.setTextColor(96, 112, 128);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(String(index + 1), x + 6, rowY);
      doc.setTextColor(35, 49, 66);
      doc.text(item.player.name.slice(0, 28), x + 13, rowY);
      doc.setTextColor(22, 54, 95);
      doc.text(value(item), x + width - 6, rowY, { align: 'right' });
    });
    if (!visible.length) {
      doc.setTextColor(112, 126, 141);
      doc.setFont('helvetica', 'normal');
      doc.text('Sin datos registrados', x + 6, y + 28);
    }
  };

  drawRanking(14, 57, 88, 'TOP GOLEADORES', rankings.scorers, (item) => `${item.goals} goles`);
  drawRanking(108, 57, 88, 'TOP CONVOCADOS', rankings.callUps, (item) => `${item.callUps} conv.`);
  drawRanking(14, 168, 88, 'TOP MINUTOS', rankings.minutes, (item) => `${item.minutes} min`);
  drawRanking(108, 168, 88, 'TOP TITULARIDADES', rankings.starters, (item) => `${item.starts} tit.`);
  addPdfFooters(doc);
  doc.save(`zabal-estadisticas-temporada-${todayKey()}.pdf`);
};
