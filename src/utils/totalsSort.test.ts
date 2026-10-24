import { describe, expect, it } from 'vitest';
import { sortTotals } from './totalsSort';

const rows = [
  { player: { name: 'Ana', number: 8 }, callUps: 3, starts: 1, appearances: 2, minutes: 100, goals: 0, yellowCards: 1, redCards: 0 },
  { player: { name: 'Beto', number: 4 }, callUps: 2, starts: 2, appearances: 2, minutes: 80, goals: 3, yellowCards: 0, redCards: 1 },
];

describe('orden de acumulados', () => {
  it('ordena las columnas numéricas y permite invertir el orden', () => {
    expect(sortTotals(rows, { key: 'starts', descending: true })[0].player.name).toBe('Beto');
    expect(sortTotals(rows, { key: 'minutes', descending: true })[0].player.name).toBe('Ana');
    expect(sortTotals(rows, { key: 'number', descending: false })[0].player.name).toBe('Beto');
    expect(sortTotals(rows, { key: 'redCards', descending: true })[0].player.name).toBe('Beto');
    expect(sortTotals(rows, { key: 'goals', descending: false })[0].player.name).toBe('Ana');
    expect(rows[0].player.name).toBe('Ana');
  });
});
