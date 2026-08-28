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
const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
const ciWorkflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const buildScript = fs.readFileSync(path.join(root, 'scripts/build.sh'), 'utf8');

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
  const optimizedContent = 'optimized model\n';
  const sourceSha256 = createHash('sha256').update(sourceContent).digest('hex');
  const outputSha256 = createHash('sha256').update(optimizedContent).digest('hex');
  const optimizerScript = fs.readFileSync(
    path.join(root, 'tools/glb-model-optimizer/optimize-models.mjs'),
  );
  const optimizerConfigDigest = createHash('sha256')
    .update(`${createHash('sha256').update(optimizerScript).digest('hex')}\nmedium\n`)
    .digest('hex');
  fs.writeFileSync(path.join(sourceRoot, 'demo.glb'), sourceContent);
  fs.writeFileSync(path.join(targetRoot, 'demo.glb'), sourceContent);
  fs.writeFileSync(path.join(optimizedRoot, 'demo.glb'), optimizedContent);
  fs.writeFileSync(
    path.join(optimizedRoot, 'manifest.json'),
    JSON.stringify({
      models: {
        'demo.glb': {
          status: 'meshopt',
          url: '/assets/models-opt/demo.glb',
          sourceSha256,
          outputSha256,
          optimizerName: '@act/glb-model-optimizer',
          optimizerVersion: '1.0.0',
          optimizerLevel: 'medium',
          optimizerConfigDigest,
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

  assert.match(
    dockerignore,
    /!scripts\/assets\/validate-optimized-models\.mjs/,
    'Docker build context must include the optimized-model validator',
  );
  assert.match(
    buildScript,
    /scripts\/assets\/validate-optimized-models\.mjs/,
    'image build preflight must require the validator in Docker context',
  );
  assert.match(
    ciWorkflow,
    /model-assets:[\s\S]*npm run produce --prefix tools\/glb-model-optimizer[\s\S]*actions\/upload-artifact@v4/,
    'CI must produce and upload optimized models in an independent job',
  );
  assert.match(
    ciWorkflow,
    /needs: model-assets[\s\S]*actions\/download-artifact@v4[\s\S]*path: public\/assets\/models-opt/,
    'application quality job must download optimized models before build',
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('optimized model asset validator contract passed');
