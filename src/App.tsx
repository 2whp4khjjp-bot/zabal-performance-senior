import { lazy, Suspense, useEffect, useState } from 'react';
import type { AttendanceInput, AttendanceRecord, AuthRole, AuthSession, BirthdayState, BootstrapData, DashboardFilter, InjuryInput, MatchInput, MatchRecord, Measurement, MeasurementInput, Player, TrainingSession } from './types';
import { dataService } from './services';
import { clearAuthSession, readAuthSession, remainingSeconds, saveAuthSession } from './utils/session';
import { AppHeader } from './components/AppHeader';
import { LoginScreen } from './components/LoginScreen';
import { OfflineBanner } from './components/OfflineBanner';
import { PlayerGrid } from './components/PlayerGrid';
import { PlayerForm } from './components/PlayerForm';
import { Toast } from './components/Toast';
import { SiteFooter } from './components/SiteFooter';
import { PageNavigation } from './components/PageNavigation';
import { BirthdayBanner, BirthdayPrompt } from './components/BirthdayPrompt';
import { environment } from './config';
import { todayKey } from './utils/date';
import { applyJuvenilRoster } from './utils/roster';
import './styles.css';

const TechnicalPanel = lazy(() => import('./components/TechnicalPanel').then((module) => ({ default: module.TechnicalPanel })));
const MatchesPanel = lazy(() => import('./components/MatchesPanel').then((module) => ({ default: module.MatchesPanel })));
const AttendancePanel = lazy(() => import('./components/AttendancePanel').then((module) => ({ default: module.AttendancePanel })));

type View = 'players' | 'matches' | 'attendance' | 'technical';

type RosterCache = { players: Player[]; session: TrainingSession; savedAt: number };
type MatchesCache = { matches: MatchRecord[]; savedAt: number };
type AttendanceCache = { attendance: AttendanceRecord[]; savedAt: number };
const rosterCacheKey = (auth: AuthSession) => `zabal-roster-v1-${auth.role}-${auth.playerId || 'staff'}`;
const matchesCacheKey = (auth: AuthSession) => `zabal-matches-v1-${auth.role}-${auth.playerId || 'staff'}`;
const attendanceCacheKey = (auth: AuthSession) => `zabal-attendance-v1-${auth.role}-${auth.playerId || 'staff'}`;
const readRosterCache = (auth: AuthSession): RosterCache | null => {
  try {
    const cached = JSON.parse(localStorage.getItem(rosterCacheKey(auth)) || 'null') as RosterCache | null;
    return cached?.players?.length && cached.session ? cached : null;
  } catch { return null; }
};
const saveRosterCache = (auth: AuthSession, players: Player[], session: TrainingSession) => {
  try { localStorage.setItem(rosterCacheKey(auth), JSON.stringify({ players, session, savedAt: Date.now() })); } catch { /* La app sigue operativa sin caché. */ }
};
const readMatchesCache = (auth: AuthSession): MatchesCache | null => {
  try {
    const cached = JSON.parse(localStorage.getItem(matchesCacheKey(auth)) || 'null') as MatchesCache | null;
    return Array.isArray(cached?.matches) ? cached : null;
  } catch { return null; }
};
const saveMatchesCache = (auth: AuthSession, matches: MatchRecord[]) => {
  try { localStorage.setItem(matchesCacheKey(auth), JSON.stringify({ matches, savedAt: Date.now() })); } catch { /* La app sigue operativa sin caché. */ }
};
const readAttendanceCache = (auth: AuthSession): AttendanceCache | null => {
  try {
    const cached = JSON.parse(localStorage.getItem(attendanceCacheKey(auth)) || 'null') as AttendanceCache | null;
    return Array.isArray(cached?.attendance) ? cached : null;
  } catch { return null; }
};
const saveAttendanceCache = (auth: AuthSession, attendance: AttendanceRecord[]) => {
  try { localStorage.setItem(attendanceCacheKey(auth), JSON.stringify({ attendance, savedAt: Date.now() })); } catch { /* La app sigue operativa sin caché. */ }
};

