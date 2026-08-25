import { mkdir, rm, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

async function ensureParent(file) {
  await mkdir(path.dirname(file), { recursive: true });
}

async function concatParts(sourceDir, targetFile) {
  const dir = path.join(root, sourceDir);
  const names = (await readdir(dir)).filter(name => name.endsWith('.txt')).sort();
  const chunks = [];
  for (const name of names) chunks.push(await readFile(path.join(dir, name), 'utf8'));
  await ensureParent(path.join(dist, targetFile));
  await writeFile(path.join(dist, targetFile), chunks.join(''), 'utf8');
}

async function download(url, targetFile) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  await ensureParent(path.join(dist, targetFile));
  await writeFile(path.join(dist, targetFile), data);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await writeFile(path.join(dist, '.nojekyll'), '');

await concatParts('src/kopermetingen', 'tools/kopermetingen/index.html');
await concatParts('src/tv-codes', 'tools/tv-codes/index.html');
await concatParts('src/value-fiber-route', 'tools/value-fiber-route/index.html');

const popBase = 'https://raw.githubusercontent.com/miltonminecraft-afk/pop-checklist/main';
await download(`${popBase}/index.html`, 'tools/pop-checklist/index.html');
await download(`${popBase}/template.xlsx`, 'tools/pop-checklist/template.xlsx');

console.log('Tools web build completed.');
