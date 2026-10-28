import {stepsFor,STATES} from './domain.mjs?v=1.14';
import {deliveryTimestamp} from './delivery.mjs?v=1.14';
const present=v=>typeof v==='string'&&v.trim().length>0;
const validDate=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;};
export function recordErrors(v){
 const errors={};
 for(const [k,label]of [['stock','No de stock'],['model','Véhicule'],['color','Couleur'],['vin','NIV'],['keys','Emplacement des clés']])if(!present(v[k]))errors[k]=label+' : champ obligatoire.';
 if(!['VN','VO'].includes(v.type))errors.type='Choisissez une catégorie.';
 if(!validDate(v.arrival))errors.arrival='Indiquez une date d’arrivée valide.';
 if(!present(v.location))errors.location='Indiquez l’emplacement du véhicule.';
 if(present(v.vin)&&!/^[A-HJ-NPR-Z0-9]{17}$/i.test(v.vin))errors.vin='Le NIV doit contenir 17 caractères valides.';
 const d=v.delivery;
 if(d){
  for(const [field,k,label]of [['client','client','Client'],['advisor','advisor','Conseiller / demandeur'],['parts','parts','Pièces à commander / installer'],['promises','promises','Travaux / accessoires promis']])if(!present(d[k]))errors[field]=label+' : champ obligatoire.'+(['parts','promises'].includes(k)?' Indiquez « Aucun » s’il n’y en a pas.':'');
  for(const [k,label]of [['finance','la directrice financière'],['driver','le livreur']])if(!present(d[k])||d[k]==='À déterminer')errors[k]='Sélectionnez '+label+'.';
  if(!validDate(d.date))errors.deliveryDate='Indiquez la date prévue.';
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time||''))errors.deliveryTime='Indiquez l’heure prévue.';
  if(!errors.deliveryDate&&!errors.deliveryTime&&!Number.isFinite(deliveryTimestamp(d)))errors.deliveryTime='Cette heure n’existe pas au Québec à cette date. Choisissez une autre heure.';
  if(!['Demandée','Confirmée','Prête','Livré','Annulée'].includes(d.status))errors.deliveryStatus='Choisissez l’état de la livraison.';
  if(d.status==='Livré'&&!validDate(d.actualDate))errors.actualDate='Indiquez la date réelle de livraison.';
 }
 for(const [k,label]of stepsFor(v)){
  const status=v.steps?.[k]?.status;
  if(!STATES.includes(status))errors['step_'+k]=label+' : choisissez un état.';
  if(['Prête','Livré'].includes(d?.status)&&!['Terminé','Non requis'].includes(status))errors['step_'+k]=label+' : terminez cette étape ou indiquez « Non requis ».';
 }
 if(['Prête','Livré'].includes(d?.status)&&v.blocker?.trim())errors.blocker='Résolvez et retirez le blocage avant de confirmer le véhicule prêt ou livré.';
 if(['Prête','Livré'].includes(d?.status)&&(v.workOrders||[]).some(w=>!['Terminé','Non requis'].includes(w.status)))errors.workOrders='Terminez les travaux additionnels avant de confirmer le véhicule prêt ou livré.';
 return errors;
}
