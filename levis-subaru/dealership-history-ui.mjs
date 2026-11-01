import {createCentralReporting} from './central-reporting-core.mjs?v=1.20.0';
import {canEditObjectives,isMember} from './permissions.mjs?v=1.20.0';
import {esc} from './domain.mjs?v=1.20.0';
import {historyDashboardRows,historyDates,defaultHistorySelection,HISTORY_DEPARTMENTS,historyDepartmentSelection,historyServiceAnalyses,historyServiceAnalysis} from './groupe/history-model.mjs?v=1.20.0';
import {SERVICE_ANALYSES,SERVICE_EXTRA_COLUMNS,SERVICE_NOTES} from './groupe/service-metrics.mjs?v=1.20.0';
import {formatReportValue,reportStateLabel} from './groupe/department-reporting.mjs?v=1.20.0';
import {aadPeriodLabel,aadPeriodNote} from './groupe/aad-period.mjs?v=1.20.0';
import {generateGroupPdf} from './groupe/group-pdf.mjs?v=1.20.0';

export function historyDepartments(profile){
 if(!isMember(profile)||profile.role==='employe'||profile.reportingEnabled===false)return [];
 return Object.entries(HISTORY_DEPARTMENTS).filter(([,d])=>canEditObjectives(profile,d.section.split(':')[0])&&(!profile.sections?.length||['admin','dg'].includes(profile.role)||profile.sections.includes(d.section))).map(([id])=>id);
}
export function ownHistoryRecords(records,profile){const sections=new Set(historyDepartments(profile).map(id=>HISTORY_DEPARTMENTS[id].section));return records.filter(r=>r.dealership_id===profile.dealershipId&&sections.has(r.section));}
export function historyIdentity(state){const p=state.profile;return isMember(p)&&p.dealershipId&&state.user?.uid&&historyDepartments(p).length?[state.user.uid,p.dealershipId,p.role,p.reportingEnabled===true,...(p.sections||[]).slice().sort()].join('|'):'';}

