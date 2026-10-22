import { useSyncExternalStore } from 'react';
export type TeamSettings = { profile: 'football7' | 'football11'; weight: boolean; fatigue: boolean; soreness: boolean; injuries: boolean; attendance: boolean; matches: boolean; cards: boolean };
export const defaultSettings: TeamSettings = { profile: 'football11', weight: true, fatigue: true, soreness: true, injuries: true, attendance: true, matches: true, cards: true };
let settings = { ...defaultSettings };
const listeners = new Set<() => void>();
export const setTeamSettings = (value: Partial<TeamSettings>) => { settings = { ...defaultSettings, ...value }; document.documentElement.dataset.teamFeatures = Object.entries(settings).filter(([, enabled]) => enabled === true).map(([key]) => key).join(' '); listeners.forEach((listener) => listener()); };
export const getTeamSettings = () => settings;
export const useTeamSettings = () => useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => settings);
