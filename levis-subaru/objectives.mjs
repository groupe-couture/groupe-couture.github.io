export const SECTIONS={
 vente:{label:'Ventes',fields:[['vehicleProfit','Profit brut véhicules','$'],['financeProfit','Profit brut F&I','$']]},
 service:{label:'Service',fields:[['hours','Heures vendues','h'],['revenue','Chiffre d’affaires main-d’œuvre','$'],['profit','Profit brut main-d’œuvre','$']]},
 piece:{label:'Pièces',fields:[['revenue','Chiffre d’affaires pièces','$'],['profit','Profit brut pièces','$']]},
 esthetique:{label:'Esthétique',fields:[['prepared','Véhicules préparés','véhicules'],['delay','Délai moyen de préparation esthétique','jours']]}
};
export function departmentSummary(data,section,month,asOf){
 const year=month.slice(0,4),elapsed=year<asOf.slice(0,4)?12:year===asOf.slice(0,4)?Number(asOf.slice(5,7)):0;
 const current=data[section+'_'+month]||{},months=Array.from({length:elapsed},(_,i)=>data[section+'_'+year+'-'+String(i+1).padStart(2,'0')]||{});
 const sum=(field)=>{const values=months.map(m=>m[field]).filter(Number.isFinite);return {value:values.length?values.reduce((a,b)=>a+b,0):null,missing:elapsed-values.length};};
 const weighted=(field,count)=>{const valid=months.filter(m=>Number.isFinite(m[field])&&Number.isFinite(m[count])&&m[count]>0);const weight=valid.reduce((n,m)=>n+m[count],0);return {value:weight?valid.reduce((n,m)=>n+m[field]*m[count],0)/weight:null,missing:elapsed-valid.length};};
 const ratios=(values)=>{const ratio=(a,b,f=1)=>Number.isFinite(values[a])&&values[b]>0?values[a]/values[b]*f:null;return {margin:ratio('profit','revenue',100),goal_margin:ratio('goal_profit','goal_revenue',100),rate:ratio('revenue','hours'),goal_rate:ratio('goal_revenue','goal_hours')};};
 const ytd={};for(const [key]of SECTIONS[section].fields){ytd[key]=key==='delay'?weighted(key,'prepared'):sum(key);ytd['goal_'+key]=key==='delay'?weighted('goal_delay','goal_prepared'):sum('goal_'+key);}
 const raw=Object.fromEntries(Object.entries(ytd).map(([k,v])=>[k,v.value]));
 const pairedRatio=(a,b,f=1)=>{const paired=months.filter(m=>Number.isFinite(m[a])&&Number.isFinite(m[b]));const denominator=paired.reduce((n,m)=>n+m[b],0);return denominator>0?paired.reduce((n,m)=>n+m[a],0)/denominator*f:null;};
 return {current,ytd,monthRatios:ratios(current),yearRatios:{margin:pairedRatio('profit','revenue',100),goal_margin:pairedRatio('goal_profit','goal_revenue',100),rate:pairedRatio('revenue','hours'),goal_rate:pairedRatio('goal_revenue','goal_hours')},elapsed};
}
