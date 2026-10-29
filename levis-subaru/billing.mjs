import {today} from './domain.mjs?v=1.16.0';
import {validDate} from './operations.mjs?v=1.16.0';

export const BILLING_CATEGORIES=['Produit','Pièce','Accessoire','Service','Autre'];
export const TAX_MODES={qc:'TPS + TVQ',zero:'Détaxé (0 %)',exempt:'Exonéré'};
export const INVOICE_SETUP=[
 ['Entreprise','Raison sociale exacte, adresse de facturation, téléphone et logo.'],
 ['Taxes','Numéros d’inscription TPS et TVQ et traitement des ventes particulières à confirmer avec la comptabilité.'],
 ['Numérotation','Préfixe et prochain numéro, coordonnés avec le système comptable pour éviter les doublons.'],
 ['Paiement','Modalités et échéances, modes acceptés et suivi des montants reçus.'],
 ['Accès','Personnes autorisées à préparer, émettre et créditer une facture.'],
 ['Comptabilité','Rapprochement ou export vers le système comptable et procédure de notes de crédit.']
];

function decimal(value,places){
 if(value===null||value===undefined||typeof value==='boolean')return null;
 const s=String(value).trim(),match=s.match(new RegExp('^(\\d+)(?:\\.(\\d{1,'+places+'}))?$'));
 if(!match)return null;
 const n=Number(match[1])*10**places+Number((match[2]||'').padEnd(places,'0'));
 return Number.isSafeInteger(n)?n:null;
}
const rounded=(value,den)=>Number((value+den/2n)/den);
export function lineAmounts(line){
 const price=decimal(line.unitPrice,2),quantity=decimal(line.quantity,3),discount=decimal(line.discount??0,2);
 if(price===null||price>100000000||quantity===null||quantity<=0||quantity>9999000||discount===null)throw Error('Quantité, prix ou rabais invalide.');
 const gross=rounded(BigInt(price)*BigInt(quantity),1000n);
 if(discount>gross)throw Error('Le rabais dépasse le montant de la ligne.');
 return {gross,discount,net:gross-discount};
}
export function billingTotals(lines){
 let gross=0,discount=0,net=0,taxable=0;
 for(const line of lines){if(!Object.hasOwn(TAX_MODES,line.taxMode))throw Error('Traitement fiscal invalide.');const x=lineAmounts(line);gross+=x.gross;discount+=x.discount;net+=x.net;if(line.taxMode==='qc')taxable+=x.net;}
 if(net>1000000000)throw Error('Le sous-total dépasse la limite de 10 000 000 $.');
 // Taxes on the same net base, rounded once per tax at the invoice level.
 const gst=rounded(BigInt(taxable)*5n,100n),qst=rounded(BigInt(taxable)*9975n,100000n);
 return {gross:gross/100,discount:discount/100,subtotal:net/100,gst:gst/100,qst:qst/100,total:(net+gst+qst)/100};
}
export function draftErrors(draft){
 const e=[];
 if(!draft.client?.trim()||draft.client.length>120)e.push('Indiquez le nom du client (120 caractères maximum).');
 if(!validDate(draft.date)||draft.date>today())e.push('Date de facture invalide.');
 if(!['Brouillon','Archivé'].includes(draft.status))e.push('Ce module conserve uniquement des brouillons.');
 if(draft.number||draft.issuedAt||draft.paidAt)e.push('L’émission et le paiement seront disponibles après configuration.');
 if(draft.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))e.push('Courriel invalide.');
 for(const [k,max]of [['clientAddress',500],['email',200],['paymentTerms',300],['reference',200],['notes',3000]])if(typeof draft[k]!=='string'||draft[k].length>max)e.push('Champ '+k+' invalide ou trop long.');
 if(!Array.isArray(draft.lines)||!draft.lines.length||draft.lines.length>100)e.push('Ajoutez de 1 à 100 articles.');
 else{
  for(const [i,l]of draft.lines.entries()){
   if(!l.description?.trim()||l.description.length>300||!BILLING_CATEGORIES.includes(l.category)||typeof l.sku!=='string'||l.sku.length>80)e.push('Ligne '+(i+1)+' : description, catégorie ou référence invalide.');
  }
  try{billingTotals(draft.lines);}catch(x){e.push(x.message);}
 }
 return e;
}
export function draftFromDossier(vehicle,sale){
 return {vehicleId:vehicle?.id||'',saleId:sale?.id||vehicle?.saleId||'',client:sale?.client||vehicle?.delivery?.client||'',reference:[vehicle?.stock||sale?.stock,vehicle?.model||sale?.model].filter(Boolean).join(' · ')};
}
