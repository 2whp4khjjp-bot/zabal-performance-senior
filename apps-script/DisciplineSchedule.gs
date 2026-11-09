/** Programación optativa del PDF acumulado. Sin configuración, no hay trigger ni envío. */
const DISCIPLINE_REPORT_SCHEDULE_KEY = 'DISCIPLINE_REPORT_SCHEDULE_V1';
const DISCIPLINE_REPORT_SCHEDULE_HANDLER = 'runScheduledDisciplineReport_';
const DISCIPLINE_REPORT_TIMEZONE = 'Europe/Madrid';

function cleanDisciplineSchedule_(input) {
  if (!input || typeof input !== 'object' || typeof input.enabled !== 'boolean') throw apiError_('Programación no válida.', 'VALIDATION');
  const weekday = Number(input.weekday);
  const hour = Number(input.hour);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !Number.isInteger(hour) || hour < 0 || hour > 23) throw apiError_('Día u hora no válidos.', 'VALIDATION');
  const emails = cleanReportRecipients_(input.emails);
  if (input.enabled && !emails.length) throw apiError_('Selecciona destinatarios antes de activar.', 'VALIDATION');
  return { reportKind: 'discipline', enabled: input.enabled, weekday: weekday, hour: hour, emails: emails };
}

function getDisciplineSchedule_(session) {
  requireStaff_(session);
  const raw = PropertiesService.getScriptProperties().getProperty(DISCIPLINE_REPORT_SCHEDULE_KEY);
  const saved = raw ? cleanDisciplineSchedule_(JSON.parse(raw)) : { enabled: false, weekday: 5, hour: 10, emails: [] };
  saved.reportKind = 'discipline';
  saved.lastSentAt = PropertiesService.getScriptProperties().getProperty('DISCIPLINE_LAST_SENT') || '';
  saved.lastError = PropertiesService.getScriptProperties().getProperty('DISCIPLINE_LAST_ERROR') || '';
  saved.triggerActive = disciplineScheduleTriggers_().length === 1;
  return saved;
}

function disciplineScheduleTriggers_() {
  return ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === DISCIPLINE_REPORT_SCHEDULE_HANDLER; });
}

function removeDisciplineScheduleTriggers_() {
  disciplineScheduleTriggers_().forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
}

function saveDisciplineSchedule_(input, session) {
  requireStaff_(session);
  const next = cleanDisciplineSchedule_(input);
  const storedEmails = getReportRecipients_(session);
  if (next.emails.some(function(email) { return storedEmails.indexOf(email) < 0; })) throw apiError_('Guarda primero todos los destinatarios.', 'VALIDATION');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw apiError_('Hay otra operación en curso.', 'BUSY');
  try {
    const properties = PropertiesService.getScriptProperties();
    const current = getDisciplineSchedule_(session);
    const triggers = disciplineScheduleTriggers_();
    if (!next.enabled) {
      // Desactivar primero impide un envío aunque un trigger antiguo siga ejecutándose.
      properties.setProperty(DISCIPLINE_REPORT_SCHEDULE_KEY, JSON.stringify(next));
      triggers.forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
      return next;
    }
    const sameTime = current.enabled && current.weekday === next.weekday && current.hour === next.hour;
    if (!sameTime || triggers.length !== 1) {
      const days = [ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.TUESDAY, ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY, ScriptApp.WeekDay.SATURDAY, ScriptApp.WeekDay.SUNDAY];
      ScriptApp.newTrigger(DISCIPLINE_REPORT_SCHEDULE_HANDLER).timeBased().onWeekDay(days[next.weekday - 1]).atHour(next.hour).nearMinute(0).everyWeeks(1).inTimezone(DISCIPLINE_REPORT_TIMEZONE).create();
    }
    properties.setProperty(DISCIPLINE_REPORT_SCHEDULE_KEY, JSON.stringify(next));
    if (!sameTime || triggers.length !== 1) triggers.forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
    return next;
  } finally { lock.releaseLock(); }
}

