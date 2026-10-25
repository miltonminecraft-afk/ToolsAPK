const MODEL={repo:'ggml-org/Qwen3-1.7B-GGUF',file:'Qwen3-1.7B-Q4_K_M.gguf',name:'Qwen3-1.7B Q4_K_M'};
let modulePromise;
async function coreModule(){if(!modulePromise)modulePromise=import('../../../vendor/wllama.js').catch(e=>{modulePromise=null;throw e});return modulePromise;}
export class WebWllamaRuntime {
  constructor(){this.wllama=null;this.manager=null;this.creating=null;this.loading=null;this.gpu=false;}
  async _create(){
    if(this.wllama)return;if(this.creating)return this.creating;
    this.creating=(async()=>{const core=await coreModule();this.manager=new core.ModelManager({allowOffline:true});this._instance(core);})().finally(()=>this.creating=null);return this.creating;
  }
  _instance(core){this.wllama=new core.Wllama({default:new URL('../../../vendor/wllama.wasm',import.meta.url).href},{allowOffline:true,parallelDownloads:3,logger:core.LoggerWithoutDebug,modelManager:this.manager});this.wllama.setCompat({worker:new URL('../../../vendor/wllama-compat/wllama.js',import.meta.url).href,wasm:new URL('../../../vendor/wllama-compat/wllama.wasm',import.meta.url).href});}
  modelUrl(){return `https://huggingface.co/${MODEL.repo}/resolve/main/${MODEL.file}`;}
  async info(){await this._create();return {type:'web',label:'Lokaal · Qwen3 via '+(this.gpu?'WebGPU':'WASM'),model:MODEL.name};}
  async _cached(){await this._create();return (await this.manager.getModels()).find(m=>m.url===this.modelUrl()&&m.validate()==='valid');}
  async isModelInstalled(){return !!(await this._cached());}
  async _load(onProgress,download=false){
    await this._create();if(this.wllama.isModelLoaded())return;if(this.loading)return this.loading;
    this.loading=(async()=>{
      let model=await this._cached();
      if(!model){if(!download)throw Error('Geen lokaal model opgeslagen. Installeer het model eenmalig terwijl je online bent.');if(!navigator.onLine)throw Error('Voor de eerste modelinstallatie is internet nodig.');model=await this.manager.downloadModel({url:this.modelUrl()},{progressCallback:({loaded,total})=>onProgress?.(total?Math.round(loaded/total*100):0)});}
      onProgress?.(100);
      try{this.gpu=!!(navigator.gpu&&await navigator.gpu.requestAdapter());}catch{this.gpu=false;}
      const options={n_ctx:4096,n_batch:64,n_gpu_layers:this.gpu?99:0};
      try{await this.wllama.loadModel(await model.open(),options);}
      catch(first){
        try{await this.wllama.exit();}catch{}
        this._instance(await coreModule());
        if(!this.gpu)throw first;
        this.gpu=false;
        try{await this.wllama.loadModel(await model.open(),{...options,n_gpu_layers:0});}
        catch(error){try{await this.wllama.exit();}catch{}this._instance(await coreModule());throw Error('Model kan niet worden geladen op dit apparaat: '+(error.message||error));}
      }
    })().finally(()=>this.loading=null);return this.loading;
  }
  async installModel(progress){await this._load(progress,true);return {ok:true};}
  async removeModel(){await this._create();if(this.loading)throw Error('Wacht tot het model klaar is met laden.');try{await this.wllama.exit();}finally{await this.manager.clear();this.wllama=null;this.manager=null;}return {ok:true};}
  async clearCache(){return {ok:true};}
  async generate(messages,options={}){
    await this._load();let text='';const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),180000);
    try{await this.wllama.createChatCompletion({messages,max_tokens:options.maxTokens||240,temperature:options.temperature??.2,top_k:40,top_p:.92,chat_template_kwargs:{enable_thinking:false},stream:true,abortSignal:controller.signal,onData:chunk=>{const part=chunk?.choices?.[0]?.delta?.content;if(part){text+=part;options.onToken?.(text);}}});return text;}
    catch(error){if(controller.signal.aborted)throw Error('Het lokale model reageert te langzaam op dit apparaat. Probeer een kortere vraag.');throw error;}
    finally{clearTimeout(timeout);}
  }
}
