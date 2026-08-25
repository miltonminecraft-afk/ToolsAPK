import { readFile, writeFile, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const A=p=>path.join(root,p);
const sha256=b=>createHash('sha256').update(b).digest('hex');
const exists=async p=>{try{await stat(A(p));return true}catch{return false}};
const ensure=async p=>mkdir(path.dirname(A(p)),{recursive:true});
const write=async(p,b)=>{await ensure(p);await writeFile(A(p),b)};
const cleanB64=s=>String(s).replace(/\s+/g,'');
const expected={
  koperBase:'603c1631a0229ebeb9294b77d911f22bfc19e70f2dae2d14c1da792ba34fda0a',
  koperFinal:'c0b827a3cf39287a072165606e7e7ad58b9b42ff9f0c49bc83ecb4a20ec16b64',
  tv:'181e9367aa4e71775bf601f5de6b40fb10d1ede2fcde8a0104eecbcaf2f34612',
  fiber:'bd3fd764eb532e883c8d26e54549260526f5aafbebb36c042fd40cda1839dcf5',
  hio:'dadfcee144e081ce712772151503e3bf1b60e2516a46d1fed1be0196cce5d005',
  pop:'27fdee56db4fe739087adf1a13d6537437661e62dbba200e686492afb8210641',
  template:'1b456732ea5a95e1dd17bb0695cf8a720022582d34cb70aaa7575629092635eb'
};

function unwrap(input){
  let b=Buffer.from(input);
  for(let i=0;i<6;i++){
    if(b.length>=2&&b[0]===0x1f&&b[1]===0x8b){b=gunzipSync(b);continue}
    const t=b.toString('utf8').trim();
    const c=cleanB64(t);
    if(c.length>=64&&c.length%4===0&&/^[A-Za-z0-9+/=]+$/.test(c)){
      const d=Buffer.from(c,'base64');
      if(d.length&&d.length<b.length*1.1){b=d;continue}
    }
    break;
  }
  return b;
}

async function diskFiles(dir,re){
  if(!(await exists(dir))) return [];
  const names=(await readdir(A(dir))).filter(n=>re.test(n)).sort();
  return Promise.all(names.map(async n=>({name:n,data:await readFile(A(path.join(dir,n)))})));
}
function gitOut(args){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}
function gitBin(args){return execFileSync('git',args,{cwd:root,encoding:null,stdio:['ignore','pipe','ignore']})}

function candidateFromFiles(files,label){
  const tries=[];
  if(!files.length)return tries;
  const leaf=files.map(f=>({name:f.name,b:unwrap(f.data)}));
  tries.push({label:label+':leaf-sorted',b:Buffer.concat(leaf.map(x=>x.b))});
  try{tries.push({label:label+':text-concat',b:unwrap(Buffer.from(files.map(f=>f.data.toString('utf8').trim()).join('')))})}catch{}
  try{tries.push({label:label+':decoded-concat',b:unwrap(Buffer.concat(files.map(f=>Buffer.from(cleanB64(f.data.toString('utf8')),'base64'))))})}catch{}
  for(const x of leaf)tries.push({label:label+':'+x.name,b:x.b});
  return tries;
}

function dedupeChunks(chunks){
  const seen=new Set(),out=[];
  for(const x of chunks){const h=sha256(x.b);if(seen.has(h))continue;seen.add(h);out.push(x)}
  return out;
}
function removeContained(chunks){
  return chunks.filter((x,i)=>!chunks.some((y,j)=>j!==i&&y.b.length>x.b.length&&y.b.indexOf(x.b)>=0));
}
function findKoperBySearch(chunks){
  const targetLen=266658;
  const c=removeContained(dedupeChunks(chunks.filter(x=>x.b.length>1000&&x.b.length<=targetLen)));
  for(const x of c)if(x.b.length===targetLen&&sha256(x.b)===expected.koperBase)return x.b;
  const starts=c.map((x,i)=>[x,i]).filter(([x])=>x.b.subarray(0,50).toString('utf8').includes('<!DOCTYPE html')).map(([,i])=>i);
  const memo=new Set();
  function dfs(buf,used){
    if(buf.length===targetLen)return sha256(buf)===expected.koperBase?buf:null;
    if(buf.length>targetLen)return null;
    const key=buf.length+'|'+[...used].sort((a,b)=>a-b).join(',');if(memo.has(key))return null;memo.add(key);
    for(let i=0;i<c.length;i++){
      if(used.has(i))continue;
      const n=c[i].b;if(buf.length+n.length>targetLen)continue;
      const u=new Set(used);u.add(i);const r=dfs(Buffer.concat([buf,n]),u);if(r)return r;
    }
    return null;
  }
  for(const i of starts){const r=dfs(c[i].b,new Set([i]));if(r)return r}
  function overlap(a,b){const max=Math.min(a.length,b.length,120000);for(let k=max;k>=64;k--)if(a.subarray(a.length-k).equals(b.subarray(0,k)))return k;return 0}
  for(const si of starts){
    let cur=Buffer.from(c[si].b),used=new Set([si]);
    while(cur.length<targetLen){let best=-1,bk=0;for(let i=0;i<c.length;i++){if(used.has(i))continue;if(cur.indexOf(c[i].b)>=0){used.add(i);continue}const k=overlap(cur,c[i].b);if(k>bk){bk=k;best=i}}
      if(best<0)break;cur=Buffer.concat([cur,c[best].b.subarray(bk)]);used.add(best);if(cur.length>targetLen)break;
      if(cur.length===targetLen&&sha256(cur)===expected.koperBase)return cur;
    }
  }
  return null;
}

async function materializeKoper(){
  const directTries=[],chunks=[];
  const dirs=['src-packed/kopermetingen','src-packed2/kopermetingen','src-final/kopermetingen','src-direct/kopermetingen'];
  for(const d of dirs){const fs=await diskFiles(d,/\.(?:b64|txt)$/);for(const t of candidateFromFiles(fs,'disk:'+d)){directTries.push(t);chunks.push(t)}}
  for(const t of directTries)if(t.b.length===266658&&sha256(t.b)===expected.koperBase)return t.b;
  let found=findKoperBySearch(chunks);if(found)return found;
  let commits=[];try{commits=gitOut(['rev-list','--all']).split(/\n+/).filter(Boolean).slice(0,120)}catch{}
  for(const commit of commits){
    const histChunks=[];
    for(const d of dirs){
      let names=[];try{names=gitOut(['ls-tree','-r','--name-only',commit,d]).split(/\n+/).filter(n=>n.includes(d+'/'))}catch{}
      const fs=[];for(const n of names){try{fs.push({name:path.basename(n),data:gitBin(['show',commit+':'+n])})}catch{}}
      for(const t of candidateFromFiles(fs,'git:'+commit.slice(0,8)+':'+d)){
        if(t.b.length===266658&&sha256(t.b)===expected.koperBase)return t.b;histChunks.push(t)
      }
    }
    found=findKoperBySearch(histChunks);if(found)return found;
  }
  throw new Error('Actuele Kopermetingen-basis kon niet exact uit de aanwezige bronstukken worden opgebouwd.');
}

async function decodeExact(paths,hash,label){
  for(const p of paths){if(!(await exists(p)))continue;try{const b=unwrap(await readFile(A(p)));if(sha256(b)===hash)return b}catch{}}
  let commits=[];try{commits=gitOut(['rev-list','--all']).split(/\n+/).filter(Boolean).slice(0,120)}catch{}
  for(const commit of commits)for(const p of paths){try{const b=unwrap(gitBin(['show',commit+':'+p]));if(sha256(b)===hash)return b}catch{}}
  throw new Error(label+' bron niet exact gevonden');
}

function injectMini(text){const tag='<script src="../../shared/assistant-mini.js" defer></script>';if(text.includes(tag))return text;const i=text.toLowerCase().lastIndexOf('</body>');return i>=0?text.slice(0,i)+tag+'\n'+text.slice(i):text+'\n'+tag+'\n'}
function injectPopBack(text){if(text.includes('setupToolsPopBackNavigation'))return text;const s=`\n<script>\n(function setupToolsPopBackNavigation(){\n  const toolsHomePath="../../index.html";\n  function goToolsHome(){window.location.href=toolsHomePath;}\n  try{const app=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;if(app&&app.addListener)app.addListener("backButton",goToolsHome);}catch(e){}\n})();\n</script>\n`;const i=text.toLowerCase().lastIndexOf('</body>');return i>=0?text.slice(0,i)+s+text.slice(i):text+s}
async function fetchExact(url,hash,label){const r=await fetch(url,{headers:{'User-Agent':'ToolsAPK-finalizer'}});if(!r.ok)throw new Error(label+' download HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());if(sha256(b)!==hash)throw new Error(label+' hash klopt niet');return b}

const koperBase=await materializeKoper();
await write('tools/kopermetingen/index.html',koperBase);
execFileSync('git',['apply','--check','patches/kopermetingen-latest.patch'],{cwd:root,stdio:'inherit'});
execFileSync('git',['apply','patches/kopermetingen-latest.patch'],{cwd:root,stdio:'inherit'});
let koper=await readFile(A('tools/kopermetingen/index.html'));if(sha256(koper)!==expected.koperFinal)throw new Error('Kopermetingen eindhash klopt niet');
const tv=await decodeExact(['src-final/tv-codes.gz.b64','src-packed-current/tv-codes.gz.b64'],expected.tv,'TV-codes');
const fiber=await decodeExact(['src-packed-current/value-fiber-route.gz.b64','src-final/value-fiber-route.gz.b64'],expected.fiber,'Value Fiber Route');
const hio=await decodeExact(['src-packed-current/HioScanActivity.java.gz.b64','src-final/HioScanActivity.java.gz.b64'],expected.hio,'HIO');
const popBase='https://raw.githubusercontent.com/miltonminecraft-afk/pop-checklist/main';
const pop=await fetchExact(popBase+'/index.html',expected.pop,'PoP Checklist');
const template=await fetchExact(popBase+'/template.xlsx',expected.template,'PoP template');

await write('tools/kopermetingen/index.html',Buffer.from(injectMini(koper.toString('utf8'))));
await write('tools/tv-codes/index.html',Buffer.from(injectMini(tv.toString('utf8'))));
await write('tools/value-fiber-route/index.html',Buffer.from(injectMini(fiber.toString('utf8'))));
await write('tools/pop-checklist/index.html',Buffer.from(injectMini(injectPopBack(pop.toString('utf8')))));
await write('tools/pop-checklist/template.xlsx',template);
await write('android/app/src/main/java/nl/tools/app/HioScanActivity.java',hio);

let landing=(await readFile(A('index.html'),'utf8'))
  .replace('{title:"Kopermetingen TXT",path:"tools/kopermetingen/index.html"}','{title:"Kopermetingen",path:"tools/kopermetingen/index.html"}')
  .replace('{title:"TV codes",path:"tools/tv-codes/index.html"}','{title:"Afstandsbediening codes",path:"tools/tv-codes/index.html"}')
  .replace('tools/fiber route/index.html','tools/value-fiber-route/index.html');
if(!landing.includes('tools/pop-checklist/index.html')||!landing.includes('tools/assistant/index.html'))throw new Error('Landing mist PoP of Assistent');
await write('index.html',Buffer.from(landing));

const pages=`name: Deploy GitHub Pages\non:\n  push:\n    branches: [main]\n  workflow_dispatch:\npermissions:\n  contents: read\n  pages: write\n  id-token: write\nconcurrency:\n  group: pages\n  cancel-in-progress: true\njobs:\n  deploy:\n    environment:\n      name: github-pages\n      url: \${{ steps.deployment.outputs.page_url }}\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Build static site\n        run: |\n          rm -rf _site\n          mkdir -p _site\n          cp index.html _site/index.html\n          cp -R tools _site/tools\n          cp -R shared _site/shared\n          touch _site/.nojekyll\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: _site\n      - name: Deploy\n        id: deployment\n        uses: actions/deploy-pages@v4\n`;
await write('.github/workflows/pages.yml',Buffer.from(pages));
await write('.nojekyll',Buffer.alloc(0));
await write('README.md',Buffer.from(`# ToolsAPK\n\nDefinitieve projectbron voor GitHub Pages en de Android/Capacitor-uitwerking.\n\nDe webtools staan rechtstreeks onder \`tools/\`; er zijn geen placeholder-, packed- of materialisatiebronnen nodig. De lokale Assistent staat onder \`tools/assistant/\`; Android-native bronnen staan onder \`android/app/src/main/\`.\n`));
await write('SOURCES.md',Buffer.from(`# Actuele bronnen\n\n- Kopermetingen: actuele HVD-naam/actuele-route stijlfix.\n- Afstandsbediening codes: actuele complete versie.\n- Value Fiber Route: actuele versie.\n- Checklist PoP: V7 + actuele template.xlsx.\n- HIO scanner: actuele HioScanActivity.java.\n\nDe definitieve bestanden staan rechtstreeks op hun projectpaden.\n`));

for(const p of ['.bootstrap','patches','src','src-direct','src-final','src-packed','src-packed2','src-packed-current','scripts','.github/workflows/materialize.yml','.github/workflows/materialize-final.yml'])await rm(A(p),{recursive:true,force:true});
console.log('FINAL_OK',JSON.stringify({koper:expected.koperFinal,tv:expected.tv,fiber:expected.fiber,hio:expected.hio,pop:expected.pop,template:expected.template}));
