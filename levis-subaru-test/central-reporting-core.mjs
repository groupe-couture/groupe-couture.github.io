import {periodsForMonth} from './reporting.mjs?v=1.21.901';
export const reportingWeeks=periodsForMonth;
export function reportDataForSelection(data,{kind,periodEnd}){
 if(kind!=='weekly')return data;
 return {...data,periods:data.periods.filter(p=>p.kind!=='weekly'||(p.endDate||p.end_date)===periodEnd),
 submissions:data.submissions.filter(s=>s.snapshot?.kind!=='weekly'||s.snapshot.endDate===periodEnd)};
}

export const SECTIONS={
 'vente:VN':{label:'Ventes neuf',fields:['retailUnits','retailVehicleProfit','financeProfit','inventory','walk','leads','phone']},
 'vente:VO':{label:'Ventes occasion',fields:['retailUnits','retailVehicleProfit','financeProfit','wholesaleUnits','wholesaleProfit','inventory','walk','leads','phone']},
 'service:all':{label:'Service',fields:['hours','revenue','profit','ros','presence','clocked']},
 'piece:all':{label:'Pièces',fields:['revenue','profit','invoices']},
 'esthetique:all':{label:'Esthétique',fields:['prepared','revenue','profit','waiting','rework']}
};
export const STATUS_LABELS={draft:'En préparation',validated:'Validé par le DG',submitted:'Soumis au groupe'};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function declaredPartsMargin(fields){
 const f=(fields||[]).find(f=>/BRUT[\s\S]*%/i.test(f.label));if(!finite(f?.value))return null;
 if(f.format==='PERCENT')return f.value*100;
 return f.value>0&&f.value<1?null:f.value;
}
export function declaredPartsMarginData(fields){const reportedMargin=declaredPartsMargin(fields),raw=(fields||[]).find(f=>/BRUT[\s\S]*%/i.test(f.label));return {values:{reportedMargin},issues:finite(raw?.value)&&reportedMargin===null?['reportedMargin']:[]};}
const copy=v=>structuredClone(v);
const monetary=new Set(['retailVehicleProfit','financeProfit','wholesaleProfit','revenue','profit']);
const total=(key,values)=>monetary.has(key)?Number(values.reduce((n,v)=>n+BigInt(Math.round(v*100)),0n))/100:values.reduce((a,b)=>a+b,0);

export function reportingPeriod(kind,month,periodEnd){
 const weeks=periodsForMonth(month);
 if(!weeks.length||!['weekly','monthly_final'].includes(kind))throw Error('Période invalide.');
 if(kind==='monthly_final')return {kind,start_date:month+'-01',end_date:weeks.at(-1).periodEnd};
 const week=weeks.find(w=>w.periodEnd===periodEnd);
 if(!week)throw Error('Semaine invalide.');
 return {kind,start_date:week.periodStart,end_date:week.periodEnd};
}

// Les données manquantes restent manquantes; aucune écriture ni soumission automatique.
// Les montants proviennent des totaux connus, jamais d'une moyenne arrondie multipliée.
export function draftFromExistingMetrics(section,values,{origin='plateforme-concession',period=null,observedAt=new Date().toISOString()}={}){
 const def=SECTIONS[section];if(!def)throw Error('Département inconnu.');
 const v=values||{},candidate={...v};
 if(section==='vente:VN'){
  if(!finite(candidate.retailUnits)&&finite(v.units))candidate.retailUnits=v.units;
  if(!finite(candidate.retailVehicleProfit)&&finite(v.vehicleProfit))candidate.retailVehicleProfit=v.vehicleProfit;
 }else if(section==='vente:VO'){
  if(!finite(candidate.retailVehicleProfit)&&finite(v.vehicleProfit)&&finite(v.wholesaleProfit))candidate.retailVehicleProfit=v.vehicleProfit-v.wholesaleProfit;
 }
 const known=Object.fromEntries(def.fields.filter(k=>finite(candidate[k])).map(k=>[k,monetary.has(k)?Math.round(candidate[k]*100)/100:candidate[k]]));
 return {data:{values:known,notes:'',source:{origin,period:copy(period),observedAt}},missing:def.fields.filter(k=>!Object.hasOwn(known,k))};
}

