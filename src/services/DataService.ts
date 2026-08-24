import type { AttendanceInput, AttendanceRecord, AuthRole, BirthdayState, BootstrapData, InjuryInput, LoginResult, MatchInput, MatchRecord, Measurement, MeasurementInput, Player, TrainingSession } from '../types';

export interface DataService {
  authenticate(pin: string, role: AuthRole): Promise<LoginResult>;
  logout(token: string): Promise<void>;
  getBootstrap(token: string): Promise<BootstrapData>;
  getPlayers(token: string): Promise<Player[]>;
  getMeasurements(token: string): Promise<Measurement[]>;
  getCurrentSession(token: string): Promise<TrainingSession>;
  saveMeasurement(token: string, input: MeasurementInput): Promise<Measurement>;
  getMatches(token: string): Promise<MatchRecord[]>;
  saveMatch(token: string, input: MatchInput): Promise<MatchRecord>;
  updateMatch(token: string, matchId: string, input: MatchInput): Promise<MatchRecord>;
  deleteMatch(token: string, matchId: string): Promise<boolean>;
  getAttendance(token: string): Promise<AttendanceRecord[]>;
  saveAttendance(token: string, input: AttendanceInput): Promise<AttendanceRecord[]>;
  setPlayerInjury(token: string, playerId: string, injury: InjuryInput): Promise<Player>;
  saveBirthDate(token: string, birthDate: string): Promise<BirthdayState>;
}

export class DataServiceError extends Error {
  constructor(message: string, public code = 'DATA_ERROR') {
    super(message);
  }
}
