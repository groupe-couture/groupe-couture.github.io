export const SUBMENUS={team:[['users','Utilisateurs'],['messages','Message'],['organigramme','Organigramme']],settings:[['vente','Ventes'],['service','Service'],['piece','Pièces'],['esthetique','Esthétique']]};
export const TEAM_VIEWS=SUBMENUS.team;
export const ACCESS_FIELDS=Object.entries(SUBMENUS).flatMap(([group,views])=>views.map(([key,label])=>[group==='team'?key:'objective_'+key,(group==='team'?'Équipe':'Objectifs')+' · '+label]));
export function isMember(profile){return profile?.active===true&&['admin','dg','directeur','employe'].includes(profile.role);}
export function canManageAccess(profile){return isMember(profile)&&profile.role==='admin';}
export function canViewSubcategory(profile,group,key){
 if(!isMember(profile)||!(SUBMENUS[group]||[]).some(([k])=>k===key))return false;
 if(group==='team')return true;
 return ['admin','dg'].includes(profile.role)||(profile.role==='directeur'&&(Array.isArray(profile.sections)?profile.sections.some(s=>s.split(':')[0]===key):profile.department===key));
}
export function canEditObjectives(profile,department){return canViewSubcategory(profile,'settings',department);}
export function availableSubcategories(profile,group){return (SUBMENUS[group]||[]).filter(([key])=>canViewSubcategory(profile,group,key));}
export function canViewTeam(profile,view){return canViewSubcategory(profile,'team',view);}
export function availableTeamViews(profile){return availableSubcategories(profile,'team');}
export function canViewGroup(profile){return isMember(profile)&&profile.role!=='employe'&&(profile.canReadGroup===true||profile.role==='dg'||profile.role==='admin');}
export function canViewModule(profile,tab){
 if(!isMember(profile))return false;
 if(['vo','deliveries','calendar','team'].includes(tab))return true;
 if(tab==='group')return canViewGroup(profile);
 if(tab==='reports')return profile.role!=='employe';
 if(tab==='general')return ['admin','dg'].includes(profile.role);
 if(tab==='serviceBoard')return canEditObjectives(profile,'service');
 if(['sales','operations','billing'].includes(tab))return canEditObjectives(profile,'vente');
 if(tab==='settings')return availableSubcategories(profile,'settings').length>0;
 return false;
}
