import type { Measurement, Player, TrainingSession } from '../types';

// La plantilla real solo vive en la hoja privada de Google.
const names = Array.from({ length: 25 }, (_, index) => `Jugador ${index + 1}`);

export const demoPlayers: Player[] = names.map((name, index) => ({
  id: `player-${String(index + 1).padStart(2, '0')}`,
  name,
  active: true,
  order: index + 1,
  joinedAt: '2026-07-01',
}));

const isoDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

export const createDemoMeasurements = (): Measurement[] => {
  const measurements: Measurement[] = [];
  demoPlayers.forEach((player, playerIndex) => {
    for (let dayIndex = 8; dayIndex >= 1; dayIndex -= 1) {
      const date = isoDate(dayIndex * 2);
      const fatigue = 2 + ((playerIndex + dayIndex) % 5);
      const soreness = 1 + ((playerIndex * 2 + dayIndex) % 4);
      const weight = 67 + (playerIndex % 10) * 1.35 + Math.sin(dayIndex + playerIndex) * 0.45;
      measurements.push({
        id: `demo-${player.id}-${date}`,
        date,
        time: '18:15',
        createdAt: `${date}T18:15:00.000Z`,
        playerId: player.id,
        playerName: player.name,
        weight: Number(weight.toFixed(1)),
        fatigue,
        soreness,
        comments: soreness >= 4 ? 'Ligera sobrecarga tras la sesión anterior.' : '',
        sessionId: `session-${date}`,
        createdBy: 'demo',
        updatedAt: `${date}T18:15:00.000Z`,
      });
    }
  });
  return measurements;
};

export const createTodaySession = (): TrainingSession => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  return {
    id: `session-${date}`,
    date,
    type: 'Entrenamiento',
    active: true,
    openedAt: now.toISOString(),
  };
};
