/**
 * API de Google Apps Script para Zabal Performance.
 * Despliegue como aplicación web ejecutada por el propietario.
 */
const SHEETS = {
  PLAYERS: 'Jugadores',
  MEASUREMENTS: 'Mediciones',
  SESSIONS: 'Sesiones',
  CONFIG: 'Configuración',
  CODES: 'Códigos jugadores',
  MATCHES: 'Partidos',
  MATCH_MINUTES: 'Minutos partidos',
  INJURIES: 'Bajas',
  ATTENDANCE: 'Asistencia',
  DISCIPLINE: 'Sanciones cumplidas',
};
const MAX_STARTERS = 11; // Cambiar a 7 al desplegar una categoría de fútbol 7.
const WEEKLY_REPORT_RECIPIENT = 'direcciondeportivazabal@gmail.com';
const WEEKLY_REPORT_TIMEZONE = 'Europe/Madrid';

const HEADERS = {
  Jugadores: ['id', 'nombre', 'dorsal', 'activo', 'orden', 'fecha_alta', 'pin_hash', 'baja_lesion', 'fecha_nacimiento'],
  Mediciones: ['id', 'fecha', 'hora', 'fecha_hora', 'jugador_id', 'jugador_nombre', 'peso', 'fatiga', 'molestias', 'comentarios', 'sesion_id', 'creado_por', 'actualizado_en'],
  Sesiones: ['id', 'fecha', 'tipo_sesion', 'rival', 'jornada', 'activa', 'hora_apertura', 'hora_cierre'],
  Configuración: ['clave', 'valor'],
  'Códigos jugadores': ['jugador_id', 'jugador_nombre', 'pin'],
  Partidos: ['id', 'fecha', 'tipo', 'rival', 'duracion_minutos', 'creado_en', 'actualizado_en', 'creado_por'],
  'Minutos partidos': ['partido_id', 'jugador_id', 'jugador_nombre', 'minutos', 'amarillas', 'rojas', 'convocado', 'goles', 'titular'],
  Bajas: ['id', 'jugador_id', 'jugador_nombre', 'fecha_inicio', 'fecha_fin', 'motivo', 'creado_en', 'actualizado_en'],
  Asistencia: ['id', 'fecha', 'jugador_id', 'jugador_nombre', 'estado', 'minutos_retraso', 'comentarios', 'creado_en', 'actualizado_en', 'creado_por'],
  'Sanciones cumplidas': ['jugador_id', 'jugador_nombre', 'amarillas_cumplidas', 'rojas_cumplidas', 'cumplida_en', 'actualizado_por'],
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Zabal Performance')
    .addItem('Preparar estructura', 'setupProject')
    .addItem('Configurar PIN del cuerpo técnico', 'configurePinFromUi')
    .addItem('Generar PINs de jugadores', 'generatePlayerPinsFromUi')
    .addItem('Aplicar PINs editados', 'applyPlayerPinsFromUi')
    .addSeparator()
    .addItem('Activar correo semanal Senior', 'installWeeklySeniorEmailTriggerFromUi')
    .addItem('Enviar análisis semanal ahora', 'sendWeeklySeniorAnalysisNowFromUi')
    .addToUi();
}

function configurePinFromUi() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('PIN del cuerpo técnico', 'Introduce un PIN de 4 a 12 dígitos. Se guardará únicamente su hash.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  setStaffPin(response.getResponseText());
  ui.alert('PIN configurado correctamente.');
}

function generatePlayerPinsFromUi() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Generar PINs personales', 'Se crearán PINs nuevos para todos los jugadores activos. Los anteriores dejarán de funcionar. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;
  const count = generatePlayerPins_();
  ui.alert('Se han generado ' + count + ' PINs. Puedes verlos en la pestaña "Códigos jugadores".');
}

function applyPlayerPinsFromUi() {
  const ui = SpreadsheetApp.getUi();
  try {
    const count = applyPlayerPins_();
    ui.alert('PINs actualizados', 'Se han aplicado ' + count + ' PINs personales. Los jugadores deberán usar desde ahora los códigos escritos en la pestaña "Códigos jugadores".', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('No se pudieron aplicar los PINs', error.message || String(error), ui.ButtonSet.OK);
  }
}

// Utilidad de administración para la primera puesta en marcha desde el editor.
function initializePlayerPins() {
  return generatePlayerPins_();
}

function doGet() {
  return json_({ ok: true, data: { service: 'Zabal Performance API', version: 6 } });
}

function doPost(event) {
  try {
    const input = JSON.parse(event.postData.contents || '{}');
    const action = String(input.action || '');
    if (action === 'authenticate') return json_({ ok: true, data: authenticate_(input.pin, input.role, input.includeBootstrap) });
    if (action === 'logout') return json_({ ok: true, data: logout_(input.token) });
    const session = requireSession_(input.token);
    if (action === 'getTeamSettings') return json_({ ok: true, data: getTeamSettings_() });
    if (action === 'saveTeamSettings') return json_({ ok: true, data: saveTeamSettings_(input.settings, session) });
    if (action === 'emailAttendance') return json_({ ok: true, data: emailAttendance_(input, session) });
    if (action === 'getReportRecipients') return json_({ ok: true, data: getReportRecipients_(session) });
    if (action === 'saveReportRecipients') return json_({ ok: true, data: saveReportRecipients_(input.emails, session) });
    if (action === 'emailMatchPdf') return json_({ ok: true, data: emailMatchPdf_(input, session) });
    if (action === 'getReportSchedule') return json_({ ok: true, data: getReportSchedule_(session) });
    if (action === 'saveReportSchedule') return json_({ ok: true, data: saveReportSchedule_(input.schedule, session) });
    if (action === 'getBootstrap') return json_({ ok: true, data: getBootstrap_(session) });
    if (action === 'getPlayers') return json_({ ok: true, data: getPlayers_(session) });
    if (action === 'getMeasurements') return json_({ ok: true, data: getMeasurements_(session) });
    if (action === 'getCurrentSession') return json_({ ok: true, data: getCurrentSession_() });
    if (action === 'saveMeasurement') return json_({ ok: true, data: saveMeasurement_(input.measurement, session) });
    if (action === 'getMatches') return json_({ ok: true, data: enrichMatchesWithDetails_(getMatches_(session)) });
    if (action === 'saveMatch') return json_({ ok: true, data: saveMatchWithDetails_(input.match, session) });
    if (action === 'updateMatch') return json_({ ok: true, data: updateMatchWithDetails_(input.matchId, input.match, undefined, session) });
    if (action === 'deleteMatch') return json_({ ok: true, data: deleteMatch_(input.matchId, session) });
    if (action === 'getDisciplineStatuses') return json_({ ok: true, data: getDisciplineStatuses_(session) });
    if (action === 'markSanctionServed') return json_({ ok: true, data: markSanctionServed_(input.playerId, session) });
    if (action === 'getAttendance') return json_({ ok: true, data: getAttendance_(session) });
    if (action === 'saveAttendance') return json_({ ok: true, data: saveAttendance_(input.attendance, session) });
    if (action === 'setPlayerInjury') return json_({ ok: true, data: setPlayerInjury_(input.playerId, input.injury || { injured: input.injured }, session) });
    if (action === 'saveBirthDate') return json_({ ok: true, data: saveBirthDate_(input.birthDate, session) });
    throw apiError_('Acción no permitida.', 'INVALID_ACTION');
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({ ok: false, error: error.message || 'Error interno.', code: error.code || 'SERVER_ERROR' });
  }
}

function setupProject() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Abre este script desde la hoja de cálculo antes de ejecutar la configuración.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  Object.keys(HEADERS).forEach(function(name) { ensureSheet_(spreadsheet, name, HEADERS[name]); });
  ensureConfig_('nombre_equipo', 'Atlético Zabal Linense · Senior');
  ensureConfig_('temporada', '2026-27');
  setConfig_('duracion_sesion_minutos', '120');
  ensureConfig_('fatiga_moderada_desde', '4');
  ensureConfig_('fatiga_alerta_desde', '7');
  ensureConfig_('molestias_moderada_desde', '4');
  ensureConfig_('molestias_alerta_desde', '7');
  ensureConfig_('duracion_partido_minutos', '90');
  ensureConfig_('correo_informe_semanal', WEEKLY_REPORT_RECIPIENT);
  ensureConfig_('hora_informe_semanal', '10:00');
  ensureAuthSecret_();
  return 'Estructura actualizada. Configura el PIN técnico y genera los PINs de jugadores desde el menú Zabal Performance.';
}

function installWeeklySeniorEmailTriggerFromUi() {
  const ui = SpreadsheetApp.getUi();
  try {
    installWeeklySeniorEmailTrigger();
    ui.alert('Correo semanal activado', 'El análisis del Senior se enviará cada viernes alrededor de las 10:00 a ' + weeklyReportRecipient_() + '.', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('No se pudo activar', error.message || String(error), ui.ButtonSet.OK);
  }
}

function installWeeklySeniorEmailTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'sendWeeklySeniorAnalysis') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('sendWeeklySeniorAnalysis')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(10)
    .nearMinute(0)
    .inTimezone(WEEKLY_REPORT_TIMEZONE)
    .create();
  return 'Trigger semanal creado para los viernes a las 10:00.';
}

