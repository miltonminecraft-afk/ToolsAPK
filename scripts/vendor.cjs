const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=require('./vendor-manifest.json');
(async()=>{
 for(const item of manifest){
  const target=path.join(root,item.path);
  const valid=()=>fs.existsSync(target)&&crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')===item.sha256;
  if(valid())continue;
  console.log('Downloading '+item.path);
  let last;
  for(let attempt=0;attempt<3;attempt++)try{
   const response=await fetch(item.url,{signal:AbortSignal.timeout(120000)});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error('SHA-256 mismatch: '+item.path);
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);last=null;break;
  }catch(e){last=e;}
  if(last)throw last;
 }
 console.log('Vendor assets verified.');
})().catch(e=>{console.error(e);process.exitCode=1});
