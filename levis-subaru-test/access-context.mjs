export const REPORT_SECTIONS=['vente:VN','vente:VO','service:all','piece:all','esthetique:all'];
export async function readAccessContext(client){
 const {data,error}=await client.rpc('gc_context');
 if(error)throw error;
 if(!data?.userId||!Array.isArray(data.memberships))throw Error('Votre compte n’a aucun accès actif.');
 return data;
}
export function accessProfile(context,dealershipId,user={}){
 const m=context?.memberships?.find(m=>m.dealership_id===dealershipId);
 if(!m||context.userId!==user.uid)return null;
 const role={admin:'admin',dg:'dg',director:'directeur',employee:'employe'}[m.role];
 if(!role)return null;
 const sections=(m.sections||[]).filter(s=>REPORT_SECTIONS.includes(s));
 return {uid:context.userId,email:user.email||'',active:true,role,sections,
 department:m.department||sections[0]?.split(':')[0]||null,
 name:m.display_name||user.email||'Utilisateur',poste:m.poste||'',
 dealershipId,dealershipName:m.name,canReadGroup:context.canReadGroup===true,
 joinedGroupMonth:m.joined_group_month||null,requiredSections:m.required_sections||[],reportingEnabled:m.reporting_enabled===true};
}
