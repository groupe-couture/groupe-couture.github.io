import {dashboardRows,demoReportSet,REPORT_LABELS,sortGroupRows} from './dashboard-model.mjs?v=1.21.0';
import {latestOfficialSubmissions,officialYearToDate,SECTIONS,STATUS_LABELS} from './reporting.mjs?v=1.21.0';
import {completionCounts,inGroupSubmissions,joinedMonths,groupEntryLabel} from './group-membership.mjs?v=1.21.0';
import {aadPeriodLabel,aadPeriodNote} from './aad-period.mjs?v=1.21.0';
export const REPORT_DEPARTMENTS={
 vn:{label:'Véhicules neufs',section:'vente:VN',columns:[['units','Ventes neuf','count',50],['vehicleAverage','Moy. profit véhicule','money',92],['financeAverage','Moy. profit F&I','money',89],['inventory','Inventaire','count',65],['coverage','Mois d’inventaire','ratio',84]]},
 vo:{label:'Véhicules d’occasion',section:'vente:VO',columns:[['units','Ventes détail','count',55],['wholesaleUnits','Wholesale','count',55],['vehicleAverage','Moy. profit véhicule','money',90],['financeAverage','Moy. profit F&I','money',85],['inventory','Inventaire','count',62],['coverage','Mois d’inventaire','ratio',80]]},
 service:{label:'Service',section:'service:all',columns:[['hours','Heures vendues','decimal',66],['revenue','Chiffre d’affaires','money',90],['profit','Profit brut','money',80],['margin','Marge brute','percent',64],['rate','Taux effectif','money',75],['productivity','Productivité','percent',68],['efficiency','Efficacité','percent',65]]},
 parts:{label:'Pièces',section:'piece:all',columns:[['revenue','Chiffre d’affaires','money',110],['profit','Profit brut','money',100],['margin','Marge brute','percent',80],['invoices','Factures','count',80]]}
};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const knownSum=values=>values.every(finite)?Number(values.reduce((n,v)=>n+BigInt(Math.round(v*100)),0n))/100:null;
const divide=(a,b,multiplier=1)=>finite(a)&&finite(b)&&b>0?a/b*multiplier:null;
export function previousMonth(month){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mois invalide.');
 const d=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-2,1));
 return d.toISOString().slice(0,7);
}
export function inventoryCoverage(inventory,previousSales){return finite(inventory)&&inventory>=0?divide(inventory,previousSales):null;}
export function salesDepartment(values,{stock=null,reference=null,stockMonth=null}={},occasion=false){
 const v=values||{},inventory=stock?.inventory??null,previousSales=reference?.retailUnits??null;
 const vehicleUnits=occasion?knownSum([v.retailUnits,v.wholesaleUnits]):v.retailUnits??null;
 const vehicleProfit=occasion?knownSum([v.retailVehicleProfit,v.wholesaleProfit]):v.retailVehicleProfit??null;
 return {hasOfficial:values!==null&&values!==undefined,units:v.retailUnits??null,wholesaleUnits:occasion?v.wholesaleUnits??null:0,vehicleUnits,vehicleProfit,financeProfit:v.financeProfit??null,
  vehicleAverage:divide(vehicleProfit,vehicleUnits),financeAverage:divide(v.financeProfit,v.retailUnits),inventory,previousSales,coverage:inventoryCoverage(inventory,previousSales),stockMonth,
  referenceMonth:stockMonth?previousMonth(stockMonth):null,coverageReason:!finite(inventory)?'Inventaire manquant':!finite(previousSales)?'Ventes du mois précédent manquantes':previousSales===0?'Aucune vente au mois précédent':null};
}
export function fixedDepartment(values,id){
 const v=values||{},x={hasOfficial:values!==null&&values!==undefined,revenue:v.revenue??null,profit:v.profit??null,margin:divide(v.profit,v.revenue,100)};
 if(id==='service')return {...x,hours:v.hours??null,ros:v.ros??null,presence:v.presence??null,clocked:v.clocked??null,rate:divide(v.revenue,v.hours),productivity:divide(v.clocked,v.presence,100),efficiency:divide(v.hours,v.clocked,100)};
 return {...x,invoices:v.invoices??null};
}
export function departmentDashboardRows(dealers,data,{kind='weekly',year=2026,month=10}={}){
 data={...data,submissions:inGroupSubmissions(data.submissions,dealers)};
 const selected=String(year)+'-'+String(month).padStart(2,'0'),base=dashboardRows(dealers,data,{kind,year,month});
 const monthly=latestOfficialSubmissions(data.submissions,{kind:'monthly_final'});
 const current=latestOfficialSubmissions(data.submissions,{kind:kind==='ytd'?'monthly_final':kind}).filter(s=>kind==='ytd'?s.snapshot.endDate.slice(0,7)<=selected&&s.snapshot.endDate.slice(0,4)===String(year):s.snapshot.endDate.slice(0,7)===selected);
 const aad=base[0]?.aad,throughMonth=aad?.throughMonth?Number(aad.throughMonth.slice(5)):null;
 const annual=kind==='ytd'&&throughMonth?officialYearToDate(data.submissions,year,{throughMonth,joinedMonths:joinedMonths(dealers)}):[];
 return base.map(row=>{
  const own=current.filter(s=>s.dealership_id===row.id&&(kind==='ytd'?!!aad.throughMonth&&s.snapshot.endDate.slice(0,7)<=aad.throughMonth:!row.periodEnd||s.snapshot.endDate===row.periodEnd)),departments={};
  for(const [id,def]of Object.entries(REPORT_DEPARTMENTS)){
   const snapshot=own.filter(s=>Object.hasOwn(s.snapshot.sections||{},def.section)).at(-1)?.snapshot;
   const annualGroup=kind==='ytd'?annual.find(g=>g.dealershipId===row.id&&g.section===def.section):null;
   const values=kind==='ytd'?annualGroup?.values??null:snapshot?.sections?.[def.section]?.data?.values??null;
   if(id==='vn'||id==='vo'){
    const stock=snapshot?.sections?.[def.section]?.data?.values??null,stockMonth=snapshot?.endDate.slice(0,7)??null;
    const reference=stockMonth?monthly.find(s=>s.dealership_id===row.id&&s.snapshot.endDate.slice(0,7)===previousMonth(stockMonth))?.snapshot.sections?.[def.section]?.data?.values??null:null;
    departments[id]=salesDepartment(values,{stock,stockMonth,reference},id==='vo');
   }else departments[id]=fixedDepartment(values,id);
   departments[id].includedMonths=annualGroup?.months||[];departments[id].outsideGroup=row.outsideGroup;departments[id].missingMonths=annualGroup?.missingMonths||[];
   departments[id].missingFields=values?SECTIONS[def.section].fields.filter(key=>!finite(values[key])):[];
   departments[id].partial=departments[id].hasOfficial&&(annualGroup?.partial===true||departments[id].missingFields.length>0);
  }
  return {...row,departments};
 });
}
export function departmentTotals(rows,id){
 if(!Object.hasOwn(REPORT_DEPARTMENTS,id))throw Error('Département invalide.');
 const parts=rows.map(r=>r.departments[id]).filter(d=>d.hasOfficial),sum=key=>parts.length?knownSum(parts.map(d=>d[key])):null;
 if(id==='vn'||id==='vo'){
  const inventory=sum('inventory'),previousSales=sum('previousSales'),sameMonth=new Set(parts.map(d=>d.stockMonth)).size<=1;
  return {...completionCounts(rows,id),hasOfficial:parts.length>0,units:sum('units'),wholesaleUnits:sum('wholesaleUnits'),vehicleAverage:divide(sum('vehicleProfit'),sum('vehicleUnits')),financeAverage:divide(sum('financeProfit'),sum('units')),inventory,previousSales,coverage:sameMonth?inventoryCoverage(inventory,previousSales):null,coverageReason:!sameMonth?'Photos d’inventaire de mois différents':!finite(inventory)?'Inventaire manquant':!finite(previousSales)?'Référence incomplète':previousSales===0?'Aucune vente au mois précédent':null};
 }
 return {...completionCounts(rows,id),hasOfficial:parts.length>0,revenue:sum('revenue'),profit:sum('profit'),margin:divide(sum('profit'),sum('revenue'),100),hours:sum('hours'),invoices:sum('invoices'),rate:divide(sum('revenue'),sum('hours')),productivity:divide(sum('clocked'),sum('presence'),100),efficiency:divide(sum('hours'),sum('clocked'),100)};
}
const searchable=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim().replace(/\s+/g,' ');
export function filterDashboardRows(rows,{scope='all',search='',department=null}={}){
 const query=searchable(search);
 return rows.filter(r=>{
  const received=department?r.departments?.[department]?.hasOfficial===true||r.departments?.[department]?.outsideGroup===true:r.hasOfficial||r.outsideGroup;
  const completed=department?r.departments?.[department]?.outsideGroup===true||received&&!r.departments?.[department]?.partial:received;
  return (scope==='all'||scope==='received'&&received||scope==='pending'&&!completed)&&searchable(r.name).includes(query);
 });
}
const FORMATTERS={money:new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',minimumFractionDigits:2,maximumFractionDigits:2}),count:new Intl.NumberFormat('fr-CA',{maximumFractionDigits:0}),ratio:new Intl.NumberFormat('fr-CA',{minimumFractionDigits:2,maximumFractionDigits:2}),percent:new Intl.NumberFormat('fr-CA',{minimumFractionDigits:1,maximumFractionDigits:1}),decimal:new Intl.NumberFormat('fr-CA',{maximumFractionDigits:2})};
export function formatReportValue(value,format){
 if(!finite(value))return '—';
 return (FORMATTERS[format]||FORMATTERS.decimal).format(value)+(format==='percent'?' %':'');
}
export function reportStateLabel(row,id){const part=row.departments[id];if(part.outsideGroup)return 'Complété — hors groupe';if(row.aad&&part.hasOfficial)return part.partial?'AAD partiel':row.historical&&!part.sourceConfirmed?'AAD · à confirmer':'AAD disponible';if(row.historical)return !part.hasOfficial?'Aucun résultat fourni':part.partial?'Import partiel':part.sourceConfirmed?'Balance déclarée au fichier':'Importé · à confirmer';return part.hasOfficial?(part.partial?'Cumul / données partiels':row.correcting?'Soumis / correction':'Soumis au groupe'):STATUS_LABELS[row.status]||'À recevoir';}
export function dashboardCsv(rows,{department,month,kind,periodEnd=null,simulated=true,historical=false,definitions=REPORT_DEPARTMENTS,totals=null,notes=[]}){
 if(!Object.hasOwn(REPORT_DEPARTMENTS,department)||!Object.hasOwn(REPORT_LABELS,kind)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Paramètres CSV invalides.');
 const quote=value=>'"'+String(/^[=+\-@\t\r]/.test(String(value??''))?"'"+value:value??'').replaceAll('"','""')+'"',def=definitions[department];
 const data=[[historical?'HISTORIQUE GOOGLE SHEETS — À CONFIRMER':simulated?'DONNÉES SIMULÉES':'RAPPORTS SOUMIS AU GROUPE',def.label,REPORT_LABELS[kind],month,periodEnd||''],...(kind==='ytd'?[[aadPeriodLabel(rows[0]?.aad),aadPeriodNote(rows[0]?.aad)]]:[]),...(historical?[['Mois à date et mois final : moyenne des concessions renseignées, comme Téléprésence. AAD pondéré par les livraisons renseignées. Wholesale séparé.'],['Inventaire : photo datée; ventes de référence du mois précédent. Aucune validation DG automatique.']]:[]),...notes.map(note=>[note]),['Concession',...def.columns.map(([,label])=>label),'Rapport','Photo inventaire','Référence ventes','Balance référence','Intégration au groupe','Mois inclus dans l’AAD'],...sortGroupRows(rows).map(row=>{const p=row.departments[department];return [row.name,...def.columns.map(([key,,type])=>formatReportValue(p[key],type)),reportStateLabel(row,department),p.stockAsOf||p.stockMonth||'',p.referenceMonth||'',historical&&p.referenceMonth?(p.referenceConfirmed?'Déclarée':'À confirmer'):'',groupEntryLabel(row),(p.includedMonths||[]).join(', ')];})];
 if(totals)data.push([totals.partialTotals?'Total connu · partiel':'Total importé',...def.columns.map(([key,,type])=>formatReportValue(totals[key],type)),'','','','','','']);
 return '\ufeff'+data.map(r=>r.map(quote).join(';')).join('\r\n');
}
export function departmentNotes(id){
 if(id==='vn'||id==='vo')return [
  'Mois d’inventaire = inventaire à la date du rapport ÷ ventes au détail du mois précédent. Exemple : 60 ÷ 30 = 2,00 mois.',
  id==='vo'?'Moyenne véhicule : détail + wholesale, après frais. Moyenne F&I : ventes au détail seulement.':'Moyennes de profit véhicule et F&I : profits correspondants ÷ ventes au détail.',
  'Le cumul annuel utilise les mois finaux. L’inventaire reste la dernière photo disponible; il n’est jamais additionné. Une référence absente ou sans ventes affiche « — ».'
 ];
 return id==='service'?['Taux effectif = chiffre d’affaires ÷ heures vendues. Productivité = heures pointées ÷ présence. Efficacité = heures vendues ÷ heures pointées.','Les moyennes et pourcentages du groupe sont recalculés à partir des totaux des concessions soumises.']:['Marge brute = profit brut ÷ chiffre d’affaires. Les données absentes restent « — ».','Le total groupe comprend uniquement les départements des versions soumises.'];
}
export function selectedDepartments(ids){
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>!Object.hasOwn(REPORT_DEPARTMENTS,id)))throw Error('Sélectionnez au moins un département valide.');
 return Object.keys(REPORT_DEPARTMENTS).filter(id=>ids.includes(id));
}
export function demoDashboardReports(dealers,{kind='weekly',month='2026-10',periodEnd=null}={}){
 let periods=[],submissions=[];
 const months=kind==='ytd'?Array.from({length:Number(month.slice(5))},(_,i)=>month.slice(0,4)+'-'+String(i+1).padStart(2,'0')):[month];
 for(const m of months){const data=demoReportSet(dealers,{kind:kind==='ytd'?'monthly_final':kind,month:m,periodEnd:kind==='weekly'?periodEnd:null});periods=data.periods;submissions.push(...data.submissions);}
 const prev=previousMonth(month),reference=demoReportSet(dealers,{kind:'monthly_final',month:prev});
 if(!submissions.some(s=>s.snapshot.kind==='monthly_final'&&s.snapshot.endDate.slice(0,7)===prev))submissions.push(...reference.submissions);
 // Exemple demandé : 30 ventes au mois précédent, puis 60 véhicules en stock.
 const sample=dealers[2]?.id;
 for(const s of submissions)if(s.dealership_id===sample){
  if(s.snapshot.endDate.slice(0,7)===month)s.snapshot.sections['vente:VO'].data.values.inventory=60;
  if(s.snapshot.kind==='monthly_final'&&s.snapshot.endDate.slice(0,7)===prev)s.snapshot.sections['vente:VO'].data.values.retailUnits=30;
 }
 return {periods,submissions};
}