function sendWeeklySeniorAnalysisNowFromUi() {
  const ui = SpreadsheetApp.getUi();
  try {
    const result = sendWeeklySeniorAnalysis_(true);
    ui.alert('Análisis enviado', result, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('No se pudo enviar', error.message || String(error), ui.ButtonSet.OK);
  }
}

function sendWeeklySeniorAnalysis() {
  return sendWeeklySeniorAnalysis_(false);
}

function sendWeeklySeniorAnalysis_(force) {
  const now = new Date();
  const end = dateKey_(now);
  const weekday = Number(Utilities.formatDate(now, WEEKLY_REPORT_TIMEZONE, 'u')) || 1;
  const start = dateKey_(new Date(now.getTime() - (weekday - 1) * 86400000));
  const sentKey = 'WEEKLY_SENIOR_EMAIL_' + start + '_' + end;
  const properties = PropertiesService.getScriptProperties();
  if (!force && properties.getProperty(sentKey)) return 'El informe de esta semana ya se había enviado.';

  const players = getPlayers_({ role: 'staff' }).filter(function(player) { return !player.staffMember; });
  const measurements = getMeasurements_({ role: 'staff' }).filter(function(item) { return item.date >= start && item.date <= end; });
  const attendance = getAttendance_({ role: 'staff' }).filter(function(item) { return item.date >= start && item.date <= end; });
  const seasonMatches = getMatches_({ role: 'staff' });
  const matches = seasonMatches.filter(function(item) { return item.date >= start && item.date <= end; });
  const injuries = getInjuryPeriods_().filter(function(item) { return item.startDate <= end && (!item.endDate || item.endDate >= start); });
  const config = weeklyReportConfig_();
  const rows = players.map(function(player) {
    return weeklyPlayerAnalysis_(player, measurements, attendance, matches, injuries, config);
  });
  const summary = weeklyTeamSummary_(players, measurements, attendance, matches, injuries, rows);
  const seasonStatistics = seasonStatistics_(players, seasonMatches);
  const subject = 'Zabal Performance Senior · Análisis semanal · ' + formatEmailDate_(end);
  const htmlBody = weeklyEmailHtml_(start, end, rows, summary, seasonStatistics);
  const plainBody = weeklyEmailPlainText_(start, end, rows, summary, seasonStatistics);
  MailApp.sendEmail({
    to: weeklyReportRecipient_(),
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
    name: 'Zabal Performance',
  });
  properties.setProperty(sentKey, new Date().toISOString());
  return 'Correo enviado a ' + weeklyReportRecipient_() + ' con ' + measurements.length + ' controles de ' + players.length + ' jugadores.';
}

function weeklyReportRecipient_() {
  return String(configValue_('correo_informe_semanal', WEEKLY_REPORT_RECIPIENT)).trim() || WEEKLY_REPORT_RECIPIENT;
}

function weeklyReportConfig_() {
  return {
    fatigueAlert: Number(configValue_('fatiga_alerta_desde', 7)),
    sorenessAlert: Number(configValue_('molestias_alerta_desde', 7)),
    weightChange: Number(configValue_('cambio_peso_relevante_kg', 1.5)),
  };
}

function configValue_(key, fallback) {
  const row = rows_(SHEETS.CONFIG).find(function(item) { return String(item.clave) === String(key); });
  return row && row.valor !== '' ? row.valor : fallback;
}

function weeklyPlayerAnalysis_(player, measurements, attendance, matches, injuries, config) {
  const controls = measurements.filter(function(item) { return item.playerId === player.id; }).sort(function(a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
  const weights = controls.filter(function(item) { return item.weight !== undefined; }).map(function(item) { return item.weight; });
  const fatigue = controls.filter(function(item) { return item.fatigue !== undefined; }).map(function(item) { return item.fatigue; });
  const soreness = controls.filter(function(item) { return item.soreness !== undefined; }).map(function(item) { return item.soreness; });
  const attendanceRows = attendance.filter(function(item) { return item.playerId === player.id; });
  const matchRows = [];
  matches.forEach(function(match) {
    const entry = match.minutes.find(function(item) { return item.playerId === player.id; });
    if (entry) matchRows.push(entry);
  });
  const injuryRows = injuries.filter(function(item) { return item.playerId === player.id; });
  const weightChange = weights.length > 1 ? Number((weights[weights.length - 1] - weights[0]).toFixed(2)) : undefined;
  const maxFatigue = fatigue.length ? Math.max.apply(null, fatigue) : undefined;
  const maxSoreness = soreness.length ? Math.max.apply(null, soreness) : undefined;
  const alerts = [];
  if (weightChange !== undefined && Math.abs(weightChange) >= config.weightChange) alerts.push('Cambio de peso ' + signedNumber_(weightChange) + ' kg');
  if (maxFatigue !== undefined && maxFatigue >= config.fatigueAlert) alerts.push('Fatiga máxima ' + maxFatigue + '/10');
  if (maxSoreness !== undefined && maxSoreness >= config.sorenessAlert) alerts.push('Molestias máximas ' + maxSoreness + '/10');
  if (injuryRows.length) alerts.push('Baja activa durante la semana');
  return {
    name: player.name,
    controls: controls.length,
    latestWeight: weights.length ? weights[weights.length - 1] : undefined,
    weightChange: weightChange,
    averageFatigue: average_(fatigue),
    maxFatigue: maxFatigue,
    averageSoreness: average_(soreness),
    maxSoreness: maxSoreness,
    absences: attendanceRows.filter(function(item) { return ['justified', 'unjustified', 'medical'].indexOf(item.status) >= 0; }).length,
    lateMinutes: attendanceRows.reduce(function(total, item) { return total + (item.status === 'late' ? Number(item.lateMinutes || 0) : 0); }, 0),
    minutes: matchRows.reduce(function(total, item) { return total + Number(item.minutes || 0); }, 0),
    goals: matchRows.reduce(function(total, item) { return total + Number(item.goals || 0); }, 0),
    alerts: alerts,
  };
}

function weeklyTeamSummary_(players, measurements, attendance, matches, injuries, rows) {
  const registered = {};
  measurements.forEach(function(item) { registered[item.playerId] = true; });
  const fatigue = measurements.filter(function(item) { return item.fatigue !== undefined; }).map(function(item) { return item.fatigue; });
  const soreness = measurements.filter(function(item) { return item.soreness !== undefined; }).map(function(item) { return item.soreness; });
  return {
    roster: players.length,
    registered: Object.keys(registered).length,
    controls: measurements.length,
    averageFatigue: average_(fatigue),
    averageSoreness: average_(soreness),
    absences: attendance.filter(function(item) { return ['justified', 'unjustified', 'medical'].indexOf(item.status) >= 0; }).length,
    injuries: injuries.length,
    matches: matches.length,
    goals: rows.reduce(function(total, item) { return total + item.goals; }, 0),
    alertPlayers: rows.filter(function(item) { return item.alerts.length; }).length,
  };
}

function seasonStatistics_(players, matches) {
  const totals = {};
  players.forEach(function(player) {
    totals[player.id] = { name: player.name, callUps: 0, starts: 0, minutes: 0, goals: 0 };
  });
  matches.forEach(function(match) {
    (match.minutes || []).forEach(function(entry) {
      const total = totals[entry.playerId];
      if (!total) return;
      if (entry.calledUp) total.callUps += 1;
      if (entry.starter) total.starts += 1;
      total.minutes += Number(entry.minutes || 0);
      total.goals += Number(entry.goals || 0);
    });
  });
  const rows = Object.keys(totals).map(function(playerId) { return totals[playerId]; });
  function top_(key, limit, positiveOnly) {
    return rows.filter(function(item) { return !positiveOnly || item[key] > 0; }).sort(function(a, b) {
      return b[key] - a[key] || b.minutes - a.minutes || a.name.localeCompare(b.name);
    }).slice(0, limit).map(function(item) { return { name: item.name, value: item[key] }; });
  }
  return {
    scorers: top_('goals', 5, true),
    callUps: top_('callUps', 5, false),
    minutes: top_('minutes', 5, true),
    starters: top_('starts', 5, true),
  };
}

function seasonStatisticsHtml_(statistics) {
  const blocks = [
    ['Top goleadores', statistics.scorers, ' goles'],
    ['Top convocados', statistics.callUps, ' conv.'],
    ['Top minutos', statistics.minutes, ' min'],
    ['Top titularidades', statistics.starters, ' tit.'],
  ];
  return '<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px"><tbody>' +
    [0, 2].map(function(start) {
      return '<tr>' + blocks.slice(start, start + 2).map(function(block) {
        const items = block[1].length ? block[1].map(function(item, index) {
          return '<div style="padding:7px 0;border-top:1px solid #dfe7ee"><b style="display:inline-block;width:22px;color:#789">' + (index + 1) + '.</b><span style="color:#16365f;font-weight:700">' + escapeHtml_(item.name) + '</span><strong style="float:right;color:#16365f">' + item.value + block[2] + '</strong></div>';
        }).join('') : '<div style="padding:10px 0;color:#789">Sin datos</div>';
        return '<td style="width:50%;vertical-align:top;padding:14px;border:1px solid #d9e3ec;border-radius:12px;background:#f8fafc"><h3 style="margin:0 0 8px;color:#16365f">' + block[0] + '</h3>' + items + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
}

function seasonStatisticsPlainText_(statistics) {
  function list_(title, items, suffix) {
    return title + '\n' + (items.length ? items.map(function(item, index) { return (index + 1) + '. ' + item.name + ': ' + item.value + suffix; }).join('\n') : 'Sin datos');
  }
  return 'ESTADÍSTICAS ACUMULADAS DE TEMPORADA\n' +
    list_('Top goleadores', statistics.scorers, ' goles') + '\n\n' +
    list_('Top convocados', statistics.callUps, ' convocatorias') + '\n\n' +
    list_('Top minutos', statistics.minutes, ' minutos') + '\n\n' +
    list_('Top titularidades', statistics.starters, ' titularidades');
}

function weeklyEmailHtml_(start, end, rows, summary, seasonStatistics) {
  const alertRows = rows.filter(function(item) { return item.alerts.length; });
  const tableRows = rows.map(function(item) {
    const alertStyle = item.alerts.length ? 'background:#fff2f3;color:#a42e3a;font-weight:700' : 'color:#617286';
    return '<tr>' +
      '<td style="padding:10px;border-bottom:1px solid #d9e3ec;font-weight:700;color:#16365f">' + escapeHtml_(item.name) + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #d9e3ec;text-align:center">' + item.controls + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #d9e3ec;text-align:center">' + valueOrDash_(item.latestWeight, ' kg') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #d9e3ec;text-align:center">' + valueOrDash_(item.averageFatigue, '') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #d9e3ec;text-align:center">' + valueOrDash_(item.averageSoreness, '') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #d9e3ec;text-align:center">' + item.absences + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #d9e3ec;text-align:center">' + item.minutes + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #d9e3ec;' + alertStyle + '">' + (item.alerts.length ? escapeHtml_(item.alerts.join(' · ')) : 'Sin alertas') + '</td>' +
    '</tr>';
  }).join('');
  const conclusions = [
    'Participación: ' + summary.registered + ' de ' + summary.roster + ' jugadores registraron datos esta semana (' + summary.controls + ' controles).',
    'Estado del equipo: fatiga media ' + valueOrDash_(summary.averageFatigue, '/10') + ' y molestias medias ' + valueOrDash_(summary.averageSoreness, '/10') + '.',
    'Disponibilidad: ' + summary.absences + ' ausencias registradas y ' + summary.injuries + ' periodos de baja coincidentes con la semana.',
    'Competición: ' + summary.matches + ' partidos y ' + summary.goals + ' goles registrados.',
    summary.alertPlayers ? 'Prioridad: revisar a ' + summary.alertPlayers + ' jugadores con alguna señal de alerta.' : 'No se detectan alertas prioritarias con los datos disponibles.',
  ];
  return '<div style="margin:0;padding:24px;background:#f3f6f9;font-family:Arial,sans-serif;color:#173555">' +
    '<div style="max-width:980px;margin:auto;overflow:hidden;border-radius:18px;background:#fff;border:1px solid #d9e3ec">' +
      '<div style="padding:28px 32px;background:#16365f;color:#fff;border-top:7px solid #f6ca3b">' +
        '<div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#f6ca3b">ZABAL PERFORMANCE · SENIOR</div>' +
        '<h1 style="margin:10px 0 6px;font-size:30px">Análisis semanal del equipo</h1>' +
        '<div style="color:#d6e1ed">Del ' + formatEmailDate_(start) + ' al ' + formatEmailDate_(end) + '</div>' +
      '</div>' +
      '<div style="padding:26px 32px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px">' + metricHtml_('Jugadores con registro', summary.registered + '/' + summary.roster) + metricHtml_('Controles', summary.controls) + metricHtml_('Fatiga media', valueOrDash_(summary.averageFatigue, '/10')) + metricHtml_('Molestias medias', valueOrDash_(summary.averageSoreness, '/10')) + metricHtml_('Alertas', summary.alertPlayers) + '</div>' +
        '<h2 style="font-size:20px;color:#16365f">Conclusiones</h2><ul style="padding-left:20px;line-height:1.65;color:#52667b">' + conclusions.map(function(text) { return '<li>' + escapeHtml_(text) + '</li>'; }).join('') + '</ul>' +
        (alertRows.length ? '<div style="margin:22px 0;padding:18px;border-left:6px solid #c8424f;background:#fff2f3"><strong style="color:#a42e3a">Revisión prioritaria</strong><div style="margin-top:8px;color:#6f3a40">' + alertRows.map(function(item) { return '<div><b>' + escapeHtml_(item.name) + ':</b> ' + escapeHtml_(item.alerts.join(' · ')) + '</div>'; }).join('') + '</div></div>' : '') +
        '<h2 style="margin-top:28px;font-size:20px;color:#16365f">Estadísticas acumuladas de temporada</h2>' + seasonStatisticsHtml_(seasonStatistics) +
        '<h2 style="margin-top:28px;font-size:20px;color:#16365f">Detalle de la semana</h2>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#eaf1f7;color:#16365f"><th style="padding:10px;text-align:left">Jugador</th><th>Cont.</th><th>Peso</th><th>Fatiga</th><th>Molest.</th><th>Aus.</th><th>Min.</th><th style="text-align:left;padding:10px">Situación</th></tr></thead><tbody>' + tableRows + '</tbody></table></div>' +
      '</div>' +
      '<div style="padding:18px 32px;background:#0c2849;color:#c8d5e3;text-align:center">Sistema creado y diseñado por <strong style="color:#f6ca3b">Raul Cote</strong></div>' +
    '</div>' +
  '</div>';
}

function weeklyEmailPlainText_(start, end, rows, summary, seasonStatistics) {
  const alerts = rows.filter(function(item) { return item.alerts.length; }).map(function(item) { return item.name + ': ' + item.alerts.join(', '); });
  return 'ZABAL PERFORMANCE · SENIOR\nAnálisis semanal del ' + formatEmailDate_(start) + ' al ' + formatEmailDate_(end) + '\n\n' +
    'Jugadores con registro: ' + summary.registered + '/' + summary.roster + '\n' +
    'Controles: ' + summary.controls + '\nFatiga media: ' + valueOrDash_(summary.averageFatigue, '/10') + '\nMolestias medias: ' + valueOrDash_(summary.averageSoreness, '/10') + '\n' +
    'Ausencias: ' + summary.absences + '\nBajas: ' + summary.injuries + '\nPartidos: ' + summary.matches + '\n\n' +
    seasonStatisticsPlainText_(seasonStatistics) + '\n\n' +
    (alerts.length ? 'REVISIÓN PRIORITARIA\n' + alerts.join('\n') : 'Sin alertas prioritarias con los datos disponibles.') + '\n\nSistema creado y diseñado por Raul Cote';
}

function metricHtml_(label, value) {
  return '<div style="min-width:130px;padding:14px 16px;border-radius:12px;background:#f3f6f9;border:1px solid #d9e3ec"><div style="font-size:11px;color:#6a7b8d">' + escapeHtml_(String(label)) + '</div><div style="margin-top:4px;font-size:22px;font-weight:800;color:#16365f">' + escapeHtml_(String(value)) + '</div></div>';
}

function average_(values) {
  return values.length ? Number((values.reduce(function(total, value) { return total + Number(value); }, 0) / values.length).toFixed(1)) : undefined;
}

function signedNumber_(value) { return (value > 0 ? '+' : '') + Number(value.toFixed(2)); }
function valueOrDash_(value, suffix) { return value === undefined || value === null || value === '' ? '—' : String(value) + String(suffix || ''); }
function formatEmailDate_(value) { return Utilities.formatDate(new Date(String(value) + 'T12:00:00'), WEEKLY_REPORT_TIMEZONE, 'dd/MM/yyyy'); }
function escapeHtml_(value) { return String(value === undefined || value === null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function ensureStaffMember_(name) {
  const sheet = sheet_(SHEETS.PLAYERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const nameColumn = headers.indexOf('nombre');
  if (values.slice(1).some(function(row) { return String(row[nameColumn]).trim().toLowerCase() === String(name).trim().toLowerCase(); })) return;
  const idColumn = headers.indexOf('id');
  const orderColumn = headers.indexOf('orden');
  const maxOrder = values.slice(1).reduce(function(maximum, row) { return Math.max(maximum, Number(row[orderColumn] || 0)); }, 0);
  const row = headers.map(function(header) {
    if (header === 'id') return 'staff-luis-lara';
    if (header === 'nombre') return name;
    if (header === 'activo') return true;
    if (header === 'orden') return maxOrder + 1;
    if (header === 'fecha_alta') return new Date();
    return '';
  });
  sheet.appendRow(row);
}

function setStaffPin(pin) {
  const clean = String(pin || '').trim();
  if (!/^\d{4,12}$/.test(clean)) throw new Error('El PIN debe contener entre 4 y 12 dígitos.');
  PropertiesService.getScriptProperties().setProperty('STAFF_PIN_SHA256', sha256_(clean));
  return 'PIN guardado como hash SHA-256.';
}

function authenticate_(pin, requestedRole, includeBootstrap) {
  const role = String(requestedRole || '') === 'player' ? 'player' : 'staff';
  const cleanPin = String(pin || '').trim();
  let player;
  if (role === 'staff') {
    const configured = PropertiesService.getScriptProperties().getProperty('STAFF_PIN_SHA256');
    if (!configured) throw apiError_('El PIN del cuerpo técnico todavía no está configurado.', 'CONFIG');
    if (sha256_(cleanPin) !== configured) throw apiError_('El PIN del cuerpo técnico no es correcto.', 'INVALID_PIN');
  } else {
    const pinHash = sha256_(cleanPin);
    const row = rows_(SHEETS.PLAYERS).find(function(item) { return boolean_(item.activo) && String(item.pin_hash || '') === pinHash; });
    if (!row) throw apiError_('El PIN de jugador no es correcto.', 'INVALID_PIN');
    player = { id: String(row.id), name: String(row.nombre) };
  }
  const duration = 2 * 60 * 60 * 1000;
  const payload = { role: role, playerId: player && player.id, playerName: player && player.name, exp: Date.now() + duration };
  const auth = { token: signSession_(payload), expiresAt: payload.exp, role: role, playerId: payload.playerId, playerName: payload.playerName };
  if (includeBootstrap) return { auth: auth, bootstrap: getLoginBootstrap_(payload) };
  return auth;
}

function getLoginBootstrap_(session) {
  const birthdayState = getBirthdayState_(session);
  return {
    players: getPlayers_(session),
    measurements: session.role === 'player' ? getMeasurements_(session) : [],
    session: getCurrentSession_(),
    needsBirthDate: birthdayState.needsBirthDate,
    birthdaysToday: birthdayState.birthdaysToday,
  };
}

function logout_() { return true; }

function requireSession_(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2 || signature_(parts[0]) !== parts[1]) throw new Error('Firma no válida');
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!payload.exp || payload.exp <= Date.now() || ['player', 'staff'].indexOf(payload.role) < 0) throw new Error('Sesión caducada');
    return payload;
  } catch (error) {
    throw apiError_('La sesión ha caducado. Vuelve a introducir el PIN.', 'UNAUTHORIZED');
  }
}

function requireStaff_(session) {
  if (!session || session.role !== 'staff') throw apiError_('Solo el cuerpo técnico puede acceder a este apartado.', 'FORBIDDEN');
}

function getPlayers_(session) {
  const today = dateKey_(new Date());
  const injuriesByPlayer = {};
  getInjuryPeriods_().forEach(function(period) {
    if (!injuriesByPlayer[period.playerId]) injuriesByPlayer[period.playerId] = [];
    injuriesByPlayer[period.playerId].push({ id: period.id, startDate: period.startDate, endDate: period.endDate, reason: period.reason });
  });
  return rows_(SHEETS.PLAYERS).filter(function(row) { return boolean_(row.activo) && (!session || session.role === 'staff' || String(row.id) === String(session.playerId)); }).map(function(row) {
    const name = String(row.nombre);
    const staffMember = false;
    const injuries = injuriesByPlayer[String(row.id)] || [];
    const injured = injuries.length
      ? injuries.some(function(period) { return period.startDate <= today && (!period.endDate || period.endDate >= today); })
      : boolean_(row.baja_lesion);
    return { id: String(row.id), name: name, number: staffMember ? undefined : numberOrNull_(row.dorsal), active: true, order: Number(row.orden || 0), joinedAt: dateKey_(row.fecha_alta), injured: injured, injuries: injuries, staffMember: staffMember };
  }).sort(function(a, b) { return a.order - b.order; });
}

function getInjuryPeriods_() {
  ensureInjuriesSheet_();
  return rows_(SHEETS.INJURIES).map(function(row) {
    return { id: String(row.id), playerId: String(row.jugador_id), playerName: String(row.jugador_nombre), startDate: dateKey_(row.fecha_inicio), endDate: row.fecha_fin ? dateKey_(row.fecha_fin) : undefined, reason: String(row.motivo || '') };
  }).sort(function(a, b) { return a.startDate.localeCompare(b.startDate); });
}

function ensureInjuriesSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw apiError_('La hoja de cálculo no está configurada.', 'CONFIG');
  const spreadsheet = SpreadsheetApp.openById(id);
  ensureSheet_(spreadsheet, SHEETS.INJURIES, HEADERS.Bajas);
  return spreadsheet.getSheetByName(SHEETS.INJURIES);
}

function setPlayerInjury_(playerId, injury, session) {
  requireStaff_(session);
  const playersSheet = sheet_(SHEETS.PLAYERS);
  const values = playersSheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idColumn = headers.indexOf('id');
  let injuryColumn = headers.indexOf('baja_lesion');
  if (injuryColumn < 0) {
    injuryColumn = headers.length;
    playersSheet.getRange(1, injuryColumn + 1).setValue('baja_lesion');
  }
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][idColumn]) !== String(playerId)) continue;
    const playerName = String(values[index][headers.indexOf('nombre')]);
    const periods = getInjuryPeriods_().filter(function(period) { return period.playerId === String(playerId); });
    const today = dateKey_(new Date());
    const active = periods.find(function(period) { return period.startDate <= today && (!period.endDate || period.endDate >= today); });
    const legacy = Object.prototype.hasOwnProperty.call(injury || {}, 'injured');
    const startDate = legacy ? (active ? active.startDate : dateKey_(new Date())) : String(injury.startDate || '');
    const endDate = legacy ? (injury.injured ? '' : dateKey_(new Date())) : String(injury.endDate || '');
    const reason = String(injury.reason || (active && active.reason) || 'Motivo pendiente de completar').replace(/[<>]/g, '').trim().slice(0, 160);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw apiError_('Indica una fecha de inicio válida.', 'VALIDATION');
    if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate)) throw apiError_('La fecha final no puede ser anterior al inicio.', 'VALIDATION');
    if (!reason) throw apiError_('Indica el motivo de la baja.', 'VALIDATION');
    const injuriesSheet = ensureInjuriesSheet_();
    const injuryValues = injuriesSheet.getDataRange().getValues();
    const injuryHeaders = injuryValues[0].map(String);
    const activeIndex = injuryValues.slice(1).findIndex(function(row) {
      const rowEndDate = row[injuryHeaders.indexOf('fecha_fin')] ? dateKey_(row[injuryHeaders.indexOf('fecha_fin')]) : '';
      return String(row[injuryHeaders.indexOf('jugador_id')]) === String(playerId) && (!rowEndDate || rowEndDate >= today);
    });
    const now = new Date();
    if (activeIndex >= 0) {
      const rowNumber = activeIndex + 2;
      injuriesSheet.getRange(rowNumber, injuryHeaders.indexOf('fecha_inicio') + 1).setValue(startDate);
      injuriesSheet.getRange(rowNumber, injuryHeaders.indexOf('fecha_fin') + 1).setValue(endDate || '');
      injuriesSheet.getRange(rowNumber, injuryHeaders.indexOf('motivo') + 1).setValue(reason);
      injuriesSheet.getRange(rowNumber, injuryHeaders.indexOf('actualizado_en') + 1).setValue(now);
    } else {
      const newPeriod = { id: Utilities.getUuid(), jugador_id: String(playerId), jugador_nombre: playerName, fecha_inicio: startDate, fecha_fin: endDate || '', motivo: reason, creado_en: now, actualizado_en: now };
      injuriesSheet.appendRow(injuryHeaders.map(function(header) { return newPeriod[header] === undefined ? '' : newPeriod[header]; }));
    }
    playersSheet.getRange(index + 1, injuryColumn + 1).setValue(!endDate || endDate >= today);
    return getPlayers_({ role: 'staff' }).find(function(player) { return player.id === String(playerId); });
  }
  throw apiError_('Jugador no válido.', 'INVALID_PLAYER');
}

