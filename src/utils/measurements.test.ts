import { describe, expect, it } from 'vitest';
import { getAlertLevel, parseWeight, sanitizeComment } from './measurements';
import type { Measurement } from '../types';

const measurement = (fatigue: number, soreness: number): Measurement => ({
  id: '1', date: '2026-07-13', time: '18:00', createdAt: '2026-07-13T18:00:00Z', playerId: 'p1', playerName: 'Jugador',
  weight: 72.4, fatigue, soreness, comments: '', sessionId: 's1', createdBy: 'test', updatedAt: '2026-07-13T18:00:00Z',
});

describe('lógica de mediciones', () => {
  it('acepta peso con coma o punto', () => {
    expect(parseWeight('72,4')).toBe(72.4);
    expect(parseWeight('72.4')).toBe(72.4);
  });
  it('rechaza pesos o formatos imposibles', () => {
    expect(parseWeight('abc')).toBeNull();
    expect(parseWeight('10')).toBeNull();
    expect(parseWeight('72,456')).toBeNull();
  });
  it('clasifica según el peor valor de fatiga o molestias', () => {
    expect(getAlertLevel()).toBe('pending');
    expect(getAlertLevel(measurement(3, 1))).toBe('normal');
    expect(getAlertLevel(measurement(4, 2))).toBe('moderate');
    expect(getAlertLevel(measurement(2, 7))).toBe('alert');
  });
  it('distingue un registro guardado parcialmente', () => {
    expect(getAlertLevel({ ...measurement(3, 2), fatigue: undefined })).toBe('partial');
  });
  it('elimina marcas HTML y limita el comentario', () => {
    expect(sanitizeComment('<b>dolor</b>')).toBe('bdolor/b');
    expect(sanitizeComment('x'.repeat(550))).toHaveLength(500);
  });
});
