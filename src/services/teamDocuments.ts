import { appConfig } from '../config';
import type { AttendanceRecord, MatchRecord, Player } from '../types';

async function documentBase(title: string, subtitle: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(22, 54, 95); doc.rect(0, 0, 210, 35, 'F');
  doc.setFillColor(246, 202, 59); doc.rect(0, 35, 210, 3, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('ZABAL PERFORMANCE', 14, 14);
  doc.setFontSize(10); doc.text(title, 14, 24);
  doc.setTextColor(22, 54, 95); doc.setFontSize(9); doc.text(doc.splitTextToSize(appConfig.teamName + ' · ' + appConfig.season + ' · ' + subtitle, 180), 14, 46);
  return { doc, autoTable };
}

function finish(doc: Awaited<ReturnType<typeof documentBase>>['doc']) {
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setDrawColor(246, 202, 59); doc.line(14, 280, 196, 280);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 106, 125);
    doc.text('Creado y diseñado por Raul Cote', 14, 287); doc.text(page + ' / ' + doc.getNumberOfPages(), 196, 287, { align: 'right' });
  }
}

export async function createAttendanceDocument(players: Player[], records: AttendanceRecord[], label: string) {
  const { doc, autoTable } = await documentBase('Informe de asistencia', label);
  const roster = players.filter((player) => !('staffMember' in player && player.staffMember));
  const dates = [...new Set(records.filter((record) => record.status !== 'pending').map((record) => record.date))];
  const rows = roster.map((player) => {
    const byDate = new Map(records.filter((record) => record.playerId === player.id).map((record) => [record.date, record.status as string]));
    const present = dates.filter((date) => ['present', 'late', 'individual'].includes(byDate.get(date) || '')).length;
    const absent = dates.filter((date) => ['absent', 'justified', 'unjustified', 'medical'].includes(byDate.get(date) || '')).length;
    return [player.number ?? '-', player.name, present, absent, dates.length - present - absent, dates.length ? Math.round(present / dates.length * 100) + '%' : '-'];
  });
  doc.text('Entrenamientos: ' + dates.length + ' · Jugadores: ' + roster.length, 14, 57);
  autoTable(doc, { startY: 64, head: [['Dorsal', 'Jugador', 'Presente', 'Ausente', 'Pendiente', '%']], body: rows, margin: { top: 18, bottom: 22 }, styles: { fontSize: 8.5, cellPadding: 2.4 }, headStyles: { fillColor: [22,54,95] }, alternateRowStyles: { fillColor: [244,247,250] } });
  finish(doc); return doc;
}
export async function downloadAttendanceDocument(players: Player[], records: AttendanceRecord[], label: string) {
  const doc = await createAttendanceDocument(players, records, label); doc.save('zabal-asistencia.pdf');
}
export async function createMatchDocument(match: MatchRecord, players: Player[]) {
  const result = match.goalsFor === undefined || match.goalsAgainst === undefined ? 'Sin registrar' : match.goalsFor + ' - ' + match.goalsAgainst;
  const { doc, autoTable } = await documentBase('Informe de partido · ' + match.date, 'Rival: ' + match.opponent);
  const captain = players.find((player) => player.id === match.captainId)?.name || match.minutes.find((entry) => entry.playerId === match.captainId)?.playerName || 'Sin registrar';
  autoTable(doc, { startY: 57, theme: 'plain', body: [['Resultado (Zabal - rival)', result], ['Árbitro', match.referee || 'Sin registrar'], ['Capitán', captain], ['Tipo / duración', (match.type === 'official' ? 'Oficial' : 'Amistoso') + ' · ' + match.durationMinutes + ' minutos']], styles: { fontSize: 10, cellPadding: 3 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 } } });
  const tableEnd = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  autoTable(doc, { startY: tableEnd + 7, head: [['Jugador', 'Conv.', 'Tit.', 'Min.', 'Goles', 'TA', 'TR']], body: match.minutes.map((entry) => {
    const detail = entry as typeof entry & { calledUp?: boolean; starter?: boolean; goals?: number; yellowCards?: number; redCards?: number };
    return [entry.playerName, detail.calledUp === false ? 'No' : 'Sí', detail.starter ? 'Sí' : '-', entry.minutes, detail.goals ?? 0, detail.yellowCards ?? 0, detail.redCards ?? 0];
  }), margin: { top: 18, bottom: 22 }, styles: { fontSize: 8.5, cellPadding: 2.4 }, headStyles: { fillColor: [22,54,95] }, alternateRowStyles: { fillColor: [244,247,250] } });
  const finalY = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  autoTable(doc, { startY: finalY + 7, head: [['Incidencias']], body: [[match.incidents || 'Sin incidencias registradas.']], margin: { top: 18, bottom: 22 }, styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [22,54,95] } });
  finish(doc); return doc;
}
export async function downloadMatchDocument(match: MatchRecord, players: Player[]) {
  const doc = await createMatchDocument(match, players); doc.save('zabal-partido-' + match.date + '.pdf');
}