function getMeasurements_(session) {
  return rows_(SHEETS.MEASUREMENTS).filter(function(row) { return !session || session.role === 'staff' || String(row.jugador_id) === String(session.playerId); }).map(function(row) {
    const date = dateKey_(row.fecha);
    const createdAt = iso_(row.fecha_hora);
    return {
      id: String(row.id), date: date, time: String(row.hora), createdAt: createdAt,
      playerId: String(row.jugador_id), playerName: String(row.jugador_nombre),
      weight: numberOrNull_(row.peso), fatigue: numberOrNull_(row.fatiga), soreness: numberOrNull_(row.molestias),
      comments: String(row.comentarios || ''), sessionId: String(row.sesion_id),
      createdBy: String(row.creado_por || ''), updatedAt: iso_(row.actualizado_en),
    };
  });
}

function ensureAttendanceSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw apiError_('La hoja de cálculo no está configurada.', 'CONFIG');
  const spreadsheet = SpreadsheetApp.openById(id);
  const existing = spreadsheet.getSheetByName(SHEETS.ATTENDANCE);
  if (existing) return existing;
  ensureSheet_(spreadsheet, SHEETS.ATTENDANCE, HEADERS.Asistencia);
  return spreadsheet.getSheetByName(SHEETS.ATTENDANCE);
}

