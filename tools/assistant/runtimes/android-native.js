const MODEL = {
  name: 'Qwen3-1.7B Q4_K_M',
  url: 'https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf',
  sha256: 'd2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5'
};

export class AndroidNativeRuntime {
  constructor(bridge){
    this.bridge=bridge; this.pending=new Map(); this.progress=new Map();
    window.__toolsNativeLlamaCallback=(id,payload)=>{
      const p=this.pending.get(id); if(!p) return;
      this.pending.delete(id);
      try { const data=JSON.parse(payload); data.ok ? p.resolve(data) : p.reject(new Error(data.error||'Android AI-fout')); }
      catch(e){ p.reject(e); }
    };
    window.__toolsNativeLlamaProgress=(id,value)=>{ const cb=this.progress.get(id); if(cb) cb(Number(value)||0); };
  }
  id(){ return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2); }
  call(method,args=[],onProgress){
    return new Promise((resolve,reject)=>{
      const id=this.id(); this.pending.set(id,{resolve,reject}); if(onProgress) this.progress.set(id,onProgress);
      try{ this.bridge[method](...args,id); }catch(e){ this.pending.delete(id); this.progress.delete(id); reject(e); }
    }).finally(()=>{});
  }
  async info(){
    let native={}; try{native=JSON.parse(this.bridge.getRuntimeInfo()||'{}')}catch(e){}
    return {type:'android',label:'Android lokaal · llama.cpp',model:MODEL.name,native};
  }
  async isModelInstalled(){ return !!this.bridge.isModelInstalled(); }
  async installModel(onProgress){ return this.call('downloadModel',[MODEL.url,MODEL.sha256],onProgress); }
  async removeModel(){ return this.call('removeModel',[]); }
  async clearCache(){ return this.call('clearAssistantCache',[]); }
  async generate(messages,options={}){
    const req=JSON.stringify({messages,max_tokens:options.maxTokens||420,temperature:options.temperature??0.35});
    const out=await this.call('generate',[req]); return out.text||'';
  }
}
