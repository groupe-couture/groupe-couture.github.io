export const STEPS=[['inspection','Inspection'],['mechanique','Mécanique'],['sousTraitance','Sous-traitance'],['lavage','Lavage'],['photos','Photos']];
export const STATES=['À faire','En cours','Terminé','Non requis'];
export const STAFF=['À déterminer','Alain Létourneau','Alain Giasson','Bernard Boutet','Pascale Grondin','Nicolas Ouellet','Thomas Lévesque Guignard','Louis-Gabriel Morissette','Thomas Dussault','Emerik Carbonneau','Brad Ouellet'];
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function dayKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function dateObj(s){return new Date(`${s}T12:00:00`);}
export function age(s,end=today()){return Math.max(0,Math.round((dateObj(end)-dateObj(s))/86400000));}
export function stepsFor(v){return v.delivery?[...STEPS.filter(([k])=>k!=='photos'),['pieces','Pièces']]:STEPS;}
export function complete(v){return stepsFor(v).every(([k])=>['Terminé','Non requis'].includes(v.steps?.[k]?.status))&&(v.workOrders||[]).every(w=>['Terminé','Non requis'].includes(w.status));}
export function progress(v){return stepsFor(v).filter(([k])=>['Terminé','Non requis'].includes(v.steps?.[k]?.status)).length;}
export function counts(records,month){return records.reduce((n,v)=>{if(v.delivery?.status==='Livré'&&v.delivery.actualDate?.slice(0,7)===month)n[v.type]=(n[v.type]||0)+1;return n;},{VN:0,VO:0});}
export function preparationQueue(records){return records.filter(v=>v.type==='VO'&&!v.archived&&v.delivery?.status!=='Livré').sort((a,b)=>(a.arrival||'').localeCompare(b.arrival||'')||(a.createdAt||'').localeCompare(b.createdAt||''));}
export function defaultSteps(type){return Object.fromEntries(STEPS.map(([k])=>[k,{status:type==='VN'&&['photos','inspection'].includes(k)?'Non requis':'À faire',note:''}]));}
export function validate(v){if(!v.stock?.trim()||!v.model?.trim())throw Error('Le numéro de stock et le véhicule sont obligatoires.');if(!['VN','VO'].includes(v.type))throw Error('Catégorie invalide.');if(!/^\d{4}-\d{2}-\d{2}$/.test(v.arrival))throw Error('La date d’arrivée est obligatoire.');if(v.delivery&&(!v.delivery.date||!v.delivery.time))throw Error('La date et l’heure de livraison sont obligatoires.');if(v.delivery?.status==='Livré'&&!v.delivery.actualDate)throw Error('La date réelle de livraison est obligatoire.');if(['Prête','Livré'].includes(v.delivery?.status)&&v.blocker?.trim())throw Error('Retirez le blocage après résolution avant de confirmer le véhicule prêt ou livré.');if(v.delivery?.status==='Livré'&&!complete(v))throw Error('Toutes les étapes doivent être terminées ou non requises avant de livrer.');}
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function objectiveSummary(records,goals,month,asOf=today()){
 const year=month.slice(0,4),currentYear=asOf.slice(0,4);
 const cutoff=year<currentYear?year+'-12-31':year===currentYear?asOf:year+'-01-01';
 const elapsed=year>currentYear?0:Number(cutoff.slice(5,7));
 const ytd={VN:0,VO:0},target={VN:0,VO:0},missing={VN:0,VO:0};
 for(const v of records){const d=v.delivery;if(elapsed&&d?.status==='Livré'&&d.actualDate?.slice(0,4)===year&&d.actualDate<=cutoff&&['VN','VO'].includes(v.type))ytd[v.type]++;}
 for(let i=1;i<=elapsed;i++){const g=goals[year+'-'+String(i).padStart(2,'0')];for(const k of ['VN','VO']){if(Number.isFinite(g?.[k]))target[k]+=g[k];else missing[k]++;}}
 return {month:counts(records,month),ytd,target,missing,cutoff,elapsed};
}