export function createCentralReporting(supabase){
 if(typeof supabase?.rpc!=='function'||typeof supabase?.from!=='function')throw Error('Client Supabase connecté requis.');
 async function command(action,input){
  const {data,error}=await supabase.rpc('gc_report_command',{p_action:action,p_input:input});
  if(error){const e=Error(error.message||'Enregistrement impossible.');e.code=error.code;throw e;}
  return data;
 }
 const version=p=>{
  if(!p?.id||!Number.isInteger(p.revision)||p.revision<1)throw Error('Rechargez la période avant de continuer.');
  return {period_id:p.id,expected_revision:p.revision};
 };
 const read=async query=>{const {data,error}=await query;if(error)throw Object.assign(Error(error.message),{code:error.code});return data;};
 async function readAll(query){
  const result=[],size=500;
  for(let offset=0;;offset+=size){
   const page=await read(query().range(offset,offset+size-1));
   result.push(...page);
   if(page.length<size)return result;
  }
 }
 return {
  progress:()=>readAll(()=>supabase.from('gc_department_reports').select('period_id,section,ready').order('period_id').order('section')),
  myMemberships:()=>read(supabase.from('gc_memberships').select('*')),
  myGroupAccess:()=>read(supabase.from('gc_group_readers').select('user_id,active')),
  dealerships:()=>read(supabase.from('gc_dealerships').select('id,name,required_sections,reporting_enabled,historical_only,joined_group_month').order('name')),
  history:async(dealershipId,{cached=null}={})=>{
   const batches=await read(supabase.from('gc_history_imports').select('id,source_url,source_modified_at,summary,completed_at').eq('status','completed').order('completed_at',{ascending:false}).limit(1));
   const batch=batches[0];if(!batch)return {batch:null,records:[]};
   // Revalider le lot terminé à chaque actualisation, sans recharger ses lignes immuables.
   // Le cache Groupe est invalidé par le contrôleur à tout changement d'identité/périmètre.
   if(!dealershipId&&cached?.batch?.id===batch.id&&JSON.stringify(cached.batch)===JSON.stringify(batch))return cached;
   const [records,service,parts]=await Promise.all([
    readAll(()=>{let q=supabase.from('gc_history_records').select('dealership_id,section,kind,as_of,source_sheet_id,source_row,values:data->values,hasActual:data->hasActual,source').eq('import_id',batch.id).order('source_sheet_id').order('source_row').order('section');if(dealershipId)q=q.eq('dealership_id',dealershipId);return q;}),
    readAll(()=>{let q=supabase.from('gc_history_service_metrics').select('source_sheet_id,source_row,values,issues').eq('import_id',batch.id).order('source_sheet_id').order('source_row');if(dealershipId)q=q.eq('dealership_id',dealershipId);return q;}),
    readAll(()=>{let q=supabase.from('gc_history_records').select('source_sheet_id,source_row,fields:data->fields').eq('import_id',batch.id).eq('section','piece:all').order('source_sheet_id').order('source_row');if(dealershipId)q=q.eq('dealership_id',dealershipId);return q;})
   ]);
   const extra=new Map(service.map(r=>[r.source_sheet_id+'|'+r.source_row,r]));
   const margins=new Map(parts.map(r=>[r.source_sheet_id+'|'+r.source_row,declaredPartsMarginData(r.fields)]));
   return {batch,records:records.map(({values,hasActual,...r})=>{const key=r.source_sheet_id+'|'+r.source_row,e=r.section==='service:all'?extra.get(key):r.section==='piece:all'?margins.get(key):null;return {...r,data:{values:{...values,...e?.values},hasActual,issues:e?.issues||[]}};})};
  },
  historyFields:(importId,sheetId,row)=>read(supabase.from('gc_history_records').select('section,fields:data->fields').eq('import_id',importId).eq('source_sheet_id',sheetId).eq('source_row',row)),
  periods:dealershipId=>{
   return readAll(()=>{
    let q=supabase.from('gc_report_periods').select('*').order('end_date',{ascending:false}).order('id');
    if(dealershipId)q=q.eq('dealership_id',dealershipId);return q;
   });
  },
  sections:periodId=>read(supabase.from('gc_department_reports').select('*').eq('period_id',periodId).order('section')),
  // La RLS fournit uniquement les instantanés autorisés au DG / lecteur du groupe.
  submissions:dealershipId=>{
   return readAll(()=>{
    let q=supabase.from('gc_group_submissions').select('*').order('submitted_at').order('id');
    if(dealershipId)q=q.eq('dealership_id',dealershipId);return q;
   });
  },
  openPeriod:(dealershipId,kind,month,periodEnd)=>command('open_period',{dealership_id:dealershipId,...reportingPeriod(kind,month,periodEnd)}),
  saveSection:(p,section,data)=>command('save_section',{...version(p),section,data:copy(data)}),
  completeSection:(p,section)=>command('complete_section',{...version(p),section}),
  validateDG:p=>command('validate_dg',version(p)),
  submitToGroup:(p,{balanceWithStatement=false}={})=>{
   if(p.kind==='monthly_final'&&balanceWithStatement!==true)throw Error('Cochez « Balance avec le bilan ».');
   return command('submit_group',{...version(p),balance_with_statement:balanceWithStatement===true});
  },
  reopen:(p,reason)=>{
   if(!reason?.trim())throw Error('Indiquez le motif de la correction.');
   return command('reopen',{...version(p),reason:reason.trim()});
  }
 };
}

