import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownAZ, CalendarDays, Download, FileDown, Filter, Search, ShieldX, TrendingUp, UsersRound } from 'lucide-react';
import type { AlertLevel, AttendanceRecord, MatchRecord, Measurement, Player, ReportKind } from '../types';
import { todayKey } from '../utils/date';
import { average, getAlertLevel, recentForPlayer, weightChange } from '../utils/measurements';
import { exportCsv, exportExcel } from '../services/exports';
import { generatePdfReport } from '../services/reports';
import { generateTeamInjuriesPdf } from '../services/injuryReport';
import { Sparkline } from './Sparkline';

type SortKey = keyof Pick<Measurement, 'date' | 'time' | 'playerName' | 'weight' | 'fatigue' | 'soreness'> | 'status';
type SortDirection = 'asc' | 'desc';

type Filters = {
  query: string; playerId: string; from: string; to: string; minWeight: string; maxWeight: string;
  minFatigue: string; maxFatigue: string; minSoreness: string; maxSoreness: string; status: '' | AlertLevel;
};

const initialFilters: Filters = { query: '', playerId: '', from: '', to: '', minWeight: '', maxWeight: '', minFatigue: '', maxFatigue: '', minSoreness: '', maxSoreness: '', status: '' };

const statusText: Record<AlertLevel, string> = { pending: 'Pendiente', partial: 'Parcial', normal: 'Normal', moderate: 'Moderado', alert: 'Alerta' };

