import type { MatchRecord, Player } from '../types';
import { appConfig } from '../config';
import { addPdfFooters } from './pdfBrand';

type CardEntry = { yellowCards?: number; redCards?: number; expulsionYellowCards?: number; suspensionServed?: boolean };
export function collectDiscipline(players: Player[], matches: MatchRecord[]) {
  const ordered = [...matches].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return players.filter(p => !('staffMember' in p && p.staffMember)).map(player => {
    let accumulated = 0, pending = 0;
    let cycleEvents: { round: string; yellow: number; red: number; double: boolean; served: boolean }[] = [];
    const events: { round: string; yellow: number; red: number; double: boolean; served: boolean }[] = [];
    ordered.forEach((match,index) => {
      const entry = match.minutes.find(e => e.playerId === player.id) as CardEntry | undefined;
      if (!entry) return;
      const yellow = entry.yellowCards ?? 0, red = entry.redCards ?? 0, excluded = entry.expulsionYellowCards ?? 0;
      if (yellow === 2 && red === 1 && excluded === 0 || excluded !== 0 && excluded !== 2 || excluded === 2 && (yellow !== 2 || red !== 1)) throw new Error('Revisa el tipo de expulsión del acta antes de generar el informe.');
      if (entry.suspensionServed) pending = Math.max(0,pending-1);
      const before = Math.floor(accumulated/5);
      accumulated += yellow-excluded;
      pending += Math.floor(accumulated/5)-before + red;
      const round = match.opponent.match(/\bJ\s*(\d+)/i)?.[1] ?? String(index+1);
      for(let n=0;n<yellow-excluded;n++){ cycleEvents.push({ round, yellow:1,red:0,double:false,served:false }); if(cycleEvents.length===5) cycleEvents=[]; }
      if (yellow || red) events.push({ round: match.opponent.match(/\bJ\s*(\d+)/i)?.[1] ?? String(index+1), yellow, red, double: excluded === 2, served: !!entry.suspensionServed });
    });
    return { player, balance: accumulated%5, pending, events, cycleEvents };
  }).filter(row => row.events.length);
}

export async function createDisciplinaryDocument(players: Player[], matches: MatchRecord[], period = 'Liga') {
  const rows = collectDiscipline(players,matches);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit:'mm', format:[120,270] });
  const text = (value: string | string[],x: number,y: number,size=11,bold=false) => { doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(22,54,95);doc.text(value,x,y); };
  const heading = (title: string) => {
    doc.setFillColor(22,54,95);doc.rect(0,0,120,34,'F');doc.setFillColor(246,202,59);doc.rect(0,34,120,2,'F');
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('ZABAL PERFORMANCE',14,14);doc.setFontSize(11);doc.text(title,14,24);
    text(doc.splitTextToSize(`${appConfig.teamName} · ${period} · ${appConfig.season}`,104),8,43,8);
  };
  heading('Control disciplinario');
  text('Saldo del ciclo de 5 amarillas',8,59,12,true);
  const top = rows.filter(r=>r.balance>=3).sort((a,b)=>b.balance-a.balance || a.player.name.localeCompare(b.player.name));
  let y=73;
  if (!top.length) text('Sin jugadores con saldo de 3 o más.',14,y);
  top.forEach((r,index)=>{ if(y>245){doc.addPage();heading('Saldo del ciclo · Continuación');y=60;}doc.setFillColor(255,248,221);doc.roundedRect(8,y-8,104,16,2,2,'F');text(`${index+1}. ${r.player.name.slice(0,27)}`,12,y+2,10,true);text(`${r.balance} / 5`,93,y+2,14,true);y+=20; });
  y+=20;if(y>240){doc.addPage();heading('Sanciones pendientes');y=60;}
  text('Pendiente de comprobar / cumplir',8,y,10,true);y+=12;
  const pending=rows.filter(r=>r.pending>0);
  if(!pending.length) text('Sin alertas pendientes registradas.',14,y);
  pending.forEach(r=>{if(y>250){doc.addPage();heading('Sanciones pendientes');y=60;}const lines=doc.splitTextToSize(`${r.player.name} · ${r.pending} incidencia(s) pendiente(s)`,100);text(lines,8,y,10);y+=lines.length*5+4;});
  for(let offset=0;offset<rows.length;offset+=4){
    doc.addPage();heading('Detalle individual');
    rows.slice(offset,offset+4).forEach((row,index)=>{
      const topY=53+index*50;
      doc.setDrawColor(215,225,237);doc.roundedRect(8,topY,104,47,3,3,'S');
      text(doc.splitTextToSize(`${row.player.number ?? '-'} · ${row.player.name}`,96),12,topY+7,10,true);
      text(`${row.balance} / 5`,12,topY+26,20,true);text('Saldo del ciclo',12,topY+33,7);
      const recent=row.cycleEvents;let x=58;
      recent.forEach(e=>{
        doc.setFillColor(...(e.red && !e.double ? [190,60,75] : [246,202,59]) as [number,number,number]);doc.roundedRect(x,topY+16,10,18,1,1,'F');
        doc.setTextColor(e.red&&!e.double?255:22,e.red&&!e.double?255:54,e.red&&!e.double?255:95);doc.setFontSize(6);doc.text('JORNADA',x+5,topY+21,{align:'center'});doc.setFontSize(12);doc.text(e.round,x+5,topY+29,{align:'center'});
        if(e.double){doc.setFillColor(190,60,75);doc.rect(x,topY+31,10,3,'F');}x+=13;
      });
      text(row.pending ? 'Sanción pendiente de comprobar / cumplir' : 'Sin alerta vigente',12,topY+39,8,true);
      text('Sin ciclos cerrados ni amarillas de una doble amarilla.',12,topY+44,6);
    });
  }
  if(!rows.length) text('No hay amonestaciones registradas en este periodo.',14,110);
  addPdfFooters(doc);
  return doc;
}
