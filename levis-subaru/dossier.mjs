import {defaultSteps,complete,today} from './domain.mjs?v=1.14.1';
import {saleErrors} from './reporting.mjs?v=1.14.1';
import {stampPreparation} from './preparation-history.mjs?v=1.14.1';
import {newId} from './invitations.mjs?v=1.14.1';

export const stockKey=v=>String(v||'').trim().toUpperCase();
export function linkedVehicle(s,vehicles){
 return vehicles.find(v=>s.vehicleId?v.id===s.vehicleId:stockKey(v.stock)===stockKey(s.stock)&&v.type===s.type)||null;
}
export function linkedSale(v,sales){
 const found=sales.filter(s=>s.status!=='Annulée'&&(v.saleId?s.id===v.saleId:s.vehicleId===v.id||stockKey(s.stock)===stockKey(v.stock)&&s.type===v.type));
 if(found.length>1)throw Error('Plusieurs ventes correspondent à ce véhicule. Faites vérifier les dossiers avant de les relier.');
 return found[0]||null;
}
// Produces both records before any write. The same plan is used in demo and Supabase.
export function dossierPlan({vehicle:inputVehicle,sale:inputSale,oldVehicle,oldSale,vehicleId,saleId,author,now=new Date().toISOString()}){
 let vehicle=oldVehicle?structuredClone(oldVehicle):null,sale=oldSale?structuredClone(oldSale):null;
 if(inputSale){
  sale={...sale,...inputSale,id:saleId,stock:stockKey(inputSale.stock),year:inputSale.saleDate?.slice(0,4)};
  const errors=saleErrors(sale);if(Object.keys(errors).length)throw Error(Object.values(errors).join(' '));
  if(oldSale?.status==='Livré'&&sale.status==='Annulée')throw Error('Une vente déjà livrée doit conserver son historique de livraison.');
  if(!vehicle)vehicle={id:vehicleId,stock:sale.stock,model:sale.model,type:sale.type,arrival:'',color:'',vin:'',keys:'',location:'Concession',steps:defaultSteps(sale.type),delivery:null,archived:false,draft:true};
  if(vehicle.type!==sale.type||stockKey(vehicle.stock)!==sale.stock)throw Error('Le stock et la catégorie doivent correspondre au dossier véhicule.');
  vehicle.model=sale.model;
 }
 if(inputVehicle)vehicle={...vehicle,...structuredClone(inputVehicle),id:vehicleId,stock:stockKey(inputVehicle.stock),draft:false};
 if(!vehicle)throw Error('Dossier véhicule manquant.');
 if(sale){
  if(sale.type!==vehicle.type||stockKey(sale.stock)!==vehicle.stock)throw Error('La vente et le véhicule ne correspondent pas.');
  vehicle.saleId=sale.id;sale.vehicleId=vehicle.id;sale.model=vehicle.model;
  if(inputVehicle?.delivery&&inputVehicle.delivery.status!=='Annulée'){
   sale.client=inputVehicle.delivery.client;
  }
  if(vehicle.delivery){
   vehicle.delivery.client=sale.client;vehicle.delivery.advisor=sale.sellerName;
   if(sale.status==='Annulée')vehicle.delivery.status='Annulée';
   else if(vehicle.delivery.status==='Livré'){
    if(!complete(vehicle)||vehicle.blocker?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(vehicle.delivery.actualDate||''))throw Error('Complétez la préparation et la date réelle avant de confirmer la livraison.');
    sale.status='Livré';sale.deliveredOn=vehicle.delivery.actualDate;
   }else if(sale.status==='Livré')throw Error('Confirmez la livraison dans le dossier de préparation avec sa date réelle.');
  }else if(sale.status==='Livré')throw Error('La livraison doit être confirmée dans le dossier véhicule.');
 }
 const history=[...(oldVehicle?.history||[]),{at:now,by:author,message:inputSale?'Vente et dossier véhicule liés / mis à jour':'Dossier commun mis à jour'}].slice(-100);
 vehicle={...vehicle,...stampPreparation(oldVehicle,vehicle),createdAt:oldVehicle?.createdAt||now,updatedAt:now,version:(oldVehicle?.version||0)+1,history};
 if(sale)sale={...sale,createdAt:oldSale?.createdAt||now,updatedAt:now,version:(oldSale?.version||0)+1};
 return {vehicle,sale};
}

export function createDossierService(ctx){
 async function save({vehicle,sale,financials}){
  const c=ctx.state();
  const vehicles=c.records,sales=c.sales;
  const ov=vehicle?.id?vehicles.find(v=>v.id===vehicle.id):sale?linkedVehicle(sale,vehicles):null;
  const os=sale?.id?sales.find(s=>s.id===sale.id):ov?linkedSale(ov,sales):null;
  if(sale&&!sale.id&&os&&os.status!=='Annulée')throw Error('Une vente existe déjà pour ce stock. Ouvrez-la pour la modifier.');
  const vid=ov?.id||vehicle?.id||newId();
  const sid=os?.id||sale?.id||(sale?newId():null);
  if(vehicle?.id&&vehicle.version!==undefined&&vehicle.version!==ov?.version)throw Error('Le dossier a été modifié. Fermez-le puis ouvrez-le à nouveau.');
  if(sale?.id&&sale.version!==os?.version)throw Error('La vente a été modifiée. Fermez-la puis ouvrez-la à nouveau.');
  let plan;
  const calculate=(oldVehicle,oldSale)=>dossierPlan({vehicle,sale,oldVehicle,oldSale,vehicleId:vid,saleId:sid,author:c.profile.name||c.user.email});
  if(c.demo){
   if(!ov&&vehicles.some(v=>stockKey(v.stock)===stockKey((vehicle||sale).stock)))throw Error('Ce stock possède déjà un dossier.');
   plan=calculate(ov,os);
  }else{
   const {sdk,db}=c;
   await sdk.runTransaction(db,async tx=>{
    const vr=sdk.doc(db,'vehicles',vid),sr=sid?sdk.doc(db,'sales',sid):null;
    const vs=await tx.get(vr),ss=sr?await tx.get(sr):null;
    if((vs.data()?.version||0)!==(ov?.version||0)||(ss?.data()?.version||0)!==(os?.version||0))throw Error('Ce dossier a été modifié par une autre personne. Fermez-le puis rouvrez-le.');
    plan=calculate(vs.exists()?{...vs.data(),id:vid}:null,ss?.exists()?{...ss.data(),id:sid}:null);
    const index=sdk.doc(db,'stocks',encodeURIComponent(plan.vehicle.stock));
    const ix=await tx.get(index);
    if(ix.exists()&&ix.data().vehicleId!==vid)throw Error('Ce stock possède déjà un dossier. Sélectionnez-le.');
    const clean=x=>{const y={...x,updatedBy:c.user.uid};delete y.id;return y;};
    if(!ix.exists())tx.set(index,{vehicleId:vid});
    tx.set(vr,clean(plan.vehicle));
    if(plan.sale)tx.set(sr,clean(plan.sale));
    if(financials){
     const fr=sdk.doc(db,'saleFinancials',sid);await tx.get(fr);
     tx.set(fr,{...financials,year:plan.sale.year,updatedAt:plan.sale.updatedAt,updatedBy:c.user.uid});
    }
   });
  }
  ctx.accept(plan,financials);return plan;
 }
 return {save};
}
