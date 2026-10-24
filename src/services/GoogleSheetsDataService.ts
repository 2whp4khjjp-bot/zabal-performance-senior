import type { TeamSettings } from '../utils/teamSettings';
import type { AttendanceInput, AttendanceRecord, AuthRole, BirthdayState, BootstrapData, DisciplineStatus, InjuryInput, LoginResult, MatchInput, MatchRecord, Measurement, MeasurementInput, Player, TrainingSession } from '../types';
import type { DataService } from './DataService';
import { DataServiceError } from './DataService';

type ApiResponse<T> = { ok: boolean; data?: T; error?: string; code?: string };

export class GoogleSheetsDataService implements DataService {
  constructor(private readonly endpoint: string) {}
  getTeamSettings(token: string) { return this.request<TeamSettings>('getTeamSettings', { token }); }
  saveTeamSettings(token: string, settings: TeamSettings) { return this.request<TeamSettings>('saveTeamSettings', { token, settings }); }
  emailAttendance(token: string, email: string, pdfBase64: string, periodLabel: string, requestId: string) { return this.request<boolean>('emailAttendance', { token, email, pdfBase64, periodLabel, requestId }); }
  getReportRecipients(token: string) { return this.request<string[]>('getReportRecipients', { token }); }
  saveReportRecipients(token: string, emails: string[]) { return this.request<string[]>('saveReportRecipients', { token, emails }); }
  emailMatchPdf(token: string, emails: string[], pdfBase64: string, reportLabel: string, requestId: string) { return this.request<boolean>('emailMatchPdf', { token, emails, pdfBase64, reportLabel, requestId }); }
  getReportSchedule(token: string) { return this.request<import('./DataService').ReportSchedule>('getReportSchedule', { token }); }
  saveReportSchedule(token: string, schedule: import('./DataService').ReportSchedule) { return this.request<import('./DataService').ReportSchedule>('saveReportSchedule', { token, schedule }); }


  private async request<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!this.endpoint) throw new DataServiceError('Falta configurar la URL de Google Apps Script.', 'CONFIG');
    let response: Response | undefined;
    let serviceReached = false;
    const isWrite = ['saveMeasurement', 'saveMatch', 'updateMatch', 'deleteMatch', 'markSanctionServed', 'saveAttendance', 'setPlayerInjury', 'saveBirthDate', 'saveReportRecipients', 'emailMatchPdf'].includes(action);
    const maxAttempts = 2;
    // Apps Script puede necesitar algo más de margen al despertar y escribir
    // un acta completa, especialmente desde conexiones móviles.
    const timeoutMs = isWrite ? 20000 : 8000;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const candidate = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...payload }),
          credentials: 'omit',
          redirect: 'follow',
          cache: 'no-store',
          signal: controller.signal,
        });
        serviceReached = true;
        if (candidate.ok) {
          response = candidate;
          break;
        }
      } catch {
        // La redirección temporal de Apps Script puede fallar de forma puntual.
      } finally {
        window.clearTimeout(timeout);
      }
      if (attempt < maxAttempts - 1) await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
    }
    if (!response) {
      if (serviceReached) throw new DataServiceError('No se pudo contactar con el servicio de datos.', 'NETWORK');
      throw new DataServiceError('No hay conexión. El formulario sigue guardado en este dispositivo.', 'OFFLINE');
    }
    const result = (await response.json()) as ApiResponse<T>;
    if (!result.ok || result.data === undefined) throw new DataServiceError(result.error || 'Error de datos.', result.code);
    return result.data;
  }

  authenticate(pin: string, role: AuthRole) {
    return this.request<LoginResult>('authenticate', { pin, role, includeBootstrap: true });
  }

  async logout(token: string) {
    await this.request<boolean>('logout', { token });
  }

  async getBootstrap(token: string) {
    try {
      return await this.request<BootstrapData>('getBootstrap', { token });
    } catch (error) {
      if (!(error instanceof DataServiceError) || error.code !== 'INVALID_ACTION') throw error;
      const [players, measurements, session] = await Promise.all([
        this.getPlayers(token), this.getMeasurements(token), this.getCurrentSession(token),
      ]);
      return { players, measurements, session };
    }
  }

  getPlayers(token: string) {
    return this.request<Player[]>('getPlayers', { token });
  }

  getMeasurements(token: string) {
    return this.request<Measurement[]>('getMeasurements', { token });
  }

  getCurrentSession(token: string) {
    return this.request<TrainingSession>('getCurrentSession', { token });
  }

  saveMeasurement(token: string, input: MeasurementInput) {
    return this.request<Measurement>('saveMeasurement', { token, measurement: input });
  }

  getMatches(token: string) {
    return this.request<MatchRecord[]>('getMatches', { token });
  }

  saveMatch(token: string, input: MatchInput) {
    return this.request<MatchRecord>('saveMatch', { token, match: input });
  }

  updateMatch(token: string, matchId: string, input: MatchInput) {
    return this.request<MatchRecord>('updateMatch', { token, matchId, match: input });
  }

  deleteMatch(token: string, matchId: string) {
    return this.request<boolean>('deleteMatch', { token, matchId });
  }

  getDisciplineStatuses(token: string) {
    return this.request<DisciplineStatus[]>('getDisciplineStatuses', { token });
  }

  markSanctionServed(token: string, playerId: string) {
    return this.request<DisciplineStatus>('markSanctionServed', { token, playerId });
  }

  getAttendance(token: string) {
    return this.request<AttendanceRecord[]>('getAttendance', { token });
  }

  saveAttendance(token: string, input: AttendanceInput) {
    return this.request<AttendanceRecord[]>('saveAttendance', { token, attendance: input });
  }

  setPlayerInjury(token: string, playerId: string, injury: InjuryInput) {
    return this.request<Player>('setPlayerInjury', { token, playerId, injury });
  }

  saveBirthDate(token: string, birthDate: string) {
    return this.request<BirthdayState>('saveBirthDate', { token, birthDate });
  }
}
