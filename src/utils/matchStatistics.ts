import type { DisciplineStatus, MatchRecord, Player } from '../types';

export type MatchTotalRow = {
  player: Player;
  callUps: number;
  starts: number;
  appearances: number;
  minutes: number;
  goals: number;
  yellowCards: number;
  redCards: number;
};

export type DisciplineAlert = {
  yellowStage?: 'warning' | 'sanction';
  redSanction: boolean;
  canMarkServed: boolean;
};

export function buildMatchTotals(players: Player[], matches: MatchRecord[]): MatchTotalRow[] {
  const byPlayer = new Map<string, MatchTotalRow>();
  players.filter((player) => !player.staffMember).forEach((player) => byPlayer.set(player.id, {
    player, callUps: 0, starts: 0, appearances: 0, minutes: 0, goals: 0, yellowCards: 0, redCards: 0,
  }));
  matches.forEach((match) => match.minutes.forEach((entry) => {
    const total = byPlayer.get(entry.playerId);
    if (!total) return;
    total.minutes += entry.minutes;
    total.goals += entry.goals ?? 0;
    if (entry.calledUp) total.callUps += 1;
    if (entry.starter) total.starts += 1;
    if (entry.minutes > 0) total.appearances += 1;
    total.yellowCards += entry.yellowCards ?? 0;
    total.redCards += entry.redCards ?? 0;
  }));
  return [...byPlayer.values()].sort((a, b) => a.player.order - b.player.order);
}

export function disciplineAlertFor(total: MatchTotalRow, status?: DisciplineStatus): DisciplineAlert | undefined {
  const servedYellowCards = status?.servedYellowCards ?? 0;
  const servedRedCards = status?.servedRedCards ?? 0;
  const newYellowCards = total.yellowCards > servedYellowCards;
  const yellowStage = newYellowCards && total.yellowCards > 0
    ? total.yellowCards % 5 === 4 ? 'warning' : total.yellowCards % 5 === 0 ? 'sanction' : undefined
    : undefined;
  const redSanction = total.redCards > servedRedCards;
  if (!yellowStage && !redSanction) return undefined;
  return { yellowStage, redSanction, canMarkServed: yellowStage === 'sanction' || redSanction };
}

export function disciplineAlertLabel(alert: DisciplineAlert): string {
  const messages: string[] = [];
  if (alert.yellowStage === 'warning') messages.push('A una amarilla de sanción');
  if (alert.yellowStage === 'sanction') messages.push('Sanción por acumulación pendiente');
  if (alert.redSanction) messages.push('Sanción por roja pendiente');
  return messages.join(' · ');
}

export function buildSeasonRankings(totals: MatchTotalRow[], disciplineStatuses: DisciplineStatus[] = []) {
  const statusByPlayer = new Map(disciplineStatuses.map((status) => [status.playerId, status]));
  return {
    scorers: [...totals].filter((item) => item.goals > 0).sort((a, b) => b.goals - a.goals || b.minutes - a.minutes).slice(0, 5),
    callUps: [...totals].sort((a, b) => b.callUps - a.callUps || b.minutes - a.minutes).slice(0, 18),
    starters: [...totals].filter((item) => item.starts > 0).sort((a, b) => b.starts - a.starts || b.minutes - a.minutes).slice(0, 11),
    minutes: [...totals].filter((item) => item.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 11),
    discipline: totals.filter((item) => disciplineAlertFor(item, statusByPlayer.get(item.player.id))).sort((a, b) => b.yellowCards - a.yellowCards || b.redCards - a.redCards),
  };
}
