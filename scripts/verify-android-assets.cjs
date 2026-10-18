const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(project,'capacitor.config.json'),'utf8'));
const source=path.join(project,config.webDir),assets=path.join(project,'android/app/src/main/assets/public');
let count=0;
function verify(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())verify(file);else if(entry.name!=='.DS_Store'){const relative=path.relative(source,file),copy=path.join(assets,relative);assert(fs.existsSync(copy),'Missing Android asset: '+relative);assert(fs.readFileSync(file).equals(fs.readFileSync(copy)),'Stale Android asset: '+relative);count++;}}}
verify(source);
console.log(`Verified ${count} web files match packaged Android assets.`);
