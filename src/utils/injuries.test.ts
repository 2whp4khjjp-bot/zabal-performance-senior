import { describe, expect, it } from 'vitest';
import { injuryPeriodDays, playerIsInjuredOn, totalInjuryDays } from './injuries';

describe('periodos de baja', () => {
  it('cuenta inicio y final y suma varios periodos', () => {
    expect(injuryPeriodDays({ id: '1', startDate: '2026-08-01', endDate: '2026-08-03' })).toBe(3);
    expect(totalInjuryDays({ id: 'p', name: 'Jugador', active: true, order: 1, joinedAt: '2026-07-01', injuries: [
      { id: '1', startDate: '2026-08-01', endDate: '2026-08-03' },
      { id: '2', startDate: '2026-08-10', endDate: '2026-08-11' },
    ] })).toBe(5);
  });

  it('aplica una baja retroactiva en todas las fechas de su intervalo', () => {
    const player = { id: 'p', name: 'Jairo', active: true, order: 1, joinedAt: '2026-07-01', injured: false, injuries: [
      { id: 'i1', startDate: '2026-08-20', endDate: '2026-08-24', reason: 'Lesión' },
    ] };

    expect(playerIsInjuredOn(player, '2026-08-19')).toBe(false);
    expect(playerIsInjuredOn(player, '2026-08-20')).toBe(true);
    expect(playerIsInjuredOn(player, '2026-08-22')).toBe(true);
    expect(playerIsInjuredOn(player, '2026-08-24')).toBe(true);
    expect(playerIsInjuredOn(player, '2026-08-25')).toBe(false);
  });
});