function getAttendance_(session) {
  requireStaff_(session);
  ensureAttendanceSheet_();
  const attendance = rows_(SHEETS.ATTENDANCE).map(function(row) {
    return {
      id: String(row.id), date: dateKey_(row.fecha), playerId: String(row.jugador_id), playerName: String(row.jugador_nombre),
      status: String(row.estado || 'pending'), lateMinutes: Number(row.minutos_retraso || 0), comments: String(row.comentarios || ''),
      createdAt: iso_(row.creado_en), updatedAt: iso_(row.actualizado_en), createdBy: String(row.creado_por || 'cuerpo-tecnico'),
    };
  });
  const byPlayerAndDate = {};
  attendance.forEach(function(record) { byPlayerAndDate[record.date + '|' + record.playerId] = record; });
  getMeasurements_({ role: 'staff' }).forEach(function(measurement) {
    const key = measurement.date + '|' + measurement.playerId;
    const previous = byPlayerAndDate[key];
    byPlayerAndDate[key] = {
      id: previous ? previous.id : 'measurement-' + measurement.id,
      date: measurement.date,
      playerId: measurement.playerId,
      playerName: measurement.playerName,
      status: 'present',
      lateMinutes: 0,
      comments: previous ? previous.comments : 'Presencia registrada automáticamente mediante medición',
      createdAt: previous ? previous.createdAt : measurement.createdAt,
      updatedAt: measurement.updatedAt,
      createdBy: measurement.createdBy,
    };
  });
  return Object.keys(byPlayerAndDate).map(function(key) { return byPlayerAndDate[key]; }).sort(function(a, b) { return (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt); });
}

function saveAttendance_(input, session) {
  requireStaff_(session);
  if (!input) throw apiError_('Faltan los datos de asistencia.', 'VALIDATION');
  const date = String(input.date || '');
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const today = dateKey_(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) throw apiError_('La fecha de asistencia no es válida.', 'VALIDATION');
  if (!entries.length) throw apiError_('No hay jugadores para guardar.', 'VALIDATION');
  const allowedStatuses = { pending: true, present: true, late: true, justified: true, unjustified: true, individual: true, medical: true };
  const players = getPlayers_({ role: 'staff' }).filter(function(player) { return !player.staffMember; });
  const playersById = {};
  players.forEach(function(player) { playersById[player.id] = player; });
  const seen = {};
  const cleanEntries = entries.map(function(entry) {
    const playerId = String(entry.playerId || '');
    const player = playersById[playerId];
    const status = String(entry.status || 'pending');
    const lateMinutes = status === 'late' ? Number(entry.lateMinutes) : 0;
    if (!player || player.name !== String(entry.playerName || '') || seen[playerId]) throw apiError_('Hay un jugador no válido o repetido.', 'INVALID_PLAYER');
    if (!allowedStatuses[status]) throw apiError_('Revisa la asistencia de ' + player.name + '.', 'VALIDATION');
    if (status === 'late' && (!Number.isInteger(lateMinutes) || lateMinutes < 1 || lateMinutes > 180)) throw apiError_('Revisa los minutos de retraso de ' + player.name + '.', 'VALIDATION');
    seen[playerId] = true;
    return { playerId: player.id, playerName: player.name, status: status, lateMinutes: lateMinutes, comments: String(entry.comments || '').replace(/[<>]/g, '').trim().slice(0, 250) };
  });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('Hay muchos guardados a la vez. Inténtalo de nuevo en unos segundos.', 'BUSY');
  try {
    const attendanceSheet = ensureAttendanceSheet_();
    const values = attendanceSheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const previousByPlayer = {};
    const dateColumn = headers.indexOf('fecha');
    const playerColumn = headers.indexOf('jugador_id');
    values.slice(1).forEach(function(row) {
      if (row[dateColumn] && dateKey_(row[dateColumn]) === date) previousByPlayer[String(row[playerColumn])] = { id: String(row[headers.indexOf('id')]), createdAt: row[headers.indexOf('creado_en')] };
    });
    const rowNumbers = [];
    for (let index = 1; index < values.length; index += 1) if (values[index][dateColumn] && dateKey_(values[index][dateColumn]) === date) rowNumbers.push(index + 1);
    for (let index = rowNumbers.length - 1; index >= 0; index -= 1) attendanceSheet.deleteRow(rowNumbers[index]);
    const now = new Date();
    const rows = cleanEntries.map(function(entry) {
      const previous = previousByPlayer[entry.playerId];
      return [previous ? previous.id : Utilities.getUuid(), date, entry.playerId, entry.playerName, entry.status, entry.lateMinutes, entry.comments, previous ? previous.createdAt : now, now, 'cuerpo-tecnico'];
    });
    attendanceSheet.getRange(attendanceSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return rows.map(function(row) { return { id: String(row[0]), date: date, playerId: String(row[2]), playerName: String(row[3]), status: String(row[4]), lateMinutes: Number(row[5] || 0), comments: String(row[6] || ''), createdAt: iso_(row[7]), updatedAt: iso_(row[8]), createdBy: String(row[9]) }; });
  } finally { lock.releaseLock(); }
}

function markAttendancePresentFromMeasurement_(date, player, now, createdBy) {
  const attendanceSheet = ensureAttendanceSheet_();
  const values = attendanceSheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const dateColumn = headers.indexOf('fecha');
  const playerColumn = headers.indexOf('jugador_id');
  let rowNumber = -1;
  for (let index = 1; index < values.length; index += 1) {
    if (dateKey_(values[index][dateColumn]) === date && String(values[index][playerColumn]) === String(player.id)) {
      rowNumber = index + 1;
      break;
    }
  }
  const previous = rowNumber > 0 ? values[rowNumber - 1] : [];
  const record = {
    id: rowNumber > 0 ? String(previous[headers.indexOf('id')]) : Utilities.getUuid(),
    fecha: date,
    jugador_id: String(player.id),
    jugador_nombre: String(player.name),
    estado: 'present',
    minutos_retraso: 0,
    comentarios: rowNumber > 0 ? String(previous[headers.indexOf('comentarios')] || '') : 'Presencia registrada automáticamente mediante medición',
    creado_en: rowNumber > 0 ? previous[headers.indexOf('creado_en')] : now,
    actualizado_en: now,
    creado_por: createdBy || 'medicion',
  };
  const row = headers.map(function(header) { return record[header] === undefined ? '' : record[header]; });
  if (rowNumber > 0) attendanceSheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  else attendanceSheet.appendRow(row);
}

function getBootstrap_(session) {
  const birthdayState = getBirthdayState_(session);
  return {
    players: getPlayers_(session),
    // El histórico completo puede crecer mucho y no debe bloquear la entrada
    // del cuerpo técnico a la plantilla. Se carga después, en segundo plano.
    measurements: session.role === 'player' ? getMeasurements_(session) : [],
    session: getCurrentSession_(),
    needsBirthDate: birthdayState.needsBirthDate,
    birthdaysToday: birthdayState.birthdaysToday,
  };
}

function isStaffName_(name) {
  return /\bCT\b|cuerpo t[ée]cnico|entrenador|preparador|fisio|delegado/i.test(String(name || ''));
}

function birthdayMonthDay_(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'MM-dd');
  const clean = String(value).trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return match[2] + '-' + match[3];
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? '' : Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'MM-dd');
}