function runScheduledDisciplineReport_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return;
  try {
    const session = { role: 'staff' };
    const schedule = getDisciplineSchedule_(session);
    if (!schedule.enabled) return;
    const now = new Date();
    const day = Utilities.formatDate(now, DISCIPLINE_REPORT_TIMEZONE, 'yyyy-MM-dd');
    const weekday = Number(Utilities.formatDate(now, DISCIPLINE_REPORT_TIMEZONE, 'u'));
    if (weekday !== schedule.weekday) return;
    const properties = PropertiesService.getScriptProperties();
    const sentKey = 'DISCIPLINE_REPORT_SCHEDULE_SENT_' + day;
    if (properties.getProperty(sentKey)) return;
    if (MailApp.getRemainingDailyQuota() < schedule.emails.length) throw apiError_('No hay cuota de correo suficiente.', 'QUOTA');
    const report = collectDisciplineReport_();
    const attachment = buildDisciplineReportPdf_(report, day);
    const displayDate = day.slice(8, 10) + '/' + day.slice(5, 7) + '/' + day.slice(0, 4);
    MailApp.sendEmail({
      to: schedule.emails.join(','),
      subject: 'Zabal Performance · Informe disciplinario · ' + displayDate,
      body: 'Adjunto el informe disciplinario del equipo actualizado al ' + displayDate + '. Incluye el saldo del ciclo de amarillas y las incidencias disciplinarias.\n\nRaúl Cote',
      attachments: [attachment],
      name: 'Zabal Performance',
    });
    properties.setProperty(sentKey, new Date().toISOString());
    properties.setProperty('DISCIPLINE_LAST_SENT', new Date().toISOString());
    properties.deleteProperty('DISCIPLINE_LAST_ERROR');
  } catch (error) { PropertiesService.getScriptProperties().setProperty('DISCIPLINE_LAST_ERROR', String(error.message || error).slice(0,300)); throw error; } finally { lock.releaseLock(); }
}

function collectDisciplineReport_() {
  if (typeof invalidateMatchesApiCache_ === 'function') invalidateMatchesApiCache_();
  const session = { role: 'staff' };
  const matches = getMatches_(session).filter(function(m) { return m.type === 'official' && m.date <= dateKey_(new Date()); }).sort(function(a,b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); });
  return getPlayers_(session).filter(function(p) { return !p.staffMember; }).map(function(player) {
    let total=0, pending=0;
    const events=[]; let cycleEvents=[];
    matches.forEach(function(m,index) {
      const e=m.minutes.find(function(e) { return e.playerId === player.id; });
      if(!e)return;
      const yellow=Number(e.yellowCards||0), red=Number(e.redCards||0), excluded=Number(e.expulsionYellowCards||0);
      if ((yellow===2 && red===1 && excluded===0) || (excluded!==0 && excluded!==2) || (excluded===2 && (yellow!==2 || red!==1))) throw apiError_('Revisa el tipo de expulsión en el acta.', 'VALIDATION');
      if(e.suspensionServed) pending=Math.max(0,pending-1);
      const before=Math.floor(total/5);total+=yellow-excluded;pending+=Math.floor(total/5)-before+red;
      const round=(String(m.opponent).match(/\bJ\s*(\d+)/i)||[])[1]||String(index+1);
      for(let n=0;n<yellow-excluded;n++){cycleEvents.push({round:round,yellow:1,red:0,double:false});if(cycleEvents.length===5)cycleEvents=[];}
      if(yellow||red)events.push({ round:(String(m.opponent).match(/\bJ\s*(\d+)/i)||[])[1]||String(index+1),yellow:yellow,red:red,double:excluded===2 });
    });
    return { name:player.name,number:player.number,balance:total%5,pending:pending,events:events,cycleEvents:cycleEvents };
  }).filter(function(row) {return row.events.length;});
}

