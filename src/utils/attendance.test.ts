import { describe, expect, it } from 'vitest';
import type { AttendanceRecord, Player } from '../types';
import { attendanceRankings, filterAttendancePeriod, playerIsInjuredOn } from './attendance';

const players: Player[] = [
  { id: 'p1', name: 'Uno', active: true, order: 1, joinedAt: '2026-07-01' },
  { id: 'p2', name: 'Dos', active: true, order: 2, joinedAt: '2026-07-01' },
];
const record = (playerId: string, date: string, status: AttendanceRecord['status'], lateMinutes = 0): AttendanceRecord => ({
  id: `${playerId}-${date}-${status}`, date, playerId, playerName: playerId === 'p1' ? 'Uno' : 'Dos', status, lateMinutes,
  comments: '', createdAt: `${date}T18:00:00Z`, updatedAt: `${date}T18:00:00Z`, createdBy: 'cuerpo-tecnico',
});

describe('asistencia', () => {
  it('ordena el top de retrasos por minutos acumulados', () => {
    const rankings = attendanceRankings(players, [record('p1', '2026-08-10', 'late', 8), record('p1', '2026-08-12', 'late', 5), record('p2', '2026-08-11', 'late', 10)]);
    expect(rankings.late.map((row) => [row.playerId, row.lateMinutes])).toEqual([['p1', 13], ['p2', 10]]);
  });

  it('separa faltas justificadas, injustificadas y bajas', () => {
    const row = attendanceRankings(players, [record('p1', '2026-08-10', 'justified'), record('p1', '2026-08-11', 'unjustified'), record('p1', '2026-08-12', 'medical')]).absences[0];
    expect(row).toMatchObject({ playerId: 'p1', totalAbsences: 3, justified: 1, unjustified: 1, medical: 1 });
  });

  it('filtra semanas y detecta una baja en su periodo histórico', () => {
    const items = [record('p1', '2026-08-10', 'present'), record('p1', '2026-08-18', 'present')];
    expect(filterAttendancePeriod(items, 'week', '2026-W33')).toHaveLength(1);
    expect(playerIsInjuredOn({ ...players[0], injuries: [{ id: 'i1', startDate: '2026-08-01', endDate: '2026-08-15' }] }, '2026-08-10')).toBe(true);
  });
});
