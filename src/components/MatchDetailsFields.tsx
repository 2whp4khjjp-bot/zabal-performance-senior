import { useState } from 'react';
import { FileDown } from 'lucide-react';
import type { MatchRecord, Player } from '../types';
import { downloadMatchDocument } from '../services/teamDocuments';
export type MatchDetails = Pick<MatchRecord, 'referee' | 'goalsFor' | 'goalsAgainst' | 'incidents' | 'captainId'>;
export const emptyMatchDetails: MatchDetails = { referee: '', goalsFor: undefined, goalsAgainst: undefined, incidents: '', captainId: '' };
export const detailsFromMatch = (match: MatchRecord): MatchDetails => ({ referee: match.referee || '', goalsFor: match.goalsFor, goalsAgainst: match.goalsAgainst, incidents: match.incidents || '', captainId: match.captainId || '' });
export function MatchDetailsFields({ value, onChange, players }: { value: MatchDetails; onChange: (value: MatchDetails) => void; players: Player[] }) {
  return <div className="match-extra-fields"><label>Árbitro<input value={value.referee} maxLength={120} onChange={(event) => onChange({ ...value, referee: event.target.value })} placeholder="Nombre y apellidos" /></label>
    <label>Capitán del partido<select value={value.captainId} onChange={(event) => onChange({ ...value, captainId: event.target.value })}><option value="">Seleccionar capitán</option>{players.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}</select></label>
    <label>Goles del Zabal<input type="number" min="0" max="99" inputMode="numeric" value={value.goalsFor ?? ''} onChange={(event) => onChange({ ...value, goalsFor: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
    <label>Goles del rival<input type="number" min="0" max="99" inputMode="numeric" value={value.goalsAgainst ?? ''} onChange={(event) => onChange({ ...value, goalsAgainst: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
    <label className="match-extra-fields__wide">Incidencias<textarea rows={3} maxLength={3000} value={value.incidents} onChange={(event) => onChange({ ...value, incidents: event.target.value })} placeholder="Observaciones e incidencias del encuentro" /></label>
  </div>;
}
export function MatchPdfButton({ match, players }: { match: MatchRecord; players: Player[] }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <span className="match-pdf-action"><button type="button" className="button button--secondary" disabled={busy} aria-label={'Descargar informe del partido contra ' + match.opponent} onClick={() => { setBusy(true); setError(''); void downloadMatchDocument(match, players).catch(() => setError('No se pudo crear el PDF. Inténtalo otra vez.')).finally(() => setBusy(false)); }}><FileDown size={16} /> {busy ? 'Creando…' : 'PDF'}</button>{error && <small role="alert">{error}</small>}</span>;
}
