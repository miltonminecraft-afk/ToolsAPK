import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = process.cwd();

async function ensureParent(file) {
  await mkdir(path.dirname(file), { recursive: true });
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

async function writeChecked(target, data, expectedHash) {
  const hash = sha256(data);
  if (hash !== expectedHash) {
    throw new Error(`Hash mismatch for ${target}: ${hash} != ${expectedHash}`);
  }
  const full = path.join(root, target);
  await ensureParent(full);
  await writeFile(full, data);
  console.log(`OK ${target} ${hash}`);
}

async function unpackSingle(source, target, expectedHash) {
  const encoded = (await readFile(path.join(root, source), 'utf8')).trim();
  const data = gunzipSync(Buffer.from(encoded, 'base64'));
  await writeChecked(target, data, expectedHash);
}

async function unpackParts(sourceDir, target, expectedHash) {
  const dir = path.join(root, sourceDir);
  const names = (await readdir(dir)).filter(name => name.endsWith('.gz.b64')).sort();
  if (!names.length) throw new Error(`No packed source parts in ${sourceDir}`);
  let encoded = '';
  for (const name of names) encoded += (await readFile(path.join(dir, name), 'utf8')).trim();
  const data = gunzipSync(Buffer.from(encoded, 'base64'));
  await writeChecked(target, data, expectedHash);
}

async function fetchChecked(url, target, expectedHash) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  await writeChecked(target, data, expectedHash);
}

await unpackParts(
  'src-packed2/kopermetingen',
  'tools/kopermetingen/index.html',
  '603c1631a0229ebeb9294b77d911f22bfc19e70f2dae2d14c1da792ba34fda0a'
);

await unpackSingle(
  'src-packed-current/tv-codes.gz.b64',
  'tools/tv-codes/index.html',
  'c6b8faaed0d7f620c31fc4a47a571e36a71cfbf89592c3e2b6caf48fcf88cd15'
);

await unpackSingle(
  'src-packed-current/value-fiber-route.gz.b64',
  'tools/value-fiber-route/index.html',
  'bd3fd764eb532e883c8d26e54549260526f5aafbebb36c042fd40cda1839dcf5'
);

await unpackSingle(
  'src-packed-current/HioScanActivity.java.gz.b64',
  'android/app/src/main/java/nl/tools/app/HioScanActivity.java',
  'dadfcee144e081ce712772151503e3bf1b60e2516a46d1fed1be0196cce5d005'
);

const popBase = 'https://raw.githubusercontent.com/miltonminecraft-afk/pop-checklist/main';
await fetchChecked(
  `${popBase}/index.html`,
  'tools/pop-checklist/index.html',
  '27fdee56db4fe739087adf1a13d6537437661e62dbba200e686492afb8210641'
);
await fetchChecked(
  `${popBase}/template.xlsx`,
  'tools/pop-checklist/template.xlsx',
  '1b456732ea5a95e1dd17bb0695cf8a720022582d34cb70aaa7575629092635eb'
);

console.log('Alle actuele Tools-bronnen zijn exact gematerialiseerd.');
