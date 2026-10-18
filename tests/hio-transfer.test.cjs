const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../www/tools/kopermetingen/index.html'),'utf8');
function context(){
 const code=html.slice(html.indexOf('function hioValue('),html.indexOf('function formatHioConfirmDikader('));
 const ctx={state:{kvds:[]},normalizeDikaderValue:v=>String(v||'')};vm.createContext(ctx);vm.runInContext(code,ctx);
 for(const name of ['hioKnownKvdNames','normalizeRouteItemLabel']){
  const lines=html.split('\n').filter(l=>l.startsWith('function '+name+'('));
  vm.runInContext(lines.at(-1),ctx);
 }
 ctx.routeForService=()=>({kvds:ctx.state.kvds});ctx.activeRouteServiceId=()=>'';ctx.cleanRouteKvdName=v=>String(v).trim().toUpperCase();
 return ctx;
}
test('native HIO JSON preserves A, B, AA and AD in route order',()=>{
 const c=context();const input={serviceId:'CJF12345',dikader:'1',items:['A','B','AA','AD'].map((name,i)=>({type:'kvd',name,vStijl:String(i+1),vStift:String(i+11)}))};
 const result=c.normalizeHioScanResult(input);
 assert.deepEqual(Array.from(result.items,i=>i.name),['A','B','AA','AD']);
 assert.deepEqual(Array.from(result.items,i=>i.vStijl),['001','002','003','004']);
 assert.deepEqual(Array.from(result.items,i=>i.vStift),['011','012','013','014']);
 assert.equal(result.serviceId,'CJF12345');assert.equal(result.dikader,'1');
});
test('known-route context and bare labels also accept single letters',()=>{
 const c=context();c.state.kvds=['A','B','AB'];assert.deepEqual(Array.from(c.hioKnownKvdNames()),['A','B','AB']);
 for(const name of ['A','B','AA','AD'])assert.equal(c.normalizeRouteItemLabel(name),'KVD '+name);
});
test('invalid identifiers are rejected instead of truncated into other route points',()=>{
 const c=context();for(const name of ['',null,'INVALID','ABC','12','A2'])assert.equal(c.hioCleanName(name,'kvd'),'');
 assert.equal(c.hioCleanName('a','kvd'),'A');assert.equal(c.hioCleanName('A0','kvd'),'AO');
});
test('SIP, HVD and cassette letters survive normalization with single-letter KVDs',()=>{
 const c=context();const result=c.normalizeHioScanResult({serviceId:'CJF12345',items:[{type:'hvd',name:'HVD1',hCassette:'A',vRij:'B',hStijl:'1',hStift:'2'},{type:'sip',name:'',hStijl:'3',hStift:'4'},{type:'kvd',name:'A',vStijl:'5',vStift:'6'}]});
 assert.deepEqual(Array.from(result.items,i=>i.type),['hvd','sip','kvd']);
 assert.equal(result.items[0].hRij,'A');assert.equal(result.items[0].vRij,'B');assert.equal(result.items[2].name,'A');
});
