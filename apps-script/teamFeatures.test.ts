import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('apps-script/Code.gs', 'utf8') + '\n' + readFileSync('apps-script/ReportSchedule.gs', 'utf8') + '\n' + readFileSync('apps-script/DisciplineSchedule.gs', 'utf8');
function service() {
  const values = new Map<string, string>();
  const properties = { getProperty: (key: string) => values.get(key), setProperty: (key: string, value: string) => values.set(key, value), getProperties: () => Object.fromEntries(values), deleteProperty: (key: string) => values.delete(key) };
  const lock = { tryLock: () => true, releaseLock: () => undefined };
  const send = vi.fn();
  const triggers: Array<{ getHandlerFunction: () => string }> = [];
  const scriptApp = { WeekDay: { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 }, getProjectTriggers: () => triggers, deleteTrigger: (trigger: (typeof triggers)[number]) => triggers.splice(triggers.indexOf(trigger), 1), newTrigger: (handler: string) => { const builder = { timeBased: () => builder, onWeekDay: () => builder, atHour: () => builder, nearMinute: () => builder, everyWeeks: () => builder, inTimezone: () => builder, create: () => { triggers.push({ getHandlerFunction: () => handler }); } }; return builder; } };
  const context = vm.createContext({ console, PropertiesService: { getScriptProperties: () => properties }, LockService: { getScriptLock: () => lock, getUserLock: () => lock }, ScriptApp: scriptApp, MailApp: { getRemainingDailyQuota: () => 100, sendEmail: send }, Utilities: { base64Decode: (value: string) => Buffer.from(value, 'base64'), newBlob: (bytes: Uint8Array) => ({ bytes }) } });
  vm.runInContext(source, context);
  vm.runInContext("sha256_ = function(value) { return 'hash:' + value; }; dateKey_ = function() { return '2026-10-22'; };", context);
  return { context, send, values, triggers };
}
describe('configuración y documentos del equipo', () => {

  it('el envío disciplinario desactivado no manda correos', () => {
    const { context, send } = service();
    context.runScheduledDisciplineReport_();
    expect(send).not.toHaveBeenCalled();
  });
  it('el envío semanal se confirma una sola vez por día', () => {
    const { context, send, values } = service();
    values.set('DISCIPLINE_REPORT_SCHEDULE_V1', JSON.stringify({enabled:true,weekday:5,hour:10,emails:['a@example.com']}));
    context.Utilities.formatDate = (_date: unknown, _zone: string, format: string) => format === 'u' ? '5' : '2026-10-23';
    context.collectDisciplineReport_ = () => [];
    context.buildDisciplineReportPdf_ = () => ({});
    context.runScheduledDisciplineReport_();
    context.runScheduledDisciplineReport_();
    expect(send).toHaveBeenCalledTimes(1);
    expect(values.get('DISCIPLINE_LAST_SENT')).toBeTruthy();
  });
  it('un fallo de correo queda visible y no se marca como enviado', () => {
    const { context, send, values } = service();
    values.set('DISCIPLINE_REPORT_SCHEDULE_V1', JSON.stringify({enabled:true,weekday:5,hour:10,emails:['a@example.com']}));
    context.Utilities.formatDate = (_date: unknown, _zone: string, format: string) => format === 'u' ? '5' : '2026-10-23';
    context.collectDisciplineReport_ = () => [];
    context.buildDisciplineReportPdf_ = () => ({});
    send.mockImplementation(() => { throw new Error('Fallo simulado'); });
    expect(() => context.runScheduledDisciplineReport_()).toThrow('Fallo simulado');
    expect(values.get('DISCIPLINE_LAST_ERROR')).toBe('Fallo simulado');
    expect(values.has('DISCIPLINE_REPORT_SCHEDULE_SENT_2026-10-23')).toBe(false);
  });
  it('el cálculo de Google excluye ciclos cerrados, dobles y sanciones cumplidas', () => {
    const { context } = service();
    context.invalidateMatchesApiCache_ = () => undefined;
    context.getPlayers_ = () => [{id:'p',name:'Jugador',number:2}];
    context.getMatches_ = () => Array.from({length:9},(_,i) => ({
      id:String(i),date:'2026-10-01',type:'official',stage:'league',opponent:'J'+(i+1)+' Rival',
      minutes:[{playerId:'p',yellowCards:i<5||i===8?1:i===6?2:0,redCards:i===6?1:0,expulsionYellowCards:i===6?2:0,suspensionServed:i===5||i===7}]
    }));
    // Fechas diferentes garantizan el orden cronológico incluso con IDs no numéricos.
    const matches = context.getMatches_();
    matches.forEach((m: {date:string},i:number) => {m.date='2026-10-'+String(i+1).padStart(2,'0');});
    context.getMatches_ = () => matches;
    const [row] = context.collectDisciplineReport_();
    expect(row.balance).toBe(1);
    expect(row.pending).toBe(0);
    expect(row.cycleEvents.map((e: {round:string})=>e.round)).toEqual(['9']);
  });
  it('mantiene independiente y desactivado el envío disciplinario', () => {
    const {context,triggers}=service();
    expect(context.getDisciplineSchedule_({role:'staff'})).toMatchObject({enabled:false,weekday:5,hour:10});
    expect(()=>context.getDisciplineSchedule_({role:'player'})).toThrow();
    context.getReportRecipients_=()=>['a@example.com'];
    context.saveDisciplineSchedule_({enabled:true,weekday:5,hour:10,emails:['a@example.com']},{role:'staff'});
    expect(triggers.map(t=>t.getHandlerFunction())).toEqual(['runScheduledDisciplineReport_']);
    expect(context.getReportSchedule_({role:'staff'}).enabled).toBe(false);
    context.saveDisciplineSchedule_({enabled:false,weekday:5,hour:10,emails:['a@example.com']},{role:'staff'});
    expect(triggers).toHaveLength(0);
  });
  it('rechaza cambios de configuración realizados por un jugador', () => {
    const { context } = service(); expect(() => context.saveTeamSettings_({ ...context.defaultTeamSettings_(), profile: 'football7' }, { role: 'player' })).toThrow();
  });
  it('guarda el perfil y las funciones para futuras sesiones', () => {
    const { context } = service(); context.saveTeamSettings_({ ...context.defaultTeamSettings_(), profile: 'football7', weight: false }, { role: 'staff' });
    expect(context.getTeamSettings_()).toMatchObject({ profile: 'football7', weight: false });
  });
  it('valida el resultado completo y la pertenencia del capitán a la convocatoria', () => {
    const { context } = service(); expect(() => context.cleanMatchDetails_({ goalsFor: 2 })).toThrow();
    expect(() => context.cleanMatchDetails_({ captainId: 'p1', minutes: [] })).toThrow();
    expect(context.cleanMatchDetails_({ goalsFor: 0, goalsAgainst: 0, captainId: 'p1', minutes: [{ playerId: 'p1', calledUp: true }] })).toMatchObject({ goalsFor: 0, goalsAgainst: 0, captainId: 'p1' });
  });
  it('evita enviar dos veces el mismo correo al reintentarlo', () => {
    const { context, send } = service();
    const input = { email: 'entrenador@example.com', pdfBase64: Buffer.from('%PDF-1.4 prueba').toString('base64'), periodLabel: '1 mes', requestId: '12345678-1234-1234-1234-123456789012' };
    context.emailAttendance_(input, { role: 'staff' }); context.emailAttendance_(input, { role: 'staff' });
    expect(send).toHaveBeenCalledTimes(1); expect(send.mock.calls[0][0].attachments).toHaveLength(1);
  });
  it('guarda destinatarios y no duplica un PDF de partido al reintentar', () => {
    const { context, send } = service();
    expect(() => context.saveReportRecipients_(['a@example.com'], { role: 'player' })).toThrow();
    const saved = context.saveReportRecipients_(['A@example.com', 'a@example.com', 'b@example.com'], { role: 'staff' });
    expect(Array.from(saved)).toEqual(['a@example.com', 'b@example.com']);
    expect(Array.from(context.getReportRecipients_({ role: 'staff' }))).toEqual(['a@example.com', 'b@example.com']);
    const input = { emails: ['a@example.com', 'b@example.com'], pdfBase64: Buffer.from('%PDF-1.4 prueba').toString('base64'), reportLabel: 'Partido contra Rival', requestId: '12345678-1234-1234-1234-123456789012' };
    context.emailMatchPdf_(input, { role: 'staff' }); context.emailMatchPdf_(input, { role: 'staff' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('a@example.com,b@example.com');
    expect(send.mock.calls[0][0].attachments).toHaveLength(1);
  });
  it('deja la programación apagada hasta una activación expresa y permite pausarla', () => {
    const { context, send, triggers } = service();
    context.saveReportRecipients_(['a@example.com'], { role: 'staff' });
    expect(context.getReportSchedule_({ role: 'staff' }).enabled).toBe(false);
    expect(triggers).toHaveLength(0);
    context.saveReportSchedule_({ enabled: false, weekday: 1, hour: 18, emails: ['a@example.com'] }, { role: 'staff' });
    expect(triggers).toHaveLength(0);
    context.saveReportSchedule_({ enabled: true, weekday: 1, hour: 18, emails: ['a@example.com'] }, { role: 'staff' });
    expect(triggers).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
    context.saveReportRecipients_([], { role: 'staff' });
    expect(triggers).toHaveLength(0);
    expect(context.getReportSchedule_({ role: 'staff' }).enabled).toBe(false);
  });
  it('calcula el acumulado nuevo y evita repetir el envío del mismo día', () => {
    const { context, send } = service();
    context.getPlayers_ = () => [{ id: 'p1', name: 'Jugador Uno', number: 7 }];
    context.getMatches_ = () => [{ id: 'm1', date: '2026-10-25', opponent: 'Rival', minutes: [{ playerId: 'p1', minutes: 50, goals: 2, starter: true, yellowCards: 1, redCards: 0 }] }];
    context.rows_ = (sheet: string) => sheet === 'Jugadores' ? [{ id: 'p1', nombre: 'Jugador Uno' }] : [{ clave: 'nombre_equipo', valor: 'Zabal' }, { clave: 'temporada', valor: '2026-27' }];
    const report = context.collectScheduledMatchReport_('2026-10-26');
    expect(report.matchCount).toBe(1);
    expect(report.players[0]).toMatchObject({ calledUp: 1, starters: 1, played: 1, minutes: 50, goals: 2, yellowCards: 1 });
    context.saveReportRecipients_(['a@example.com'], { role: 'staff' });
    context.saveReportSchedule_({ enabled: true, weekday: 1, hour: 18, emails: ['a@example.com'] }, { role: 'staff' });
    context.Utilities.formatDate = (_date: Date, _zone: string, format: string) => format === 'u' ? '1' : '2026-10-26';
    context.buildScheduledMatchReportPdf_ = () => ({ name: 'informe.pdf' });
    context.runScheduledMatchReport_(); context.runScheduledMatchReport_();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].attachments).toHaveLength(1);
  });
  it('rechaza correos de jugadores y archivos que no son PDF', () => {
    const { context, send } = service(); expect(() => context.emailAttendance_({}, { role: 'player' })).toThrow();
    expect(() => context.emailAttendance_({ email: 'entrenador@example.com', requestId: '12345678-1234-1234-1234-123456789012', pdfBase64: 'bm8gcGRm' }, { role: 'staff' })).toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it('reintenta los detalles sin duplicar el partido ya guardado', () => {
    const { context } = service(); const matches: unknown[] = [];
    context.saveMatch_ = vi.fn(() => { const match = { id: 'match-1' }; matches.push(match); return match; });
    context.getMatches_ = () => matches;
    context.persistMatchDetails_ = vi.fn().mockImplementationOnce(() => { throw new Error('Fallo temporal'); }).mockImplementation((match, details) => ({ ...match, ...details }));
    const input = { requestId: 'request-id', referee: 'Árbitro', minutes: [] };
    expect(() => context.saveMatchWithDetails_(input, { role: 'staff' })).toThrow('Fallo temporal');
    expect(context.saveMatchWithDetails_(input, { role: 'staff' })).toMatchObject({ id: 'match-1', referee: 'Árbitro' });
    expect(context.saveMatch_).toHaveBeenCalledTimes(1);
  });
});
