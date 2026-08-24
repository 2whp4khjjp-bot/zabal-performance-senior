export type Player = {
  id: string;
  name: string;
  number?: number;
  active: boolean;
  order: number;
  joinedAt: string;
  injured?: boolean;
  injuries?: InjuryPeriod[];
  staffMember?: boolean;
};

export type InjuryPeriod = {
  id: string;
  startDate: string;
  endDate?: string;
  reason?: string;
};

export type InjuryInput = {
  startDate: string;
  endDate?: string;
  reason?: string;
};

export type Measurement = {
  id: string;
  date: string;
  time: string;
  createdAt: string;
  playerId: string;
  playerName: string;
  weight?: number;
  fatigue?: number;
  soreness?: number;
  comments: string;
  sessionId: string;
  createdBy: string;
  updatedAt: string;
  pendingSync?: boolean;
};

export type TrainingSession = {
  id: string;
  date: string;
  type: string;
  opponent?: string;
  matchday?: string;
  active: boolean;
  openedAt: string;
  closedAt?: string;
};

export type AlertLevel = 'pending' | 'partial' | 'normal' | 'moderate' | 'alert';

export type AuthRole = 'player' | 'staff';

export type AppConfig = {
  teamName: string;
  season: string;
  sessionDurationMinutes: number;
  thresholds: {
    moderateFrom: number;
    alertFrom: number;
    relevantWeightChangeKg: number;
  };
  colors: { navy: string; yellow: string };
  logoSrc: string;
  maxStarters: number;
};

export type AuthSession = {
  token: string;
  expiresAt: number;
  role: AuthRole;
  playerId?: string;
  playerName?: string;
};

export type DashboardFilter = 'all' | 'pending' | 'registered';

export type AttendanceStatus = 'pending' | 'present' | 'late' | 'justified' | 'unjustified' | 'individual' | 'medical';

export type AttendanceRecord = {
  id: string;
  date: string;
  playerId: string;
  playerName: string;
  status: AttendanceStatus;
  lateMinutes: number;
  comments: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type AttendanceInput = {
  date: string;
  entries: Array<Pick<AttendanceRecord, 'playerId' | 'playerName' | 'status' | 'lateMinutes' | 'comments'>>;
};

export type MeasurementInput = {
  date?: string;
  playerId: string;
  playerName: string;
  weight?: number;
  fatigue?: number;
  soreness?: number;
  comments: string;
  sessionId: string;
};

export type BootstrapData = {
  players: Player[];
  measurements: Measurement[];
  session: TrainingSession;
  needsBirthDate?: boolean;
  birthdaysToday?: string[];
};

export type BirthdayState = {
  needsBirthDate: boolean;
  birthdaysToday: string[];
};

export type LoginResult = {
  auth: AuthSession;
  bootstrap?: BootstrapData;
};

export type ReportKind = 'daily' | 'weekly' | 'player' | 'alerts';

export type MatchType = 'official' | 'friendly';

export type MatchMinutes = {
  playerId: string;
  playerName: string;
  calledUp?: boolean;
  starter?: boolean;
  minutes: number;
  goals?: number;
  yellowCards?: number;
  redCards?: number;
};

export type PlayerDiscipline = {
  playerId: string;
  yellowCards: number;
  redCards: number;
};

export type MatchRecord = {
  id: string;
  date: string;
  type: MatchType;
  opponent: string;
  durationMinutes: number;
  minutes: MatchMinutes[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type MatchInput = {
  requestId?: string;
  date: string;
  type: MatchType;
  opponent: string;
  durationMinutes: number;
  minutes: MatchMinutes[];
};
