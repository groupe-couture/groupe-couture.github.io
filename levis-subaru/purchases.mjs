import {today,esc} from './domain.mjs?v=1.16.0';
import {validDate} from './operations.mjs?v=1.16.0';

export const DEALER={name:'Lévis Subaru',legalName:'3953-1282 Québec inc.',address:'5085 rue Christophe-Colomb, Lévis, QC, G6V 8Y7',phone:'418-833-1960',permit:'2108583-1'};
export const PURCHASE_TAX_MODES={equity:'Sur l’équité (valeur − solde) · modèle Excel',vehicle:'Sur la valeur du véhicule',none:'Aucune taxe à verser au vendeur',manual:'Montants de taxes saisis'};
export const USES=['Promenade','Affaires','Location','Taxi','École de conduite','Ambulance','Police','Autre'];
export const PRODUCT_CATEGORIES=['Assurance crédit','Garantie prolongée','Autre produit'];
export const currency=v=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(v);
export function cents(value,{signed=false}={}){
 if(value===null||value===undefined||typeof value==='boolean')throw Error('Montant obligatoire.');
 const m=String(value).trim().match(signed?/^(-?)(\d+)(?:\.(\d{1,2}))?$/:/^()(\d+)(?:\.(\d{1,2}))?$/);
 if(!m)throw Error('Montant invalide : deux décimales maximum.');
 const n=Number(m[2])*100+Number((m[3]||'').padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n>1000000000)throw Error('Montant hors limite (10 000 000 $).');
 return m[1]==='-'?-n:n;
}
const rounded=(n,d)=>Number(n<0n?-((-n+d/2n)/d):(n+d/2n)/d);
export function purchaseTotals(x){
 const value=cents(x.value),balance=cents(x.balance),equity=value-balance;
 if(!Object.hasOwn(PURCHASE_TAX_MODES,x.taxMode))throw Error('Choisissez le traitement des taxes.');
 const base=x.taxMode==='equity'?equity:x.taxMode==='vehicle'?value:0;
 const gst=x.taxMode==='manual'?cents(x.gst,{signed:true}):rounded(BigInt(base)*5n,100n);
 const qst=x.taxMode==='manual'?cents(x.qst,{signed:true}):rounded(BigInt(base)*9975n,100000n);
 const net=equity+gst+qst;
 return {value:value/100,balance:balance/100,equity:equity/100,taxBase:base/100,gst:gst/100,qst:qst/100,total:net/100,
  payable:Math.max(net,0)/100,receivable:Math.max(-net,0)/100,direction:net<0?'À recevoir du vendeur':net>0?'À verser au vendeur':'Aucun solde à verser'};
}
const labels={client:'Nom du vendeur / client',sellerAddress:'Adresse du vendeur',sellerPhone:'Téléphone',sellerEmail:'Courriel',gstNumber:'Numéro de TPS',qstNumber:'Numéro de TVQ',sellerRepresentative:'Représentant',make:'Marque',model:'Véhicule / modèle',vin:'NIV',stock:'Stock',registration:'Immatriculation',lender:'Créancier / locateur',sellerLicence:'Permis / référence',displacement:'Cylindrée',weight:'Poids',financeManager:'Directrice financière',notes:'Notes',conditionNotes:'Condition du véhicule',airbagNotes:'Coussins gonflables',accessories:'Accessoires',liens:'Liens et réserves',odometerNotes:'Observations sur le kilométrage'};
const textErrors=(x,fields,max=200)=>fields.flatMap(k=>typeof x[k]!=='string'||x[k].length>max?[(labels[k]||'Renseignement')+' : texte invalide.']:[]);
export function purchaseErrors(x){
 const errors=[];
 if(!['company','vehicle'].includes(x.kind))errors.push('Type d’achat invalide.');
 if(!validDate(x.date)||x.date>today())errors.push('Date invalide.');
 if(!['Actif','Annulé'].includes(x.status))errors.push('État invalide.');
 errors.push(...textErrors(x,['client','sellerAddress','sellerPhone','sellerEmail','gstNumber','qstNumber','sellerRepresentative','make','model','vin','stock','registration','lender','sellerLicence','displacement','weight']));
 for(const k of ['client','sellerAddress','make','model','vin'])if(typeof x[k]!=='string'||!x[k].trim())errors.push(labels[k]+' : obligatoire.');
 if(x.vin&&!/^[A-HJ-NPR-Z0-9-]{5,25}$/i.test(x.vin))errors.push('NIV invalide.');
 if(!Number.isInteger(x.year)||x.year<1886||x.year>Number(today().slice(0,4))+1)errors.push('Année invalide.');
 if(!Number.isInteger(x.odometer)||x.odometer<0||x.odometer>3000000)errors.push('Kilométrage indiqué invalide.');
 if(x.actualOdometer!==null&&(!Number.isInteger(x.actualOdometer)||x.actualOdometer<0||x.actualOdometer>3000000))errors.push('Kilométrage réel invalide.');
 if(!['km','mi'].includes(x.odometerUnit)||!['Canada','États-Unis','Autre','Non précisé'].includes(x.market))errors.push('Unité ou marché invalide.');
 if(!Array.isArray(x.previousUses)||x.previousUses.some(v=>!USES.includes(v))||new Set(x.previousUses).size!==x.previousUses.length)errors.push('Utilisation antérieure invalide.');
 if(!['Non précisé','Fonctionnel déclaré','Modifié / réparé','Hors fonction'].includes(x.airbags))errors.push('État des coussins gonflables invalide.');
 for(const k of ['notes','conditionNotes','airbagNotes','accessories','liens','odometerNotes'])if(typeof x[k]!=='string'||x[k].length>3000)errors.push(labels[k]+' : texte trop long.');
 if(typeof x.ownerConfirmed!=='boolean'||typeof x.odometerConfirmed!=='boolean')errors.push('Déclarations invalides.');
 if(x.sellerEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.sellerEmail))errors.push('Courriel invalide.');
 try{purchaseTotals(x);}catch(e){errors.push(e.message);}
 return errors;
}
export function leaseProfit(products){
 if(!Array.isArray(products)||products.length>100)throw Error('Liste de produits invalide.');
 return products.reduce((n,p)=>n+cents(p.profit,{signed:true}),0)/100;
}
export function leaseErrors(x){
 const e=textErrors(x,['client','financeManager','model','vin','stock','lender']);
 for(const k of ['client','financeManager','model'])if(typeof x[k]!=='string'||!x[k].trim())e.push(labels[k]+' : obligatoire.');
 if(!validDate(x.date)||x.date>today())e.push('Date invalide.');
 if(!['comptant','financement'].includes(x.payment)||!['Actif','Annulé'].includes(x.status))e.push('Mode d’achat ou état invalide.');
 if(typeof x.notes!=='string'||x.notes.length>3000)e.push('Notes invalides.');
 if(!Array.isArray(x.products))return e.concat('Liste de produits invalide.');
 for(const p of x.products)if(!p.id||typeof p.name!=='string'||!p.name.trim()||p.name.length>200||!PRODUCT_CATEGORIES.includes(p.category))e.push('Nom et catégorie de produit obligatoires.');
 if(new Set(x.products.map(p=>p.id)).size!==x.products.length)e.push('Produit dupliqué.');
 try{leaseProfit(x.products);}catch(err){e.push(err.message);}
 return e;
}
export function purchaseFromDossier(v){
 return {stock:v?.stock||'',model:v?.model||'',vin:v?.vin||'',...(Number.isInteger(v?.year)?{year:v.year}:{})};
}
const row=(label,value)=>'<tr><th>'+esc(label)+'</th><td>'+esc(value??'—')+'</td></tr>';
const signature=()=>'<div class="purchase-signatures"><p>Signature du vendeur / représentant<br><br>________________________________</p><p>Signature de l’acheteur<br><br>________________________________</p></div>';
const address=()=>'<div class="purchase-heading"><div><strong>'+esc(DEALER.name)+'</strong><br>'+esc(DEALER.legalName)+'<br>'+esc(DEALER.address)+'<br>'+DEALER.phone+'</div></div>';
export function totalsHTML(x){
 const t=purchaseTotals(x);
 return '<section class="purchase-calculation"><h3>Calcul de l’achat</h3><table><tbody>'+
 row('Valeur du véhicule',currency(t.value))+row('Moins : solde au créancier',currency(t.balance))+
 row('Équité avant taxes',currency(t.equity))+
 row('TPS',currency(t.gst))+row('TVQ',currency(t.qst))+
 row(t.direction,currency(Math.abs(t.total)))+'</tbody></table><p class="purchase-basis">Taxes : '+esc(PURCHASE_TAX_MODES[x.taxMode])+
 (['equity','vehicle'].includes(x.taxMode)?' · Base : '+currency(t.taxBase):'')+'.</p></section>';
}
export function purchaseDocument(x){
 const company=x.kind==='company';
 return '<article class="purchase-sheet">'+address()+'<h1>'+(company?'Achat véhicule entreprise':'Achat véhicule')+'</h1>'+
 (company?'<h2>Droit de tenure à bail</h2>':'<p>Entente d’achat d’un véhicule d’occasion</p>')+
 '<p>Date : '+esc(x.date)+' · Référence : '+esc(x.stock||x.id?.slice(0,8)||'—')+' · '+esc(x.status)+'</p>'+
 '<div class="purchase-columns"><section><h2>'+(company?'Entreprise vendeuse':'Vendeur')+'</h2><p><strong>'+esc(x.client)+'</strong><br>'+esc(x.sellerAddress)+'<br>'+esc(x.sellerPhone)+' · '+esc(x.sellerEmail)+'</p><p>Représentant : '+esc(x.sellerRepresentative||'________________')+'<br>TPS : '+esc(x.gstNumber||'—')+' · TVQ : '+esc(x.qstNumber||'—')+'</p></section>'+
 '<section><h2>Acheteur</h2><p>'+esc(DEALER.name)+'<br>'+esc(DEALER.address)+'</p><p>Permis de commerçant : '+DEALER.permit+'</p></section></div>'+
 '<p>Permis / référence du vendeur : '+esc(x.sellerLicence||'—')+'</p>'+
 '<h2>Véhicule</h2><table><tbody>'+row('Année / marque / modèle',[x.year,x.make,x.model].join(' '))+row('NIV / immatriculation',x.vin+' / '+(x.registration||'—'))+
 row('Compteur indiqué / réel',x.odometer+' '+x.odometerUnit+' / '+(x.actualOdometer===null?'Non confirmé':x.actualOdometer+' '+x.odometerUnit))+
 row('Cylindrée / poids',[(x.displacement||'—'),(x.weight||'—')].join(' / '))+row('Créancier',x.lender||'—')+row('Accessoires',x.accessories||'—')+'</tbody></table>'+
 (company?'':'<h2>Renseignements et déclarations du vendeur</h2><p>Utilisation antérieure : '+esc(x.previousUses.join(', ')||'Non précisée')+' · Marché d’origine : '+esc(x.market)+'</p>'+
 '<p>Propriété et droits de tiers : '+esc(x.ownerConfirmed?'Confirmés par le vendeur':'À confirmer')+'. '+esc(x.liens)+'</p>'+
 '<p>Compteur / kilométrage : '+esc(x.odometerConfirmed?'Confirmé par le vendeur':'À confirmer')+'. '+esc(x.odometerNotes)+'</p>'+
 '<p>Condition, dommages et réparations déclarés : '+esc(x.conditionNotes||'Non précisés')+'</p>'+
 '<p>Coussins gonflables : '+esc(x.airbags)+'. '+esc(x.airbagNotes)+'</p>')+
 (x.notes?'<p>Notes : '+esc(x.notes)+'</p>':'')+totalsHTML(x)+
 '<p>Signé à Lévis, le '+esc(x.date)+'. Les parties confirment les renseignements inscrits au présent document.</p>'+signature()+'</article>';
}
export function leaseDocument(x){
 return '<article class="purchase-sheet">'+address()+'<h1>Rachat de location</h1><p>Date : '+esc(x.date)+' · '+esc(x.status)+'</p>'+
 '<table><tbody>'+row('Directrice financière',x.financeManager)+row('Client',x.client)+row('Véhicule / stock',x.model+' / '+(x.stock||'—'))+row('NIV',x.vin||'—')+row('Locateur',x.lender||'—')+row('Achat',x.payment==='comptant'?'Comptant':'Financement')+'</tbody></table>'+
 '<h2>Produits financiers vendus et profits</h2><table><thead><tr><th>Catégorie</th><th>Produit</th><th>Profit</th></tr></thead><tbody>'+
 x.products.map(p=>'<tr><td>'+esc(p.category)+'</td><td>'+esc(p.name)+'</td><td>'+currency(p.profit)+'</td></tr>').join('')+
 (x.products.length?'':'<tr><td colspan="3">Aucun produit financier vendu.</td></tr>')+
 '<tr><th colspan="2">Profit total des produits</th><td>'+currency(leaseProfit(x.products))+'</td></tr></tbody></table>'+
 (x.notes?'<p>'+esc(x.notes)+'</p>':'')+'<p>Suivi interne du rachat. Les profits ne constituent pas les prix facturés au client.</p></article>';
}
