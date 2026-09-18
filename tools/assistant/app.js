import { createRuntime } from './runtime.js';
import { TOOL_REGISTRY, toolContext } from './tool-registry.js';
import { searchWeb } from './web-search.js';

const qs=new URLSearchParams(location.search);
const embedded=qs.get('embedded')==='1';
const currentTool=qs.get('tool')||'';
if(embedded)document.body.classList.add('embedded');

const $=id=>document.getElementById(id);
const chat=$('chat'),input=$('input');
const HISTORY_KEY='toolsAssistantHistoryV3';
const CONTEXT_KEY='toolsAssistantContextV3';
const runtime=createRuntime();
let history=[],busy=false;

function save(){localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-24)))}
function load(){try{history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');if(!Array.isArray(history))history=[]}catch(e){history=[]}}
function render(){chat.innerHTML='';for(const m of history)addBubble(m.role,m.content,false);chat.scrollTop=chat.scrollHeight}
function addBubble(role,text,store=true){
  const d=document.createElement('div');d.className='msg '+role;
  const markers=[];
  const clean=String(text||'')
    .replace(/\[OPEN_TOOL:([a-z0-9-]+)\]/g,(_,k)=>{markers.push(k);return''})
    .replace(/\[OPEN_FULL_ASSISTANT\]/g,()=>{markers.push('__full__');return''})
    .trim();
  d.textContent=clean;chat.appendChild(d);
  markers.forEach(k=>{
    const b=document.createElement('button');b.className='btn secondary tool-link';
    if(k==='__full__'){b.textContent='Open volledige Assistent';b.onclick=openFull}
    else if(TOOL_REGISTRY[k]){b.textContent='Open '+TOOL_REGISTRY[k].name;b.onclick=()=>location.href=TOOL_REGISTRY[k].path}
    chat.appendChild(b);
  });
  if(store){history.push({role,content:text});save()}
  chat.scrollTop=chat.scrollHeight;
}
function systemPrompt(web){
  const scope=currentTool?toolContext(currentTool):'Volledige Tools Assistent.';
  const toolList=Object.entries(TOOL_REGISTRY).map(([k,t])=>`${k}: ${t.name} - ${t.description}`).join('\n');
  let prompt=`Je bent Assistent, een praktische Nederlandstalige technische assistent voor de Tools-app. Je taalmodel draait lokaal op het apparaat. Geef korte concrete antwoorden en verzin geen actuele feiten. ${scope}\nBeschikbare tools:\n${toolList}\nWanneer een bestaande tool nodig is, voeg exact [OPEN_TOOL:sleutel] toe. Gebruik geen interne redeneerstappen.`;
  if(web?.context){
    prompt+='\n\nACTUELE WEBINFORMATIE:\n'+web.context;
    prompt+='\n\nGebruik bovenstaande webinformatie alleen waar relevant. Geef bij actuele feiten de bron-URL als die in de broninformatie staat. Verzin geen bron.';
  }
  return prompt;
}
async function refreshStatus(){
  try{
    const info=await runtime.info();
    $('runtimeLabel').textContent=info.label;
    $('modelLabel').textContent=info.model;
    $('installButton').textContent=(await runtime.isModelInstalled())?'Model lokaal geïnstalleerd':'Model installeren';
  }catch(e){
    $('runtimeLabel').textContent='AI-runtime niet beschikbaar';
    $('modelLabel').textContent=e.message||String(e);
  }
}
async function install(){
  $('progress').style.display='block';$('progressBar').style.width='0%';$('installButton').disabled=true;
  try{
    await runtime.installModel(p=>{$('progressBar').style.width=Math.max(0,Math.min(100,p))+'%'});
    $('progressBar').style.width='100%';
    await refreshStatus();
  }catch(e){alert(e.message||e)}
  finally{$('installButton').disabled=false;setTimeout(()=>{$('progress').style.display='none'},900)}
}
async function getWeb(query,showResult=false){
  try{
    const result=await searchWeb(query);
    if(showResult){
      addBubble('assistant',result.ok
        ? 'Webbronnen gevonden:\n'+(result.sources.slice(0,6).join('\n')||'Broninformatie geladen.')
        : 'Geen webbronnen beschikbaar. De lokale Assistent blijft gewoon werken.');
    }
    return result;
  }catch(e){
    if(showResult)addBubble('assistant','Webzoeken is nu niet beschikbaar. De lokale Assistent blijft gewoon werken.');
    return null;
  }
}
async function send(){
  if(busy)return;
  const text=input.value.trim();if(!text)return;
  if(!(await runtime.isModelInstalled())){alert('Installeer eerst het lokale AI-model.');return}
  input.value='';addBubble('user',text);busy=true;$('sendButton').disabled=true;
  const wait=document.createElement('div');wait.className='msg assistant';wait.textContent=(navigator.onLine||window.ToolsWebSearch)?'Web controleren…':'Lokaal nadenken…';chat.appendChild(wait);
  try{
    const web=(navigator.onLine||window.ToolsWebSearch)?await getWeb(text,false):null;
    wait.textContent='…';
    const msgs=[{role:'system',content:systemPrompt(web)},...history.slice(-16).map(m=>({role:m.role,content:m.content}))];
    const answer=await runtime.generate(msgs,{maxTokens:500,temperature:.35});
    wait.remove();addBubble('assistant',answer||'Geen antwoord ontvangen.');
  }catch(e){
    wait.remove();addBubble('assistant','AI-fout: '+(e.message||e));
  }finally{busy=false;$('sendButton').disabled=false}
}
function info(){
  const t=TOOL_REGISTRY[currentTool];
  if(t)addBubble('assistant',`${t.name}\n${t.description}\n\nSnelle functies: ${t.actions.join(' · ')}`);
  else addBubble('assistant','Ik kan lokaal helpen met de Tools-app en, wanneer internet beschikbaar is, actuele informatie op het web opzoeken.');
}
function openFull(){
  localStorage.setItem(CONTEXT_KEY,JSON.stringify({tool:currentTool,history:history.slice(-8)}));
  window.top.location.href='../assistant/index.html';
}
function currentQuery(){return input.value.trim()||history.filter(x=>x.role==='user').slice(-1)[0]?.content||''}
function quick(){
  const box=$('quickActions');box.innerHTML='';
  const list=currentTool&&TOOL_REGISTRY[currentTool]?[currentTool]:Object.keys(TOOL_REGISTRY);
  for(const key of list){
    const t=TOOL_REGISTRY[key],b=document.createElement('button');
    b.className='btn secondary';b.textContent=t.name;
    b.onclick=()=>{if(currentTool===key)info();else location.href=t.path};
    box.appendChild(b);
  }
}
function theme(){document.body.classList.toggle('dark',(localStorage.getItem('toolsTheme')||'dark')==='dark')}

$('sendButton').onclick=send;
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
$('installButton').onclick=install;
$('infoButton').onclick=info;
$('webButton').onclick=async()=>{
  const q=currentQuery();
  if(!q){alert('Typ eerst wat je op het web wilt zoeken.');return}
  await getWeb(q,true);
};
$('cacheButton').onclick=async()=>{
  history=[];save();localStorage.removeItem(CONTEXT_KEY);
  await runtime.clearCache();render();
  addBubble('assistant','Chatgegevens zijn gewist. Het lokale AI-model blijft geïnstalleerd.');
};
$('removeModelButton').onclick=async()=>{
  if(!confirm('AI-model verwijderen?'))return;
  try{await runtime.removeModel();await refreshStatus()}catch(e){alert(e.message||e)}
};
$('backButton').onclick=()=>location.href='../../index.html';
$('fullButton').onclick=openFull;
if(embedded)$('fullButton').style.display='inline-block';
window.addEventListener('storage',theme);
theme();load();render();quick();refreshStatus();
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('../../sw.js').catch(()=>{});
if(!history.length)addBubble('assistant',currentTool?`Je gebruikt de kleine Assistent voor ${TOOL_REGISTRY[currentTool]?.name||'deze tool'}.`:'Waar kan ik je mee helpen?');
