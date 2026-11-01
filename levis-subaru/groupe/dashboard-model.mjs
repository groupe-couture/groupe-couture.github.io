import {latestOfficialSubmissions,officialYearToDate,reportingWeeks} from './reporting.mjs?v=1.19.2';
import {outsideGroup,inGroupSubmissions,joinedMonths} from './group-membership.mjs?v=1.19.2';
import {officialAadPeriod} from './aad-period.mjs?v=1.19.2';

export const REPORT_LABELS={weekly:'Hebdomadaire',monthly_final:'Mois final',ytd:'AAD (année à date)',month_to_date:'Mois à date'};
export const STATES={draft:'En préparation',validated:'Validé par le DG',submitted:'Soumis au groupe'};
const dealershipOrder=new Intl.Collator('fr-CA',{sensitivity:'base',numeric:true});
export function sortGroupRows(rows){return [...rows].sort((a,b)=>dealershipOrder.compare(a.name||'',b.name||'')||dealershipOrder.compare(a.id||'',b.id||''));}
const sum=(rows,key)=>rows.every(r=>Number.isFinite(r[key]))?Number(rows.reduce((n,r)=>n+BigInt(Math.round(r[key]*100)),0n))/100:null;
const knownSum=values=>values.every(Number.isFinite)?Number(values.reduce((n,v)=>n+BigInt(Math.round(v*100)),0n))/100:null;
export function dashboardDealerships(concessions){
 return [{id:'levis-subaru',name:'Lévis Subaru',employees:[]},...concessions].map(c=>({id:c.id,name:c.name}));
}
// Jeux de démonstration dédiés. Aucune lecture ou écriture d'une base réelle.
export function demoReportSet(dealers,{kind='weekly',month='2026-10',periodEnd=null}={}){
 if(!['weekly','monthly_final'].includes(kind)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Période invalide.');
 const periods=[],submissions=[];
 const weeks=reportingWeeks(month),week=weeks.find(w=>w.periodEnd===(periodEnd||weeks.at(-1).periodEnd));
 if(kind==='weekly'&&!week)throw Error('Semaine invalide.');
 const end=kind==='weekly'?week.periodEnd:weeks.at(-1).periodEnd;
 dealers.forEach((d,i)=>{
  const status=i%7===0?'draft':i%7===1?'validated':'submitted',id=d.id+'-'+kind+'-'+end;
  const correcting=i===9;
  periods.push({id,dealership_id:d.id,kind,endDate:end,status:correcting?'draft':status,completed:status==='draft'||correcting?3:5,total:5,balanceWithStatement:status==='submitted'&&!correcting&&kind==='monthly_final',correcting});
  if(status!=='submitted')return;
  const factor=kind==='monthly_final'?4:1,vn=8+i%9,vo=5+i%6,wholesale=1+i%3;
  const values={
   'vente:VN':{retailUnits:vn*factor,retailVehicleProfit:(vn*1850+i*73)*factor,financeProfit:vn*1120*factor,inventory:45+i*3,walk:vn*3*factor,leads:vn*5*factor,phone:vn*2*factor},
   'vente:VO':{retailUnits:vo*factor,retailVehicleProfit:vo*1675*factor,financeProfit:vo*1050*factor,wholesaleUnits:wholesale*factor,wholesaleProfit:wholesale*680*factor,inventory:22+i,walk:vo*3*factor,leads:vo*6*factor,phone:vo*2*factor},
   'service:all':{hours:(125+i*5)*factor,revenue:(19500+i*780)*factor,profit:(11200+i*440)*factor,ros:(90+i*4)*factor,presence:(170+i*6)*factor,clocked:(151+i*5)*factor},
   'piece:all':{revenue:(24000+i*880)*factor,profit:(6900+i*250)*factor,invoices:(130+i*4)*factor},
   'esthetique:all':{prepared:(12+i%7)*factor,revenue:(2400+i*95)*factor,profit:(1250+i*50)*factor,waiting:2+i%4,rework:1}
  };
  submissions.push({period_id:id,sequence:1,dealership_id:d.id,snapshot:{schemaVersion:1,kind,endDate:end,balanceWithStatement:kind==='monthly_final',sections:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{data:{values:v}}]))}});
 });
 return {periods,submissions};
}
export function dashboardRows(dealers,{periods,submissions},{kind='weekly',year=2026,month=10}={}){
 submissions=inGroupSubmissions(submissions,dealers);
 const selectedMonth=String(year)+'-'+String(month).padStart(2,'0');
 const official=latestOfficialSubmissions(submissions,{kind:kind==='ytd'?'monthly_final':kind,year});
 const aad=kind==='ytd'?officialAadPeriod(dealers,official,selectedMonth):null;
 const annual=aad?.throughMonth?officialYearToDate(submissions,year,{throughMonth:Number(aad.throughMonth.slice(5)),joinedMonths:joinedMonths(dealers)}):[];
 return sortGroupRows(dealers).map(d=>{
  const period=periods.filter(p=>p.dealership_id===d.id&&(!p.kind||p.kind===(kind==='ytd'?'monthly_final':kind))&&(!(p.endDate||p.end_date)||(p.endDate||p.end_date).slice(0,7)===selectedMonth)).sort((a,b)=>(a.endDate||a.end_date||'').localeCompare(b.endDate||b.end_date||'')).at(-1);
  const row={...d,periodId:period?.id??null,periodEnd:period?.endDate||period?.end_date||null,status:period?.status||'missing',completed:period?.completed||0,total:period?.total||5,balance:period?.balanceWithStatement===true,correcting:period?.correcting===true,hasOfficial:false};
  row.aad=aad;row.outsideGroup=outsideGroup(d,aad?.throughMonth||selectedMonth);if(row.outsideGroup){row.status='outside_group';row.total=d.required_sections?.length||4;row.completed=row.total;}
  let values;
  if(kind==='ytd'){
   const groups=annual.filter(g=>g.dealershipId===d.id);if(groups.length)values=Object.fromEntries(groups.map(g=>[g.section,g.values]));
   row.missingMonths=Math.max(0,...groups.map(g=>g.missingMonths.length));
  }else{
   const snapshot=official.filter(s=>s.dealership_id===d.id&&s.snapshot.endDate?.slice(0,7)===selectedMonth&&(!row.periodEnd||s.snapshot.endDate===row.periodEnd)).at(-1)?.snapshot;
   if(snapshot){values=Object.fromEntries(Object.entries(snapshot.sections).map(([k,v])=>[k,v?.data?.values]).filter(([,v])=>v&&typeof v==='object'));row.balance=snapshot.balanceWithStatement===true;}
  }
  if(!values)return {...row,vn:null,vo:null,wholesale:null,vehicleProfit:null,financeProfit:null,service:null,parts:null,totalProfit:null};
  const vn=values['vente:VN']||{},vo=values['vente:VO']||{},service=values['service:all']||{},parts=values['piece:all']||{};
  const vehicleProfit=knownSum([vn.retailVehicleProfit,vo.retailVehicleProfit,vo.wholesaleProfit]),financeProfit=knownSum([vn.financeProfit,vo.financeProfit]);
  return {...row,hasOfficial:true,vn:vn.retailUnits??null,vo:vo.retailUnits??null,wholesale:vo.wholesaleUnits??null,vehicleProfit,financeProfit,service:service.revenue??null,parts:parts.revenue??null,totalProfit:knownSum([vehicleProfit,financeProfit])};
 });
}
export function dashboardTotals(rows){
 const received=rows.filter(r=>r.hasOfficial&&!r.outsideGroup),exempt=rows.filter(r=>r.outsideGroup).length;
 return {received:received.length,dealers:rows.length,exempt,completed:received.length+exempt,pending:rows.length-received.length-exempt,vn:sum(received,'vn'),vo:sum(received,'vo'),wholesale:sum(received,'wholesale'),vehicleProfit:sum(received,'vehicleProfit'),financeProfit:sum(received,'financeProfit'),totalProfit:sum(received,'totalProfit'),service:sum(received,'service'),parts:sum(received,'parts')};
}
