/** Programación optativa del PDF acumulado. Sin configuración, no hay trigger ni envío. */
const MATCH_REPORT_SCHEDULE_KEY = 'MATCH_REPORT_SCHEDULE_V1';
const MATCH_REPORT_SCHEDULE_HANDLER = 'runScheduledMatchReport_';
const MATCH_REPORT_TIMEZONE = 'Europe/Madrid';

function cleanReportSchedule_(input) {
  if (!input || typeof input !== 'object' || typeof input.enabled !== 'boolean') throw apiError_('Programación no válida.', 'VALIDATION');
  const weekday = Number(input.weekday);
  const hour = Number(input.hour);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !Number.isInteger(hour) || hour < 0 || hour > 23) throw apiError_('Día u hora no válidos.', 'VALIDATION');
  const emails = cleanReportRecipients_(input.emails);
  if (input.enabled && !emails.length) throw apiError_('Selecciona destinatarios antes de activar.', 'VALIDATION');
  return { enabled: input.enabled, weekday: weekday, hour: hour, emails: emails };
}

function getReportSchedule_(session) {
  requireStaff_(session);
  const raw = PropertiesService.getScriptProperties().getProperty(MATCH_REPORT_SCHEDULE_KEY);
  return raw ? cleanReportSchedule_(JSON.parse(raw)) : { enabled: false, weekday: 1, hour: 18, emails: [] };
}

function reportScheduleTriggers_() {
  return ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === MATCH_REPORT_SCHEDULE_HANDLER; });
}

function removeReportScheduleTriggers_() {
  reportScheduleTriggers_().forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
}

function saveReportSchedule_(input, session) {
  requireStaff_(session);
  const next = cleanReportSchedule_(input);
  const storedEmails = getReportRecipients_(session);
  if (next.emails.some(function(email) { return storedEmails.indexOf(email) < 0; })) throw apiError_('Guarda primero todos los destinatarios.', 'VALIDATION');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw apiError_('Hay otra operación en curso.', 'BUSY');
  try {
    const properties = PropertiesService.getScriptProperties();
    const current = getReportSchedule_(session);
    const triggers = reportScheduleTriggers_();
    if (!next.enabled) {
      // Desactivar primero impide un envío aunque un trigger antiguo siga ejecutándose.
      properties.setProperty(MATCH_REPORT_SCHEDULE_KEY, JSON.stringify(next));
      triggers.forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
      return next;
    }
    const sameTime = current.enabled && current.weekday === next.weekday && current.hour === next.hour;
    if (!sameTime || triggers.length !== 1) {
      const days = [ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.TUESDAY, ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY, ScriptApp.WeekDay.SATURDAY, ScriptApp.WeekDay.SUNDAY];
      ScriptApp.newTrigger(MATCH_REPORT_SCHEDULE_HANDLER).timeBased().onWeekDay(days[next.weekday - 1]).atHour(next.hour).nearMinute(0).everyWeeks(1).inTimezone(MATCH_REPORT_TIMEZONE).create();
    }
    properties.setProperty(MATCH_REPORT_SCHEDULE_KEY, JSON.stringify(next));
    if (!sameTime || triggers.length !== 1) triggers.forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
    return next;
  } finally { lock.releaseLock(); }
}

function runScheduledMatchReport_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return;
  try {
    const session = { role: 'staff' };
    const schedule = getReportSchedule_(session);
    if (!schedule.enabled) return;
    const now = new Date();
    const day = Utilities.formatDate(now, MATCH_REPORT_TIMEZONE, 'yyyy-MM-dd');
    const weekday = Number(Utilities.formatDate(now, MATCH_REPORT_TIMEZONE, 'u'));
    if (weekday !== schedule.weekday) return;
    const properties = PropertiesService.getScriptProperties();
    const sentKey = 'MATCH_REPORT_SCHEDULE_SENT_' + day;
    if (properties.getProperty(sentKey)) return;
    if (MailApp.getRemainingDailyQuota() < schedule.emails.length) throw apiError_('No hay cuota de correo suficiente.', 'QUOTA');
    const report = collectScheduledMatchReport_(day);
    const attachment = buildScheduledMatchReportPdf_(report, day);
    const displayDate = day.slice(8, 10) + '/' + day.slice(5, 7) + '/' + day.slice(0, 4);
    MailApp.sendEmail({
      to: schedule.emails.join(','),
      subject: 'Zabal Performance · Acumulado de partidos · ' + displayDate,
      body: 'Adjunto el acumulado de partidos del equipo actualizado al ' + displayDate + '. Incluye ' + report.matchCount + ' partidos registrados y los datos de la plantilla.\n\nRaúl Cote',
      attachments: [attachment],
      name: 'Zabal Performance',
    });
    properties.setProperty(sentKey, new Date().toISOString());
  } finally { lock.releaseLock(); }
}

