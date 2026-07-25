import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'optimized-model-validator-'));
const sourceRoot = path.join(temporaryRoot, 'source');
const targetRoot = path.join(temporaryRoot, 'target');
const optimizedRoot = path.join(temporaryRoot, 'models-opt');
const validator = path.join(root, 'scripts/assets/validate-optimized-models.mjs');

function runValidator(extraArgs = []) {
  return spawnSync(
    process.execPath,
    [
      validator,
      '--source-root',
      sourceRoot,
      '--optimized-root',
      optimizedRoot,
      ...extraArgs,
    ],
    { cwd: root, encoding: 'utf8' },
  );
}

try {
  fs.mkdirSync(sourceRoot);
  fs.mkdirSync(targetRoot);
  fs.mkdirSync(optimizedRoot);
  const sourceContent = 'source model\n';
  const sourceSha256 = createHash('sha256').update(sourceContent).digest('hex');
  fs.writeFileSync(path.join(sourceRoot, 'demo.glb'), sourceContent);
  fs.writeFileSync(path.join(targetRoot, 'demo.glb'), sourceContent);
  fs.writeFileSync(path.join(optimizedRoot, 'demo.glb'), 'optimized model\n');
  fs.writeFileSync(
    path.join(optimizedRoot, 'manifest.json'),
    JSON.stringify({
      models: {
        'demo.glb': {
          status: 'meshopt',
          url: '/assets/models-opt/demo.glb',
          sourceSha256,
        },
      },
    }),
  );

  const valid = runValidator(['--target-source-root', targetRoot]);
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /validation passed \(1 model\(s\), target matched\)/);

  fs.writeFileSync(path.join(targetRoot, 'demo.glb'), 'different target model\n');
  const targetDrift = runValidator(['--target-source-root', targetRoot]);
  assert.notEqual(targetDrift.status, 0);
  assert.match(targetDrift.stderr, /target source digest does not match producer source/);

  fs.writeFileSync(`${optimizedRoot}.in-progress.json`, '{}\n');
  const inProgress = runValidator();
  assert.notEqual(inProgress.status, 0);
  assert.match(inProgress.stderr, /production in-progress marker exists/);

  fs.rmSync(`${optimizedRoot}.in-progress.json`);
  fs.rmSync(optimizedRoot, { recursive: true });
  const missingOutput = runValidator();
  assert.notEqual(missingOutput.status, 0);
  assert.match(missingOutput.stderr, /missing .*models-opt\/manifest\.json/);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('optimized model asset validator contract passed');
