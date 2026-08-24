import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronUp, History, Save, Scale, ShieldX, TrendingDown, TrendingUp } from 'lucide-react';
import type { AuthRole, InjuryInput, MatchRecord, Measurement, MeasurementInput, Player, TrainingSession } from '../types';
import { formatDate, todayKey } from '../utils/date';
import { average, parseWeight, recentForPlayer, weightChange } from '../utils/measurements';
import { Sparkline } from './Sparkline';
import { injuryPeriodDays, playerIsInjuredOn, totalInjuryDays } from '../utils/injuries';

type FormProps = {
  player: Player;
  measurements: Measurement[];
  matches: MatchRecord[];
  session: TrainingSession;
  saving: boolean;
  onSave: (input: MeasurementInput) => Promise<boolean>;
  onInjuryChange: (playerId: string, injury: InjuryInput) => Promise<boolean>;
  onBack: () => void;
  role: AuthRole;
  selectedDate: string;
  onDateChange: (date: string) => void;
};

type Draft = { weight: string; fatigue: number | null; soreness: number | null; comments: string };

const draftKey = (playerId: string, date: string) => `zabal-draft-${date}-${playerId}`;

const readDraft = (playerId: string, date: string, existing?: Measurement): Draft => {
  try {
    const stored = localStorage.getItem(draftKey(playerId, date));
    if (stored) return JSON.parse(stored) as Draft;
  } catch { /* El formulario sigue disponible con valores seguros. */ }
  return {
    weight: existing?.weight !== undefined ? String(existing.weight).replace('.', ',') : '',
    fatigue: existing?.fatigue ?? null,
    soreness: existing?.soreness ?? null,
    comments: existing?.comments ?? '',
  };
};

