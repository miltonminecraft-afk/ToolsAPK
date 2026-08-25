import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
await cp('index.html','dist/index.html');await cp('tools','dist/tools',{recursive:true});await cp('shared','dist/shared',{recursive:true});await writeFile('dist/.nojekyll','');
console.log('GitHub Pages build gereed.');
