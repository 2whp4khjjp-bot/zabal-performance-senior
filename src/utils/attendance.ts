import type { AttendanceRecord, Player } from '../types';
import { playerIsInjuredOn } from './injuries';

export type AttendancePeriod = 'week' | 'month' | 'quarter' | 'semester' | 'season';

export { playerIsInjuredOn } from './injuries';

export const currentIsoWeek = (date = new Date()) => {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const weekBounds = (value: string) => {
  const [yearText, weekText] = value.split('-W');
  const year = Number(yearText);
  const week = Number(weekText);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - (januaryFourth.getUTCDay() || 7) + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)] as const;
};

export const attendancePeriodLabels: Record<AttendancePeriod, string> = {
  week: '1 semana', month: '1 mes', quarter: '3 meses', semester: '6 meses', season: 'Temporada',
};

const rollingDays: Partial<Record<AttendancePeriod, number>> = { week: 7, month: 30, quarter: 90, semester: 180 };

export const filterAttendancePeriod = (items: AttendanceRecord[], period: AttendancePeriod, referenceDate: string) => {
  if (period === 'season') return items.filter((item) => item.date <= referenceDate);
  if (period === 'week' && /^\d{4}-W\d{2}$/.test(referenceDate)) {
    const [start, end] = weekBounds(referenceDate);
    return items.filter((item) => item.date >= start && item.date <= end);
  }
  if (period === 'month' && /^\d{4}-\d{2}$/.test(referenceDate)) return items.filter((item) => item.date.startsWith(referenceDate));
  const end = new Date(`${referenceDate}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - ((rollingDays[period] ?? 1) - 1));
  const startKey = start.toISOString().slice(0, 10);
  return items.filter((item) => item.date >= startKey && item.date <= referenceDate);
};

export const attendanceSummary = (players: Player[], records: AttendanceRecord[]) => {
  const roster = players.filter((player) => !player.staffMember);
  const sessionDates = [...new Set(records.filter((record) => record.status !== 'pending').map((record) => record.date))].sort();
  const attendedStatuses = new Set(['present', 'late', 'individual']);
  const recordsByPlayer = new Map<string, Map<string, AttendanceRecord>>();
  records.forEach((record) => {
    if (!recordsByPlayer.has(record.playerId)) recordsByPlayer.set(record.playerId, new Map());
    recordsByPlayer.get(record.playerId)?.set(record.date, record);
  });
  const rows = roster.map((player) => {
    const playerRecords = recordsByPlayer.get(player.id);
    const attended = sessionDates.reduce((total, date) => total + (attendedStatuses.has(playerRecords?.get(date)?.status ?? '') ? 1 : 0), 0);
    const absences = Math.max(0, sessionDates.length - attended);
    const percent = sessionDates.length ? Math.round((attended / sessionDates.length) * 100) : 0;
    return { playerId: player.id, playerName: player.name, number: player.number ?? player.order, attended, absences, percent };
  });
  const averagePercent = rows.length ? Math.round(rows.reduce((total, row) => total + row.percent, 0) / rows.length) : 0;
  return { sessionCount: sessionDates.length, averagePercent, perfectCount: rows.filter((row) => row.percent === 100 && sessionDates.length > 0).length, rows };
};

export const attendanceRankings = (players: Player[], records: AttendanceRecord[]) => {
  const byPlayer = new Map(players.filter((player) => !player.staffMember).map((player) => [player.id, {
    playerId: player.id, playerName: player.name, delays: 0, lateMinutes: 0,
    justified: 0, unjustified: 0, medical: 0, totalAbsences: 0,
  }]));
  records.forEach((record) => {
    const row = byPlayer.get(record.playerId);
    if (!row) return;
    if (record.status === 'late') { row.delays += 1; row.lateMinutes += record.lateMinutes; }
    if (record.status === 'justified') row.justified += 1;
    if (record.status === 'unjustified') row.unjustified += 1;
    if (record.status === 'medical') row.medical += 1;
    row.totalAbsences = row.justified + row.unjustified + row.medical;
  });
  const all = [...byPlayer.values()];
  const late = all.filter((row) => row.lateMinutes > 0).sort((a, b) => b.lateMinutes - a.lateMinutes || b.delays - a.delays || a.playerName.localeCompare(b.playerName, 'es')).slice(0, 5);
  const absences = all.sort((a, b) => b.totalAbsences - a.totalAbsences || b.unjustified - a.unjustified || a.playerName.localeCompare(b.playerName, 'es'));
  return { late, absences };
};
