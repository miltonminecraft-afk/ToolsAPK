const VERSION='3.5.1';
const MODEL={repo:'ggml-org/Qwen3-1.7B-GGUF',file:'Qwen3-1.7B-Q4_K_M.gguf',name:'Qwen3-1.7B Q4_K_M'};
const FLAG='toolsAssistantModelInstalledV1';
let modulePromise=null;

async function loadWllamaModule(){
  if(!modulePromise){
    modulePromise=Promise.all([
      import(`https://cdn.jsdelivr.net/npm/@wllama/wllama@${VERSION}/esm/index.js`),
      import(`https://cdn.jsdelivr.net/npm/@wllama/wllama@${VERSION}/esm/wasm-from-cdn.js`)
    ]).then(([core,wasm])=>({core,wasm:wasm.default}));
  }
  return modulePromise;
}

export class WebWllamaRuntime {
  constructor(){ this.wllama=null; this.manager=null; this.loading=null; }
  async _create(){
    if(this.wllama) return;
    const {core,wasm}=await loadWllamaModule();
    this.manager=new core.ModelManager();
    this.wllama=new core.Wllama(wasm,{allowOffline:true,parallelDownloads:3,logger:core.LoggerWithoutDebug});
  }
  async info(){
    await this._create();
    return {type:'web',label:`Browser lokaal · llama.cpp/WASM${this.wllama.isSupportWebGPU()?' + WebGPU':''}`,model:MODEL.name,webgpu:this.wllama.isSupportWebGPU()};
  }
  async isModelInstalled(){ return localStorage.getItem(FLAG)==='1'; }
  async _load(onProgress){
    await this._create();
    if(this.wllama.isModelLoaded()) return;
    if(this.loading) return this.loading;
    this.loading=this.wllama.loadModelFromHF({repo:MODEL.repo,file:MODEL.file},{
      useCache:true,n_ctx:4096,n_batch:256,n_gpu_layers:this.wllama.isSupportWebGPU()?99:0,
      progressCallback:onProgress?({loaded,total})=>onProgress(total?Math.round(loaded/total*100):0):undefined
    }).finally(()=>{this.loading=null});
    return this.loading;
  }
  async installModel(onProgress){ await this._load(onProgress); localStorage.setItem(FLAG,'1'); return {ok:true}; }
  async removeModel(){
    await this._create();
    try{ if(this.wllama.isModelLoaded()) await this.wllama.exit(); }catch(e){}
    await this.manager.clear(); localStorage.removeItem(FLAG); this.wllama=null; this.manager=null; return {ok:true};
  }
  async clearCache(){ return {ok:true}; }
  async generate(messages,options={}){
    try{ await this._load(); }
    catch(e){ localStorage.removeItem(FLAG); throw new Error('AI-model ontbreekt of kon niet uit de browsercache worden geladen. Installeer het model opnieuw.'); }
    const response=await this.wllama.createChatCompletion({
      messages,max_tokens:options.maxTokens||420,temperature:options.temperature??0.35,top_k:40,top_p:0.92,reasoning:false
    });
    return response?.choices?.[0]?.message?.content||'';
  }
}