function getBirthdayState_(session) {
  const playersSheet = sheet_(SHEETS.PLAYERS);
  const values = playersSheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idColumn = headers.indexOf('id');
  const nameColumn = headers.indexOf('nombre');
  const activeColumn = headers.indexOf('activo');
  const birthdayColumn = headers.indexOf('fecha_nacimiento');
  const todayMonthDay = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd');
  const birthdaysToday = [];
  let needsBirthDate = false;
  values.slice(1).forEach(function(row) {
    if (!boolean_(row[activeColumn])) return;
    const name = String(row[nameColumn] || '');
    const birthday = birthdayColumn >= 0 ? row[birthdayColumn] : '';
    if (birthdayMonthDay_(birthday) === todayMonthDay) birthdaysToday.push(name);
    if (session.role === 'player' && String(row[idColumn]) === String(session.playerId) && !birthday) needsBirthDate = true;
  });
  return { needsBirthDate: needsBirthDate, birthdaysToday: birthdaysToday };
}

function saveBirthDate_(birthDate, session) {
  if (!session || session.role !== 'player' || !session.playerId) throw apiError_('Solo el jugador puede registrar su fecha de cumpleaños.', 'FORBIDDEN');
  const clean = String(birthDate || '').trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw apiError_('Introduce una fecha de cumpleaños válida.', 'VALIDATION');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0);
  if (year < 1900 || parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day || clean > dateKey_(new Date())) {
    throw apiError_('Introduce una fecha de cumpleaños válida.', 'VALIDATION');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('Hay muchos guardados a la vez. Inténtalo de nuevo en unos segundos.', 'BUSY');
  try {
    const playersSheet = sheet_(SHEETS.PLAYERS);
    let values = playersSheet.getDataRange().getValues();
    let headers = values[0].map(String);
    let birthdayColumn = headers.indexOf('fecha_nacimiento');
    if (birthdayColumn < 0) {
      birthdayColumn = headers.length;
      playersSheet.getRange(1, birthdayColumn + 1).setValue('fecha_nacimiento');
      values = playersSheet.getDataRange().getValues();
      headers = values[0].map(String);
    }
    const idColumn = headers.indexOf('id');
    const activeColumn = headers.indexOf('activo');
    for (let index = 1; index < values.length; index += 1) {
      if (String(values[index][idColumn]) !== String(session.playerId) || !boolean_(values[index][activeColumn])) continue;
      if (values[index][birthdayColumn]) throw apiError_('La fecha de cumpleaños ya está registrada.', 'BIRTHDATE_ALREADY_SET');
      const target = playersSheet.getRange(index + 1, birthdayColumn + 1);
      target.setNumberFormat('@');
      target.setValue(clean);
      return getBirthdayState_(session);
    }
    throw apiError_('Jugador no válido.', 'INVALID_PLAYER');
  } finally { lock.releaseLock(); }
}

function getMatches_(session) {
  const cachedMatches = readMatchesApiCache_();
  if (cachedMatches) return matchesForSession_(cachedMatches, session);
  ensureMatchMinutesSchema_();
  const minutesByMatch = {};
  rows_(SHEETS.MATCH_MINUTES).forEach(function(row) {
    const matchId = String(row.partido_id || '');
    if (!minutesByMatch[matchId]) minutesByMatch[matchId] = [];
    minutesByMatch[matchId].push({
      playerId: String(row.jugador_id),
      playerName: String(row.jugador_nombre),
      calledUp: hasValue_(row.convocado) ? boolean_(row.convocado) : Number(row.minutos || 0) > 0 || Number(row.amarillas || 0) > 0 || Number(row.rojas || 0) > 0,
      starter: boolean_(row.titular),
      minutes: Number(row.minutos || 0),
      goals: Number(row.goles || 0),
      yellowCards: Number(row.amarillas || 0),
      redCards: Number(row.rojas || 0),
    });
  });
  const matches = rows_(SHEETS.MATCHES).map(function(row) {
    return {
      id: String(row.id),
      date: dateKey_(row.fecha),
      type: String(row.tipo) === 'friendly' ? 'friendly' : 'official',
      opponent: String(row.rival || ''),
      durationMinutes: Number(row.duracion_minutos || 90),
      minutes: minutesByMatch[String(row.id)] || [],
      createdAt: iso_(row.creado_en),
      updatedAt: iso_(row.actualizado_en),
      createdBy: String(row.creado_por || 'cuerpo-tecnico'),
    };
  }).sort(function(a, b) {
    return (b.date + b.createdAt).localeCompare(a.date + a.createdAt);
  });
  writeMatchesApiCache_(matches);
  return matchesForSession_(matches, session);
}

function matchesForSession_(matches, session) {
  if (session.role === 'staff') return matches;
  return matches.map(function(match) {
    const copy = Object.assign({}, match);
    copy.minutes = (match.minutes || []).filter(function(entry) { return entry.playerId === String(session.playerId); });
    return copy;
  });
}

function ensureDisciplineSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw apiError_('La hoja de cálculo no está configurada.', 'CONFIG');
  const spreadsheet = SpreadsheetApp.openById(id);
  let targetSheet = spreadsheet.getSheetByName(SHEETS.DISCIPLINE);
  if (!targetSheet) {
    ensureSheet_(spreadsheet, SHEETS.DISCIPLINE, HEADERS[SHEETS.DISCIPLINE]);
    targetSheet = spreadsheet.getSheetByName(SHEETS.DISCIPLINE);
  }
  return targetSheet;
}

function getDisciplineStatuses_(session) {
  requireStaff_(session);
  const targetSheet = ensureDisciplineSheet_();
  const values = targetSheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) { return row.some(function(value) { return value !== ''; }); }).map(function(row) {
    const item = headers.reduce(function(result, header, index) { result[header] = row[index]; return result; }, {});
    return {
      playerId: String(item.jugador_id || ''),
      playerName: String(item.jugador_nombre || ''),
      servedYellowCards: Number(item.amarillas_cumplidas || 0),
      servedRedCards: Number(item.rojas_cumplidas || 0),
      servedAt: item.cumplida_en ? iso_(item.cumplida_en) : '',
    };
  });
}

function markSanctionServed_(playerId, session) {
  requireStaff_(session);
  const cleanPlayerId = String(playerId || '').trim();
  const player = getPlayers_({ role: 'staff' }).find(function(item) { return item.id === cleanPlayerId && !item.staffMember; });
  if (!player) throw apiError_('Jugador no válido.', 'INVALID_PLAYER');
  const totals = getMatches_({ role: 'staff' }).reduce(function(result, match) {
    const entry = (match.minutes || []).find(function(item) { return item.playerId === cleanPlayerId; });
    if (!entry) return result;
    result.yellowCards += Number(entry.yellowCards || 0);
    result.redCards += Number(entry.redCards || 0);
    return result;
  }, { yellowCards: 0, redCards: 0 });
  const previous = getDisciplineStatuses_({ role: 'staff' }).find(function(item) { return item.playerId === cleanPlayerId; });
  const yellowPending = totals.yellowCards > Number(previous && previous.servedYellowCards || 0) && totals.yellowCards > 0 && totals.yellowCards % 5 === 0;
  const redPending = totals.redCards > Number(previous && previous.servedRedCards || 0);
  if (!yellowPending && !redPending) throw apiError_('Este jugador no tiene una sanción pendiente de cerrar.', 'VALIDATION');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('Hay muchos guardados a la vez. Inténtalo de nuevo.', 'BUSY');
  try {
    const targetSheet = ensureDisciplineSheet_();
    const values = targetSheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const idColumn = headers.indexOf('jugador_id');
    const existingIndex = values.slice(1).findIndex(function(row) { return String(row[idColumn]) === cleanPlayerId; });
    const now = new Date();
    const saved = {
      playerId: cleanPlayerId,
      playerName: player.name,
      servedYellowCards: yellowPending ? totals.yellowCards : Number(previous && previous.servedYellowCards || 0),
      servedRedCards: redPending ? totals.redCards : Number(previous && previous.servedRedCards || 0),
      servedAt: now.toISOString(),
    };
    const row = headers.map(function(header) {
      if (header === 'jugador_id') return saved.playerId;
      if (header === 'jugador_nombre') return saved.playerName;
      if (header === 'amarillas_cumplidas') return saved.servedYellowCards;
      if (header === 'rojas_cumplidas') return saved.servedRedCards;
      if (header === 'cumplida_en') return now;
      if (header === 'actualizado_por') return 'cuerpo-tecnico';
      return '';
    });
    if (existingIndex >= 0) targetSheet.getRange(existingIndex + 2, 1, 1, headers.length).setValues([row]);
    else targetSheet.appendRow(row);
    return saved;
  } finally { lock.releaseLock(); }
}

function readMatchesApiCache_() {
  try {
    const cached = CacheService.getScriptCache().get('matches-api-v1');
    const parsed = cached ? JSON.parse(cached) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) { return null; }
}

function writeMatchesApiCache_(matches) {
  try { CacheService.getScriptCache().put('matches-api-v1', JSON.stringify(matches), 90); } catch (error) { /* La lectura directa sigue disponible. */ }
}

function invalidateMatchesApiCache_() {
  try { CacheService.getScriptCache().remove('matches-api-v1'); } catch (error) { /* No bloquea el guardado. */ }
}

