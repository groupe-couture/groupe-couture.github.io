import {esc,today} from './domain.mjs?v=1.16.0';
import {newId} from './invitations.mjs?v=1.16.0';
import {DEALER,PURCHASE_TAX_MODES,USES,PRODUCT_CATEGORIES,currency,purchaseTotals,purchaseErrors,leaseErrors,leaseProfit,purchaseFromDossier,purchaseDocument,leaseDocument,totalsHTML} from './purchases.mjs?v=1.16.0';
const $=s=>document.querySelector(s);
const input=(key,label,value='',type='text',attrs='')=>'<label>'+label+'<input name="'+key+'" type="'+type+'" value="'+esc(value??'')+'" '+attrs+'></label>';
const select=(key,label,options,value)=>'<label>'+label+'<select name="'+key+'">'+Object.entries(options).map(([k,v])=>'<option value="'+esc(k)+'" '+(value===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
const list=a=>Object.fromEntries(a.map(k=>[k,k]));
const text=(f,k)=>f.elements[k].value.trim();
const num=(f,k)=>f.elements[k].value===''?null:Number(f.elements[k].value);
const moneyAttrs='required min="0" max="10000000" step="0.01"';
const required='required maxlength="200"';
export function createPurchaseTools(env){
 const C=()=>env.state();
 function sourceSelect(){
  return '<label>Reprendre le véhicule d’un dossier<select id="purchaseSource"><option value="">Saisie manuelle</option>'+
   C().records.filter(v=>!v.archived).map(v=>'<option value="'+esc(v.id)+'">'+esc(v.stock+' · '+v.model)+'</option>').join('')+'</select></label>';
 }
 function mark(f){
  let invalid=false;
  f.querySelectorAll('input,select,textarea').forEach(el=>{const bad=!el.checkValidity();el.classList.toggle('field-invalid',bad);if(bad)invalid=true;});
  return invalid;
 }
 function savedPreview(old,html){
  return old?'<div class="purchase-document-actions"><button type="button" id="printPurchase">Imprimer / enregistrer en PDF</button></div><details class="purchase-preview"><summary>Aperçu du document enregistré</summary>'+html+'</details>':'<p class="muted">Enregistrez le document pour l’imprimer ou l’enregistrer en PDF.</p>';
 }
 function bindSource(f,isLease=false){
  $('#purchaseSource').onchange=e=>{
   const v=C().records.find(v=>v.id===e.target.value);if(!v)return;
   for(const [k,value]of Object.entries(purchaseFromDossier(v)))if(f.elements[k])f.elements[k].value=value;
   if(isLease&&v.delivery?.client)f.elements.client.value=v.delivery.client;
  };
 }
 function emptyPurchase(kind){
  return {kind,date:today(),status:'Actif',client:'',sellerAddress:'',sellerPhone:'',sellerEmail:'',gstNumber:'',qstNumber:'',sellerRepresentative:'',sellerLicence:'',
   make:'',model:'',vin:'',stock:'',registration:'',lender:'',displacement:'',weight:'',year:'',odometer:'',actualOdometer:null,odometerUnit:'km',market:'Non précisé',previousUses:[],
   airbags:'Non précisé',accessories:'',liens:'',conditionNotes:'',airbagNotes:'',odometerNotes:'',notes:'',ownerConfirmed:false,odometerConfirmed:false,
   value:'',balance:'',taxMode:kind==='company'?'equity':'none',gst:0,qst:0};
 }
 function purchase(kind,id){
  const old=env.rows().purchases.find(x=>x.id===id),x=old||emptyPurchase(kind),company=kind==='company';
  const title=company?'Achat véhicule entreprise':'Achat véhicule';
  const f=env.modal(title,sourceSelect()+'<p class="muted">'+(company?'Calcul repris du modèle de droit de tenure à bail : valeur moins solde, puis taxes.':'Renseignements du vendeur, du véhicule et calcul de l’équité. Les taxes apparaissent après le solde.')+'</p>'+
   '<div class="form-grid">'+input('date','Date d’achat',x.date,'date','required max="'+today()+'"')+
   select('status','État',list(['Actif','Annulé']),x.status)+input('client',company?'Nom de l’entreprise vendeuse':'Nom du vendeur',x.client,'text',required)+
   input('sellerRepresentative','Représentant / signataire',x.sellerRepresentative,'text','maxlength="200"')+
   input('sellerAddress','Adresse complète du vendeur',x.sellerAddress,'text',required)+input('sellerPhone','Téléphone',x.sellerPhone,'tel','maxlength="200"')+
   input('sellerEmail','Courriel',x.sellerEmail,'email','maxlength="200"')+input('sellerLicence','Permis de conduire / référence',x.sellerLicence,'text','maxlength="200"')+
   input('gstNumber','Numéro de TPS du vendeur (si applicable)',x.gstNumber,'text','maxlength="200"')+input('qstNumber','Numéro de TVQ du vendeur (si applicable)',x.qstNumber,'text','maxlength="200"')+'</div>'+
   '<h3>Véhicule</h3><div class="form-grid">'+input('stock','Stock / référence',x.stock,'text','maxlength="200"')+
   input('year','Année',x.year,'number','required min="1886" max="'+(Number(today().slice(0,4))+1)+'" step="1"')+
   input('make','Marque',x.make,'text',required)+input('model','Modèle / véhicule',x.model,'text',required)+
   input('vin','NIV / numéro de série',x.vin,'text','required maxlength="25"')+input('registration','Immatriculation',x.registration,'text','maxlength="200"')+
   input('displacement','Cylindrée',x.displacement,'text','maxlength="200"')+input('weight','Poids',x.weight,'text','maxlength="200"')+
   input('odometer','Compteur indiqué',x.odometer,'number','required min="0" max="3000000" step="1"')+
   input('actualOdometer','Compteur réel (si confirmé)',x.actualOdometer,'number','min="0" max="3000000" step="1"')+
   select('odometerUnit','Unité',list(['km','mi']),x.odometerUnit)+select('market','Marché d’origine',list(['Non précisé','Canada','États-Unis','Autre']),x.market)+'</div>'+
   '<label>Accessoires<textarea name="accessories" maxlength="3000">'+esc(x.accessories)+'</textarea></label>'+
   (company?'':'<h3>Déclarations du vendeur</h3><fieldset><legend>Utilisation antérieure</legend><div class="purchase-checks">'+USES.map(u=>'<label><input type="checkbox" name="previousUse" value="'+esc(u)+'" '+(x.previousUses.includes(u)?'checked':'')+'> '+esc(u)+'</label>').join('')+'</div></fieldset>'+
   '<label class="check"><input name="ownerConfirmed" type="checkbox" '+(x.ownerConfirmed?'checked':'')+'> Propriété et droits de tiers vérifiés avec le vendeur</label>'+
   '<label>Liens, droits de tiers et réserves déclarés<textarea name="liens" maxlength="3000">'+esc(x.liens)+'</textarea></label>'+
   '<label class="check"><input name="odometerConfirmed" type="checkbox" '+(x.odometerConfirmed?'checked':'')+'> Compteur et kilométrage confirmés par le vendeur</label>'+
   '<label>Observations sur le kilométrage<textarea name="odometerNotes" maxlength="3000">'+esc(x.odometerNotes)+'</textarea></label>'+
   '<label>Condition, accidents et réparations déclarés<textarea name="conditionNotes" maxlength="3000">'+esc(x.conditionNotes)+'</textarea></label>'+
   select('airbags','Coussins gonflables',list(['Non précisé','Fonctionnel déclaré','Modifié / réparé','Hors fonction']),x.airbags)+
   '<label>Précisions sur les coussins gonflables<textarea name="airbagNotes" maxlength="3000">'+esc(x.airbagNotes)+'</textarea></label>')+
   '<h3>Montants</h3><div class="form-grid">'+input('value','Valeur du véhicule ($)',x.value,'number',moneyAttrs)+input('balance','Solde restant au créancier ($)',x.balance,'number',moneyAttrs)+
   input('lender','Créancier / locateur',x.lender,'text','maxlength="200"')+select('taxMode','Traitement des taxes',PURCHASE_TAX_MODES,x.taxMode)+'</div>'+
   '<p class="muted">Choisissez le traitement applicable avec la comptabilité. Le mode « équité » conserve le signe négatif et augmente le montant à recevoir lorsque les taxes sont négatives.</p>'+
   '<div id="manualPurchaseTaxes" class="form-grid">'+input('gst','TPS saisie ($)',x.gst,'number','step="0.01" min="-10000000" max="10000000"')+
   input('qst','TVQ saisie ($)',x.qst,'number','step="0.01" min="-10000000" max="10000000"')+'</div><div id="purchaseCalculation" aria-live="polite"></div>'+
   '<label>Notes<textarea name="notes" maxlength="3000">'+esc(x.notes)+'</textarea></label>'+savedPreview(old,old?purchaseDocument(old):''));
  f.noValidate=true;
  const financial=()=>({value:text(f,'value'),balance:text(f,'balance'),taxMode:text(f,'taxMode'),gst:text(f,'gst'),qst:text(f,'qst')});
  function calculate(){
   const manual=f.elements.taxMode.value==='manual';$('#manualPurchaseTaxes').hidden=!manual;
   f.elements.gst.required=f.elements.qst.required=manual;
   try{$('#purchaseCalculation').innerHTML=totalsHTML(financial());}catch(e){$('#purchaseCalculation').textContent='Complétez la valeur et le solde pour afficher le calcul.';}
  }
  ['value','balance','taxMode','gst','qst'].forEach(k=>f.elements[k].addEventListener('input',calculate));calculate();bindSource(f);
  if(old)$('#printPurchase').onclick=()=>env.print(title,purchaseDocument(old));
  env.bindSave(f,async()=>{
   const data={...emptyPurchase(kind),...Object.fromEntries(['date','status','client','sellerAddress','sellerPhone','sellerEmail','gstNumber','qstNumber','sellerRepresentative','sellerLicence','make','model','vin','stock','registration','lender','displacement','weight','market','odometerUnit','accessories','notes'].map(k=>[k,text(f,k)]))};
   for(const k of ['year','odometer','actualOdometer'])data[k]=num(f,k);
   for(const k of ['value','balance'])data[k]=num(f,k);
   data.taxMode=text(f,'taxMode');data.gst=data.taxMode==='manual'?num(f,'gst'):0;data.qst=data.taxMode==='manual'?num(f,'qst'):0;
   data.vin=data.vin.toUpperCase();
   if(!company){
    for(const k of ['liens','odometerNotes','conditionNotes','airbags','airbagNotes'])data[k]=text(f,k);
    data.previousUses=[...f.querySelectorAll('[name="previousUse"]:checked')].map(el=>el.value);
    data.ownerConfirmed=f.elements.ownerConfirmed.checked;data.odometerConfirmed=f.elements.odometerConfirmed.checked;
   }
   const invalid=mark(f),errors=purchaseErrors(data);if(invalid||errors.length)throw Error(errors.join(' ')||'Corrigez les champs en rouge.');
   await env.put('vehiclePurchases',id||newId(),data,old);
  });
 }
 function lease(id){
  const old=env.rows().leaseBuyouts.find(x=>x.id===id),x=old||{date:today(),status:'Actif',client:'',financeManager:'',model:'',vin:'',stock:'',lender:'',payment:'comptant',notes:'',products:[]};
  let products=structuredClone(x.products);
  const managers=C().employees.filter(e=>/financi|f&i/i.test(e.poste||'')).map(e=>e.name);
  const f=env.modal('Rachat de location',sourceSelect()+'<div class="form-grid">'+input('date','Date du rachat',x.date,'date','required max="'+today()+'"')+
   select('status','État',list(['Actif','Annulé']),x.status)+input('financeManager','Directrice financière',x.financeManager,'text',required+' list="purchaseManagers"')+
   '<datalist id="purchaseManagers">'+[...new Set(managers)].map(n=>'<option value="'+esc(n)+'"></option>').join('')+'</datalist>'+
   input('client','Nom du client',x.client,'text',required)+input('model','Véhicule',x.model,'text',required)+
   input('vin','NIV',x.vin,'text','maxlength="200"')+input('stock','Stock / référence',x.stock,'text','maxlength="200"')+input('lender','Locateur',x.lender,'text','maxlength="200"')+
   select('payment','Mode d’achat',{comptant:'Comptant',financement:'Financement'},x.payment)+'</div>'+
   '<h3>Produits financiers vendus</h3><p>Inscrivez le profit de chaque produit vendu. Une ligne par produit; aucun produit n’est ajouté automatiquement.</p>'+
   '<datalist id="leaseProductNames">'+env.products().map(p=>'<option value="'+esc(p.name)+'"></option>').join('')+'</datalist>'+
   '<div id="leaseProductRows"></div><button type="button" id="addLeaseProduct">+ Ajouter un produit financier</button>'+
   '<p id="leaseProductTotal" aria-live="polite"></p><label>Notes<textarea name="notes" maxlength="3000">'+esc(x.notes)+'</textarea></label>'+
   savedPreview(old,old?leaseDocument(old):''));
  f.noValidate=true;bindSource(f,true);
  function updateTotal(){try{$('#leaseProductTotal').textContent='Profit total des produits : '+currency(leaseProfit(products));}catch(e){$('#leaseProductTotal').textContent='Complétez le profit de chaque produit.';}}
  function draw(){
   $('#leaseProductRows').innerHTML=products.map((p,i)=>'<fieldset class="lease-product"><legend>Produit '+(i+1)+'</legend><div class="form-grid">'+
    select('category_'+i,'Catégorie',list(PRODUCT_CATEGORIES),p.category)+input('name_'+i,'Produit vendu',p.name,'text',required+' list="leaseProductNames"')+
    input('profit_'+i,'Profit ($)',p.profit,'number','required min="-10000000" max="10000000" step="0.01"')+'</div><button type="button" data-remove-lease="'+i+'">Retirer ce produit</button></fieldset>').join('')||'<p>Aucun produit financier vendu.</p>';
   products.forEach((p,i)=>['category','name','profit'].forEach(k=>f.elements[k+'_'+i].addEventListener('input',()=>{
    if(k==='category'&&p.name===p.category){p.name=text(f,k+'_'+i);f.elements['name_'+i].value=p.name;}
    p[k]=k==='profit'?num(f,k+'_'+i):text(f,k+'_'+i);updateTotal();
   })));
   f.querySelectorAll('[data-remove-lease]').forEach(b=>b.onclick=()=>{products.splice(Number(b.dataset.removeLease),1);draw();});updateTotal();
  }
  draw();$('#addLeaseProduct').onclick=()=>{if(products.length>=100)return;products.push({id:newId(),category:'Assurance crédit',name:'Assurance crédit',profit:null});draw();};
  if(old)$('#printPurchase').onclick=()=>env.print('Rachat de location',leaseDocument(old));
  env.bindSave(f,async()=>{
   const data={...Object.fromEntries(['date','status','client','financeManager','model','vin','stock','lender','payment','notes'].map(k=>[k,text(f,k)])),products};
   const invalid=mark(f),errors=leaseErrors(data);if(invalid||errors.length)throw Error(errors.join(' ')||'Corrigez les champs en rouge.');
   await env.put('leaseBuyouts',id||newId(),data,old);
  });
 }
 function render(section){
  if(!['companyPurchase','vehiclePurchase','leaseBuyout'].includes(section))return false;
  const leasing=section==='leaseBuyout',kind=section==='companyPurchase'?'company':'vehicle';
  const title=leasing?'Rachat de location':kind==='company'?'Achat véhicule entreprise':'Achat véhicule';
  const rows=(leasing?env.rows().leaseBuyouts:env.rows().purchases.filter(x=>x.kind===kind)).filter(x=>x.date.startsWith(C().month)).sort((a,b)=>b.date.localeCompare(a.date));
  const active=rows.filter(x=>x.status==='Actif');
  $('#content').innerHTML='<div class="purchase-section"><button id="newPurchase" class="primary">+ '+title+'</button><p>'+
   (leasing?active.length+' rachat(s) · Profit produits : '+currency(active.reduce((n,x)=>n+Math.round(leaseProfit(x.products)*100),0)/100):esc(DEALER.address))+
   '</p><div class="table-wrap"><table><thead><tr><th>Date</th><th>'+(leasing?'Client':'Vendeur')+'</th><th>Véhicule / stock</th><th>'+(leasing?'Directrice financière':'Solde net')+'</th><th>'+(leasing?'Profit produits':'Sens du paiement')+'</th><th>État</th><th></th></tr></thead><tbody>'+
   rows.map(x=>{const t=leasing?null:purchaseTotals(x);return '<tr><td>'+esc(x.date)+'</td><td>'+esc(x.client)+'</td><td>'+esc(x.model)+'<small>'+esc(x.stock||'')+'</small></td><td>'+
    (leasing?esc(x.financeManager):currency(t.total))+'</td><td>'+(leasing?currency(leaseProfit(x.products)):esc(t.direction))+'</td><td>'+esc(x.status)+'</td><td><button data-open-purchase="'+esc(x.id)+'">Ouvrir / imprimer</button></td></tr>';}).join('')+
   (rows.length?'':'<tr><td colspan="7">Aucun document pour ce mois.</td></tr>')+'</tbody></table></div></div>';
  $('#newPurchase').onclick=()=>leasing?lease():purchase(kind);
  document.querySelectorAll('[data-open-purchase]').forEach(b=>b.onclick=()=>leasing?lease(b.dataset.openPurchase):purchase(kind,b.dataset.openPurchase));return true;
 }
 return {render};
}
