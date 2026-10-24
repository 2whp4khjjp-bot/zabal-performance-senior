import { useEffect, useState } from 'react';
import { CalendarClock, Mail, Plus, Trash2, X } from 'lucide-react';
import type { jsPDF } from 'jspdf';
import { dataService } from '../services';
import type { ReportSchedule } from '../services/DataService';
import { readAuthSession } from '../utils/session';

type Props = { label: string; createPdf: () => Promise<jsPDF>; canSchedule?: boolean; onClose: () => void };
const emailPattern = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const defaultSchedule: ReportSchedule = { enabled: false, weekday: 1, hour: 18, emails: [] };

export function ReportEmailPanel({ label, createPdf, canSchedule = false, onClose }: Props) {
  const [tab, setTab] = useState<'now' | 'schedule'>('now');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [schedule, setSchedule] = useState<ReportSchedule>(defaultSchedule);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let active = true;
    const auth = readAuthSession();
    if (!auth) { setMessage('Vuelve a iniciar sesión.'); return; }
    void dataService.getReportRecipients(auth.token).then((emails) => {
      if (active) { setRecipients(emails); setSelected(emails); }
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los destinatarios.'); });
    if (canSchedule) void dataService.getReportSchedule(auth.token).then((saved) => {
      if (active) { setSchedule(saved); setScheduleReady(true); }
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'No se pudo cargar la programación.'); });
    return () => { active = false; };
  }, [canSchedule]);

  const saveList = async (emails: string[]) => {
    const auth = readAuthSession();
    if (!auth) throw new Error('Vuelve a iniciar sesión.');
    const saved = await dataService.saveReportRecipients(auth.token, emails);
    setRecipients(saved);
    setSelected((current) => current.filter((email) => saved.includes(email)));
    setSchedule((current) => ({ ...current, emails: current.emails.filter((email) => saved.includes(email)) }));
  };
  const add = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!emailPattern.test(email) || email.length > 254) { setMessage('Introduce un correo válido.'); return; }
    if (recipients.includes(email)) { setSelected((current) => [...new Set([...current, email])]); setNewEmail(''); return; }
    setBusy(true); setMessage('');
    try {
      await saveList([...recipients, email]);
      setSelected((current) => [...new Set([...current, email])]);
      setNewEmail('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el correo.'); }
    finally { setBusy(false); }
  };
  const remove = async (email: string) => {
    setBusy(true); setMessage('');
    try { await saveList(recipients.filter((item) => item !== email)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo eliminar el correo.'); }
    finally { setBusy(false); }
  };
  const send = async () => {
    if (!selected.length) { setMessage('Selecciona al menos un destinatario.'); return; }
    setBusy(true); setMessage('');
    try {
      const auth = readAuthSession();
      if (!auth) throw new Error('Vuelve a iniciar sesión.');
      const pdf = await createPdf();
      await dataService.emailMatchPdf(auth.token, selected, pdf.output('datauristring').split(',')[1], label, requestId);
      setMessage('PDF enviado a ' + selected.join(', '));
      setRequestId(crypto.randomUUID());
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo enviar el PDF.'); }
    finally { setBusy(false); }
  };
  const saveSchedule = async (enabled: boolean) => {
    if (enabled && !schedule.emails.length) { setMessage('Selecciona al menos un destinatario para la programación.'); return; }
    setBusy(true); setMessage('');
    try {
      const auth = readAuthSession();
      if (!auth) throw new Error('Vuelve a iniciar sesión.');
      const saved = await dataService.saveReportSchedule(auth.token, { ...schedule, enabled });
      setSchedule(saved);
      setMessage(enabled ? 'Envío semanal activado.' : 'Programación guardada sin envíos automáticos.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar la programación.'); }
    finally { setBusy(false); }
  };

  return <section className="report-email-panel" aria-label="Enviar PDF por correo">
    <div className="report-email-panel__heading"><div><strong>Informes por correo</strong><small>{label}</small></div><button type="button" onClick={onClose} aria-label="Cerrar envío"><X size={18} /></button></div>
    {canSchedule && <div className="report-email-panel__tabs" role="tablist" aria-label="Modo de envío">
      <button type="button" role="tab" aria-selected={tab === 'now'} onClick={() => { setTab('now'); setMessage(''); }}>Enviar ahora</button>
      <button type="button" role="tab" aria-selected={tab === 'schedule'} onClick={() => { setTab('schedule'); setMessage(''); }}>Programar envíos</button>
    </div>}
    <form onSubmit={(event) => { event.preventDefault(); void add(); }} className="report-email-panel__add"><input type="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="nuevo@correo.com" aria-label="Nuevo correo" /><button type="submit" className="button button--secondary" disabled={busy || recipients.length >= 30}><Plus size={16} /> Guardar correo</button></form>
    <div className="report-email-panel__recipients">{recipients.length ? recipients.map((email) => <div key={email}><label><input type="checkbox" checked={tab === 'now' ? selected.includes(email) : schedule.emails.includes(email)} onChange={(event) => tab === 'now' ? setSelected((current) => event.target.checked ? [...current, email] : current.filter((item) => item !== email)) : setSchedule((current) => ({ ...current, emails: event.target.checked ? [...current.emails, email] : current.emails.filter((item) => item !== email) }))} /> {email}</label><button type="button" onClick={() => void remove(email)} disabled={busy} aria-label={'Eliminar ' + email}><Trash2 size={15} /></button></div>) : <p>Guarda un correo para poder seleccionarlo en futuros envíos.</p>}</div>
    {tab === 'now' ? <button type="button" className="button button--primary" disabled={busy || !selected.length} onClick={() => void send()}><Mail size={17} /> {busy ? 'Preparando…' : `Enviar PDF a ${selected.length}`}</button> : <div className="report-email-panel__schedule" role="tabpanel">
      <p>Estado: <strong>{scheduleReady && schedule.enabled ? 'Activo' : 'Desactivado'}</strong>. Guardar destinatarios no activa ningún envío.</p>
      <div className="report-email-panel__schedule-fields"><label>Día de la semana<select value={schedule.weekday} onChange={(event) => setSchedule((current) => ({ ...current, weekday: Number(event.target.value) }))}>{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label><label>Hora aproximada (Madrid)<select value={schedule.hour} onChange={(event) => setSchedule((current) => ({ ...current, hour: Number(event.target.value) }))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</select></label></div>
      <p>Se generará un acumulado actualizado de partidos en PDF. La hora del programador puede variar unos minutos.</p>
      <div className="report-email-panel__schedule-actions"><button type="button" className="button button--secondary" disabled={busy || !scheduleReady} onClick={() => void saveSchedule(false)}>{schedule.enabled ? 'Pausar envíos' : 'Guardar sin activar'}</button><button type="button" className="button button--primary" disabled={busy || !scheduleReady || !schedule.emails.length} onClick={() => void saveSchedule(true)}><CalendarClock size={17} /> {schedule.enabled ? 'Guardar y mantener activo' : 'Activar envíos semanales'}</button></div>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