function validateMatchInput_(input, session) {
  requireStaff_(session);
  if (!input) throw apiError_('Faltan los datos del partido.', 'VALIDATION');
  const date = String(input.date || '').trim();
  const type = String(input.type || '') === 'friendly' ? 'friendly' : String(input.type || '') === 'official' ? 'official' : '';
  const opponent = String(input.opponent || '').replace(/[<>]/g, '').trim().slice(0, 100);
  const duration = Number(input.durationMinutes);
  const entries = Array.isArray(input.minutes) ? input.minutes : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw apiError_('La fecha del partido no es válida.', 'VALIDATION');
  if (!type) throw apiError_('El tipo de partido no es válido.', 'VALIDATION');
  if (!opponent) throw apiError_('Introduce el rival.', 'VALIDATION');
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) throw apiError_('La duración del partido no es válida.', 'VALIDATION');
  if (!entries.length) throw apiError_('Marca como convocado al menos a un jugador.', 'VALIDATION');

  const players = getPlayers_({ role: 'staff' });
  const playersById = {};
  players.forEach(function(player) { playersById[player.id] = player; });
  const seen = {};
  const cleanEntries = entries.map(function(entry) {
    const playerId = String(entry.playerId || '');
    const player = playersById[playerId];
    const calledUp = Boolean(entry.calledUp);
    const starter = Boolean(entry.starter);
    const minutes = Number(entry.minutes);
    const goals = Number(entry.goals || 0);
    const yellowCards = Number(entry.yellowCards || 0);
    const redCards = Number(entry.redCards || 0);
    if (!player || player.name !== String(entry.playerName || '') || seen[playerId]) throw apiError_('Hay un jugador no válido o repetido.', 'INVALID_PLAYER');
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > duration) throw apiError_('Los minutos de ' + player.name + ' no son válidos.', 'VALIDATION');
    if (!Number.isInteger(goals) || goals < 0 || goals > 20) throw apiError_('Los goles de ' + player.name + ' no son válidos.', 'VALIDATION');
    if (!Number.isInteger(yellowCards) || yellowCards < 0 || yellowCards > 2) throw apiError_('Las amarillas de ' + player.name + ' no son válidas.', 'VALIDATION');
    if (!Number.isInteger(redCards) || redCards < 0 || redCards > 1) throw apiError_('Las rojas de ' + player.name + ' no son válidas.', 'VALIDATION');
    if (!calledUp && (starter || minutes > 0 || goals > 0 || yellowCards > 0 || redCards > 0)) throw apiError_(player.name + ' debe figurar como convocado.', 'VALIDATION');
    seen[playerId] = true;
    return { playerId: player.id, playerName: player.name, calledUp: calledUp, starter: starter, minutes: minutes, goals: goals, yellowCards: yellowCards, redCards: redCards };
  });
  if (!cleanEntries.some(function(entry) { return entry.calledUp; })) throw apiError_('Marca como convocado al menos a un jugador.', 'VALIDATION');
  if (cleanEntries.filter(function(entry) { return entry.starter; }).length > (getTeamSettings_().profile === 'football7' ? 7 : 11)) throw apiError_('No puedes marcar más de ' + (getTeamSettings_().profile === 'football7' ? 7 : 11) + ' titulares.', 'VALIDATION');

  return { date: date, type: type, opponent: opponent, duration: duration, entries: cleanEntries };
}

function saveMatch_(input, session) {
  const clean = validateMatchInput_(input, session);
  const requestedId = String(input.requestId || '').trim();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('Hay muchos guardados a la vez. Inténtalo de nuevo en unos segundos.', 'BUSY');
  try {
    if (requestedId) {
      const existing = getMatches_({ role: 'staff' }).find(function(match) { return match.id === requestedId; });
      if (existing) return existing;
    }
    const id = requestedId || Utilities.getUuid();
    const now = new Date();
    sheet_(SHEETS.MATCHES).appendRow([id, clean.date, clean.type, clean.opponent, clean.duration, now, now, 'cuerpo-tecnico']);
    const minuteRows = clean.entries.map(function(entry) { return [id, entry.playerId, entry.playerName, entry.minutes, entry.yellowCards, entry.redCards, entry.calledUp, entry.goals, entry.starter]; });
    const minutesSheet = ensureMatchMinutesSchema_();
    minutesSheet.getRange(minutesSheet.getLastRow() + 1, 1, minuteRows.length, minuteRows[0].length).setValues(minuteRows);
    invalidateMatchesApiCache_();
    return {
      id: id, date: clean.date, type: clean.type, opponent: clean.opponent, durationMinutes: clean.duration,
      minutes: clean.entries, createdAt: now.toISOString(), updatedAt: now.toISOString(), createdBy: 'cuerpo-tecnico',
    };
  } finally {
    lock.releaseLock();
  }
}

function updateMatch_(matchId, input, session) {
  const clean = validateMatchInput_(input, session);
  const id = String(matchId || '');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('Hay muchos guardados a la vez. Inténtalo de nuevo.', 'BUSY');
  try {
    const matchesSheet = sheet_(SHEETS.MATCHES);
    const matchValues = matchesSheet.getDataRange().getValues();
    const matchHeaders = matchValues[0].map(String);
    const idColumn = matchHeaders.indexOf('id');
    const rowIndex = matchValues.slice(1).findIndex(function(row) { return String(row[idColumn]) === id; });
    if (rowIndex < 0) throw apiError_('Partido no encontrado.', 'NOT_FOUND');
    const rowNumber = rowIndex + 2;
    const createdAt = matchValues[rowIndex + 1][matchHeaders.indexOf('creado_en')];
    matchesSheet.getRange(rowNumber, 1, 1, matchHeaders.length).setValues([matchHeaders.map(function(header) {
      if (header === 'id') return id;
      if (header === 'fecha') return clean.date;
      if (header === 'tipo') return clean.type;
      if (header === 'rival') return clean.opponent;
      if (header === 'duracion_minutos') return clean.duration;
      if (header === 'creado_en') return createdAt;
      if (header === 'actualizado_en') return new Date();
      if (header === 'creado_por') return 'cuerpo-tecnico';
      return '';
    })]);
    deleteRowsByMatchId_(sheet_(SHEETS.MATCH_MINUTES), id);
    const minuteRows = clean.entries.map(function(entry) { return [id, entry.playerId, entry.playerName, entry.minutes, entry.yellowCards, entry.redCards, entry.calledUp, entry.goals, entry.starter]; });
    const minutesSheet = ensureMatchMinutesSchema_();
    minutesSheet.getRange(minutesSheet.getLastRow() + 1, 1, minuteRows.length, minuteRows[0].length).setValues(minuteRows);
    invalidateMatchesApiCache_();
    return getMatches_({ role: 'staff' }).find(function(match) { return match.id === id; });
  } finally { lock.releaseLock(); }
}

function deleteRowsByMatchId_(targetSheet, matchId) {
  const values = targetSheet.getDataRange().getValues();
  const rowNumbers = [];
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0]) === String(matchId)) rowNumbers.push(index + 1);
  }
  if (!rowNumbers.length) return;
  const groups = [];
  let start = rowNumbers[0];
  let count = 1;
  for (let index = 1; index < rowNumbers.length; index += 1) {
    if (rowNumbers[index] === rowNumbers[index - 1] + 1) count += 1;
    else { groups.push({ start: start, count: count }); start = rowNumbers[index]; count = 1; }
  }
  groups.push({ start: start, count: count });
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    targetSheet.deleteRows(groups[index].start, groups[index].count);
  }
}

function ensureMatchMinutesSchema_() {
  const targetSheet = sheet_(SHEETS.MATCH_MINUTES);
  const headers = targetSheet.getRange(1, 1, 1, Math.max(1, targetSheet.getLastColumn())).getValues()[0].map(String);
  if (headers.indexOf('titular') < 0) targetSheet.getRange(1, headers.length + 1).setValue('titular');
  return targetSheet;
}

function deleteMatch_(matchId, session) {
  requireStaff_(session);
  const id = String(matchId || '');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('Hay muchos guardados a la vez. Inténtalo de nuevo.', 'BUSY');
  try {
    const matchesSheet = sheet_(SHEETS.MATCHES);
    const values = matchesSheet.getDataRange().getValues();
    const rowIndex = values.slice(1).findIndex(function(row) { return String(row[0]) === id; });
    if (rowIndex < 0) throw apiError_('Partido no encontrado.', 'NOT_FOUND');
    matchesSheet.deleteRow(rowIndex + 2);
    deleteRowsByMatchId_(sheet_(SHEETS.MATCH_MINUTES), id);
    invalidateMatchesApiCache_();
    return true;
  } finally { lock.releaseLock(); }
}

function getCurrentSession_() {
  const today = dateKey_(new Date());
  let row = rows_(SHEETS.SESSIONS).find(function(item) { return dateKey_(item.fecha) === today && boolean_(item.activa); });
  if (!row) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw apiError_('Hay muchas conexiones a la vez. Inténtalo de nuevo en unos segundos.', 'BUSY');
    try {
      row = rows_(SHEETS.SESSIONS).find(function(item) { return dateKey_(item.fecha) === today && boolean_(item.activa); });
      if (!row) {
        const now = new Date();
        row = { id: 'session-' + today, fecha: today, tipo_sesion: 'Entrenamiento', rival: '', jornada: '', activa: true, hora_apertura: now, hora_cierre: '' };
        sheet_(SHEETS.SESSIONS).appendRow([row.id, row.fecha, row.tipo_sesion, row.rival, row.jornada, row.activa, row.hora_apertura, row.hora_cierre]);
      }
    } finally { lock.releaseLock(); }
  }
  return { id: String(row.id), date: today, type: String(row.tipo_sesion), opponent: String(row.rival || ''), matchday: String(row.jornada || ''), active: true, openedAt: iso_(row.hora_apertura), closedAt: row.hora_cierre ? iso_(row.hora_cierre) : undefined };
}