export default function App() {
  const [auth, setAuth] = useState<AuthSession | null>(() => readAuthSession());
  const [remaining, setRemaining] = useState(() => auth ? remainingSeconds(auth.expiresAt) : 0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [trainingSession, setTrainingSession] = useState<TrainingSession | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [measurementDate, setMeasurementDate] = useState(todayKey());
  const [view, setView] = useState<View>('players');
  const [filter, setFilter] = useState<DashboardFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [hydratedToken, setHydratedToken] = useState('');
  const [birthdayState, setBirthdayState] = useState<BirthdayState>({ needsBirthDate: false, birthdaysToday: [] });
  const [birthdayNoticeOpen, setBirthdayNoticeOpen] = useState(false);

  const applyBirthdayState = (bootstrap: BootstrapData) => {
    const next = {
      needsBirthDate: Boolean(bootstrap.needsBirthDate),
      birthdaysToday: Array.isArray(bootstrap.birthdaysToday) ? bootstrap.birthdaysToday : [],
    };
    setBirthdayState(next);
    setBirthdayNoticeOpen(next.birthdaysToday.length > 0);
  };

  const logout = async () => {
    if (auth) void dataService.logout(auth.token).catch(() => undefined);
    clearAuthSession();
    setAuth(null);
    setPlayers([]);
    setMeasurements([]);
    setTrainingSession(null);
    setMatches([]);
    setAttendance([]);
    setAttendanceLoaded(false);
    setBirthdayState({ needsBirthDate: false, birthdaysToday: [] });
    setBirthdayNoticeOpen(false);
    setHydratedToken('');
    setSelectedPlayer(null);
    setMeasurementDate(todayKey());
    setView('players');
    setRemaining(0);
  };

  useEffect(() => {
    const online = () => setOffline(false);
    const offlineHandler = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offlineHandler);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offlineHandler); };
  }, []);

  useEffect(() => {
    if (!auth) return;
    const update = () => {
      const seconds = remainingSeconds(auth.expiresAt);
      setRemaining(seconds);
      if (seconds <= 0) void logout();
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [auth?.expiresAt]);

  useEffect(() => {
    if (!auth) return;
    const cached = readRosterCache(auth);
    if (cached) {
      const cachedPlayers = applyJuvenilRoster(cached.players);
      setPlayers(cachedPlayers);
      setTrainingSession(cached.session);
      if (auth.role === 'player') setSelectedPlayer(cachedPlayers[0] ?? null);
      setLoading(false);
    }
    setLoading(!cached);
    dataService.getBootstrap(auth.token).then((bootstrap) => {
      const { players: nextPlayers, measurements: nextMeasurements, session: nextSession } = bootstrap;
      const roster = applyJuvenilRoster(nextPlayers);
      setPlayers(roster);
      setMeasurements(nextMeasurements);
      setTrainingSession(nextSession);
      setHydratedToken(auth.token);
      saveRosterCache(auth, roster, nextSession);
      applyBirthdayState(bootstrap);
      if (auth.role === 'player') setSelectedPlayer(roster[0] ?? null);
      if (auth.role === 'staff') {
        void dataService.getMeasurements(auth.token)
          .then(setMeasurements)
          .catch(() => setError('La plantilla está disponible, pero el histórico sigue cargándose.'));
      }
    }).catch((cause: Error) => {
      const unauthorized = /sesión|session|unauthorized/i.test(cause.message);
      if (unauthorized) {
        void logout();
        return;
      }
      if (cached) {
        setHydratedToken(auth.token);
        setToast('Mostrando la última plantilla guardada mientras Google se recupera');
      } else setError(cause.message || 'No se pudieron cargar los datos.');
    }).finally(() => setLoading(false));
  }, [auth?.token, hydratedToken]);

  useEffect(() => {
    if (!auth || matchesLoaded || (auth.role === 'staff' && view !== 'matches' && view !== 'technical')) return;
    const cached = readMatchesCache(auth);
    if (cached) {
      setMatches(cached.matches);
      setMatchesLoaded(true);
    } else setLoading(true);
    dataService.getMatches(auth.token)
      .then((nextMatches) => { setMatches(nextMatches); setMatchesLoaded(true); saveMatchesCache(auth, nextMatches); })
      .catch((cause: Error) => {
        if (cached) setToast('Partidos disponibles sin conexión; se actualizarán al recuperar Google');
        else setError(cause.message || 'No se pudieron cargar los partidos.');
      })
      .finally(() => setLoading(false));
  }, [auth?.token, auth?.role, view, matchesLoaded]);

  useEffect(() => {
    if (!auth || auth.role !== 'staff' || (view !== 'attendance' && view !== 'technical') || attendanceLoaded) return;
    const cached = readAttendanceCache(auth);
    if (cached) { setAttendance(cached.attendance); setAttendanceLoaded(true); }
    else setLoading(true);
    dataService.getAttendance(auth.token)
      .then((nextAttendance) => { setAttendance(nextAttendance); setAttendanceLoaded(true); saveAttendanceCache(auth, nextAttendance); })
      .catch((cause: Error) => {
        if (cached) setToast('Asistencia disponible sin conexión; se actualizará al recuperar Google');
        else setError(cause.message || 'No se pudo cargar la asistencia.');
      })
      .finally(() => setLoading(false));
  }, [auth?.token, auth?.role, view, attendanceLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const login = async (pin: string, role: AuthRole) => {
    setLoading(true);
    setError('');
    try {
      const { auth: session, bootstrap } = await dataService.authenticate(pin, role);
      saveAuthSession(session);
      if (bootstrap) {
        const nextPlayers = applyJuvenilRoster(bootstrap.players);
        setPlayers(nextPlayers);
        setMeasurements(bootstrap.measurements);
        setTrainingSession(bootstrap.session);
        saveRosterCache(session, nextPlayers, bootstrap.session);
        setHydratedToken(session.token);
        applyBirthdayState(bootstrap);
        if (role === 'player') setSelectedPlayer(nextPlayers[0] ?? null);
        if (role === 'staff') {
          void dataService.getMeasurements(session.token)
            .then(setMeasurements)
            .catch(() => setError('La plantilla está disponible, pero el histórico sigue cargándose.'));
        }
      }
      setAuth(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const saveMeasurement = async (input: MeasurementInput) => {
    if (!auth) return false;
    setSaving(true);
    setError('');
    try {
      const saved = await dataService.saveMeasurement(auth.token, input);
      setMeasurements((current) => {
        const index = current.findIndex((item) => item.id === saved.id);
        if (index < 0) return [...current, saved];
        const next = [...current];
        next[index] = saved;
        return next;
      });
      setAttendance((current) => {
        const existing = current.find((item) => item.playerId === saved.playerId && item.date === saved.date);
        const present = {
          id: existing?.id || `measurement-${saved.id}`,
          date: saved.date,
          playerId: saved.playerId,
          playerName: saved.playerName,
          status: 'present' as const,
          lateMinutes: 0,
          comments: existing?.comments || 'Presencia registrada automáticamente mediante medición',
          createdAt: existing?.createdAt || saved.createdAt,
          updatedAt: saved.updatedAt,
          createdBy: saved.createdBy,
        };
        const next = [...current.filter((item) => item.playerId !== saved.playerId || item.date !== saved.date), present];
        if (attendanceLoaded) saveAttendanceCache(auth, next);
        return next;
      });
      setToast('Datos guardados correctamente');
      if (auth.role === 'staff') window.setTimeout(() => { setSelectedPlayer(null); setView('players'); }, 850);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la medición.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveBirthDate = async (birthDate: string) => {
    if (!auth || auth.role !== 'player') return false;
    setSaving(true);
    setError('');
    try {
      const next = await dataService.saveBirthDate(auth.token, birthDate);
      setBirthdayState(next);
      setBirthdayNoticeOpen(next.birthdaysToday.length > 0);
      setToast('Cumpleaños guardado correctamente');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la fecha de cumpleaños.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveMatch = async (input: MatchInput) => {
    if (!auth || auth.role !== 'staff') return false;
    setSaving(true);
    setError('');
    try {
      const saved = await dataService.saveMatch(auth.token, { ...input, requestId: input.requestId || crypto.randomUUID() });
      setMatches((current) => { const next = [saved, ...current]; saveMatchesCache(auth, next); return next; });
      setToast('Partido, minutos y tarjetas guardados');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el partido.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateMatch = async (matchId: string, input: MatchInput) => {
    if (!auth || auth.role !== 'staff') return false;
    setSaving(true); setError('');
    try {
      const updated = await dataService.updateMatch(auth.token, matchId, input);
      setMatches((current) => { const next = current.map((match) => match.id === matchId ? updated : match); saveMatchesCache(auth, next); return next; });
      setToast('Partido actualizado');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el partido.');
      return false;
    } finally { setSaving(false); }
  };

  const deleteMatch = async (matchId: string) => {
    if (!auth || auth.role !== 'staff') return false;
    setSaving(true); setError('');
    try {
      await dataService.deleteMatch(auth.token, matchId);
      setMatches((current) => { const next = current.filter((match) => match.id !== matchId); saveMatchesCache(auth, next); return next; });
      setToast('Partido eliminado');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el partido.');
      return false;
    } finally { setSaving(false); }
  };

  const saveAttendance = async (input: AttendanceInput) => {
    if (!auth || auth.role !== 'staff') return false;
    setSaving(true); setError('');
    try {
      const saved = await dataService.saveAttendance(auth.token, input);
      setAttendance((current) => {
        const next = [...current.filter((item) => item.date !== input.date), ...saved];
        saveAttendanceCache(auth, next);
        return next;
      });
      setToast('Asistencia guardada correctamente');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la asistencia.');
      return false;
    } finally { setSaving(false); }
  };

  const setPlayerInjury = async (playerId: string, injury: InjuryInput) => {
    if (!auth || auth.role !== 'staff') return false;
    setSaving(true);
    setError('');
    try {
      const updated = await dataService.setPlayerInjury(auth.token, playerId, injury);
      setPlayers((current) => {
        const next = applyJuvenilRoster(current.map((player) => player.id === updated.id ? updated : player));
        if (trainingSession) saveRosterCache(auth, next, trainingSession);
        return next;
      });
      setSelectedPlayer((current) => current?.id === updated.id ? { ...current, ...updated } : current);
      setToast(updated.injured ? 'Periodo de baja guardado' : 'Baja finalizada y jugador disponible');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado del jugador.');
      return false;
    } finally { setSaving(false); }
  };

  const goBack = () => {
    if (auth?.role === 'staff' && selectedPlayer) { setSelectedPlayer(null); setView('players'); return; }
    if (auth?.role === 'staff' && view !== 'players') { setView('players'); return; }
    if (window.history.length > 1) window.history.back();
    else window.location.assign(environment.homeUrl);
  };

  if (!auth) return (
    <div className="login-shell">
      <OfflineBanner offline={offline} />
      <LoginScreen onLogin={login} loading={loading} error={error} />
      <SiteFooter />
    </div>
  );

  return (
    <div className="app">
      <OfflineBanner offline={offline} />
      <AppHeader remaining={remaining} view={view} role={auth.role} playerName={auth.playerName} onViewChange={(next) => { setView(next); setSelectedPlayer(null); }} onLogout={() => void logout()} />
      {birthdayNoticeOpen && <BirthdayBanner names={birthdayState.birthdaysToday} onClose={() => setBirthdayNoticeOpen(false)} />}
      {error && <div className="global-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Cerrar</button></div>}
      <PageNavigation onBack={goBack} onHome={() => window.location.assign(environment.homeUrl)} />
      {loading && !players.length ? <div className="loading-screen"><span className="loader" /><p>Preparando la sesión…</p></div> : null}
      {!loading && auth.role === 'staff' && view === 'players' && !selectedPlayer && <PlayerGrid players={players} measurements={measurements} selectedDate={measurementDate} onDateChange={setMeasurementDate} onSelect={setSelectedPlayer} filter={filter} onFilterChange={setFilter} query={query} onQueryChange={setQuery} />}
      {!loading && view === 'players' && selectedPlayer && trainingSession && <PlayerForm player={selectedPlayer} measurements={measurements} matches={matches} session={trainingSession} saving={saving} onSave={saveMeasurement} onInjuryChange={setPlayerInjury} onBack={() => setSelectedPlayer(null)} role={auth.role} selectedDate={measurementDate} onDateChange={setMeasurementDate} />}
      <Suspense fallback={<div className="loading-screen"><span className="loader" /><p>Cargando módulo…</p></div>}>
        {!loading && auth.role === 'staff' && view === 'matches' && <MatchesPanel players={players} matches={matches} saving={saving} onSave={saveMatch} onUpdate={updateMatch} onDelete={deleteMatch} />}
        {!loading && auth.role === 'staff' && view === 'attendance' && <AttendancePanel players={players} measurements={measurements} attendance={attendance} saving={saving} onSave={saveAttendance} />}
        {!loading && auth.role === 'staff' && view === 'technical' && <TechnicalPanel players={players} measurements={measurements} matches={matches} attendance={attendance} />}
      </Suspense>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {auth.role === 'player' && birthdayState.needsBirthDate && <BirthdayPrompt playerName={auth.playerName || 'jugador'} saving={saving} onSave={saveBirthDate} />}
      <SiteFooter />
    </div>
  );
}
