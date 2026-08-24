import type { AttendanceRecord, Player } from '../types';
import { playerIsInjuredOn } from './injuries';

export type AttendancePeriod = 'week' | 'month' | 'season';

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

export const filterAttendancePeriod = (items: AttendanceRecord[], period: AttendancePeriod, value: string) => {
  if (period === 'season') return items;
  if (period === 'month') return items.filter((item) => item.date.startsWith(value));
  const [start, end] = weekBounds(value);
  return items.filter((item) => item.date >= start && item.date <= end);
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
