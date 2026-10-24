export type TotalsSort = { key: string; descending: boolean };

export function sortTotals<T extends { player: { name: string; number?: number | null } }>(rows: T[], sort: TotalsSort): T[] {
  return [...rows].sort((a, b) => {
    if (sort.key === 'name') return (sort.descending ? -1 : 1) * a.player.name.localeCompare(b.player.name, 'es');
    const read = (row: T) => sort.key === 'number'
      ? row.player.number ?? Number.POSITIVE_INFINITY
      : Number((row as Record<string, unknown>)[sort.key] ?? 0);
    const comparison = read(a) - read(b);
    return (sort.descending ? -comparison : comparison) || a.player.name.localeCompare(b.player.name, 'es');
  });
}
