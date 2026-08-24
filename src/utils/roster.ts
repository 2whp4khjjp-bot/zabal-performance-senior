import type { Player } from '../types';
import { todayKey } from './date';
import { playerIsInjuredOn } from './injuries';

export const applyJuvenilRoster = (players: Player[], date = todayKey()) => players.map((player) => {
  return { ...player, number: undefined, injured: playerIsInjuredOn(player, date), staffMember: false };
}).sort((a, b) => a.order - b.order);