function saveMeasurement_(input, session) {
  if (!input) throw apiError_('Faltan los datos de la medición.', 'VALIDATION');
  if (session.role === 'player' && String(session.playerId) !== String(input.playerId)) throw apiError_('No puedes guardar datos de otro jugador.', 'FORBIDDEN');
  const players = getPlayers_({ role: 'staff' });
  const player = players.find(function(item) { return item.id === String(input.playerId); });
  if (!player || player.name !== String(input.playerName)) throw apiError_('Jugador no válido.', 'INVALID_PLAYER');
  const hasWeight = hasValue_(input.weight);
  const hasFatigue = hasValue_(input.fatigue);
  const hasSoreness = hasValue_(input.soreness);
  const weight = hasWeight ? Number(input.weight) : undefined;
  const fatigue = hasFatigue ? Number(input.fatigue) : undefined;
  const soreness = hasSoreness ? Number(input.soreness) : undefined;
  if (getTeamSettings_().weight && (!hasWeight || !(weight >= 30 && weight <= 250))) throw apiError_('Introduce un peso válido.', 'VALIDATION');
  if ((getTeamSettings_().fatigue && !hasFatigue) || (getTeamSettings_().soreness && !hasSoreness)) throw apiError_('Debes completar peso, fatiga y molestias.', 'VALIDATION');
  if ([fatigue, soreness].some(function(value) { return !Number.isInteger(value) || value < 1 || value > 10; })) throw apiError_('Los valores deben estar entre 1 y 10.', 'VALIDATION');
  if (((getTeamSettings_().fatigue && fatigue > 1) || (getTeamSettings_().soreness && soreness > 1)) && !String(input.comments || '').trim()) throw apiError_('Explica el motivo cuando la fatiga o las molestias sean superiores a 1.', 'VALIDATION');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('Hay muchos guardados a la vez. Tus datos siguen en el formulario; inténtalo de nuevo.', 'BUSY');
  try {
    const sheet = sheet_(SHEETS.MEASUREMENTS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const playerColumn = headers.indexOf('jugador_id');
    const dateColumn = headers.indexOf('fecha');
    const today = dateKey_(new Date());
    const requestedDate = session.role === 'staff' && input.date ? String(input.date) : today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || requestedDate > today) throw apiError_('La fecha de la medición no es válida.', 'VALIDATION');
    let rowIndex = -1;
    for (let index = 1; index < values.length; index += 1) {
      if (String(values[index][playerColumn]) === player.id && dateKey_(values[index][dateColumn]) === requestedDate) { rowIndex = index + 1; break; }
    }
    const now = new Date();
    const previous = rowIndex > 0 ? values[rowIndex - 1] : [];
    const previousId = rowIndex > 0 ? String(previous[0]) : '';
    const previousCreated = rowIndex > 0 ? previous[3] : now;
    if (rowIndex > 0 && session.role !== 'staff' && isOlderThan24Hours_(previousCreated, now)) {
      throw apiError_('Han pasado más de 24 horas. Solo el cuerpo técnico puede modificar este registro.', 'EDIT_WINDOW_EXPIRED');
    }
    const id = previousId || Utilities.getUuid();
    const comments = String(input.comments || '').replace(/[<>]/g, '').trim().slice(0, 500);
    const mergedWeight = hasWeight ? weight : numberOrNull_(previous[6]);
    const mergedFatigue = hasFatigue ? fatigue : numberOrNull_(previous[7]);
    const mergedSoreness = hasSoreness ? soreness : numberOrNull_(previous[8]);
    const createdBy = session.role === 'player' ? 'jugador:' + player.id : 'cuerpo-tecnico';
    const row = [id, requestedDate, Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm'), previousCreated, player.id, player.name, blankIfUndefined_(mergedWeight), blankIfUndefined_(mergedFatigue), blankIfUndefined_(mergedSoreness), comments, String(input.sessionId || ''), createdBy, now];
    if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    markAttendancePresentFromMeasurement_(requestedDate, player, now, createdBy);
    return { id: id, date: requestedDate, time: row[2], createdAt: iso_(previousCreated), playerId: player.id, playerName: player.name, weight: mergedWeight, fatigue: mergedFatigue, soreness: mergedSoreness, comments: comments, sessionId: String(input.sessionId || ''), createdBy: createdBy, updatedAt: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function isOlderThan24Hours_(createdAt, now) {
  const createdTime = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!isFinite(createdTime)) return true;
  return now.getTime() - createdTime > 24 * 60 * 60 * 1000;
}

function generatePlayerPins_() {
  const playersSheet = sheet_(SHEETS.PLAYERS);
  const values = playersSheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idColumn = headers.indexOf('id');
  const nameColumn = headers.indexOf('nombre');
  const activeColumn = headers.indexOf('activo');
  const pinColumn = headers.indexOf('pin_hash');
  if (pinColumn < 0) throw apiError_('Primero ejecuta "Preparar pestañas y datos demo" para actualizar la estructura.', 'CONFIG');
  const used = {};
  const codes = [];
  const pinHashes = values.slice(1).map(function(row) {
    if (!boolean_(row[activeColumn])) return [row[pinColumn] || ''];
    let pin;
    do { pin = String(Math.floor(Math.random() * 9000) + 1000); } while (used[pin]);
    used[pin] = true;
    codes.push([String(row[idColumn]), String(row[nameColumn]), pin]);
    return [sha256_(pin)];
  });
  if (pinHashes.length) playersSheet.getRange(2, pinColumn + 1, pinHashes.length, 1).setValues(pinHashes);
  const codesSheet = sheet_(SHEETS.CODES);
  codesSheet.clearContents();
  codesSheet.getRange(1, 1, 1, HEADERS[SHEETS.CODES].length).setValues([HEADERS[SHEETS.CODES]]);
  if (codes.length) codesSheet.getRange(2, 1, codes.length, codes[0].length).setValues(codes);
  if (codes.length) codesSheet.getRange(2, 3, codes.length, 1).setNumberFormat('@');
  codesSheet.setFrozenRows(1);
  codesSheet.getRange(1, 1, 1, 3).setBackground('#16365f').setFontColor('#ffffff').setFontWeight('bold');
  codesSheet.autoResizeColumns(1, 3);
  return codes.length;
}

function applyPlayerPins_() {
  const playersSheet = sheet_(SHEETS.PLAYERS);
  const playerValues = playersSheet.getDataRange().getValues();
  const playerHeaders = playerValues[0].map(String);
  const playerIdColumn = playerHeaders.indexOf('id');
  const playerNameColumn = playerHeaders.indexOf('nombre');
  const playerActiveColumn = playerHeaders.indexOf('activo');
  const playerPinColumn = playerHeaders.indexOf('pin_hash');
  if (playerPinColumn < 0) throw new Error('Primero ejecuta "Preparar pestañas y datos demo" para actualizar la estructura.');

  const activePlayers = {};
  playerValues.slice(1).forEach(function(row, index) {
    if (boolean_(row[playerActiveColumn])) activePlayers[String(row[playerIdColumn])] = { rowIndex: index + 2, name: String(row[playerNameColumn]) };
  });

  const codesSheet = sheet_(SHEETS.CODES);
  const codeValues = codesSheet.getDataRange().getValues();
  if (codeValues.length < 2) throw new Error('No hay códigos para aplicar. Genera los PINs primero.');
  const codeHeaders = codeValues[0].map(String);
  const codeIdColumn = codeHeaders.indexOf('jugador_id');
  const codePinColumn = codeHeaders.indexOf('pin');
  const seenPins = {};
  const pinsByPlayer = {};

  codeValues.slice(1).forEach(function(row, index) {
    const playerId = String(row[codeIdColumn] || '').trim();
    const pin = String(row[codePinColumn] || '').trim();
    if (!playerId && !pin) return;
    const rowNumber = index + 2;
    if (!activePlayers[playerId]) throw new Error('La fila ' + rowNumber + ' no corresponde a un jugador activo.');
    if (!/^\d{4,12}$/.test(pin)) throw new Error('El PIN de ' + activePlayers[playerId].name + ' debe tener entre 4 y 12 dígitos.');
    if (seenPins[pin]) throw new Error('El PIN ' + pin + ' está repetido en ' + seenPins[pin] + ' y ' + activePlayers[playerId].name + '.');
    if (pinsByPlayer[playerId]) throw new Error('El jugador ' + activePlayers[playerId].name + ' aparece más de una vez.');
    seenPins[pin] = activePlayers[playerId].name;
    pinsByPlayer[playerId] = pin;
  });

  Object.keys(activePlayers).forEach(function(playerId) {
    if (!pinsByPlayer[playerId]) throw new Error('Falta un PIN para ' + activePlayers[playerId].name + '.');
  });
  Object.keys(activePlayers).forEach(function(playerId) {
    playersSheet.getRange(activePlayers[playerId].rowIndex, playerPinColumn + 1).setValue(sha256_(pinsByPlayer[playerId]));
  });
  codesSheet.getRange(2, 3, Math.max(1, codesSheet.getLastRow() - 1), 1).setNumberFormat('@');
  return Object.keys(activePlayers).length;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existing = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
    headers.forEach(function(header) {
      if (existing.indexOf(header) < 0) {
        existing.push(header);
        sheet.getRange(1, existing.length).setValue(header);
      }
    });
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground('#16365f').setFontColor('#ffffff').setFontWeight('bold');
  sheet.autoResizeColumns(1, headers.length);
}

function ensureAuthSecret_() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty('AUTH_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty('AUTH_SECRET', secret);
  }
  return secret;
}

function signSession_(payload) {
  const encoded = Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(payload)).getBytes());
  return encoded + '.' + signature_(encoded);
}

function signature_(encoded) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(encoded, ensureAuthSecret_(), Utilities.Charset.UTF_8));
}

function ensureConfig_(key, value) {
  const sheet = sheet_(SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0]) === key) return;
  }
  sheet.appendRow([key, value]);
}

function setConfig_(key, value) {
  const sheet = sheet_(SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0]) !== key) continue;
    sheet.getRange(index + 1, 2).setValue(value);
    return;
  }
  sheet.appendRow([key, value]);
}

function sheet_(name) {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw apiError_('La hoja de cálculo no está configurada.', 'CONFIG');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sheet) throw apiError_('Falta la pestaña ' + name + '.', 'CONFIG');
  return sheet;
}

function rows_(name) {
  const values = sheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) { return row.some(function(value) { return value !== ''; }); }).map(function(row) {
    return headers.reduce(function(object, key, index) { object[key] = row[index]; return object; }, {});
  });
}

