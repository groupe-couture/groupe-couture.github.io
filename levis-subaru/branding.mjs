import {DEALERSHIP_BRANDS} from './branding-data.mjs?v=1.21.0';
const EMBEDDED_LOGOS={};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const BRAND_PALETTES={
 couture:{primary:'#354353',sidebar:'#142331',soft:'#f3f6f8',ink:'#183044'},
 subaru:{primary:'#00529b',sidebar:'#092746',soft:'#f3f7fc',ink:'#102f4c'},
 ford:{primary:'#003478',sidebar:'#09274b',soft:'#f3f7fc',ink:'#163552'},
 hyundai:{primary:'#003b70',sidebar:'#082747',soft:'#f4f8fc',ink:'#173a58'},
 kia:{primary:'#05141f',sidebar:'#05141f',soft:'#f5f5f2',ink:'#182b37'},
 gm:{primary:'#856000',sidebar:'#252a30',soft:'#f8f7f3',ink:'#33352f'},
 toyota:{primary:'#c8102e',sidebar:'#29151b',soft:'#fbf6f6',ink:'#3c2630'},
 mazda:{primary:'#30373d',sidebar:'#171c20',soft:'#f5f6f7',ink:'#27333c'},
 mitsubishi:{primary:'#c5001b',sidebar:'#25191e',soft:'#faf5f6',ink:'#3c2630'}
};
export function dealershipBrand(id){return Object.hasOwn(DEALERSHIP_BRANDS,id)?DEALERSHIP_BRANDS[id]:DEALERSHIP_BRANDS['groupe-couture'];}
export function brandLogoHtml(id,{maxHeight=112,maxWidth=240,label=null}={}){
 const brand=dealershipBrand(id),[x,y,w,h]=brand.crop,ratio=w/h;
 const source=EMBEDDED_LOGOS[brand.id]||new URL(brand.asset,import.meta.url).href;
 return '<span class="brand-logo-card"><span class="brand-logo-viewport" style="aspect-ratio:'+ratio+';max-width:'+Math.min(maxWidth,maxHeight*ratio)+'px"><img alt="'+esc(label||brand.name||brand.id)+'" src="'+esc(source)+'" decoding="async" draggable="false" style="width:'+(100*brand.width/w)+'%;height:'+(100*brand.height/h)+'%;left:'+(-100*x/w)+'%;top:'+(-100*y/h)+'%"></span></span>';
}
function mountLogo(node,id,options={}){if(node&&node.dataset.logoId!==id){node.innerHTML=brandLogoHtml(id,options);node.dataset.logoId=id;}}
export function applyPlatformBrand(id,{shell='workspace'}={}){
 const brand=dealershipBrand(id),palette=BRAND_PALETTES[brand.family];
 const html=document.documentElement;
 if(html.dataset.brand!==brand.family){html.dataset.brand=brand.family;for(const [key,value]of Object.entries(palette))html.style.setProperty('--brand-'+key,value);}
 html.dataset.dealershipBrand=brand.id;
 const aside=document.querySelector('aside>.brand');
 const identity=shell==='group'?'groupe-couture':brand.id;
 mountLogo(aside,identity,{maxHeight:shell==='group'?114:108,label:dealershipBrand(identity).name});
 if(aside&&!aside.querySelector('.brand-caption'))aside.insertAdjacentHTML('beforeend','<span class="brand-caption">'+(shell==='group'?'PLATEFORME DU GROUPE':'ESPACE CONCESSION')+'</span>');
 if(shell==='group')mountLogo(document.querySelector('#groupLoginLogo'),'groupe-couture',{maxHeight:120,maxWidth:260});
 else mountLogo(document.querySelector('#login>.brand'),brand.id,{maxHeight:115,maxWidth:280});
}
