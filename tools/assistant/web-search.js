const pending=new Map();

window.__toolsWebSearchCallback=window.__toolsWebSearchCallback||((id,payload)=>{
  const p=pending.get(id);if(!p)return;
  pending.delete(id);
  try{const data=JSON.parse(payload);data.ok?p.resolve(data):p.reject(new Error(data.error||'Webzoekfout'))}
  catch(e){p.reject(e)}
});

const requestId=()=> 'web_'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const isKpnQuestion=q=>/\b(kpn|experia|box\s*12|superwifi|kpn\s*tv|tv\+|glasvezel|koper|isra|hvd|kvd|sip|argus)\b/i.test(q);

function nativeSearch(query){
  return new Promise((resolve,reject)=>{
    const id=requestId();
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Webzoekopdracht timeout'))},15000);
    pending.set(id,{
      resolve:v=>{clearTimeout(timer);resolve(v)},
      reject:e=>{clearTimeout(timer);reject(e)}
    });
    try{window.ToolsWebSearch.search(query,id)}
    catch(e){clearTimeout(timer);pending.delete(id);reject(e)}
  });
}

async function browserSearch(query){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch('https://s.jina.ai/'+encodeURIComponent(query),{
      method:'GET',
      headers:{Accept:'text/plain'},
      signal:controller.signal
    });
    if(!response.ok)throw new Error('Web zoeken HTTP '+response.status);
    const text=(await response.text()).slice(0,16000);
    const sources=[...text.matchAll(/https?:\/\/[^\s)\]<>"]+/g)].map(m=>m[0].replace(/[.,;]+$/,'')).slice(0,10);
    return {ok:true,context:text,sources};
  }finally{clearTimeout(timer)}
}

async function oneSearch(query){
  if(window.ToolsWebSearch&&typeof window.ToolsWebSearch.search==='function')return nativeSearch(query);
  return browserSearch(query);
}

export async function searchWeb(question){
  const q=String(question||'').trim();
  if(!q)return{ok:false,context:'',sources:[]};
  const queries=isKpnQuestion(q)
    ? ['site:kpn.com '+q,'site:community.kpn.com '+q,q]
    : [q];
  const contexts=[],sources=[];
  for(const query of queries){
    try{
      const r=await oneSearch(query);
      if(r?.context)contexts.push('ZOEKOPDRACHT: '+query+'\n'+r.context);
      if(Array.isArray(r?.sources))sources.push(...r.sources);
    }catch(e){}
  }
  return {
    ok:contexts.length>0,
    context:contexts.join('\n\n').slice(0,24000),
    sources:[...new Set(sources)].slice(0,12)
  };
}
