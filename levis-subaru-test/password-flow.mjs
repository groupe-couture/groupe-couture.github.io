export const RECOVERY_EXPIRED='Ce lien de récupération est invalide ou expiré. Demandez un nouveau courriel avec « Mot de passe oublié ».';
export function passwordLinkState(href){
 const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
 const type=fragment.get('type')||url.searchParams.get('type');
 const invalid=fragment.has('error')||fragment.has('error_code')||url.searchParams.has('error')||url.searchParams.has('error_code');
 return {intent:['recovery','invite'].includes(type)?type:null,invalid};
}
export function passwordReturnTarget(href){
 const state=passwordLinkState(href);if(!state.intent&&!state.invalid)return null;
 const source=new URL(href),target=new URL('../',source);target.search=source.search;target.hash=source.hash;return target.href;
}
export function cleanPasswordUrl(href){
 const url=new URL(href);url.hash='';for(const key of ['recuperation','type','code','error','error_code','error_description'])url.searchParams.delete(key);return url.href;
}
export function createPasswordFlow(href){
 let {intent,invalid}=passwordLinkState(href),finished=false,ready=false;
 return {
  get pending(){return !!intent&&!invalid&&!finished;},
  get ready(){return ready&&!invalid&&!finished;},
  get invalid(){return invalid;},
  observe(event,session){
   if(event==='PASSWORD_RECOVERY'){intent='recovery';invalid=false;finished=false;ready=!!session?.user;}
   else if(this.pending&&['INITIAL_SESSION','SIGNED_IN'].includes(event)){
    ready=!!session?.user;if(!ready)invalid=true;
   }else if(this.pending&&event==='SIGNED_OUT'){ready=false;invalid=true;}
   return {show:this.ready,invalid:this.invalid};
  },
  complete(){finished=true;ready=false;}
 };
}
