const ZONE='America/Toronto';
const clock=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function wallTime(value){const p=Object.fromEntries(clock.formatToParts(new Date(value)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);}

// Interpret appointments in Quebec even when the visitor is in another zone.
export function deliveryTimestamp(delivery){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(delivery?.date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(delivery?.time||''))return NaN;
 const [y,m,d]=delivery.date.split('-').map(Number),[h,min]=delivery.time.split(':').map(Number);
 const wall=Date.UTC(y,m-1,d,h,min),check=new Date(wall);
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return NaN;
 let value=wall;
 for(let i=0;i<4;i++)value+=wall-wallTime(value);
 return wallTime(value)===wall?value:NaN;
}
export function deliveryReady(v){return ['Prête','Livré'].includes(v.delivery?.status)&&!v.blocker?.trim()&&['inspection','mechanique','sousTraitance','lavage','pieces'].every(k=>['Terminé','Non requis'].includes(v.steps?.[k]?.status));}
export function urgentDelivery(v,now=Date.now()){
 if(v.archived||!v.delivery||['Livré','Annulée'].includes(v.delivery.status)||deliveryReady(v))return false;
 const due=deliveryTimestamp(v.delivery);
 return Number.isFinite(due)&&due-Number(now)<=5*60*60*1000;
}
