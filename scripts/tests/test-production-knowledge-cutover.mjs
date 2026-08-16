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
const operatorSourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const imageTag = 'localhost/act-obe-platform:v0.4.0-58f70df';
const imageTar = process.env.ACT_TEST_PRODUCTION_IMAGE_TAR
  ?? path.join(root, 'deploy', 'images', 'act-obe-v0.4.0-58f70df.tar');
const containerRuntime = process.env.ACT_TEST_CONTAINER_RUNTIME ?? null;
const containerImage = process.env.ACT_TEST_CONTAINER_IMAGE ?? imageTag;
const remoteActivator = path.join(root, 'scripts', 'remote-activate-knowledge-cutover.sh');
const remoteOperator = path.join(root, 'scripts', 'knowledge-cutover', 'remote-production-cutover.sh');
const operatorBundleHelper = path.join(root, 'scripts', 'knowledge-cutover', 'create-operator-bundle.mjs');
const cleanupEngine = path.join(root, 'scripts', 'knowledge-cutover', 'cleanup-failed-authority-identity.cjs');
const AUTHORITY_PREFIX = 'course-content/authoring/knowledge/authority/';
const SHARD_PREFIX = 'course-content/runtime/knowledge/authority-domain-shards/';
const PLAN_CONTRACT = 'act-production-knowledge-cutover-plan/v2';

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

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  const command = process.platform === 'darwin' ? 'shasum' : 'sha256sum';
  const args = command === 'shasum' ? ['-a', '256', filePath] : [filePath];
  return execFileSync(command, args, { encoding: 'utf8' }).trim().split(/\s+/u)[0];
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  throw new Error('unsupported canonical JSON value');
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

function runBundledContainer(action, fixtureRoot, planPath, bundleRoot, bundleManifest) {
  assert.ok(containerRuntime, 'container runtime must be configured for bundled driver verification');
  return spawnSync(containerRuntime, [
    'run', '--rm', '--network', 'none', '--user', '0',
    '-e', `APP_REVISION=${revision}`,
    '-e', 'ACT_AUTHORITY_STORE_ROOT=/activation-root/course-content/authoring/knowledge/authority',
    '-e', 'ACT_CONSUMER_ACTIVATION_ROOT=/activation-root/course-content/runtime/knowledge/consumer-activation',
    '-v', `${fixtureRoot}:/activation-root:rw`,
    '-v', `${bundleRoot}:/operator-bundle:ro`,
    '-v', `${bundleManifest}:/operator-bundle-manifest.json:ro`,
    '-v', `${planPath}:/activation-plan.json:ro`,
    '--workdir', '/operator-bundle',
    '--entrypoint', '/app/node_modules/.bin/tsx',
    containerImage,
    '--tsconfig', '/operator-bundle/tsconfig.json',
    '/operator-bundle/scripts/knowledge-cutover/production-cutover.ts', action,
    '--root', '/activation-root',
    '--plan', '/activation-plan.json',
    '--bundle-root', '/operator-bundle',
    '--bundle-manifest', '/operator-bundle-manifest.json',
  ], {
    cwd: root,
    encoding: 'utf8',
  });
}

function copyFile(relativePath, fixtureRoot) {
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, relativePath), target);
}

function fileTreeFingerprint(directory) {
  const entries = [];
  const visit = (current, relative) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const next = path.join(current, entry.name);
      const nested = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(next, nested);
      else if (entry.isFile()) entries.push([nested, sha256File(next)]);
      else throw new Error(`unsupported shard runtime entry: ${nested}`);
    }
  };
  visit(directory, '');
  return entries;
}

function createFixture(plan, name, options = {}) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), `production-cutover-${name}-`));
  const shardPrefix = `${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}/`;
  for (const file of plan.files) {
    if (!file.path.startsWith(shardPrefix)) copyFile(file.path, fixtureRoot);
  }
  if (options.shardSetSource) {
    fs.cpSync(
      options.shardSetSource,
      path.join(fixtureRoot, `${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}`),
      { recursive: true },
    );
  }
  if (options.operatorBundleSource) {
    fs.cpSync(
      options.operatorBundleSource,
      path.join(fixtureRoot, 'operator-bundle'),
      { recursive: true },
    );
    fs.copyFileSync(
      options.operatorBundleManifest,
      path.join(fixtureRoot, 'operator-bundle.manifest.json'),
    );
  }
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

function writePreparedReceipt(fixtureRoot, plan, overrides = {}) {
  const receipt = {
    contract: 'act-production-knowledge-cutover-receipt/v1',
    transactionId: plan.transactionId,
    planHash: plan.planHash,
    applicationSourceRevision: plan.source.applicationSourceRevision,
    imageConfigDigest: plan.source.imageConfigDigest,
    imageTarSha256: plan.source.imageTarSha256,
    imageProvenanceSha256: plan.source.imageProvenanceSha256,
    operatorSourceRevision: plan.source.operatorSourceRevision,
    operatorSourceTree: plan.source.operatorSourceTree,
    captureRevision: plan.source.captureRevision,
    status: 'PREPARED',
    preparedAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
  const receiptPath = path.join(
    fixtureRoot,
    'course-content/runtime/knowledge/production-cutover-transactions',
    `${plan.transactionId}.json`,
  );
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
}

function writePreparedJournal(fixtureRoot, plan) {
  const body = {
    contract: 'actkg-to-act-first-activation-journal/v2',
    transactionId: plan.transactionId,
    createdAt: '2026-08-13T00:00:00.000Z',
    status: 'PREPARED',
    prestate: 'ALL_POINTERS_ABSENT',
    steps: plan.pointers.map((pointer) => ({
      component: pointer.component,
      pointer: { kind: 'repo-relative', path: pointer.path },
      target: { component: pointer.component, id: pointer.id, hash: pointer.hash },
      status: 'PENDING',
    })),
    failure: null,
  };
  const journalPath = path.join(
    fixtureRoot,
    'course-content/runtime/knowledge/consumer-activation/first-activation-transactions',
    `${plan.transactionId}.json`,
  );
  fs.mkdirSync(path.dirname(journalPath), { recursive: true });
  fs.writeFileSync(
    journalPath,
    `${JSON.stringify({ ...body, journalHash: sha256Bytes(canonicalJson(body)) }, null, 2)}\n`,
  );
  return journalPath;
}

function expectFailure(result, expression, message) {
  assert.notEqual(result.status, 0, message);
  assert.match(`${result.stdout}\n${result.stderr}`, expression, message);
}

function writeSealedCleanupPlan(planPath, transactionId, authorityFiles) {
  const body = {
    contract: PLAN_CONTRACT,
    transactionId,
    createdAt: '2026-08-11T00:00:00.000Z',
    source: {
      releaseTag: 'v0.4.0',
      applicationSourceRevision: revision,
      imageTag,
      imageConfigDigest: `sha256:${'a'.repeat(64)}`,
      imageTarSha256: 'b'.repeat(64),
      imageProvenanceSha256: '9'.repeat(64),
      operatorSourceRevision,
      operatorSourceTree: '8'.repeat(40),
      captureRevision: revision,
      toolSha256: 'c'.repeat(64),
      deploymentScriptSha256: 'd'.repeat(64),
      cleanupEngineSha256: sha256File(cleanupEngine),
    },
    authority: {
      snapshotId: 'snap-test',
      snapshotHash: 'e'.repeat(64),
      releaseId: 'release-test',
      releaseSetId: 'set-test',
      releaseHash: 'f'.repeat(64),
    },
    projection: {
      projectionId: 'proj-test',
      projectionHash: '1'.repeat(64),
    },
    prerequisite: {
      publicationId: 'pub-test',
      publicationHash: '2'.repeat(64),
    },
    activation: {
      activationId: 'act-test',
      activationHash: '3'.repeat(64),
      readyConsumerIds: [
        'engineering-graph',
        'engineering-rag',
        'course-runtime',
        'konling',
        'teaching-resource-rag',
        'learning-path',
      ],
    },
    localFirstActivationReportSha256: '4'.repeat(64),
    pointers: [
      {
        component: 'authority',
        path: 'course-content/authoring/knowledge/authority/current.json',
        id: 'snap-test',
        hash: 'e'.repeat(64),
        sourcePointerSha256: '5'.repeat(64),
      },
      {
        component: 'projection',
        path: 'course-content/runtime/knowledge/projection/current.json',
        id: 'proj-test',
        hash: '1'.repeat(64),
        sourcePointerSha256: '6'.repeat(64),
      },
      {
        component: 'prerequisite',
        path: 'course-content/runtime/knowledge/prerequisites/current.json',
        id: 'pub-test',
        hash: '2'.repeat(64),
        sourcePointerSha256: '7'.repeat(64),
      },
      {
        component: 'consumer-activation',
        path: 'course-content/runtime/knowledge/consumer-activation/current.json',
        id: 'act-test',
        hash: '3'.repeat(64),
        sourcePointerSha256: '8'.repeat(64),
      },
    ],
    files: authorityFiles,
  };
  const plan = {
    ...body,
    planHash: sha256Bytes(canonicalJson(body)),
  };
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  return plan;
}

function isAppleDoubleRelativePath(relativePath) {
  return path.posix.basename(relativePath).startsWith('._');
}

function sealedAuthorityFiles() {
  return {
    'releases/snap-test/manifest.json': '{"ok":true}\n',
    'activations/failed.json': '{"failed":true}\n',
  };
}

function failureStyleAppleDoubleFiles() {
  return {
    '._.': 'root-ad\n',
    '._activations': 'act-ad\n',
    '._releases': 'rel-ad\n',
    'releases/._snap-test': 'snap-ad\n',
  };
}

function materializeAuthorityTree(authorityRoot, relativeFiles) {
  for (const [relativePath, contents] of Object.entries(relativeFiles)) {
    const fullPath = path.join(authorityRoot, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents);
  }
}

function createAuthorityArchive(archivePath, relativeFiles) {
  // Use Python tarfile so AppleDouble members are preserved on macOS bsdtar hosts.
  const payload = Object.fromEntries(
    Object.entries(relativeFiles).map(([relativePath, contents]) => [
      relativePath,
      Buffer.from(contents).toString('base64'),
    ]),
  );
  execFileSync(
    'python3',
    [
      '-c',
      `
import base64, io, json, tarfile, sys
files = json.loads(sys.argv[1])
out = sys.argv[2]
with tarfile.open(out, "w:gz") as archive:
    for name, b64 in sorted(files.items()):
        raw = base64.b64decode(b64.encode("ascii"))
        info = tarfile.TarInfo(name=name)
        info.size = len(raw)
        archive.addfile(info, io.BytesIO(raw))
`,
      JSON.stringify(payload),
      archivePath,
    ],
    { encoding: 'utf8' },
  );
  return Object.entries(relativeFiles)
    .filter(([relativePath]) => !isAppleDoubleRelativePath(relativePath))
    .map(([relativePath, contents]) => ({
      path: `${AUTHORITY_PREFIX}${relativePath}`,
      sha256: sha256Bytes(contents),
      size: Buffer.byteLength(contents),
      group: 'authority',
    }));
}

function stageCleanupTransaction(projectDir, transactionId, archiveFiles) {
  const stage = path.join(projectDir, 'data/runtime/knowledge-cutover/staging', transactionId);
  fs.mkdirSync(stage, { recursive: true });
  const archivePath = path.join(stage, 'authority.tar.gz');
  const digests = createAuthorityArchive(archivePath, archiveFiles);
  writeSealedCleanupPlan(path.join(stage, 'plan.json'), transactionId, digests);
  return { stage, archivePath, digests };
}

function runCleanup(projectDir, stage, transactionId) {
  const stagedEngine = path.join(stage, 'cleanup-failed-authority-identity.cjs');
  if (!fs.existsSync(stagedEngine)) {
    fs.copyFileSync(cleanupEngine, stagedEngine);
  }
  return spawnSync(
    'bash',
    [
      remoteOperator,
      'cleanup-failed-authority',
      projectDir,
      stage,
      transactionId,
      sha256File(cleanupEngine),
    ],
    { cwd: root, encoding: 'utf8' },
  );
}

function prepareCleanupProject(name) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), `cleanup-authority-${name}-`));
  const authorityRoot = path.join(projectDir, 'course-content/authoring/knowledge/authority');
  fs.mkdirSync(authorityRoot, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'course-content/runtime/knowledge/projection'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(projectDir, 'course-content/runtime/knowledge/prerequisites'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(projectDir, 'course-content/runtime/knowledge/consumer-activation'), {
    recursive: true,
  });
  fs.mkdirSync(path.join(projectDir, 'course-content/runtime/knowledge/production-cutover-transactions'), {
    recursive: true,
  });
  return { projectDir, authorityRoot };
}