// Un seul chargement privé par identité/concession. Aucun enregistrement Google
// n'est transformé en vente, client ou KPI hebdomadaire fictif.
export function createDealershipHistory(ctx){
 let identity='',generation=0,loading=false,error='',dataset=null,selection=null,mountNode=null,requested=[],activeDepartment='',serviceAnalysis='mechanics';
 const fieldCache=new Map();
 const state=()=>ctx.state();
 function stop(){generation++;identity='';loading=false;error='';dataset=null;selection=null;mountNode=null;requested=[];activeDepartment='';serviceAnalysis='mechanics';fieldCache.clear();}
 async function load(force=false){
  const s=state(),key=historyIdentity(s);if(!key){stop();return;}
  if(key===identity&&!force)return;
  const previous=force&&key===identity?selection:null;
  generation++;const token=generation;identity=key;dataset=null;selection=null;error='';loading=true;fieldCache.clear();
  try{
   if(s.demo&&!ctx.source){dataset={batch:null,records:[]};return;}
   const result=ctx.source?await ctx.source(s.profile.dealershipId):await createCentralReporting(s.sdk.client).history(s.profile.dealershipId);
   if(token!==generation||key!==historyIdentity(state()))return;
   dataset={...result,records:ownHistoryRecords(result.records,s.profile)};
   selection=previous||defaultHistorySelection(dataset.records)||{kind:'monthly_final',month:s.month,periodEnd:null};
  }catch(e){if(token===generation)error='Les données importées n’ont pas pu être chargées. '+e.message;}
  finally{if(token===generation){loading=false;paint();}}
 }
 function table(columns,part){return '<div class="ls-table-wrap"><table class="ls-report imported-metrics"><thead><tr><th>Indicateur</th><th>Valeur importée</th></tr></thead><tbody>'+columns.map(([key,label,type])=>'<tr><td>'+esc(label)+'</td><td>'+formatReportValue(part.outsideGroup?null:part[key],type)+'</td></tr>').join('')+'</tbody></table></div>';}
 function paint(){
  const node=mountNode;if(!node?.isConnected)return;
  if(identity!==historyIdentity(state())){node.replaceChildren();return;}
  if(loading){node.innerHTML='<p role="status">Chargement de l’historique de votre concession…</p>';return;}
  if(error){node.innerHTML='<p class="error" role="alert">'+esc(error)+'</p><button data-history-retry>Réessayer</button>';node.querySelector('[data-history-retry]').onclick=()=>load(true);return;}
  if(!dataset?.batch){node.innerHTML='<p class="ls-footnote">Les données Téléprésence importées sont accessibles avec un compte connecté autorisé.</p>';return;}
  const p=state().profile,ids=requested.filter(id=>historyDepartments(p).includes(id));if(!ids.length){node.replaceChildren();return;}
  if(!ids.includes(activeDepartment))activeDepartment=ids[0];
  selection=historyDepartmentSelection(dataset.records,selection,activeDepartment);
  const supportedMtd=historyDepartmentSelection(dataset.records,{...selection,kind:'month_to_date'},activeDepartment).kind==='month_to_date';
  const dealer={id:p.dealershipId,name:p.dealershipName||p.dealershipId,joined_group_month:p.joinedGroupMonth,reporting_enabled:p.reportingEnabled},dates=historyDates(dataset.records,selection.month);
  if(selection.kind==='month_to_date'&&!dates.includes(selection.periodEnd))selection.periodEnd=dates.at(-1)||null;
  const row=historyDashboardRows([dealer],dataset.records,selection)[0];
  serviceAnalysis=historyServiceAnalysis([row],serviceAnalysis,selection.kind);
  const availableService=historyServiceAnalyses([row]);
  const label=selection.kind==='ytd'?aadPeriodLabel(row.aad):selection.kind==='monthly_final'?'Mois final · '+selection.month:'Mois à date · situation au '+(selection.periodEnd||'aucun suivi disponible');
  const periodHint=activeDepartment==='parts'?'Pièces : ventes, profit brut et marge des onglets « Final ». Téléprésence ne fournit pas de suivi Pièces du mois à date.':activeDepartment==='service'&&selection.kind==='month_to_date'?'Service : les effectifs, les travaux et les taux sont une photo à la date choisie. Les résultats financiers sont dans l’onglet « Final » du mois.':'';
  node.innerHTML='<section class="ls-panel dealership-history"><div class="ls-row ls-between"><div><span class="ls-secondary">FICHIER TÉLÉPRÉSENCE · DONNÉES IMPORTÉES</span><h2>'+esc(dealer.name)+'</h2></div><button data-history-refresh>Actualiser l’import</button></div><div class="ls-row history-controls"><label>Période importée<input data-history-month type="month" value="'+esc(selection.month)+'" required></label><label>Vue<select data-history-kind><option value="monthly_final">Mois final</option><option value="month_to_date" ' +(supportedMtd?'':'disabled')+'>Mois à date</option><option value="ytd">Année à date · AAD</option></select></label>'+(selection.kind==='month_to_date'?'<label>Situation au<select data-history-date>'+dates.map(d=>'<option value="'+d+'">'+d+'</option>').join('')+'</select></label>':'')+'<button data-history-pdf>PDF · '+esc(HISTORY_DEPARTMENTS[activeDepartment].label)+'</button>'+(ids.length>1?'<button data-history-pdf-all>PDF · tous les départements</button>':'')+'</div><p class="notice">'+esc(label)+(selection.kind==='ytd'?' · '+esc(aadPeriodNote(row.aad)):'')+'</p>'+(periodHint?'<p class="notice">'+esc(periodHint)+(activeDepartment==='service'?'<br><button data-history-monthly-results>Voir les résultats financiers du mois</button>':'')+'</p>':'')+'<p class="ls-footnote">Lecture seule · balance déclarée au fichier, sans validation DG automatique. Les données de cette concession sont affichées directement ici. — signifie non renseigné.</p>'+(ids.length>1?'<div class="ls-row history-departments" role="group" aria-label="Département importé">'+ids.map(id=>'<button data-history-department="'+id+'" aria-pressed="'+(activeDepartment===id)+'">'+esc(HISTORY_DEPARTMENTS[id].label)+'</button>').join('')+'</div>':'')+[activeDepartment].map(id=>{
   const part=row.departments[id],def=HISTORY_DEPARTMENTS[id],source=part.source;
   const group=SERVICE_ANALYSES[serviceAnalysis];
   const body=id==='service'?'<div class="ls-row history-service-analyses" role="group" aria-label="Analyse du service">'+Object.entries(SERVICE_ANALYSES).map(([key,a])=>'<button data-history-service="'+key+'" aria-pressed="'+(key===serviceAnalysis)+'" '+(!availableService.includes(key)?'disabled title="Non renseigné dans le fichier pour cette période"':'')+'>'+esc(a.label)+'</button>').join('')+'</div><h4>'+esc(group.label)+'</h4>'+table(group.columns,part)+(serviceAnalysis==='retained'?table(SERVICE_EXTRA_COLUMNS,part):''):table(def.columns,part);
   return '<article class="imported-department"><h3>'+esc(def.label)+'</h3><p class="ls-secondary">'+esc(reportStateLabel(row,id))+(source?' · Source : '+esc(source.sheetTitle)+' · '+esc(source.asOf):'')+'</p>'+(part.outsideGroup?'<p class="notice">Période complétée avant l’intégration au groupe. Aucune donnée financière ajoutée.</p>':body)+(selection.kind==='ytd'&&part.hasOfficial&&part.partial?'<p class="error">AAD partiel : certaines valeurs financières manquent dans le fichier source. Seuls les montants connus sont additionnés.</p>':'')+(part.missingMonths.length?'<p class="error">Mois sans données : '+esc(part.missingMonths.join(', '))+'</p>':'')+(part.issues?.length?'<p class="error">'+(id==='parts'?'Marge Pièces : format de la cellule source à confirmer.':'Brut pièces clients : pourcentage sans format explicite dans le fichier, à confirmer.')+'</p>':'')+(id==='vo'?'<p class="ls-footnote">Inventaire : photo du '+esc(part.stockAsOf||'non renseigné')+' · référence : '+esc(part.referenceMonth||'non renseignée')+'. Moyennes de détail déclarées, wholesale séparé.</p>':'')+(id==='service'?'<p class="ls-footnote">'+esc(SERVICE_NOTES)+'</p>':'')+(source?'<details data-history-source><summary>Toutes les cellules du département'+(selection.kind==='ytd'?' · dernier mois inclus':'')+'</summary><div data-history-fields></div></details>':'')+(source?'<a target="_blank" rel="noopener" href="'+esc(dataset.batch.source_url+'#gid='+source.sheetId+'&range=A'+source.row)+'">Voir la ligne du fichier source ↗</a>':'')+'</article>';
  }).join('')+'<p data-history-pdf-result role="status"></p></section>';
  node.querySelector('[data-history-kind]').value=selection.kind;
  node.querySelector('[data-history-kind]').onchange=e=>{selection.kind=e.target.value;serviceAnalysis=selection.kind==='month_to_date'?'organisation':'mechanics';paint();};
  node.querySelector('[data-history-month]').onchange=e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){selection.month=e.target.value;paint();}};
  const date=node.querySelector('[data-history-date]');if(date){date.value=selection.periodEnd||'';date.onchange=e=>{selection.periodEnd=e.target.value;paint();};}
  node.querySelector('[data-history-refresh]').onclick=()=>load(true);
  const monthlyResults=node.querySelector('[data-history-monthly-results]');if(monthlyResults)monthlyResults.onclick=()=>{selection.kind='monthly_final';serviceAnalysis='mechanics';paint();};
  const sourceDetails=node.querySelector('[data-history-source]');
  if(sourceDetails)sourceDetails.ontoggle=async()=>{
   if(!sourceDetails.open||sourceDetails.dataset.loaded)return;
   const target=sourceDetails.querySelector('[data-history-fields]'),part=row.departments[activeDepartment],source=part.source,section=HISTORY_DEPARTMENTS[activeDepartment].section,token=generation,key=identity+'|'+dataset.batch.id+'|'+source.sheetId+'|'+source.row+'|'+section;
   sourceDetails.dataset.loaded='loading';target.textContent='Chargement des cellules autorisées…';
   try{
    let fields=fieldCache.get(key);
    if(!fields){const result=await createCentralReporting(state().sdk.client).historyFields(dataset.batch.id,source.sheetId,source.row);fields=result.find(r=>r.section===section)?.fields||[];if(token!==generation||identity!==historyIdentity(state()))return;fieldCache.set(key,fields);}
    if(token!==generation||!target.isConnected)return;
    const value=f=>typeof f.value==='number'?formatReportValue(f.format==='PERCENT'?f.value*100:f.value,f.format==='PERCENT'?'percent':f.format==='CURRENCY'?'money':'decimal'):f.value?.error?'Erreur dans la source : '+f.value.error:f.value===null?'—':String(f.value??'—');
    target.innerHTML=fields.length?'<div class="ls-table-wrap"><table class="ls-report"><thead><tr><th>Cellule</th><th>Indicateur source</th><th>Valeur source</th></tr></thead><tbody>'+fields.map(f=>'<tr><td>'+esc(f.cell)+'</td><td>'+esc(f.label)+'</td><td>'+esc(value(f))+'</td></tr>').join('')+'</tbody></table></div>':'<p>Aucune cellule renseignée pour ce département.</p>';sourceDetails.dataset.loaded='yes';
   }catch(e){if(token===generation&&target.isConnected){target.textContent='Chargement impossible : '+e.message;delete sourceDetails.dataset.loaded;}}
  };
  node.querySelectorAll('[data-history-department]').forEach(b=>b.onclick=()=>{activeDepartment=b.dataset.historyDepartment;if(activeDepartment==='service')serviceAnalysis=selection.kind==='month_to_date'?'organisation':'mechanics';paint();});
  node.querySelectorAll('[data-history-service]').forEach(b=>b.onclick=()=>{serviceAnalysis=b.dataset.historyService;paint();});
  function pdf(selected){try{const bytes=generateGroupPdf({rows:[row],departmentIds:selected,kind:selection.kind,month:selection.month,periodEnd:selection.periodEnd,historical:true,simulated:false}),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download='Telepresence_'+dealer.id+'_'+selection.month+'_'+selected.join('-')+'.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);node.querySelector('[data-history-pdf-result]').textContent='PDF préparé : '+selected.length+' département(s).';}catch(e){node.querySelector('[data-history-pdf-result]').textContent=e.message;}}
  node.querySelector('[data-history-pdf]').onclick=()=>pdf([activeDepartment]);
  const all=node.querySelector('[data-history-pdf-all]');if(all)all.onclick=()=>pdf(ids);
 }
 function mount(node,{departments=historyDepartments(state().profile)}={}){mountNode=node;requested=departments;const key=historyIdentity(state());if(!key){stop();node.replaceChildren();return;}load();paint();}
 return {mount,stop};
}
