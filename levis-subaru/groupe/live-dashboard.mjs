import {passwordReturnTarget} from '../password-flow.mjs?v=1.20.1';
import {supabaseConfig} from '../supabase-config.js?v=1.20.1';
import {readAccessContext} from '../access-context.mjs?v=1.20.1';
import {createCentralReporting} from './reporting.mjs?v=1.20.1';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeReportPeriods(periods,progress,submissions){
 return periods.map(p=>({...p,endDate:p.end_date,total:p.required_sections.length,
 completed:progress.filter(r=>r.period_id===p.id&&r.ready).length,
 balanceWithStatement:p.balance_with_statement===true,
 correcting:p.status!=='submitted'&&submissions.some(s=>s.period_id===p.id)}));
}
export async function connectLiveDashboard({onData,onClear,onReload=async()=>false}){
 const passwordTarget=passwordReturnTarget(location.href);if(passwordTarget){location.replace(passwordTarget);return;}
 const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm');
 const client=createClient(supabaseConfig.url,supabaseConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}),api=createCentralReporting(client);
 let generation=0,pending=false,authenticated=false,historyCache=null,scopeKey='';
 async function refresh({clear=false}={}){
  if(pending&&!clear)return;const token=++generation;pending=true;if(clear){onClear();$('#groupShell').hidden=true;}$('#groupError').textContent='';
  try{
   const scope=await readAccessContext(client);if(token!==generation)return;
   $('#ownConcessions').innerHTML=scope.memberships.map(m=>'<a href="../?concession='+encodeURIComponent(m.dealership_id)+'">'+esc(m.name)+'</a>').join('');
   const operational=scope.memberships.filter(m=>['admin','dg','director'].includes(m.role)&&m.reporting_enabled);
   if(!scope.canReadGroup&&!operational.length){historyCache=null;onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#groupError').textContent='Ce compte n’a pas accès aux indicateurs. Ouvrez votre concession pour consulter les écrans permis.';return;}
   const nextScope=JSON.stringify(scope);if(scopeKey!==nextScope){historyCache=null;onClear();scopeKey=nextScope;}
   const ownView=!scope.canReadGroup;
   const [dealerships,periods,submissions,progress,history]=await Promise.all([api.dealerships(),ownView?[]:api.periods(),ownView?[]:api.submissions(),ownView?[]:api.progress(),historyCache?Promise.resolve(historyCache):api.history()]);
   if(token!==generation)return;
   history.readFields=source=>api.historyFields(history.batch.id,source.sheetId,source.row);historyCache=history;
   onData({dealerships,periods:normalizeReportPeriods(periods,progress,submissions),submissions,history,ownView,access:scope});
   $('#groupLogin').hidden=true;$('#groupShell').hidden=false;
   $('#liveStatus').textContent='Données du serveur · '+(history.batch?'historique Google Sheets disponible · ':'')+'actualisé à '+new Date().toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'});
  }catch(e){if(token!==generation)return;onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#groupError').textContent=e.message||'Chargement impossible.';}
  finally{if(token===generation)pending=false;}
 }
 $('#groupLoginForm').onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;try{const {error}=await client.auth.signInWithPassword({email:f.elements.email.value.trim(),password:f.elements.password.value});if(error)throw error;f.elements.password.value='';}catch(err){$('#groupError').textContent=err.message;}finally{b.disabled=false;}};
 $('#groupLogout').onclick=()=>client.auth.signOut();$('#groupReload').onclick=async()=>{
  const button=$('#groupReload');button.disabled=true;
  try{if(await onReload())return;}
  catch{/* Une erreur de vérification ne bloque pas l’actualisation des données. */}
  finally{button.disabled=false;}
  historyCache=null;await refresh();
 };
 client.auth.onAuthStateChange((event,session)=>{
  if(!['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
  authenticated=!!session?.user;generation++;historyCache=null;scopeKey='';onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#ownConcessions').innerHTML='';
  if(authenticated)queueMicrotask(()=>refresh({clear:true}));
 });
 const timer=setInterval(async()=>{if(authenticated&&!document.hidden&&!await onReload())refresh();},30000);
 document.addEventListener('visibilitychange',async()=>{if(authenticated&&!document.hidden&&!await onReload())refresh();});
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