function assertAuthorityPathRetained(authorityRoot, relativePath) {
  assert.equal(
    fs.existsSync(path.join(authorityRoot, relativePath)),
    true,
    `rejected cleanup must retain ${relativePath}`,
  );
}

function assertNoSuccessReceipt(stage) {
  assert.equal(
    fs.existsSync(path.join(stage, 'failed-authority-cleanup.json')),
    false,
    'failed cleanup must not write success receipt',
  );
}

function testCleanupFailedAuthorityGuards() {
  const transactionId = 'production-v040-58f70df-20260811T120000Z';
  const sealed = sealedAuthorityFiles();
  const appleDouble = failureStyleAppleDoubleFiles();
  const matchingTree = { ...sealed, ...appleDouble };

  const operatorSource = fs.readFileSync(remoteOperator, 'utf8');
  const engineSource = fs.readFileSync(cleanupEngine, 'utf8');
  assert.doesNotMatch(
    operatorSource.slice(
      operatorSource.indexOf('run_cleanup_failed_authority()'),
      operatorSource.indexOf('run_activate()'),
    ),
    /rm\s+-rf\b/u,
    'production cleanup must not use rm -rf',
  );
  assert.match(
    operatorSource,
    /\.production-cutover-operator\.lock/u,
    'cleanup/activate must share an independent production operator lock',
  );
  assert.match(
    engineSource,
    /fs\.unlinkSync|unlinkSync/u,
    'cleanup must delete expected files via per-file unlink',
  );
  assert.match(
    engineSource,
    /fs\.rmdirSync|rmdirSync/u,
    'cleanup must remove directories via reverse-depth rmdir',
  );
  const cleanupBody = operatorSource.slice(
    operatorSource.indexOf('run_cleanup_failed_authority()'),
    operatorSource.indexOf('\nrun_activate()'),
  );
  assert.ok(
    cleanupBody.indexOf('lock_dir="$(acquire_production_operator_lock') <
      cleanupBody.indexOf('for pointer in'),
    'cleanup must acquire its exclusive lock before checking mutable transaction state',
  );

  // Counterexample: arbitrary empty stage + fake transactionId must not wipe Authority residual.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('arbitrary-stage');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const arbitraryStage = fs.mkdtempSync(path.join(os.tmpdir(), 'arbitrary-stage-'));
      try {
        const result = runCleanup(projectDir, arbitraryStage, transactionId);
        expectFailure(
          result,
          /canonical stage path/u,
          'cleanup must reject an arbitrary non-canonical stage path',
        );
        assertAuthorityPathRetained(authorityRoot, 'activations/failed.json');
        assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/manifest.json');
      } finally {
        fs.rmSync(arbitraryStage, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Canonical stage without sealed plan/archive must refuse cleanup.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('missing-plan');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const stage = path.join(
        projectDir,
        'data/runtime/knowledge-cutover/staging',
        transactionId,
      );
      fs.mkdirSync(stage, { recursive: true });
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /sealed plan\.json|authority\.tar\.gz/u,
        'cleanup must require sealed plan and archive in the canonical stage',
      );
      assertAuthorityPathRetained(authorityRoot, 'activations/failed.json');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Sealed plan for another transaction id must refuse cleanup.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('mismatched-plan');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const stage = path.join(projectDir, 'data/runtime/knowledge-cutover/staging', transactionId);
      fs.mkdirSync(stage, { recursive: true });
      const digests = createAuthorityArchive(path.join(stage, 'authority.tar.gz'), matchingTree);
      writeSealedCleanupPlan(path.join(stage, 'plan.json'), 'other-transaction-id', digests);
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /transactionId mismatch|exact identity validation/u,
        'cleanup must reject a sealed plan owned by another transaction',
      );
      assertAuthorityPathRetained(authorityRoot, 'activations/failed.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Historical journals are retained with runtime releases and do not make a
  // pre-journal Authority extraction active when every selector is absent.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('foreign-journal');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const { stage } = stageCleanupTransaction(projectDir, transactionId, matchingTree);
      const journalDir = path.join(
        projectDir,
        'course-content/runtime/knowledge/consumer-activation/first-activation-transactions',
      );
      fs.mkdirSync(journalDir, { recursive: true });
      const foreignJournal = path.join(journalDir, 'foreign-transaction.json');
      fs.writeFileSync(foreignJournal, '{"foreign":true}\n');
      const foreignReceipt = path.join(
        projectDir,
        'course-content/runtime/knowledge/production-cutover-transactions/foreign-transaction.json',
      );
      fs.writeFileSync(foreignReceipt, '{"foreign":true}\n');
      const result = runCleanup(projectDir, stage, transactionId);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(fs.readdirSync(authorityRoot).length, 0);
      assert.equal(fs.existsSync(foreignJournal), true, 'cleanup must retain historical journal evidence');
      assert.equal(fs.existsSync(foreignReceipt), true, 'cleanup must retain historical receipt evidence');
      assert.equal(fs.existsSync(path.join(stage, 'failed-authority-cleanup.json')), true);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // A journal attributed to the failed transaction must still refuse cleanup.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('same-journal');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const { stage } = stageCleanupTransaction(projectDir, transactionId, matchingTree);
      const journalDir = path.join(
        projectDir,
        'course-content/runtime/knowledge/consumer-activation/first-activation-transactions',
      );
      fs.mkdirSync(journalDir, { recursive: true });
      fs.writeFileSync(path.join(journalDir, `${transactionId}.json`), '{"same":true}\n');
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /same-transaction residue/u,
        'cleanup must refuse a journal attributed to the failed transaction',
      );
      assertAuthorityPathRetained(authorityRoot, 'activations/failed.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // A receipt attributed to the failed transaction must also refuse cleanup.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('same-receipt');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const { stage } = stageCleanupTransaction(projectDir, transactionId, matchingTree);
      const receipt = path.join(
        projectDir,
        'course-content/runtime/knowledge/production-cutover-transactions',
        `${transactionId}.json`,
      );
      fs.writeFileSync(receipt, '{"same":true}\n');
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /same-transaction residue/u,
        'cleanup must refuse a receipt attributed to the failed transaction',
      );
      assertAuthorityPathRetained(authorityRoot, 'activations/failed.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Accepted review counterexample: sealed archive only has snap-test, host also has foreign nested file.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('foreign-nested');
    try {
      materializeAuthorityTree(authorityRoot, {
        ...sealed,
        'releases/foreign/manifest.json': '{"foreign":true}\n',
      });
      const { stage } = stageCleanupTransaction(projectDir, transactionId, sealed);
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /unexpected path|foreign/u,
        'cleanup must reject host foreign nested Authority content',
      );
      assertAuthorityPathRetained(authorityRoot, 'releases/foreign/manifest.json');
      assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/manifest.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Archive contains extra unsealed ordinary member (not present in sealed plan).
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('archive-extra');
    try {
      materializeAuthorityTree(authorityRoot, sealed);
      const stage = path.join(projectDir, 'data/runtime/knowledge-cutover/staging', transactionId);
      fs.mkdirSync(stage, { recursive: true });
      const sealedDigests = Object.entries(sealed).map(([relativePath, contents]) => ({
        path: `${AUTHORITY_PREFIX}${relativePath}`,
        sha256: sha256Bytes(contents),
        size: Buffer.byteLength(contents),
        group: 'authority',
      }));
      writeSealedCleanupPlan(path.join(stage, 'plan.json'), transactionId, sealedDigests);
      createAuthorityArchive(path.join(stage, 'authority.tar.gz'), {
        ...sealed,
        'releases/extra.json': '{"extra":true}\n',
      });
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /unsealed non-metadata regular file/u,
        'cleanup must reject archive extra non-metadata members',
      );
      assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/manifest.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Archive may not carry an unsealed empty directory merely because the host has it too.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('archive-extra-directory');
    try {
      materializeAuthorityTree(authorityRoot, sealed);
      fs.mkdirSync(path.join(authorityRoot, 'releases', 'foreign'), { recursive: true });
      const stage = path.join(projectDir, 'data/runtime/knowledge-cutover/staging', transactionId);
      fs.mkdirSync(stage, { recursive: true });
      const archivePath = path.join(stage, 'authority.tar.gz');
      execFileSync(
        'python3',
        [
          '-c',
          `
import io, tarfile, sys
out = sys.argv[1]
with tarfile.open(out, 'w:gz') as archive:
    for name, payload in [
        ('releases/snap-test/manifest.json', b'{"ok":true}\\n'),
        ('activations/failed.json', b'{"failed":true}\\n'),
    ]:
        info = tarfile.TarInfo(name=name)
        info.size = len(payload)
        archive.addfile(info, io.BytesIO(payload))
    directory = tarfile.TarInfo(name='releases/foreign')
    directory.type = tarfile.DIRTYPE
    archive.addfile(directory)
`,
          archivePath,
        ],
        { encoding: 'utf8' },
      );
      writeSealedCleanupPlan(
        path.join(stage, 'plan.json'),
        transactionId,
        Object.entries(sealed).map(([relativePath, contents]) => ({
          path: `${AUTHORITY_PREFIX}${relativePath}`,
          sha256: sha256Bytes(contents),
          size: Buffer.byteLength(contents),
          group: 'authority',
        })),
      );
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /unsealed directory/u,
        'cleanup must reject archive empty directories outside the sealed Authority identity',
      );
      assert.equal(
        fs.existsSync(path.join(authorityRoot, 'releases', 'foreign')),
        true,
        'cleanup must retain an unsealed host directory',
      );
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Host deep extra ordinary file.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('host-deep-extra');
    try {
      materializeAuthorityTree(authorityRoot, {
        ...sealed,
        'releases/snap-test/deep/extra.json': '{"extra":true}\n',
      });
      const { stage } = stageCleanupTransaction(projectDir, transactionId, sealed);
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /unexpected path/u,
        'cleanup must reject host deep extra ordinary files',
      );
      assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/deep/extra.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Host extra AppleDouble not present in archive.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('host-extra-ad');
    try {
      materializeAuthorityTree(authorityRoot, {
        ...sealed,
        '._activations': 'only-on-host\n',
      });
      const { stage } = stageCleanupTransaction(projectDir, transactionId, sealed);
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /unexpected path/u,
        'cleanup must reject host extra AppleDouble files',
      );
      assertAuthorityPathRetained(authorityRoot, '._activations');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Host orphan metadata (AppleDouble without sealed companion/ancestor in map).
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('orphan-metadata');
    try {
      materializeAuthorityTree(authorityRoot, {
        ...sealed,
        '._orphan': 'orphan\n',
      });
      const { stage } = stageCleanupTransaction(projectDir, transactionId, {
        ...sealed,
        '._orphan': 'orphan\n',
      });
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /AppleDouble is not a sealed-file or sealed-ancestor companion/u,
        'cleanup must reject orphan AppleDouble metadata',
      );
      assertAuthorityPathRetained(authorityRoot, '._orphan');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Host hash mismatch against archive/plan.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('hash-mismatch');
    try {
      materializeAuthorityTree(authorityRoot, {
        'releases/snap-test/manifest.json': '{"ok":false,"tampered":true}\n',
        'activations/failed.json': '{"failed":true}\n',
      });
      const { stage } = stageCleanupTransaction(projectDir, transactionId, sealed);
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /hash mismatch/u,
        'cleanup must reject host/archive hash mismatch',
      );
      assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/manifest.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Host symlink (platform-stable).
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('host-symlink');
    try {
      materializeAuthorityTree(authorityRoot, sealed);
      fs.symlinkSync('manifest.json', path.join(authorityRoot, 'releases/snap-test/link.json'));
      const { stage } = stageCleanupTransaction(projectDir, transactionId, sealed);
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /symlink/u,
        'cleanup must reject host symlinks',
      );
      assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/manifest.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Archive symlink member rejected by parser.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('archive-symlink');
    try {
      materializeAuthorityTree(authorityRoot, sealed);
      const stage = path.join(projectDir, 'data/runtime/knowledge-cutover/staging', transactionId);
      fs.mkdirSync(stage, { recursive: true });
      const archivePath = path.join(stage, 'authority.tar.gz');
      execFileSync(
        'python3',
        [
          '-c',
          `
import io, tarfile, sys
out = sys.argv[1]
with tarfile.open(out, "w:gz") as archive:
    payload = b'{"ok":true}\\n'
    info = tarfile.TarInfo(name="releases/snap-test/manifest.json")
    info.size = len(payload)
    archive.addfile(info, io.BytesIO(payload))
    payload2 = b'{"failed":true}\\n'
    info2 = tarfile.TarInfo(name="activations/failed.json")
    info2.size = len(payload2)
    archive.addfile(info2, io.BytesIO(payload2))
    link = tarfile.TarInfo(name="releases/snap-test/evil-link")
    link.type = tarfile.SYMTYPE
    link.linkname = "manifest.json"
    archive.addfile(link)
`,
          archivePath,
        ],
        { encoding: 'utf8' },
      );
      writeSealedCleanupPlan(
        path.join(stage, 'plan.json'),
        transactionId,
        Object.entries(sealed).map(([relativePath, contents]) => ({
          path: `${AUTHORITY_PREFIX}${relativePath}`,
          sha256: sha256Bytes(contents),
          size: Buffer.byteLength(contents),
          group: 'authority',
        })),
      );
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /symlink|hardlink|special/u,
        'cleanup must reject archive symlink members',
      );
      assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/manifest.json');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Preexisting operator exclusive lock must fail closed without deletion.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('preexisting-lock');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const { stage } = stageCleanupTransaction(projectDir, transactionId, matchingTree);
      const lockDir = path.join(
        projectDir,
        'course-content/runtime/knowledge/.production-cutover-operator.lock',
      );
      fs.mkdirSync(lockDir, { recursive: true });
      fs.writeFileSync(path.join(lockDir, 'owner.pid'), '1\n');
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /operator exclusive lock unavailable/u,
        'cleanup must fail closed when operator lock already exists',
      );
      assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/manifest.json');
      assert.equal(fs.existsSync(lockDir), true, 'cleanup must not steal or rewrite preexisting lock');
      assert.equal(fs.readFileSync(path.join(lockDir, 'owner.pid'), 'utf8'), '1\n');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // A standalone cleanup engine is atomically admitted only after its declared hash matches.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('stage-cleanup-engine');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const { stage } = stageCleanupTransaction(projectDir, transactionId, matchingTree);
      const stagedEngine = path.join(stage, 'cleanup-failed-authority-identity.cjs');
      const stagedTmp = `${stagedEngine}.tmp`;
      fs.copyFileSync(cleanupEngine, stagedTmp);
      const result = spawnSync(
        'bash',
        [
          remoteOperator,
          'stage-cleanup-engine',
          projectDir,
          stage,
          transactionId,
          sha256File(cleanupEngine),
        ],
        { cwd: root, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.equal(fs.existsSync(stagedEngine), true, 'hash-checked cleanup engine must be promoted');
      assert.equal(fs.existsSync(stagedTmp), false, 'staged cleanup engine temp must be atomically consumed');
      assert.equal(fs.existsSync(path.join(stage, 'cleanup-engine.json')), true);

      // Retrying after promotion uploads only an exact duplicate; it is safe to
      // consume, while a mismatched temporary file remains fail-closed.
      fs.copyFileSync(cleanupEngine, stagedTmp);
      const retry = spawnSync(
        'bash',
        [
          remoteOperator,
          'stage-cleanup-engine',
          projectDir,
          stage,
          transactionId,
          sha256File(cleanupEngine),
        ],
        { cwd: root, encoding: 'utf8' },
      );
      assert.equal(retry.status, 0, `${retry.stdout}\n${retry.stderr}`);
      assert.equal(fs.existsSync(stagedTmp), false, 'only a hash-verified duplicate temp may be removed');

      fs.writeFileSync(stagedTmp, 'tampered\n');
      const mismatch = spawnSync(
        'bash',
        [
          remoteOperator,
          'stage-cleanup-engine',
          projectDir,
          stage,
          transactionId,
          sha256File(cleanupEngine),
        ],
        { cwd: root, encoding: 'utf8' },
      );
      expectFailure(
        mismatch,
        /temporary residue hash mismatch/u,
        'cleanup engine staging must not remove a mismatched temporary artifact',
      );
      assert.equal(fs.existsSync(stagedTmp), true);
      fs.unlinkSync(stagedTmp);
      const cleanup = runCleanup(projectDir, stage, transactionId);
      assert.equal(cleanup.status, 0, `${cleanup.stdout}\n${cleanup.stderr}`);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Pre-extra file proves no recursive wipe and no success receipt (rmdir/foreign injection class).
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('no-recursive-wipe');
    try {
      materializeAuthorityTree(authorityRoot, {
        ...matchingTree,
        'releases/injected-after-style.json': '{"inject":true}\n',
      });
      const { stage } = stageCleanupTransaction(projectDir, transactionId, matchingTree);
      const result = runCleanup(projectDir, stage, transactionId);
      expectFailure(
        result,
        /unexpected path/u,
        'cleanup must fail closed on extra host files instead of recursively deleting them',
      );
      assertAuthorityPathRetained(authorityRoot, 'releases/injected-after-style.json');
      assertAuthorityPathRetained(authorityRoot, 'releases/snap-test/manifest.json');
      assertAuthorityPathRetained(authorityRoot, '._activations');
      assertNoSuccessReceipt(stage);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }

  // Happy path: exact recursive identity including real failure-style AppleDouble companions.
  {
    const { projectDir, authorityRoot } = prepareCleanupProject('happy-path-ad');
    try {
      materializeAuthorityTree(authorityRoot, matchingTree);
      const { stage } = stageCleanupTransaction(projectDir, transactionId, matchingTree);
      const result = runCleanup(projectDir, stage, transactionId);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /failed_authority_cleanup=cleared/u);
      assert.equal(fs.existsSync(path.join(authorityRoot, 'activations')), false);
      assert.equal(fs.existsSync(path.join(authorityRoot, 'releases')), false);
      assert.equal(fs.existsSync(path.join(authorityRoot, '._.')), false);
      assert.equal(fs.existsSync(path.join(authorityRoot, '._activations')), false);
      assert.equal(fs.existsSync(path.join(authorityRoot, '._releases')), false);
      assert.equal(fs.existsSync(path.join(stage, 'failed-authority-cleanup.json')), true);
      assert.equal(
        fs.existsSync(
          path.join(projectDir, 'course-content/runtime/knowledge/.production-cutover-operator.lock'),
        ),
        false,
        'successful cleanup must release operator lock',
      );
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }
}

function testArchiveValidationOrder() {
  const activateBody = remoteOperatorSourceSlice();
  const validateIdx = activateBody.indexOf('validate_authority_archive_listing "${stage}/authority.tar.gz"');
  assert.notEqual(validateIdx, -1, 'activate must call shared Authority archive validation');
  const stopIntentIdx = activateBody.indexOf('consumer_stop_started=1\n  stop_consumers');
  assert.notEqual(
    stopIntentIdx,
    -1,
    'activate must mark consumer-stop intent before invoking stop_consumers',
  );
  assert.ok(
    validateIdx < stopIntentIdx,
    'Authority archive validation must occur before any consumer stop intent',
  );
  const recoveryGateIdx = activateBody.indexOf('if [ "$consumer_stop_started" -eq 1 ]; then');
  assert.ok(
    recoveryGateIdx >= 0 && recoveryGateIdx < validateIdx,
    'failure recovery must gate Legacy restore on consumer_stop_started intent',
  );
  assert.match(
    activateBody,
    /podman stop -t 30 "\$container" >\/dev\/null \|\| return 1/u,
    'stop_consumers must return non-zero on partial stop so ERR recovery can run',
  );
  assert.doesNotMatch(
    activateBody.slice(activateBody.indexOf('stop_consumers()'), activateBody.indexOf('run_driver()')),
    /\bdie\b/u,
    'stop_consumers must not exit via die and bypass the activate ERR trap',
  );

  const harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-validate-harness-'));
  try {
    const harness = path.join(harnessDir, 'validate.sh');
    const operatorSource = fs.readFileSync(remoteOperator, 'utf8');
    const functionStart = operatorSource.indexOf('validate_authority_archive_listing()');
    const functionEnd = operatorSource.indexOf('\nrun_cleanup_failed_authority()');
    assert.ok(functionStart >= 0 && functionEnd > functionStart);
    fs.writeFileSync(
      harness,
      [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        'die() { printf \'ERROR: %s\\n\' "$*" >&2; exit 1; }',
        operatorSource.slice(functionStart, functionEnd).trim(),
        'validate_authority_archive_listing "$1"',
        '',
      ].join('\n'),
    );

    // macOS bsdtar may hide `._*` members from `tar -tzf`, so prove the reject
    // rule with a synthetic listing (AppleDouble) plus real archives (.DS_Store /
    // current.json) that system tar will list on every platform.
    const awkRule =
      '/(^|\\/)current\\.json$/ || /(^|\\/)\\._/ || /(^|\\/)\\.DS_Store$/ || /^\\// || /(^|\\/)\\.\\.\\// { invalid = 1 } END { exit invalid }';
    const appleDoubleListing = spawnSync(
      'bash',
      [
        '-c',
        `printf '%s\\n' 'releases/manifest.json' 'releases/._AppleDouble' | awk '${awkRule}'`,
      ],
      { encoding: 'utf8' },
    );
    assert.notEqual(
      appleDoubleListing.status,
      0,
      'archive reject rule must treat nested AppleDouble paths as invalid',
    );

    for (const [label, files] of [
      ['.DS_Store', { 'releases/manifest.json': '{"ok":true}\n', 'releases/.DS_Store': 'store\n' }],
      ['current.json', { 'releases/manifest.json': '{"ok":true}\n', 'current.json': '{}\n' }],
    ]) {
      const payload = path.join(harnessDir, `payload-${label.replace(/[^a-z0-9]+/giu, '-')}`);
      for (const [relativePath, contents] of Object.entries(files)) {
        const fullPath = path.join(payload, relativePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, contents);
      }
      const archivePath = path.join(harnessDir, `bad-${label.replace(/[^a-z0-9]+/giu, '-')}.tar.gz`);
      execFileSync(
        'tar',
        ['-C', payload, '-czf', archivePath, '.'],
        { env: { ...process.env, COPYFILE_DISABLE: '1' } },
      );
      const invalid = spawnSync('bash', [harness, archivePath], { cwd: root, encoding: 'utf8' });
      expectFailure(
        invalid,
        /Authority archive 包含 selector、macOS metadata 或不安全路径/u,
        `shared archive validator must reject ${label}`,
      );
    }

    const cleanPayload = path.join(harnessDir, 'clean-payload');
    fs.mkdirSync(path.join(cleanPayload, 'releases'), { recursive: true });
    fs.writeFileSync(path.join(cleanPayload, 'releases', 'manifest.json'), '{"ok":true}\n');
    const cleanArchive = path.join(harnessDir, 'clean-authority.tar.gz');
    execFileSync(
      'tar',
      ['-C', cleanPayload, '-czf', cleanArchive, '.'],
      { env: { ...process.env, COPYFILE_DISABLE: '1' } },
    );
    const valid = spawnSync('bash', [harness, cleanArchive], { cwd: root, encoding: 'utf8' });
    assert.equal(valid.status, 0, valid.stderr);
  } finally {
    fs.rmSync(harnessDir, { recursive: true, force: true });
  }

  testConsumerStopRecoveryIntent();
}

function testApplicationImageValidationOrder() {
  const activateBody = remoteOperatorSourceSlice();
  const verifyCallIdx = activateBody.indexOf('\n  verify_staged_application_image\n');
  const prepareCallIdx = activateBody.indexOf('\n  prepare_operator_bundle\n');
  const activateDriverIdx = activateBody.indexOf('run_driver activate rw');
  assert.ok(verifyCallIdx >= 0, 'activate must call staged image verification');
  assert.ok(prepareCallIdx >= 0, 'activate must prepare the operator bundle');
  assert.match(activateBody, /run_driver verify-bundle ro/u, 'operator bundle preparation must run its bundle verifier');
  assert.ok(activateDriverIdx >= 0, 'activate must run the activation driver');
  assert.ok(
    verifyCallIdx < prepareCallIdx && verifyCallIdx < activateDriverIdx,
    'staged image verification must complete before any normal target-image driver invocation',
  );

  const verifyStart = activateBody.indexOf('  verify_staged_application_image() {');
  const verifyEnd = activateBody.indexOf('\n  exec >', verifyStart);
  assert.ok(verifyStart >= 0 && verifyEnd > verifyStart, 'staged image verifier body must be locatable');
  const verifyBody = activateBody.slice(verifyStart, verifyEnd);
  const loadIdx = verifyBody.indexOf('podman load -i "$image_tar"');
  const digestIdx = verifyBody.indexOf('podman image inspect "$image_tag" --format \'{{.Id}}\'');
  const productProofIdx = verifyBody.indexOf('podman run --rm --network none --entrypoint /bin/sh "$image_tag"');
  assert.ok(loadIdx >= 0 && digestIdx > loadIdx && productProofIdx > digestIdx, 'staged image verifier must load, prove identity, then prove product files');
}

function testOperatorBundleArchiveValidation() {
  const source = fs.readFileSync(remoteOperator, 'utf8');
  const validateStart = source.indexOf('validate_operator_bundle_archive()');
  const validateEnd = source.indexOf('\n# Exact recursive identity', validateStart);
  const prepareStart = source.indexOf('\n  prepare_operator_bundle()');
  const prepareEnd = source.indexOf('\n  }\n\n  # Intent flag', prepareStart);
  assert.ok(validateStart >= 0 && validateEnd > validateStart);
  assert.ok(prepareStart >= 0 && prepareEnd > prepareStart);
  const validateFunction = source.slice(validateStart, validateEnd).trim();
  const prepareFunction = source
    .slice(prepareStart + 1, prepareEnd + 4)
    .replace(/^  /gmu, '')
    .trim();
  const harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), 'operator-bundle-archive-harness-'));
  try {
    const harness = path.join(harnessDir, 'prepare.sh');
    fs.writeFileSync(
      harness,
      `#!/usr/bin/env bash
set -euo pipefail
die() { printf 'ERROR: %s\\n' "$*" >&2; exit 1; }
hash_file() { sha256sum "$1" | awk '{print $1}'; }
stage="$1"
operator_bundle_archive="\${stage}/operator-bundle.tar.gz"
operator_bundle_manifest="\${stage}/operator-bundle.manifest.json"
operator_bundle_root="\${stage}/operator-bundle"
run_driver() { printf 'PRE_STOP_BUNDLE_VERIFIED action=%s access=%s\\n' "$1" "$2"; }
${validateFunction}
${prepareFunction}
prepare_operator_bundle
printf 'PRE_STOP_VALIDATION_COMPLETE\\n'
`,
    );
    fs.chmodSync(harness, 0o755);

    const makeArchive = (archivePath, entries) => {
      const encodedEntries = Object.fromEntries(
        entries.map((entry) => [entry.name, {
          type: entry.type ?? 'file',
          linkname: entry.linkname ?? '',
          data: Buffer.from(entry.data ?? '').toString('base64'),
        }]),
      );
      execFileSync('python3', [
        '-c',
        `import base64, io, json, tarfile, sys
entries = json.loads(sys.argv[1])
with tarfile.open(sys.argv[2], 'w:gz') as archive:
    for name, entry in entries.items():
        info = tarfile.TarInfo(name=name)
        if entry['type'] == 'dir':
            info.type = tarfile.DIRTYPE
            info.mode = 0o755
            archive.addfile(info)
        elif entry['type'] == 'symlink':
            info.type = tarfile.SYMTYPE
            info.linkname = entry['linkname']
            archive.addfile(info)
        else:
            raw = base64.b64decode(entry['data'].encode('ascii'))
            info.size = len(raw)
            archive.addfile(info, io.BytesIO(raw))
`,
        JSON.stringify(encodedEntries),
        archivePath,
      ], { cwd: root, encoding: 'utf8' });
    };
    const prepare = (name, entries) => {
      const stage = path.join(harnessDir, name);
      fs.mkdirSync(stage, { recursive: true });
      const archive = path.join(stage, 'operator-bundle.tar.gz');
      const manifest = path.join(stage, 'operator-bundle.manifest.json');
      makeArchive(archive, entries);
      fs.writeFileSync(manifest, '{"contract":"fixture"}\n');
      fs.writeFileSync(
        path.join(stage, 'plan.json'),
        JSON.stringify({ operatorBundle: {
          archiveSha256: sha256File(archive),
          manifestSha256: sha256File(manifest),
        } }),
      );
      return stage;
    };

    const validStage = prepare('valid', [
      { name: './', type: 'dir' },
      { name: './src/', type: 'dir' },
      { name: './src/driver.ts', data: 'export {}\n' },
    ]);
    const valid = spawnSync('bash', [harness, validStage], { cwd: root, encoding: 'utf8' });
    assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);
    assert.match(valid.stdout, /PRE_STOP_BUNDLE_VERIFIED/u);
    assert.match(valid.stdout, /PRE_STOP_VALIDATION_COMPLETE/u);
    assert.equal(fs.readFileSync(path.join(validStage, 'operator-bundle/src/driver.ts'), 'utf8'), 'export {}\n');

    for (const [name, entries, expected] of [
      ['parent-path', [{ name: './' }, { name: '../escape.txt', data: 'escape' }], /unsafe path/u],
      ['apple-double', [{ name: './' }, { name: './src/._metadata', data: 'metadata' }], /unsafe path/u],
      ['ds-store', [{ name: './' }, { name: './src/.DS_Store', data: 'metadata' }], /unsafe path/u],
      ['symlink', [{ name: './' }, { name: './src/', type: 'dir' }, { name: './src/link', type: 'symlink', linkname: '../escape' }], /symlink or non-regular/u],
    ]) {
      const stage = prepare(name, entries);
      const result = spawnSync('bash', [harness, stage], { cwd: root, encoding: 'utf8' });
      expectFailure(result, expected, `${name} operator bundle archive must fail before extraction`);
      assert.equal(fs.existsSync(path.join(stage, 'operator-bundle')), false);
    }
  } finally {
    fs.rmSync(harnessDir, { recursive: true, force: true });
  }
}

