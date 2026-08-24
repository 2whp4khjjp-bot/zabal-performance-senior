import { appConfig } from '../config';
import type { AttendanceRecord, Player } from '../types';
import { todayKey } from '../utils/date';
import { addPdfFooters } from './pdfBrand';

export async function generateAttendancePdf(players: Player[], records: AttendanceRecord[], periodLabel: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const roster = players.filter((player) => !player.staffMember).sort((a, b) => a.order - b.order);
  const sessionDates = [...new Set(records.map((record) => record.date))];
  const rows = roster.map((player) => {
    const playerRecords = records.filter((record) => record.playerId === player.id);
    const present = playerRecords.filter((record) => record.status === 'present').length;
    const absent = playerRecords.filter((record) => record.status !== 'present').length;
    const total = present + absent;
    return { player, present, absent, percentage: total ? Math.round((present / total) * 100) : 0 };
  });
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
  doc.text(`Informe de asistencia · ${periodLabel}`, 14, 24);
  doc.setTextColor(35, 49, 66);
  doc.setFontSize(9);
  doc.text(`${appConfig.teamName} · Temporada ${appConfig.season}`, 14, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Entrenamientos registrados: ${sessionDates.length}   Jugadores: ${roster.length}`, 14, 57);

  autoTable(doc, {
    startY: 64,
    head: [['Jugador', 'Presente', 'No presente', '% asistencia']],
    body: rows.map((row) => [row.player.name, row.present, row.absent, `${row.percentage}%`]),
    margin: { bottom: 18 },
    styles: { fontSize: 8.5, cellPadding: 2.3, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 54, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 88 }, 1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 31, halign: 'center' }, 3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
  });
  addPdfFooters(doc);
  doc.save(`zabal-asistencia-${todayKey()}.pdf`);
}
