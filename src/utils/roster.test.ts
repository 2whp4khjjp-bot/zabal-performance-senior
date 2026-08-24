import { describe, expect, it } from 'vitest';
import { applyJuvenilRoster } from './roster';

describe('plantilla Senior', () => {
  it('normaliza como activa una baja cuya fecha final aún no ha llegado', () => {
    const [player] = applyJuvenilRoster([{
      id: 'player-08', name: 'Matthew', active: true, order: 8, joinedAt: '2026-07-01', injured: false,
      injuries: [{ id: 'i1', startDate: '2026-08-20', endDate: '2026-08-24', reason: 'Lesión' }],
    }], '2026-08-22');

    expect(player.injured).toBe(true);
    expect(player.number).toBeUndefined();
  });
});
