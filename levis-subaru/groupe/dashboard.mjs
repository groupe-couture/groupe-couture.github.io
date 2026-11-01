import {applyPlatformBrand,brandLogoHtml} from '../branding.mjs?v=1.20.1';
import {aadPeriodLabel,aadPeriodNote} from './aad-period.mjs?v=1.20.1';
import {groupEntryLabel} from './group-membership.mjs?v=1.20.1';
import {CONCESSIONS} from '../registry.mjs?v=1.20.1';
import {dashboardDealerships,REPORT_LABELS} from './dashboard-model.mjs?v=1.20.1';
import {REPORT_DEPARTMENTS,demoDashboardReports,departmentDashboardRows,departmentTotals,filterDashboardRows,formatReportValue,departmentNotes,selectedDepartments,reportStateLabel,dashboardCsv} from './department-reporting.mjs?v=1.20.1';
import {generateGroupPdf} from './group-pdf.mjs?v=1.20.1';
import {reportingWeeks,reportDataForSelection} from './reporting.mjs?v=1.20.1';
import {historyDefinitions,historyDashboardRows,historyTotals,historyNotes,historyDates,defaultHistorySelection,historyDepartmentSelection,historyServiceAnalyses,historyServiceAnalysis} from './history-model.mjs?v=1.20.1';
import {SERVICE_ANALYSES} from './service-metrics.mjs?v=1.20.1';
import {reportingNavigation,dashboardSelection,dashboardUrl} from '../platform-navigation.mjs?v=1.20.1';
import {checkDashboardRelease} from './release-loader.mjs?v=1.20.1';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preciseNumber=new Intl.NumberFormat('fr-CA',{maximumFractionDigits:10});
const format=formatReportValue,live=document.documentElement.dataset.mode==='live';
let dealers=dashboardDealerships(CONCESSIONS).map(d=>({...d,reporting_enabled:true})),liveData={periods:[],submissions:[],history:{batch:null,records:[]}},source='official',sourceChosen=false,allowedDepartments=Object.keys(REPORT_DEPARTMENTS),ownView=false,navigation={items:[],canReadGroup:true,selectedDealership:'',workspaceId:null},dealerSearch='';
let kind='weekly',month='2026-10',weekEnd=reportingWeeks(month).at(-1).periodEnd,scope='all',search='',department='vn',section='consolidation',serviceAnalysis='mechanics',pdfObjectUrl=null,cachedKey=null,cachedRows=null,detailGeneration=0;
const historical=()=>live&&source==='history',definitions=()=>historical()?historyDefinitions(serviceAnalysis):REPORT_DEPARTMENTS;
function allRows(){const selected=dealers.filter(d=>!navigation.selectedDealership||d.id===navigation.selectedDealership),key=navigation.selectedDealership+'|'+source+'|'+kind+'|'+month+'|'+weekEnd;if(key!==cachedKey){cachedRows=historical()?historyDashboardRows(selected,liveData.history.records,{kind,month,periodEnd:weekEnd}):departmentDashboardRows(selected.filter(d=>!d.historical_only),live?reportDataForSelection(liveData,{kind,periodEnd:weekEnd}):demoDashboardReports(selected,{kind,month,periodEnd:weekEnd}),{kind,year:Number(month.slice(0,4)),month:Number(month.slice(5))});cachedKey=key;}return cachedRows;}
const rows=()=>filterDashboardRows(allRows(),{scope,search,department});
const monthLabel=m=>m?new Date(m+'-15T12:00:00').toLocaleDateString('fr-CA',{month:'short',year:'numeric'}):'';
const metric=(label,value,detail)=>'<article class="kpi"><span>'+label+'</span><strong>'+value+'</strong><small>'+detail+'</small></article>';
function selectDealer(id){
 search='';scope='all';$('#search').value='';$('#scope').value='all';
 navigation=reportingNavigation(liveData.access||{canReadGroup:true,memberships:[]},dealers,id);ownView=navigation.ownView;allowedDepartments=navigation.allowedDepartments;
 if(!allowedDepartments.includes(department))department=allowedDepartments[0]||'vn';
 if(ownView||navigation.items.find(d=>d.id===navigation.selectedDealership)?.historical_only){source='history';if(kind==='weekly')kind='month_to_date';}
 section='consolidation';cachedKey=null;updateWeeks();refreshView();
}
function renderNavigation(){
 const current=navigation.items.find(d=>d.id===navigation.selectedDealership),items=navigation.items.filter(d=>!dealerSearch||d.name.toLocaleLowerCase('fr-CA').includes(dealerSearch.toLocaleLowerCase('fr-CA')));
 $('#groupOverview').hidden=!navigation.canReadGroup;
 $('#dealerSelector').innerHTML=(navigation.canReadGroup?'<option value="">Sommaire du groupe</option>':'')+navigation.items.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+(d.historical_only?' · archives':'')+'</option>').join('');$('#dealerSelector').value=navigation.selectedDealership;
 $('#dealerLinks').innerHTML=items.map(d=>'<button data-nav-dealer="'+esc(d.id)+'" aria-pressed="'+(d.id===navigation.selectedDealership)+'">'+esc(d.name)+(d.historical_only?'<small>Archives</small>':'')+'</button>').join('')||'<p>Aucune concession trouvée.</p>';
 $('#dealerLinks').querySelectorAll('button').forEach(b=>b.onclick=()=>selectDealer(b.dataset.navDealer));
 $('#navCount').textContent=navigation.items.filter(d=>!d.historical_only).length+' concession(s)'+(navigation.items.some(d=>d.historical_only)?' · 1 archive':'');
 applyPlatformBrand(current?.id||'groupe-couture',{shell:'group'});
 const heading=document.querySelector('main h1');heading.textContent=current?current.name:'Sommaire du groupe';heading.classList.toggle('identity-title-hidden',!!current);
 const logo=$('#concessionLogo');logo.hidden=!current;if(current&&logo.dataset.logoId!==current.id){logo.innerHTML=brandLogoHtml(current.id,{maxHeight:72,maxWidth:275,label:current.name});logo.dataset.logoId=current.id;}
 $('#viewScope').textContent=current?'Rapports de la concession · '+(current.historical_only?'historique conservé':'consultation selon votre profil'):'Résultats consolidés de toutes les concessions';
 $('#concessionReturn').hidden=!navigation.workspaceId;$('#concessionReturn').href='../?concession='+encodeURIComponent(navigation.workspaceId||'');
 document.querySelectorAll('[data-department]').forEach(el=>el.hidden=!allowedDepartments.includes(el.dataset.department));
 $('#dataSource').options[0].disabled=!!current?.historical_only;
}
function renderCards(t){
 const financial=(key,note)=>t.partialTotals?'Total connu · partiel ('+(t.metricCoverage?.[key]?.received??0)+' / '+(t.metricCoverage?.[key]?.expected??0)+' concessions)':note;
 const snapshot=(key,note)=>{const c=t.metricCoverage?.[key];return c&&c.received<c.expected?'Total connu · '+c.received+' / '+c.expected+' concessions · '+note:note;};
 if(department==='vn'||department==='vo'){
  const sales=metric(department==='vn'?'Ventes neuf':'Ventes au détail',format(t.units,'count'),department==='vo'?'Wholesale : '+format(t.wholesaleUnits,'count')+' unités':(historical()?'Départements importés : ':'Départements soumis : ')+(t.expected?t.received+' / '+t.expected:'aucun département attendu'));
  const stock='<article class="kpi stock-kpi"><span>Véhicules en inventaire</span><div class="stock-pair"><strong>'+format(t.inventory,'count')+'</strong><div><b>'+format(t.coverage,'ratio')+'</b><small>mois d’inventaire</small></div></div><small>'+(t.expected===0?'Sans objet · hors groupe':t.coverage===null?esc(t.coverageReason):'Inventaire ÷ ventes détail du mois précédent'+(historical()&&!t.referenceConfirmed?' · référence à confirmer':''))+'</small></article>';
  return sales+metric('Moyenne profit véhicule',format(t.vehicleAverage,'money'),historical()?'Moyennes déclarées au détail, pondérées':department==='vo'?'Détail + wholesale, après frais':'Profit véhicule ÷ ventes au détail')+metric('Moyenne profit F&I',format(t.financeAverage,'money'),historical()?'Moyennes F&I déclarées, pondérées':'Profits F&I ÷ ventes au détail')+stock;
 }
 if(department==='service'&&historical()&&serviceAnalysis==='retained')return metric('Heures vendues',format(t.hours,'decimal'),'Heures du suivi source')+metric('Heures disponibles',format(t.presence,'decimal'),'Temps disponible déclaré')+metric('Productivité',format(t.productivity,'percent'),'Heures pointées ÷ disponibles')+metric('Efficacité',format(t.efficiency,'percent'),'Heures vendues ÷ pointées');
 if(department==='service'&&historical()&&(kind==='month_to_date'||serviceAnalysis==='organisation'||serviceAnalysis==='rates'))return metric('Aviseurs',format(t.advisors,'decimal'),snapshot('advisors','Effectif déclaré'))+metric('BR ouverts',format(t.openROs,'count'),snapshot('openROs','Photo à la date du rapport'))+metric('Techniciens',format(t.technicians,'decimal'),snapshot('technicians','Effectif déclaré'))+metric('Travaux en cours',format(t.wip,'money'),snapshot('wip','Montant déclaré · photo de la période'));
 if(department==='service'&&historical())return metric('Ventes MO totales',format(t.revenue,'money'),financial('revenue','Mécanique · mois finaux'))+metric('Brut MO total',format(t.profit,'money'),financial('profit','Montant déclaré au fichier'))+metric('Marge MO calculée',format(t.margin,'percent'),'Brut MO total ÷ ventes MO totales')+metric('Données disponibles',t.received+' / '+t.expected,'Départements service avec des valeurs source');
 if(department==='service')return metric('Heures vendues',format(t.hours,'decimal'),'Heures facturées des rapports soumis')+metric('Chiffre d’affaires',format(t.revenue,'money'),'Main-d’œuvre du service')+metric('Productivité',format(t.productivity,'percent'),'Heures pointées ÷ présence')+metric('Efficacité',format(t.efficiency,'percent'),'Heures vendues ÷ heures pointées');
 return metric('Chiffre d’affaires',format(t.revenue,'money'),financial('revenue',historical()?'Départements pièces importés':'Départements pièces soumis'))+metric('Profit brut',format(t.profit,'money'),financial('profit','Résultats de la période'))+metric('Marge brute',format(t.margin,'percent'),'Profit brut ÷ chiffre d’affaires')+(historical()?metric('Données disponibles',t.received+' / '+t.expected,'Départements avec des valeurs source'):metric('Factures',format(t.invoices,'count'),'Nombre de factures'));
}
function qualityNote(part){const financial=[...new Set(Object.values(part.metricMissingMonths||{}).flat())];return part.missingMonths?.length?part.missingMonths.length+' mois manquant(s) : '+part.missingMonths.map(monthLabel).join(', '):financial.length?'Données financières partielles : '+financial.map(monthLabel).join(', '):part.issues?.length?part.issues.includes('reportedMargin')?'Marge Pièces : format de la cellule source à confirmer':'Brut pièces clients : format du pourcentage à confirmer':part.partial?'Données incomplètes dans '+(historical()?'le fichier source':'la version soumise'):'';}
function cells(part){return definitions()[department].columns.map(([key,,type])=>{
 if(part.outsideGroup)return '<td class="num">—</td>';
 let detail='';
 if(key==='coverage')detail=part.coverage===null?part.coverageReason:format(part.inventory,'count')+' ÷ '+format(part.previousSales,'count')+' · ventes '+monthLabel(part.referenceMonth)+(historical()&&!part.referenceConfirmed?' · à confirmer':'');
 if(key==='inventory'&&part.stockMonth)detail='Photo : '+(part.stockAsOf||monthLabel(part.stockMonth));
 return '<td class="num">'+format(part[key],type)+(detail?'<small>'+esc(detail)+'</small>':'')+'</td>';
}).join('');}
function render(){
 renderNavigation();
 if(historical()){
  const next=historyDepartmentSelection(liveData.history.records,{kind,month,periodEnd:weekEnd},department);kind=next.kind;
  if(department==='service')serviceAnalysis=historyServiceAnalysis(allRows(),serviceAnalysis,kind);
 }
 const current=rows(),def=definitions()[department],t=(historical()?historyTotals:departmentTotals)(current,department),received=t.received;
 $('#periodLabel').textContent=kind==='ytd'?aadPeriodLabel(allRows()[0]?.aad)+' · sélection : '+monthLabel(month):REPORT_LABELS[kind]+' · '+new Date(month+'-15T12:00:00').toLocaleDateString('fr-CA',{month:'long',year:'numeric'})+(['weekly','month_to_date'].includes(kind)?' · au '+weekEnd:'');
 $('#dataSource').closest('label').hidden=!live||ownView;
 $('#weekControl').firstChild.textContent=historical()?'Situation ':'Semaine ';
 $('#weekControl').hidden=!['weekly','month_to_date'].includes(kind);
 $('#reportCounts').textContent=t.completed+' / '+current.length+' départements complétés · '+received+' '+(historical()?'importés':'soumis')+(t.exempt?' · '+t.exempt+' hors groupe':'')+' · '+def.label;
 document.querySelector('footer span:last-child').textContent=historical()?'Historique Google Sheets 2026 · lecture seule':'Saisie directeurs → validation DG → soumission au groupe';
 $('#coverageRule').textContent=kind==='ytd'?aadPeriodNote(allRows()[0]?.aad):historical()?'Historique importé en lecture seule. Les cases de balance proviennent du fichier; elles ne constituent pas une validation dans la plateforme. Le cumul additionne les mois finaux seulement.':'Seules les versions soumises entrent dans les résultats. Le cumul annuel utilise les mois finaux confirmés.';
 document.querySelector('[data-kind="weekly"]').hidden=historical();document.querySelector('[data-kind="month_to_date"]').hidden=!historical()||historyDepartmentSelection(liveData.history.records,{kind:'month_to_date',month,periodEnd:weekEnd},department).kind!=='month_to_date';
 document.querySelector('[data-section="submissions"]').hidden=historical();
 $('#scope').options[1].textContent=historical()?'Complétés / importés':'Complétés / soumis';$('#scope').options[2].textContent='À compléter';
 $('#coverageText').textContent=t.pending+' à compléter · '+(section==='submissions'?'suivi des soumissions':'vue consolidée');
 $('#coverageBar').style.width=(current.length?100*t.completed/current.length:0)+'%';
 $('#cards').innerHTML=renderCards(t);$('#cards').hidden=section==='submissions';$('#sectionTitle').textContent=(section==='submissions'?'Suivi des soumissions · ':'')+def.label;$('#departmentPanel').setAttribute('aria-labelledby','tab-'+department);
 const notice=$('#historyPeriodNotice'),financialButton=$('#historyMonthlyResults');
 notice.hidden=!historical()||!['service','parts'].includes(department)||section==='submissions';
 $('#historyPeriodText').textContent=department==='parts'?'Pièces · les ventes, le profit brut et la marge proviennent des onglets « Final ». Aucun suivi Pièces du mois à date n’est fourni dans Téléprésence.':kind==='month_to_date'?'Service · situation au '+weekEnd+' : effectifs, BR ouverts, travaux en cours, matériel et taux selon les cellules renseignées. Les résultats financiers sont dans l’onglet « Final » du mois.':kind==='ytd'?'Service · résultats des mois finaux inclus dans l’AAD. Effectifs, BR et taux : dernière photo disponible.':'Service · résultats de mécanique de l’onglet « Final ». Les analyses ci-dessous donnent accès aux autres données renseignées pour le mois.';
 financialButton.hidden=department!=='service'||kind!=='month_to_date';financialButton.onclick=()=>{kind='monthly_final';serviceAnalysis='mechanics';refreshView();};
 const serviceTabs=$('#serviceAnalyses'),available=historical()?historyServiceAnalyses(allRows()):[];serviceTabs.hidden=!(historical()&&department==='service'&&section!=='submissions');serviceTabs.innerHTML=Object.entries(SERVICE_ANALYSES).map(([id,a])=>'<button data-service-analysis="'+id+'" aria-pressed="'+(serviceAnalysis===id)+'" '+(!available.includes(id)?'disabled title="Non renseigné dans le fichier pour cette période"':'')+'>'+esc(a.label)+'</button>').join('');serviceTabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{serviceAnalysis=b.dataset.serviceAnalysis;refreshView();});
 $('#tableHead').innerHTML=section==='submissions'?'<tr><th>Concession</th><th>Départements complétés</th><th>Validation DG</th><th>Version officielle</th><th>État</th><th></th></tr>':'<tr><th>Concession</th>'+def.columns.map(([,label])=>'<th class="num">'+esc(label)+'</th>').join('')+'<th>Rapport</th><th></th></tr>';
 $('#tableBody').innerHTML=current.map(row=>{
  const part=row.departments[department];
  const note=part.outsideGroup?'Période complétée · aucune saisie requise':qualityNote(part)||(historical()?part.hasOfficial?'Source : '+(part.source?.sheetTitle||'mois finaux'):'Aucun résultat fourni pour cette période':row.correcting&&part.hasOfficial?'Correction en attente · version officielle conservée':part.hasOfficial?kind==='ytd'?'Mois finaux soumis seulement':'Version soumise':'Données non soumises');
  const workflow=part.outsideGroup?'<td>'+row.total+' / '+row.total+'</td><td>Non requise · hors groupe</td><td>Sans objet</td>':'<td>'+row.completed+' / '+row.total+'</td><td>'+(row.correcting?'À revalider':row.status==='submitted'||row.status==='validated'?'Validé par le DG':'À valider')+'</td><td>'+(part.hasOfficial?'Disponible':'À recevoir')+'</td>';
  return '<tr data-dealer="'+esc(row.id)+'" tabindex="0"><td><strong>'+esc(row.name)+'</strong>'+(groupEntryLabel(row)?'<small class="entry-month">'+esc(groupEntryLabel(row))+'</small>':'')+'<small>'+esc(note)+'</small></td>'+(section==='submissions'?workflow:cells(part))+'<td><span class="state '+(part.outsideGroup||part.hasOfficial&&!part.partial&&!row.correcting?'green':row.status==='validated'?'blue':'amber')+'">'+esc(reportStateLabel(row,department))+'</span>'+(kind==='monthly_final'&&part.hasOfficial&&row.balance?'<small class="balanced">✓ Balance avec le bilan</small>':'')+'</td><td><button class="open-report" aria-label="Voir '+esc(def.label)+' de '+esc(row.name)+'">Voir →</button></td></tr>';
 }).join('')||'<tr><td colspan="'+(section==='submissions'?6:def.columns.length+3)+'">Aucune concession dans cette sélection.</td></tr>';
 $('#tableFoot').innerHTML=section==='submissions'?'<tr><th>Réception du département</th><td colspan="5">'+t.completed+' / '+t.dealers+' · '+esc(def.label)+'</td></tr>':'<tr><th>'+(historical()?t.partialTotals?'Total connu · partiel':navigation.selectedDealership?'Concession importée':'Groupe importé':'Groupe soumis')+'</th>'+def.columns.map(([key,,type])=>'<th class="num">'+format(t[key],type)+'</th>').join('')+'<td>'+t.completed+' / '+t.dealers+'</td><td></td></tr>';
 $('#calculationNotes').innerHTML=(historical()?historyNotes:departmentNotes)(department).map(n=>'<p>'+esc(n)+'</p>').join('');
 document.querySelectorAll('[data-dealer]').forEach(el=>{el.onclick=()=>openReport(current.find(r=>r.id===el.dataset.dealer));el.onkeydown=e=>{if(e.target===el&&['Enter',' '].includes(e.key)){e.preventDefault();el.click();}};});
 document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kind===kind));
 document.querySelectorAll('[data-department]').forEach(b=>{b.setAttribute('aria-selected',b.dataset.department===department);b.tabIndex=b.dataset.department===department?0:-1;});
 document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('selected',b.dataset.section===section&&(b.id!=='groupOverview'||!navigation.selectedDealership)));
 for(const id of ['export','pdfOpen','pdfCurrent'])$('#'+id).disabled=!current.length;
 if(live&&liveData.access)history.replaceState(null,'',dashboardUrl(location.href,{dealershipId:navigation.selectedDealership,source,department,kind,month,periodEnd:['weekly','month_to_date'].includes(kind)?weekEnd:null}));
}
function sourceFields(fields){return '<dl>'+fields.map(f=>'<dt>'+esc(f.label)+' <small>'+esc(f.cell)+'</small></dt><dd>'+esc(f.value&&typeof f.value==='object'?'Erreur '+f.value.error:typeof f.value==='number'?(f.format==='CURRENCY'?format(f.value,'money'):preciseNumber.format(f.format==='PERCENT'?f.value*100:f.value)+(f.format==='PERCENT'?' %':'')):f.value??'—')+'</dd>').join('')+'</dl>';}
async function openReport(row){
 const part=row.departments[department],def=definitions()[department];$('#detailTitle').textContent=row.name+' · '+def.label;
 if(part.outsideGroup){$('#detailContent').innerHTML='<p class="attention">Complété — hors groupe</p><p>'+esc(groupEntryLabel(row))+'.</p><p>Cette période précède son intégration. Aucune saisie requise; aucun chiffre ajouté aux résultats ou aux moyennes du groupe.</p>';$('#detail').showModal();return;}
 if(historical()){
  const token=++detailGeneration;
  if(kind!=='ytd'&&part.source&&liveData.history.readFields&&!part.fieldsLoaded){
   $('#detailContent').textContent='Chargement des données autorisées du département…';$('#detail').showModal();
   try{const data=await liveData.history.readFields(part.source);if(token!==detailGeneration||!$('#detail').open)return;part.fields=data.find(r=>r.section===def.section)?.fields||[];row.direction=data.find(r=>r.section==='direction:all')?.fields||[];part.fieldsLoaded=true;}
   catch(e){if(token===detailGeneration&&$('#detail').open)$('#detailContent').textContent='Chargement impossible : '+e.message;return;}
  }
  $('#detailContent').innerHTML='<p class="attention">Historique importé · '+esc(reportStateLabel(row,department))+'</p><p>'+esc(kind==='ytd'?aadPeriodLabel(row.aad):REPORT_LABELS[kind]+' · '+month)+'</p>'+(kind==='ytd'?'<p>'+esc(aadPeriodNote(row.aad))+'</p><p>Mois inclus : '+esc(part.includedMonths.map(monthLabel).join(', ')||'aucun')+'</p>':'')+def.columns.map(([key,label,type])=>'<p>'+esc(label)+' : <strong>'+format(part[key],type)+'</strong></p>').join('')+(part.partial?'<p class="attention">'+esc(qualityNote(part))+'</p>':'')+(part.source?'<p><a target="_blank" rel="noopener" href="'+esc(liveData.history.batch.source_url+'#gid='+part.source.sheetId+'&range=A'+part.source.row)+'">'+(kind==='ytd'?'Source du dernier mois inclus':'Voir la ligne du fichier source')+' ↗</a></p>':'')+(part.fields?.length?'<h3>Toutes les données du département</h3>'+sourceFields(part.fields):'')+(kind!=='ytd'&&row.direction.length?'<details><summary>Données de direction de la ligne source</summary>'+sourceFields(row.direction)+'</details>':'');
  $('#detail').showModal();return;
 }
 $('#detailContent').innerHTML='<p class="demo-tag">'+(live?'Données du serveur':'Données d’exemple · aucune soumission réelle')+'</p><p>'+esc(kind==='ytd'?aadPeriodLabel(row.aad):REPORT_LABELS[kind]+' · '+month)+'</p>'+(kind==='ytd'?'<p>'+esc(aadPeriodNote(row.aad))+'</p>':'')+'<div class="workflow"><span>Directeurs</span><b>→</b><span>Validation DG</span><b>→</b><span>Groupe</span></div>'+
 (part.hasOfficial?'<h3>Version soumise au groupe</h3><dl>'+def.columns.map(([key,label,type])=>'<dt>'+esc(label)+'</dt><dd>'+format(part[key],type)+'</dd>').join('')+'</dl>'+(part.referenceMonth?'<p class="detail-note">Référence inventaire : '+esc(monthLabel(part.referenceMonth))+' · '+format(part.previousSales,'count')+' ventes au détail.</p>':''):'<h3>Département non soumis</h3><p>Les montants en préparation restent dans la concession.</p>')+
 (row.correcting?'<p class="attention">Une correction attend une nouvelle validation du DG. La version officielle précédente est conservée.</p>':'')+(part.partial?'<p class="attention">'+esc(qualityNote(part))+'</p>':'');$('#detail').showModal();
}
function download(bytes,name,type,target=null){const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes,url=URL.createObjectURL(new Blob([data],{type})),a=target||document.createElement('a');a.href=url;a.download=name;if(!live&&parent!==window)parent.postMessage({type:'gc-preview-file-ready',bytes:data,name,mime:type},'*');if(target){a.hidden=false;return url;}document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function clearReadyFile(){if(pdfObjectUrl)URL.revokeObjectURL(pdfObjectUrl);pdfObjectUrl=null;$('#pdfReady').hidden=true;$('#pdfReady').removeAttribute('href');$('#pdfView').hidden=true;$('#pdfView').removeAttribute('href');$('#pdfResult').textContent='';if(!live&&parent!==window)parent.postMessage({type:'gc-preview-file-clear'},'*');}
function pdfIds(){return [...document.querySelectorAll('[name="pdfDepartment"]:checked')].map(el=>el.value).filter(id=>allowedDepartments.includes(id));}
function updatePdfSelection(){const ids=pdfIds();$('#pdfDownload').disabled=!ids.length||!rows().length;clearReadyFile();$('#pdfSelectionSummary').textContent=ids.length+' département(s) · '+rows().length+' concession(s) · '+(kind==='ytd'?aadPeriodLabel(allRows()[0]?.aad)+' · sélection : '+monthLabel(month):REPORT_LABELS[kind]+' · '+monthLabel(month))+(['weekly','month_to_date'].includes(kind)?' · au '+weekEnd:'');}
function openPdf(ids){document.querySelectorAll('[name="pdfDepartment"]').forEach(el=>{el.checked=ids.includes(el.value)&&allowedDepartments.includes(el.value);el.closest('label').hidden=!allowedDepartments.includes(el.value);});$('#pdfResult').textContent='';$('#pdfReady').hidden=true;updatePdfSelection();$('#pdfDialog').showModal();}
function refreshView(){clearReadyFile();render();}
function updateWeeks(){
 if(historical()){const dates=historyDates(liveData.history.records,month);if(!dates.includes(weekEnd))weekEnd=dates.at(-1)||'';$('#week').innerHTML=dates.map(d=>'<option value="'+d+'">Situation au '+d+'</option>').join('');}
 else{const weeks=reportingWeeks(month);if(!weeks.some(w=>w.periodEnd===weekEnd))weekEnd=weeks.at(-1).periodEnd;$('#week').innerHTML=weeks.map(w=>'<option value="'+w.periodEnd+'">'+w.periodStart+' au '+w.periodEnd+'</option>').join('');}$('#week').value=weekEnd;
}
$('#dataSource').onchange=e=>{source=e.target.value;sourceChosen=true;section='consolidation';if(historical()&&kind==='weekly')kind='month_to_date';if(!historical()&&kind==='month_to_date')kind='weekly';updateWeeks();refreshView();};
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;if(department==='service')serviceAnalysis=kind==='month_to_date'?'organisation':'mechanics';refreshView();});document.querySelectorAll('[data-department]').forEach(b=>b.onclick=()=>{department=b.dataset.department;if(department==='service')serviceAnalysis=kind==='month_to_date'?'organisation':'mechanics';refreshView();});document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{section=b.dataset.section;refreshView();});
$('#groupOverview').onclick=()=>selectDealer('');$('#dealerSelector').onchange=e=>selectDealer(e.target.value);$('#dealerSearch').oninput=e=>{dealerSearch=e.target.value;renderNavigation();};
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
 applyPlatformBrand('groupe-couture',{shell:'group'});
 const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');kind='monthly_final';$('#month').value=month;updateWeeks();
 import('./live-dashboard.mjs?v=1.20.1').then(({connectLiveDashboard})=>connectLiveDashboard({
 onReload:()=>checkDashboardRelease({currentVersion:document.documentElement.dataset.version,href:location.href}),
 onClear(){detailGeneration++;sourceChosen=false;liveData={periods:[],submissions:[],history:{batch:null,records:[]}};navigation={items:[],canReadGroup:false,selectedDealership:'',workspaceId:null};cachedKey=null;cachedRows=null;clearReadyFile();$('#cards').innerHTML='';$('#tableBody').innerHTML='';$('#tableFoot').innerHTML='';$('#dealerLinks').innerHTML='';$('#dealerSelector').innerHTML='';$('#concessionLogo').hidden=true;applyPlatformBrand('groupe-couture',{shell:'group'});document.querySelectorAll('dialog[open]').forEach(d=>d.close());},
 onData(data){
  dealers=data.dealerships;liveData=data;navigation=reportingNavigation(data.access||{canReadGroup:!data.ownView,memberships:[]},dealers,new URLSearchParams(location.search).get('concession')||'');ownView=navigation.ownView;allowedDepartments=navigation.allowedDepartments;
  if(!allowedDepartments.includes(department))department=allowedDepartments[0]||'vn';
  document.querySelectorAll('[data-department]').forEach(el=>el.hidden=!allowedDepartments.includes(el.dataset.department));
  $('#dataSource').hidden=ownView;$('#dataSource').options[1].disabled=!data.history.batch;
  if(!sourceChosen){source=data.history.batch?'history':'official';const initial=source==='history'?defaultHistorySelection(data.history.records):null;if(initial){month=initial.month;kind=initial.kind;weekEnd=initial.periodEnd;}
   const route=dashboardSelection(location.search);if(route.source&&(route.source!=='history'||data.history.batch))source=route.source;if(route.department&&allowedDepartments.includes(route.department))department=route.department;if(route.month&&reportingWeeks(route.month).length)month=route.month;if(route.kind)kind=route.kind;if(route.periodEnd)weekEnd=route.periodEnd;
   if(source==='history'&&kind==='weekly')kind='month_to_date';if(source==='official'&&kind==='month_to_date')kind='weekly';serviceAnalysis=kind==='month_to_date'?'organisation':'mechanics';$('#month').value=month;sourceChosen=true;}
  if(ownView||navigation.items.find(d=>d.id===navigation.selectedDealership)?.historical_only){source='history';if(kind==='weekly')kind='month_to_date';}$('#dataSource').value=source;
  section=historical()?'consolidation':section;updateWeeks();cachedKey=null;cachedRows=null;refreshView();
 }
 })).catch(e=>{$('#groupError').textContent='Connexion indisponible : '+e.message;});
}else{navigation=reportingNavigation({canReadGroup:true,memberships:[]},dealers);render();}
