// Supabase adapter for the legacy Firestore-shaped UI, edition 1.13.
// All authorization is enforced by PostgreSQL RLS, not by this client.
export function createSupabaseBridge(client) {
  const subscriptions=new Set();
  const channels=new Map();
  function attachRealtime(name){
    if(name==='users'||typeof client.channel!=='function')return;
    let entry=channels.get(name);
    if(!entry){
      const channel=client.channel('levis-'+name)
        .on('postgres_changes',{
          event:'*',schema:'public',table:'ls_documents',
          filter:'collection_name=eq.'+name
        },()=>requestRefresh(name)).subscribe();
      entry={channel,count:0};
      channels.set(name,entry);
    }
    entry.count++;
  }
  function detachRealtime(name){
    const entry=channels.get(name);
    if(!entry)return;
    if(--entry.count===0){
      channels.delete(name);
      client.removeChannel(entry.channel).catch(()=>{});
    }
  }
  let refreshLoop=null;
  const errorIf = ({error}) => {if(error)throw error;};
  const ref=(collection,id)=>({kind:id===undefined?'collection':'doc',collection,id});
  const collection=(db,name)=>ref(name);
  const doc=(db,name,id)=>{
    if(db?.kind==='collection')return ref(db.collection,name===undefined?crypto.randomUUID():name);
    return ref(name,id===undefined?crypto.randomUUID():id);
  };
  const where=(field,operator,value)=>({field,operator,value});
  const query=(base,...filters)=>({...base,filters});
  const shot=(id,data)=>({id,exists:()=>data!==null&&data!==undefined,data:()=>data===null?undefined:structuredClone(data)});
  const unwrap=(result)=>{errorIf(result);return result.data;};
  const mapMember=(row)=>row && ({
    uid:row.user_id,email:row.email,role:row.role,department:row.department,
    active:row.active,name:row.name||row.email,poste:row.poste||'',invitationStatus:'active'
  });
  async function list(src) {
    if(src.collection==='users'){
      const rows=unwrap(await client.from('ls_members').select('*'));
      return (rows||[]).map(r=>({id:r.user_id,data:mapMember(r)}));
    }
    // Firestore collections are small for this dealership. Pagination handles growth.
    const out=[];
    for(let offset=0;;offset+=500){
      const rows=unwrap(await client.from('ls_documents')
        .select('document_id,data').eq('collection_name',src.collection)
        .order('document_id').range(offset,offset+499));
      for(const row of rows)out.push({id:row.document_id,data:row.data});
      if(rows.length<500)break;
    }
    return out;
  }
  async function getDoc(source){
    if(source.kind!=='doc')throw Error('Document attendu');
    if(source.collection==='users'){
      const row=unwrap(await client.from('ls_members').select('*')
        .eq('user_id',source.id).maybeSingle());
      return shot(source.id,mapMember(row));
    }
    const row=unwrap(await client.from('ls_documents').select('data')
      .eq('collection_name',source.collection).eq('document_id',source.id).maybeSingle());
    return shot(source.id,row?.data??null);
  }
  async function getDocs(source){
    const all=await list(source);
    const rows=all.filter(({data})=>(source.filters||[]).every(({field,operator,value})=>{
      if(operator!=='==')throw Error('Filtre non pris en charge');
      return data?.[field]===value;
    }));
    return {docs:rows.map(({id,data})=>shot(id,data))};
  }
  async function setDoc(source,data,options={}){
    if(source.collection==='users'){
      const patch={
        email:data.email,role:data.role,department:data.department,
        active:data.active,name:data.name,poste:data.poste
      };
      Object.keys(patch).forEach(k=>patch[k]===undefined&&delete patch[k]);
      if(!Object.keys(patch).length)return; // lastLoginAt is not authorization state
      const result=await client.from('ls_members').update(patch).eq('user_id',source.id).select('user_id');
      errorIf(result);
      if(!result.data?.length)throw Error('Mise à jour du compte refusée');
      return;
    }
    let payload=structuredClone(data);
    if(options.merge){
      const existing=await getDoc(source);
      payload={...(existing.data()||{}),...payload};
    }
    errorIf(await client.from('ls_documents').upsert({
      collection_name:source.collection,document_id:source.id,data:payload,
      updated_at:new Date().toISOString()
    },{onConflict:'collection_name,document_id'}));
    requestRefresh(source.collection);
  }
  function onSnapshot(source,callback,onError){
    const sub={source,callback,onError,alive:true};
    subscriptions.add(sub);
    attachRealtime(source.collection);
    refresh(sub);
    if(!refreshLoop)refreshLoop=setInterval(()=>{
      for(const current of subscriptions)refresh(current);
    },15000);
    return ()=>{
      sub.alive=false;subscriptions.delete(sub);detachRealtime(source.collection);
      if(!subscriptions.size&&refreshLoop){clearInterval(refreshLoop);refreshLoop=null;}
    };
  }
  async function refresh(sub){
    if(!sub.alive||sub.pending)return;sub.pending=true;
    try{
      const result=sub.source.kind==='doc'
        ?await getDoc(sub.source):await getDocs(sub.source);
      if(!sub.alive)return;
      const serialized=JSON.stringify(sub.source.kind==='doc'
        ?result.data():result.docs.map(d=>({id:d.id,data:d.data()})));
      if(serialized!==sub.last){sub.last=serialized;sub.callback(result);}
    }catch(e){if(sub.alive)sub.onError?.(e);}
    finally{sub.pending=false;}
  }
  function requestRefresh(collectionName){
    for(const sub of subscriptions)
      if(sub.source.collection===collectionName)queueMicrotask(()=>refresh(sub));
  }
  async function runTransaction(db,callback){
    const snapshots=new Map(),staged=new Map();
    const key=(r)=>r.collection+'/'+r.id;
    const tx={
      async get(r){const k=key(r);if(!snapshots.has(k))snapshots.set(k,await getDoc(r));
        return snapshots.get(k);},
      set(r,data,options={}){
        const k=key(r);let payload=structuredClone(data);
        if(options.merge)payload={...(snapshots.get(k)?.data()||{}),...payload};
        staged.set(k,{r,data:payload});
      }
    };
    const result=await callback(tx);
    if(!staged.size)return result;
    const steps=[];
    for(const [k,{r,data}] of staged){
      if(!snapshots.has(k))snapshots.set(k,await getDoc(r));
      steps.push({collection:r.collection,id:r.id,
        expected:snapshots.get(k).data()??null,data});
    }
    errorIf(await client.rpc('ls_apply_transaction',{p_steps:steps}));
    for(const s of steps)requestRefresh(s.collection);
    return result;
  }
  async function inviteEmployee(employee){
    const result=await client.functions.invoke('invite-employee',{body:{employee,sitePath:typeof location!=='undefined' ? location.pathname : '/levis-subaru-test/'}});
    if(result.error){
      try{
        const detail=await result.error.context?.json?.();
        if(typeof detail?.error==='string'&&detail.error)throw new Error(detail.error);
      }catch(e){if(e instanceof Error&&e!==result.error&&e.message!=='Unexpected end of JSON input')throw e;}
      throw result.error;
    }
    return result.data;
  }
  return {collection,doc,where,query,getDoc,getDocs,setDoc,onSnapshot,runTransaction,inviteEmployee,
    client,
    async signInWithEmailAndPassword(auth,email,password){
      const result=await client.auth.signInWithPassword({email,password});errorIf(result);
      return {user:result.data.user};
    },
    async sendPasswordResetEmail(auth,email){
      errorIf(await client.auth.resetPasswordForEmail(email,{
        redirectTo:new URL('./',location.href).href
      }));
    },
    async signOut(){errorIf(await client.auth.signOut());},
    onAuthStateChanged(auth,callback){
      const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
        if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event)){
          const u=session?.user;
          queueMicrotask(()=>callback(u?{uid:u.id,email:u.email}:null));
        }
      });
      return ()=>subscription.unsubscribe();
    }
  };
}