// À appliquer aux résultats RLS paginés de gc_group_submissions, jamais aux brouillons.
export function latestOfficialSubmissions(submissions,{kind=null,year=null}={}){
 const latest=new Map();
 for(const row of submissions){
  const s=row?.snapshot;
  if(!s||s.schemaVersion!==1||!row.period_id||!row.dealership_id||!Number.isInteger(row.sequence)||row.sequence<1)continue;
  if(!['weekly','monthly_final'].includes(s.kind)||typeof s.endDate!=='string'||!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s.endDate))continue;
  if(new Date(s.endDate+'T12:00:00Z').toISOString().slice(0,10)!==s.endDate||!s.sections||typeof s.sections!=='object'||Array.isArray(s.sections))continue;
  if(s.kind==='monthly_final'&&s.balanceWithStatement!==true)continue;
  if(kind&&s.kind!==kind||year&&s.endDate?.slice(0,4)!==String(year))continue;
  const key=row.dealership_id+'|'+row.period_id,previous=latest.get(key);
  if(!previous||row.sequence>previous.sequence)latest.set(key,row);
 }
 return [...latest.values()].sort((a,b)=>a.snapshot.endDate.localeCompare(b.snapshot.endDate)||a.dealership_id.localeCompare(b.dealership_id));
}

export function officialYearToDate(submissions,year,{throughMonth=12,joinedMonths={}}={}){
 if(!/^\d{4}$/.test(String(year))||!Number.isInteger(throughMonth)||throughMonth<1||throughMonth>12)throw Error('Année ou mois invalide.');
 const rows=latestOfficialSubmissions(submissions,{kind:'monthly_final',year})
  .filter(r=>Number(r.snapshot.endDate.slice(5,7))<=throughMonth&&(!joinedMonths[r.dealership_id]||r.snapshot.endDate.slice(0,7)>=joinedMonths[r.dealership_id]));
 const grouped=new Map();
 for(const row of rows)for(const [section,report]of Object.entries(row.snapshot.sections||{})){
  if(!SECTIONS[section])continue;
  const id=row.dealership_id+'|'+section;
  if(!grouped.has(id))grouped.set(id,{dealershipId:row.dealership_id,section,months:[],values:{},sourceRows:[]});
  const g=grouped.get(id);g.months.push(row.snapshot.endDate.slice(0,7));g.sourceRows.push(report?.data?.values||{});
 }
 for(const g of grouped.values()){
  for(const k of SECTIONS[g.section].fields){
   const vals=g.sourceRows.map(v=>v[k]);
   g.values[k]=['inventory','waiting'].includes(k)?(finite(vals.at(-1))?vals.at(-1):null):vals.every(finite)?total(k,vals):null;
  }
  const v=g.values;
  if(g.section.startsWith('vente:')){
   v.units=finite(v.retailUnits)?v.retailUnits+(g.section==='vente:VO'?v.wholesaleUnits:0):null;
   if(g.section==='vente:VO'&&!finite(v.wholesaleUnits))v.units=null;
   v.vehicleProfit=finite(v.retailVehicleProfit)&&(g.section!=='vente:VO'||finite(v.wholesaleProfit))?v.retailVehicleProfit+(g.section==='vente:VO'?v.wholesaleProfit:0):null;
   v.totalProfit=finite(v.vehicleProfit)&&finite(v.financeProfit)?v.vehicleProfit+v.financeProfit:null;
   v.vehicleAverage=v.units>0&&finite(v.vehicleProfit)?v.vehicleProfit/v.units:null;
   v.financeAverage=v.retailUnits>0&&finite(v.financeProfit)?v.financeProfit/v.retailUnits:null;
  }else{
   v.margin=v.revenue>0&&finite(v.profit)?100*v.profit/v.revenue:null;
   if(g.section==='service:all'){
    v.rate=v.hours>0&&finite(v.revenue)?v.revenue/v.hours:null;
    v.productivity=v.presence>0&&finite(v.clocked)?100*v.clocked/v.presence:null;
    v.efficiency=v.clocked>0&&finite(v.hours)?100*v.hours/v.clocked:null;
   }
  }
  g.missingMonths=Array.from({length:throughMonth},(_,i)=>String(year)+'-'+String(i+1).padStart(2,'0')).filter(m=>(!joinedMonths[g.dealershipId]||m>=joinedMonths[g.dealershipId])&&!g.months.includes(m));
  g.partial=g.missingMonths.length>0||SECTIONS[g.section].fields.some(k=>!finite(v[k]));
  delete g.sourceRows;
 }
 return [...grouped.values()];
}
