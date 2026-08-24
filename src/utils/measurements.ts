import { appConfig } from '../config';
import type { AlertLevel, Measurement } from '../types';

export const parseWeight = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;
  const weight = Number(normalized);
  return weight >= 30 && weight <= 250 ? weight : null;
};

export const getAlertLevel = (measurement?: Measurement): AlertLevel => {
  if (!measurement) return 'pending';
  const scores = [measurement.fatigue, measurement.soreness].filter((value): value is number => value !== undefined);
  const max = scores.length ? Math.max(...scores) : 0;
  if (max >= appConfig.thresholds.alertFrom) return 'alert';
  if (max >= appConfig.thresholds.moderateFrom) return 'moderate';
  if ([measurement.weight, measurement.fatigue, measurement.soreness].some((value) => value === undefined)) return 'partial';
  return 'normal';
};

export const alertLabel: Record<AlertLevel, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  normal: 'Sin alerta',
  moderate: 'Atención',
  alert: 'Alerta',
};

export const recentForPlayer = (measurements: Measurement[], playerId: string, limit = 10) =>
  measurements
    .filter((item) => item.playerId === playerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .reverse();

export const average = (values: Array<number | undefined>) => {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : 0;
};

export const weightChange = (history: Measurement[]) => {
  const weights = history.map((item) => item.weight).filter((value): value is number => value !== undefined);
  if (weights.length < 2) return 0;
  return Number((weights[weights.length - 1] - weights[weights.length - 2]).toFixed(1));
};

export const isCompleteMeasurement = (measurement?: Measurement) => Boolean(
  measurement && measurement.weight !== undefined && measurement.fatigue !== undefined && measurement.soreness !== undefined,
);

export const sanitizeComment = (value: string) =>
  value.replace(/[<>]/g, '').replace(/\s{3,}/g, '  ').trim().slice(0, 500);
