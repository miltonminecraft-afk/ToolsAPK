const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../www');
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);}
for(const f of walk(root).filter(f=>f.endsWith('.html'))){
  test(path.relative(root,f)+' scripts en verwijzingen',()=>{
    const html=fs.readFileSync(f,'utf8');
    for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
      const src=m[1].match(/src=["']([^"']+)/);if(src){assert(!/^https?:/.test(src[1]),'Script moet lokaal beschikbaar zijn: '+src[1]);assert(fs.existsSync(path.resolve(path.dirname(f),decodeURIComponent(src[1]))),src[1]);}
      else if(!m[1].includes('module'))new vm.Script(m[2],{filename:f});
    }
    for(const m of html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gi)){
      if(/^(https?:|data:|mailto:|tel:|javascript:|blob:)/.test(m[1]))continue;
      assert(fs.existsSync(path.resolve(path.dirname(f),decodeURIComponent(m[1]))),'Ontbrekend bestand: '+m[1]);
    }
  });
}
test('alle startschermtools bestaan',()=>{for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/path:"([^"]+)"/g))assert(fs.existsSync(path.join(root,m[1])),m[1]);});
test('PoP-template is leesbaar en werkblad gebruikt STORE',()=>{const b=fs.readFileSync(path.join(root,'tools/pop-checklist/template.xlsx'));let off=0,found=false;while(off+30<b.length&&b.readUInt32LE(off)===0x04034b50){const size=b.readUInt32LE(off+18),n=b.readUInt16LE(off+26),extra=b.readUInt16LE(off+28),name=b.subarray(off+30,off+30+n).toString();if(name==='xl/worksheets/sheet1.xml'){assert.equal(b.readUInt16LE(off+8),0);found=true;}off+=30+n+extra+size;}assert(found);});
