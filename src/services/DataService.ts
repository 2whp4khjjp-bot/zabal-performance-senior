import type { TeamSettings } from '../utils/teamSettings';
import type { AttendanceInput, AttendanceRecord, AuthRole, BirthdayState, BootstrapData, DisciplineStatus, InjuryInput, LoginResult, MatchInput, MatchRecord, Measurement, MeasurementInput, Player, TrainingSession } from '../types';

export type ReportSchedule = { enabled: boolean; weekday: number; hour: number; emails: string[] };

export interface DataService {
  getTeamSettings(token: string): Promise<TeamSettings>;
  saveTeamSettings(token: string, settings: TeamSettings): Promise<TeamSettings>;
  emailAttendance(token: string, email: string, pdfBase64: string, periodLabel: string, requestId: string): Promise<boolean>;
  getReportRecipients(token: string): Promise<string[]>;
  saveReportRecipients(token: string, emails: string[]): Promise<string[]>;
  emailMatchPdf(token: string, emails: string[], pdfBase64: string, reportLabel: string, requestId: string): Promise<boolean>;
  getReportSchedule(token: string): Promise<ReportSchedule>;
  saveReportSchedule(token: string, schedule: ReportSchedule): Promise<ReportSchedule>;
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
  getDisciplineStatuses(token: string): Promise<DisciplineStatus[]>;
  markSanctionServed(token: string, playerId: string): Promise<DisciplineStatus>;
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
