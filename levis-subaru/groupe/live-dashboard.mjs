import {supabaseConfig} from '../supabase-config.js';
import {readAccessContext} from '../access-context.mjs';
import {createCentralReporting} from './reporting.mjs';
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
 let generation=0,pending=false,authenticated=false;
 async function refresh({clear=false}={}){
  if(pending&&!clear)return;const token=++generation;pending=true;if(clear){onClear();$('#groupShell').hidden=true;}$('#groupError').textContent='';
  try{
   const scope=await readAccessContext(client);if(token!==generation)return;
   $('#ownConcessions').innerHTML=scope.memberships.map(m=>'<a href="../?concession='+encodeURIComponent(m.dealership_id)+'">'+esc(m.name)+'</a>').join('');
   if(!scope.canReadGroup){onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#groupError').textContent='L’accès aux données du groupe est réservé aux DG et aux lecteurs du groupe autorisés. Ouvrez votre concession pour consulter les écrans permis.';return;}
   const [dealerships,periods,submissions,progress]=await Promise.all([api.dealerships(),api.periods(),api.submissions(),api.progress()]);
   if(token!==generation)return;
   onData({dealerships,periods:normalizeReportPeriods(periods,progress,submissions),submissions});
   $('#groupLogin').hidden=true;$('#groupShell').hidden=false;
   $('#liveStatus').textContent='Données du serveur · seules les versions soumises sont consolidées · actualisé à '+new Date().toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'});
  }catch(e){if(token!==generation)return;onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#groupError').textContent=e.message||'Chargement impossible.';}
  finally{if(token===generation)pending=false;}
 }
 $('#groupLoginForm').onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;try{const {error}=await client.auth.signInWithPassword({email:f.elements.email.value.trim(),password:f.elements.password.value});if(error)throw error;f.elements.password.value='';}catch(err){$('#groupError').textContent=err.message;}finally{b.disabled=false;}};
 $('#groupLogout').onclick=()=>client.auth.signOut();$('#groupReload').onclick=()=>refresh();
 client.auth.onAuthStateChange((event,session)=>{
  if(!['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event))return;
  authenticated=!!session?.user;generation++;onClear();$('#groupShell').hidden=true;$('#groupLogin').hidden=false;$('#ownConcessions').innerHTML='';
  if(authenticated)queueMicrotask(()=>refresh({clear:true}));
 });
 const timer=setInterval(()=>{if(authenticated&&!document.hidden)refresh();},30000);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
