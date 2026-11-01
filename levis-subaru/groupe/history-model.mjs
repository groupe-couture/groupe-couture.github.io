import {sortGroupRows} from './dashboard-model.mjs?v=1.19.0';
import {REPORT_DEPARTMENTS,previousMonth,inventoryCoverage} from './department-reporting.mjs?v=1.19.0';
import {groupStartMonth,outsideGroup,completionCounts} from './group-membership.mjs?v=1.19.0';
import {historyAadPeriod} from './aad-period.mjs?v=1.19.0';
import {SERVICE_ANALYSES,SERVICE_FLOW_KEYS,SERVICE_SNAPSHOT_KEYS,serviceDerived,SERVICE_NOTES} from './service-metrics.mjs?v=1.19.0';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const sum=vs=>vs.length&&vs.every(finite)?vs.reduce((a,b)=>a+b,0):null;
const divide=(a,b,m=1)=>finite(a)&&finite(b)&&b>0?a/b*m:null;
export const HISTORY_DEPARTMENTS={...REPORT_DEPARTMENTS,
 service:{...REPORT_DEPARTMENTS.service,columns:SERVICE_ANALYSES.organisation.columns},
 parts:{...REPORT_DEPARTMENTS.parts,columns:REPORT_DEPARTMENTS.parts.columns.filter(([k])=>k!=='invoices')}
};
export function historyDefinitions(serviceAnalysis='organisation'){return {...HISTORY_DEPARTMENTS,service:{...HISTORY_DEPARTMENTS.service,columns:(SERVICE_ANALYSES[serviceAnalysis]||SERVICE_ANALYSES.organisation).columns}};}
export function weightedReportedAverage(inputs,key){
 if(!inputs.length||inputs.some(v=>!finite(v.units)||v.units<0||v.units>0&&!finite(v[key])))return null;
 const units=inputs.reduce((n,v)=>n+v.units,0);return units>0?inputs.reduce((n,v)=>n+(v.units>0?v.units*v[key]:0),0)/units:null;
}
export function historyDates(records,month){return [...new Set(records.filter(r=>r.kind==='month_to_date'&&r.as_of.slice(0,7)===month).map(r=>r.as_of))].sort();}
export function defaultHistorySelection(records){
 const actual=records.filter(r=>r.data.hasActual),latest=actual.map(r=>r.as_of).sort().at(-1),month=latest?.slice(0,7);
 if(!month)return null;
 const dates=historyDates(records,month),complete=dates.filter(date=>{
  const rows=records.filter(r=>r.kind==='month_to_date'&&r.as_of===date&&['vente:VN','vente:VO'].includes(r.section));
  return rows.length>0&&rows.every(r=>finite(r.data.values.units));
 });
 return {month,kind:dates.length?'month_to_date':'monthly_final',periodEnd:complete.at(-1)||dates.at(-1)||latest};
}
export function historyDashboardRows(dealers,records,{kind='monthly_final',month='2026-10',periodEnd=null}={}){
 const aad=kind==='ytd'?historyAadPeriod(dealers,records,month):null,effectiveMonth=aad?.throughMonth||month;
 const end=kind==='month_to_date'?periodEnd:month+'-31',year=month.slice(0,4);
 return sortGroupRows(dealers).map(dealer=>{
  const start=groupStartMonth(dealer),excluded=outsideGroup(dealer,effectiveMonth),own=records.filter(r=>r.dealership_id===dealer.id&&(!start||r.as_of.slice(0,7)>=start)),departments={};
  const firstMonth=start?start.slice(0,4)<year?year+'-01':start:own.filter(r=>r.kind==='monthly_final'&&r.as_of.slice(0,4)===year).map(r=>r.as_of.slice(0,7)).sort()[0];
  const expected=firstMonth&&(!aad||aad.throughMonth)?Array.from({length:Math.max(0,Number(effectiveMonth.slice(5))-Number(firstMonth.slice(5))+1)},(_,i)=>year+'-'+String(Number(firstMonth.slice(5))+i).padStart(2,'0')):[];
  for(const [id,def]of Object.entries(REPORT_DEPARTMENTS)){
   const candidates=own.filter(r=>r.section===def.section&&r.kind===(kind==='month_to_date'?'month_to_date':'monthly_final')&&
    (kind==='ytd'?!!aad.throughMonth&&r.as_of.slice(0,4)===year&&r.as_of.slice(0,7)<=aad.throughMonth:kind==='month_to_date'?r.as_of===end:r.as_of.slice(0,7)===month));
   const selected=candidates.filter(r=>r.data.hasActual).sort((a,b)=>a.as_of.localeCompare(b.as_of)),last=selected.at(-1),v=last?.data.values||{},annual=kind==='ytd',values=key=>selected.map(r=>r.data.values[key]);
   const missingMonths=annual?expected.filter(m=>!selected.some(r=>r.as_of.slice(0,7)===m)):[];
   const part={historical:true,outsideGroup:excluded,hasOfficial:selected.length>0&&!excluded,missingMonths,includedMonths:annual?selected.map(r=>r.as_of.slice(0,7)):[],sourceConfirmed:selected.length>0&&selected.every(r=>r.source.balance===true),
    issues:[...new Set(selected.flatMap(r=>r.data.issues||[]))],fields:annual?[]:(last||candidates.at(-1))?.data.fields||[],source:(last||candidates.at(-1))?{...(last||candidates.at(-1)).source,sheetId:(last||candidates.at(-1)).source_sheet_id,row:(last||candidates.at(-1)).source_row,asOf:(last||candidates.at(-1)).as_of}:null};
   if(id==='vn'||id==='vo'){
    const inputs=selected.map(r=>r.data.values),stock=excluded?null:own.filter(r=>r.section===def.section&&r.kind==='month_to_date'&&r.as_of<=end&&finite(r.data.values.inventory)&&
     (kind==='month_to_date'?r.as_of===end:annual||r.as_of.slice(0,7)===month)).sort((a,b)=>a.as_of.localeCompare(b.as_of)).at(-1);
    const stockMonth=stock?.as_of.slice(0,7)||null,ref=stockMonth?own.find(r=>r.section===def.section&&r.kind==='monthly_final'&&r.as_of.slice(0,7)===previousMonth(stockMonth)&&r.data.hasActual):null;
    Object.assign(part,{units:annual?sum(values('units')):v.units??null,signed:annual?sum(values('signed')):v.signed??null,
     wholesaleUnits:id==='vo'?(annual?sum(values('wholesaleUnits')):v.wholesaleUnits??null):0,
     vehicleAverage:annual?weightedReportedAverage(inputs,'vehicleAverage'):v.vehicleAverage??null,financeAverage:annual?weightedReportedAverage(inputs,'financeAverage'):v.financeAverage??null,
     averageInputs:inputs.map(x=>({units:x.units,vehicleAverage:x.vehicleAverage,financeAverage:x.financeAverage})),
     inventory:stock?.data.values.inventory??null,stockMonth,stockAsOf:stock?.as_of||null,previousSales:ref?.data.values.units??null,referenceMonth:stockMonth?previousMonth(stockMonth):null,referenceConfirmed:ref?.source.balance===true});
    part.coverage=inventoryCoverage(part.inventory,part.previousSales);
    part.coverageReason=!finite(part.inventory)?'Inventaire non fourni':!finite(part.previousSales)?'Ventes du mois précédent absentes':part.previousSales===0?'Aucune vente au mois précédent':null;
   }else{
    for(const key of id==='service'?SERVICE_FLOW_KEYS:['revenue','profit'])part[key]=annual?sum(values(key)):v[key]??null;
    if(id==='service'){
     for(const key of [...SERVICE_SNAPSHOT_KEYS,'retailGrossPercent','reportedMargin','productivity','efficiency','utilization'])part[key]=v[key]??null;
     Object.assign(part,serviceDerived(part,{annual}));
    }else part.margin=divide(part.profit,part.revenue,100);
   }
   part.partial=part.hasOfficial&&(missingMonths.length>0||part.issues.length>0||(id==='vn'||id==='vo'?[part.units,part.vehicleAverage,part.financeAverage]:kind==='month_to_date'&&id==='service'?[part.advisors,part.openROs,part.technicians]:[part.revenue,part.profit]).some(x=>!finite(x)));
   departments[id]=part;
  }
  return {...dealer,aad,historical:true,outsideGroup:excluded,status:excluded?'outside_group':'imported',hasOfficial:Object.values(departments).some(p=>p.hasOfficial),departments,
   direction:own.find(r=>r.section==='direction:all'&&r.kind===(kind==='month_to_date'?'month_to_date':'monthly_final')&&(kind==='month_to_date'?r.as_of===end:r.as_of.slice(0,7)===month))?.data.fields||[]};
 });
}
export function historyTotals(rows,id){
 const parts=rows.map(r=>r.departments[id]).filter(p=>p.hasOfficial),total=key=>sum(parts.map(p=>p[key])),inputs=parts.flatMap(p=>p.averageInputs||[]);
 const t={hasOfficial:parts.length>0,...completionCounts(rows,id)};
 for(const key of ['units','wholesaleUnits','inventory','previousSales','revenue','profit','hours','presence','clocked','advisors','openROs','technicians','wip'])t[key]=total(key);
 if(id==='service'){
  for(const key of SERVICE_FLOW_KEYS)t[key]=total(key);
  Object.assign(t,serviceDerived(t,{annual:true}));
  for(const key of ['actualClientHourlyRate','postedClientHourlyRate','customerPartsGrossPercent','customerSellingRate','hourlyRate','customerGrossPercent'])t[key]=null;
 }
 t.vehicleAverage=weightedReportedAverage(inputs,'vehicleAverage');t.financeAverage=weightedReportedAverage(inputs,'financeAverage');t.margin=divide(t.profit,t.revenue,100);
 const sameDate=new Set(parts.map(p=>p.stockAsOf)).size===1;
 t.referenceConfirmed=parts.length>0&&parts.every(p=>p.referenceConfirmed);t.coverage=sameDate?inventoryCoverage(t.inventory,t.previousSales):null;t.coverageReason=!sameDate?'Photos d’inventaire de dates différentes':!finite(t.inventory)?'Inventaire incomplet':!finite(t.previousSales)?'Référence incomplète':'Aucune vente au mois précédent';
 return t;
}
export function historyNotes(id){return [
 'Historique importé, sans validation automatique. « Balance déclarée » reprend la case source. Les mois hors groupe sont complétés sans chiffres et exclus des résultats.',
 id==='vn'||id==='vo'?'Moyennes déclarées au détail, F&I séparé; wholesale exclu des moyennes. Groupe et cumul : moyennes pondérées par les livraisons, à partir des moyennes arrondies du fichier. Aucun profit total de détail reconstitué.':'Les champs absents ou en erreur restent « — ». Les BR ouverts et les effectifs sont des photos, jamais des cumuls.',
 id==='vn'||id==='vo'?'Inventaire VO : somme des quatre tranches d’âge connues. Photo datée ÷ livraisons du mois précédent. Astérisque (*) : référence non balancée à confirmer. Aucun inventaire VN fourni.':'Le cumul utilise les mois finaux seulement. Les suivis du mois à date ne sont jamais additionnés. Les cellules complémentaires restent consultables dans « Voir ».',...(id==='service'?[SERVICE_NOTES]:[])]}
