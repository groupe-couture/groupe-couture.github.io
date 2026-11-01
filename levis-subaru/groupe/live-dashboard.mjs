import {supabaseConfig} from '../supabase-config.js?v=1.19.2';
import {readAccessContext} from '../access-context.mjs?v=1.19.2';
import {createCentralReporting} from './reporting.mjs?v=1.19.2';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeReportPeriods(periods,progress,submissions){
 return periods.map(p=>({...p,endDate:p.end_date,total:p.required_sections.length,
 completed:progress.filter(r=>r.period_id===p.id&&r.ready).length,
 balanceWithStatement:p.balance_with_statement===true,
 correcting:p.status!=='submitted'&&submissions.some(s=>s.period_id===p.id)}));
}
export async function connectLiveDashboard({onData,onClear}){
 const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
 const client=createClient(supabaseConfig.url,supabaseConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}),api=createCentralReporting(client);
 let generation=0,pending=false,authenticated=false,historyCache=null,scopeKey='';
 const selectedDealer=new URLSearchParams(location.search).get('concession');
 async function refresh({clear=false}={}){
  if(pending&&!clear)return;const token=++generation;pending=true;if(clear){onClear();$('#groupShell').hidden=true;}$('#groupError').textContent='';
  try{
   const scope=await readAccessContext(client);if(token!==generation)return;
   $('#ownConcessions').innerHTML=scope.memberships.map(m=>'<a href="../?concession='+encodeURIComponent(m.dealership_id)+'">'+esc(m.name)+'</a>').join('');
   const operational=scope.memberships.filter(m=>['admin','dg','director'].includes(m.role)&&m.reporting_enabled&&(!selectedDealer||m.dealership_id===selectedDealer));
   if(!scope.canReadGroup&&!operational.length){historyCache=null;onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#groupError').textContent='Ce compte n’a pas accès aux indicateurs. Ouvrez votre concession pour consulter les écrans permis.';return;}
   const nextScope=JSON.stringify(scope);if(scopeKey!==nextScope){historyCache=null;onClear();scopeKey=nextScope;}
   const ownView=!scope.canReadGroup||!!selectedDealer;
   const [allDealers,periods,submissions,progress,history]=await Promise.all([api.dealerships(),ownView?[]:api.periods(),ownView?[]:api.submissions(),ownView?[]:api.progress(),historyCache?Promise.resolve(historyCache):api.history(selectedDealer)]);
   const dealerships=allDealers.filter(d=>!selectedDealer||d.id===selectedDealer);
   if(token!==generation)return;
   history.readFields=source=>api.historyFields(history.batch.id,source.sheetId,source.row);historyCache=history;
   const allSections=['vente:VN','vente:VO','service:all','piece:all'],sections=scope.canReadGroup?allSections:[...new Set(operational.flatMap(m=>['admin','dg'].includes(m.role)?allSections:m.sections))];
   onData({dealerships,periods:normalizeReportPeriods(periods,progress,submissions),submissions,history,ownView,allowedDepartments:Object.entries({vn:'vente:VN',vo:'vente:VO',service:'service:all',parts:'piece:all'}).filter(([,s])=>sections.includes(s)).map(([id])=>id)});
   $('#groupLogin').hidden=true;$('#groupShell').hidden=false;
   $('#liveStatus').textContent='Données du serveur · '+(history.batch?'historique Google Sheets disponible · ':'')+'actualisé à '+new Date().toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'});
  }catch(e){if(token!==generation)return;onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#groupError').textContent=e.message||'Chargement impossible.';}
  finally{if(token===generation)pending=false;}
 }
 $('#groupLoginForm').onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;try{const {error}=await client.auth.signInWithPassword({email:f.elements.email.value.trim(),password:f.elements.password.value});if(error)throw error;f.elements.password.value='';}catch(err){$('#groupError').textContent=err.message;}finally{b.disabled=false;}};
 $('#groupLogout').onclick=()=>client.auth.signOut();$('#groupReload').onclick=()=>{historyCache=null;refresh();};
 client.auth.onAuthStateChange((event,session)=>{
  if(!['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
  authenticated=!!session?.user;generation++;historyCache=null;scopeKey='';onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#ownConcessions').innerHTML='';
  if(authenticated)queueMicrotask(()=>refresh({clear:true}));
 });
 const timer=setInterval(()=>{if(authenticated&&!document.hidden)refresh();},30000);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
