// Mesures Téléprésence. Les KPI d'atelier existants restent une analyse distincte.
export const SERVICE_ANALYSES={
 organisation:{label:'Organisation et travaux',columns:[['advisors','Aviseurs','decimal',60],['openROs','BR ouverts','count',68],['technicians','Techniciens','decimal',65],['wip','Travaux en cours','money',95]]},
 rates:{label:'Taux et matériel',columns:[['shopMaterialsCost','Coût matériel BR shop','money',90],['actualClientHourlyRate','Taux MO réel client','money',85],['postedClientHourlyRate','Taux MO affiché','money',80],['customerPartsGrossPercent','Brut pièces clients','percent',80]]},
 mechanics:{label:'Mécanique',columns:[['retailRevenue','Ventes clients détail','money',85],['retailProfit','Brut détail','money',78],['retailGrossPercent','Marge détail','percent',65],['revenue','Ventes MO totales','money',85],['profit','Brut MO total','money',80],['reportedMargin','Marge MO déclarée','percent',65]]},
 retained:{label:'KPI complémentaires conservés',columns:[['hours','Heures vendues','decimal',70],['presence','Heures disponibles','decimal',75],['clocked','Heures pointées','decimal',70],['productivity','Productivité','percent',70],['efficiency','Efficacité','percent',65],['utilization','Rendement','percent',65]]}
};
export const SERVICE_EXTRA_COLUMNS=[['hoursPerRO','Heures par BR','decimal',60],['billedROs','BR avec heures','count',60],['unbilledHours','Heures non facturées','decimal',65],['customerGrossPercent','Brut client déclaré','percent',65],['netSales','Ventes nettes déclarées','money',80],['customerSellingRate','Taux vendant client déclaré','money',75],['hourlyRate','Taux horaire déclaré','money',75]];
export const SERVICE_FLOW_KEYS=['retailRevenue','retailProfit','revenue','profit','shopMaterialsCost','hours','presence','clocked','unbilledHours','billedROs','netSales'];
export const SERVICE_SNAPSHOT_KEYS=['advisors','openROs','technicians','wip','actualClientHourlyRate','postedClientHourlyRate','customerPartsGrossPercent','customerSellingRate','hourlyRate','hoursPerRO','customerGrossPercent'];
const finite=v=>typeof v==='number'&&Number.isFinite(v),ratio=(a,b,m=1)=>finite(a)&&finite(b)&&b>0?a/b*m:null;
// Compare original observations, not independently aggregated totals. Two absent
// fields share a basis, but a value on only one side must never produce a ratio.
export const SERVICE_RATIO_BASES={margin:['profit','revenue'],rate:['revenue','hours'],productivity:['clocked','presence'],efficiency:['hours','clocked'],utilization:['hours','presence'],retailGrossPercent:['retailProfit','retailRevenue'],hoursPerRO:['hours','billedROs']};
export function serviceDerived(values,{annual=false,inputs=null}={}){
 const v={...values};
 v.margin=ratio(v.profit,v.revenue,100);v.rate=ratio(v.revenue,v.hours);
 for(const [key,a,b]of [['productivity','clocked','presence'],['efficiency','hours','clocked'],['utilization','hours','presence']])v[key]=ratio(v[a],v[b],100)??(annual?null:v[key]??null);
 if(annual){v.retailGrossPercent=ratio(v.retailProfit,v.retailRevenue,100);v.reportedMargin=v.margin;v.hoursPerRO=ratio(v.hours,v.billedROs);}
 if(annual&&inputs){
  v.serviceRatioCoverage=Object.fromEntries(Object.entries(SERVICE_RATIO_BASES).map(([key,[a,b]])=>{
   const active=inputs.some(x=>finite(x[a])||finite(x[b])),paired=inputs.filter(x=>finite(x[a])&&finite(x[b])).length;
   const comparable=inputs.every(x=>finite(x[a])===finite(x[b]));
   if(!comparable)v[key]=null;
   return [key,{comparable,received:paired,expected:inputs.length,partial:active&&paired<inputs.length}];
  }));
  v.reportedMargin=v.margin;
 }
 return v;
}
export const SERVICE_NOTES='Effectifs, BR ouverts, travaux en cours, taux et brut pièces clients : dernière photo de la période. Coût matériel et résultats de mécanique : mois finaux cumulés pour l’AAD. Les taux clients et le brut pièces ne sont pas moyennés entre concessions faute de bases comparables. Les KPI complémentaires choisis pour Lévis Subaru sont conservés.';
