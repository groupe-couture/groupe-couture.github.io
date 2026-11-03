import {sortGroupRows} from './dashboard-model.mjs?v=1.21.0';
import {REPORT_DEPARTMENTS,previousMonth,inventoryCoverage} from './department-reporting.mjs?v=1.21.0';
import {groupStartMonth,outsideGroup,completionCounts} from './group-membership.mjs?v=1.21.0';
import {historyAadPeriod} from './aad-period.mjs?v=1.21.0';
import {SERVICE_ANALYSES,SERVICE_FLOW_KEYS,SERVICE_SNAPSHOT_KEYS,serviceDerived,SERVICE_NOTES} from './service-metrics.mjs?v=1.21.0';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const sum=vs=>vs.length&&vs.every(finite)?vs.reduce((a,b)=>a+b,0):null;
const sumKnown=vs=>{const known=vs.filter(finite);return known.length?known.reduce((a,b)=>a+b,0):null;};
const divide=(a,b,m=1)=>finite(a)&&finite(b)&&b>0?a/b*m:null;
export const HISTORY_DEPARTMENTS={...REPORT_DEPARTMENTS,
 service:{...REPORT_DEPARTMENTS.service,columns:SERVICE_ANALYSES.organisation.columns},
 parts:{...REPORT_DEPARTMENTS.parts,columns:REPORT_DEPARTMENTS.parts.columns.filter(([k])=>k!=='invoices')}
};
export function historyDefinitions(serviceAnalysis='organisation'){return {...HISTORY_DEPARTMENTS,service:{...HISTORY_DEPARTMENTS.service,columns:(SERVICE_ANALYSES[serviceAnalysis]||SERVICE_ANALYSES.organisation).columns}};}
export function historyDepartmentSelection(records,selection,department){
 if(department==='parts'&&selection.kind==='month_to_date'&&!records.some(r=>r.section==='piece:all'&&r.kind==='month_to_date'&&r.as_of.slice(0,7)===selection.month))return {...selection,kind:'monthly_final',periodEnd:null};
 return selection;
}
export function historyPdfSelections(dealers,records,selection,ids){
 return Object.fromEntries(ids.map(id=>{const period=historyDepartmentSelection(records,selection,id);return [id,{...period,rows:historyDashboardRows(dealers,records,period)}];}));
}
export function historyServiceAnalyses(rows){return Object.keys(SERVICE_ANALYSES).filter(id=>rows.some(r=>r.departments.service.hasOfficial&&SERVICE_ANALYSES[id].columns.some(([key])=>finite(r.departments.service[key]))));}
export function historyServiceAnalysis(rows,preferred,kind){const available=historyServiceAnalyses(rows),order=kind==='month_to_date'?['organisation','rates','retained','mechanics']:['mechanics','organisation','rates','retained'];return available.includes(preferred)?preferred:order.find(id=>available.includes(id))||preferred||order[0];}
export function weightedReportedAverage(inputs,key){
 if(!inputs.length||inputs.some(v=>!finite(v.units)||v.units<0||v.units>0&&!finite(v[key])))return null;
 const units=inputs.reduce((n,v)=>n+v.units,0);return units>0?inputs.reduce((n,v)=>n+(v.units>0?v.units*v[key]:0),0)/units:null;
}
export function reportedAverageSummary(inputs,key,mode='weighted'){
 const known=inputs.filter(v=>finite(v[key])&&(mode==='source_mean'||finite(v.units)&&v.units>0));
 const expected=mode==='source_mean'?inputs.length:inputs.filter(v=>!finite(v.units)||v.units<0||v.units>0).length;
 const value=mode==='source_mean'?known.length?known.reduce((n,v)=>n+v[key],0)/known.length:null:weightedReportedAverage(known,key);
 return {value,received:known.length,expected,units:known.reduce((n,v)=>n+(finite(v.units)?v.units:0),0)};
}
export function historyAverageNote(summary,mode='weighted'){
 if(!summary)return 'Moyenne déclarée au fichier';
 const base=(mode==='source_mean'?'Moyenne des concessions (Téléprésence)':'Moyenne pondérée')+(summary.received<summary.expected?' · partielle':'');
 return base+' · '+summary.received+' / '+summary.expected+' valeurs'+(mode==='source_mean'?'':' · '+new Intl.NumberFormat('fr-CA').format(summary.units)+' ventes couvertes');
}
export function historyTotalNotes(t,id){
 if(!['vn','vo'].includes(id))return [];
 return ['Profit véhicule : '+historyAverageNote(t.averageCoverage?.vehicleAverage,t.averageMode),'Profit F&I : '+historyAverageNote(t.averageCoverage?.financeAverage,t.averageMode),
 id==='vn'?'Inventaire neuf : non fourni dans Téléprésence.':'Inventaire occasion : '+(t.metricCoverage?.inventory?.received??0)+' / '+t.expected+' concessions renseignées.'];
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
   const metricMissingMonths=annual?Object.fromEntries((['vn','vo'].includes(id)?['units','vehicleAverage','financeAverage']:['revenue','profit']).map(key=>[key,expected.filter(m=>!selected.some(r=>r.as_of.slice(0,7)===m&&(finite(r.data.values[key])||['vehicleAverage','financeAverage'].includes(key)&&r.data.values.units===0)))])):{};
   const part={historical:true,outsideGroup:excluded,hasOfficial:selected.length>0&&!excluded,missingMonths,metricMissingMonths,includedMonths:annual?selected.map(r=>r.as_of.slice(0,7)):[],sourceConfirmed:selected.length>0&&selected.every(r=>r.source.balance===true),
    issues:[...new Set(selected.flatMap(r=>r.data.issues||[]))],fields:annual?[]:(last||candidates.at(-1))?.data.fields||[],source:(last||candidates.at(-1))?{...(last||candidates.at(-1)).source,sheetId:(last||candidates.at(-1)).source_sheet_id,row:(last||candidates.at(-1)).source_row,asOf:(last||candidates.at(-1)).as_of}:null};
   if(id==='vn'||id==='vo'){
    const inputs=selected.map(r=>r.data.values),averageInputs=[...inputs,...missingMonths.map(()=>({}))],averageCoverage=Object.fromEntries(['vehicleAverage','financeAverage'].map(key=>[key,reportedAverageSummary(averageInputs,key,annual?'weighted':'source_mean')])),stock=excluded?null:own.filter(r=>r.section===def.section&&r.kind==='month_to_date'&&r.as_of<=end&&finite(r.data.values.inventory)&&
     (kind==='month_to_date'?r.as_of===end:annual||r.as_of.slice(0,7)===month)).sort((a,b)=>a.as_of.localeCompare(b.as_of)).at(-1);
    const stockMonth=stock?.as_of.slice(0,7)||null,ref=stockMonth?own.find(r=>r.section===def.section&&r.kind==='monthly_final'&&r.as_of.slice(0,7)===previousMonth(stockMonth)&&r.data.hasActual):null;
    Object.assign(part,{units:annual?sumKnown(values('units')):v.units??null,signed:annual?sumKnown(values('signed')):v.signed??null,
     wholesaleUnits:id==='vo'?(annual?sumKnown(values('wholesaleUnits')):v.wholesaleUnits??null):0,
     vehicleAverage:annual?averageCoverage.vehicleAverage.value:v.vehicleAverage??null,financeAverage:annual?averageCoverage.financeAverage.value:v.financeAverage??null,averageCoverage,averageMode:annual?'weighted':'source_mean',
     averageInputs:averageInputs.map(x=>({units:x.units,vehicleAverage:x.vehicleAverage,financeAverage:x.financeAverage})),
     inventory:stock?.data.values.inventory??null,stockMonth,stockAsOf:stock?.as_of||null,previousSales:ref?.data.values.units??null,referenceMonth:stockMonth?previousMonth(stockMonth):null,referenceConfirmed:ref?.source.balance===true});
    part.coverage=inventoryCoverage(part.inventory,part.previousSales);
    part.coverageReason=!finite(part.inventory)?id==='vn'?'Inventaire neuf non fourni dans Téléprésence':'Inventaire occasion non renseigné':!finite(part.previousSales)?'Ventes du mois précédent absentes':part.previousSales===0?'Aucune vente au mois précédent':null;
   }else{
    for(const key of id==='service'?SERVICE_FLOW_KEYS:['revenue','profit'])part[key]=annual?sumKnown(values(key)):v[key]??null;
    if(id==='service'){
     for(const key of [...SERVICE_SNAPSHOT_KEYS,'retailGrossPercent','reportedMargin','productivity','efficiency','utilization'])part[key]=v[key]??null;
     part.serviceInputs=annual?[...selected.map(r=>r.data.values),...missingMonths.map(()=>({}))]:[v];
     Object.assign(part,serviceDerived(part,{annual,inputs:part.serviceInputs}));
    }else{part.reportedMargin=annual?null:v.reportedMargin??null;part.margin=!annual&&Object.hasOwn(v,'reportedMargin')?v.reportedMargin:divide(part.profit,part.revenue,100);}
    part.financialBasesMatch=!annual||JSON.stringify(metricMissingMonths.revenue)===JSON.stringify(metricMissingMonths.profit);
    if(annual&&!part.financialBasesMatch){part.margin=null;if(id==='service')part.reportedMargin=null;}
   }
   part.partial=part.hasOfficial&&(missingMonths.length>0||Object.values(metricMissingMonths).some(ms=>ms.length>0)||part.issues.length>0||(id==='vn'||id==='vo'?part.units===0?[part.units]:[part.units,part.vehicleAverage,part.financeAverage]:kind==='month_to_date'&&id==='service'?[part.advisors,part.openROs,part.technicians]:[part.revenue,part.profit]).some(x=>!finite(x)));
   if(id==='service'&&part.hasOfficial&&Object.values(part.serviceRatioCoverage||{}).some(c=>c.partial))part.partial=true;
   departments[id]=part;
  }
  return {...dealer,aad,historical:true,outsideGroup:excluded,status:excluded?'outside_group':'imported',hasOfficial:Object.values(departments).some(p=>p.hasOfficial),departments,
   direction:own.find(r=>r.section==='direction:all'&&r.kind===(kind==='month_to_date'?'month_to_date':'monthly_final')&&(kind==='month_to_date'?r.as_of===end:r.as_of.slice(0,7)===month))?.data.fields||[]};
 });
}
export function historyTotals(rows,id){
 const parts=rows.map(r=>r.departments[id]).filter(p=>p.hasOfficial),total=key=>sum(parts.map(p=>p[key]));
 const t={hasOfficial:parts.length>0,...completionCounts(rows,id)};
 for(const key of ['units','wholesaleUnits','inventory','previousSales','revenue','profit','hours','presence','clocked','advisors','openROs','technicians','wip'])t[key]=total(key);
 if(id==='service'||id==='parts'){
  for(const key of id==='service'?[...SERVICE_FLOW_KEYS,'advisors','openROs','technicians','wip']:['revenue','profit'])t[key]=sumKnown(parts.map(p=>p[key]));
  t.partialTotals=t.pending>0||parts.some(p=>p.partial);
  t.metricCoverage=Object.fromEntries(['revenue','profit','advisors','openROs','technicians','wip','shopMaterialsCost'].map(key=>[key,{received:parts.filter(p=>finite(p[key])).length,expected:t.expected}]));
 }
 if(id==='service'){
  const inputs=rows.filter(r=>!r.departments.service.outsideGroup).flatMap(r=>r.departments.service.serviceInputs?.length?r.departments.service.serviceInputs:[{}]);
  Object.assign(t,serviceDerived(t,{annual:true,inputs}));
  if(Object.values(t.serviceRatioCoverage||{}).some(c=>c.partial))t.partialTotals=true;
  for(const key of ['actualClientHourlyRate','postedClientHourlyRate','customerPartsGrossPercent','customerSellingRate','hourlyRate','customerGrossPercent'])t[key]=null;
 }
 if(id==='vn'||id==='vo'){
  const fullInputs=rows.filter(r=>!r.departments[id].outsideGroup).flatMap(r=>r.departments[id].averageInputs?.length?r.departments[id].averageInputs:[{}]);
  t.averageMode=rows.some(r=>r.aad)?'weighted':'source_mean';
  t.averageCoverage=Object.fromEntries(['vehicleAverage','financeAverage'].map(key=>[key,reportedAverageSummary(fullInputs,key,t.averageMode)]));
  t.vehicleAverage=t.averageCoverage.vehicleAverage.value;t.financeAverage=t.averageCoverage.financeAverage.value;
  t.units=sumKnown(parts.map(p=>p.units));t.wholesaleUnits=sumKnown(parts.map(p=>p.wholesaleUnits));t.inventory=sumKnown(parts.map(p=>p.inventory));
  t.metricCoverage=Object.fromEntries(['units','inventory','wholesaleUnits'].map(key=>[key,{received:parts.filter(p=>finite(p[key])).length,expected:t.expected}]));
  t.partialTotals=t.pending>0||parts.some(p=>p.partial)||Object.values(t.averageCoverage).some(c=>c.received<c.expected)||(id==='vo'&&t.metricCoverage.inventory.received<t.expected);
 }
 const comparable=parts.every(p=>(!finite(p.revenue)&&!finite(p.profit))||(finite(p.revenue)&&finite(p.profit)&&p.financialBasesMatch!==false));
 t.margin=(id==='service'||id==='parts')&&!comparable?null:divide(t.profit,t.revenue,100);if(id==='service')t.reportedMargin=t.margin;
 const stocks=parts.filter(p=>finite(p.inventory)),sameDate=new Set(stocks.map(p=>p.stockAsOf)).size<=1;
 t.previousSales=sum(stocks.map(p=>p.previousSales));t.referenceConfirmed=stocks.length>0&&stocks.every(p=>p.referenceConfirmed);
 t.coverage=sameDate?inventoryCoverage(t.inventory,t.previousSales):null;
 t.coverageReason=!finite(t.inventory)?id==='vn'?'Inventaire neuf non fourni dans Téléprésence':'Inventaire occasion non renseigné':!sameDate?'Photos d’inventaire de dates différentes':!finite(t.previousSales)?'Ventes de référence incomplètes':t.previousSales===0?'Aucune vente au mois précédent':null;
 return t;
}
export function historyNotes(id){return [
 'Historique importé, sans validation automatique. « Balance déclarée » reprend la case source. Les mois hors groupe sont complétés sans chiffres et exclus des résultats.',
 id==='vn'||id==='vo'?'Moyennes déclarées au détail, F&I séparé; wholesale exclu des moyennes. Mois à date et mois final : moyenne des concessions renseignées, comme Téléprésence. AAD : moyenne pondérée par les livraisons renseignées; couverture indiquée. Les valeurs absentes restent absentes dans chaque concession. Les totaux sont recalculés sur toutes les concessions affichées. Aucun profit total de détail reconstitué.':'Les champs absents ou en erreur restent « — ». Les BR ouverts et les effectifs sont des photos, jamais des cumuls.',
 id==='vn'||id==='vo'?'Inventaire VO : total renseigné au fichier; sinon somme des quatre tranches explicites. Photo datée ÷ livraisons du mois précédent. Astérisque (*) : référence non balancée à confirmer. Aucun inventaire VN fourni.':'Le cumul utilise les mois finaux seulement. Les suivis du mois à date ne sont jamais additionnés. Totaux : somme des montants connus; les résultats incomplets sont indiqués comme partiels. Une case vide du fichier reste « — ».',...(id==='service'?[SERVICE_NOTES]:id==='parts'?['Pièces : onglets « Final », vue Mois final ou AAD. Marge du mois : pourcentage déclaré au fichier. Groupe et AAD : profit brut ÷ ventes cumulées. Aucun suivi Pièces du mois à date fourni.']:[])]}
