import type { AppConfig } from './types';

export const appConfig: AppConfig = {
  teamName: import.meta.env.VITE_TEAM_NAME || 'Atlético Zabal Linense · Senior',
  season: '2026-27',
  sessionDurationMinutes: 120,
  thresholds: {
    moderateFrom: 4,
    alertFrom: 7,
    relevantWeightChangeKg: 1.5,
  },
  colors: { navy: '#16365f', yellow: '#f6ca3b' },
  logoSrc: `${import.meta.env.BASE_URL}assets/logo-placeholder.svg`,
  // Puede configurarse como 7 al reutilizar la plantilla en fútbol 7.
  maxStarters: Number(import.meta.env.VITE_MAX_STARTERS || 11),
};

export const environment = {
  dataProvider: import.meta.env.VITE_DATA_PROVIDER || 'local',
  staffPinHash:
    import.meta.env.VITE_STAFF_PIN_SHA256 ||
    // PIN exclusivo del modo demostración local. Producción lo valida en Apps Script.
    '888df25ae35772424a560c7152a1de794440e0ea5cfee62828333a456a506e05',
  appsScriptUrl: import.meta.env.VITE_APPS_SCRIPT_URL || '',
  publicUrl: import.meta.env.VITE_PUBLIC_URL || window.location.origin,
  homeUrl: import.meta.env.VITE_HOME_URL || 'https://rendimiento.atleticozabal.com/',
};
