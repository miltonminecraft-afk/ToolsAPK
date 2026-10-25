const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),www=path.join(root,'www'),dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.cpSync(www,dist,{recursive:true,filter:p=>!p.endsWith('.DS_Store')});
const assets=[];
function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,d.name);if(d.isDirectory())walk(f);else if(!['sw.js'].includes(d.name))assets.push(path.relative(dist,f).split(path.sep).map(encodeURIComponent).join('/'));}}
walk(dist);
const hash=crypto.createHash('sha256');for(const f of assets)hash.update(fs.readFileSync(path.join(dist,decodeURIComponent(f))));
const version=hash.digest('hex').slice(0,16);
const sw=`const PREFIX='tools-'+encodeURIComponent(self.registration.scope)+'-';const CACHE=PREFIX+'${version}';\nconst ASSETS=${JSON.stringify(assets)};\nself.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.href.startsWith(self.registration.scope))return;e.respondWith(caches.open(CACHE).then(async c=>{let r=await c.match(e.request,{ignoreSearch:true});if(!r&&u.pathname.endsWith('/'))r=await c.match(new URL('index.html',u).href);return r||fetch(e.request)}))});\n`;
fs.writeFileSync(path.join(dist,'sw.js'),sw);
fs.writeFileSync(path.join(dist,'.nojekyll'),'');
console.log(`Built ${assets.length} assets; offline cache ${version}`);
