import {DEPARTMENTS} from './employees.mjs?v=1.15.0';
export const ROLES={employe:'Employé',directeur:'Directeur de département',admin:'Administrateur'};
export const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||'');
export function newId(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
export function draftErrors(rows){
 const emails=new Map(),errors=[];
 for(const [index,row]of rows.entries()){
  if(!row.name?.trim()||!row.poste?.trim())errors.push(`${row.name||'Ligne '+(index+1)} : nom et poste obligatoires.`);
  if(!validEmail(row.email))errors.push(`${row.name||'Ligne '+(index+1)} : courriel manquant ou invalide.`);
  if(!Object.hasOwn(DEPARTMENTS,row.department))errors.push(`${row.name} : département invalide.`);
  if(!Object.hasOwn(ROLES,row.role))errors.push(`${row.name} : profil invalide.`);
  if(row.role==='directeur'&&!['vente','service','piece','esthetique'].includes(row.department))errors.push(`${row.name} : choisissez le département des objectifs du directeur.`);
  const email=String(row.email||'').trim().toLowerCase();if(email&&emails.has(email))errors.push(`${row.name} : courriel utilisé par plusieurs lignes.`);emails.set(email,index);
 }
 return errors;
}
function splitLine(line,separator){const values=[];let v='',quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){v+='"';i++;}else quote=!quote;}else if(c===separator&&!quote){values.push(v.trim());v='';}else v+=c;}values.push(v.trim());return values;}
export function parseRoster(text,employees){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());if(!lines.length)throw Error('Collez la liste à importer.');
 const separator=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
 if(['nom','nom complet'].includes(normalize(splitLine(lines[0],separator)[0])))lines.shift();
 const rows=[],seenNames=new Set();
 for(const [i,line]of lines.entries()){
  const [name,email,department,poste,role]=splitLine(line,separator),matches=employees.filter(e=>normalize(e.name)===normalize(name));
  if(matches.length>1)throw Error(`Ligne ${i+1} : plusieurs employés portent ce nom. Utilisez leur fiche.`);
  if(seenNames.has(normalize(name)))throw Error(`Ligne ${i+1} : ce nom apparaît plusieurs fois dans l’import.`);seenNames.add(normalize(name));
  const old=matches[0],dep=({ventes:'vente'})[normalize(department)]||Object.keys(DEPARTMENTS).find(k=>[normalize(k),normalize(DEPARTMENTS[k])].includes(normalize(department)));
  const r={employe:'employe',employee:'employe',directeur:'directeur',directrice:'directeur','directeur de departement':'directeur',admin:'admin',administrateur:'admin'}[normalize(role||'employe')];
  rows.push({...old,id:old?.id||'custom-'+newId(),name:name||'',email:(email||'').toLowerCase(),department:dep||department,poste:poste||old?.poste||'',role:r||role,selected:true});
 }
 const errors=draftErrors(rows);if(errors.length)throw Error(errors.join('\n'));return rows;
}
// Les invitations sont effectuées par la fonction Supabase serveur.
export async function inviteEmployee({sdk,employee,account}){
 const errors=draftErrors([employee]);
 if(errors.length)throw Error(errors.join(' '));
 if(account&&(!account.active||account.email?.toLowerCase()!==employee.email.toLowerCase()))
   throw Error('Compte inactif ou adresse courriel différente de la fiche.');
 return sdk.inviteEmployee(employee);
}

