import { AlertTriangle, CalendarDays, CheckCircle2, CircleDashed, Search, ShieldAlert, XCircle } from 'lucide-react';
import type { DashboardFilter, Measurement, Player } from '../types';
import { formatDate, todayKey } from '../utils/date';
import { playerIsInjuredOn } from '../utils/injuries';
import { alertLabel, getAlertLevel } from '../utils/measurements';

type PlayerGridProps = {
  players: Player[];
  measurements: Measurement[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onSelect: (player: Player) => void;
  filter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
};

const statusIcon = {
  pending: CircleDashed,
  partial: CircleDashed,
  normal: CheckCircle2,
  moderate: AlertTriangle,
  alert: ShieldAlert,
};

export function PlayerGrid({ players, measurements, selectedDate, onDateChange, onSelect, filter, onFilterChange }: PlayerGridProps) {
  const today = todayKey();
  const measurementsByPlayer = new Map(measurements.filter((item) => item.date === selectedDate).map((item) => [item.playerId, item]));
  const injuredPlayerIds = new Set(players.filter((player) => playerIsInjuredOn(player, selectedDate)).map((player) => player.id));
  const availablePlayers = players.filter((player) => !injuredPlayerIds.has(player.id));
  const registered = availablePlayers.filter((player) => measurementsByPlayer.has(player.id)).length;
  const pending = availablePlayers.length - registered;
  const filtered = players.filter((player) => {
    const hasMeasurement = measurementsByPlayer.has(player.id);
    const injuredOnSelectedDate = injuredPlayerIds.has(player.id);
    const matchesFilter = filter === 'all' || (filter === 'registered' ? hasMeasurement : !hasMeasurement && !injuredOnSelectedDate);
    return matchesFilter;
  });

  return (
    <main className="page-shell player-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow eyebrow--dark">{selectedDate === today ? 'Sesión de hoy' : 'Registro de otro día'}</p>
          <h1>Estado de la plantilla</h1>
          <p>Jugadores y mediciones del {formatDate(selectedDate)}.</p>
        </div>
        <div className="summary-counters" aria-label="Resumen de la sesión">
          <div><span>{players.length}</span><small>Plantilla</small></div>
          <div className="summary-counters__ok"><span>{registered}</span><small>Registrados</small></div>
          <div className="summary-counters__pending"><span>{pending}</span><small>Pendientes</small></div>
        </div>
      </div>

      <section className="roster-date-selector" aria-label="Día de las mediciones">
        <div className="roster-date-selector__label">
          <CalendarDays size={22} aria-hidden="true" />
          <span><strong>Día de registro</strong><small>Elige la fecha una vez; se mantendrá al entrar y volver de cada jugador.</small></span>
        </div>
        <div className="roster-date-selector__controls">
          <input type="date" max={today} value={selectedDate} onChange={(event) => onDateChange(event.target.value || today)} aria-label="Fecha de las mediciones" />
          {selectedDate !== today && <button type="button" onClick={() => onDateChange(today)}>Volver a hoy</button>}
        </div>
      </section>

      <section className="player-toolbar" aria-label="Filtros de jugadores">
        <div className="segmented-control">
          {([
            ['all', `Todos ${players.length}`],
            ['pending', `Pendientes ${pending}`],
            ['registered', `Registrados ${registered}`],
          ] as const).map(([value, label]) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => onFilterChange(value)} aria-pressed={filter === value}>{label}</button>
          ))}
        </div>
      </section>

      {filtered.length ? (
        <section className="player-grid" aria-live="polite">
          {filtered.map((player) => {
            const measurement = measurementsByPlayer.get(player.id);
            const level = getAlertLevel(measurement);
            const Icon = statusIcon[level];
            const injuredOnSelectedDate = injuredPlayerIds.has(player.id);
            return (
              <article key={player.id} className={`player-card player-card--${level} ${injuredOnSelectedDate ? 'player-card--injured' : ''} ${player.staffMember ? 'player-card--staff' : ''}`}>
                <button
                  type="button"
                  data-testid={`player-${player.id}`}
                  className="player-card__main"
                  onClick={() => onSelect(player)}
                  aria-label={`${player.name}, ${injuredOnSelectedDate ? 'baja por lesión' : alertLabel[level]}`}
                >
                  <span className="player-card__body">
                    <strong>{player.name}</strong>
                    {player.staffMember && <span className="player-card__staff-label">Cuerpo técnico</span>}
                    <span className="player-card__status">{injuredOnSelectedDate ? <><XCircle size={17} /> Baja por lesión</> : <><Icon size={17} /> {alertLabel[level]}</>}</span>
                  </span>
                  {measurement && <span className="player-card__values">F {measurement.fatigue ?? '—'} · M {measurement.soreness ?? '—'}</span>}
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="empty-state"><Search size={30} /><h2>No hay jugadores</h2><p>Cambia el filtro para ver el resto de la plantilla.</p></div>
      )}
    </main>
  );
}
