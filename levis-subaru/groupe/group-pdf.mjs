import {aadPeriodLabel,aadPeriodNote} from './aad-period.mjs?v=1.20.1';
import {groupEntryLabel} from './group-membership.mjs?v=1.20.1';
import {REPORT_DEPARTMENTS,selectedDepartments,departmentTotals,departmentNotes,formatReportValue,reportStateLabel} from './department-reporting.mjs?v=1.20.1';
import {REPORT_LABELS,sortGroupRows} from './dashboard-model.mjs?v=1.20.1';
import {reportingPeriod} from './reporting.mjs?v=1.20.1';
import {FONT_WIDTHS} from './pdf-font-metrics.mjs?v=1.20.1';
import {HISTORY_DEPARTMENTS,historyTotals,historyNotes,historyServiceAnalyses} from './history-model.mjs?v=1.20.1';
import {SERVICE_ANALYSES} from './service-metrics.mjs?v=1.20.1';
const WINANSI={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
const normalize=value=>String(value??'').replace(/[\u00a0\u202f\t]/g,' ').replace(/[\r\n]+/g,' ').replace(/→/g,' > ').replace(/✓/g,'OK');
const code=char=>char.charCodeAt(0)<256?char.charCodeAt(0):WINANSI[char.charCodeAt(0)]??63;
const bytes=value=>Uint8Array.from([...value].map(char=>code(char)));
const hex=value=>[...normalize(value)].map(c=>code(c).toString(16).padStart(2,'0')).join('');
const width=(value,size,bold=false)=>[...normalize(value)].reduce((n,c)=>n+FONT_WIDTHS[bold?1:0][code(c)],0)*size/1000;
function wrap(value,max,size,bold=false){
 const lines=[];let line='';
 for(const word of normalize(value).split(' ')){
  if(line&&width(line+' '+word,size,bold)>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);return lines.length?lines:[''];
}
const rgb=color=>color.map(v=>Number(v).toFixed(3)).join(' ');
const INK=[.094,.231,.337],MUTED=[.38,.45,.51],NAVY=[.067,.176,.263],LINE=[.86,.90,.93],TEAL=[.03,.47,.43];
function createPage(){
 const commands=[];
 return {commands,
  rect(x,y,w,h,color){commands.push(rgb(color)+' rg '+[x,y,w,h].join(' ')+' re f');},
  line(x1,y1,x2,y2,color=LINE){commands.push(rgb(color)+' RG 0.4 w '+x1+' '+y1+' m '+x2+' '+y2+' l S');},
  text(value,x,y,{size=8,bold=false,color=INK,right=false}={}){const actual=right?x-width(value,size,bold):x;commands.push('BT '+rgb(color)+' rg /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+actual.toFixed(2)+' '+y.toFixed(2)+' Tm <'+hex(value)+'> Tj ET');}
 };
}
const state=reportStateLabel;
function fitLabel(value,max,size,bold=false){let text=normalize(value);if(width(text,size,bold)<=max)return text;while(text&&width(text+'…',size,bold)>max)text=text.slice(0,-1);return text+'…';}
const monthLabel=month=>new Date(month+'-15T12:00:00Z').toLocaleDateString('fr-CA',{month:'long',year:'numeric',timeZone:'America/Toronto'});
function renderSheet({rows,allRows,id,serviceAnalysis,kind,month,scope,search,periodEnd,simulated,historical,generatedAt,part,totalParts,pageNumber,totalPages}){
 const base=(historical?HISTORY_DEPARTMENTS:REPORT_DEPARTMENTS)[id],def=serviceAnalysis?{...base,label:'Service · '+SERVICE_ANALYSES[serviceAnalysis].label,columns:SERVICE_ANALYSES[serviceAnalysis].columns}:base,page=createPage(),W=841.89,H=595.28,M=28,inner=W-2*M;
 page.rect(0,H-69,W,69,NAVY);page.text('GROUPE COUTURE / SOMMAIRE DES DÉPARTEMENTS',M,H-23,{size:9.2,bold:true,color:[.74,.83,.89]});
 page.text(def.label,M,H-52,{size:23,bold:true,color:[1,1,1]});page.text(kind==='ytd'?aadPeriodLabel(allRows[0]?.aad):REPORT_LABELS[kind]+' · '+monthLabel(month),W-M,H-37,{size:10,right:true,color:[1,1,1]});
 if(kind==='ytd')page.text('Mois sélectionné : '+monthLabel(month),W-M,H-54,{size:8.5,right:true,color:[1,1,1]});
 if(['weekly','month_to_date'].includes(kind)&&periodEnd)page.text((historical?'Situation au ':'Semaine au ')+periodEnd,W-M,H-54,{size:8.5,right:true,color:[1,1,1]});
 page.rect(M,H-101,inner,21,[1,.956,.85]);page.text(historical?'HISTORIQUE GOOGLE SHEETS - Import en lecture seule. Balance déclarée au fichier, sans validation DG automatique.':simulated?'DONNÉES SIMULÉES - Aperçu de préparation. Aucun résultat réel raccordé.':'RAPPORTS SOUMIS AU GROUPE - Versions officielles conservées sur le serveur.',M+9,H-94,{size:8,bold:true,color:[.48,.34,.10]});
 const scopeLabel={all:'Toutes les concessions',received:historical?'Résultats importés':'Rapports soumis',pending:historical?'Résultats absents':'À recevoir'}[scope]||'Toutes les concessions';
 const filter=scopeLabel+(search?' · Recherche : '+search:'');page.text(fitLabel(filter,inner*.52,8.2),M,H-117,{size:8.2,color:MUTED});
 const totals=(historical?historyTotals:departmentTotals)(allRows,id);page.text(allRows.length+' concessions affichées · '+totals.completed+' complétés'+(totals.exempt?' · '+totals.exempt+' hors groupe':'')+(totalParts>1?' · Feuillet '+part+'/'+totalParts:''),W-M,H-117,{size:8.2,color:MUTED,right:true});
 const columns=[{key:'name',label:'Concession',format:'text',weight:146},...def.columns.map(([key,label,format,weight])=>({key,label,format,weight})),{key:'status',label:'État du rapport',format:'text',weight:99}];
 const totalWeight=columns.reduce((n,c)=>n+c.weight,0);let x=M;
 for(const c of columns){c.x=x;c.width=inner*c.weight/totalWeight;x+=c.width;}
 const top=H-133,headH=29,rowH=16;
 page.rect(M,top-headH,inner,headH,[.925,.950,.965]);
 for(const col of columns){const lines=wrap(col.label,col.width-10,7.1,true);lines.slice(0,2).forEach((line,i)=>page.text(line,col.format==='text'?col.x+5:col.x+col.width-5,top-11-i*9,{size:7.1,bold:true,right:col.format!=='text',color:MUTED}));}
 let y=top-headH;
 if(!rows.length){page.text('Aucune concession dans la sélection.',M+8,y-20,{size:9,color:MUTED});y-=34;}
 rows.forEach((row,i)=>{
  if(i%2===0)page.rect(M,y-rowH,inner,rowH,[.972,.980,.985]);
  const values=row.departments[id];
  for(const col of columns){
   const raw=col.key==='name'?row.name+(groupEntryLabel(row)?' · '+groupEntryLabel(row):''):col.key==='status'?state(row,id):formatReportValue(values[col.key],col.format);
   if(col.format==='text'){
    const lines=wrap(raw,col.width-10,8.5,col.key==='name');
    lines.slice(0,2).forEach((line,n)=>page.text(fitLabel(line,col.width-10,lines.length>1?7:8.5,col.key==='name'),col.x+5,y-(lines.length>1?6.5+n*7.2:11.5),{size:lines.length>1?7:8.5,bold:col.key==='name',color:col.key==='status'?(values.hasOfficial?TEAL:MUTED):INK}));
   }else if(historical&&col.key==='inventory'&&values.stockAsOf){
    page.text(raw,col.x+col.width-5,y-7.1,{size:7.8,bold:true,right:true});page.text(values.stockAsOf,col.x+col.width-5,y-14.1,{size:5.8,color:MUTED,right:true});
   }else if(col.key==='coverage'&&values.coverage!==null){
    page.text(raw+(historical&&!values.referenceConfirmed?' *':''),col.x+col.width-5,y-7.1,{size:7.8,bold:true,right:true});page.text(formatReportValue(values.inventory,'count')+' / '+formatReportValue(values.previousSales,'count'),col.x+col.width-5,y-14.1,{size:5.8,color:MUTED,right:true});
   }else page.text(raw,col.x+col.width-5,y-11.5,{size:8.5,right:true});
  }
  page.line(M,y-rowH,W-M,y-rowH);y-=rowH;
 });
 page.rect(M,y-23,inner,23,[.884,.938,.944]);
 for(const col of columns){const value=col.key==='name'?(historical?totals.partialTotals?'Total connu · partiel':'Groupe importé':'Groupe soumis'):col.key==='status'?totals.completed+' / '+totals.dealers:formatReportValue(totals[col.key],col.format);page.text(value,col.format==='text'?col.x+5:col.x+col.width-5,y-14.5,{size:7.7,bold:true,right:col.format!=='text'});}
 let noteY=y-36;
 for(const note of [...(historical?historyNotes:departmentNotes)(id),...(kind==='ytd'?[aadPeriodNote(allRows[0]?.aad)]:[])])for(const line of wrap(note,inner,7.2)){page.text(line,M,noteY,{size:7.2,color:MUTED});noteY-=9;}
 page.line(M,30,W-M,30);const stamp=new Date(generatedAt).toLocaleString('fr-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
 page.text('Émis le '+stamp+' · Moyennes pondérées · Montants en dollars canadiens',M,17,{size:7,color:MUTED});page.text('Page '+pageNumber+' / '+totalPages,W-M,17,{size:7,right:true,color:MUTED});
 return page.commands.join('\n');
}
function assemblePDF(streams){
 const objects=[],set=(n,value)=>{objects[n]=value;};
 set(1,'<< /Type /Catalog /Pages 2 0 R >>');set(2,'<< /Type /Pages /Count '+streams.length+' /Kids ['+streams.map((_,i)=>(5+i*2)+' 0 R').join(' ')+'] >>');
 set(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');set(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 streams.forEach((stream,i)=>{const page=5+i*2,content=page+1;set(page,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+content+' 0 R >>');set(content,'<< /Length '+bytes(stream).length+' >>\nstream\n'+stream+'\nendstream');});
 let source='%PDF-1.4\n%âãÏÓ\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(bytes(source).length);source+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const start=bytes(source).length;source+='xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
 return bytes(source);
}
export function generateGroupPdf({rows,departmentIds,kind='weekly',month='2026-10',scope='all',search='',periodEnd=null,simulated=true,historical=false,generatedAt=new Date().toISOString()}){
 const ids=selectedDepartments(departmentIds);if(!Array.isArray(rows)||!Object.hasOwn(REPORT_LABELS,kind)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number.isNaN(Date.parse(generatedAt)))throw Error('Paramètres de rapport invalides.');
 if(kind==='weekly'&&periodEnd)reportingPeriod(kind,month,periodEnd);
 rows=sortGroupRows(rows);
 const available=historyServiceAnalyses(rows),analyses=available.length?available:['mechanics'];
 const sheets=ids.flatMap(id=>historical&&id==='service'?analyses.map(serviceAnalysis=>({id,serviceAnalysis})):[{id}]),pages=sheets.flatMap(sheet=>{const size=historical&&sheet.id==='service'?16:19,n=Math.max(1,Math.ceil(rows.length/size));return Array.from({length:n},(_,i)=>({...sheet,rows:rows.slice(i*size,(i+1)*size),part:i+1,totalParts:n}));}),totalPages=pages.length,streams=[];
 for(const page of pages)streams.push(renderSheet({...page,allRows:rows,kind,month,scope,search,periodEnd,simulated,historical,generatedAt,pageNumber:streams.length+1,totalPages}));
 return assemblePDF(streams);
}
