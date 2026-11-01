import {outsideGroup,groupEntryLabel} from './group-membership.mjs?v=1.20.0';
import {createCentralReporting,reportingWeeks,SECTIONS,STATUS_LABELS,draftFromExistingMetrics} from './central-reporting-core.mjs?v=1.20.0';
import {canViewModule} from './permissions.mjs';
import {esc,today} from './domain.mjs';
export const FIELD_LABELS={retailUnits:'Ventes au détail',retailVehicleProfit:'Profit total véhicules au détail ($)',financeProfit:'Profit total F&I ($)',wholesaleUnits:'Ventes wholesale',wholesaleProfit:'Profit total wholesale net ($)',inventory:'Véhicules en inventaire',walk:'Clients en salle',leads:'Demandes Internet',phone:'Appels',hours:'Heures vendues',revenue:'Chiffre d’affaires ($)',profit:'Profit brut ($)',ros:'Bons de réparation',presence:'Heures de présence',clocked:'Heures pointées',invoices:'Factures',prepared:'Véhicules préparés',waiting:'En attente',rework:'Reprises'};
const counts=new Set(['retailUnits','wholesaleUnits','inventory','walk','leads','phone','ros','invoices','prepared','waiting','rework']);
export async function knownReportDraft(sdk,db,section,period){
 const [department,type]=section.split(':'),snapshot=await sdk.getDocs(sdk.query(sdk.collection(db,'weeklyReports'),sdk.where('department','==',department)));
 const r=snapshot.docs.map(d=>({...d.data(),id:d.id})).find(r=>r.periodStart===period.start_date&&r.periodEnd===period.end_date&&(department!=='vente'||r.kind===type));
 let values=r?.values||{};
 if(!r&&period.kind==='monthly_final'){
  const metrics=await sdk.getDocs(sdk.collection(db,'departmentMetrics'));
  const ids=department==='vente'?[department+'_'+period.start_date.slice(0,7)+'_'+type]:[department+'_'+period.start_date.slice(0,7)];
  const legacy=metrics.docs.find(d=>ids.includes(d.id));values=legacy?.data()||{};
 }
 return draftFromExistingMetrics(section,values,{period:{start_date:period.start_date,end_date:period.end_date},origin:'tableau-concession-verifie'});
}
export function editableSections(profile,required){return required.filter(s=>SECTIONS[s]&&(['admin','dg'].includes(profile?.role)||(profile?.role==='directeur'&&profile.sections?.includes(s))));}
export function reportValues(form,section){
 const values={};
 for(const key of SECTIONS[section].fields){const raw=form.elements[key].value.trim();if(raw==='')continue;const n=Number(raw);
 if(!Number.isFinite(n)||Math.abs(n)>1e12||(counts.has(key)&&(!Number.isInteger(n)||n<0)))throw Error(FIELD_LABELS[key]+' : valeur invalide.');values[key]=n;}
 return {values,notes:form.elements.notes.value.trim(),source:{origin:'saisie-plateforme',observedAt:new Date().toISOString()}};
}
export function createCentralReportingUI(ctx){
 let kind='monthly_final',month='',week='',period=null,sections=[],loaded='',loading=false,error='',generation=0,working=false;
 const $=s=>document.querySelector(s),state=()=>ctx.state(),drafts=new Map(),sources=new Map();
 function stop(){drafts.clear();sources.clear();generation++;loaded='';period=null;sections=[];loading=false;working=false;error='';}
 function api(){return createCentralReporting(state().sdk.client);}
 function initialize(){if(!month){const d=new Date(today()+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);month=d.toISOString().slice(0,7);}if(!reportingWeeks(month).some(w=>w.periodEnd===week))week=reportingWeeks(month).at(-1)?.periodEnd||'';}
 function key(){return [state().user.uid,state().profile.dealershipId,kind,month,week].join('|');}
 async function reload(){const token=++generation;loading=true;error='';ctx.render();try{
  const rows=await api().periods(state().profile.dealershipId),end=kind==='monthly_final'?reportingWeeks(month).at(-1).periodEnd:week;
  const p=rows.find(p=>p.kind===kind&&p.end_date===end)||null,r=p?await api().sections(p.id):[];
  if(token!==generation)return;period=p;sections=r;loaded=key();
 }catch(e){if(token!==generation)return;error=e.message;loaded=key();period=null;sections=[];}finally{if(token===generation){loading=false;ctx.render();}}}
 async function act(command){if(working)return;working=true;error='';ctx.render();try{await command();await reload();ctx.toast('Rapport enregistré sur le serveur.');}catch(e){error=(e.code==='40001'?'Le rapport a changé. Cliquez sur Actualiser avant de reprendre. ': '')+e.message;}finally{working=false;ctx.render();}}
 function render(tab){
  if(tab!=='reports')return false;const s=state();if(!canViewModule(s.profile,tab))return false;initialize();
  $('#pageTitle').textContent='Rapports au groupe';$('#subtitle').textContent=s.profile.dealershipName+' · saisie, validation DG et soumission';$('#add').hidden=true;$('#metrics').innerHTML='';
  $('#toolbar').innerHTML=`<label>Type<select id="centralKind"><option value="monthly_final" ${kind==='monthly_final'?'selected':''}>Mois final</option><option value="weekly" ${kind==='weekly'?'selected':''}>Hebdomadaire</option></select></label><label>Mois<input id="centralMonth" type="month" required value="${month}"></label>${kind==='weekly'?`<label>Semaine<select id="centralWeek">${reportingWeeks(month).map(w=>`<option value="${w.periodEnd}" ${week===w.periodEnd?'selected':''}>${w.periodStart} au ${w.periodEnd}</option>`).join('')}</select></label>`:''}<button id="centralReload">Actualiser</button>`;
  for(const [id,assign]of [['centralKind',v=>kind=v],['centralMonth',v=>month=v],['centralWeek',v=>week=v]]){const el=$('#'+id);if(el)el.onchange=()=>{if(!el.value)return ctx.render();assign(el.value);loaded='';period=null;sections=[];ctx.render();};}
  const historyLink=document.createElement('a');historyLink.href='groupe/plateforme.html?concession='+encodeURIComponent(s.profile.dealershipId);historyLink.textContent='Consulter l’historique Google Sheets 2026 →';$('#toolbar').append(historyLink);
  $('#centralReload').onclick=()=>{loaded='';reload();};
  if(s.demo){$('#content').innerHTML='<div class="notice">Le circuit des rapports réels utilise un compte connecté. L’aperçu local reste une simulation.</div>';return true;}
  if(!s.profile.reportingEnabled){$('#content').innerHTML='<div class="notice">Le reporting de cette concession est désactivé.</div>';return true;}
  if(outsideGroup(s.profile,month)){$('#content').innerHTML='<section class="settings"><h2>Complété — hors groupe</h2><p>'+esc(groupEntryLabel(s.profile))+'.</p><p>Cette période précède son intégration. Aucune saisie ni validation requise.</p></section>';return true;}
  if(loaded!==key()&&!loading){reload();return true;}
  const canDG=['admin','dg'].includes(s.profile.role),required=period?.required_sections||s.profile.requiredSections,allowed=editableSections(s.profile,required),locked=period?.status==='submitted';
  $('#content').innerHTML=(error?`<p class="notice error" role="alert">${esc(error)}</p>`:'')+(loading?'<p role="status">Chargement des données autorisées…</p>':!period?`<section class="settings"><h2>Aucun rapport pour cette période</h2><p>Ouvrez une période terminée pour saisir les résultats. Les valeurs absentes restent à compléter.</p><button id="centralOpen" class="primary">Ouvrir la période</button></section>`:`<section class="settings"><h2>${esc(STATUS_LABELS[period.status])}</h2><p>Version ${period.revision} · ${period.start_date} au ${period.end_date}</p><p>Les totaux saisis servent à recalculer les moyennes pondérées. Le sommaire des ventes affiche les moyennes.</p>${allowed.map(section=>{const r=sections.find(r=>r.section===section),draft=drafts.get(key()+'|'+section),v=draft?.values||r?.data?.values||{};return `<form data-central-section="${section}"><h3>${esc(SECTIONS[section].label)} · ${r?.ready?'Complété':'À compléter'}</h3><fieldset ${locked||working?'disabled':''}><div class="form-grid">${SECTIONS[section].fields.map(k=>`<label>${esc(FIELD_LABELS[k])}<input name="${k}" type="number" step="${counts.has(k)?'1':'0.01'}" ${counts.has(k)||['hours','presence','clocked'].includes(k)?'min="0"':''} value="${esc(v[k]??'')}"></label>`).join('')}</div><label>Notes<textarea name="notes" maxlength="2000">${esc(draft?.notes??r?.data?.notes??'')}</textarea></label><button type="button" data-prefill>Reprendre les données connues du département</button><p class="muted" data-source-note>Les valeurs absentes restent à compléter. Aucun total n’est déduit d’une moyenne arrondie.</p><button type="submit" value="save">Enregistrer le brouillon</button> <button type="submit" value="complete" class="primary">Enregistrer et compléter</button></fieldset></form>`;}).join('')}${canDG?`<hr><h3>Validation DG</h3><p>${required.filter(k=>sections.some(r=>r.section===k&&r.ready)).length} / ${required.length} départements complétés.</p>${!locked?`<button id="centralValidate" ${period.status==='validated'?'disabled':''}>Valider les départements</button>${kind==='monthly_final'?'<label class="check"><input id="centralBalance" type="checkbox"> Je confirme que le mois balance avec le bilan comptable.</label>':''}<button id="centralSubmit" class="primary" ${period.status!=='validated'?'disabled':''}>Soumettre au groupe</button>`:'<p>Ce rapport est officiel et verrouillé. Une correction conserve l’ancienne version jusqu’à sa nouvelle soumission.</p><label>Motif de correction<textarea id="centralReason" maxlength="2000"></textarea></label><button id="centralReopen">Rouvrir pour correction</button>'}`:''}</section>`);
  if(loading)return true;
  const open=$('#centralOpen');if(open)open.onclick=()=>act(()=>api().openPeriod(s.profile.dealershipId,kind,month,week));
  document.querySelectorAll('[data-central-section]').forEach(f=>{const section=f.dataset.centralSection,draftKey=key()+'|'+section;const capture=()=>drafts.set(draftKey,{values:Object.fromEntries(SECTIONS[section].fields.map(k=>[k,f.elements[k].value])),notes:f.elements.notes.value});f.addEventListener('input',capture);const prefill=f.querySelector('[data-prefill]');if(prefill)prefill.onclick=async()=>{prefill.disabled=true;try{const draft=await knownReportDraft(s.sdk,s.sdk.client,section,period);for(const [k,v]of Object.entries(draft.data.values))if(f.elements[k].value==='')f.elements[k].value=v;capture();sources.set(draftKey,draft.data.source);f.querySelector('[data-source-note]').textContent=draft.missing.length+' mesure(s) à vérifier ou compléter. Les valeurs connues ont été reprises sans soumission automatique.';}catch(err){f.querySelector('[data-source-note]').textContent=err.message;}finally{prefill.disabled=false;}};f.onsubmit=e=>{e.preventDefault();const section=f.dataset.centralSection;let data;try{data=reportValues(f,section);}catch(err){error=err.message;ctx.render();return;}const complete=e.submitter?.value==='complete';act(async()=>{if(sources.has(draftKey))data.source=sources.get(draftKey);const updated=await api().saveSection(period,section,data);drafts.delete(draftKey);sources.delete(draftKey);if(complete)await api().completeSection(updated,section);});};});
  if($('#centralValidate'))$('#centralValidate').onclick=()=>act(()=>api().validateDG(period));
  if($('#centralSubmit'))$('#centralSubmit').onclick=()=>{const balance=kind!=='monthly_final'||$('#centralBalance').checked;act(()=>api().submitToGroup(period,{balanceWithStatement:balance}));};
  if($('#centralReopen'))$('#centralReopen').onclick=()=>{const reason=$('#centralReason').value;act(()=>api().reopen(period,reason));};
  if(working)document.querySelectorAll('#content button,#toolbar input,#toolbar select,#toolbar button').forEach(b=>b.disabled=true);
  return true;
 }
 return {render,stop};
}
