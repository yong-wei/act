import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const tool = path.join(root, 'scripts', 'knowledge-cutover', 'production-cutover.ts');
const revision = '58f70df257f493f7dc13b2dabfb0383b972ee017';
const imageTag = 'localhost/act-obe-platform:v0.4.0-58f70df';
const imageTar = path.join(root, 'deploy', 'images', 'act-obe-v0.4.0-58f70df.tar');
const remoteActivator = path.join(root, 'scripts', 'remote-activate-knowledge-cutover.sh');

function imageConfigDigest(archive) {
  const read = (entry) => execFileSync('tar', ['-xOf', archive, entry]);
  const index = JSON.parse(read('index.json').toString('utf8'));
  assert.equal(index.manifests.length, 1, 'fixture image must contain exactly one manifest');
  const manifestDigest = index.manifests[0].digest;
  const manifest = JSON.parse(
    read(`blobs/sha256/${manifestDigest.slice('sha256:'.length)}`).toString('utf8'),
  );
  const configDigest = manifest.config.digest;
  assert.equal(
    `sha256:${createHash('sha256').update(read(`blobs/sha256/${configDigest.slice('sha256:'.length)}`)).digest('hex')}`,
    configDigest,
    'fixture image config bytes must match its OCI digest',
  );
  return configDigest;
}

function sha256File(filePath) {
  const command = process.platform === 'darwin' ? 'shasum' : 'sha256sum';
  const args = command === 'shasum' ? ['-a', '256', filePath] : [filePath];
  return execFileSync(command, args, { encoding: 'utf8' }).trim().split(/\s+/u)[0];
}

function run(args, env = {}) {
  return spawnSync(tsx, [tool, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_REVISION: revision,
      ...env,
    },
  });
}

function copyFile(relativePath, fixtureRoot) {
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, relativePath), target);
}

function createFixture(plan, name) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), `production-cutover-${name}-`));
  for (const file of plan.files) copyFile(file.path, fixtureRoot);
  return fixtureRoot;
}

function pointerPath(fixtureRoot, plan, component) {
  const pointer = plan.pointers.find((entry) => entry.component === component);
  assert.ok(pointer, `missing ${component} pointer`);
  return path.join(fixtureRoot, pointer.path);
}

function driverEnv(fixtureRoot) {
  return {
    ACT_AUTHORITY_STORE_ROOT: path.join(
      fixtureRoot,
      'course-content/authoring/knowledge/authority',
    ),
    ACT_CONSUMER_ACTIVATION_ROOT: path.join(
      fixtureRoot,
      'course-content/runtime/knowledge/consumer-activation',
    ),
  };
}

function expectFailure(result, expression, message) {
  assert.notEqual(result.status, 0, message);
  assert.match(`${result.stdout}\n${result.stderr}`, expression, message);
}