export function TechnicalPanel({ players, measurements, matches, attendance }: { players: Player[]; measurements: Measurement[]; matches: MatchRecord[]; attendance: AttendanceRecord[] }) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'desc' });
  const [individualId, setIndividualId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [generatingInjuriesPdf, setGeneratingInjuriesPdf] = useState(false);
  const todayItems = measurements.filter((item) => item.date === todayKey());
  const registeredIds = new Set(todayItems.map((item) => item.playerId));
  const alerts = todayItems.filter((item) => getAlertLevel(item) === 'alert');
  const relevantWeightChanges = players.map((player) => ({ player, change: weightChange(recentForPlayer(measurements, player.id)) })).filter((item) => Math.abs(item.change) >= 1.5);
  const injuryCount = players.filter((player) => player.injured).length;
  const availablePlayers = players.filter((player) => !player.injured);
  const registeredAvailable = new Set(availablePlayers.filter((player) => registeredIds.has(player.id)).map((player) => player.id));
  const disciplineAlerts = players.map((player) => {
    const yellowCards = matches.reduce((sum, match) => sum + (match.minutes.find((entry) => entry.playerId === player.id)?.yellowCards ?? 0), 0);
    const redCards = matches.reduce((sum, match) => sum + (match.minutes.find((entry) => entry.playerId === player.id)?.redCards ?? 0), 0);
    return { player, yellowCards, redCards };
  }).filter((item) => item.redCards > 0 || (item.yellowCards > 0 && item.yellowCards % 5 === 4));

  const filtered = useMemo(() => {
    const toNumber = (value: string) => value ? Number(value.replace(',', '.')) : null;
    const result = measurements.filter((item) => {
      const haystack = `${item.playerName} ${item.comments}`.toLocaleLowerCase('es');
      if (filters.query && !haystack.includes(filters.query.toLocaleLowerCase('es'))) return false;
      if (filters.playerId && item.playerId !== filters.playerId) return false;
      if (filters.from && item.date < filters.from) return false;
      if (filters.to && item.date > filters.to) return false;
      const ranges: Array<[number | undefined, number | null, number | null]> = [
        [item.weight, toNumber(filters.minWeight), toNumber(filters.maxWeight)],
        [item.fatigue, toNumber(filters.minFatigue), toNumber(filters.maxFatigue)],
        [item.soreness, toNumber(filters.minSoreness), toNumber(filters.maxSoreness)],
      ];
      if (ranges.some(([value, min, max]) => ((min !== null || max !== null) && value === undefined) || (value !== undefined && ((min !== null && value < min) || (max !== null && value > max))))) return false;
      return !filters.status || getAlertLevel(item) === filters.status;
    });
    return result.sort((a, b) => {
      const aValue = sort.key === 'status' ? getAlertLevel(a) : a[sort.key];
      const bValue = sort.key === 'status' ? getAlertLevel(b) : b[sort.key];
      const comparison = typeof aValue === 'number' && typeof bValue === 'number' ? aValue - bValue : String(aValue).localeCompare(String(bValue), 'es');
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [measurements, filters, sort]);

  const sortBy = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const selectedHistory = individualId ? recentForPlayer(measurements, individualId, 10) : [];
  const selectedPlayer = players.find((player) => player.id === individualId);
  const maxWeekly = Math.max(1, ...players.map((player) => measurements.filter((item) => item.playerId === player.id).slice(-7).length));

  const pdf = (kind: ReportKind) => generatePdfReport({ kind, measurements, players, matches, attendance, playerId: individualId || players[0]?.id });

  return (
    <main className="page-shell technical-page">
      <div className="page-heading technical-heading">
        <div><p className="eyebrow eyebrow--dark">Datos y seguimiento</p><h1>Panel técnico</h1><p>Resumen de la sesión, alertas, tendencias e informes.</p></div>
        <div className="export-actions">
          <button className="button button--secondary" onClick={() => exportCsv(filtered)}><Download size={18} /> CSV</button>
          <button className="button button--secondary" onClick={() => void exportExcel(filtered)}><Download size={18} /> Excel</button>
          <button className="button button--primary" onClick={() => void pdf('daily')}><FileDown size={18} /> PDF del día</button>
        </div>
      </div>

      <section className="metric-grid" aria-label="Resumen del día">
        <article><span className="metric-icon metric-icon--blue"><UsersRound /></span><div><small>Registrados hoy</small><strong>{registeredAvailable.size}<span>/{availablePlayers.length}</span></strong><em>{availablePlayers.length - registeredAvailable.size} pendientes · {injuryCount} bajas</em></div></article>
        <article><span className="metric-icon metric-icon--yellow"><AlertTriangle /></span><div><small>Alertas de fatiga</small><strong>{todayItems.filter((item) => (item.fatigue ?? 0) >= 7).length}</strong><em>{todayItems.filter((item) => (item.fatigue ?? 0) >= 4 && (item.fatigue ?? 0) < 7).length} moderadas</em></div></article>
        <article><span className="metric-icon metric-icon--red"><AlertTriangle /></span><div><small>Alertas de molestias</small><strong>{todayItems.filter((item) => (item.soreness ?? 0) >= 7).length}</strong><em>{todayItems.filter((item) => (item.soreness ?? 0) >= 4 && (item.soreness ?? 0) < 7).length} moderadas</em></div></article>
        <article><span className="metric-icon metric-icon--green"><TrendingUp /></span><div><small>Bajas / sanciones</small><strong>{injuryCount + disciplineAlerts.length}</strong><em>{injuryCount} lesionados · {disciplineAlerts.length} disciplinarias</em></div></article>
      </section>

      <section className="technical-split">
        <article className="panel-card session-progress">
          <div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">Sesión actual</p><h2>Progreso de registro</h2></div><strong>{availablePlayers.length ? Math.round((registeredAvailable.size / availablePlayers.length) * 100) : 0}%</strong></div>
          <div className="progress-track"><span style={{ width: `${availablePlayers.length ? (registeredAvailable.size / availablePlayers.length) * 100 : 0}%` }} /></div>
          <div className="progress-legend"><span><i className="dot dot--green" /> {registeredAvailable.size} registrados</span><span><i className="dot" /> {availablePlayers.length - registeredAvailable.size} pendientes</span></div>
        </article>
        <article className="panel-card alerts-list">
          <div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">Revisión prioritaria</p><h2>Alertas de hoy</h2></div><span className="count-badge">{alerts.length}</span></div>
          {alerts.length ? alerts.slice(0, 4).map((item) => <div className="alert-row" key={item.id}><span>{item.playerName}</span><strong>F {item.fatigue}</strong><strong>M {item.soreness}</strong></div>) : <p className="muted-copy">No hay alertas de nivel alto en la sesión de hoy.</p>}
        </article>
      </section>

      {disciplineAlerts.length > 0 && <section className="panel-card discipline-alerts-card">
        <div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">Disciplina</p><h2>Alertas de tarjetas</h2></div><span className="count-badge">{disciplineAlerts.length}</span></div>
        {disciplineAlerts.map((item) => <div className="alert-row discipline-alert-row" key={item.player.id}><span>{item.player.name}</span><strong><span className="card-mark card-mark--yellow" /> {item.yellowCards}</strong><strong><span className="card-mark card-mark--red" /> {item.redCards}</strong>{item.yellowCards % 5 === 4 && <em>A una amarilla de sanción</em>}</div>)}
      </section>}

      <div className="history-toggle-row"><button className="button button--secondary" onClick={() => setShowHistory((value) => !value)}>{showHistory ? 'Ocultar histórico de mediciones' : 'Ver histórico de mediciones'}</button></div>

      {showHistory && <><section className="panel-card filters-card">
        <div className="filter-topline">
          <div className="search-field"><Search size={19} /><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Buscar jugador o comentario…" aria-label="Buscar mediciones" /></div>
          <select value={filters.playerId} onChange={(event) => setFilters({ ...filters, playerId: event.target.value })} aria-label="Filtrar por jugador"><option value="">Todos los jugadores</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as Filters['status'] })} aria-label="Filtrar por estado"><option value="">Todos los estados</option><option value="partial">Parcial</option><option value="normal">Normal</option><option value="moderate">Moderado</option><option value="alert">Alerta</option></select>
          <button className="button button--secondary" onClick={() => setShowAdvanced((value) => !value)}><Filter size={18} /> Más filtros</button>
          <button className="text-button" onClick={() => setFilters(initialFilters)}>Limpiar</button>
        </div>
        {showAdvanced && <div className="advanced-filters">
          <label>Desde<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label>Hasta<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <label>Peso mín.<input inputMode="decimal" value={filters.minWeight} onChange={(event) => setFilters({ ...filters, minWeight: event.target.value })} /></label>
          <label>Peso máx.<input inputMode="decimal" value={filters.maxWeight} onChange={(event) => setFilters({ ...filters, maxWeight: event.target.value })} /></label>
          <label>Fatiga mín.<input type="number" min="1" max="10" value={filters.minFatigue} onChange={(event) => setFilters({ ...filters, minFatigue: event.target.value })} /></label>
          <label>Fatiga máx.<input type="number" min="1" max="10" value={filters.maxFatigue} onChange={(event) => setFilters({ ...filters, maxFatigue: event.target.value })} /></label>
          <label>Molestias mín.<input type="number" min="1" max="10" value={filters.minSoreness} onChange={(event) => setFilters({ ...filters, minSoreness: event.target.value })} /></label>
          <label>Molestias máx.<input type="number" min="1" max="10" value={filters.maxSoreness} onChange={(event) => setFilters({ ...filters, maxSoreness: event.target.value })} /></label>
        </div>}
      </section>

      <section className="panel-card table-card">
        <div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">Base de datos</p><h2>Mediciones <span>({filtered.length})</span></h2></div><ArrowDownAZ className="table-sort-icon" /></div>
        <div className="table-scroll">
          <table>
            <thead><tr>{([
              ['date', 'Fecha'], ['time', 'Hora'], ['playerName', 'Jugador'], ['weight', 'Peso'], ['fatigue', 'Fatiga'], ['soreness', 'Molestias'], ['status', 'Estado'],
            ] as const).map(([key, label]) => <th key={key}><button onClick={() => sortBy(key)}>{label}{sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>)}<th>Comentarios</th></tr></thead>
            <tbody>{filtered.slice(0, 250).map((item) => { const level = getAlertLevel(item); return <tr key={item.id}><td>{item.date}</td><td>{item.time}</td><td><strong>{item.playerName}</strong></td><td>{item.weight !== undefined ? `${item.weight} kg` : '—'}</td><td>{item.fatigue ?? '—'}</td><td>{item.soreness ?? '—'}</td><td><span className={`status-pill status-pill--${level}`}>{statusText[level]}</span></td><td className="comments-cell">{item.comments || '—'}</td></tr>; })}</tbody>
          </table>
        </div>
        {!filtered.length && <div className="empty-state compact"><h3>No hay mediciones para estos filtros</h3><button className="text-button" onClick={() => setFilters(initialFilters)}>Restablecer filtros</button></div>}
      </section></>}

      <section className="technical-split insights-section">
        <article className="panel-card individual-card">
          <div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">Vista individual</p><h2>Evolución del jugador</h2></div><button className="button button--secondary" disabled={!individualId} onClick={() => void pdf('player')}><FileDown size={17} /> Informe integral PDF</button></div>
          <select value={individualId} onChange={(event) => setIndividualId(event.target.value)} aria-label="Seleccionar jugador para ver su evolución"><option value="">Selecciona un jugador</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
          {selectedPlayer ? <div className="individual-insight"><h3>{selectedPlayer.name}</h3><div className="insight-stats"><span>Último peso <strong>{selectedHistory.map((item) => item.weight).filter((value) => value !== undefined).at(-1) ?? '—'} kg</strong></span><span>Fatiga media <strong>{average(selectedHistory.map((item) => item.fatigue)).toFixed(1)}</strong></span><span>Molestias media <strong>{average(selectedHistory.map((item) => item.soreness)).toFixed(1)}</strong></span></div><Sparkline values={selectedHistory.map((item) => item.weight).filter((value): value is number => value !== undefined)} label="Evolución individual del peso" /></div> : <p className="muted-copy">Selecciona un jugador para ver solo sus últimos controles.</p>}
        </article>
        <article className="panel-card weekly-card">
          <div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">Informe por jugador</p><h2>Tendencias semanales y mensuales</h2></div><button className="button button--secondary" onClick={() => void pdf('weekly')}><FileDown size={17} /> PDF</button></div>
          <div className="weekly-bars">{players.slice(0, 8).map((player) => { const count = measurements.filter((item) => item.playerId === player.id).slice(-7).length; return <div key={player.id}><span>{player.name.split(' ')[0]}</span><div><i style={{ width: `${(count / maxWeekly) * 100}%` }} /></div><strong>{count}</strong></div>; })}</div>
        </article>
      </section>

      <section className="report-strip">
        <div><CalendarDays /><span><strong>Informes listos para imprimir</strong><small>Dos jugadores por página A4 con sus gráficas semanales y mensuales.</small></span></div>
        <button className="button button--secondary" disabled={generatingInjuriesPdf} onClick={() => { setGeneratingInjuriesPdf(true); void generateTeamInjuriesPdf(players).finally(() => setGeneratingInjuriesPdf(false)); }}><ShieldX size={18} /> {generatingInjuriesPdf ? 'Creando…' : 'Informe de bajas'}</button>
        <button className="button button--secondary" onClick={() => void pdf('alerts')}><FileDown size={18} /> Informe de alertas</button>
        <button className="button button--secondary" onClick={() => void pdf('weekly')}><FileDown size={18} /> Tendencias por jugador</button>
      </section>
    </main>
  );
}
