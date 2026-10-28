import {STEPS,today} from './domain.mjs?v=1.14.1';
const done=s=>['Terminé','Non requis'].includes(s?.status);
export const validDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function dayDistance(a,b){return validDay(a)&&validDay(b)?Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000):null;}
export function stampPreparation(previous,next,asOf=today()){
 const v=structuredClone(next);v.steps=v.steps||{};
 for(const [key]of STEPS){
  const step=v.steps[key];if(!step)continue;const old=previous?.steps?.[key];
  if(step.status==='En cours'&&old?.status!=='En cours'&&!step.startedOn)step.startedOn=asOf;
  if(step.status==='Terminé'&&old?.status!=='Terminé'&&!step.finishedOn)step.finishedOn=asOf;
  if(step.status==='À faire'&&old&&old.status!=='À faire'){step.startedOn='';step.finishedOn='';}
  if(step.status==='En cours')step.finishedOn='';
  if(step.status==='Non requis'){step.startedOn='';step.finishedOn='';}
 }
 const allDone=v.type==='VO'&&STEPS.every(([k])=>done(v.steps[k]));
 const wasDone=previous?.type==='VO'&&STEPS.every(([k])=>done(previous.steps?.[k]));
 if(!allDone)v.prepFinishedOn='';
 else if(!v.prepFinishedOn&&!wasDone){const dates=STEPS.map(([k])=>v.steps[k]).filter(s=>s.status==='Terminé').map(s=>s.finishedOn).filter(validDay);v.prepFinishedOn=dates.length?dates.sort().at(-1):asOf;}
 return v;
}
export function preparationDateErrors(v,asOf=today()){
 const errors={};
 for(const [k,label]of STEPS){const s=v.steps?.[k];if(!s)continue;
  for(const [field,text]of [['startedOn','début'],['finishedOn','fin']])if(s[field]&&(!validDay(s[field])||s[field]>asOf))errors[field+'_'+k]=label+' : date de '+text+' invalide ou future.';
  if(validDay(s.startedOn)&&validDay(s.finishedOn)&&s.finishedOn<s.startedOn)errors['finishedOn_'+k]=label+' : la fin doit suivre le début.';
  if(validDay(s.startedOn)&&validDay(v.arrival)&&s.startedOn<v.arrival)errors['startedOn_'+k]=label+' : le début doit suivre l’arrivée.';
  if(validDay(s.finishedOn)&&validDay(v.arrival)&&s.finishedOn<v.arrival)errors['finishedOn_'+k]=label+' : la fin doit suivre l’arrivée.';
  if(s.finishedOn&&s.status!=='Terminé')errors['finishedOn_'+k]=label+' : une date de fin exige l’état Terminé.';
 }
 if(v.prepFinishedOn&&(!validDay(v.prepFinishedOn)||v.prepFinishedOn>asOf||v.prepFinishedOn<v.arrival))errors.prepFinishedOn='La fin de préparation doit être entre la date d’arrivée et aujourd’hui.';
 if(v.prepFinishedOn&&!STEPS.every(([k])=>done(v.steps?.[k])))errors.prepFinishedOn='Complétez toutes les étapes VO avant d’indiquer la fin de préparation.';
 return errors;
}
export function preparationAnalysis(records,asOf=today()){
 const month=asOf.slice(0,7),year=asOf.slice(0,4),d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-3);const startThree=d.toISOString().slice(0,10);
 const ranges=[{key:'month',label:'Mois en cours',from:month+'-01',to:asOf},{key:'three',label:'3 derniers mois terminés',from:startThree,to:month+'-01',exclusive:true},{key:'year',label:'Année à date',from:year+'-01-01',to:asOf}];
 const within=(date,r)=>validDay(date)&&date>=r.from&&(r.exclusive?date<r.to:date<=r.to);
 return ranges.map(r=>{const result={...r};for(const key of ['total','inspection','lavage','photos']){
  const values=[];let missing=0;
  for(const v of records.filter(v=>v.type==='VO')){
   const end=key==='total'?v.prepFinishedOn:v.steps?.[key]?.finishedOn;
   const start=key==='total'?v.arrival:v.steps?.[key]?.startedOn;
   if(key!=='total'&&v.steps?.[key]?.status!=='Terminé')continue;
   if(key==='total'&&!STEPS.every(([k])=>done(v.steps?.[k])))continue;
   if(!validDay(end)){missing++;continue;}if(!within(end,r))continue;
   const days=dayDistance(start,end);if(days===null||days<0){missing++;continue;}values.push(days);
  }
  result[key]={average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,count:values.length,missing};
 }return result;});
}
