import {dayDistance,validDay} from './preparation-history.mjs?v=1.12';
export const DEPT_FIELDS={
 vente:[['units','Ventes signées','unit'],['vehicleAverage','Profit véhicule moyen ($)','money'],['financeAverage','F&I moyen par véhicule vendu ($)','money'],['inventory','Inventaire','stock'],['walk','Clients walk-in','count'],['leads','Leads Web','count'],['phone','Clients téléphone','count']],
 service:[['hours','Heures vendues','hours'],['revenue','Chiffre d’affaires MO ($)','money'],['profit','Profit brut MO ($)','money'],['ros','Bons de réparation fermés','count'],['presence','Heures de présence des techniciens','hours'],['clocked','Heures pointées sur les travaux','hours']],
 piece:[['revenue','Chiffre d’affaires pièces ($)','money'],['profit','Profit brut pièces ($)','money'],['invoices','Factures de pièces','count']],
 esthetique:[['prepared','Véhicules préparés','count'],['revenue','Chiffre d’affaires esthétique ($)','money'],['profit','Profit brut esthétique ($)','money'],['waiting','Véhicules en attente à la fin','stock'],['rework','Retouches / reprises','count']]
};
export const PLAN_FIELDS={vente:[['units','Ventes signées','unit'],['vehicleAverage','Profit véhicule moyen visé ($)','money'],['financeAverage','F&I moyen visé ($)','money']],service:[['hours','Heures vendues','hours'],['revenue','Chiffre d’affaires MO ($)','money'],['profit','Profit brut MO ($)','money']],piece:[['revenue','Chiffre d’affaires pièces ($)','money'],['profit','Profit brut pièces ($)','money']],esthetique:[['prepared','Véhicules préparés','count'],['delay','Délai moyen maximal de lavage (jours)','days'],['revenue','Chiffre d’affaires ($)','money'],['profit','Profit brut ($)','money']]};
export const number=v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
export function periodsForMonth(month){
 if(!/^\d{4}-\d{2}$/.test(month))return [];const first=month+'-01';if(!validDay(first))return [];
 const d=new Date(first+'T12:00:00Z'),end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).toISOString().slice(0,10);
 let start=first,rows=[];
 while(start<=end){const date=new Date(start+'T12:00:00Z'),delta=(5-date.getUTCDay()+7)%7;date.setUTCDate(date.getUTCDate()+delta);const dueOn=date.toISOString().slice(0,10),periodEnd=dueOn>end?end:dueOn;rows.push({month,periodStart:start,periodEnd,dueOn});const next=new Date(periodEnd+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);start=next.toISOString().slice(0,10);}
 return rows;
}
export const reportId=(d,kind,p)=>`${d}_${kind||'all'}_${p.month}_${p.periodEnd}`;
export const planId=(d,kind,month)=>`${d}_${kind||'all'}_${month}`;
export function reportErrors(r,asOf){
 const errors={};if(!Object.hasOwn(DEPT_FIELDS,r.department)){errors.department='Département invalide.';return errors;}
 const period=periodsForMonth(r.month).find(p=>p.periodEnd===r.periodEnd);if(!period||period.periodStart!==r.periodStart||period.dueOn!==r.dueOn)errors.period='Période invalide.';
 if(period&&period.periodEnd>asOf)errors.period='Cette période n’est pas encore terminée.';
 if((r.department==='vente'&&!['VN','VO'].includes(r.kind))||(r.department!=='vente'&&r.kind!=='all'))errors.kind='Choisissez Neuf ou Occasion.';
 for(const [key,label,type]of DEPT_FIELDS[r.department]){const n=number(r.values?.[key]);if(n===null)errors[key]=label+' : obligatoire.';else if(type!=='money'&&n<0)errors[key]=label+' : valeur positive requise.';else if(['count','stock','unit'].includes(type)&&!Number.isInteger(n))errors[key]=label+' : nombre entier requis.';}
 if(r.department==='service'&&r.advisors?.length){
  const ids=new Set();for(const a of r.advisors){if(!a.id||!a.name?.trim()||ids.has(a.id))errors.advisors='Chaque aviseur doit être identifié une seule fois.';ids.add(a.id);for(const k of ['revenue','hours','ros'])if(number(a[k])===null||number(a[k])<0||(k==='ros'&&!Number.isInteger(number(a[k]))))errors.advisors='Complétez les montants, heures et bons de chaque aviseur (0 si aucune activité).';}
  for(const k of ['revenue','hours','ros'])if(Math.abs(r.advisors.reduce((n,a)=>n+(number(a[k])||0),0)-(number(r.values?.[k])||0))>.001)errors.advisors='Les totaux du service doivent correspondre à la ventilation par aviseur.';
 }
 return errors;
}
export function saleErrors(s){const e={};for(const k of ['stock','client','model','sellerId','sellerName'])if(!s[k]?.trim())e[k]='Champ obligatoire.';if(!validDay(s.saleDate)||s.saleDate>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))e.saleDate='Date de vente invalide.';if(!['VN','VO'].includes(s.type))e.type='Catégorie invalide.';if(!['comptant','financement','location'].includes(s.payment)||(s.type==='VO'&&s.payment==='location'))e.payment='Mode d’achat invalide.';if(s.type==='VN'&&!['essence','EV'].includes(s.energy))e.energy='Choisissez EV ou essence.';if(!['Vendu','Livré','Annulée'].includes(s.status))e.status='État invalide.';return e;}
export function salesSummary(sales,targets,type,month,asOf){const y=month.slice(0,4),cutoff=y<asOf.slice(0,4)?y+'-12-31':y===asOf.slice(0,4)?asOf:'';const active=sales.filter(s=>s.type===type&&s.status!=='Annulée');const ids=new Set([...active.map(s=>s.sellerId),...targets.filter(t=>t.type===type&&t.month===month).map(t=>t.sellerId)]);return [...ids].map(id=>{const records=active.filter(s=>s.sellerId===id),goal=targets.find(t=>t.type===type&&t.month===month&&t.sellerId===id);return {sellerId:id,sellerName:records.at(-1)?.sellerName||goal?.sellerName||id,goal:goal?.goal??null,month:records.filter(s=>s.saleDate?.slice(0,7)===month).sort((a,b)=>a.saleDate.localeCompare(b.saleDate)),ytd:cutoff?records.filter(s=>s.saleDate?.slice(0,4)===y&&s.saleDate<=cutoff).length:0};}).sort((a,b)=>a.sellerName.localeCompare(b.sellerName,'fr'));}
const sumKnown=values=>{const valid=values.filter(Number.isFinite);return valid.length?valid.reduce((a,b)=>a+b,0):null;};
export function summarizeReports(reports,department,kind='all'){
 const rows=reports.filter(r=>r.department===department&&(r.kind||'all')===kind&&r.submitted===true).sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));const values={};
 for(const [key,,type]of DEPT_FIELDS[department])values[key]=type==='stock'?number(rows.at(-1)?.values?.[key]):sumKnown(rows.map(r=>number(r.values?.[key])));
 if(department==='vente'){
  const aggregate=key=>sumKnown(rows.map(r=>number(r.values?.units)!==null&&number(r.values?.[key])!==null?number(r.values.units)*number(r.values[key]):null));
  values.vehicleProfit=aggregate('vehicleAverage');values.financeProfit=aggregate('financeAverage');values.vehicleAverage=values.units>0&&values.vehicleProfit!==null?values.vehicleProfit/values.units:null;values.financeAverage=values.units>0&&values.financeProfit!==null?values.financeProfit/values.units:null;values.totalProfit=values.vehicleProfit!==null&&values.financeProfit!==null?values.vehicleProfit+values.financeProfit:null;
 }
 values.margin=values.revenue>0&&values.profit!==null?values.profit/values.revenue*100:null;values.rate=values.hours>0&&values.revenue!==null?values.revenue/values.hours:null;values.productivity=values.presence>0&&values.clocked!==null?values.clocked/values.presence*100:null;values.efficiency=values.clocked>0&&values.hours!==null?values.hours/values.clocked*100:null;values.utilization=values.presence>0&&values.hours!==null?values.hours/values.presence*100:null;
 return {values,rows,count:rows.length};
}
export function summarizePlans(plans,department,kind='all'){
 const rows=plans.filter(p=>p.department===department&&(p.kind||'all')===kind),values={};
 for(const [key]of PLAN_FIELDS[department])values[key]=sumKnown(rows.map(p=>number(p.values?.[key])));
 if(department==='vente')for(const key of ['vehicleAverage','financeAverage']){const pairs=rows.filter(p=>number(p.values?.[key])!==null&&number(p.values?.units)!==null);const n=sumKnown(pairs.map(p=>number(p.values.units)));values[key]=n>0?pairs.reduce((s,p)=>s+number(p.values.units)*number(p.values[key]),0)/n:null;}
 if(department==='esthetique'){const pairs=rows.filter(p=>number(p.values?.delay)!==null&&number(p.values?.prepared)>0);const n=sumKnown(pairs.map(p=>number(p.values.prepared)));values.delay=n>0?pairs.reduce((s,p)=>s+number(p.values.prepared)*number(p.values.delay),0)/n:null;}
 if(department==='vente'){
  for(const [avg,total]of [['vehicleAverage','vehicleProfit'],['financeAverage','financeProfit']])values[total]=sumKnown(rows.map(p=>number(p.values?.units)!==null&&number(p.values?.[avg])!==null?number(p.values.units)*number(p.values[avg]):null));
  values.totalProfit=values.vehicleProfit!==null&&values.financeProfit!==null?values.vehicleProfit+values.financeProfit:null;
 }
 values.margin=values.revenue>0&&values.profit!==null?values.profit/values.revenue*100:null;values.rate=values.hours>0&&values.revenue!==null?values.revenue/values.hours:null;
 return {values,count:rows.length};
}
export function monthsForPeriod(month,mode,asOf){const year=month.slice(0,4);if(mode==='month')return [month];const max=year<asOf.slice(0,4)?12:year===asOf.slice(0,4)?Number(asOf.slice(5,7)):0;return Array.from({length:max},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));}
// v1.10 stored sales profits for VN + VO together: retain once, never invent a split.
export function legacySalesSummary(data,reports,months,asOf){
 const rows=months.map(month=>({month,values:data['vente_'+month]||{}})).filter(({month,values})=>!reports.some(r=>r.department==='vente'&&r.month===month&&r.submitted===true&&r.periodEnd<=asOf)&&[values.vehicleProfit,values.financeProfit].some(Number.isFinite));
 return {rows,profit:sumKnown(rows.map(({values})=>sumKnown([number(values.vehicleProfit),number(values.financeProfit)]))),partial:rows.some(({values})=>number(values.vehicleProfit)===null||number(values.financeProfit)===null)};
}
