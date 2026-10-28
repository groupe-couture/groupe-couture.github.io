import {DEPARTMENTS} from './employees.mjs?v=1.12';
export const ROLES={employe:'Employé',directeur:'Directeur de département',admin:'Administrateur'};
export const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||'');
export function newId(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
function password(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return 'aA7!'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
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
export async function inviteEmployee({sdk,db,firebaseConfig,employee,account,adminUid,now=()=>new Date().toISOString()}){
 if(draftErrors([employee]).length)throw Error(draftErrors([employee]).join(' '));
 if(employee.uid&&!account)throw Error('Le compte lié est introuvable. Vérifiez sa fiche avant de renvoyer une invitation.');
 if(account&&(!account.active||account.email?.toLowerCase()!==employee.email.toLowerCase()))throw Error('Le compte est inactif ou son courriel diffère de la fiche. Corrigez la fiche avant d’inviter.');
 let app,created,committed=false;
 try{
  app=sdk.initializeApp(firebaseConfig,'invitation-'+newId());const auth=sdk.getAuth(app);auth.languageCode='fr';await sdk.setPersistence(auth,sdk.inMemoryPersistence);
  const at=now();let uid=account?.uid;
  if(!uid){
   created=(await sdk.createUserWithEmailAndPassword(auth,employee.email,password())).user;uid=created.uid;
   const batch=sdk.writeBatch(db);
   batch.set(sdk.doc(db,'users',uid),{name:employee.name,poste:employee.poste,email:employee.email.toLowerCase(),department:employee.department,role:employee.role,active:true,invitationStatus:'pending',createdAt:at,createdBy:adminUid});
   batch.set(sdk.doc(db,'employees',employee.id),{name:employee.name,poste:employee.poste,email:employee.email.toLowerCase(),department:employee.department,uid,invitationStatus:'pending'},{merge:true});
   await batch.commit();committed=true;
  }
  try{await sdk.sendPasswordResetEmail(auth,employee.email,{url:'https://preparation-levis-subaru.web.app/',handleCodeInApp:false});}
  catch(error){error.accountUid=uid;error.stage='email';await sdk.setDoc(sdk.doc(db,'employees',employee.id),{invitationStatus:'error',invitationError:error.code||'email-failed'},{merge:true});throw error;}
  // A successful call means Firebase accepted the request, not that the mailbox received it.
  await sdk.setDoc(sdk.doc(db,'employees',employee.id),{invitationStatus:'sent',invitationSentAt:now(),invitationError:''},{merge:true});
  return {uid,invitationStatus:'sent'};
 }catch(error){
  if(created&&!committed){try{await sdk.deleteUser(created);}catch{error.message+=' Le compte Auth créé doit être vérifié dans Firebase.';}}
  if(error.code==='auth/email-already-in-use')error.message='Ce courriel possède déjà un compte. Reliez sa fiche au compte existant avant de réessayer.';
  throw error;
 }finally{if(app){try{await sdk.signOut(sdk.getAuth(app));}catch{}await sdk.deleteApp(app);}}
}
