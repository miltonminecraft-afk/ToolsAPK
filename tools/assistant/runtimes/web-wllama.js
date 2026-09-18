import { Wllama, LoggerWithoutDebug } from '../vendor/wllama/index.js';

const MODEL={
  repo:'ggml-org/Qwen3-1.7B-GGUF',
  file:'Qwen3-1.7B-Q4_K_M.gguf',
  name:'Qwen3-1.7B Q4_K_M'
};
const CONFIG_PATHS={default:new URL('../vendor/wllama/wasm/wllama.wasm',import.meta.url).href};
const COMPAT={
  wasm:new URL('../vendor/wllama-compat/wasm/wllama.wasm',import.meta.url).href,
  worker:new URL('../vendor/wllama-compat/wasm/wllama.js',import.meta.url).href
};
let moduleInstance=null;

export class WebWllamaRuntime{
  constructor(){this.wllama=null;this.loading=null}
  async _create(){
    if(this.wllama)return;
    this.wllama=new Wllama(CONFIG_PATHS,{allowOffline:true,parallelDownloads:3,logger:LoggerWithoutDebug});
    try{this.wllama.setCompat(COMPAT)}catch(e){}
  }
  async info(){
    await this._create();
    return {type:'web',label:'Browser lokaal · llama.cpp/WASM',model:MODEL.name};
  }
  async isModelInstalled(){
    await this._create();
    try{
      const files=await this.wllama.cacheManager.list();
      return files.some(f=>String(f?.metadata?.originalURL||'').includes(MODEL.file));
    }catch(e){return localStorage.getItem('toolsAssistantModelInstalledV3')==='1'}
  }
  async _load(onProgress){
    await this._create();
    if(this.wllama.isModelLoaded())return;
    if(this.loading)return this.loading;
    this.loading=this.wllama.loadModelFromHF(
      {repo:MODEL.repo,file:MODEL.file},
      {n_ctx:4096,n_batch:256,useCache:true,progressCallback:onProgress?({loaded,total})=>onProgress(total?Math.round(loaded/total*100):0):undefined}
    ).then(()=>localStorage.setItem('toolsAssistantModelInstalledV3','1')).finally(()=>{this.loading=null});
    return this.loading;
  }
  async installModel(onProgress){await this._load(onProgress);return{ok:true}}
  async removeModel(){
    await this._create();
    try{if(this.wllama.isModelLoaded())await this.wllama.exit()}catch(e){}
    await this.wllama.cacheManager.clear();
    localStorage.removeItem('toolsAssistantModelInstalledV3');
    this.wllama=null;
    return{ok:true};
  }
  async clearCache(){return{ok:true}}
  async generate(messages,options={}){
    await this._load();
    const response=await this.wllama.createChatCompletion({
      messages,
      max_tokens:options.maxTokens||500,
      temperature:options.temperature??0.35,
      top_k:40,
      top_p:0.92,
      reasoning:false
    });
    return response?.choices?.[0]?.message?.content||'';
  }
}