function buildDisciplineReportPdf_(rows,day) {
  const esc=scheduledHtmlEscape_;
  const header='<header><b>ZABAL PERFORMANCE</b><h1>Control disciplinario</h1><p>'+esc(disciplineConfigValue_('nombre_equipo','Atlético Zabal Linense'))+' · Oficiales · '+esc(day)+'</p></header>';
  const footer='<footer>Creado y diseñado por Raul Cote</footer>';
  const top=rows.filter(function(r){return r.balance>=3;}).sort(function(a,b){return b.balance-a.balance||a.name.localeCompare(b.name);});
  let html='<section class="cover">'+header+'<h2>Saldo del ciclo actual de 5 amarillas</h2>'+(top.length?top.map(function(r,i){return '<div class="rank"><span>'+(i+1)+'. '+esc(r.name)+'</span><b>'+r.balance+' / 5</b></div>';}).join(''):'<p>Sin jugadores con saldo de 3 o más.</p>')+'<h2>Sanciones pendientes de comprobar / cumplir</h2>';
  const pending=rows.filter(function(r){return r.pending>0;});
  html+=pending.length?pending.map(function(r){return '<p class="pending">'+esc(r.name)+' · '+r.pending+' incidencia(s) pendiente(s)</p>';}).join(''):'<p>Sin alertas pendientes registradas.</p>';
  html+=footer+'</section>';
  for(let i=0;i<rows.length;i+=4){
    html+='<section class="detail">'+header;
    rows.slice(i,i+4).forEach(function(r){
      html+='<article><h2>'+esc(String(r.number||'-')+' · '+r.name)+'</h2><div class="body"><div class="balance"><b>'+r.balance+' / 5</b><small>Saldo del ciclo actual</small></div><div class="cards">'+r.cycleEvents.map(function(e){return '<span class="card '+(e.red&&!e.double?'red':'')+' '+(e.double?'double':'')+'"><small>JORNADA</small><b>'+esc(e.round)+'</b></span>';}).join('')+'</div></div><p class="state">'+(r.pending?'Sanción pendiente de comprobar / cumplir':'Sin alerta vigente')+'</p><small>'+'Sin ciclos cerrados ni amarillas de una doble amarilla.</small></article>';
    });
    html+=footer+'</section>';
  }
  const css='@page{size:120mm 270mm;margin:6mm}body{font-family:Arial;color:#16365f;font-size:12px}header{background:#16365f;color:white;padding:15px;border-bottom:5px solid #f6ca3b}h1{font-size:23px;margin:8px 0}h2{font-size:15px;margin:16px 0 10px}header p{font-size:11px}.rank{padding:14px;background:#fff8dd;margin:8px 0;display:block}.rank b{float:right;font-size:24px}.pending{color:#a33543}article{border:1px solid #dce4ed;border-radius:8px;padding:12px;margin:10px 0;height:45mm;box-sizing:border-box;page-break-inside:avoid}article h2{margin:0 0 10px}.body{display:table;width:100%}.balance{display:table-cell;width:26%;vertical-align:middle}.balance b{font-size:30px}.balance small{display:block;font-size:9px}.cards{display:table-cell;vertical-align:middle}.card{display:inline-block;background:#f6ca3b;text-align:center;width:8mm;height:16mm;margin-right:1mm;border-radius:3px;padding-top:3mm;box-sizing:border-box}.card small{display:block;font-size:5px}.card b{display:block;font-size:17px}.red{background:#bd3f4d;color:white}.double{border-bottom:4px solid #bd3f4d}.state{font-size:10px;margin:7px 0}article>small{font-size:8px}footer{font-size:9px;color:#60748a;margin-top:16px;border-top:1px solid #dce4ed;padding-top:8px}.detail{page-break-before:always}.cover{page-break-inside:auto}';
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><style>'+css+'</style></head><body>'+html+'</body></html>').getBlob().getAs(MimeType.PDF).setName('Zabal-disciplinario-'+day+'.pdf');
}

function disciplineConfigValue_(key, fallback) {
  const row = rows_(SHEETS.CONFIG).find(function(item) { return String(item.clave) === key; });
  return row ? String(row.valor || fallback) : fallback;
}
