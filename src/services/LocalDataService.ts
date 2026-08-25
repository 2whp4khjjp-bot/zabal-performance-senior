import { appConfig, environment } from '../config';
import { createDemoMeasurements, createTodaySession, demoPlayers } from '../data/demo';
import type { AttendanceInput, AttendanceRecord, AuthRole, AuthSession, BirthdayState, BootstrapData, InjuryInput, LoginResult, MatchInput, MatchRecord, Measurement, MeasurementInput, Player, TrainingSession } from '../types';
import { todayKey } from '../utils/date';
import { playerIsInjuredOn } from '../utils/injuries';
import { sanitizeComment } from '../utils/measurements';
import type { DataService } from './DataService';
import { DataServiceError } from './DataService';

const MEASUREMENTS_KEY = 'zabal-demo-measurements-v1';
const PLAYERS_KEY = 'zabal-demo-players-v1';
const MATCHES_KEY = 'zabal-demo-matches-v1';
const ATTENDANCE_KEY = 'zabal-demo-attendance-v1';
const BIRTHDAYS_KEY = 'zabal-demo-birthdays-v1';

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
    localStorage.setItem(key, JSON.stringify(fallback));
  } catch (error) {
    console.warn('No se pudo leer el almacenamiento local.', error);
  }
  return fallback;
};

export class LocalDataService implements DataService {
  private sessions = new Map<string, AuthSession>();

