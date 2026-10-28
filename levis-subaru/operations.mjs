import {today} from './domain.mjs?v=1.14';
export const INSPECTION_POINTS=[['engine','Moteur et fluides'],['brakes','Freinage et sécurité'],['steering','Direction et suspension'],['electric','Électricité et éclairage'],['cabin','Habitacle et équipements'],['body','Carrosserie et dessous'],['road','Essai routier']];
export const INSPECTION_STATES=['Non vérifié','Conforme','À surveiller','Travaux requis'];
export const money=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Math.round(Number(v)*100)/100:null;
export const cents=v=>Math.round(Number(v)*100);
export const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export function inspectionErrors(x){
 const e=[];if(!x.vehicleId)e.push('Choisissez un véhicule.');if(!x.technician?.trim())e.push('Indiquez le technicien.');if(!validDate(x.date)||x.date>today())e.push('Date d’inspection invalide.');
 for(const [id,label]of INSPECTION_POINTS)if(!INSPECTION_STATES.includes(x.points?.[id]?.status))e.push(label+' : état invalide.');
 for(const wheel of ['AVG','AVD','ARG','ARD'])for(const [k,label,max]of [['tire','Pneu (32e po)',40],['pressure','Pression (psi)',150],['pad','Plaquette (mm)',40]]){const n=money(x.wheels?.[wheel]?.[k]);if(n!==null&&(n<0||n>max))e.push(wheel+' : '+label+' invalide.');}
 if(x.signed&&(!x.signature?.trim()||INSPECTION_POINTS.some(([id])=>x.points[id].status==='Non vérifié')))e.push('Vérifiez tous les points et indiquez le nom du signataire avant de finaliser.');
 return e;
}
export function workErrors(rows){const ids=new Set(),e=[];for(const w of rows){if(!w.id||ids.has(w.id)||!w.label?.trim()||w.label.length>160||!['À faire','En cours','Terminé','Non requis'].includes(w.status))e.push('Chaque travail doit avoir un titre, un identifiant unique et un état valide.');ids.add(w.id);}return e;}
export function productLines(products,selected,previous=[]){
 return selected.map(id=>{const old=previous.find(x=>x.id===id),p=products.find(p=>p.id===id);if(old)return {...old};if(!p||p.active===false)throw Error('Produit F&I non disponible.');return {id,name:p.name,bonus:money(p.bonus)};});
}
export function bonusTotal(lines){return (lines||[]).reduce((n,p)=>n+cents(p.bonus||0),0)/100;}
export function salesMetrics(sales,finances,{type,from,to}){
 const rows=sales.filter(s=>s.status!=='Annulée'&&s.type===type&&s.saleDate>=from&&s.saleDate<=to);
 const values={units:rows.length},missing={};
 for(const [field,total,avg]of [['vehicleProfit','vehicleProfit','vehicleAverage'],['financeProfit','financeProfit','financeAverage']]){
  const numbers=rows.map(s=>money(finances.find(f=>f.id===s.id)?.[field]));
  const known=numbers.filter(v=>v!==null);values[total]=known.length?known.reduce((n,v)=>n+cents(v),0)/100:null;
  values[avg]=known.length?values[total]/known.length:null;values[field==='vehicleProfit'?'vehicleKnown':'financeKnown']=known.length;missing[field]=numbers.length-known.length;
 }
 values.totalProfit=values.vehicleProfit===null&&values.financeProfit===null?null:(values.vehicleProfit||0)+(values.financeProfit||0);
 return {rows,values,missing,partial:!!(missing.vehicleProfit||missing.financeProfit)};
}
export function wholesaleErrors(x){
 const e=[];for(const [k,l]of [['stock','Stock'],['model','Véhicule'],['buyer','Acheteur']])if(!x[k]?.trim())e.push(l+' obligatoire.');if(!validDate(x.date)||x.date>today())e.push('Date de vente invalide.');
 for(const k of ['price','cost','fees'])if(money(x[k])===null||money(x[k])<0)e.push('Prix, coût et frais doivent être renseignés et positifs ou nuls.');return e;
}
export const wholesaleProfit=x=>(cents(x.price)-cents(x.cost)-cents(x.fees))/100;
export function antiqueErrors(x){
 const e=[];for(const [k,l]of [['client','Client'],['model','Véhicule'],['vin','NIV'],['signer','Évaluateur']])if(!x[k]?.trim())e.push(l+' obligatoire.');
 if(!validDate(x.date)||x.date>today())e.push('Date invalide.');if(!Number.isInteger(x.year)||x.year<1886||x.year>Number(x.date?.slice(0,4)))e.push('Année du véhicule invalide.');
 if(!/^[A-HJ-NPR-Z0-9-]{5,25}$/i.test(x.vin||''))e.push('NIV invalide.');
 for(const k of ['value','fee','taxes'])if(money(x[k])===null||money(x[k])<0)e.push('Valeur, honoraires et taxes doivent être renseignés.');return e;
}
