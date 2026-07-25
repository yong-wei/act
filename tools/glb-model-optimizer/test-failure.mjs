import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'glb-optimizer-failure-'));
const sourceDir = path.join(temporaryRoot, 'source');
const outputDir = path.join(temporaryRoot, 'models-opt');
const previousManifest = {
  models: {
    'broken.glb': {
      status: 'meshopt',
      url: '/assets/models-opt/broken.glb',
      sourceBytes: 8,
      optimizedBytes: 13,
    },
  },
};

try {
  await mkdir(sourceDir);
  await mkdir(outputDir);
  await writeFile(path.join(sourceDir, 'broken.glb'), 'not a glb\n');
  await writeFile(path.join(outputDir, 'broken.glb'), 'previous-good\n');
  await writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(previousManifest, null, 2)}\n`,
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(import.meta.dirname, 'optimize-models.mjs'),
      '--source',
      sourceDir,
      '--output',
      outputDir,
    ],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0, 'invalid GLB production must fail');
  assert.equal(
    await readFile(path.join(outputDir, 'broken.glb'), 'utf8'),
    'previous-good\n',
    'failed production must preserve the previous complete artifact',
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8')),
    previousManifest,
    'failed production must preserve the previous complete manifest',
  );

  const failedManifest = JSON.parse(
    await readFile(path.join(temporaryRoot, 'models-opt.failed-manifest.json'), 'utf8'),
  );
  assert.equal(failedManifest.models['broken.glb'].status, 'fallback-original');
  await assert.rejects(
    readFile(path.join(temporaryRoot, 'models-opt.in-progress.json'), 'utf8'),
    { code: 'ENOENT' },
    'handled production failure must replace the in-progress marker with diagnostics',
  );
  assert.equal(
    (await readdir(temporaryRoot)).some((name) => name.startsWith('.models-opt-staging-')),
    false,
    'failed production must remove its staging directory',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log('GLB optimizer failure contract passed');
