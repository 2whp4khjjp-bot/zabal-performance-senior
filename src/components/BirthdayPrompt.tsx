import { useState, type FormEvent } from 'react';
import { CalendarDays, CakeSlice, PartyPopper, X } from 'lucide-react';
import { todayKey } from '../utils/date';

export function BirthdayPrompt({ playerName, saving, onSave }: { playerName: string; saving: boolean; onSave: (birthDate: string) => Promise<boolean> }) {
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const date = new Date(`${birthDate}T12:00:00`);
    if (!birthDate || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== birthDate || birthDate > todayKey()) {
      setError('Introduce una fecha válida.');
      return;
    }
    setError('');
    await onSave(birthDate);
  };

  return <div className="birthday-modal" role="dialog" aria-modal="true" aria-labelledby="birthday-title">
    <form className="birthday-card" onSubmit={(event) => void submit(event)}>
      <div className="birthday-card__icon"><CakeSlice size={30} /></div>
      <p className="eyebrow eyebrow--dark">Completa tu perfil</p>
      <h2 id="birthday-title">Indica tu fecha de nacimiento, {playerName.split(' ')[0]}</h2>
      <p>Solo tendrás que indicarla una vez.</p>
      <label htmlFor="birth-date"><CalendarDays size={18} /> Fecha de nacimiento</label>
      <input id="birth-date" type="date" min="1900-01-01" max={todayKey()} value={birthDate} onChange={(event) => { setBirthDate(event.target.value); setError(''); }} required autoFocus />
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button--primary button--wide" type="submit" disabled={!birthDate || saving}><PartyPopper size={19} /> {saving ? 'Guardando…' : 'Guardar fecha'}</button>
      <small>La fecha completa queda guardada de forma privada.</small>
    </form>
  </div>;
}

export function BirthdayBanner({ names, onClose }: { names: string[]; onClose: () => void }) {
  if (!names.length) return null;
  const people = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
  return <div className="birthday-banner" role="status">
    <span className="birthday-banner__icon"><PartyPopper size={23} /></span>
    <div><strong>¡Hoy estamos de celebración!</strong><span>Es el cumpleaños de {people}. ¡Muchas felicidades!</span></div>
    <button type="button" onClick={onClose} aria-label="Cerrar aviso de cumpleaños"><X size={19} /></button>
  </div>;
}
