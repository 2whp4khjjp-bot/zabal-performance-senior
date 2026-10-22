import { useState } from 'react';
import { Download, Mail } from 'lucide-react';
import type { AttendanceRecord, Player } from '../types';
import { createAttendanceDocument, downloadAttendanceDocument } from '../services/teamDocuments';
import { dataService } from '../services';
import { readAuthSession } from '../utils/session';
export function AttendanceExports({ players, records, label }: { players: Player[]; records: AttendanceRecord[]; label: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const run = async (send: boolean) => {
    setBusy(true); setMessage('');
    try {
      if (!send) await downloadAttendanceDocument(players, records, label);
      else {
        const auth = readAuthSession(); if (!auth) throw new Error('Vuelve a iniciar sesión.');
        const doc = await createAttendanceDocument(players, records, label);
        await dataService.emailAttendance(auth.token, email.trim(), doc.output('datauristring').split(',')[1], label, requestId);
        setMessage('Informe enviado a ' + email.trim()); setRequestId(crypto.randomUUID());
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo preparar el informe.'); }
    finally { setBusy(false); }
  };
  return <div className="attendance-exports"><button className="button button--secondary" disabled={busy || !records.length} onClick={() => void run(false)}><Download size={17} /> Descargar asistencias</button><form onSubmit={(event) => { event.preventDefault(); void run(true); }}><input type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setRequestId(crypto.randomUUID()); }} placeholder="Correo del destinatario" aria-label="Correo del destinatario" /><button className="button button--primary" disabled={busy || !records.length}><Mail size={17} /> {busy ? 'Preparando…' : 'Enviar por correo'}</button></form>{message && <p role="status">{message}</p>}</div>;
}