  private requireSession(token: string) {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) throw new DataServiceError('La sesión ya no es válida.', 'UNAUTHORIZED');
    return session;
  }

  async authenticate(pin: string, role: AuthRole): Promise<LoginResult> {
    let player: Player | undefined;
    if (role === 'staff') {
      const inputHash = await sha256(pin);
      if (inputHash !== environment.staffPinHash) throw new DataServiceError('El PIN del cuerpo técnico no es correcto.', 'INVALID_PIN');
    } else {
      const players = readJson(PLAYERS_KEY, demoPlayers).filter((item) => item.active).sort((a, b) => a.order - b.order);
      const playerIndex = Number(pin) - 1001;
      player = /^\d{4}$/.test(pin) ? players[playerIndex] : undefined;
      if (!player) throw new DataServiceError('El PIN de jugador no es correcto.', 'INVALID_PIN');
    }
    const session: AuthSession = {
      token: `local-${crypto.randomUUID()}`,
      expiresAt: Date.now() + appConfig.sessionDurationMinutes * 60 * 1000,
      role,
      playerId: player?.id,
      playerName: player?.name,
    };
    this.sessions.set(session.token, session);
    return { auth: session, bootstrap: await this.getBootstrap(session.token) };
  }

  async logout(token: string): Promise<void> { this.sessions.delete(token); }

  async getBootstrap(token: string): Promise<BootstrapData> {
    const auth = this.requireSession(token);
    const [players, measurements, session] = await Promise.all([
      this.getPlayers(token), this.getMeasurements(token), this.getCurrentSession(token),
    ]);
    const birthdayState = this.getBirthdayState(auth);
    return { players, measurements, session, ...birthdayState };
  }

  private getBirthdayState(auth: AuthSession): BirthdayState {
    const birthdays = readJson<Record<string, string>>(BIRTHDAYS_KEY, {});
    const allPlayers = readJson(PLAYERS_KEY, demoPlayers).filter((player) => player.active);
    const today = todayKey().slice(5);
    return {
      needsBirthDate: auth.role === 'player' && Boolean(auth.playerId) && !birthdays[auth.playerId!],
      birthdaysToday: allPlayers.filter((player) => birthdays[player.id]?.slice(5) === today).map((player) => player.name),
    };
  }

  async saveBirthDate(token: string, birthDate: string): Promise<BirthdayState> {
    const auth = this.requireSession(token);
    if (auth.role !== 'player' || !auth.playerId) throw new DataServiceError('Solo el jugador puede registrar su fecha de cumpleaños.', 'FORBIDDEN');
    const clean = String(birthDate || '').trim();
    const date = new Date(`${clean}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== clean || clean > todayKey() || clean < '1900-01-01') {
      throw new DataServiceError('Introduce una fecha de cumpleaños válida.', 'VALIDATION');
    }
    const birthdays = readJson<Record<string, string>>(BIRTHDAYS_KEY, {});
    if (birthdays[auth.playerId]) throw new DataServiceError('La fecha de cumpleaños ya está registrada.', 'BIRTHDATE_ALREADY_SET');
    birthdays[auth.playerId] = clean;
    localStorage.setItem(BIRTHDAYS_KEY, JSON.stringify(birthdays));
    return this.getBirthdayState(auth);
  }

  async getPlayers(token: string): Promise<Player[]> {
    const session = this.requireSession(token);
    const players = readJson(PLAYERS_KEY, demoPlayers).filter((player) => player.active).sort((a, b) => a.order - b.order);
    return session.role === 'player' ? players.filter((player) => player.id === session.playerId) : players;
  }

  async getMeasurements(token: string): Promise<Measurement[]> {
    const session = this.requireSession(token);
    const measurements = readJson(MEASUREMENTS_KEY, createDemoMeasurements());
    return session.role === 'player' ? measurements.filter((item) => item.playerId === session.playerId) : measurements;
  }

  async getCurrentSession(token: string): Promise<TrainingSession> {
    this.requireSession(token);
    return createTodaySession();
  }

  async saveMeasurement(token: string, input: MeasurementInput): Promise<Measurement> {
    const auth = this.requireSession(token);
    if (auth.role === 'player' && auth.playerId !== input.playerId) throw new DataServiceError('No puedes guardar datos de otro jugador.', 'FORBIDDEN');
    const players = readJson(PLAYERS_KEY, demoPlayers);
    const player = players.find((item) => item.id === input.playerId);
    if (!player || player.name !== input.playerName) throw new DataServiceError('Jugador no válido.', 'INVALID_PLAYER');
    if (input.weight === undefined || input.weight < 30 || input.weight > 250) throw new DataServiceError('Introduce un peso válido.', 'VALIDATION');
    if (input.fatigue === undefined || input.soreness === undefined) throw new DataServiceError('Debes completar peso, fatiga y molestias.', 'VALIDATION');
    const scores = [input.fatigue, input.soreness];
    if (!scores.every((value) => Number.isInteger(value) && value >= 1 && value <= 10)) {
      throw new DataServiceError('Los valores deben estar entre 1 y 10.', 'VALIDATION');
    }
    if ((input.fatigue > 1 || input.soreness > 1) && !input.comments.trim()) throw new DataServiceError('Explica el motivo cuando la fatiga o las molestias sean superiores a 1.', 'VALIDATION');

    const items = readJson(MEASUREMENTS_KEY, createDemoMeasurements());
    const date = auth.role === 'staff' && input.date ? input.date : todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayKey()) throw new DataServiceError('La fecha de la medición no es válida.', 'VALIDATION');
    const existingIndex = items.findIndex((item) => item.playerId === input.playerId && item.date === date);

    const now = new Date();
    const previous = existingIndex >= 0 ? items[existingIndex] : undefined;
    const previousCreatedAt = previous ? new Date(previous.createdAt).getTime() : NaN;
    if (previous && auth.role !== 'staff' && (!Number.isFinite(previousCreatedAt) || Date.now() - previousCreatedAt > 24 * 60 * 60 * 1000)) {
      throw new DataServiceError('Han pasado más de 24 horas. Solo el cuerpo técnico puede modificar este registro.', 'EDIT_WINDOW_EXPIRED');
    }
    const measurement: Measurement = {
      id: previous?.id || crypto.randomUUID(),
      date,
      time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      createdAt: previous?.createdAt || now.toISOString(),
      playerId: player.id,
      playerName: player.name,
      weight: input.weight === undefined ? previous?.weight : Number(input.weight.toFixed(2)),
      fatigue: input.fatigue ?? previous?.fatigue,
      soreness: input.soreness ?? previous?.soreness,
      comments: sanitizeComment(input.comments),
      sessionId: input.sessionId,
      createdBy: auth.role === 'player' ? `jugador:${player.id}` : 'cuerpo-tecnico',
      updatedAt: now.toISOString(),
    };

    if (existingIndex >= 0) items[existingIndex] = measurement;
    else items.push(measurement);
    localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(items));
    const attendance = readJson<AttendanceRecord[]>(ATTENDANCE_KEY, []);
    const attendanceIndex = attendance.findIndex((item) => item.playerId === player.id && item.date === date);
    const previousAttendance = attendanceIndex >= 0 ? attendance[attendanceIndex] : undefined;
    const present: AttendanceRecord = {
      id: previousAttendance?.id || crypto.randomUUID(),
      date,
      playerId: player.id,
      playerName: player.name,
      status: 'present',
      lateMinutes: 0,
      comments: previousAttendance?.comments || 'Presencia registrada automáticamente mediante medición',
      createdAt: previousAttendance?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: measurement.createdBy,
    };
    if (attendanceIndex >= 0) attendance[attendanceIndex] = present;
    else attendance.push(present);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendance));
    return measurement;
  }

  async getMatches(token: string): Promise<MatchRecord[]> {
    const auth = this.requireSession(token);
    const matches = readJson<MatchRecord[]>(MATCHES_KEY, []).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
    return auth.role === 'player' ? matches.map((match) => ({ ...match, minutes: match.minutes.filter((entry) => entry.playerId === auth.playerId) })) : matches;
  }

  async saveMatch(token: string, input: MatchInput): Promise<MatchRecord> {
    const auth = this.requireSession(token);
    if (auth.role !== 'staff') throw new DataServiceError('Solo el cuerpo técnico puede guardar partidos.', 'FORBIDDEN');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new DataServiceError('La fecha del partido no es válida.', 'VALIDATION');
    if (!['official', 'friendly'].includes(input.type)) throw new DataServiceError('El tipo de partido no es válido.', 'VALIDATION');
    const opponent = input.opponent.replace(/[<>]/g, '').trim().slice(0, 100);
    if (!opponent) throw new DataServiceError('Introduce el rival.', 'VALIDATION');
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 180) {
      throw new DataServiceError('La duración del partido no es válida.', 'VALIDATION');
    }
    const players = readJson(PLAYERS_KEY, demoPlayers);
    const seen = new Set<string>();
    const minutes = input.minutes.map((entry) => {
      const player = players.find((item) => item.id === entry.playerId && item.active);
      if (!player || player.name !== entry.playerName || seen.has(entry.playerId)) throw new DataServiceError('Hay un jugador no válido o repetido.', 'INVALID_PLAYER');
      if (!Number.isInteger(entry.minutes) || entry.minutes < 0 || entry.minutes > input.durationMinutes) {
        throw new DataServiceError(`Los minutos de ${entry.playerName} no son válidos.`, 'VALIDATION');
      }
      seen.add(entry.playerId);
      const calledUp = Boolean(entry.calledUp);
      const starter = Boolean(entry.starter);
      const goals = entry.goals ?? 0;
      const yellowCards = entry.yellowCards ?? 0;
      const redCards = entry.redCards ?? 0;
      if (!Number.isInteger(goals) || goals < 0 || goals > 20) throw new DataServiceError(`Revisa los goles de ${entry.playerName}.`, 'VALIDATION');
      if (!Number.isInteger(yellowCards) || yellowCards < 0 || yellowCards > 2) throw new DataServiceError(`Revisa las amarillas de ${entry.playerName}.`, 'VALIDATION');
      if (!Number.isInteger(redCards) || redCards < 0 || redCards > 1) throw new DataServiceError(`Revisa las rojas de ${entry.playerName}.`, 'VALIDATION');
      if (!calledUp && (starter || entry.minutes > 0 || goals > 0 || yellowCards > 0 || redCards > 0)) throw new DataServiceError(`${entry.playerName} debe figurar como convocado.`, 'VALIDATION');
      return { playerId: player.id, playerName: player.name, calledUp, starter, minutes: entry.minutes, goals, yellowCards, redCards };
    });
    if (!minutes.some((entry) => entry.calledUp)) throw new DataServiceError('Marca como convocado al menos a un jugador.', 'VALIDATION');
    if (minutes.filter((entry) => entry.starter).length > appConfig.maxStarters) throw new DataServiceError(`No puedes marcar más de ${appConfig.maxStarters} titulares.`, 'VALIDATION');
    const now = new Date().toISOString();
    const match: MatchRecord = {
      id: crypto.randomUUID(), date: input.date, type: input.type, opponent,
      durationMinutes: input.durationMinutes, minutes, createdAt: now, updatedAt: now, createdBy: 'cuerpo-tecnico',
    };
    const matches = readJson<MatchRecord[]>(MATCHES_KEY, []);
    const duplicate = input.requestId && matches.find((item) => item.id === input.requestId);
    if (duplicate) return duplicate;
    if (input.requestId) match.id = input.requestId;
    matches.push(match);
    localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
    return match;
  }

  async updateMatch(token: string, matchId: string, input: MatchInput): Promise<MatchRecord> {
    const matches = readJson<MatchRecord[]>(MATCHES_KEY, []);
    const index = matches.findIndex((item) => item.id === matchId);
    if (index < 0) throw new DataServiceError('Partido no encontrado.', 'NOT_FOUND');
    const temporary = await this.saveMatch(token, { ...input, requestId: crypto.randomUUID() });
    const refreshed = readJson<MatchRecord[]>(MATCHES_KEY, []);
    const updated = { ...temporary, id: matchId, createdAt: matches[index].createdAt, updatedAt: new Date().toISOString() };
    const next = refreshed.filter((item) => item.id !== temporary.id).map((item) => item.id === matchId ? updated : item);
    localStorage.setItem(MATCHES_KEY, JSON.stringify(next));
    return updated;
  }

  async deleteMatch(token: string, matchId: string): Promise<boolean> {
    const auth = this.requireSession(token);
    if (auth.role !== 'staff') throw new DataServiceError('Solo el cuerpo técnico puede eliminar partidos.', 'FORBIDDEN');
    const matches = readJson<MatchRecord[]>(MATCHES_KEY, []);
    const next = matches.filter((item) => item.id !== matchId);
    if (next.length === matches.length) throw new DataServiceError('Partido no encontrado.', 'NOT_FOUND');
    localStorage.setItem(MATCHES_KEY, JSON.stringify(next));
    return true;
  }

  async getAttendance(token: string): Promise<AttendanceRecord[]> {
    const auth = this.requireSession(token);
    if (auth.role !== 'staff') throw new DataServiceError('Solo el cuerpo técnico puede consultar la asistencia.', 'FORBIDDEN');
    return readJson<AttendanceRecord[]>(ATTENDANCE_KEY, []).sort((a, b) => `${b.date}${b.updatedAt}`.localeCompare(`${a.date}${a.updatedAt}`));
  }

  async saveAttendance(token: string, input: AttendanceInput): Promise<AttendanceRecord[]> {
    const auth = this.requireSession(token);
    if (auth.role !== 'staff') throw new DataServiceError('Solo el cuerpo técnico puede guardar la asistencia.', 'FORBIDDEN');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > todayKey()) throw new DataServiceError('La fecha de asistencia no es válida.', 'VALIDATION');
    const players = readJson(PLAYERS_KEY, demoPlayers).filter((player) => player.active && !player.staffMember);
    const playersById = new Map(players.map((player) => [player.id, player]));
    const statuses = new Set(['pending', 'present', 'late', 'justified', 'unjustified', 'individual', 'medical']);
    const seen = new Set<string>();
    const now = new Date().toISOString();
    const current = readJson<AttendanceRecord[]>(ATTENDANCE_KEY, []);
    const previousByPlayer = new Map(current.filter((item) => item.date === input.date).map((item) => [item.playerId, item]));
    const saved = input.entries.map((entry) => {
      const player = playersById.get(entry.playerId);
      if (!player || player.name !== entry.playerName || seen.has(entry.playerId)) throw new DataServiceError('Hay un jugador no válido o repetido.', 'INVALID_PLAYER');
      if (!statuses.has(entry.status)) throw new DataServiceError(`Revisa la asistencia de ${entry.playerName}.`, 'VALIDATION');
      const lateMinutes = entry.status === 'late' ? Number(entry.lateMinutes) : 0;
      if (entry.status === 'late' && (!Number.isInteger(lateMinutes) || lateMinutes < 1 || lateMinutes > 180)) throw new DataServiceError(`Revisa los minutos de retraso de ${entry.playerName}.`, 'VALIDATION');
      seen.add(entry.playerId);
      const previous = previousByPlayer.get(entry.playerId);
      return {
        id: previous?.id || crypto.randomUUID(), date: input.date, playerId: player.id, playerName: player.name,
        status: entry.status, lateMinutes, comments: entry.comments.replace(/[<>]/g, '').trim().slice(0, 250),
        createdAt: previous?.createdAt || now, updatedAt: now, createdBy: 'cuerpo-tecnico',
      } as AttendanceRecord;
    });
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify([...current.filter((item) => item.date !== input.date), ...saved]));
    return saved;
  }

  async setPlayerInjury(token: string, playerId: string, injury: InjuryInput): Promise<Player> {
    const auth = this.requireSession(token);
    if (auth.role !== 'staff') throw new DataServiceError('Solo el cuerpo técnico puede cambiar una baja.', 'FORBIDDEN');
    const players = readJson(PLAYERS_KEY, demoPlayers);
    const index = players.findIndex((player) => player.id === playerId);
    if (index < 0) throw new DataServiceError('Jugador no válido.', 'INVALID_PLAYER');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(injury.startDate) || (injury.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(injury.endDate) || injury.endDate < injury.startDate))) throw new DataServiceError('Revisa las fechas de la baja.', 'VALIDATION');
    const periods = [...(players[index].injuries ?? [])];
    const today = todayKey();
    const activeIndex = periods.findIndex((period) => period.startDate <= today && (!period.endDate || period.endDate >= today));
    const reason = injury.reason?.replace(/[<>]/g, '').trim().slice(0, 160) || periods[activeIndex]?.reason;
    if (!reason) throw new DataServiceError('Indica el motivo de la baja.', 'VALIDATION');
    const period = { id: activeIndex >= 0 ? periods[activeIndex].id : crypto.randomUUID(), startDate: injury.startDate, endDate: injury.endDate || undefined, reason };
    if (activeIndex >= 0) periods[activeIndex] = period;
    else periods.push(period);
    players[index] = { ...players[index], injuries: periods };
    players[index].injured = playerIsInjuredOn(players[index], today);
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
    return players[index];
  }
}