function ScorePicker({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number) => void }) {
  return (
    <fieldset className="score-fieldset">
      <legend>{label} <span>1 = mínimo · 10 = máximo</span></legend>
      <div className="score-picker">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
          <button
            type="button"
            key={score}
            className={`${value === score ? 'selected' : ''} ${score >= 7 ? 'score-alert' : score >= 4 ? 'score-moderate' : ''}`}
            onClick={() => onChange(score)}
            aria-pressed={value === score}
            aria-label={`${label}: ${score}`}
          >{score}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function PlayerForm({ player, measurements, matches, session, saving, onSave, onInjuryChange, onBack, role, selectedDate, onDateChange }: FormProps) {
  const measurementDate = role === 'staff' ? selectedDate : todayKey();
  const existing = measurements.find((item) => item.playerId === player.id && item.date === measurementDate);
  const [draft, setDraft] = useState<Draft>(() => readDraft(player.id, todayKey(), existing));
  const [errors, setErrors] = useState<string[]>([]);
  const [showEvolution, setShowEvolution] = useState(false);
  const today = todayKey();
  const activeInjury = player.injuries?.find((period) => period.startDate <= today && (!period.endDate || period.endDate >= today));
  const injuredOnSelectedDate = playerIsInjuredOn(player, selectedDate);
  const [injuryStartDate, setInjuryStartDate] = useState(activeInjury?.startDate || todayKey());
  const [injuryEndDate, setInjuryEndDate] = useState('');
  const [injuryReason, setInjuryReason] = useState(activeInjury?.reason || '');
  const [injuryError, setInjuryError] = useState('');
  const history = useMemo(() => recentForPlayer(measurements, player.id), [measurements, player.id]);

  useEffect(() => {
    setDraft(readDraft(player.id, measurementDate, existing));
    setErrors([]);
    setShowEvolution(false);
  }, [player.id, measurementDate]);

  useEffect(() => {
    const currentDate = todayKey();
    const active = player.injuries?.find((period) => period.startDate <= currentDate && (!period.endDate || period.endDate >= currentDate));
    setInjuryStartDate(active?.startDate || todayKey());
    setInjuryEndDate('');
    setInjuryReason(active?.reason || '');
    setInjuryError('');
  }, [player.id, player.injuries]);

  useEffect(() => {
    localStorage.setItem(draftKey(player.id, measurementDate), JSON.stringify(draft));
  }, [draft, player.id, measurementDate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const weight = draft.weight.trim() ? parseWeight(draft.weight) : undefined;
    const nextErrors: string[] = [];
    if (weight === null || weight === undefined) nextErrors.push('Introduce un peso válido entre 30 y 250 kg.');
    if (draft.fatigue === null) nextErrors.push('Selecciona el nivel de fatiga.');
    if (draft.soreness === null) nextErrors.push('Selecciona el nivel de molestias o lesión.');
    if (((draft.fatigue ?? 1) > 1 || (draft.soreness ?? 1) > 1) && !draft.comments.trim()) nextErrors.push('Explica el motivo cuando la fatiga o las molestias sean superiores a 1.');
    if (nextErrors.length || weight === null) {
      setErrors(nextErrors);
      return;
    }
    setErrors([]);
    const saved = await onSave({
      date: role === 'staff' ? measurementDate : undefined,
      playerId: player.id,
      playerName: player.name,
      weight,
      fatigue: draft.fatigue ?? undefined,
      soreness: draft.soreness ?? undefined,
      comments: draft.comments,
      sessionId: session.id,
    });
    if (saved) localStorage.removeItem(draftKey(player.id, measurementDate));
  };

  const change = weightChange(history);
  const discipline = matches.reduce((totals, match) => {
    const entry = match.minutes.find((item) => item.playerId === player.id);
    return { yellow: totals.yellow + (entry?.yellowCards ?? 0), red: totals.red + (entry?.redCards ?? 0) };
  }, { yellow: 0, red: 0 });
  const sanctionWarning = discipline.yellow > 0 && discipline.yellow % 5 === 4;

  return (
    <main className="page-shell form-page">
      {role === 'staff' && <button className="back-link" onClick={onBack}><ArrowLeft size={19} /> Volver al listado</button>}
      <div className="form-heading">
        <div className="player-avatar">{player.name.trim().slice(0, 1).toLocaleUpperCase('es')}</div>
        <div><p className="eyebrow eyebrow--dark">Control preentrenamiento · {formatDate(measurementDate)}</p><h1>{player.name}</h1>{existing && <span className="edit-badge"><History size={14} /> Editando una medición existente</span>}</div>
      </div>
      {(discipline.yellow > 0 || discipline.red > 0) && <section className={`discipline-profile-alert ${sanctionWarning ? 'discipline-profile-alert--danger' : ''}`}>
        <span className="card-mark card-mark--yellow" /> <strong>{discipline.yellow} amarillas</strong>
        <span className="card-mark card-mark--red" /> <strong>{discipline.red} rojas</strong>
        {sanctionWarning && <em>Alerta: a una amarilla de sanción</em>}
      </section>}

      {role === 'staff' && <section className={`injury-form-control injury-period-control ${player.injured ? 'injury-form-control--active' : ''}`}>
        <span className="injury-form-control__icon"><ShieldX size={24} /></span>
        <span><strong>{player.injured ? 'Baja por lesión activa' : 'Registrar periodo de baja'}</strong><small>Las fechas se conservarán y se incluirán en los informes.</small></span>
        <div className="injury-date-fields">
          <label>Fecha de inicio<input type="date" max={todayKey()} value={injuryStartDate} onChange={(event) => { setInjuryStartDate(event.target.value); setInjuryError(''); }} /></label>
          <label>Fecha final <small>{player.injured ? 'Rellénala al recibir el alta' : 'Opcional'}</small><input type="date" min={injuryStartDate} max={todayKey()} value={injuryEndDate} onChange={(event) => { setInjuryEndDate(event.target.value); setInjuryError(''); }} /></label>
          <label className="injury-reason-field">Motivo de la baja <small>Lesión, enfermedad u otra causa</small><input type="text" maxLength={160} value={injuryReason} onChange={(event) => { setInjuryReason(event.target.value); setInjuryError(''); }} placeholder="Ej.: esguince de tobillo derecho" /></label>
          <button type="button" className="button button--secondary" disabled={saving || !injuryStartDate || !injuryReason.trim()} onClick={() => { if (injuryEndDate && injuryEndDate < injuryStartDate) { setInjuryError('La fecha final no puede ser anterior al inicio.'); return; } if (!injuryReason.trim()) { setInjuryError('Indica el motivo de la baja.'); return; } void onInjuryChange(player.id, { startDate: injuryStartDate, endDate: injuryEndDate || undefined, reason: injuryReason.trim() }); }}><Save size={17} /> {player.injured ? injuryEndDate ? 'Finalizar baja' : 'Actualizar baja' : 'Guardar baja'}</button>
        </div>
        {injuryError && <p className="injury-date-error">{injuryError}</p>}
        {(player.injuries?.length ?? 0) > 0 && <div className="injury-history"><strong>Historial · {totalInjuryDays(player)} días de baja</strong>{player.injuries!.map((period) => <span key={period.id}>{formatDate(period.startDate)} → {period.endDate ? formatDate(period.endDate) : 'actualidad'} · {injuryPeriodDays(period)} días{period.reason ? ` · ${period.reason}` : ''}</span>)}</div>}
      </section>}

      {injuredOnSelectedDate ? <section className="injury-blocked-state injury-blocked-state--inline">
        <ShieldX size={38} />
        <h2>Medición desactivada</h2>
        <p>{role === 'staff' ? 'Desmarca «Baja por lesión» para volver a introducir sus datos.' : 'El cuerpo técnico ha marcado al jugador como baja por lesión.'}</p>
      </section> : <div className="form-layout">
        <form className="measurement-form" onSubmit={submit} noValidate>
          {role === 'staff' && <section className="form-section historical-date-field">
            <label htmlFor="measurement-date"><CalendarDays size={20} /> Fecha de la medición</label>
            <input id="measurement-date" type="date" max={todayKey()} value={measurementDate} onChange={(event) => onDateChange(event.target.value || todayKey())} />
            <small>Esta fecha se conservará al volver a la plantilla y al abrir el siguiente jugador.</small>
          </section>}
          <section className="form-section">
            <div className="weight-field">
              <label htmlFor="weight"><Scale size={20} /> Peso <span>kg</span></label>
              <input
                id="weight"
                data-testid="weight-input"
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                value={draft.weight}
                onChange={(event) => setDraft({ ...draft, weight: event.target.value.replace(/[^0-9.,]/g, '').slice(0, 6) })}
                placeholder="72,4"
                autoFocus={!existing}
              />
            </div>
          </section>
          <section className="form-section score-section">
            <ScorePicker label="Fatiga" value={draft.fatigue} onChange={(fatigue) => setDraft({ ...draft, fatigue })} />
            <ScorePicker label="Molestias o lesión" value={draft.soreness} onChange={(soreness) => setDraft({ ...draft, soreness })} />
          </section>
          <section className="form-section">
            <label className="comments-label" htmlFor="comments">Comentarios <span>Obligatorio si fatiga o molestias son superiores a 1</span></label>
            <textarea id="comments" rows={3} maxLength={500} value={draft.comments} onChange={(event) => setDraft({ ...draft, comments: event.target.value })} placeholder="Ej.: sobrecarga leve en gemelo derecho…" />
          </section>
          {errors.length > 0 && <div className="validation-summary" role="alert"><strong>Revisa estos campos:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
          <div className="form-actions">
            <button type="submit" className="button button--primary save-button" disabled={saving}><Save size={20} /> {saving ? 'Guardando…' : existing ? 'Actualizar medición' : 'Guardar medición'}</button>
          </div>
        </form>

        <aside className={`evolution-card ${showEvolution ? 'open' : ''}`}>
          <button className="evolution-toggle" onClick={() => setShowEvolution((value) => !value)} aria-expanded={showEvolution}>
            <span><History size={20} /><span><strong>Evolución reciente</strong><small>Últimas {Math.min(history.length, 10)} mediciones</small></span></span>
            {showEvolution ? <ChevronUp /> : <ChevronDown />}
          </button>
          {showEvolution && (
            <div className="evolution-content">
              <div className="evolution-stats">
                <div><small>Último peso</small><strong>{history.map((item) => item.weight).filter((value) => value !== undefined).at(-1) ?? '—'} <span>kg</span></strong></div>
                <div><small>Cambio</small><strong className={change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : ''}>{change > 0 ? <TrendingUp size={18} /> : change < 0 ? <TrendingDown size={18} /> : null}{change > 0 ? '+' : ''}{change} <span>kg</span></strong></div>
                {role === 'staff' && <div><small>Fatiga media</small><strong>{average(history.map((item) => item.fatigue)).toFixed(1)}</strong></div>}
                {role === 'staff' && <div><small>Molestias media</small><strong>{average(history.map((item) => item.soreness)).toFixed(1)}</strong></div>}
              </div>
              <div className="mini-chart"><span>Peso</span><Sparkline values={history.map((item) => item.weight).filter((value): value is number => value !== undefined)} label="Evolución del peso" /></div>
              {role === 'staff' && <div className="mini-chart"><span>Fatiga</span><Sparkline values={history.map((item) => item.fatigue).filter((value): value is number => value !== undefined)} color="#d39200" min={1} max={10} label="Evolución de la fatiga" /></div>}
              {role === 'staff' && <div className="mini-chart"><span>Molestias</span><Sparkline values={history.map((item) => item.soreness).filter((value): value is number => value !== undefined)} color="#c8424f" min={1} max={10} label="Evolución de las molestias" /></div>}
            </div>
          )}
        </aside>
      </div>}
    </main>
  );
}
