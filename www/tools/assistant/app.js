import { splitChoices } from './choices.js';
import { TOOL_GUIDE, guidedAnswer } from './knowledge.js';
import { researchKpn, researchPrompt } from './research.js';
import { createRuntime } from './runtime.js';
import { TOOL_REGISTRY, toolContext } from './tool-registry.js';

const qs=new URLSearchParams(location.search); const embedded=qs.get('embedded')==='1'; const currentTool=qs.get('tool')||'';
if(embedded) document.body.classList.add('embedded');
const $=id=>document.getElementById(id); const chat=$('chat'), input=$('input');
const HISTORY_KEY='toolsAssistantHistoryV1'; const CONTEXT_KEY='toolsAssistantContextV1';
const runtime=createRuntime(); let history=[]; let busy=false;
function status(text){$('modelLabel').textContent=text;}
function lock(value){busy=value;for(const id of ['sendButton','installButton','cacheButton','removeModelButton','assistantMode'])$(id).disabled=value;}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function save(){ localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-24))); }
function load(){ try{history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); if(!Array.isArray(history))history=[]}catch(e){history=[]} }
function render(){ chat.innerHTML=''; for(const m of history){ addBubble(m.role,m.content,false,m.sources||[]); } chat.scrollTop=chat.scrollHeight; }
function addBubble(role,text,store=true,sources=[]){
  const d=document.createElement('div'); d.className='msg '+role;
  const parsed=splitChoices(text);const markers=[]; let clean=parsed.text.replace(/\[OPEN_TOOL:([a-z0-9-]+)\]/g,(_,k)=>{markers.push(k);return''}).replace(/\[OPEN_FULL_ASSISTANT\]/g,()=>{markers.push('__full__');return''}).trim();
  d.textContent=clean; chat.appendChild(d); if(role==='assistant'&&parsed.choices.length){const options=document.createElement('div');options.className='quick';for(const label of parsed.choices){const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent=label;button.onclick=()=>{if(busy)return;input.value=label;send();};options.appendChild(button);}chat.appendChild(options);}
  markers.forEach(k=>{ const b=document.createElement('button'); b.className='btn secondary tool-link'; if(k==='__full__'){b.textContent='Open volledige Assistent';b.onclick=openFull;} else if(TOOL_REGISTRY[k]){b.textContent='Open '+TOOL_REGISTRY[k].name;b.onclick=()=>openTool(k);} chat.appendChild(b); });
  if(sources.length){const list=document.createElement('div');list.className='muted';list.textContent='Geraadpleegde bronnen:';for(const [i,source] of sources.entries()){const a=document.createElement('a');a.textContent=' ['+(i+1)+'] '+source.title; a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='block';list.appendChild(a);}chat.appendChild(list);}
  if(store){history.push({role,content:text,policy:2,...(sources.length?{sources}: {})});save()} chat.scrollTop=chat.scrollHeight;
}
function systemPrompt(question=""){
  const scope=currentTool?toolContext(currentTool):'Technische assistent met KPN als primaire bron.';const guide=/hio|argus|lcl|kopermeting|fiber route|checklist|pop/i.test(question)?TOOL_GUIDE:'';
  const toolList=guide?Object.entries(TOOL_REGISTRY).map(([k,t])=>`${k}: ${t.name} - ${t.description}`).join('\n'):'';
  return `Je bent een technische assistent voor de Tools-app. Antwoord in het Nederlands, direct en concreet. Gebruik maximaal 120 woorden tenzij de gebruiker uitdrukkelijk meer detail vraagt. Geen emoji’s, smalltalk, complimenten, onnodige excuses of herhaling. Corrigeer de gebruiker zakelijk als een aanname onjuist is. Geef de gebruiker niet automatisch gelijk. Maak onderscheid tussen een feit, aanname en onzekerheid. Zeg Onzeker als je iets niet kunt onderbouwen; verzin geen functies, meetnormen, waarden, bronverwijzingen of actuele feiten. Gebruik bij een vraag over de app uitsluitend de gecontroleerde handleiding hieronder. Ontbreekt daarin informatie, meld dat kort. Geef direct een bruikbaar antwoord met concrete stappen. Begin nooit met een intakevraag. Neem bij een korte vraag de meest waarschijnlijke betekenis en geef de uitleg. Stel hoogstens een gerichte vervolgvraag nadat je al antwoord hebt gegeven, alleen als een essentieel gegeven ontbreekt. Verwijs niet terug met dezelfde vraag. Als de gebruiker alles zegt, geef het overzicht. Verzin geen actuele internetinformatie. ${scope}\n${guide}\nBeschikbare tools:\n${toolList}\nWanneer een bestaande tool echt nodig is, voeg exact [OPEN_TOOL:sleutel] toe. ${embedded?'Blijf primair bij de huidige tool. Is de vraag daarbuiten maar wel KPN-gerelateerd, antwoord kort en voeg [OPEN_FULL_ASSISTANT] toe.':''} Als een keuze essentieel is, geef eerst het bekende antwoord en stel hoogstens een korte vraag. Voeg dan exact [KEUZES:keuze 1|keuze 2] toe met twee tot vier korte concrete opties. Geen opties als je geen vraag stelt. Gebruik geen interne redeneerstappen of chain-of-thought in je antwoord.`;
}
async function refreshStatus(){
  try{const info=await runtime.info(); $('runtimeLabel').textContent=$('assistantMode').value==='online'?'Online · Qwen3-30B-A3B':info.label; $('modelLabel').textContent=info.model; const installed=await runtime.isModelInstalled(); $('installButton').textContent=installed?'Offline model laden':'Offline model installeren (1,28 GB)'; status($('assistantMode').value==='online'?'Internetonderzoek met KPN-bronnen.':installed?'Offline Qwen is geïnstalleerd.':'Installeer het model eenmalig voor offline antwoorden: 1,28 GB.');}
  catch(e){$('runtimeLabel').textContent='AI-runtime niet beschikbaar';$('modelLabel').textContent=e.message||String(e)}
}
async function install(){
  if(busy)return;lock(true);$('progress').style.display='block';$('progressBar').style.width='0%';status('Model downloaden of uit de cache laden...');
  try{await runtime.installModel(p=>{const n=Math.max(0,Math.min(100,p));$('progressBar').style.width=n+'%';status(n>=100?'Model in geheugen laden...':'Model downloaden: '+n+'%');});await refreshStatus();status('Model gereed. Stel je vraag.');}
  catch(e){status('Model laden mislukt: '+(e.message||String(e)));}
  finally{lock(false);$('progress').style.display='none';}
}
async function send(){
  if(busy)return;const text=input.value.trim();if(!text)return;lock(true);let wait;let sources=[];let remoteAnswer="";
  try{
    const online=$('assistantMode').value==='online';const guide=guidedAnswer(text,history,currentTool);const lastAssistant=history.filter(m=>m.role==='assistant').at(-1);const isChoice=lastAssistant&&splitChoices(lastAssistant.content).choices.includes(text);const previousUser=history.filter(m=>m.role==='user').at(-1);const researchQuestion=isChoice?((previousUser?.researchQuestion||previousUser?.content||'')+' Keuze: '+text).slice(-400):text;
    input.value='';addBubble('user',text);history.at(-1).researchQuestion=researchQuestion;save();wait=document.createElement('div');wait.className='msg assistant';wait.textContent=online?'Ik zoek dit uit.':'Ik controleer dit lokaal.';chat.appendChild(wait);status(wait.textContent);chat.scrollTop=chat.scrollHeight;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(guide){wait.remove();wait=null;addBubble('assistant',guide);status('Uitleg uit de gecontroleerde Tools-handleiding.');return;}
    const installed=await runtime.isModelInstalled().catch(()=>false);
    if(!online&&!installed){wait.remove();wait=null;input.value=text;addBubble('assistant','Installeer het lokale Qwen-model om deze vraag offline te beantwoorden.');status('Model nog niet geïnstalleerd.');return;}
    if(online){const found=await researchKpn(researchQuestion);sources=found.sources;remoteAnswer=found.answer;if(found.model)$("runtimeLabel").textContent="Online · "+found.model;if(!sources.length){wait.remove();wait=null;addBubble('assistant','Onzeker: geen passende openbare bron gevonden. Ik kan dit niet onderbouwen. Gebruik Zoek actuele KPN-info voor een bredere zoekopdracht.');status('Geen passende bron gevonden.');return;}}
    let answer;
    if(remoteAnswer){answer=remoteAnswer;}else if(!installed){answer='Bronnen opgehaald. Installeer Qwen voor analyse en een onderbouwd antwoord.\n'+sources.map((s,i)=>'['+(i+1)+'] '+s.title).join('\n');}
    else {
      status('Bronnen beoordelen en antwoord maken...');
      const msgs=[{role:'system',content:systemPrompt(researchQuestion)+(online?'\n'+researchPrompt(sources):'\nOffline stand: geen internetonderzoek. Geef alleen algemene technische uitleg die je kunt onderbouwen. Apparatuurspecifieke aansluitingen, modellen en KPN-meetgrenzen zijn zonder geverifieerde bron onzeker. Benoem dat expliciet; leid geen apparaatfuncties af uit namen van app-tools.')},...(online?[{role:'user',content:researchQuestion}]:history.filter(m=>m.role==='user'||m.policy===2).slice(-3).map(m=>({role:m.role,content:m.content.slice(0,900)})))];
      answer=await runtime.generate(msgs,{maxTokens:260,temperature:.15,onToken:partial=>{if(wait){wait.textContent=splitChoices(partial).text;chat.scrollTop=chat.scrollHeight;}}});
    }
    wait.remove();wait=null;addBubble('assistant',answer||'Geen antwoord ontvangen. Probeer opnieuw.',true,sources);status(online?'Online onderzoek gereed.':'Offline antwoord gereed.');
  }catch(e){if(wait)wait.remove();const message=e.message||String(e);status(message);addBubble('assistant',message,true,sources);}
  finally{lock(false);}
}
function info(){
  const t=TOOL_REGISTRY[currentTool];
  if(t) addBubble('assistant',`${t.name}\n${t.description}\n\nSnelle functies: ${t.actions.join(' · ')}`);
  else addBubble('assistant','Ik kan uitleg geven over Kopermetingen, Afstandsbediening codes, Value Fiber Route en Checklist PoP. Kies een snelle actie of stel je vraag.');
}
function openTool(key){ window.top.location.href=new URL(TOOL_REGISTRY[key].path,location.href).href; }
function openFull(){ localStorage.setItem(CONTEXT_KEY,JSON.stringify({tool:currentTool,history:history.slice(-8)})); window.top.location.href=new URL('./index.html',location.href).href; }
function currentQuery(){return input.value.trim() || history.filter(x=>x.role==='user').slice(-1)[0]?.content || ''}
function webSearch(){
  const q=currentQuery(); if(!q){alert('Typ eerst waar je actuele informatie over zoekt.');return}
  const official='https://www.google.com/search?q='+encodeURIComponent(q+' (site:kpn.com OR site:community.kpn.com)');
  window.open(official,'_blank','noopener');
  addBubble('assistant','Een zoekopdracht met voorrang voor KPN.nl en KPN Community is geopend. In de online stand kan ik openbare KPN-servicepagina’s ophalen; andere zoekresultaten kun je hier als tekst plakken.');
}
function quick(){
  const box=$('quickActions');box.innerHTML=''; const list=currentTool&&TOOL_REGISTRY[currentTool]?[currentTool]:Object.keys(TOOL_REGISTRY);
  for(const key of list){const t=TOOL_REGISTRY[key];const b=document.createElement('button');b.className='btn secondary';b.textContent=t.name;b.onclick=()=>{if(currentTool===key)info();else openTool(key)};box.appendChild(b)}
}
function theme(){document.body.classList.toggle('dark',(localStorage.getItem('toolsTheme')||'dark')==='dark')}

