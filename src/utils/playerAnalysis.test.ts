import { describe, expect, it } from 'vitest';
import type { AttendanceRecord, MatchRecord, Measurement, Player } from '../types';
import { analyzePlayer } from './playerAnalysis';

const player: Player = { id: 'p1', name: 'Jugador', active: true, order: 1, joinedAt: '2026-07-01', injuries: [{ id: 'i1', startDate: '2026-08-01', endDate: '2026-08-03', reason: 'Esguince' }] };
const measurements: Measurement[] = [
  { id: 'm1', date: '2026-08-01', time: '10:00', createdAt: '2026-08-01T10:00:00Z', playerId: 'p1', playerName: 'Jugador', weight: 70, fatigue: 3, soreness: 2, comments: '', sessionId: 's', createdBy: 'ct', updatedAt: '' },
  { id: 'm2', date: '2026-08-08', time: '10:00', createdAt: '2026-08-08T10:00:00Z', playerId: 'p1', playerName: 'Jugador', weight: 72, fatigue: 8, soreness: 7, comments: '', sessionId: 's', createdBy: 'ct', updatedAt: '' },
];
const matches: MatchRecord[] = [{ id: 'g1', date: '2026-08-10', type: 'friendly', opponent: 'Rival', durationMinutes: 90, createdAt: '', updatedAt: '', createdBy: 'ct', minutes: [{ playerId: 'p1', playerName: 'Jugador', calledUp: true, starter: true, minutes: 75, goals: 1, yellowCards: 1, redCards: 0 }] }];
const attendance: AttendanceRecord[] = [{ id: 'a1', date: '2026-08-11', playerId: 'p1', playerName: 'Jugador', status: 'late', lateMinutes: 8, comments: '', createdAt: '', updatedAt: '', createdBy: 'ct' }];

describe('analyzePlayer', () => {
  it('cruza mediciones, competición, asistencia y bajas', () => {
    const result = analyzePlayer(player, measurements, matches, attendance);
    expect(result.weight.change).toBe(2);
    expect(result.competition).toMatchObject({ calledUp: 1, appearances: 1, starts: 1, minutes: 75, goals: 1 });
    expect(result.availability).toMatchObject({ lateArrivals: 1, lateMinutes: 8, injuryDays: 3 });
    expect(result.conclusions.join(' ')).toContain('revisión prioritaria');
  });
});