function testConsumerStopRecoveryIntent() {
  const harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-stop-intent-'));
  try {
    const partialStopHarness = path.join(harnessDir, 'partial-stop.sh');
    fs.writeFileSync(
      partialStopHarness,
      `#!/usr/bin/env bash
set -eEuo pipefail
consumer_stop_started=0
stop_calls=0
restore_mode=""
legacy_restore_calls=0

stop_consumers() {
  stop_calls=$((stop_calls + 1))
  # First transactional stop partially succeeds then fails (app stopped, worker fails).
  if [ "$stop_calls" -eq 1 ]; then
    printf 'stopped act-obe-app\\n'
    return 1
  fi
  # Recovery path finishes remaining consumers.
  printf 'stopped remaining consumers\\n'
  return 0
}

restore_legacy_after_failure() {
  local status="$1"
  trap - ERR INT TERM
  set +e
  if [ "$consumer_stop_started" -eq 1 ]; then
    restore_mode="legacy"
    stop_consumers
    legacy_restore_calls=$((legacy_restore_calls + 1))
    printf 'LEGACY_RESTORE_RAN stop_calls=%s\\n' "$stop_calls"
  else
    restore_mode="pre-stop"
    printf 'PRE_STOP_NO_RESTORE stop_calls=%s\\n' "$stop_calls"
  fi
  printf 'RESTORE_STATUS=%s MODE=%s\\n' "$status" "$restore_mode"
  exit "$status"
}

trap 'restore_legacy_after_failure $?' ERR

# Pre-stop validation succeeds with zero consumer interruption.
true

consumer_stop_started=1
stop_consumers
printf 'UNEXPECTED_CONTINUE\\n'
exit 0
`,
    );

    const partial = spawnSync('bash', [partialStopHarness], { cwd: root, encoding: 'utf8' });
    assert.notEqual(partial.status, 0, 'partial consumer stop must fail closed');
    assert.match(
      `${partial.stdout}\n${partial.stderr}`,
      /LEGACY_RESTORE_RAN stop_calls=2/u,
      'partial stop failure must enter Legacy restore and finish remaining stops',
    );
    assert.match(
      `${partial.stdout}\n${partial.stderr}`,
      /RESTORE_STATUS=1 MODE=legacy/u,
      'partial stop failure must preserve fail-closed status while taking Legacy restore',
    );
    assert.doesNotMatch(
      `${partial.stdout}\n${partial.stderr}`,
      /UNEXPECTED_CONTINUE/u,
      'partial stop failure must not continue the cutover path',
    );

    const preStopHarness = path.join(harnessDir, 'prestop-archive-fail.sh');
    fs.writeFileSync(
      preStopHarness,
      `#!/usr/bin/env bash
set -eEuo pipefail
consumer_stop_started=0
stop_calls=0

stop_consumers() {
  stop_calls=$((stop_calls + 1))
  printf 'STOP_CALLED\\n'
  return 0
}

restore_legacy_after_failure() {
  local status="$1"
  trap - ERR INT TERM
  set +e
  if [ "$consumer_stop_started" -eq 1 ]; then
    stop_consumers
    printf 'LEGACY_RESTORE_RAN\\n'
  else
    printf 'PRE_STOP_NO_RESTORE stop_calls=%s\\n' "$stop_calls"
  fi
  exit "$status"
}

trap 'restore_legacy_after_failure $?' ERR

# Simulate archive validation failure before any stop intent.
false

consumer_stop_started=1
stop_consumers
printf 'UNEXPECTED_CONTINUE\\n'
exit 0
`,
    );

    const preStop = spawnSync('bash', [preStopHarness], { cwd: root, encoding: 'utf8' });
    assert.notEqual(preStop.status, 0, 'pre-stop archive validation failure must fail closed');
    assert.match(
      `${preStop.stdout}\n${preStop.stderr}`,
      /PRE_STOP_NO_RESTORE stop_calls=0/u,
      'pre-stop validation failure must not call stop_consumers or Legacy restore',
    );
    assert.doesNotMatch(
      `${preStop.stdout}\n${preStop.stderr}`,
      /LEGACY_RESTORE_RAN|STOP_CALLED|UNEXPECTED_CONTINUE/u,
      'pre-stop validation failure must leave running consumers untouched',
    );
  } finally {
    fs.rmSync(harnessDir, { recursive: true, force: true });
  }
}

