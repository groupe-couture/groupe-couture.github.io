import {groupStartMonth,outsideGroup} from './group-membership.mjs?v=1.20.1';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const monthName=m=>new Date(m+'-15T12:00:00Z').toLocaleDateString('fr-CA',{month:'long',timeZone:'America/Toronto'});
export function selectAadPeriod(dealers,observations,selectedMonth,{source='history'}={}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth))throw Error('Mois AAD invalide.');
 const year=selectedMonth.slice(0,4),latest=[],missingDealerIds=[];
 for(const dealer of dealers){
  if(outsideGroup(dealer,selectedMonth))continue;
  const start=groupStartMonth(dealer),own=observations.filter(r=>r.dealershipId===dealer.id&&r.month?.slice(0,4)===year&&r.month<=selectedMonth&&(!start||r.month>=start));
  // Le calendrier de groupe utilise les livraisons VN/VO. Un directeur limité à
  // un département utilise les seules données autorisées de son département.
  const sections=[...new Set(own.map(r=>r.section))],sales=sections.filter(s=>s.startsWith('vente:'));
  const required=sales.length?sales:sections.filter(s=>['service:all','piece:all'].includes(s));
  const available=[...new Set(own.map(r=>r.month))].filter(m=>required.length&&required.every(s=>own.some(r=>r.month===m&&r.section===s&&r.available))).sort();
  if(available.length)latest.push(available.at(-1));else missingDealerIds.push(dealer.id);
 }
 const throughMonth=latest.sort()[0]||null;
 return {selectedMonth,year,fromMonth:year+'-01',throughMonth,source,missingDealerIds,
  deferredMonths:throughMonth?Array.from({length:Number(selectedMonth.slice(5))-Number(throughMonth.slice(5))},(_,i)=>year+'-'+String(Number(throughMonth.slice(5))+i+1).padStart(2,'0')):[]};
}
export function historyAadPeriod(dealers,records,month){
 const observations=records.filter(r=>r.kind==='monthly_final').map(r=>({dealershipId:r.dealership_id,month:r.as_of.slice(0,7),section:r.section,
  available:r.data.hasActual===true&&(r.section.startsWith('vente:')?finite(r.data.values.units):finite(r.data.values.revenue)&&finite(r.data.values.profit))}));
 return selectAadPeriod(dealers,observations,month,{source:'history'});
}
export function officialAadPeriod(dealers,submissions,month){
 const observations=submissions.filter(r=>r.snapshot.kind==='monthly_final').flatMap(r=>Object.keys(r.snapshot.sections).map(section=>({dealershipId:r.dealership_id,month:r.snapshot.endDate.slice(0,7),section,available:true})));
 return selectAadPeriod(dealers,observations,month,{source:'official'});
}
export function aadPeriodLabel(aad){
 if(!aad?.throughMonth)return 'AAD '+(aad?.year||'')+' · aucun mois final disponible';
 return 'AAD '+aad.year+' · janvier'+(aad.throughMonth.endsWith('-01')?'':' à '+monthName(aad.throughMonth));
}
export function aadPeriodNote(aad){
 if(!aad?.throughMonth)return 'Aucun mois final '+(aad?.source==='official'?'soumis':'disponible')+' pour cette année. Aucun résultat d’une autre année n’est repris.';
 return 'Période commune incluse : janvier'+(aad.throughMonth.endsWith('-01')?'':' à '+monthName(aad.throughMonth))+' '+aad.year+'. '+
  (aad.deferredMonths.length===1?monthName(aad.selectedMonth).replace(/^./,c=>c.toUpperCase())+' en attente : non inclus. ':aad.deferredMonths.length?'Les mois après '+monthName(aad.throughMonth)+' sont en attente et ne sont pas inclus. ':'')+
  (aad.missingDealerIds.length?aad.missingDealerIds.length+' concession(s) sans mois final disponible restent à compléter. ':'')+
  'L’inventaire reste la dernière photo datée. Les lacunes des mois inclus restent signalées.';
}
