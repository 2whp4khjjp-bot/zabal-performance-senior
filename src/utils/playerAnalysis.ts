import { appConfig } from '../config';
import type { AttendanceRecord, MatchRecord, Measurement, Player } from '../types';
import { totalInjuryDays } from './injuries';

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
const rounded = (value: number | undefined, digits = 1) => value === undefined ? undefined : Number(value.toFixed(digits));
const countLabel = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

export type PlayerAnalysis = {
  measurements: Measurement[];
  matches: MatchRecord[];
  attendance: AttendanceRecord[];
  weight: { first?: number; latest?: number; change?: number; average?: number };
  wellness: { fatigueAverage?: number; fatigueRecent?: number; sorenessAverage?: number; sorenessRecent?: number; highFatigue: number; highSoreness: number };
  competition: { calledUp: number; appearances: number; starts: number; minutes: number; goals: number; yellowCards: number; redCards: number; averageMinutes?: number };
  availability: { trainingRecords: number; present: number; lateArrivals: number; lateMinutes: number; justified: number; unjustified: number; individual: number; medical: number; injuryPeriods: number; injuryDays: number; activeInjury: boolean };
  conclusions: string[];
};

export function analyzePlayer(player: Player, measurements: Measurement[], matches: MatchRecord[], attendance: AttendanceRecord[]): PlayerAnalysis {
  const playerMeasurements = measurements.filter((item) => item.playerId === player.id).sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  const playerMatches = matches.filter((match) => match.minutes.some((entry) => entry.playerId === player.id)).sort((a, b) => a.date.localeCompare(b.date));
  const playerAttendance = attendance.filter((item) => item.playerId === player.id && item.status !== 'pending').sort((a, b) => a.date.localeCompare(b.date));
  const weights = playerMeasurements.flatMap((item) => item.weight === undefined ? [] : [item.weight]);
  const fatigue = playerMeasurements.flatMap((item) => item.fatigue === undefined ? [] : [item.fatigue]);
  const soreness = playerMeasurements.flatMap((item) => item.soreness === undefined ? [] : [item.soreness]);
  const recentFatigue = fatigue.slice(-5);
  const recentSoreness = soreness.slice(-5);
  const entries = playerMatches.map((match) => match.minutes.find((entry) => entry.playerId === player.id)!).filter(Boolean);
  const competition = {
    calledUp: entries.filter((entry) => entry.calledUp).length,
    appearances: entries.filter((entry) => entry.minutes > 0).length,
    starts: entries.filter((entry) => entry.starter).length,
    minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    goals: entries.reduce((sum, entry) => sum + (entry.goals ?? 0), 0),
    yellowCards: entries.reduce((sum, entry) => sum + (entry.yellowCards ?? 0), 0),
    redCards: entries.reduce((sum, entry) => sum + (entry.redCards ?? 0), 0),
    averageMinutes: undefined as number | undefined,
  };
  competition.averageMinutes = competition.appearances ? rounded(competition.minutes / competition.appearances) : undefined;
  const availability = {
    trainingRecords: playerAttendance.length,
    present: playerAttendance.filter((item) => item.status === 'present' || item.status === 'late').length,
    lateArrivals: playerAttendance.filter((item) => item.status === 'late').length,
    lateMinutes: playerAttendance.reduce((sum, item) => sum + (item.status === 'late' ? item.lateMinutes : 0), 0),
    justified: playerAttendance.filter((item) => item.status === 'justified').length,
    unjustified: playerAttendance.filter((item) => item.status === 'unjustified').length,
    individual: playerAttendance.filter((item) => item.status === 'individual').length,
    medical: playerAttendance.filter((item) => item.status === 'medical').length,
    injuryPeriods: player.injuries?.length ?? 0,
    injuryDays: totalInjuryDays(player),
    activeInjury: Boolean(player.injured),
  };
  const weight = {
    first: weights[0], latest: weights.at(-1),
    change: weights.length > 1 ? rounded(weights.at(-1)! - weights[0]) : undefined,
    average: rounded(mean(weights)),
  };
  const wellness = {
    fatigueAverage: rounded(mean(fatigue)), fatigueRecent: rounded(mean(recentFatigue)),
    sorenessAverage: rounded(mean(soreness)), sorenessRecent: rounded(mean(recentSoreness)),
    highFatigue: fatigue.filter((value) => value >= appConfig.thresholds.alertFrom).length,
    highSoreness: soreness.filter((value) => value >= appConfig.thresholds.alertFrom).length,
  };
  const conclusions: string[] = [];
  if (!playerMeasurements.length) conclusions.push('No hay mediciones suficientes para valorar tendencias de peso, fatiga o molestias.');
  else {
    conclusions.push(`La cobertura disponible es de ${playerMeasurements.length} controles; las conclusiones deben interpretarse con esa profundidad de muestra.`);
    if (weight.change !== undefined) {
      const direction = weight.change > 0 ? 'aumento' : weight.change < 0 ? 'descenso' : 'estabilidad';
      const relevant = Math.abs(weight.change) >= appConfig.thresholds.relevantWeightChangeKg ? ' Es un cambio relevante según el umbral configurado y conviene revisarlo en contexto.' : '';
      conclusions.push(`El peso muestra ${direction}${weight.change ? ` de ${Math.abs(weight.change).toFixed(1)} kg entre el primer y el último registro` : ''}.${relevant}`);
    }
    if (wellness.fatigueRecent !== undefined) conclusions.push(`La fatiga reciente promedia ${wellness.fatigueRecent}/10${wellness.fatigueAverage !== undefined ? ` frente a ${wellness.fatigueAverage}/10 en el conjunto del periodo` : ''}${wellness.highFatigue ? `, con ${wellness.highFatigue} registro${wellness.highFatigue === 1 ? '' : 's'} en nivel de alerta` : ''}.`);
    if (wellness.sorenessRecent !== undefined) conclusions.push(`Las molestias recientes promedian ${wellness.sorenessRecent}/10${wellness.sorenessAverage !== undefined ? ` frente a ${wellness.sorenessAverage}/10 en el conjunto del periodo` : ''}${wellness.highSoreness ? `, con ${wellness.highSoreness} registro${wellness.highSoreness === 1 ? '' : 's'} en nivel de alerta` : ''}.`);
  }
  if (competition.calledUp) conclusions.push(`En competición suma ${competition.minutes} minutos en ${countLabel(competition.appearances, 'aparición', 'apariciones')}, ${countLabel(competition.starts, 'titularidad', 'titularidades')} y ${countLabel(competition.goals, 'gol', 'goles')} sobre ${countLabel(competition.calledUp, 'convocatoria', 'convocatorias')}.`);
  else conclusions.push('No constan convocatorias en los partidos registrados.');
  if (availability.trainingRecords) conclusions.push(`En asistencia constan ${countLabel(availability.present, 'presencia', 'presencias')} de ${countLabel(availability.trainingRecords, 'registro', 'registros')}, ${countLabel(availability.lateArrivals, 'retraso', 'retrasos')} (${availability.lateMinutes} min) y ${countLabel(availability.justified + availability.unjustified + availability.medical, 'ausencia contabilizada', 'ausencias contabilizadas')}.`);
  if (availability.injuryPeriods) conclusions.push(`Acumula ${availability.injuryDays} días en ${availability.injuryPeriods} periodo${availability.injuryPeriods === 1 ? '' : 's'} de baja${availability.activeInjury ? '; actualmente mantiene una baja activa' : ''}.`);
  if (availability.activeInjury || wellness.highFatigue > 0 || wellness.highSoreness > 0 || (wellness.fatigueRecent ?? 0) >= appConfig.thresholds.alertFrom || (wellness.sorenessRecent ?? 0) >= appConfig.thresholds.alertFrom) conclusions.push('Se recomienda revisión prioritaria por el cuerpo técnico y, cuando corresponda, por personal sanitario antes de ajustar la carga.');
  else conclusions.push('Con los datos disponibles no aparece una alerta reciente de nivel alto; conviene mantener el seguimiento habitual y contextualizarlo con la observación del cuerpo técnico.');

  return { measurements: playerMeasurements, matches: playerMatches, attendance: playerAttendance, weight, wellness, competition, availability, conclusions };
}
