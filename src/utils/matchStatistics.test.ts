import { describe, expect, it } from 'vitest';
import type { DisciplineStatus, MatchRecord, Player } from '../types';
import { buildMatchTotals, buildSeasonRankings, disciplineAlertFor } from './matchStatistics';

const players: Player[] = [
  { id: 'p1', name: 'Uno', active: true, order: 1, joinedAt: '2026-07-01' },
  { id: 'p2', name: 'Dos', active: true, order: 2, joinedAt: '2026-07-01' },
];

const match = (id: string, yellowCards: number): MatchRecord => ({
  id, date: '2026-09-01', type: 'official', opponent: 'Rival', durationMinutes: 90,
  minutes: [
    { playerId: 'p1', playerName: 'Uno', calledUp: true, starter: true, minutes: 90, goals: 1, yellowCards },
    { playerId: 'p2', playerName: 'Dos', calledUp: true, starter: false, minutes: 25, goals: 0 },
  ],
  createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-01T12:00:00.000Z', createdBy: 'staff',
});

describe('estadísticas de competición', () => {
  it('ordena los rankings acumulados', () => {
    const totals = buildMatchTotals(players, [match('m1', 1), match('m2', 0)]);
    const rankings = buildSeasonRankings(totals);
    expect(rankings.scorers[0]).toMatchObject({ goals: 2, minutes: 180 });
    expect(rankings.callUps.map((item) => item.player.id)).toEqual(['p1', 'p2']);
    expect(rankings.starters[0].starts).toBe(2);
  });

  it('oculta una sanción cumplida y vuelve a avisar en el siguiente ciclo', () => {
    const fiveCards = buildMatchTotals(players, [match('m1', 2), match('m2', 2), match('m3', 1)])[0];
    expect(disciplineAlertFor(fiveCards)?.canMarkServed).toBe(true);
    const served: DisciplineStatus = { playerId: 'p1', playerName: 'Uno', servedYellowCards: 5, servedRedCards: 0, servedAt: '2026-09-10T12:00:00.000Z' };
    expect(disciplineAlertFor(fiveCards, served)).toBeUndefined();
    const nineCards = buildMatchTotals(players, [match('m1', 2), match('m2', 2), match('m3', 2), match('m4', 2), match('m5', 1)])[0];
    expect(disciplineAlertFor(nineCards, served)?.yellowStage).toBe('warning');
  });
});
