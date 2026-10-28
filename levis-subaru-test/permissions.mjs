export const SUBMENUS={team:[['users','Utilisateurs'],['messages','Message'],['organigramme','Organigramme']],settings:[['vente','Ventes'],['service','Service'],['piece','Pièces'],['esthetique','Esthétique']]};
export const TEAM_VIEWS=SUBMENUS.team;
export const ACCESS_FIELDS=Object.entries(SUBMENUS).flatMap(([group,views])=>views.map(([key,label])=>[group==='team'?key:'objective_'+key,(group==='team'?'Équipe':'Objectifs')+' · '+label]));
export function isMember(profile){return profile?.active===true&&['admin','directeur','employe'].includes(profile.role);}
export function canManageAccess(profile){return isMember(profile)&&profile.role==='admin';}
export function canViewSubcategory(profile,group,key){
 if(!isMember(profile)||!(SUBMENUS[group]||[]).some(([k])=>k===key))return false;
 if(group==='team')return true;
 return profile.role==='admin'||(profile.role==='directeur'&&profile.department===key);
}
export function canEditObjectives(profile,department){return canViewSubcategory(profile,'settings',department);}
export function availableSubcategories(profile,group){return (SUBMENUS[group]||[]).filter(([key])=>canViewSubcategory(profile,group,key));}
export function canViewTeam(profile,view){return canViewSubcategory(profile,'team',view);}
export function availableTeamViews(profile){return availableSubcategories(profile,'team');}
