import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('apps-script/Code.gs', 'utf8');
function service() {
  const values = new Map<string, string>();
  const properties = { getProperty: (key: string) => values.get(key), setProperty: (key: string, value: string) => values.set(key, value), getProperties: () => Object.fromEntries(values), deleteProperty: (key: string) => values.delete(key) };
  const lock = { tryLock: () => true, releaseLock: () => undefined };
  const send = vi.fn();
  const context = vm.createContext({ console, PropertiesService: { getScriptProperties: () => properties }, LockService: { getScriptLock: () => lock, getUserLock: () => lock }, MailApp: { getRemainingDailyQuota: () => 100, sendEmail: send }, Utilities: { base64Decode: (value: string) => Buffer.from(value, 'base64'), newBlob: (bytes: Uint8Array) => ({ bytes }) } });
  vm.runInContext(source, context);
  vm.runInContext("sha256_ = function(value) { return 'hash:' + value; }; dateKey_ = function() { return '2026-10-22'; };", context);
  return { context, send, values };
}
describe('configuración y documentos del equipo', () => {
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
