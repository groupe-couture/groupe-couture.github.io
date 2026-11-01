const order=new Intl.Collator('fr-CA',{sensitivity:'base',numeric:true});
const sections={vn:'vente:VN',vo:'vente:VO',service:'service:all',parts:'piece:all'};
const reportingRoles=new Set(['admin','dg','director']);
export const sortConcessions=items=>[...items].sort((a,b)=>order.compare(a.name||'',b.name||'')||order.compare(a.id||'',b.id||''));
export function reportingNavigation(context,dealerships,requested=''){
 const memberships=context?.memberships||[],canReadGroup=context?.canReadGroup===true;
 const reporters=memberships.filter(m=>reportingRoles.has(m.role)&&m.reporting_enabled===true);
 const items=sortConcessions(dealerships.filter(d=>canReadGroup?(d.reporting_enabled||d.historical_only):reporters.some(m=>m.dealership_id===d.id)));
 const valid=items.some(d=>d.id===requested),selectedDealership=valid?requested:canReadGroup?'':items[0]?.id||'';
 const own=reporters.find(m=>m.dealership_id===selectedDealership);
 const allowedSections=canReadGroup||['admin','dg'].includes(own?.role)?Object.values(sections):own?.sections||[];
 return {items,canReadGroup,selectedDealership,ownView:!canReadGroup,
  allowedDepartments:Object.entries(sections).filter(([,s])=>allowedSections.includes(s)).map(([id])=>id),
  workspaceId:memberships.some(m=>m.dealership_id===selectedDealership)&&!items.find(d=>d.id===selectedDealership)?.historical_only?selectedDealership:null,
  rejectedSelection:!!requested&&!valid};
}
export function workspaceNavigation(context,dealerships){
 const memberships=context?.memberships||[];
 return sortConcessions(dealerships.filter(d=>memberships.some(m=>m.dealership_id===d.id)||context?.canReadGroup===true&&(d.reporting_enabled||d.historical_only)).map(d=>({...d,
  destination:memberships.some(m=>m.dealership_id===d.id)&&!d.historical_only?'workspace':'reports'})));
}
export function platformDestination(item,{workspacePath='./',groupPath='./groupe/plateforme.html'}={}){
 if(!item||!['workspace','reports'].includes(item.destination))throw Error('Destination de concession invalide.');
 return (item.destination==='workspace'?workspacePath:groupPath)+'?concession='+encodeURIComponent(item.id);
}
export function dashboardSelection(search){
 const p=new URLSearchParams(search),selection={};
 if(['official','history'].includes(p.get('source')))selection.source=p.get('source');
 if(['vn','vo','service','parts'].includes(p.get('department')))selection.department=p.get('department');
 if(['weekly','monthly_final','month_to_date','ytd'].includes(p.get('view')))selection.kind=p.get('view');
 if(/^\d{4}-(0[1-9]|1[0-2])$/.test(p.get('month')||''))selection.month=p.get('month');
 if(/^\d{4}-\d{2}-\d{2}$/.test(p.get('situation')||''))selection.periodEnd=p.get('situation');
 return selection;
}
export function dashboardUrl(href,state){
 const url=new URL(href);
 for(const [key,value]of Object.entries({concession:state.dealershipId,source:state.source,department:state.department,view:state.kind,month:state.month,situation:state.periodEnd})){
  if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
 }
 return url;
}
