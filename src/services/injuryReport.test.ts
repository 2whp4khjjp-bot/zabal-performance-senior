import { describe, expect, it } from 'vitest';
import type { Player } from '../types';
import { buildTeamInjuryReportData, createTeamInjuriesPdf } from './injuryReport';

describe('informe de bajas de la plantilla', () => {
  it('incluye a toda la plantilla y calcula el historial completo', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Disponible', number: 1, active: true, order: 1, joinedAt: '', injuries: [] },
      { id: 'p2', name: 'Lesionado', number: 2, active: true, order: 2, joinedAt: '', injured: true, injuries: [{ id: 'i1', startDate: '2026-08-01', reason: 'Esguince' }] },
      { id: 'ct', name: 'Técnico CT', active: true, order: 3, joinedAt: '', staffMember: true },
    ];
    const report = buildTeamInjuryReportData(players, '2026-08-03');
    expect(report.roster.map((player) => player.name)).toEqual(['Disponible', 'Lesionado']);
    expect(report.summary).toHaveLength(2);
    expect(report.activeCount).toBe(1);
    expect(report.affectedCount).toBe(1);
    expect(report.totalDays).toBe(3);
    expect(report.history[0]).toMatchObject({ days: 3, period: { reason: 'Esguince' } });
  });

  it('genera el resumen y el historial en páginas separadas', async () => {
    const players: Player[] = [{
      id: 'p1', name: 'Jugador', number: 8, active: true, order: 1, joinedAt: '', injured: true,
      injuries: [{ id: 'i1', startDate: '2026-08-01', reason: 'Lesión muscular' }],
    }];
    const doc = await createTeamInjuriesPdf(players);
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(5_000);
  });
});
