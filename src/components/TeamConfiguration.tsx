import { useState } from 'react';
import { Settings2, Save } from 'lucide-react';
import { dataService } from '../services';
import { readAuthSession } from '../utils/session';
import { setTeamSettings, useTeamSettings, type TeamSettings } from '../utils/teamSettings';
const labels: Record<Exclude<keyof TeamSettings, 'profile'>, string> = { weight: 'Pesaje', fatigue: 'Fatiga', soreness: 'Molestias', injuries: 'Bajas', attendance: 'Asistencia', matches: 'Partidos y minutos', cards: 'Tarjetas' };
export function TeamConfiguration() {
  const current = useTeamSettings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const save = async () => {
    const auth = readAuthSession(); if (!auth) return;
    setBusy(true); setMessage('');
    try { const saved = await dataService.saveTeamSettings(auth.token, draft); setTeamSettings(saved); setMessage('Configuración guardada para todo el equipo.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar la configuración.'); }
    finally { setBusy(false); }
  };
  return <section className="panel-card team-configuration">
    <button className="button button--secondary" onClick={() => { setDraft(current); setOpen(!open); }} aria-expanded={open}><Settings2 size={18} /> Configuración del equipo</button>
    {open && <div className="team-configuration__body"><label>Perfil del equipo<select value={draft.profile} onChange={(event) => { const profile = event.target.value as TeamSettings['profile']; const complete = profile === 'football11'; setDraft({ profile, weight: complete, fatigue: complete, soreness: complete, injuries: complete, cards: complete, attendance: true, matches: true }); }}><option value="football11">Fútbol 11 · hasta 11 titulares</option><option value="football7">Fútbol 7 · hasta 7 titulares</option></select></label>
      <div className="team-feature-grid">{Object.entries(labels).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key as keyof typeof labels]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} /><span>{label}</span></label>)}</div>
      <p className="muted-copy">Puedes cambiar estas opciones cuando lo necesites. Los datos registrados se conservan.</p>
      <button className="button button--primary" disabled={busy} onClick={() => void save()}><Save size={17} /> {busy ? 'Guardando…' : 'Guardar configuración'}</button>
      {message && <p role="status">{message}</p>}
    </div>}
  </section>;
}
