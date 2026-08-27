import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function readPathArgument(name, required = true) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) {
    if (!required) return undefined;
    throw new Error(`Missing required ${name} path`);
  }
  return path.resolve(process.cwd(), value);
}

function fail(message) {
  throw new Error(`Invalid optimized model asset set: ${message}`);
}

function listGlbs(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    fail(`missing source directory ${root}`);
  }
  return readdirSync(root)
    .filter((name) => name.endsWith('.glb'))
    .sort();
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function sha256Buffer(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const sourceRoot = readPathArgument('--source-root');
const optimizedRoot = readPathArgument('--optimized-root');
const targetSourceRoot = readPathArgument('--target-source-root', false);
const failedManifestPath = `${optimizedRoot}.failed-manifest.json`;
const inProgressPath = `${optimizedRoot}.in-progress.json`;
const manifestPath = path.join(optimizedRoot, 'manifest.json');

if (existsSync(failedManifestPath)) {
  fail(`failed production marker exists: ${failedManifestPath}`);
}
if (existsSync(inProgressPath)) {
  fail(`production in-progress marker exists: ${inProgressPath}`);
}
if (!existsSync(manifestPath)) {
  fail(`missing ${manifestPath}`);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`cannot read manifest: ${error instanceof Error ? error.message : String(error)}`);
}

const expected = listGlbs(sourceRoot);
if (expected.length === 0) {
  fail(`no source GLBs found in ${sourceRoot}`);
}
const entries = manifest && typeof manifest.models === 'object' && manifest.models
  ? manifest.models
  : {};
const declared = Object.keys(entries).sort();
const produced = listGlbs(optimizedRoot);

if (JSON.stringify(declared) !== JSON.stringify(expected)) {
  fail('manifest model list does not match source GLBs');
}
if (JSON.stringify(produced) !== JSON.stringify(expected)) {
  fail('optimized GLB list does not match source GLBs');
}

let targetExpected;
if (targetSourceRoot) {
  targetExpected = listGlbs(targetSourceRoot);
  if (JSON.stringify(targetExpected) !== JSON.stringify(expected)) {
    fail('target source GLB list does not match producer source');
  }
}

for (const name of expected) {
  const record = entries[name];
  const outputPath = path.join(optimizedRoot, name);
  if (!record || record.status !== 'meshopt') {
    fail(`${name} is not marked meshopt`);
  }
  if (record.url !== `/assets/models-opt/${name}`) {
    fail(`${name} has an unexpected runtime URL`);
  }
  const sourceSha256 = sha256(path.join(sourceRoot, name));
  if (record.sourceSha256 !== sourceSha256) {
    fail(`${name} source digest does not match`);
  }
  if (targetSourceRoot && sha256(path.join(targetSourceRoot, name)) !== sourceSha256) {
    fail(`${name} target source digest does not match producer source`);
  }
  if (!existsSync(outputPath) || !statSync(outputPath).isFile() || statSync(outputPath).size === 0) {
    fail(`${name} is missing or empty`);
  }
  const outputSha256 = sha256(outputPath);
  if (typeof record.outputSha256 !== 'string' || record.outputSha256 !== outputSha256) {
    fail(`${name} output digest does not match`);
  }
  if (record.optimizerName !== '@act/glb-model-optimizer') {
    fail(`${name} optimizer identity does not match`);
  }
  if (record.optimizerVersion !== '1.0.0' || record.optimizerLevel !== 'medium') {
    fail(`${name} optimizer configuration does not match`);
  }
  const optimizerScript = readFileSync(path.join(process.cwd(), 'tools/glb-model-optimizer/optimize-models.mjs'));
  const optimizerConfigDigest = createHash('sha256')
    .update(`${sha256Buffer(optimizerScript)}\nmedium\n`)
    .digest('hex');
  if (record.optimizerConfigDigest !== optimizerConfigDigest) {
    fail(`${name} optimizer configuration digest does not match`);
  }
}

console.log(
  `optimized model asset validation passed (${expected.length} model(s)${targetSourceRoot ? ', target matched' : ''})`,
);
