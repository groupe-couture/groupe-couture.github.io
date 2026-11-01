import {CONCESSIONS} from '../registry.mjs';
import {dashboardDealerships,REPORT_LABELS} from './dashboard-model.mjs';
import {REPORT_DEPARTMENTS,demoDashboardReports,departmentDashboardRows,departmentTotals,filterDashboardRows,formatReportValue,departmentNotes,selectedDepartments,reportStateLabel,dashboardCsv} from './department-reporting.mjs';
import {generateGroupPdf} from './group-pdf.mjs';
import {reportingWeeks,reportDataForSelection} from './reporting.mjs';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=formatReportValue,live=document.documentElement.dataset.mode==='live';
let dealers=dashboardDealerships(CONCESSIONS),liveData={periods:[],submissions:[]};
let kind='weekly',month='2026-10',weekEnd=reportingWeeks(month).at(-1).periodEnd,scope='all',search='',department='vn',section='consolidation',pdfObjectUrl=null,cachedKey=null,cachedRows=null;
function allRows(){const key=kind+'|'+month+'|'+weekEnd;if(key!==cachedKey){cachedRows=departmentDashboardRows(dealers,live?reportDataForSelection(liveData,{kind,periodEnd:weekEnd}):demoDashboardReports(dealers,{kind,month,periodEnd:weekEnd}),{kind,year:Number(month.slice(0,4)),month:Number(month.slice(5))});cachedKey=key;}return cachedRows;}
const rows=()=>filterDashboardRows(allRows(),{scope,search,department});
const monthLabel=m=>m?new Date(m+'-15T12:00:00').toLocaleDateString('fr-CA',{month:'short',year:'numeric'}):'';
const metric=(label,value,detail)=>'<article class="kpi"><span>'+label+'</span><strong>'+value+'</strong><small>'+detail+'</small></article>';
function renderCards(t){
 if(department==='vn'||department==='vo'){
  const sales=metric(department==='vn'?'Ventes neuf':'Ventes au détail',format(t.units,'count'),department==='vo'?'Wholesale : '+format(t.wholesaleUnits,'count')+' unités':'Départements soumis : '+t.received+' / '+t.dealers);
  const stock='<article class="kpi stock-kpi"><span>Véhicules en inventaire</span><div class="stock-pair"><strong>'+format(t.inventory,'count')+'</strong><div><b>'+format(t.coverage,'ratio')+'</b><small>mois d’inventaire</small></div></div><small>'+(t.coverage===null?esc(t.coverageReason):'Inventaire ÷ ventes détail du mois précédent')+'</small></article>';
  return sales+metric('Moyenne profit véhicule',format(t.vehicleAverage,'money'),department==='vo'?'Détail + wholesale, après frais':'Profit véhicule ÷ ventes au détail')+metric('Moyenne profit F&I',format(t.financeAverage,'money'),'Profits F&I ÷ ventes au détail')+stock;
 }
 if(department==='service')return metric('Heures vendues',format(t.hours,'decimal'),'Heures facturées des rapports soumis')+metric('Chiffre d’affaires',format(t.revenue,'money'),'Main-d’œuvre du service')+metric('Productivité',format(t.productivity,'percent'),'Heures pointées ÷ présence')+metric('Efficacité',format(t.efficiency,'percent'),'Heures vendues ÷ heures pointées');
 return metric('Chiffre d’affaires',format(t.revenue,'money'),'Départements pièces soumis')+metric('Profit brut',format(t.profit,'money'),'Résultats de la période')+metric('Marge brute',format(t.margin,'percent'),'Profit brut ÷ chiffre d’affaires')+metric('Factures',format(t.invoices,'count'),'Nombre de factures');
}
function qualityNote(part){return part.missingMonths?.length?part.missingMonths.length+' mois manquant(s) : '+part.missingMonths.map(monthLabel).join(', '):part.partial?'Données incomplètes dans la version soumise':'';}
function cells(part){return REPORT_DEPARTMENTS[department].columns.map(([key,,type])=>{
 let detail='';
 if(key==='coverage')detail=part.coverage===null?part.coverageReason:format(part.inventory,'count')+' ÷ '+format(part.previousSales,'count')+' · ventes '+monthLabel(part.referenceMonth);
 if(key==='inventory'&&part.stockMonth)detail='Photo : '+monthLabel(part.stockMonth);
 return '<td class="num">'+format(part[key],type)+(detail?'<small>'+esc(detail)+'</small>':'')+'</td>';
}).join('');}
function render(){
 const current=rows(),def=REPORT_DEPARTMENTS[department],t=departmentTotals(current,department),received=t.received;
 $('#periodLabel').textContent=REPORT_LABELS[kind]+' · '+new Date(month+'-15T12:00:00').toLocaleDateString('fr-CA',{month:'long',year:'numeric'})+(kind==='weekly'?' · au '+weekEnd:'');
 $('#weekControl').hidden=kind!=='weekly';
 $('#reportCounts').textContent=received+' / '+current.length+' rapports soumis au groupe · '+def.label;
 $('#coverageText').textContent=(current.length-received)+' à recevoir · '+(section==='submissions'?'suivi des soumissions':'vue consolidée');
 $('#coverageBar').style.width=(current.length?100*received/current.length:0)+'%';
 $('#cards').innerHTML=renderCards(t);$('#cards').hidden=section==='submissions';$('#sectionTitle').textContent=(section==='submissions'?'Suivi des soumissions · ':'')+def.label;$('#departmentPanel').setAttribute('aria-labelledby','tab-'+department);
 $('#tableHead').innerHTML=section==='submissions'?'<tr><th>Concession</th><th>Départements complétés</th><th>Validation DG</th><th>Version officielle</th><th>État</th><th></th></tr>':'<tr><th>Concession</th>'+def.columns.map(([,label])=>'<th class="num">'+esc(label)+'</th>').join('')+'<th>Rapport</th><th></th></tr>';
 $('#tableBody').innerHTML=current.map(row=>{
  const part=row.departments[department];
  const note=qualityNote(part)||(row.correcting&&part.hasOfficial?'Correction en attente · version officielle conservée':part.hasOfficial?kind==='ytd'?'Mois finaux soumis seulement':'Version soumise':'Données non soumises');
  const workflow='<td>'+row.completed+' / '+row.total+'</td><td>'+(row.correcting?'À revalider':row.status==='submitted'||row.status==='validated'?'Validé par le DG':'À valider')+'</td><td>'+(part.hasOfficial?'Disponible':'À recevoir')+'</td>';
  return '<tr data-dealer="'+esc(row.id)+'" tabindex="0"><td><strong>'+esc(row.name)+'</strong><small>'+esc(note)+'</small></td>'+(section==='submissions'?workflow:cells(part))+'<td><span class="state '+(part.hasOfficial&&!part.partial&&!row.correcting?'green':row.status==='validated'?'blue':'amber')+'">'+esc(reportStateLabel(row,department))+'</span>'+(kind==='monthly_final'&&part.hasOfficial&&row.balance?'<small class="balanced">✓ Balance avec le bilan</small>':'')+'</td><td><button class="open-report" aria-label="Voir '+esc(def.label)+' de '+esc(row.name)+'">Voir →</button></td></tr>';
 }).join('')||'<tr><td colspan="'+(section==='submissions'?6:def.columns.length+3)+'">Aucune concession dans cette sélection.</td></tr>';
 $('#tableFoot').innerHTML=section==='submissions'?'<tr><th>Réception du département</th><td colspan="5">'+t.received+' / '+t.dealers+' · '+esc(def.label)+'</td></tr>':'<tr><th>Groupe soumis</th>'+def.columns.map(([key,,type])=>'<th class="num">'+format(t[key],type)+'</th>').join('')+'<td>'+t.received+' / '+t.dealers+'</td><td></td></tr>';
 $('#calculationNotes').innerHTML=departmentNotes(department).map(n=>'<p>'+esc(n)+'</p>').join('');
 document.querySelectorAll('[data-dealer]').forEach(el=>{el.onclick=()=>openReport(current.find(r=>r.id===el.dataset.dealer));el.onkeydown=e=>{if(e.target===el&&['Enter',' '].includes(e.key)){e.preventDefault();el.click();}};});
 document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kind===kind));
 document.querySelectorAll('[data-department]').forEach(b=>{b.setAttribute('aria-selected',b.dataset.department===department);b.tabIndex=b.dataset.department===department?0:-1;});
 document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('selected',b.dataset.section===section));
 for(const id of ['export','pdfOpen','pdfCurrent'])$('#'+id).disabled=!current.length;
}
function openReport(row){
 const part=row.departments[department],def=REPORT_DEPARTMENTS[department];$('#detailTitle').textContent=row.name+' · '+def.label;
 $('#detailContent').innerHTML='<p class="demo-tag">Données d’exemple · aucune soumission réelle</p><p>'+esc(REPORT_LABELS[kind])+' · '+esc(month)+'</p><div class="workflow"><span>Directeurs</span><b>→</b><span>Validation DG</span><b>→</b><span>Groupe</span></div>'+
 (part.hasOfficial?'<h3>Version soumise au groupe</h3><dl>'+def.columns.map(([key,label,type])=>'<dt>'+esc(label)+'</dt><dd>'+format(part[key],type)+'</dd>').join('')+'</dl>'+(part.referenceMonth?'<p class="detail-note">Référence inventaire : '+esc(monthLabel(part.referenceMonth))+' · '+format(part.previousSales,'count')+' ventes au détail.</p>':''):'<h3>Département non soumis</h3><p>Les montants en préparation restent dans la concession.</p>')+
 (row.correcting?'<p class="attention">Une correction attend une nouvelle validation du DG. La version officielle précédente est conservée.</p>':'')+(part.partial?'<p class="attention">'+esc(qualityNote(part))+'</p>':'');$('#detail').showModal();
}
function download(bytes,name,type,target=null){const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes,url=URL.createObjectURL(new Blob([data],{type})),a=target||document.createElement('a');a.href=url;a.download=name;if(parent!==window)parent.postMessage({type:'gc-preview-file-ready',bytes:data,name,mime:type},'*');if(target){a.hidden=false;return url;}document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function clearReadyFile(){if(pdfObjectUrl)URL.revokeObjectURL(pdfObjectUrl);pdfObjectUrl=null;$('#pdfReady').hidden=true;$('#pdfReady').removeAttribute('href');$('#pdfResult').textContent='';if(parent!==window)parent.postMessage({type:'gc-preview-file-clear'},'*');}
function pdfIds(){return [...document.querySelectorAll('[name="pdfDepartment"]:checked')].map(el=>el.value);}
function updatePdfSelection(){const ids=pdfIds();$('#pdfDownload').disabled=!ids.length||!rows().length;clearReadyFile();$('#pdfSelectionSummary').textContent=ids.length+' département(s) · '+rows().length+' concession(s) · '+REPORT_LABELS[kind]+' · '+monthLabel(month)+(kind==='weekly'?' · au '+weekEnd:'');}
function openPdf(ids){document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>el.checked=ids.includes(el.value));$('#pdfResult').textContent='';$('#pdfReady').hidden=true;updatePdfSelection();$('#pdfDialog').showModal();}
function refreshView(){clearReadyFile();render();}
function updateWeeks(){const weeks=reportingWeeks(month);if(!weeks.some(w=>w.periodEnd===weekEnd))weekEnd=weeks.at(-1).periodEnd;$('#week').innerHTML=weeks.map(w=>'<option value="'+w.periodEnd+'">'+w.periodStart+' au '+w.periodEnd+'</option>').join('');$('#week').value=weekEnd;}
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;refreshView();});document.querySelectorAll('[data-department]').forEach(b=>b.onclick=()=>{department=b.dataset.department;refreshView();});document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{section=b.dataset.section;refreshView();});
$('#month').onchange=e=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)||!reportingWeeks(e.target.value).length){e.target.value=month;return;}month=e.target.value;updateWeeks();refreshView();};$('#week').onchange=e=>{weekEnd=e.target.value;refreshView();};$('#scope').onchange=e=>{scope=e.target.value;refreshView();};$('#search').oninput=e=>{search=e.target.value;refreshView();};$('#closeDetail').onclick=()=>$('#detail').close();
document.querySelectorAll('[data-department]').forEach(b=>b.onkeydown=e=>{const tabs=[...document.querySelectorAll('[data-department]')],index=tabs.indexOf(b);let target;if(e.key==='ArrowRight')target=tabs[(index+1)%tabs.length];if(e.key==='ArrowLeft')target=tabs[(index+tabs.length-1)%tabs.length];if(e.key==='Home')target=tabs[0];if(e.key==='End')target=tabs.at(-1);if(target){e.preventDefault();target.focus();target.click();}});
$('#pdfOpen').onclick=()=>openPdf(Object.keys(REPORT_DEPARTMENTS));$('#pdfCurrent').onclick=()=>openPdf([department]);$('#pdfClose').onclick=()=>$('#pdfDialog').close();document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>el.onchange=updatePdfSelection);
$('#pdfAll').onclick=()=>{document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>el.checked=true);updatePdfSelection();};$('#pdfNone').onclick=()=>{document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>el.checked=false);updatePdfSelection();};
$('#pdfDownload').onclick=()=>{try{const ids=selectedDepartments(pdfIds()),data=generateGroupPdf({rows:rows(),departmentIds:ids,kind,month,scope,search,periodEnd:kind==='weekly'?weekEnd:null,simulated:!live}),name='Rapport_Groupe_Couture_'+(kind==='weekly'?weekEnd:month)+'_'+(ids.length===4?'tous-departements':ids.join('-'))+'.pdf';if(pdfObjectUrl)URL.revokeObjectURL(pdfObjectUrl);pdfObjectUrl=download(data,name,'application/pdf',$('#pdfReady'));$('#pdfResult').textContent='PDF prêt à imprimer.';}catch(error){$('#pdfResult').textContent=error.message;}};
$('#export').onclick=()=>{
 clearReadyFile();download(dashboardCsv(rows(),{department,month,kind,periodEnd:weekEnd,simulated:!live}),(live?'Rapport_Groupe_Couture_':'Exemple_Groupe_Couture_')+(kind==='weekly'?weekEnd:month)+'_'+department+'.csv','text/csv;charset=utf-8');
};
updateWeeks();
if(live){
 const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');kind='monthly_final';$('#month').value=month;updateWeeks();
 import('./live-dashboard.mjs').then(({connectLiveDashboard})=>connectLiveDashboard({
 onClear(){liveData={periods:[],submissions:[]};cachedKey=null;cachedRows=null;clearReadyFile();$('#cards').innerHTML='';$('#tableBody').innerHTML='';$('#tableFoot').innerHTML='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());},
 onData(data){dealers=data.dealerships;liveData=data;cachedKey=null;cachedRows=null;refreshView();}
 })).catch(e=>{$('#groupError').textContent='Connexion indisponible : '+e.message;});
}else render();