function remoteOperatorSourceSlice() {
  const source = fs.readFileSync(remoteOperator, 'utf8');
  const start = source.indexOf('run_activate()');
  const end = source.indexOf('\ncase "$action" in');
  assert.ok(start >= 0 && end > start, 'run_activate body must be locatable');
  return source.slice(start, end);
}

function main() {
  assert.ok(fs.existsSync(tsx), 'tsx runtime must be available for production cutover tests');
  assert.ok(fs.existsSync(imageTar), 'configured OCI image tar must be available');
  const remoteActivatorSource = fs.readFileSync(remoteActivator, 'utf8');
  const remoteOperatorSource = fs.readFileSync(remoteOperator, 'utf8');
  const cleanupEngineSource = fs.readFileSync(cleanupEngine, 'utf8');
  assert.match(
    remoteActivatorSource,
    /oci_image_config_digest\(\)[\s\S]*--image-config-digest "\$image_config_digest"/u,
    'remote activation must derive and seal the OCI config digest from the frozen tar',
  );
  assert.match(
    remoteActivatorSource,
    /REMOTE_OPERATOR_SCRIPT=.*remote-production-cutover\.sh/u,
    'remote activation must use the versioned remote operator transport',
  );
  assert.match(
    remoteActivatorSource,
    /--index-dir "\$\{ROOT_DIR\}\/course-content\/runtime\/resources\/textbook-hybrid-retrieval\/bge-m3"/u,
    'remote activation must verify the canonical BGE-M3 textbook index before production cutover',
  );
  assert.doesNotMatch(
    remoteActivatorSource,
    /course-content\/runtime\/resources\/textbook-retrieval/u,
    'remote activation must not verify the retired textbook retrieval directory',
  );
  assert.equal(
    (remoteActivatorSource.match(/< "\$REMOTE_OPERATOR_SCRIPT"/gu) ?? []).length,
    5,
    'every remote preflight, cleanup staging, cleanup, normal staging, and activation step must stream the versioned operator file',
  );
  assert.doesNotMatch(
    remoteActivatorSource,
    /<<'REMOTE_(?:PREFLIGHT|STAGE|TRANSACTION)'/u,
    'RTK 包装下的 remote operation transport must not use SSH heredocs',
  );
  assert.match(
    remoteOperatorSource,
    /podman image inspect "\$image_tag" --format '\{\{\.Id\}\}'[\s\S]*image_config_digest/u,
    'remote activation must compare the loaded image ID with the sealed OCI config digest',
  );
  assert.match(
    remoteOperatorSource,
    /podman inspect "\$container" --format '\{\{\.Image\}\}'[\s\S]*OCI config digest/u,
    'post-cutover containers must be checked against the sealed OCI config digest',
  );
  assert.match(
    remoteOperatorSource,
    /APP_IMAGE="\$image_tag" ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover "\$deploy_script" --app-only/u,
    'cutover deployment must pass its mode directly to the deployment command',
  );
  assert.match(
    remoteOperatorSource,
    /knowledge\/authority-domain-shards\/current\.json/u,
    'remote operator all-ABSENT checks must include the Authority domain shard pointer',
  );
  assert.match(
    remoteActivatorSource,
    /create-operator-bundle\.mjs/u,
    'remote activation must build the dedicated operator bundle',
  );
  assert.match(
    remoteActivatorSource,
    /--operator-source-revision "\$OPERATOR_SOURCE_REVISION"/u,
    'operator bundle must be built from an explicit source revision',
  );
  assert.match(
    remoteActivatorSource,
    /--image-provenance-sha256 "\$image_provenance_sha256"/u,
    'sealed plan must bind the application image provenance sidecar',
  );
  assert.match(
    remoteOperatorSource,
    /operator-bundle\.tar\.gz[\s\S]*operator-bundle\.manifest\.json/u,
    'remote staging must carry the bundle archive and manifest',
  );
  assert.match(
    remoteOperatorSource,
    /operator_bundle_root[\s\S]*run_driver verify-bundle ro/u,
    'remote activation must verify the extracted bundle before stopping consumers',
  );
  assert.match(
    remoteOperatorSource,
    /verify_staged_application_image\(\)[\s\S]*active-authority-shards-product[\s\S]*consumer_stop_started=1/u,
    'remote activation must prove the loaded image contains the active-shard product before stopping consumers',
  );
  assert.match(
    remoteOperatorSource,
    /previous_image_digest[\s\S]*APP_IMAGE="\$previous_image_digest"/u,
    'failure recovery must redeploy the pre-cutover immutable image identity',
  );
  assert.match(
    remoteOperatorSource,
    /validate_operator_bundle_archive\(\)[\s\S]*tar -tvzf[\s\S]*operator_bundle_archive/u,
    'remote activation must inspect archive entry types before extraction',
  );
  assert.match(
    remoteOperatorSource,
    /validate_operator_bundle_archive "\$operator_bundle_archive"[\s\S]*tar --no-same-owner -xzf/u,
    'remote activation must validate, extract, then run the bundle verifier before stop intent',
  );
  assert.doesNotMatch(
    remoteOperatorSource,
    /production-cutover\.ts:\/app\/scripts\/knowledge-cutover\/production-cutover\.ts/u,
    'remote driver must not mount a host tool into the fixed image source path',
  );
  assert.match(
    remoteOperatorSource,
    /--workdir \/operator-bundle[\s\S]*--tsconfig \/operator-bundle\/tsconfig\.json/u,
    'remote driver must run with the bundle tsconfig in the isolated root',
  );
  assert.doesNotMatch(
    remoteOperatorSource,
    /printf 'APP_IMAGE=%s\\nACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover\\n'/u,
    'cutover must not overwrite the existing secret-bearing .env.server file',
  );
  assert.match(
    remoteActivatorSource,
    /COPYFILE_DISABLE=1 tar[\s\S]*--exclude='\._\*'/u,
    'Authority archive creation must disable macOS metadata and exclude AppleDouble entries',
  );
  assert.match(
    remoteOperatorSource,
    /validate_authority_archive_listing "\$\{stage\}\/authority\.tar\.gz"/u,
    'remote activation must validate Authority archive listing before consumer stop/extraction',
  );
  assert.match(
    remoteOperatorSource,
    /Authority archive 包含 selector、macOS metadata 或不安全路径/u,
    'remote activation must reject selector or macOS metadata before extracting Authority artifacts',
  );
  assert.match(
    remoteOperatorSource,
    /stage-cleanup-engine\) run_stage_cleanup_engine/u,
    'failed Authority cleanup must stage one hash-checked standalone engine',
  );
  assert.match(
    remoteOperatorSource,
    /cleanup-failed-authority\) run_cleanup_failed_authority/u,
    'a failed pre-journal Authority extraction must have an identity-constrained cleanup action',
  );
  assert.match(
    remoteActivatorSource,
    /--cleanup-failed-authority.*cleanup-failed-authority-identity\.cjs\.tmp/su,
    'the cleanup-only path must upload the standalone engine before remote cleanup',
  );
  assert.doesNotMatch(
    remoteOperatorSource,
    /cat\s+>"\$engine_path"\s+<<'NODE'/u,
    'remote cleanup must not construct the Node engine through a large heredoc',
  );
  assert.match(
    remoteOperatorSource,
    /data\/runtime\/knowledge-cutover\/staging\/\$\{transaction_id\}/u,
    'cleanup must bind to the canonical staging path for the transaction id',
  );
  assert.match(
    cleanupEngineSource,
    /cleanup sealed plan transactionId mismatch|plan\.transactionId !== transactionId/u,
    'standalone cleanup engine must close sealed plan identity with the requested transaction id',
  );
  for (const scriptPath of [remoteActivator, remoteOperator]) {
    const syntax = spawnSync('bash', ['-n', scriptPath], { cwd: root, encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
  testApplicationImageValidationOrder();
  testArchiveValidationOrder();
  testOperatorBundleArchiveValidation();
  testCleanupFailedAuthorityGuards();
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
    const sourceShardRuntimeBefore = fileTreeFingerprint(path.join(root, SHARD_PREFIX));
    const planPath = path.join(workRoot, 'plan.json');
    const operatorBundleRoot = path.join(workRoot, 'operator-bundle');
    const operatorBundleManifest = path.join(workRoot, 'operator-bundle.manifest.json');
    const operatorBundleArchive = path.join(workRoot, 'operator-bundle.tar.gz');
    const captureRevision = '1a56317aa44e46322be0b0d1ac73948c03c5c2c0';
    execFileSync('node', [
      operatorBundleHelper,
      '--repo-root',
      root,
      '--output',
      operatorBundleRoot,
      '--manifest',
      operatorBundleManifest,
      '--operator-source-revision',
      operatorSourceRevision,
      '--capture-revision',
      captureRevision,
    ], { cwd: root, encoding: 'utf8' });
    execFileSync('tar', ['-czf', operatorBundleArchive, '-C', operatorBundleRoot, '.'], { cwd: root });
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
      '--application-source-revision',
      revision,
      '--image-tag',
      imageTag,
      '--image-config-digest',
      configDigest,
      '--image-tar-sha256',
      tarSha256,
      '--image-provenance-sha256',
      '9'.repeat(64),
      '--deployment-script',
      path.join(root, 'deploy', 'podman', 'deploy.sh'),
      '--cleanup-engine',
      cleanupEngine,
      '--operator-bundle-manifest',
      operatorBundleManifest,
      '--operator-bundle-archive',
      operatorBundleArchive,
    ]);
    assert.equal(planResult.status, 0, planResult.stderr);
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.equal(plan.pointers.length, 5, 'plan must seal every current pointer');
    assert.deepEqual(
      plan.pointers.map((pointer) => pointer.component),
      ['authority', 'projection', 'prerequisite', 'authority-domain-shards', 'consumer-activation'],
      'plan must retain the shard pointer between prerequisite and consumer activation',
    );
    assert.ok(plan.authorityDomainShards?.shardSetId, 'plan must seal the planned shard set identity');
    assert.deepEqual(
      fileTreeFingerprint(path.join(root, SHARD_PREFIX)),
      sourceShardRuntimeBefore,
      'planning must seal Authority domain shard bytes without mutating the source runtime',
    );
    assert.ok(
      plan.files.some((file) => file.path.startsWith(`${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}/`)),
      'plan must seal every immutable Authority domain shard file',
    );
    assert.equal(plan.files.length > 0, true, 'plan must seal staged artifacts');
    assert.equal(plan.source.imageConfigDigest, configDigest, 'plan must bind the exact OCI config digest');
    assert.equal(plan.source.imageTarSha256, tarSha256, 'plan must bind the frozen image tar hash');
    assert.equal(plan.source.applicationSourceRevision, revision, 'plan must bind the application source revision');
    assert.equal(plan.source.imageProvenanceSha256, '9'.repeat(64), 'plan must bind image provenance digest');
    assert.equal(plan.source.operatorSourceRevision, operatorSourceRevision, 'plan must bind operator source revision separately');
    assert.match(plan.source.operatorSourceTree, /^[a-f0-9]{40}$/u, 'plan must bind operator source tree');
    assert.equal(
      plan.source.cleanupEngineSha256,
      sha256File(cleanupEngine),
      'plan must bind the standalone failed Authority cleanup engine',
    );
    assert.equal(plan.operatorBundle.captureRevision, captureRevision, 'plan must bind the operator bundle capture revision');
    assert.notEqual(plan.source.operatorSourceRevision, plan.source.captureRevision, 'operator source revision must not reuse capture revision');
    assert.ok(plan.operatorBundle.bundleSha256, 'plan must bind the operator bundle logical digest');
    assert.ok(plan.operatorBundle.manifestSha256, 'plan must bind the operator bundle manifest digest');
    assert.ok(plan.operatorBundle.archiveSha256, 'plan must bind the operator bundle archive digest');
    assert.ok(
      plan.operatorBundle.files.some((file) => file.path === 'scripts/knowledge-cutover/production-cutover.ts'),
      'operator bundle manifest must include the production driver',
    );

    const operatorBundleFixture = createFixture(plan, 'operator-bundle', {
      operatorBundleSource: operatorBundleRoot,
      operatorBundleManifest,
    });
    try {
      const verifiedBundle = run([
        'verify-bundle',
        '--root',
        operatorBundleFixture,
        '--plan',
        planPath,
        '--bundle-root',
        path.join(operatorBundleFixture, 'operator-bundle'),
        '--bundle-manifest',
        path.join(operatorBundleFixture, 'operator-bundle.manifest.json'),
      ]);
      assert.equal(verifiedBundle.status, 0, verifiedBundle.stderr);

      const sourceMismatchFixture = createFixture(plan, 'operator-bundle-source-mismatch', {
        operatorBundleSource: operatorBundleRoot,
        operatorBundleManifest,
      });
      try {
        const mismatchPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
        const mismatchedRevision = '0'.repeat(40);
        mismatchPlan.source.operatorSourceRevision = mismatchedRevision;
        mismatchPlan.operatorBundle.operatorSourceRevision = mismatchedRevision;
        const bundleBody = {
          contract: mismatchPlan.operatorBundle.contract,
          builderVersion: mismatchPlan.operatorBundle.builderVersion,
          operatorSourceRevision: mismatchedRevision,
          operatorSourceTree: mismatchPlan.operatorBundle.operatorSourceTree,
          captureRevision: mismatchPlan.operatorBundle.captureRevision,
          files: mismatchPlan.operatorBundle.files,
        };
        mismatchPlan.operatorBundle.bundleSha256 = sha256Bytes(canonicalJson(bundleBody));
        const { planHash: _ignoredPlanHash, ...mismatchBody } = mismatchPlan;
        mismatchPlan.planHash = sha256Bytes(canonicalJson(mismatchBody));
        const mismatchPlanPath = path.join(sourceMismatchFixture, 'mismatch-plan.json');
        fs.writeFileSync(mismatchPlanPath, `${JSON.stringify(mismatchPlan, null, 2)}\n`);
        const mismatchResult = run([
          'verify-bundle', '--root', sourceMismatchFixture, '--plan', mismatchPlanPath,
          '--bundle-root', path.join(sourceMismatchFixture, 'operator-bundle'),
          '--bundle-manifest', path.join(sourceMismatchFixture, 'operator-bundle.manifest.json'),
        ]);
        expectFailure(mismatchResult, /operator bundle source tree identity mismatch/u, 'operator source revision/tree mismatch must fail closed');
      } finally {
        fs.rmSync(sourceMismatchFixture, { recursive: true, force: true });
      }

      const missingBundle = createFixture(plan, 'operator-bundle-missing', {
        operatorBundleSource: operatorBundleRoot,
        operatorBundleManifest,
      });
      try {
        const missingPath = path.join(missingBundle, 'operator-bundle', plan.operatorBundle.files[0].path);
        fs.rmSync(missingPath);
        const result = run([
          'verify-bundle', '--root', missingBundle, '--plan', planPath,
          '--bundle-root', path.join(missingBundle, 'operator-bundle'),
          '--bundle-manifest', path.join(missingBundle, 'operator-bundle.manifest.json'),
        ]);
        expectFailure(result, /operator bundle file set differs from manifest/u, 'missing operator bundle file must fail closed');
      } finally {
        fs.rmSync(missingBundle, { recursive: true, force: true });
      }

      const extraBundle = createFixture(plan, 'operator-bundle-extra', {
        operatorBundleSource: operatorBundleRoot,
        operatorBundleManifest,
      });
      try {
        fs.writeFileSync(path.join(extraBundle, 'operator-bundle', 'unexpected.txt'), 'unexpected\n');
        const result = run([
          'verify-bundle', '--root', extraBundle, '--plan', planPath,
          '--bundle-root', path.join(extraBundle, 'operator-bundle'),
          '--bundle-manifest', path.join(extraBundle, 'operator-bundle.manifest.json'),
        ]);
        expectFailure(result, /operator bundle file set differs from manifest/u, 'extra operator bundle file must fail closed');
      } finally {
        fs.rmSync(extraBundle, { recursive: true, force: true });
      }

      const tamperedBundle = createFixture(plan, 'operator-bundle-tampered', {
        operatorBundleSource: operatorBundleRoot,
        operatorBundleManifest,
      });
      try {
        const tamperedFile = path.join(tamperedBundle, 'operator-bundle', 'tsconfig.json');
        fs.appendFileSync(tamperedFile, '\n');
        const result = run([
          'verify-bundle', '--root', tamperedBundle, '--plan', planPath,
          '--bundle-root', path.join(tamperedBundle, 'operator-bundle'),
          '--bundle-manifest', path.join(tamperedBundle, 'operator-bundle.manifest.json'),
        ]);
        expectFailure(result, /operator bundle file digest mismatch/u, 'tampered operator bundle file must fail closed');
      } finally {
        fs.rmSync(tamperedBundle, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(operatorBundleFixture, { recursive: true, force: true });
    }

    if (containerRuntime) {
      const imageAvailable = spawnSync(
        containerRuntime,
        ['image', 'inspect', containerImage],
        { cwd: root, encoding: 'utf8' },
      );
      assert.equal(imageAvailable.status, 0, imageAvailable.stderr);
      const containerFixture = createFixture(plan, 'operator-bundle-container', {
        operatorBundleSource: operatorBundleRoot,
        operatorBundleManifest,
      });
      try {
        for (const action of ['activate', 'verify', 'rollback']) {
          const result = runBundledContainer(
            action,
            containerFixture,
            planPath,
            operatorBundleRoot,
            operatorBundleManifest,
          );
          assert.equal(result.status, 0, `${action} in fixed image failed: ${result.stderr}`);
        }
      } finally {
        fs.rmSync(containerFixture, { recursive: true, force: true });
      }

      const recoveryFixture = createFixture(plan, 'operator-bundle-container-recover', {
        operatorBundleSource: operatorBundleRoot,
        operatorBundleManifest,
      });
      try {
        writePreparedReceipt(recoveryFixture, plan);
        writePreparedJournal(recoveryFixture, plan);
        const recovered = runBundledContainer(
          'recover',
          recoveryFixture,
          planPath,
          operatorBundleRoot,
          operatorBundleManifest,
        );
        assert.equal(recovered.status, 0, `recover in fixed image failed: ${recovered.stderr}`);
      } finally {
        fs.rmSync(recoveryFixture, { recursive: true, force: true });
      }
    }

    const shardSeedFixture = createFixture(plan, 'shard-seed');
    try {
      const seed = run(
        ['activate', '--root', shardSeedFixture, '--plan', planPath],
        driverEnv(shardSeedFixture),
      );
      assert.equal(seed.status, 0, seed.stderr);
      const shardSetSource = path.join(
        shardSeedFixture,
        `${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}`,
      );
      assert.equal(fs.existsSync(path.join(shardSetSource, 'manifest.json')), true);

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

    for (const [label, mutate] of [
      ['missing-shard-immutable', (filePath) => fs.rmSync(filePath)],
      ['tampered-shard-immutable', (filePath) => fs.appendFileSync(filePath, '\n')],
      ['unexpected-shard-immutable', (filePath) => fs.writeFileSync(path.join(path.dirname(filePath), 'unexpected.json'), '{}\n')],
    ]) {
      const shardFixture = createFixture(plan, label, { shardSetSource });
      try {
        const shardFile = plan.files.find((file) => (
          file.path.startsWith(`${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}/`)
            && !file.path.endsWith('/manifest.json')
        ));
        assert.ok(shardFile, 'plan must contain a non-manifest immutable shard file');
        const shardPath = path.join(shardFixture, shardFile.path);
        mutate(shardPath);
        const result = run(
          ['activate', '--root', shardFixture, '--plan', planPath],
          driverEnv(shardFixture),
        );
        expectFailure(
          result,
          label.startsWith('missing')
            ? /Authority domain shard file is missing/u
            : label.startsWith('tampered')
              ? /sealed artifact hash mismatch/u
              : /Authority domain shard file set differs from manifest/u,
          `${label} must fail before any pointer is written`,
        );
        for (const pointer of plan.pointers) {
          assert.equal(fs.existsSync(path.join(shardFixture, pointer.path)), false);
        }
      } finally {
        fs.rmSync(shardFixture, { recursive: true, force: true });
      }
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
        ['authority', 'projection', 'prerequisite', 'authority-domain-shards', 'consumer-activation'],
        'production activation must retain consumer-last order',
      );
      assert.deepEqual(
        journal.steps.map((step) => step.status),
        ['APPLIED', 'APPLIED', 'APPLIED', 'APPLIED', 'APPLIED'],
      );
      for (const pointer of plan.pointers) {
        assert.equal(fs.existsSync(path.join(activeFixture, pointer.path)), true);
      }
      const shardPointer = pointerPath(activeFixture, plan, 'authority-domain-shards');
      const shardCurrent = JSON.parse(fs.readFileSync(shardPointer, 'utf8'));
      assert.equal(shardCurrent.shardSetId, plan.authorityDomainShards.shardSetId);
      assert.equal(shardCurrent.shardSetHash, plan.authorityDomainShards.shardSetHash);

      const verified = run(
        ['verify', '--root', activeFixture, '--plan', planPath],
        env,
      );
      assert.equal(verified.status, 0, verified.stderr);

      const shardSetManifest = path.join(
        activeFixture,
        `${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}/manifest.json`,
      );
      assert.equal(fs.existsSync(shardSetManifest), true, 'active cutover must retain the immutable shard set');

      const activeReceiptPath = path.join(
        activeFixture,
        'course-content/runtime/knowledge/production-cutover-transactions',
        `${transactionId}.json`,
      );
      const activeReceipt = JSON.parse(fs.readFileSync(activeReceiptPath, 'utf8'));
      activeReceipt.transactionId = 'foreign-production-cutover';
      fs.writeFileSync(activeReceiptPath, `${JSON.stringify(activeReceipt)}\n`);
      const receiptDriftRollback = run(
        ['rollback', '--root', activeFixture, '--plan', planPath],
        env,
      );
      expectFailure(
        receiptDriftRollback,
        /production cutover receipt mismatch/u,
        'rollback must reject a receipt that does not bind this plan before mutating any pointer',
      );
      for (const pointer of plan.pointers) {
        assert.equal(fs.existsSync(path.join(activeFixture, pointer.path)), true);
      }
      activeReceipt.transactionId = transactionId;
      fs.writeFileSync(activeReceiptPath, `${JSON.stringify(activeReceipt)}\n`);

      const ownedSetFixture = createFixture(plan, 'owned-set');
      try {
        const ownedEnv = driverEnv(ownedSetFixture);
        const ownedActivation = run(
          ['activate', '--root', ownedSetFixture, '--plan', planPath],
          ownedEnv,
        );
        assert.equal(ownedActivation.status, 0, ownedActivation.stderr);
        const ownedRollback = run(
          ['rollback', '--root', ownedSetFixture, '--plan', planPath],
          ownedEnv,
        );
        assert.equal(ownedRollback.status, 0, ownedRollback.stderr);
        assert.equal(
          fs.existsSync(path.join(ownedSetFixture, `${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}`)),
          true,
          'rollback must preserve immutable shard bytes because no mutable receipt authorizes deletion',
        );
      } finally {
        fs.rmSync(ownedSetFixture, { recursive: true, force: true });
      }

      const retainedSetFixture = createFixture(plan, 'retained-set', { shardSetSource });
      try {
        const retainedEnv = driverEnv(retainedSetFixture);
        const retainedActivation = run(
          ['activate', '--root', retainedSetFixture, '--plan', planPath],
          retainedEnv,
        );
        assert.equal(retainedActivation.status, 0, retainedActivation.stderr);
        const retainedRollback = run(
          ['rollback', '--root', retainedSetFixture, '--plan', planPath],
          retainedEnv,
        );
        assert.equal(retainedRollback.status, 0, retainedRollback.stderr);
        assert.equal(
          fs.existsSync(path.join(retainedSetFixture, `${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}/manifest.json`)),
          true,
          'rollback must retain a pre-existing sha-matching shard set',
        );
      } finally {
        fs.rmSync(retainedSetFixture, { recursive: true, force: true });
      }

      const recoveredSetFixture = createFixture(plan, 'recovered-set', { shardSetSource });
      try {
        const recoveryEnv = driverEnv(recoveredSetFixture);
        writePreparedReceipt(recoveredSetFixture, plan);
        writePreparedJournal(recoveredSetFixture, plan);
        const recovered = run(
          ['recover', '--root', recoveredSetFixture, '--plan', planPath],
          recoveryEnv,
        );
        assert.equal(recovered.status, 0, recovered.stderr);
        assert.equal(
          fs.existsSync(path.join(recoveredSetFixture, `${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}/manifest.json`)),
          true,
          'recovery must preserve immutable shard bytes',
        );
      } finally {
        fs.rmSync(recoveredSetFixture, { recursive: true, force: true });
      }

      const receiptDriftRecoveryFixture = createFixture(plan, 'receipt-drift-recovery', { shardSetSource });
      try {
        const recoveryEnv = driverEnv(receiptDriftRecoveryFixture);
        writePreparedReceipt(receiptDriftRecoveryFixture, plan, { transactionId: 'foreign-production-cutover' });
        const journalPath = writePreparedJournal(receiptDriftRecoveryFixture, plan);
        const receiptDriftRecovery = run(
          ['recover', '--root', receiptDriftRecoveryFixture, '--plan', planPath],
          recoveryEnv,
        );
        expectFailure(
          receiptDriftRecovery,
          /production cutover receipt mismatch/u,
          'recovery must reject a receipt that does not bind this plan before pointer compensation',
        );
        assert.equal(JSON.parse(fs.readFileSync(journalPath, 'utf8')).status, 'PREPARED');
        assert.equal(
          fs.existsSync(path.join(receiptDriftRecoveryFixture, `${SHARD_PREFIX}sets/${plan.authorityDomainShards.shardSetId}/manifest.json`)),
          true,
          'receipt drift must not delete a pre-existing immutable shard set',
        );
      } finally {
        fs.rmSync(receiptDriftRecoveryFixture, { recursive: true, force: true });
      }

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
      fs.rmSync(shardSeedFixture, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true });
  }
}

main();