function main() {
  assert.ok(fs.existsSync(tsx), 'tsx runtime must be available for production cutover tests');
  assert.ok(fs.existsSync(imageTar), 'frozen v0.4.0 OCI image tar must be available');
  const remoteActivatorSource = fs.readFileSync(remoteActivator, 'utf8');
  assert.match(
    remoteActivatorSource,
    /oci_image_config_digest\(\)[\s\S]*--image-config-digest "\$image_config_digest"/u,
    'remote activation must derive and seal the OCI config digest from the frozen tar',
  );
  assert.match(
    remoteActivatorSource,
    /podman image inspect "\$image_tag" --format '\{\{\.Id\}\}'[\s\S]*image_config_digest/u,
    'remote activation must compare the loaded image ID with the sealed OCI config digest',
  );
  assert.match(
    remoteActivatorSource,
    /podman inspect "\$container" --format '\{\{\.Image\}\}'[\s\S]*OCI config digest/u,
    'post-cutover containers must be checked against the sealed OCI config digest',
  );
  const ociDigestHelper = remoteActivatorSource.slice(
    remoteActivatorSource.indexOf('oci_image_config_digest()'),
    remoteActivatorSource.indexOf('safe_remote_value()'),
  );
  assert.doesNotMatch(
    ociDigestHelper,
    /<<['"]?NODE/u,
    'RTK 包装的部署脚本不得在 OCI digest command substitution 中写 Node heredoc',
  );
  const configDigest = imageConfigDigest(imageTar);
  const helperResult = spawnSync(
    'bash',
    ['-c', `${ociDigestHelper}\noci_image_config_digest "$1"`, 'bash', imageTar],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(helperResult.status, 0, helperResult.stderr);
  assert.equal(helperResult.stdout, configDigest, 'OCI helper must resolve the frozen image config digest');
  const tarSha256 = sha256File(imageTar);
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'production-cutover-plan-'));
  try {
    const planPath = path.join(workRoot, 'plan.json');
    const transactionId = 'test-production-cutover';
    const planResult = run([
      'plan',
      '--repo-root',
      root,
      '--output',
      planPath,
      '--transaction-id',
      transactionId,
      '--release-tag',
      'v0.4.0',
      '--image-revision',
      revision,
      '--image-tag',
      imageTag,
      '--image-config-digest',
      configDigest,
      '--image-tar-sha256',
      tarSha256,
      '--deployment-script',
      path.join(root, 'deploy', 'podman', 'deploy.sh'),
    ]);
    assert.equal(planResult.status, 0, planResult.stderr);
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.equal(plan.pointers.length, 4, 'plan must seal every current pointer');
    assert.equal(plan.files.length > 0, true, 'plan must seal staged artifacts');
    assert.equal(plan.source.imageConfigDigest, configDigest, 'plan must bind the exact OCI config digest');
    assert.equal(plan.source.imageTarSha256, tarSha256, 'plan must bind the frozen image tar hash');

    const driftFixture = createFixture(plan, 'drift');
    try {
      const drifted = plan.files.find((file) => file.group === 'authority');
      assert.ok(drifted, 'plan must seal an Authority artifact');
      fs.appendFileSync(path.join(driftFixture, drifted.path), '\n');
      const result = run(
        ['activate', '--root', driftFixture, '--plan', planPath],
        driverEnv(driftFixture),
      );
      expectFailure(result, /sealed artifact hash mismatch/u, 'artifact drift must fail before activation');
      for (const pointer of plan.pointers) {
        assert.equal(fs.existsSync(path.join(driftFixture, pointer.path)), false);
      }
    } finally {
      fs.rmSync(driftFixture, { recursive: true, force: true });
    }

    const nonAbsentFixture = createFixture(plan, 'non-absent');
    try {
      const authorityPointer = pointerPath(nonAbsentFixture, plan, 'authority');
      fs.mkdirSync(path.dirname(authorityPointer), { recursive: true });
      fs.writeFileSync(authorityPointer, '{}\n');
      const result = run(
        ['activate', '--root', nonAbsentFixture, '--plan', planPath],
        driverEnv(nonAbsentFixture),
      );
      expectFailure(
        result,
        /first activation requires absent pointer: authority/u,
        'one present pointer must reject first activation',
      );
      assert.equal(
        fs.existsSync(
          path.join(
            nonAbsentFixture,
            'course-content/runtime/knowledge/production-cutover-transactions',
          ),
        ),
        false,
        'all-ABSENT rejection must occur before the production receipt is created',
      );
    } finally {
      fs.rmSync(nonAbsentFixture, { recursive: true, force: true });
    }

    const activeFixture = createFixture(plan, 'active');
    try {
      const env = driverEnv(activeFixture);
      const activation = run(
        ['activate', '--root', activeFixture, '--plan', planPath],
        env,
      );
      assert.equal(activation.status, 0, activation.stderr);
      const journalPath = path.join(
        activeFixture,
        'course-content/runtime/knowledge/consumer-activation/first-activation-transactions',
        `${transactionId}.json`,
      );
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
      assert.deepEqual(
        journal.steps.map((step) => step.component),
        ['authority', 'projection', 'prerequisite', 'consumer-activation'],
        'production activation must retain consumer-last order',
      );
      assert.deepEqual(
        journal.steps.map((step) => step.status),
        ['APPLIED', 'APPLIED', 'APPLIED', 'APPLIED'],
      );
      for (const pointer of plan.pointers) {
        assert.equal(fs.existsSync(path.join(activeFixture, pointer.path)), true);
      }

      const verified = run(
        ['verify', '--root', activeFixture, '--plan', planPath],
        env,
      );
      assert.equal(verified.status, 0, verified.stderr);

      const markerPath = path.join(
        activeFixture,
        'course-content/runtime/knowledge/production-cutover-transactions/current.json',
      );
      const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      marker.transactionId = 'foreign-production-cutover';
      fs.writeFileSync(markerPath, `${JSON.stringify(marker)}\n`);
      const markerDriftRollback = run(
        ['rollback', '--root', activeFixture, '--plan', planPath],
        env,
      );
      expectFailure(
        markerDriftRollback,
        /production cutover marker mismatch/u,
        'rollback must validate marker ownership before mutating any selector',
      );
      for (const pointer of plan.pointers) {
        assert.equal(
          fs.existsSync(path.join(activeFixture, pointer.path)),
          true,
          'foreign marker must retain every selected pointer',
        );
      }
      marker.transactionId = transactionId;
      fs.writeFileSync(markerPath, `${JSON.stringify(marker)}\n`);

      const consumerPointer = pointerPath(activeFixture, plan, 'consumer-activation');
      const forgedPointer = JSON.parse(fs.readFileSync(consumerPointer, 'utf8'));
      forgedPointer.activationId = 'foreign-activation';
      forgedPointer.activationHash = '0'.repeat(64);
      fs.writeFileSync(consumerPointer, `${JSON.stringify(forgedPointer)}\n`);
      const rollback = run(
        ['rollback', '--root', activeFixture, '--plan', planPath],
        env,
      );
      expectFailure(
        rollback,
        /rollback drift at consumer-activation/u,
        'rollback must not delete a pointer that belongs to another activation',
      );
      assert.equal(
        fs.existsSync(markerPath),
        true,
        'failed identity-constrained rollback must retain the production marker',
      );
    } finally {
      fs.rmSync(activeFixture, { recursive: true, force: true });
    }

    process.stdout.write('production knowledge cutover transaction tests passed\n');
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true });
  }
}

main();
