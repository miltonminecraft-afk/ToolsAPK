const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../www/tools/pop-checklist');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('function excelSerial('),end=html.indexOf('function downloadBytes(',start);
const code=html.slice(start,end);
test('Excel- en ZIP-export behouden template en ingevulde waarden',()=>{
 const context={Uint8Array,DataView,TextEncoder,TextDecoder,Blob,Date,DecompressionStream,Response,templateBytesCache:new Uint8Array(fs.readFileSync(path.join(root,'template.xlsx'))),TARGET_SHEET:'xl/worksheets/sheet1.xml',getQuestionPhotos:()=>[]};vm.createContext(context);vm.runInContext(code,context);
 const state={monteur:'TEST & controle',pop:'Test PoP',datum:'2026-10-18',plaats:'Testplaats',items:Array.from({length:15},()=>({status:'Ja',reported:'',note:'<test>'})),generalNotes:'Test export',quality:'Groen'};
 const xlsx=context.buildExcelBytes(state);const entries=context.parseZip(xlsx);const sheet=entries.find(e=>e.name===context.TARGET_SHEET);const xml=new TextDecoder().decode(sheet.compressed);
 assert.match(xml,/TEST &amp; controle/);assert.match(xml,/&lt;test&gt;/);assert.match(xml,/Groen/);assert.equal(entries.length,context.parseZip(context.templateBytesCache).length);
 const zip=context.makeStoredZip([{name:'controle.xlsx',bytes:xlsx},{name:'foto.txt',bytes:new TextEncoder().encode('test')}]);const packed=context.parseZip(zip);assert.equal(packed.length,2);assert.equal(packed[0].name,'controle.xlsx');assert.deepEqual(packed[0].compressed,xlsx);
});
