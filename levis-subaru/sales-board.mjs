import {salesSummary,number} from './reporting.mjs?v=1.16.0';
export const HOUSE={id:'maison',name:'Maison'};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function salespersonType(e){
 if(e?.department!=='vente'||!/conseill/.test(norm(e.poste)))return null;
 const title=norm(e.poste);if(/occasion|\bvo\b|usage/.test(title))return 'VO';if(/neuf|neuve|\bvn\b/.test(title))return 'VN';return null;
}
export const salespeople=(employees,type)=>employees.filter(e=>salespersonType(e)===type).map(e=>({id:e.id,name:e.name})).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
export function boardSeller(s,employees){return salespeople(employees,s.type).find(e=>e.id===s.sellerId)||HOUSE;}
export function salesBoardGroups(sales,targets,employees,type,month,asOf){
 const people=[...salespeople(employees,type),HOUSE],view=sales.map(s=>{const seller=boardSeller(s,employees);return{...s,sellerId:seller.id,sellerName:seller.name};});
 const plans=targets.filter(t=>t.type===type&&t.month===month),normalized=plans.filter(t=>people.some(e=>e.id===t.sellerId));
 if(!normalized.some(t=>t.sellerId===HOUSE.id&&number(t.goal)!==null)){
  const old=plans.filter(t=>employees.some(e=>e.id===t.sellerId&&/direct(eur|rice).*vent/.test(norm(e.poste)))).map(t=>number(t.goal)).filter(Number.isFinite);
  if(old.length){const i=normalized.findIndex(t=>t.sellerId===HOUSE.id);if(i>=0)normalized.splice(i,1);normalized.push({type,month,sellerId:HOUSE.id,sellerName:HOUSE.name,goal:old.reduce((a,b)=>a+b,0)});}
 }
 const groups=salesSummary(view,normalized,type,month,asOf);
 return people.map(e=>({...groups.find(g=>g.sellerId===e.id),sellerId:e.id,sellerName:e.name,goal:groups.find(g=>g.sellerId===e.id)?.goal??null,month:groups.find(g=>g.sellerId===e.id)?.month||[],ytd:groups.find(g=>g.sellerId===e.id)?.ytd||0}));
}
export function dealGrid(width,height,count){
 if(!count)return{columns:1,rows:1,width:96,height:Math.max(38,height)};
 const gap=3,maxColumns=Math.max(1,Math.floor((width+gap)/(60+gap))),maxRows=Math.max(1,Math.floor((height+gap)/(38+gap)));
 const columns=Math.min(maxColumns,Math.max(1,Math.ceil(count/maxRows),Math.min(count,Math.floor((width+gap)/98)))),rows=Math.ceil(count/columns);
 return{columns,rows,width:Math.min(100,Math.floor((width-gap*(columns-1))/columns)),height:Math.max(38,Math.floor((height-gap*(rows-1))/rows))};
}
