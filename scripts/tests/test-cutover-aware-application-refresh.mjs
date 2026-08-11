import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const localEntry = path.join(root, 'scripts', 'remote-refresh-cutover-app.sh');
const operator = path.join(root, 'scripts', 'knowledge-cutover', 'remote-application-refresh.sh');
const stateHelper = path.join(root, 'scripts', 'knowledge-cutover', 'refresh-state.mjs');
const deployScript = path.join(root, 'deploy', 'podman', 'deploy.sh');
const legacyDeploy = path.join(root, 'scripts', 'remote-deploy.sh');
const revision = '58f70df257f493f7dc13b2dabfb0383b972ee017';
const transactionId = 'first-cutover-7f4cdd1084af419a3e837876';
const previousDigest = `sha256:${'a'.repeat(64)}`;
const targetDigest = `sha256:${'b'.repeat(64)}`;
const targetDigestHex = targetDigest.slice('sha256:'.length);
const targetImage = 'localhost/act-obe-platform:test-refresh';

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeExecutable(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
}

function copyTree(relativePath, fixtureRoot) {
  const source = path.join(root, relativePath);
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function runOperator(fixture, extraEnv = {}, { refreshId = fixture.refreshId } = {}) {
  return spawnSync(
    'bash',
    [
      operator,
      'refresh',
      fixture.project,
      fixture.stage,
      refreshId,
      targetImage,
      fixture.tarSha,
      targetDigest,
      revision,
      'https://fixture.invalid',
      '0',
      fixture.helperSha,
      fixture.deploySha,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture.bin}${path.delimiter}${process.env.PATH}`,
        ...extraEnv,
      },
    },
  );
}

function createFixture(name, { marker = true, mode = 'duplicate', failTarget = false } = {}) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), `cutover-refresh-${name}-`));
  const project = path.join(fixtureRoot, 'project');
  const refreshId = `refresh-${name}`;
  const stage = path.join(project, 'data', 'runtime', 'knowledge-cutover', 'app-refresh-staging', refreshId);
  const bin = path.join(fixtureRoot, 'bin');
  fs.mkdirSync(bin, { recursive: true });

  for (const relativePath of [
    'course-content/authoring/knowledge/authority',
    'course-content/runtime/knowledge/projection',
    'course-content/runtime/knowledge/prerequisites',
    'course-content/runtime/knowledge/consumer-activation',
  ]) copyTree(relativePath, project);
  fs.rmSync(path.join(project, 'course-content/authoring/knowledge/authority', 'current.json'), { force: true });
  fs.rmSync(path.join(project, 'course-content/runtime/knowledge/projection', 'current.json'), { force: true });
  fs.rmSync(path.join(project, 'course-content/runtime/knowledge/prerequisites', 'current.json'), { force: true });
  fs.rmSync(path.join(project, 'course-content/runtime/knowledge/consumer-activation', 'current.json'), { force: true });
  for (const relativePath of [
    'course-content/authoring/knowledge/authority/current.json',
    'course-content/runtime/knowledge/projection/current.json',
    'course-content/runtime/knowledge/prerequisites/current.json',
    'course-content/runtime/knowledge/consumer-activation/current.json',
  ]) {
    fs.mkdirSync(path.dirname(path.join(project, relativePath)), { recursive: true });
    fs.copyFileSync(path.join(root, relativePath), path.join(project, relativePath));
  }

  const markerRoot = path.join(project, 'course-content', 'runtime', 'knowledge', 'production-cutover-transactions');
  const journalRoot = path.join(project, 'course-content', 'runtime', 'knowledge', 'consumer-activation', 'first-activation-transactions');
  fs.mkdirSync(markerRoot, { recursive: true });
  if (marker) {
    fs.writeFileSync(path.join(markerRoot, 'current.json'), `${JSON.stringify({
      contract: 'act-production-knowledge-cutover-current/v1',
      transactionId,
      planHash: 'c'.repeat(64),
      imageRevision: revision,
      imageConfigDigest: previousDigest,
      imageTarSha256: 'd'.repeat(64),
      captureRevision: revision,
      status: 'COMMITTED',
    })}\n`);
    fs.writeFileSync(path.join(markerRoot, `${transactionId}.json`), `${JSON.stringify({
      contract: 'act-production-knowledge-cutover-receipt/v1',
      transactionId,
      planHash: 'c'.repeat(64),
      imageRevision: revision,
      imageConfigDigest: previousDigest,
      imageTarSha256: 'd'.repeat(64),
      captureRevision: revision,
      status: 'COMMITTED',
    })}\n`);
    fs.mkdirSync(journalRoot, { recursive: true });
    fs.copyFileSync(
      path.join(root, 'course-content/runtime/knowledge/consumer-activation/first-activation-transactions', `${transactionId}.json`),
      path.join(journalRoot, `${transactionId}.json`),
    );
  }

  const envFile = path.join(project, 'data', 'runtime', 'act-obe.env');
  fs.mkdirSync(path.dirname(envFile), { recursive: true });
  const modeLines = mode === 'missing'
    ? ''
    : mode === 'duplicate'
      ? 'ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy\nACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy\n'
      : `ACT_KNOWLEDGE_DEPLOYMENT_MODE=${mode}\n`;
  fs.writeFileSync(envFile, `CUSTOM_KEEP=retained\n${modeLines}`);
  fs.chmodSync(envFile, 0o640);

  fs.mkdirSync(stage, { recursive: true });
  fs.copyFileSync(stateHelper, path.join(stage, 'refresh-state.mjs'));
  const stagedDeploy = path.join(stage, '4-deploy.sh');
  writeExecutable(stagedDeploy, `#!/usr/bin/env bash
set -eu
printf '%s\n' "\${APP_IMAGE:-}" >> "\${DEPLOY_LOG:-/tmp/refresh-deploy.log}"
if [ "\${FAIL_TARGET:-0}" = 1 ] && [ "\${APP_IMAGE:-}" = "${targetImage}" ]; then exit 42; fi
  if [ "\${APP_IMAGE:-}" = "${targetImage}" ]; then printf '%s\n' target > "\${STATE_FILE}"; else printf '%s\n' previous > "\${STATE_FILE}"; fi
`);
  fs.mkdirSync(path.join(project, 'scripts'), { recursive: true });
  fs.copyFileSync(stagedDeploy, path.join(project, 'scripts', '4-deploy.sh'));
  fs.chmodSync(path.join(project, 'scripts', '4-deploy.sh'), 0o755);
  const imageTar = path.join(stage, 'image.tar');
  fs.writeFileSync(imageTar, `target-${name}`);
  const tarSha = sha256File(imageTar);
  fs.writeFileSync(path.join(stage, 'image.tar.provenance.json'), `${JSON.stringify({ imageTarSha256: tarSha, appRevision: revision })}\n`);

  writeExecutable(path.join(bin, 'podman'), `#!/usr/bin/env bash
set -eu
state="\${STATE_FILE}"
if [ "\${1:-}" = inspect ]; then
  container="\${2:-}"
  format="\${4:-}"
  current="$(cat "$state")"
  if [[ "$format" == *ImageName* ]]; then [ "$current" = target ] && echo "${targetImage}" || echo "localhost/act-obe-platform:previous"; exit 0; fi
  if [[ "$format" == *State.Running* ]]; then echo true; exit 0; fi
  if [[ "$format" == *Config.Env* ]]; then echo ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover; [ "\${MIXED_MODE:-0}" = 1 ] && echo ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy; exit 0; fi
  if [[ "$format" == *Image* ]]; then
    if [ "\${MIXED_DIGEST:-0}" = 1 ] && [ "$container" = act-obe-worker ]; then echo "sha256:${'c'.repeat(64)}"; else [ "$current" = target ] && echo "${targetDigest}" || echo "${previousDigest}"; fi
    exit 0
  fi
fi
if [ "\${1:-}" = image ] && [ "\${2:-}" = inspect ]; then
  format="\${5:-}"
  if [[ "$format" == *Labels* ]]; then
    echo "${revision}"
  elif [ "\${IMAGE_ID_BAD:-0}" = 1 ]; then
    echo "sha256:${'c'.repeat(64)}"
  elif [ "\${IMAGE_ID_NO_PREFIX:-0}" = 1 ]; then
    echo "${targetDigestHex}"
  else
    echo "${targetDigest}"
  fi
  exit 0
fi
if [ "\${1:-}" = load ]; then exit 0; fi
if [ "\${1:-}" = container ] && [ "\${2:-}" = exists ]; then exit 0; fi
exit 0
`);
  writeExecutable(path.join(bin, 'curl'), '#!/usr/bin/env bash\nexit 0\n');
  const stateFile = path.join(fixtureRoot, 'state');
  fs.writeFileSync(stateFile, 'previous\n');

  return {
    root: fixtureRoot,
    project,
    stage,
    bin,
    stateFile,
    tarSha,
    helperSha: sha256File(stateHelper),
    deploySha: sha256File(stagedDeploy),
    refreshId,
    receipt: path.join(project, 'data/runtime/knowledge-cutover/app-refresh', `refresh-${name}.json`),
    envFile,
    markerRoot,
    journalRoot,
    selectorPaths: {
      authority: path.join(project, 'course-content/authoring/knowledge/authority/current.json'),
      projection: path.join(project, 'course-content/runtime/knowledge/projection/current.json'),
      prerequisite: path.join(project, 'course-content/runtime/knowledge/prerequisites/current.json'),
      consumer: path.join(project, 'course-content/runtime/knowledge/consumer-activation/current.json'),
    },
    failTarget,
  };
}

function testStaticContracts() {
  const entrySource = fs.readFileSync(localEntry, 'utf8');
  const operatorSource = fs.readFileSync(operator, 'utf8');
  const deploySource = fs.readFileSync(deployScript, 'utf8');
  const legacySource = fs.readFileSync(legacyDeploy, 'utf8');
  assert.doesNotMatch(entrySource, /remote-deploy\.sh/u);
  assert.doesNotMatch(operatorSource, /remote-deploy\.sh/u);
  assert.doesNotMatch(entrySource, /podman\s+build|npm\s+run\s+build|next\s+build/u);
  assert.doesNotMatch(operatorSource, /podman\s+build|npm\s+run\s+build|next\s+build/u);
  assert.match(entrySource, /bash -s -- refresh/u);
  assert.match(operatorSource, /\.production-cutover-operator\.lock/u);
  assert.match(operatorSource, /podman load -i/u);
  assert.match(operatorSource, /ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover/u);
  assert.match(operatorSource, /protected cutover control plane drifted/u);
  assert.match(operatorSource, /http:\/\/127\.0\.0\.1:\$\{app_port\}\/api\/readyz/u);
  assert.match(operatorSource, /ln .*receipt_path/u);
  assert.match(deploySource, /ACT_KNOWLEDGE_DEPLOYMENT_MODE=\$ACT_KNOWLEDGE_DEPLOYMENT_MODE/u);
  assert.match(deploySource, /runtime_knowledge_mode_was_set/u);
  assert.match(legacySource, /guard_no_committed_production_cutover/u);
}

function testPersistedCutoverModePriority() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cutover-refresh-mode-'));
  try {
    const deployDir = path.join(fixtureRoot, 'deploy', 'podman');
    const runtimeDir = path.join(fixtureRoot, 'data', 'runtime');
    fs.mkdirSync(deployDir, { recursive: true });
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, '.env.server'), 'ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy\n');
    fs.writeFileSync(
      path.join(runtimeDir, 'act-obe.env'),
      'CUSTOM_KEEP=retained\nACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover\n',
    );
    const marker = 'ACT_KNOWLEDGE_DEPLOYMENT_MODE="${ACT_KNOWLEDGE_DEPLOYMENT_MODE:-legacy}"';
    const instrumented = fs.readFileSync(deployScript, 'utf8').replace(
      marker,
      `${marker}\nprintf 'RESOLVED_MODE=%s\\n' "$ACT_KNOWLEDGE_DEPLOYMENT_MODE"\nexit 0`,
    );
    const instrumentedPath = path.join(deployDir, 'deploy.sh');
    writeExecutable(instrumentedPath, instrumented);
    const result = spawnSync('bash', [instrumentedPath, '--app-only'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
      env: { ...process.env, ACT_KNOWLEDGE_DEPLOYMENT_MODE: 'legacy' },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /RESOLVED_MODE=cutover/u, 'persisted cutover must not be downgraded by ambient legacy');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function testSuccessfulRefresh() {
  const fixture = createFixture('success');
  try {
    const protectedPaths = [
      path.join(fixture.markerRoot, 'current.json'),
      path.join(fixture.markerRoot, `${transactionId}.json`),
      path.join(fixture.journalRoot, `${transactionId}.json`),
      ...Object.values(fixture.selectorPaths),
    ];
    const protectedBefore = protectedPaths.map((filePath) => sha256File(filePath));
    const result = runOperator(fixture, {
      STATE_FILE: fixture.stateFile,
      FAIL_TARGET: '0',
      IMAGE_ID_NO_PREFIX: '1',
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.readFileSync(fixture.stateFile, 'utf8').trim(), 'target');
    const env = fs.readFileSync(fixture.envFile, 'utf8');
    assert.equal(fs.statSync(fixture.envFile).mode & 0o777, 0o640, 'runtime env permissions must be retained');
    assert.equal((env.match(/^ACT_KNOWLEDGE_DEPLOYMENT_MODE=/gmu) ?? []).length, 1);
    assert.match(env, /^CUSTOM_KEEP=retained$/mu);
    assert.match(env, /^ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover$/mu);
    const receipt = JSON.parse(fs.readFileSync(fixture.receipt, 'utf8'));
    assert.equal(receipt.result, 'SUCCEEDED');
    assert.equal(receipt.mode.before, 'duplicate');
    assert.equal(receipt.mode.after, 'cutover');
    assert.equal(receipt.finalAppImageDigest, targetDigest);
    assert.equal(receipt.finalWorkerImageDigest, targetDigest);
    assert.equal(receipt.protectedControlPlane.pre.protectedDigest, receipt.protectedControlPlane.post.protectedDigest);
    assert.doesNotMatch(JSON.stringify(receipt), new RegExp(fixture.project.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
    assert.doesNotMatch(JSON.stringify(receipt), /CUSTOM_KEEP|retained/u);
    const duplicate = runOperator(fixture, { STATE_FILE: fixture.stateFile });
    assert.notEqual(duplicate.status, 0, 'existing refresh receipt must be non-overwritable');

    const nextRefreshId = 'refresh-success-next';
    const next = runOperator(
      fixture,
      { STATE_FILE: fixture.stateFile, FAIL_TARGET: '0' },
      { refreshId: nextRefreshId },
    );
    assert.equal(next.status, 0, `${next.stdout}\n${next.stderr}`);
    assert.equal(fs.readFileSync(fixture.stateFile, 'utf8').trim(), 'target');
    const nextReceipt = JSON.parse(
      fs.readFileSync(
        path.join(fixture.project, 'data/runtime/knowledge-cutover/app-refresh', `${nextRefreshId}.json`),
        'utf8',
      ),
    );
    assert.equal(nextReceipt.result, 'SUCCEEDED');
    assert.equal(nextReceipt.previousAppWorkerImageDigest, targetDigest);
    assert.deepEqual(
      protectedPaths.map((filePath) => sha256File(filePath)),
      protectedBefore,
      'a later refresh must leave the first cutover control plane unchanged',
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function testMissingAndLegacyModesNormalize() {
  for (const mode of ['missing', 'legacy', 'cutover']) {
    const fixture = createFixture(`mode-${mode}`, { mode });
    try {
      const result = runOperator(fixture, { STATE_FILE: fixture.stateFile });
      assert.equal(result.status, 0, `${mode}: ${result.stdout}\n${result.stderr}`);
      const receipt = JSON.parse(fs.readFileSync(fixture.receipt, 'utf8'));
      assert.equal(receipt.mode.before, mode);
      assert.equal(receipt.mode.after, 'cutover');
      assert.equal((fs.readFileSync(fixture.envFile, 'utf8').match(/^ACT_KNOWLEDGE_DEPLOYMENT_MODE=/gmu) ?? []).length, 1);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  }
}

function testPreflightAndRecoveryGuards() {
  const missing = createFixture('missing-marker', { marker: false });
  try {
    const result = runOperator(missing, { STATE_FILE: missing.stateFile });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(missing.stateFile, 'utf8').trim(), 'previous');
    assert.equal(JSON.parse(fs.readFileSync(missing.receipt, 'utf8')).result, 'FAILED');
  } finally {
    fs.rmSync(missing.root, { recursive: true, force: true });
  }

  const controlPlaneMutations = [
    ['missing-receipt', (fixture) => fs.rmSync(path.join(fixture.markerRoot, `${transactionId}.json`), { force: true })],
    ['missing-journal', (fixture) => fs.rmSync(path.join(fixture.journalRoot, `${transactionId}.json`), { force: true })],
    ['missing-selector', (fixture) => fs.rmSync(fixture.selectorPaths.authority, { force: true })],
    ['drift-marker', (fixture) => {
      const markerPath = path.join(fixture.markerRoot, 'current.json');
      const value = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      value.imageTarSha256 = 'e'.repeat(64);
      fs.writeFileSync(markerPath, `${JSON.stringify(value)}\n`);
    }],
    ['drift-receipt', (fixture) => {
      const receiptPath = path.join(fixture.markerRoot, `${transactionId}.json`);
      const value = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      value.captureRevision = 'e'.repeat(40);
      fs.writeFileSync(receiptPath, `${JSON.stringify(value)}\n`);
    }],
    ['drift-journal', (fixture) => {
      const journalPath = path.join(fixture.journalRoot, `${transactionId}.json`);
      const value = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
      value.status = 'FAILED';
      fs.writeFileSync(journalPath, `${JSON.stringify(value)}\n`);
    }],
    ['drift-selector', (fixture) => {
      const projectionPath = fixture.selectorPaths.projection;
      const value = JSON.parse(fs.readFileSync(projectionPath, 'utf8'));
      value.projectionHash = 'e'.repeat(64);
      fs.writeFileSync(projectionPath, `${JSON.stringify(value)}\n`);
    }],
    ['consumer-not-ready', (fixture) => {
      const current = JSON.parse(fs.readFileSync(fixture.selectorPaths.consumer, 'utf8'));
      const activationPath = path.join(
        fixture.project,
        'course-content/runtime/knowledge/consumer-activation/releases',
        current.activationId,
        'activation.json',
      );
      const activation = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
      activation.consumers[0].status = 'BLOCKED';
      fs.writeFileSync(activationPath, `${JSON.stringify(activation)}\n`);
    }],
  ];
  for (const [name, mutate] of controlPlaneMutations) {
    const fixture = createFixture(name);
    try {
      mutate(fixture);
      const result = runOperator(fixture, { STATE_FILE: fixture.stateFile });
      assert.notEqual(result.status, 0, `${name} must fail closed`);
      assert.equal(fs.readFileSync(fixture.stateFile, 'utf8').trim(), 'previous', `${name} must not stop consumers`);
      assert.equal(JSON.parse(fs.readFileSync(fixture.receipt, 'utf8')).result, 'FAILED');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  }

  const mixed = createFixture('mixed-mode');
  try {
    const result = runOperator(mixed, { STATE_FILE: mixed.stateFile, MIXED_MODE: '1' });
    assert.notEqual(result.status, 0, 'mixed app/worker mode must be rejected');
    assert.equal(fs.readFileSync(mixed.stateFile, 'utf8').trim(), 'previous');
  } finally {
    fs.rmSync(mixed.root, { recursive: true, force: true });
  }

  const mixedDigest = createFixture('mixed-digest');
  try {
    const result = runOperator(mixedDigest, { STATE_FILE: mixedDigest.stateFile, MIXED_DIGEST: '1' });
    assert.notEqual(result.status, 0, 'mixed app/worker image digest must be rejected');
    assert.equal(fs.readFileSync(mixedDigest.stateFile, 'utf8').trim(), 'previous');
  } finally {
    fs.rmSync(mixedDigest.root, { recursive: true, force: true });
  }

  const wrongImageId = createFixture('wrong-image-id');
  try {
    const result = runOperator(wrongImageId, {
      STATE_FILE: wrongImageId.stateFile,
      IMAGE_ID_BAD: '1',
    });
    assert.notEqual(result.status, 0, 'an incorrect loaded image Id must be rejected');
    assert.equal(fs.readFileSync(wrongImageId.stateFile, 'utf8').trim(), 'previous');
    assert.equal(JSON.parse(fs.readFileSync(wrongImageId.receipt, 'utf8')).result, 'FAILED');
  } finally {
    fs.rmSync(wrongImageId.root, { recursive: true, force: true });
  }

  const failed = createFixture('replace-failure');
  try {
    const result = runOperator(failed, { STATE_FILE: failed.stateFile, FAIL_TARGET: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(failed.stateFile, 'utf8').trim(), 'previous', 'replace failure must recover the preceding digest');
    const receipt = JSON.parse(fs.readFileSync(failed.receipt, 'utf8'));
    assert.equal(receipt.result, 'FAILED');
    assert.equal(receipt.mode.after, 'cutover');
    assert.equal(receipt.previousAppWorkerImageDigest, previousDigest);
    assert.equal(receipt.finalAppImageDigest, previousDigest);
    assert.equal(receipt.finalWorkerImageDigest, previousDigest);
  } finally {
    fs.rmSync(failed.root, { recursive: true, force: true });
  }
}

testStaticContracts();
testPersistedCutoverModePriority();
testSuccessfulRefresh();
testMissingAndLegacyModesNormalize();
testPreflightAndRecoveryGuards();
console.log('cutover-aware application refresh test passed');
