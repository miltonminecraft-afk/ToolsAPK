import './materialize.mjs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await cp(path.join(root, 'tools'), path.join(dist, 'tools'), { recursive: true });
await writeFile(path.join(dist, '.nojekyll'), '');

console.log('GitHub Pages build klaar.');
