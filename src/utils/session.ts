import type { AuthSession } from '../types';

export const SESSION_STORAGE_KEY = 'zabal-auth-session';

export const saveAuthSession = (session: AuthSession) =>
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

export const clearAuthSession = () => localStorage.removeItem(SESSION_STORAGE_KEY);

export const readAuthSession = (now = Date.now()): AuthSession | null => {
  try {
    const value = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as AuthSession;
    if (!session.token || !['player', 'staff'].includes(session.role) || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
      clearAuthSession();
      return null;
    }
    return session;
  } catch {
    clearAuthSession();
    return null;
  }
};

export const remainingSeconds = (expiresAt: number, now = Date.now()) =>
  Math.max(0, Math.ceil((expiresAt - now) / 1000));

export const formatRemaining = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