function collectScheduledMatchReport_(cutoff) {
  // Los equipos con caché fuerzan una lectura nueva de la hoja para cada envío.
  if (typeof invalidateMatchesApiCache_ === 'function') invalidateMatchesApiCache_();
  const matches = getMatches_({ role: 'staff' }).filter(function(match) { return match.date <= cutoff; });
  const players = getPlayers_({ role: 'staff' }).filter(function(player) { return !player.staffMember; });
  const totals = {};
  players.forEach(function(player) { totals[player.id] = emptyScheduledPlayer_(player.id, player.name, player.number); });
  const allPlayers = {};
  rows_(SHEETS.PLAYERS).forEach(function(row) { allPlayers[String(row.id)] = String(row.nombre || ''); });
  const seenMatches = {};
  matches.forEach(function(match) {
    if (!match.id || seenMatches[match.id] || !/^\d{4}-\d{2}-\d{2}$/.test(match.date) || !match.opponent) throw apiError_('Hay un partido incompleto o duplicado.', 'VALIDATION');
    seenMatches[match.id] = true;
    const seenPlayers = {};
    (match.minutes || []).forEach(function(entry) {
      const id = String(entry.playerId || '');
      if (!id || seenPlayers[id] || !allPlayers[id]) throw apiError_('Hay un jugador no válido o repetido en un acta.', 'VALIDATION');
      seenPlayers[id] = true;
      const values = ['minutes', 'goals', 'yellowCards', 'redCards'].map(function(key) { return Number(entry[key] || 0); });
      if (values.some(function(value) { return !Number.isInteger(value) || value < 0; })) throw apiError_('Hay cifras no válidas en un acta.', 'VALIDATION');
      if (!totals[id]) totals[id] = emptyScheduledPlayer_(id, allPlayers[id], entry.number);
      const row = totals[id];
      row.calledUp += entry.calledUp === true || entry.starter === true || values[0] > 0 ? 1 : 0;
      row.starters += entry.starter === true ? 1 : 0;
      row.played += values[0] > 0 ? 1 : 0;
      row.minutes += values[0]; row.goals += values[1]; row.yellowCards += values[2]; row.redCards += values[3];
    });
  });
  const rows = Object.keys(totals).map(function(id) { return totals[id]; }).sort(function(a, b) { return (a.number || 999) - (b.number || 999) || a.name.localeCompare(b.name); });
  return { team: scheduledConfigValue_('nombre_equipo', 'Atlético Zabal Linense'), season: scheduledConfigValue_('temporada', ''), matchCount: matches.length, players: rows };
}

function scheduledConfigValue_(key, fallback) {
  const row = rows_(SHEETS.CONFIG).find(function(item) { return String(item.clave) === key; });
  return row ? String(row.valor || fallback) : fallback;
}

function emptyScheduledPlayer_(id, name, number) {
  return { id: id, name: name, number: number || null, calledUp: 0, starters: 0, played: 0, minutes: 0, goals: 0, yellowCards: 0, redCards: 0 };
}

function scheduledHtmlEscape_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function buildScheduledMatchReportPdf_(report, cutoff) {
  const date = cutoff.slice(8, 10) + '/' + cutoff.slice(5, 7) + '/' + cutoff.slice(0, 4);
  const header = '<tr><th>Jugador</th><th>Conv.</th><th>Tit.</th><th>PJ</th><th>Min.</th><th>Goles</th><th>TA</th><th>TR</th></tr>';
  let rows = report.players.map(function(player) {
    return '<tr><td>' + scheduledHtmlEscape_((player.number ? player.number + ' · ' : '') + player.name) + '</td><td>' + player.calledUp + '</td><td>' + player.starters + '</td><td>' + player.played + '</td><td>' + player.minutes + '</td><td>' + player.goals + '</td><td>' + player.yellowCards + '</td><td>' + player.redCards + '</td></tr>';
  }).join('');
  if (!rows) rows = '<tr><td colspan="8">Sin jugadores registrados</td></tr>';
  const html = '<!doctype html><html><head><meta charset="UTF-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#173961;font-size:10px}h1{font-size:20px;margin:0 0 5px}.brand{font-weight:bold;color:#c99300;letter-spacing:1px}.meta{margin:9px 0 15px}table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{page-break-inside:avoid}th{background:#173961;color:white}td,th{border-bottom:1px solid #d6e1ec;padding:6px 8px;text-align:right}td:first-child,th:first-child{text-align:left}.note{margin-top:12px;font-size:9px;page-break-inside:avoid}</style></head><body><div class="brand">ZABAL PERFORMANCE</div><h1>' + scheduledHtmlEscape_(report.team) + '</h1><div class="meta">Acumulado de partidos · Temporada ' + scheduledHtmlEscape_(report.season) + ' · Corte ' + date + ' · Partidos: ' + report.matchCount + '</div><table><thead>' + header + '</thead><tbody>' + rows + '</tbody></table><p class="note">Conv. = convocatorias · Tit. = titularidades · PJ = partidos jugados · TA = amarillas · TR = rojas.</p><p class="note">Fuente: actas de partidos de Zabal Performance. Incluye partidos registrados hasta la fecha de corte.</p></body></html>';
  return HtmlService.createHtmlOutput(html).getAs(MimeType.PDF).setName('Zabal-acumulado-partidos-' + cutoff + '.pdf');
}
