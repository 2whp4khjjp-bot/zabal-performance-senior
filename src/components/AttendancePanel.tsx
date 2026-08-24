import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, FileDown, Save, UserCheck, UserX } from 'lucide-react';
import type { AttendanceInput, AttendanceRecord, AttendanceStatus, Measurement, Player } from '../types';
import { attendanceRankings, currentIsoWeek, filterAttendancePeriod, playerIsInjuredOn, type AttendancePeriod } from '../utils/attendance';
import { formatDate, formatShortDate, todayKey } from '../utils/date';
import { generateAttendancePdf } from '../services/attendanceReport';
import { appConfig } from '../config';

type Props = {
  players: Player[];
  measurements: Measurement[];
  attendance: AttendanceRecord[];
  saving: boolean;
  onSave: (input: AttendanceInput) => Promise<boolean>;
};

type Draft = { status: AttendanceStatus; lateMinutes: string; comments: string };

const seniorStatusLabels: Partial<Record<AttendanceStatus, string>> = {
  present: 'Presente',
  unjustified: 'No presente',
};

export function AttendancePanel({ players, measurements, attendance, saving, onSave }: Props) {
  const roster = useMemo(() => players.filter((player) => !player.staffMember), [players]);
  const [mode, setMode] = useState<'daily' | 'rankings'>('daily');
  const [date, setDate] = useState(todayKey());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [period, setPeriod] = useState<AttendancePeriod>('week');
  const [week, setWeek] = useState(currentIsoWeek());
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [detailPlayer, setDetailPlayer] = useState<string>('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const saved = new Map(attendance.filter((item) => item.date === date).map((item) => [item.playerId, item]));
    const measured = new Set(measurements.filter((item) => item.date === date).map((item) => item.playerId));
    setDrafts(Object.fromEntries(roster.map((player) => {
      const existing = saved.get(player.id);
      const status: AttendanceStatus = measured.has(player.id) ? 'present' : existing?.status === 'present' ? 'present' : 'unjustified';
      return [player.id, { status, lateMinutes: '', comments: existing?.comments ?? (playerIsInjuredOn(player, date) ? 'Baja por lesión' : '') }];
    })));
  }, [date, attendance, measurements, roster]);

  const counts = useMemo(() => Object.values(drafts).reduce((total, item) => {
    total[item.status] += 1;
    return total;
  }, { pending: 0, present: 0, late: 0, justified: 0, unjustified: 0, individual: 0, medical: 0 } as Record<AttendanceStatus, number>), [drafts]);
  const periodValue = period === 'week' ? week : period === 'month' ? month : '';
  const filteredRecords = useMemo(() => filterAttendancePeriod(attendance, period, periodValue), [attendance, period, periodValue]);
  const rankings = useMemo(() => attendanceRankings(roster, filteredRecords), [roster, filteredRecords]);
  const detailRecords = detailPlayer ? filteredRecords.filter((item) => item.playerId === detailPlayer && item.status !== 'present').sort((a, b) => b.date.localeCompare(a.date)) : [];

  const update = (playerId: string, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [playerId]: { ...current[playerId], ...patch } }));
  const submit = async () => {
    const entries = roster.map((player) => {
      const draft = drafts[player.id] ?? { status: 'unjustified' as const, lateMinutes: '', comments: '' };
      return { playerId: player.id, playerName: player.name, status: draft.status === 'present' ? 'present' as const : 'unjustified' as const, lateMinutes: 0, comments: draft.comments };
    });
    await onSave({ date, entries });
  };

  return <main className="page-shell attendance-page">
    <div className="page-heading attendance-heading">
      <div><p className="eyebrow">CONTROL DE ENTRENAMIENTOS</p><h1>Asistencia al entreno</h1><p>Las mediciones marcan automáticamente a los jugadores como presentes.</p></div>
      <div className="matches-switch" role="tablist" aria-label="Vista de asistencia">
        <button type="button" className={mode === 'daily' ? 'active' : ''} onClick={() => setMode('daily')}><UserCheck size={17} /> Asistencia</button>
        <button type="button" className={mode === 'rankings' ? 'active' : ''} onClick={() => setMode('rankings')}><BarChart3 size={17} /> Rankings</button>
      </div>
    </div>

    {mode === 'daily' ? <>
      <section className="panel-card attendance-toolbar">
        <label><CalendarDays size={18} /><span>Fecha del entrenamiento</span><input type="date" max={todayKey()} value={date} onChange={(event) => setDate(event.target.value || todayKey())} /></label>
        <div className="attendance-counts"><span><strong>{counts.present}</strong> presentes</span><span><strong>{counts.unjustified}</strong> no presentes</span></div>
      </section>
      <section className="panel-card attendance-list-card">
        <div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">{formatDate(date)}</p><h2>Estado de la plantilla</h2></div><small>{roster.length} jugadores</small></div>
        <div className="attendance-list">
          {roster.map((player) => { const draft = drafts[player.id] ?? { status: 'unjustified' as const, lateMinutes: '', comments: '' }; return <article className={`attendance-row attendance-row--${draft.status}`} key={player.id}>
            <strong>{player.name}</strong>
            <select value={draft.status === 'present' ? 'present' : 'unjustified'} onChange={(event) => update(player.id, { status: event.target.value as AttendanceStatus, lateMinutes: '' })} aria-label={`Asistencia de ${player.name}`}>
              {Object.entries(seniorStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <span className="attendance-status-mark">{draft.status === 'present' ? <CheckCircle2 size={18} /> : <UserX size={18} />}{draft.status === 'present' ? 'Presente' : 'No presente'}</span>
            <input className="attendance-comment" value={draft.comments} maxLength={250} onChange={(event) => update(player.id, { comments: event.target.value })} placeholder="Observación opcional" aria-label={`Observación de ${player.name}`} />
          </article>; })}
        </div>
        <div className="attendance-save-bar"><span>{counts.present} presentes · {counts.unjustified} no presentes</span><button type="button" className="button button--primary" disabled={saving} onClick={() => void submit()}><Save size={18} /> {saving ? 'Guardando…' : 'Guardar asistencia del día'}</button></div>
      </section>
    </> : <>
      <section className="panel-card attendance-ranking-filters">
        <div><p className="eyebrow eyebrow--dark">PERIODO</p><h2>Filtrar estadísticas</h2></div>
        <div className="attendance-period-buttons">{(['week', 'month', 'season'] as AttendancePeriod[]).map((value) => <button type="button" key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value === 'week' ? 'Semana' : value === 'month' ? 'Mes' : 'Temporada'}</button>)}</div>
        {period === 'week' && <input type="week" value={week} onChange={(event) => setWeek(event.target.value)} aria-label="Semana del ranking" />}
        {period === 'month' && <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Mes del ranking" />}
        <button type="button" className="button button--secondary" disabled={generatingPdf || !filteredRecords.length} onClick={() => { setGeneratingPdf(true); const label = period === 'week' ? `Semana ${week}` : period === 'month' ? `Mes ${month}` : `Temporada ${appConfig.season}`; void generateAttendancePdf(roster, filteredRecords, label).finally(() => setGeneratingPdf(false)); }}><FileDown size={17} /> {generatingPdf ? 'Creando…' : 'Informe PDF'}</button>
      </section>
      <div className="attendance-rankings-grid attendance-rankings-grid--single">
        <section className="panel-card ranking-card ranking-card--absences">
          <div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">PLANTILLA COMPLETA</p><h2>Ranking de ausencias</h2></div><CalendarDays /></div>
          <div className="table-wrap"><table><thead><tr><th>Jugador</th><th>No presente</th></tr></thead><tbody>{rankings.absences.map((row) => <tr key={row.playerId} onClick={() => setDetailPlayer(row.playerId)}><td>{row.playerName}</td><td><strong>{row.totalAbsences}</strong></td></tr>)}</tbody></table></div>
        </section>
      </div>
      {detailPlayer && <section className="panel-card attendance-detail"><div className="panel-card__heading"><div><p className="eyebrow eyebrow--dark">DETALLE</p><h2>{roster.find((player) => player.id === detailPlayer)?.name}</h2></div><button type="button" className="text-button" onClick={() => setDetailPlayer('')}>Cerrar</button></div>{detailRecords.length ? <div className="attendance-detail-list">{detailRecords.map((item) => <div key={item.id}><strong>{formatShortDate(item.date)}</strong><span>No presente</span><small>{item.comments}</small></div>)}</div> : <p className="muted-copy">No tiene ausencias en este periodo.</p>}</section>}
    </>}
  </main>;
}
