import {CONCESSIONS} from '../registry.mjs?v=1.18.0';
import {dashboardDealerships,REPORT_LABELS} from './dashboard-model.mjs?v=1.18.0';
import {REPORT_DEPARTMENTS,demoDashboardReports,departmentDashboardRows,departmentTotals,filterDashboardRows,formatReportValue,departmentNotes,selectedDepartments,reportStateLabel,dashboardCsv} from './department-reporting.mjs?v=1.18.0';
import {generateGroupPdf} from './group-pdf.mjs?v=1.18.0';
import {reportingWeeks,reportDataForSelection} from './reporting.mjs?v=1.18.0';
import {HISTORY_DEPARTMENTS,historyDashboardRows,historyTotals,historyNotes,historyDates,defaultHistorySelection} from './history-model.mjs?v=1.18.0';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preciseNumber=new Intl.NumberFormat('fr-CA',{maximumFractionDigits:10});
const format=formatReportValue,live=document.documentElement.dataset.mode==='live';
let dealers=dashboardDealerships(CONCESSIONS),liveData={periods:[],submissions:[],history:{batch:null,records:[]}},source='official',sourceChosen=false,allowedDepartments=Object.keys(REPORT_DEPARTMENTS),ownView=false;
let kind='weekly',month='2026-10',weekEnd=reportingWeeks(month).at(-1).periodEnd,scope='all',search='',department='vn',section='consolidation',pdfObjectUrl=null,cachedKey=null,cachedRows=null,detailGeneration=0;
const historical=()=>live&&source==='history',definitions=()=>historical()?HISTORY_DEPARTMENTS:REPORT_DEPARTMENTS;
function allRows(){const key=source+'|'+kind+'|'+month+'|'+weekEnd;if(key!==cachedKey){cachedRows=historical()?historyDashboardRows(dealers,liveData.history.records,{kind,month,periodEnd:weekEnd}):departmentDashboardRows(dealers.filter(d=>!d.historical_only),live?reportDataForSelection(liveData,{kind,periodEnd:weekEnd}):demoDashboardReports(dealers,{kind,month,periodEnd:weekEnd}),{kind,year:Number(month.slice(0,4)),month:Number(month.slice(5))});cachedKey=key;}return cachedRows;}
const rows=()=>filterDashboardRows(allRows(),{scope,search,department});
const monthLabel=m=>m?new Date(m+'-15T12:00:00').toLocaleDateString('fr-CA',{month:'short',year:'numeric'}):'';
const metric=(label,value,detail)=>'<article class="kpi"><span>'+label+'</span><strong>'+value+'</strong><small>'+detail+'</small></article>';
function renderCards(t){
 if(department==='vn'||department==='vo'){
  const sales=metric(department==='vn'?'Ventes neuf':'Ventes au détail',format(t.units,'count'),department==='vo'?'Wholesale : '+format(t.wholesaleUnits,'count')+' unités':(historical()?'Départements importés : ':'Départements soumis : ')+t.received+' / '+t.dealers);
  const stock='<article class="kpi stock-kpi"><span>Véhicules en inventaire</span><div class="stock-pair"><strong>'+format(t.inventory,'count')+'</strong><div><b>'+format(t.coverage,'ratio')+'</b><small>mois d’inventaire</small></div></div><small>'+(t.coverage===null?esc(t.coverageReason):'Inventaire ÷ ventes détail du mois précédent'+(historical()&&!t.referenceConfirmed?' · référence à confirmer':''))+'</small></article>';
  return sales+metric('Moyenne profit véhicule',format(t.vehicleAverage,'money'),historical()?'Moyennes déclarées au détail, pondérées':department==='vo'?'Détail + wholesale, après frais':'Profit véhicule ÷ ventes au détail')+metric('Moyenne profit F&I',format(t.financeAverage,'money'),historical()?'Moyennes F&I déclarées, pondérées':'Profits F&I ÷ ventes au détail')+stock;
 }
 if(department==='service'&&historical())return metric('Chiffre d’affaires',format(t.revenue,'money'),'Main-d’œuvre · mois finaux')+metric('Profit brut',format(t.profit,'money'),'Montant déclaré au fichier')+metric('BR ouverts',format(t.openROs,'count'),'Photo à la date du rapport')+metric('Techniciens',format(t.technicians,'count'),'Effectif déclaré');
 if(department==='service')return metric('Heures vendues',format(t.hours,'decimal'),'Heures facturées des rapports soumis')+metric('Chiffre d’affaires',format(t.revenue,'money'),'Main-d’œuvre du service')+metric('Productivité',format(t.productivity,'percent'),'Heures pointées ÷ présence')+metric('Efficacité',format(t.efficiency,'percent'),'Heures vendues ÷ heures pointées');
 return metric('Chiffre d’affaires',format(t.revenue,'money'),historical()?'Départements pièces importés':'Départements pièces soumis')+metric('Profit brut',format(t.profit,'money'),'Résultats de la période')+metric('Marge brute',format(t.margin,'percent'),'Profit brut ÷ chiffre d’affaires')+(historical()?metric('Données disponibles',t.received+' / '+t.dealers,'Départements avec des valeurs source'):metric('Factures',format(t.invoices,'count'),'Nombre de factures'));
}
function qualityNote(part){return part.missingMonths?.length?part.missingMonths.length+' mois manquant(s) : '+part.missingMonths.map(monthLabel).join(', '):part.partial?'Données incomplètes dans '+(historical()?'le fichier source':'la version soumise'):'';}
function cells(part){return definitions()[department].columns.map(([key,,type])=>{
 let detail='';
 if(key==='coverage')detail=part.coverage===null?part.coverageReason:format(part.inventory,'count')+' ÷ '+format(part.previousSales,'count')+' · ventes '+monthLabel(part.referenceMonth)+(historical()&&!part.referenceConfirmed?' · à confirmer':'');
 if(key==='inventory'&&part.stockMonth)detail='Photo : '+(part.stockAsOf||monthLabel(part.stockMonth));
 return '<td class="num">'+format(part[key],type)+(detail?'<small>'+esc(detail)+'</small>':'')+'</td>';
}).join('');}
function render(){
 const current=rows(),def=definitions()[department],t=(historical()?historyTotals:departmentTotals)(current,department),received=t.received;
 $('#periodLabel').textContent=REPORT_LABELS[kind]+' · '+new Date(month+'-15T12:00:00').toLocaleDateString('fr-CA',{month:'long',year:'numeric'})+(['weekly','month_to_date'].includes(kind)?' · au '+weekEnd:'');
 $('#dataSource').closest('label').hidden=!live||ownView;
 $('#weekControl').firstChild.textContent=historical()?'Situation ':'Semaine ';
 $('#weekControl').hidden=!['weekly','month_to_date'].includes(kind);
 $('#reportCounts').textContent=received+' / '+current.length+' départements '+(historical()?'importés':'soumis au groupe')+' · '+def.label;
 document.querySelector('footer span:last-child').textContent=historical()?'Historique Google Sheets 2026 · lecture seule':'Saisie directeurs → validation DG → soumission au groupe';
 $('#coverageRule').textContent=historical()?'Historique importé en lecture seule. Les cases de balance proviennent du fichier; elles ne constituent pas une validation dans la plateforme. Le cumul additionne les mois finaux seulement.':'Seules les versions soumises entrent dans les résultats. Le cumul annuel utilise les mois finaux confirmés.';
 document.querySelector('[data-kind="weekly"]').hidden=historical();document.querySelector('[data-kind="month_to_date"]').hidden=!historical();
 document.querySelector('[data-section="submissions"]').hidden=historical();
 $('#scope').options[1].textContent=historical()?'Résultats importés':'Rapports soumis';$('#scope').options[2].textContent=historical()?'Résultats absents':'À recevoir';
 $('#coverageText').textContent=(current.length-received)+' à recevoir · '+(section==='submissions'?'suivi des soumissions':'vue consolidée');
 $('#coverageBar').style.width=(current.length?100*received/current.length:0)+'%';
 $('#cards').innerHTML=renderCards(t);$('#cards').hidden=section==='submissions';$('#sectionTitle').textContent=(section==='submissions'?'Suivi des soumissions · ':'')+def.label;$('#departmentPanel').setAttribute('aria-labelledby','tab-'+department);
 $('#tableHead').innerHTML=section==='submissions'?'<tr><th>Concession</th><th>Départements complétés</th><th>Validation DG</th><th>Version officielle</th><th>État</th><th></th></tr>':'<tr><th>Concession</th>'+def.columns.map(([,label])=>'<th class="num">'+esc(label)+'</th>').join('')+'<th>Rapport</th><th></th></tr>';
 $('#tableBody').innerHTML=current.map(row=>{
  const part=row.departments[department];
  const note=qualityNote(part)||(historical()?part.hasOfficial?'Source : '+(part.source?.sheetTitle||'mois finaux'):'Aucun résultat fourni pour cette période':row.correcting&&part.hasOfficial?'Correction en attente · version officielle conservée':part.hasOfficial?kind==='ytd'?'Mois finaux soumis seulement':'Version soumise':'Données non soumises');
  const workflow='<td>'+row.completed+' / '+row.total+'</td><td>'+(row.correcting?'À revalider':row.status==='submitted'||row.status==='validated'?'Validé par le DG':'À valider')+'</td><td>'+(part.hasOfficial?'Disponible':'À recevoir')+'</td>';
  return '<tr data-dealer="'+esc(row.id)+'" tabindex="0"><td><strong>'+esc(row.name)+'</strong><small>'+esc(note)+'</small></td>'+(section==='submissions'?workflow:cells(part))+'<td><span class="state '+(part.hasOfficial&&!part.partial&&!row.correcting?'green':row.status==='validated'?'blue':'amber')+'">'+esc(reportStateLabel(row,department))+'</span>'+(kind==='monthly_final'&&part.hasOfficial&&row.balance?'<small class="balanced">✓ Balance avec le bilan</small>':'')+'</td><td><button class="open-report" aria-label="Voir '+esc(def.label)+' de '+esc(row.name)+'">Voir →</button></td></tr>';
 }).join('')||'<tr><td colspan="'+(section==='submissions'?6:def.columns.length+3)+'">Aucune concession dans cette sélection.</td></tr>';
 $('#tableFoot').innerHTML=section==='submissions'?'<tr><th>Réception du département</th><td colspan="5">'+t.received+' / '+t.dealers+' · '+esc(def.label)+'</td></tr>':'<tr><th>'+(historical()?'Groupe importé':'Groupe soumis')+'</th>'+def.columns.map(([key,,type])=>'<th class="num">'+format(t[key],type)+'</th>').join('')+'<td>'+t.received+' / '+t.dealers+'</td><td></td></tr>';
 $('#calculationNotes').innerHTML=(historical()?historyNotes:departmentNotes)(department).map(n=>'<p>'+esc(n)+'</p>').join('');
 document.querySelectorAll('[data-dealer]').forEach(el=>{el.onclick=()=>openReport(current.find(r=>r.id===el.dataset.dealer));el.onkeydown=e=>{if(e.target===el&&['Enter',' '].includes(e.key)){e.preventDefault();el.click();}};});
 document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kind===kind));
 document.querySelectorAll('[data-department]').forEach(b=>{b.setAttribute('aria-selected',b.dataset.department===department);b.tabIndex=b.dataset.department===department?0:-1;});
 document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('selected',b.dataset.section===section));
 for(const id of ['export','pdfOpen','pdfCurrent'])$('#'+id).disabled=!current.length;
}
function sourceFields(fields){return '<dl>'+fields.map(f=>'<dt>'+esc(f.label)+' <small>'+esc(f.cell)+'</small></dt><dd>'+esc(f.value&&typeof f.value==='object'?'Erreur '+f.value.error:typeof f.value==='number'?(f.format==='CURRENCY'?format(f.value,'money'):preciseNumber.format(f.format==='PERCENT'?f.value*100:f.value)+(f.format==='PERCENT'?' %':'')):f.value??'—')+'</dd>').join('')+'</dl>';}
async function openReport(row){
 const part=row.departments[department],def=definitions()[department];$('#detailTitle').textContent=row.name+' · '+def.label;
 if(historical()){
  const token=++detailGeneration;
  if(part.source&&liveData.history.readFields&&!part.fieldsLoaded){
   $('#detailContent').textContent='Chargement des données autorisées du département…';$('#detail').showModal();
   try{const data=await liveData.history.readFields(part.source);if(token!==detailGeneration||!$('#detail').open)return;part.fields=data.find(r=>r.section===def.section)?.fields||[];row.direction=data.find(r=>r.section==='direction:all')?.fields||[];part.fieldsLoaded=true;}
   catch(e){if(token===detailGeneration&&$('#detail').open)$('#detailContent').textContent='Chargement impossible : '+e.message;return;}
  }
  $('#detailContent').innerHTML='<p class="attention">Historique importé · '+esc(reportStateLabel(row,department))+'</p><p>'+esc(REPORT_LABELS[kind])+' · '+esc(month)+'</p>'+def.columns.map(([key,label,type])=>'<p>'+esc(label)+' : <strong>'+format(part[key],type)+'</strong></p>').join('')+(part.partial?'<p class="attention">'+esc(qualityNote(part))+'</p>':'')+(part.source?'<p><a target="_blank" rel="noopener" href="'+esc(liveData.history.batch.source_url+'#gid='+part.source.sheetId+'&range=A'+part.source.row)+'">Voir la ligne du fichier source ↗</a></p>':'')+(part.fields?.length?'<h3>Toutes les données du département</h3>'+sourceFields(part.fields):'')+(row.direction.length?'<details><summary>Données de direction de la ligne source</summary>'+sourceFields(row.direction)+'</details>':'');
  $('#detail').showModal();return;
 }
 $('#detailContent').innerHTML='<p class="demo-tag">'+(live?'Données du serveur':'Données d’exemple · aucune soumission réelle')+'</p><p>'+esc(REPORT_LABELS[kind])+' · '+esc(month)+'</p><div class="workflow"><span>Directeurs</span><b>→</b><span>Validation DG</span><b>→</b><span>Groupe</span></div>'+
 (part.hasOfficial?'<h3>Version soumise au groupe</h3><dl>'+def.columns.map(([key,label,type])=>'<dt>'+esc(label)+'</dt><dd>'+format(part[key],type)+'</dd>').join('')+'</dl>'+(part.referenceMonth?'<p class="detail-note">Référence inventaire : '+esc(monthLabel(part.referenceMonth))+' · '+format(part.previousSales,'count')+' ventes au détail.</p>':''):'<h3>Département non soumis</h3><p>Les montants en préparation restent dans la concession.</p>')+
 (row.correcting?'<p class="attention">Une correction attend une nouvelle validation du DG. La version officielle précédente est conservée.</p>':'')+(part.partial?'<p class="attention">'+esc(qualityNote(part))+'</p>':'');$('#detail').showModal();
}
function download(bytes,name,type,target=null){const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes,url=URL.createObjectURL(new Blob([data],{type})),a=target||document.createElement('a');a.href=url;a.download=name;if(!live&&parent!==window)parent.postMessage({type:'gc-preview-file-ready',bytes:data,name,mime:type},'*');if(target){a.hidden=false;return url;}document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function clearReadyFile(){if(pdfObjectUrl)URL.revokeObjectURL(pdfObjectUrl);pdfObjectUrl=null;$('#pdfReady').hidden=true;$('#pdfReady').removeAttribute('href');$('#pdfView').hidden=true;$('#pdfView').removeAttribute('href');$('#pdfResult').textContent='';if(!live&&parent!==window)parent.postMessage({type:'gc-preview-file-clear'},'*');}
function pdfIds(){return [...document.querySelectorAll('[name="pdfDepartment"]:checked')].map(el=>el.value).filter(id=>allowedDepartments.includes(id));}
function updatePdfSelection(){const ids=pdfIds();$('#pdfDownload').disabled=!ids.length||!rows().length;clearReadyFile();$('#pdfSelectionSummary').textContent=ids.length+' département(s) · '+rows().length+' concession(s) · '+REPORT_LABELS[kind]+' · '+monthLabel(month)+(['weekly','month_to_date'].includes(kind)?' · au '+weekEnd:'');}
function openPdf(ids){document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>{el.checked=ids.includes(el.value)&&allowedDepartments.includes(el.value);el.closest('label').hidden=!allowedDepartments.includes(el.value);});$('#pdfResult').textContent='';$('#pdfReady').hidden=true;updatePdfSelection();$('#pdfDialog').showModal();}
function refreshView(){clearReadyFile();render();}
function updateWeeks(){
 if(historical()){const dates=historyDates(liveData.history.records,month);if(!dates.includes(weekEnd))weekEnd=dates.at(-1)||'';$('#week').innerHTML=dates.map(d=>'<option value="'+d+'">Situation au '+d+'</option>').join('');}
 else{const weeks=reportingWeeks(month);if(!weeks.some(w=>w.periodEnd===weekEnd))weekEnd=weeks.at(-1).periodEnd;$('#week').innerHTML=weeks.map(w=>'<option value="'+w.periodEnd+'">'+w.periodStart+' au '+w.periodEnd+'</option>').join('');}$('#week').value=weekEnd;
}
$('#dataSource').onchange=e=>{source=e.target.value;sourceChosen=true;section='consolidation';if(historical()&&kind==='weekly')kind='month_to_date';if(!historical()&&kind==='month_to_date')kind='weekly';updateWeeks();refreshView();};
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;refreshView();});document.querySelectorAll('[data-department]').forEach(b=>b.onclick=()=>{department=b.dataset.department;refreshView();});document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{section=b.dataset.section;refreshView();});
$('#month').onchange=e=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)||!reportingWeeks(e.target.value).length){e.target.value=month;return;}month=e.target.value;updateWeeks();refreshView();};$('#week').onchange=e=>{weekEnd=e.target.value;refreshView();};$('#scope').onchange=e=>{scope=e.target.value;refreshView();};$('#search').oninput=e=>{search=e.target.value;refreshView();};$('#closeDetail').onclick=()=>$('#detail').close();
document.querySelectorAll('[data-department]').forEach(b=>b.onkeydown=e=>{const tabs=[...document.querySelectorAll('[data-department]')].filter(t=>!t.hidden),index=tabs.indexOf(b);let target;if(e.key==='ArrowRight')target=tabs[(index+1)%tabs.length];if(e.key==='ArrowLeft')target=tabs[(index+tabs.length-1)%tabs.length];if(e.key==='Home')target=tabs[0];if(e.key==='End')target=tabs.at(-1);if(target){e.preventDefault();target.focus();target.click();}});
$('#pdfOpen').onclick=()=>openPdf(Object.keys(REPORT_DEPARTMENTS));$('#pdfCurrent').onclick=()=>openPdf([department]);$('#pdfClose').onclick=()=>$('#pdfDialog').close();document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>el.onchange=updatePdfSelection);
$('#pdfAll').onclick=()=>{document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>el.checked=true);updatePdfSelection();};$('#pdfNone').onclick=()=>{document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>el.checked=false);updatePdfSelection();};
$('#pdfDownload').onclick=()=>{try{const ids=selectedDepartments(pdfIds()),data=generateGroupPdf({rows:rows(),departmentIds:ids,kind,month,scope,search,periodEnd:['weekly','month_to_date'].includes(kind)?weekEnd:null,simulated:!live,historical:historical()}),name='Rapport_Groupe_Couture_'+(['weekly','month_to_date'].includes(kind)?weekEnd:month)+'_'+(ids.length===4?'tous-departements':ids.join('-'))+'.pdf';if(pdfObjectUrl)URL.revokeObjectURL(pdfObjectUrl);pdfObjectUrl=download(data,name,'application/pdf',$('#pdfReady'));$('#pdfView').href=pdfObjectUrl;$('#pdfView').hidden=false;$('#pdfResult').textContent='PDF prêt à imprimer.';}catch(error){$('#pdfResult').textContent=error.message;}};
$('#export').onclick=()=>{
 clearReadyFile();download(dashboardCsv(rows(),{department,month,kind,periodEnd:weekEnd,simulated:!live,historical:historical(),definitions:definitions()}),(live?'Rapport_Groupe_Couture_':'Exemple_Groupe_Couture_')+(['weekly','month_to_date'].includes(kind)?weekEnd:month)+'_'+department+'.csv','text/csv;charset=utf-8');
};
updateWeeks();
if(live){
 const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');kind='monthly_final';$('#month').value=month;updateWeeks();
 import('./live-dashboard.mjs?v=1.18.0').then(({connectLiveDashboard})=>connectLiveDashboard({
 onClear(){detailGeneration++;sourceChosen=false;liveData={periods:[],submissions:[],history:{batch:null,records:[]}};cachedKey=null;cachedRows=null;clearReadyFile();$('#cards').innerHTML='';$('#tableBody').innerHTML='';$('#tableFoot').innerHTML='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());},
 onData(data){
  dealers=data.dealerships;liveData=data;ownView=data.ownView;allowedDepartments=data.allowedDepartments;
  if(!allowedDepartments.includes(department))department=allowedDepartments[0]||'vn';
  document.querySelector('main h1').textContent=ownView?'Historique de mes départements':'Sommaire du groupe';
  document.querySelectorAll('[data-department]').forEach(el=>el.hidden=!allowedDepartments.includes(el.dataset.department));
  $('#dataSource').hidden=ownView;$('#dataSource').options[1].disabled=!data.history.batch;
  if(!sourceChosen){source=data.history.batch?'history':'official';const initial=source==='history'?defaultHistorySelection(data.history.records):null;if(initial){month=initial.month;kind=initial.kind;weekEnd=initial.periodEnd;$('#month').value=month;}sourceChosen=true;}
  $('#concessionReturn').hidden=!ownView;$('#concessionReturn').href='../?concession='+encodeURIComponent(dealers[0]?.id||'levis-subaru');
  if(ownView){source='history';if(kind==='weekly')kind='month_to_date';}$('#dataSource').value=source;
  section=historical()?'consolidation':section;updateWeeks();cachedKey=null;cachedRows=null;refreshView();
 }
 })).catch(e=>{$('#groupError').textContent='Connexion indisponible : '+e.message;});
}else render();