$('sendButton').onclick=send; input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});$('installButton').onclick=install;$('infoButton').onclick=info;$('webButton').onclick=webSearch;
$('cacheButton').onclick=async()=>{if(busy)return;history=[];save();localStorage.removeItem(CONTEXT_KEY);await runtime.clearCache();render();addBubble('assistant','Chat- en tijdelijke Assistentgegevens zijn gewist. Het AI-model is behouden.');};
$('removeModelButton').onclick=async()=>{if(busy)return;if(!confirm('AI-model verwijderen? Chatgeschiedenis blijft staan.'))return;try{await runtime.removeModel();await refreshStatus()}catch(e){alert(e.message||e)}};
$('backButton').onclick=()=>location.href='../../index.html'; $('fullButton').onclick=openFull; if(embedded)$('fullButton').style.display='inline-block';
window.addEventListener('storage',theme); theme(); load();
if(!embedded&&!history.length){try{const c=JSON.parse(localStorage.getItem(CONTEXT_KEY)||'null');if(c?.history?.length)history=c.history}catch(e){}}
render();quick();refreshStatus(); if(!history.length) addBubble('assistant',currentTool?`Je gebruikt de kleine Assistent voor ${TOOL_REGISTRY[currentTool]?.name||'deze tool'}.`:'Waar kan ik je mee helpen?');

const mode=$('assistantMode');const savedMode=localStorage.getItem('toolsAssistantModeV1');mode.value=savedMode==='online'||(!savedMode&&navigator.onLine&&!window.Capacitor?.isNativePlatform?.())?'online':'offline';
function connection(){ $('connectionLabel').textContent=navigator.onLine?'Internet beschikbaar':'Geen internet'; }
mode.onchange=()=>{refreshStatus();localStorage.setItem('toolsAssistantModeV1',mode.value);status(mode.value==='online'?'Online: openbare KPN-bronnen krijgen voorrang.':'Offline: je vraag blijft op dit apparaat.');};window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
