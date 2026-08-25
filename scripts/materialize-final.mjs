import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const sha256=data=>createHash('sha256').update(data).digest('hex');
const abs=p=>path.join(root,p);
async function ensureParent(p){await mkdir(path.dirname(abs(p)),{recursive:true});}
async function writeChecked(target,data,expected){
  const got=sha256(data);
  if(got!==expected) throw new Error(`${target}: ${got} != ${expected}`);
  await ensureParent(target); await writeFile(abs(target),data); console.log('OK',target);
}
async function unpackSingle(source,target,expected){
  const b64=(await readFile(abs(source),'utf8')).trim();
  await writeChecked(target,gunzipSync(Buffer.from(b64,'base64')),expected);
}
async function unpackParts(dir,target,expected){
  const names=(await readdir(abs(dir))).filter(n=>n.endsWith('.b64')).sort();
  if(!names.length) throw new Error(`Geen bronstukken in ${dir}`);
  const binaryParts=[];
  for(const name of names){
    const b64=(await readFile(abs(path.join(dir,name)),'utf8')).trim();
    binaryParts.push(Buffer.from(b64,'base64'));
  }
  await writeChecked(target,gunzipSync(Buffer.concat(binaryParts)),expected);
}
async function fetchChecked(url,target,expected){
  const response=await fetch(url);
  if(!response.ok) throw new Error(`Download ${response.status}: ${url}`);
  await writeChecked(target,Buffer.from(await response.arrayBuffer()),expected);
}
async function injectMini(file){
  let source=await readFile(abs(file),'utf8');
  const tag='<script src="../../shared/assistant-mini.js" defer></script>';
  if(source.includes(tag)) return;
  const index=source.toLowerCase().lastIndexOf('</body>');
  source=index>=0 ? source.slice(0,index)+tag+'\n'+source.slice(index) : source+'\n'+tag+'\n';
  await writeFile(abs(file),source);
}

await rm(abs('www'),{recursive:true,force:true});
await mkdir(abs('www/tools'),{recursive:true});

const landing=await readFile(abs('index.html'));
await writeFile(abs('www/index.html'),landing);

await unpackParts('src-final/kopermetingen','www/tools/kopermetingen/index.html','c0b827a3cf39287a072165606e7e7ad58b9b42ff9f0c49bc83ecb4a20ec16b64');
await unpackSingle('src-final/tv-codes.gz.b64','www/tools/tv-codes/index.html','181e9367aa4e71775bf601f5de6b40fb10d1ede2fcde8a0104eecbcaf2f34612');
await unpackSingle('src-packed-current/value-fiber-route.gz.b64','www/tools/value-fiber-route/index.html','bd3fd764eb532e883c8d26e54549260526f5aafbebb36c042fd40cda1839dcf5');
await unpackSingle('src-packed-current/HioScanActivity.java.gz.b64','android/app/src/main/java/nl/tools/app/HioScanActivity.java','dadfcee144e081ce712772151503e3bf1b60e2516a46d1fed1be0196cce5d005');

const pop='https://raw.githubusercontent.com/miltonminecraft-afk/pop-checklist/main';
await fetchChecked(`${pop}/index.html`,'www/tools/pop-checklist/index.html','27fdee56db4fe739087adf1a13d6537437661e62dbba200e686492afb8210641');
await fetchChecked(`${pop}/template.xlsx`,'www/tools/pop-checklist/template.xlsx','1b456732ea5a95e1dd17bb0695cf8a720022582d34cb70aaa7575629092635eb');

await cp(abs('tools/assistant'),abs('www/tools/assistant'),{recursive:true});
await mkdir(abs('www/shared'),{recursive:true});
await cp(abs('shared/assistant-mini.js'),abs('www/shared/assistant-mini.js'));
for(const file of [
  'www/tools/kopermetingen/index.html',
  'www/tools/tv-codes/index.html',
  'www/tools/value-fiber-route/index.html',
  'www/tools/pop-checklist/index.html'
]) await injectMini(file);

await rm(abs('android/llama.cpp'),{recursive:true,force:true});
try{execFileSync('git',['submodule','deinit','-f','android/llama.cpp'],{cwd:root,stdio:'ignore'});}catch{}
try{execFileSync('git',['rm','-f','android/llama.cpp'],{cwd:root,stdio:'ignore'});}catch{}
execFileSync('git',['submodule','add','--depth','1','https://github.com/ggml-org/llama.cpp.git','android/llama.cpp'],{cwd:root,stdio:'inherit'});
execFileSync('git',['-C','android/llama.cpp','fetch','--depth','1','origin','1729ed5371cd1ac6f6d6f3226f8803b080042839'],{cwd:root,stdio:'inherit'});
execFileSync('git',['-C','android/llama.cpp','checkout','1729ed5371cd1ac6f6d6f3226f8803b080042839'],{cwd:root,stdio:'inherit'});

const pages=`name: Deploy GitHub Pages\non:\n  push:\n    branches: [main]\n  workflow_dispatch:\npermissions:\n  contents: read\n  pages: write\n  id-token: write\nconcurrency:\n  group: pages\n  cancel-in-progress: true\njobs:\n  deploy:\n    environment:\n      name: github-pages\n      url: \${{ steps.deployment.outputs.page_url }}\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          submodules: false\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: ./www\n      - name: Deploy\n        id: deployment\n        uses: actions/deploy-pages@v4\n`;
await writeFile(abs('.github/workflows/pages.yml'),pages);
await writeFile(abs('README.md'),`# ToolsAPK\n\nDe map \`www/\` is de gedeelde webinterface voor GitHub Pages en Android WebView/Capacitor.\n\nDe Assistent kiest automatisch tussen browserlokale llama.cpp/WASM (wllama) en de Android native llama.cpp/JNI-bridge. Het GGUF-model wordt eenmalig lokaal opgeslagen en staat niet in deze repository.\n`);
await writeFile(abs('SOURCES.md'),`# Actuele bronnen\n\n- Kopermetingen: actuele GPT-upload met HVD-naam/actuele-route stijlfix.\n- Afstandsbediening codes: actuele complete GPT-versie.\n- Value Fiber Route: actuele GPT-versie.\n- Checklist PoP: actuele V7-versie + template.xlsx.\n- HioScanActivity.java: actuele door gebruiker aangeleverde versie.\n`);

for(const p of [
  '.bootstrap','patches','src','src-final','src-packed','src-packed2','src-packed-current',
  'tools','shared','scripts','index.html',
  '.github/workflows/materialize.yml','.github/workflows/materialize-final.yml'
]) await rm(abs(p),{recursive:true,force:true});

console.log('Definitieve schone ToolsAPK projectboom gereed.');
