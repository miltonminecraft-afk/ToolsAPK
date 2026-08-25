import { mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const sha256=data=>createHash('sha256').update(data).digest('hex');
async function parent(file){await mkdir(path.dirname(path.join(root,file)),{recursive:true});}
async function checked(target,data,hash){const got=sha256(data);if(got!==hash)throw new Error(`${target}: ${got} != ${hash}`);await parent(target);await writeFile(path.join(root,target),data);console.log('OK',target);}
async function unpackSingle(source,target,hash){const b64=(await readFile(path.join(root,source),'utf8')).trim();await checked(target,gunzipSync(Buffer.from(b64,'base64')),hash);}
async function unpackParts(dir,target,hash){const names=(await readdir(path.join(root,dir))).filter(x=>x.endsWith('.gz.b64')).sort();let b64='';for(const n of names)b64+=(await readFile(path.join(root,dir,n),'utf8')).trim();await checked(target,gunzipSync(Buffer.from(b64,'base64')),hash);}
async function fetchChecked(url,target,hash){const r=await fetch(url);if(!r.ok)throw new Error(`Download ${r.status}: ${url}`);await checked(target,Buffer.from(await r.arrayBuffer()),hash);}
async function injectMini(file){const p=path.join(root,file);let s=await readFile(p,'utf8');const tag='<script src="../../shared/assistant-mini.js" defer></script>';if(!s.includes(tag)){const i=s.toLowerCase().lastIndexOf('</body>');s=i>=0?s.slice(0,i)+tag+'\n'+s.slice(i):s+'\n'+tag+'\n';await writeFile(p,s);} }

await unpackParts('src-packed2/kopermetingen','tools/kopermetingen/index.html','603c1631a0229ebeb9294b77d911f22bfc19e70f2dae2d14c1da792ba34fda0a');
execFileSync('git',['apply','--whitespace=nowarn','patches/kopermetingen-latest.patch'],{cwd:root,stdio:'inherit'});
const koper=await readFile(path.join(root,'tools/kopermetingen/index.html'));if(sha256(koper)!=='c0b827a3cf39287a072165606e7e7ad58b9b42ff9f0c49bc83ecb4a20ec16b64')throw new Error('Kopermetingen patch hash klopt niet');
await unpackSingle('src-packed-current/tv-codes.gz.b64','tools/tv-codes/index.html','c6b8faaed0d7f620c31fc4a47a571e36a71cfbf89592c3e2b6caf48fcf88cd15');
await unpackSingle('src-packed-current/value-fiber-route.gz.b64','tools/value-fiber-route/index.html','bd3fd764eb532e883c8d26e54549260526f5aafbebb36c042fd40cda1839dcf5');
await unpackSingle('src-packed-current/HioScanActivity.java.gz.b64','android/app/src/main/java/nl/tools/app/HioScanActivity.java','dadfcee144e081ce712772151503e3bf1b60e2516a46d1fed1be0196cce5d005');
const pop='https://raw.githubusercontent.com/miltonminecraft-afk/pop-checklist/main';
await fetchChecked(`${pop}/index.html`,'tools/pop-checklist/index.html','27fdee56db4fe739087adf1a13d6537437661e62dbba200e686492afb8210641');
await fetchChecked(`${pop}/template.xlsx`,'tools/pop-checklist/template.xlsx','1b456732ea5a95e1dd17bb0695cf8a720022582d34cb70aaa7575629092635eb');
for(const f of ['tools/kopermetingen/index.html','tools/tv-codes/index.html','tools/value-fiber-route/index.html','tools/pop-checklist/index.html'])await injectMini(f);

for(const p of ['src-packed','src-packed2','src-packed-current','src','staging','patches','.github/workflows/materialize.yml','.github/workflows/materialize-final.yml','scripts/materialize.mjs','scripts/materialize-final.mjs'])await rm(path.join(root,p),{recursive:true,force:true});
console.log('Definitieve ToolsAPK projectboom is gematerialiseerd en opgeschoond.');