function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(function(byte) { const unsigned = byte < 0 ? byte + 256 : byte; return unsigned.toString(16).padStart(2, '0'); }).join('');
}
function dateKey_(value) { return Utilities.formatDate(new Date(value), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function iso_(value) { return new Date(value).toISOString(); }
function boolean_(value) { return value === true || String(value).toLowerCase() === 'true' || value === 1; }
function numberOrNull_(value) { if (value === '' || value === null || value === undefined) return undefined; const number = Number(value); return Number.isFinite(number) ? number : undefined; }
function hasValue_(value) { return value !== '' && value !== null && value !== undefined; }
function blankIfUndefined_(value) { return value === undefined ? '' : value; }
function apiError_(message, code) { const error = new Error(message); error.code = code; return error; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }


function defaultTeamSettings_() { return { profile: 'football11', weight: true, fatigue: true, soreness: true, injuries: true, attendance: true, matches: true, cards: true }; }
function getTeamSettings_() {
  const raw = PropertiesService.getScriptProperties().getProperty('TEAM_FEATURES_V1');
  if (!raw) return defaultTeamSettings_();
  try { return Object.assign(defaultTeamSettings_(), JSON.parse(raw)); } catch (error) { return defaultTeamSettings_(); }
}
function saveTeamSettings_(input, session) {
  requireStaff_(session);
  if (!input || ['football7', 'football11'].indexOf(input.profile) < 0) throw apiError_('Selecciona un perfil válido.', 'VALIDATION');
  const next = defaultTeamSettings_(); next.profile = input.profile;
  ['weight', 'fatigue', 'soreness', 'injuries', 'attendance', 'matches', 'cards'].forEach(function(key) { if (typeof input[key] !== 'boolean') throw apiError_('Configuración no válida.', 'VALIDATION'); next[key] = input[key]; });
  PropertiesService.getScriptProperties().setProperty('TEAM_FEATURES_V1', JSON.stringify(next));
  return next;
}
function ensureMatchDetailsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  const name = 'Detalles partidos';
  let target = spreadsheet.getSheetByName(name);
  if (!target) { ensureSheet_(spreadsheet, name, ['partido_id', 'arbitro', 'goles_zabal', 'goles_rival', 'incidencias', 'capitan_id']); target = spreadsheet.getSheetByName(name); }
  return target;
}
function cleanMatchDetails_(input) {
  const score = function(value) { if (value === undefined || value === null || value === '') return undefined; const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > 99) throw apiError_('El resultado debe contener goles entre 0 y 99.', 'VALIDATION'); return n; };
  const details = { referee: String(input.referee || '').replace(/[<>]/g, '').trim().slice(0,120), goalsFor: score(input.goalsFor), goalsAgainst: score(input.goalsAgainst), incidents: String(input.incidents || '').replace(/[<>]/g, '').trim().slice(0,3000), captainId: String(input.captainId || '').slice(0,100) };
  if ((details.goalsFor === undefined) !== (details.goalsAgainst === undefined)) throw apiError_('Completa los dos marcadores o deja ambos vacíos.', 'VALIDATION');
  if (details.captainId && !(input.minutes || []).some(function(entry) { return String(entry.playerId) === details.captainId && entry.calledUp !== false; })) throw apiError_('El capitán debe estar en la convocatoria del partido.', 'VALIDATION');
  return details;
}
function matchDetailsFromRow_(row) { return { referee: String(row[1] || ''), goalsFor: row[2] === '' ? undefined : Number(row[2]), goalsAgainst: row[3] === '' ? undefined : Number(row[3]), incidents: String(row[4] || ''), captainId: String(row[5] || '') }; }
function enrichMatchesWithDetails_(matches) {
  const rows = ensureMatchDetailsSheet_().getDataRange().getValues().slice(1); const detailsById = {};
  rows.forEach(function(row) { detailsById[String(row[0])] = matchDetailsFromRow_(row); });
  return matches.map(function(match) { return Object.assign(match, detailsById[match.id] || {}); });
}
function persistMatchDetails_(match, details) {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) throw apiError_('El partido se guardó pero faltan sus detalles. Edita el partido para completarlos.', 'BUSY');
  try {
    const target = ensureMatchDetailsSheet_(); const values = target.getDataRange().getValues();
    const index = values.findIndex(function(row, i) { return i > 0 && String(row[0]) === match.id; });
    const row = [match.id, details.referee, details.goalsFor === undefined ? '' : details.goalsFor, details.goalsAgainst === undefined ? '' : details.goalsAgainst, details.incidents, details.captainId];
    if (index > 0) target.getRange(index + 1, 1, 1, row.length).setValues([row]); else target.appendRow(row);
    return Object.assign(match, details);
  } finally { lock.releaseLock(); }
}
function saveMatchWithDetails_(input, session) {
  requireStaff_(session); const details = cleanMatchDetails_(input); const requestId = String(input.requestId || '');
  const properties = PropertiesService.getScriptProperties(); const key = 'MATCH_REQUEST_' + sha256_(requestId);
  const userLock = LockService.getUserLock(); if (!userLock.tryLock(30000)) throw apiError_('Hay otro guardado en curso.', 'BUSY');
  try {
    const previousId = requestId ? properties.getProperty(key) : '';
    const previous = previousId ? getMatches_(session).find(function(match) { return match.id === previousId; }) : null;
    const saved = previous || saveMatch_(input, session);
    if (requestId) properties.setProperty(key, saved.id);
    return persistMatchDetails_(saved, details);
  } finally { userLock.releaseLock(); }
}
function updateMatchWithDetails_(matchId, input, expectedUpdatedAt, session) { requireStaff_(session); const details = cleanMatchDetails_(input); return persistMatchDetails_(updateMatch_(matchId, input, session), details); }
function emailAttendance_(input, session) {
  requireStaff_(session);
  const email = String(input.email || '').trim();
  const pdf = String(input.pdfBase64 || '');
  const requestId = String(input.requestId || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw apiError_('Introduce un correo válido.', 'VALIDATION');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw apiError_('Solicitud de correo no válida.', 'VALIDATION');
  if (pdf.length > 2800000 || !/^JVBER[a-zA-Z0-9+/=\r\n]+$/.test(pdf)) throw apiError_('El archivo PDF no es válido o es demasiado grande.', 'VALIDATION');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) throw apiError_('Hay un envío en curso. Inténtalo de nuevo.', 'BUSY');
  try {
    const properties = PropertiesService.getScriptProperties(); const day = dateKey_(new Date());
    const key = 'ATTENDANCE_MAIL_' + day + '_' + requestId;
    const fingerprint = sha256_(email + String(input.periodLabel || ''));
    if (properties.getProperty(key)) { if (properties.getProperty(key) !== fingerprint) throw apiError_('La solicitud ya se utilizó para otro informe.', 'CONFLICT'); return true; }
    const quotaKey = 'ATTENDANCE_MAIL_COUNT_' + day; const count = Number(properties.getProperty(quotaKey) || 0);
    if (count >= 30 || MailApp.getRemainingDailyQuota() < 1) throw apiError_('Se ha alcanzado el límite de envíos del día.', 'QUOTA');
    const label = String(input.periodLabel || '').replace(/[<>\r\n]/g, '').slice(0,100);
    const attachment = Utilities.newBlob(Utilities.base64Decode(pdf), 'application/pdf', 'Zabal-asistencia.pdf');
    MailApp.sendEmail({ to: email, subject: 'Zabal Performance · Informe de asistencia · ' + label, body: 'Adjuntamos el informe de asistencia solicitado para ' + label + '.\n\nCreado y diseñado por Raul Cote', attachments: [attachment], name: 'Zabal Performance' });
    properties.setProperty(key, fingerprint); properties.setProperty(quotaKey, String(count + 1));
    Object.keys(properties.getProperties()).filter(function(name) { return name.indexOf('ATTENDANCE_MAIL_') === 0 && name.indexOf(day) < 0; }).forEach(function(name) { properties.deleteProperty(name); });
    return true;
  } finally { lock.releaseLock(); }
}

function cleanReportRecipients_(values) {
  if (!Array.isArray(values) || values.length > 30) throw apiError_('Selecciona como máximo 30 destinatarios.', 'VALIDATION');
  var seen = {};
  return values.map(function(value) { return String(value || '').trim().toLowerCase(); }).filter(function(email) {
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) || email.length > 254) throw apiError_('Hay un correo no válido.', 'VALIDATION');
    if (seen[email]) return false;
    seen[email] = true; return true;
  });
}
function getReportRecipients_(session) {
  requireStaff_(session);
  var stored = PropertiesService.getScriptProperties().getProperty('MATCH_REPORT_RECIPIENTS') || '[]';
  return cleanReportRecipients_(JSON.parse(stored));
}
function saveReportRecipients_(values, session) {
  requireStaff_(session);
  var emails = cleanReportRecipients_(values);
  var schedule = getReportSchedule_(session);
  var scheduledEmails = schedule.emails.filter(function(email) { return emails.indexOf(email) >= 0; });
  if (scheduledEmails.length !== schedule.emails.length) saveReportSchedule_({ enabled: schedule.enabled && scheduledEmails.length > 0, weekday: schedule.weekday, hour: schedule.hour, emails: scheduledEmails }, session);
  PropertiesService.getScriptProperties().setProperty('MATCH_REPORT_RECIPIENTS', JSON.stringify(emails));
  return emails;
}
function emailMatchPdf_(input, session) {
  requireStaff_(session);
  var emails = cleanReportRecipients_(input.emails);
  var pdf = String(input.pdfBase64 || '');
  var label = String(input.reportLabel || '').replace(/[<>\r\n]/g, '').trim().slice(0, 120);
  var requestId = String(input.requestId || '');
  if (!emails.length || !label) throw apiError_('Elige destinatarios y un informe.', 'VALIDATION');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw apiError_('Solicitud de correo no válida.', 'VALIDATION');
  if (pdf.length > 2800000 || !/^JVBER[a-zA-Z0-9+/=\r\n]+$/.test(pdf)) throw apiError_('El PDF no es válido o es demasiado grande.', 'VALIDATION');
  var lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) throw apiError_('Hay un envío en curso. Inténtalo de nuevo.', 'BUSY');
  try {
    var properties = PropertiesService.getScriptProperties(); var day = dateKey_(new Date());
    var key = 'MATCH_REPORT_MAIL_' + day + '_' + requestId;
    var fingerprint = sha256_(emails.join(',') + label);
    var previous = properties.getProperty(key);
    if (previous) { if (previous !== fingerprint) throw apiError_('La solicitud ya se utilizó para otro informe.', 'CONFLICT'); return true; }
    var quotaKey = 'MATCH_REPORT_MAIL_COUNT_' + day; var count = Number(properties.getProperty(quotaKey) || 0);
    if (count >= 30 || MailApp.getRemainingDailyQuota() < emails.length) throw apiError_('Se ha alcanzado el límite de envíos del día.', 'QUOTA');
    var attachment = Utilities.newBlob(Utilities.base64Decode(pdf), 'application/pdf', 'Zabal-informe-partidos.pdf');
    MailApp.sendEmail({ to: emails.join(','), subject: 'Zabal Performance · ' + label, body: 'Adjunto el informe ' + label + '.\n\nCreado y diseñado por Raul Cote', attachments: [attachment], name: 'Zabal Performance' });
    properties.setProperty(key, fingerprint); properties.setProperty(quotaKey, String(count + 1));
    return true;
  } finally { lock.releaseLock(); }
}
