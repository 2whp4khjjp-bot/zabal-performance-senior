import { appConfig } from '../config';
import type { MatchRecord, Player } from '../types';
import { todayKey } from '../utils/date';
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
