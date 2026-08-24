import { beforeEach, describe, expect, it } from 'vitest';
import { readAuthSession, remainingSeconds, saveAuthSession, SESSION_STORAGE_KEY } from './session';

describe('sesión local', () => {
  beforeEach(() => localStorage.clear());
  it('recupera una sesión no caducada tras recargar', () => {
    saveAuthSession({ token: 'abc', expiresAt: 20_000, role: 'staff' });
    expect(readAuthSession(10_000)).toEqual({ token: 'abc', expiresAt: 20_000, role: 'staff' });
  });
  it('borra una sesión caducada', () => {
    saveAuthSession({ token: 'abc', expiresAt: 5_000, role: 'staff' });
    expect(readAuthSession(10_000)).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('calcula el tiempo restante sin devolver negativos', () => {
    expect(remainingSeconds(11_500, 10_000)).toBe(2);
    expect(remainingSeconds(8_000, 10_000)).toBe(0);
  });
});
