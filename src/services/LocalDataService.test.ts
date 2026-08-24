import { beforeEach, describe, expect, it } from 'vitest';
import { LocalDataService } from './LocalDataService';

describe('servicio local', () => {
  beforeEach(() => localStorage.clear());
  it('valida el PIN sin almacenarlo', async () => {
    const service = new LocalDataService();
    await expect(service.authenticate('1234', 'staff')).rejects.toThrow('PIN');
    const { auth: session } = await service.authenticate('9999', 'staff');
    expect(session.token).toMatch(/^local-/);
    expect(Object.keys(localStorage).some((key) => /pin|session|auth/i.test(key))).toBe(false);
  });
  it('exige el control completo y comentario cuando algún valor supera 1', async () => {
    const service = new LocalDataService();
    const { auth } = await service.authenticate('9999', 'staff');
    const players = await service.getPlayers(auth.token);
    const session = await service.getCurrentSession(auth.token);
    const input = { playerId: players[0].id, playerName: players[0].name, weight: 72.5, fatigue: 1, soreness: 1, comments: '', sessionId: session.id };
    await expect(service.saveMeasurement(auth.token, { ...input, fatigue: undefined })).rejects.toThrow('completar');
    await expect(service.saveMeasurement(auth.token, { ...input, fatigue: 2 })).rejects.toThrow('Explica');
    const saved = await service.saveMeasurement(auth.token, input);
    expect(saved.weight).toBe(72.5);
  });
  it('el jugador solo puede leer y guardar sus propios datos', async () => {
    const service = new LocalDataService();
    const { auth } = await service.authenticate('1001', 'player');
    const players = await service.getPlayers(auth.token);
    const measurements = await service.getMeasurements(auth.token);
    expect(players).toHaveLength(1);
    expect(measurements.every((item) => item.playerId === players[0].id)).toBe(true);
  });
  it('pide el cumpleaños una vez y anuncia solo el nombre cuando coincide con hoy', async () => {
    const service = new LocalDataService();
    const { auth, bootstrap } = await service.authenticate('1001', 'player');
    expect(bootstrap?.needsBirthDate).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    const saved = await service.saveBirthDate(auth.token, today);
    expect(saved).toEqual({ needsBirthDate: false, birthdaysToday: ['Jugador 1'] });
    await expect(service.saveBirthDate(auth.token, today)).rejects.toThrow('ya está registrada');

    const { bootstrap: staffBootstrap } = await service.authenticate('9999', 'staff');
    expect(staffBootstrap?.birthdaysToday).toEqual(['Jugador 1']);
    expect(staffBootstrap).not.toHaveProperty('birthDate');
  });
  it('guarda minutos de partido solo para el cuerpo técnico', async () => {
    const service = new LocalDataService();
    const { auth: staff } = await service.authenticate('9999', 'staff');
    const players = await service.getPlayers(staff.token);
    const saved = await service.saveMatch(staff.token, {
      date: '2026-08-09', type: 'official', opponent: 'UD Los Barrios', durationMinutes: 90,
      minutes: [{ playerId: players[0].id, playerName: players[0].name, calledUp: true, starter: true, minutes: 74, goals: 1 }],
    });
    expect(saved.durationMinutes).toBe(90);
    expect((await service.getMatches(staff.token))[0].minutes[0].minutes).toBe(74);

    const { auth: player } = await service.authenticate('1001', 'player');
    const playerMatches = await service.getMatches(player.token);
    expect(playerMatches).toHaveLength(1);
    expect(playerMatches[0].minutes).toEqual([{ playerId: 'player-01', playerName: 'Jugador 1', calledUp: true, starter: true, minutes: 74, goals: 1, yellowCards: 0, redCards: 0 }]);
  });

  it('no duplica reintentos y permite editar y eliminar partidos', async () => {
    const service = new LocalDataService();
    const { auth: staff } = await service.authenticate('9999', 'staff');
    const players = await service.getPlayers(staff.token);
    const input = { requestId: 'request-1', date: '2026-08-10', type: 'friendly' as const, opponent: 'Lynx', durationMinutes: 90, minutes: [{ playerId: players[0].id, playerName: players[0].name, calledUp: true, minutes: 45 }] };
    const first = await service.saveMatch(staff.token, input);
    const retry = await service.saveMatch(staff.token, input);
    expect(retry.id).toBe(first.id);
    expect((await service.getMatches(staff.token)).filter((match) => match.id === first.id)).toHaveLength(1);
    const updated = await service.updateMatch(staff.token, first.id, { ...input, opponent: 'Lynx editado', requestId: undefined });
    expect(updated.opponent).toBe('Lynx editado');
    await expect(service.deleteMatch(staff.token, first.id)).resolves.toBe(true);
    expect((await service.getMatches(staff.token)).some((match) => match.id === first.id)).toBe(false);
  });

  it('guarda una asistencia diaria y acumula minutos de retraso', async () => {
    const service = new LocalDataService();
    const { auth: staff } = await service.authenticate('9999', 'staff');
    const players = await service.getPlayers(staff.token);
    const date = new Date().toISOString().slice(0, 10);
    const saved = await service.saveAttendance(staff.token, {
      date,
      entries: players.slice(0, 2).map((player, index) => ({
        playerId: player.id, playerName: player.name, status: index === 0 ? 'late' : 'present', lateMinutes: index === 0 ? 12 : 0, comments: '',
      })),
    });
    expect(saved[0]).toMatchObject({ status: 'late', lateMinutes: 12 });
    expect(await service.getAttendance(staff.token)).toHaveLength(2);
  });
});
