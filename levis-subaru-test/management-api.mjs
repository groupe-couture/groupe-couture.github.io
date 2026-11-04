export function createManagementApi(client){
 if(typeof client?.rpc!=='function'||typeof client?.from!=='function')throw Error('Connexion à la plateforme requise.');
 const read=async q=>{const {data,error}=await q;if(error)throw Object.assign(Error(error.message||'Chargement impossible.'),{code:error.code});return data;};
 async function all(make){const out=[];for(let start=0;;start+=500){const rows=await read(make().range(start,start+499));out.push(...rows);if(rows.length<500)return out;}}
 return {
  targets:(year,dealershipId=null)=>read(client.rpc('gc_pilotage_targets',{p_year:Number(year),p_dealership:dealershipId||null})),
  tasks:dealershipId=>all(()=>{let q=client.from('gc_management_tasks').select('*').order('due_date').order('id');if(dealershipId)q=q.eq('dealership_id',dealershipId);return q;}),
  events:id=>all(()=>client.from('gc_management_task_events').select('version,actor_name,action,from_status,to_status,note,created_at').eq('task_id',id).order('version')),
  assignees:(dealershipId,section)=>read(client.rpc('gc_task_assignees',{p_dealership:dealershipId,p_section:section})),
  command:(action,input)=>read(client.rpc('gc_management_task_command',{p_action:action,p_input:input}))
 };
}
