// Modèle pur du pilotage. Les résultats, objectifs et dates inconnus restent inconnus.
export const PILOTAGE_DEPARTMENTS={
 vn:{section:'vente:VN',label:'Véhicules neufs',metric:'units',unit:'véhicules livrés'},
 vo:{section:'vente:VO',label:'Véhicules d’occasion',metric:'units',unit:'véhicules livrés'},
 service:{section:'service:all',label:'Service',metric:'revenue',unit:'$ de ventes MO'},
 parts:{section:'piece:all',label:'Pièces',metric:'revenue',unit:'$ de ventes'}
};
export const TASK_STATUSES={todo:'À faire',in_progress:'En cours',blocked:'Bloquée',done:'Terminée',cancelled:'Annulée'};
export const isNumber=v=>typeof v==='number'&&Number.isFinite(v);
export function managementTaskId(cryptoApi=crypto){
 if(typeof cryptoApi.randomUUID==='function')return cryptoApi.randomUUID();
 const bytes=cryptoApi.getRandomValues(new Uint8Array(16));bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128;
 const hex=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
const sumKnown=xs=>{const ns=xs.filter(isNumber);return ns.length?Math.round(ns.reduce((a,b)=>a+b,0)*100)/100:null;};
export function torontoToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function goalProgress(actual,goal,{complete=true}={}){
 const usable=complete&&isNumber(actual)&&isNumber(goal)&&goal>0;
 return {actual:isNumber(actual)?actual:null,goal:isNumber(goal)?goal:null,percent:usable?actual/goal*100:null,
  remaining:usable?Math.max(0,goal-actual):null,remainingPercent:usable?Math.max(0,100-actual/goal*100):null,exceeded:usable&&actual>goal};
}
function latestOfficial(submissions,dealer,month,section,asOf){
 const own=submissions.filter(s=>s.dealership_id===dealer&&s.snapshot?.endDate?.startsWith(month)&&s.snapshot.endDate<=asOf&&s.snapshot.sections?.[section]);
 const newest=new Map();for(const s of own){const key=s.period_id||s.snapshot.kind+'|'+s.snapshot.endDate,old=newest.get(key);if(!old||s.sequence>old.sequence||s.sequence===old.sequence&&s.submitted_at>old.submitted_at)newest.set(key,s);}
 const final=[...newest.values()].filter(s=>s.snapshot.kind==='monthly_final').sort((a,b)=>a.snapshot.endDate.localeCompare(b.snapshot.endDate)).at(-1);
 if(final)return {values:final.snapshot.sections[section].data?.values||{},asOf:final.snapshot.endDate,source:'Mois final soumis'};
 const weeks=[...newest.values()].filter(s=>s.snapshot.kind==='weekly');if(!weeks.length)return null;
 const data=weeks.map(s=>s.snapshot.sections[section].data?.values||{}),values={};
 for(const key of ['retailUnits','revenue','profit','hours'])values[key]=sumKnown(data.map(v=>v[key]));
 return {values,asOf:weeks.map(s=>s.snapshot.endDate).sort().at(-1),source:'Semaines soumises',partial:true};
}
export function pilotageRows({dealerships=[],records=[],submissions=[],targets=[],month,asOf=torontoToday()}={}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')||!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw Error('Période de pilotage invalide.');
 const year=month.slice(0,4),cutoff=month.slice(0,4)>asOf.slice(0,4)?0:Math.min(Number(month.slice(5)),year===asOf.slice(0,4)?Number(asOf.slice(5,7)):12);
 const annualMonths=Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
 return dealerships.filter(d=>!d.historical_only&&d.reporting_enabled!==false).map(d=>{
  const own=records.filter(r=>r.dealership_id===d.id&&r.as_of<=asOf),start=d.joined_group_month||'0000-01';
  const departments={};
  for(const [id,def]of Object.entries(PILOTAGE_DEPARTMENTS)){
   const monthly=m=>{
    if(m<start)return {outsideGroup:true,actual:null,goal:null,source:'Hors groupe',asOf:null};
    const selected=own.filter(r=>r.section===def.section&&r.as_of.startsWith(m)),final=selected.filter(r=>r.kind==='monthly_final'&&r.data?.hasActual!==false&&isNumber(r.data?.values?.[def.metric])).sort((a,b)=>a.as_of.localeCompare(b.as_of)).at(-1);
    const live=['vn','vo'].includes(id)?selected.filter(r=>r.kind==='month_to_date'&&r.data?.hasActual!==false&&isNumber(r.data?.values?.[def.metric])).sort((a,b)=>a.as_of.localeCompare(b.as_of)).at(-1):null;
    const historic=final||live,official=latestOfficial(submissions,d.id,m,def.section,asOf),source=official?.source||(historic?(final?'Téléprésence · mois final':'Téléprésence · mois à date'):'Résultat non renseigné');
    const actual=official?official.values[['vn','vo'].includes(id)?'retailUnits':def.metric]:historic?.data.values[def.metric];
    const explicit=targets.find(t=>t.dealership_id===d.id&&t.section===def.section&&t.month===m),historyTarget=selected.filter(r=>isNumber(r.data?.values?.target)).sort((a,b)=>a.as_of.localeCompare(b.as_of)).at(-1)?.data.values.target;
    const goal=explicit?explicit.values?.[def.metric]:['vn','vo'].includes(id)?historyTarget:null;
    return {actual:isNumber(actual)?actual:null,goal:isNumber(goal)?goal:null,source,goalSource:explicit?.source||(isNumber(historyTarget)?'Objectif Téléprésence':null),asOf:official?.asOf||historic?.as_of||null,partial:official?.partial===true,outsideGroup:false};
   };
   const active=annualMonths.filter(m=>m>=start),included=active.filter(m=>Number(m.slice(5))<=cutoff),current=monthly(month),yearRows=included.map(monthly),goalRows=active.map(monthly);
   const annual={actual:sumKnown(yearRows.map(r=>r.actual)),goal:sumKnown(goalRows.map(r=>r.goal)),actualExpected:included.length,actualKnown:yearRows.filter(r=>isNumber(r.actual)).length,goalExpected:active.length,goalKnown:goalRows.filter(r=>isNumber(r.goal)).length,
    missingMonths:included.filter((m,i)=>!isNumber(yearRows[i].actual)),asOf:yearRows.map(r=>r.asOf).filter(Boolean).sort().at(-1)||null};
   annual.complete=annual.actualExpected>0&&annual.actualKnown===annual.actualExpected&&annual.goalKnown===annual.goalExpected&&!yearRows.some(r=>r.partial);
   departments[id]={...def,...current,monthProgress:{...goalProgress(current.actual,current.goal),partial:current.partial===true},annual,annualProgress:{...goalProgress(annual.actual,annual.goal,{complete:annual.actualKnown>0&&annual.goalKnown===annual.goalExpected}),partial:!annual.complete}};
  }
  return {...d,departments};
 });
}
export function aggregatePilotage(rows,id){
 const parts=rows.map(r=>r.departments[id]).filter(p=>!p.outsideGroup),annual=parts.map(p=>p.annual),actualKnown=parts.filter(p=>isNumber(p.actual)).length,goalKnown=parts.filter(p=>isNumber(p.goal)).length;
 const current={actual:sumKnown(parts.map(p=>p.actual)),goal:sumKnown(parts.map(p=>p.goal)),actualKnown,goalKnown,expected:parts.length};
 const y={actual:sumKnown(annual.map(a=>a.actual)),goal:sumKnown(annual.map(a=>a.goal)),actualKnown:annual.reduce((n,a)=>n+a.actualKnown,0),actualExpected:annual.reduce((n,a)=>n+a.actualExpected,0),goalKnown:annual.reduce((n,a)=>n+a.goalKnown,0),goalExpected:annual.reduce((n,a)=>n+a.goalExpected,0)};
 return {...PILOTAGE_DEPARTMENTS[id],...current,monthProgress:{...goalProgress(current.actual,current.goal,{complete:parts.length>0&&actualKnown>0&&goalKnown===parts.length}),partial:actualKnown<parts.length||parts.some(p=>p.partial)},annual:y,annualProgress:{...goalProgress(y.actual,y.goal,{complete:parts.length>0&&y.actualKnown>0&&y.goalKnown===y.goalExpected}),partial:!annual.every(a=>a.complete)},asOf:parts.map(p=>p.asOf).filter(Boolean).sort().at(-1)||null};
}
export function taskErrors(task){
 const errors=[];if(!task?.title?.trim()||task.title.trim().length>160)errors.push('Inscrivez un titre de 1 à 160 caractères.');
 if(!Object.values(PILOTAGE_DEPARTMENTS).some(d=>d.section===task?.section))errors.push('Choisissez un département.');
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(task?.dealership_id||''))errors.push('Choisissez une concession.');
 const date=task?.due_date;if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date<'2000-01-01'||date>'2199-12-31')errors.push('Indiquez une échéance valide.');
 if((task.description||'').length>3000)errors.push('La description est limitée à 3 000 caractères.');return errors;
}
export function taskSummary(tasks,asOf=torontoToday()){
 const open=tasks.filter(t=>!['done','cancelled'].includes(t.status));return {open:open.length,overdue:open.filter(t=>t.due_date<asOf).length,blocked:open.filter(t=>t.status==='blocked').length,done:tasks.filter(t=>t.status==='done').length};
}
export function managementPermissions(access,dealershipId,section){
 const own=access?.memberships?.find(m=>m.dealership_id===dealershipId&&m.reporting_enabled!==false),supervisor=!!own&&['dg','admin'].includes(own.role),director=own?.role==='director'&&own.sections?.includes(section);
 return {canCreate:supervisor,canEdit:supervisor,canUpdate:supervisor||director};
}
