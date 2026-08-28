import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const buildScript = fs.readFileSync(path.join(root, 'scripts/build.sh'), 'utf8');

function stageBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing stage: ${start}`);
  assert.ok(endIndex > startIndex, `missing stage boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

const runnerOsStage = stageBetween(
  dockerfile,
  'FROM ${NODE_IMAGE} AS runner-os',
  'FROM runner-os AS runner',
);
const runnerStage = dockerfile.slice(dockerfile.indexOf('FROM runner-os AS runner'));

assert.match(
  dockerfile,
  /^ARG NODE_IMAGE=node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0$/m,
  'build and runtime stages must use the pinned multi-architecture Node index digest',
);
assert.match(dockerfile, /FROM \$\{NODE_IMAGE\} AS base/u);
assert.match(dockerfile, /FROM \$\{NODE_IMAGE\} AS runner-os/u);
assert.match(runnerOsStage, /ARG RUNNER_OS_REV=/u);
assert.match(runnerOsStage, /printf '%s\\n' "\$\{RUNNER_OS_REV\}"/u);
assert.doesNotMatch(
  runnerOsStage,
  /\b(?:builder|APP_REVISION|openspec|course-content|authority)\b|\bCOPY\b|(?:^|\s)src\//imu,
  'runner-os must not read application, builder, OpenSpec, or course/authority inputs',
);
assert.match(
  runnerOsStage,
  /chromium[\s\S]*libreoffice[\s\S]*fonts-liberation/u,
  'runner-os must own browser, office, and font packages',
);
assert.doesNotMatch(runnerStage, /apt-get install/u);
assert.ok(
  runnerStage.indexOf('COPY --from=builder') > 0,
  'application copies must happen only after FROM runner-os AS runner',
);
assert.match(dockerfile, /ARG BUILD_OS_REV=/u);
assert.match(dockerfile, /printf '%s\\n' "\$\{BUILD_OS_REV\}"/u);

assert.match(buildScript, /BUILDER_NAME="act-local-build-cache"/u);
assert.match(buildScript, /CACHE_MODE="max"/u);
assert.match(buildScript, /ACT_BUILD_CACHE_ROOT/u);
assert.match(buildScript, /CACHE_ROOT/u);
assert.match(buildScript, /git -C "\$\{ROOT_DIR\}" worktree list --porcelain/u);
assert.match(buildScript, /PLATFORM_KEY="\$\(normalize_platform/u);
assert.match(buildScript, /CACHE_LOCK_DIR="\$\{PLATFORM_CACHE_ROOT\}\/lock"/u);
assert.match(buildScript, /mkdir "\$\{CACHE_LOCK_DIR\}"/u);
assert.match(buildScript, /ln -s "\$\{GENERATION_DIR\}" "\$\{CURRENT_LINK_TMP\}"/u);
assert.match(buildScript, /atomic_replace_current "\$\{CURRENT_LINK_TMP\}" "\$\{CURRENT_CACHE_DIR\}"/u);
assert.match(buildScript, /--output=type=cacheonly/u);
assert.match(buildScript, /mode=max/u);
for (const cacheId of [
  'id=act-npm-${CACHE_PLATFORM}',
  'id=act-prisma-${CACHE_PLATFORM}',
  'id=act-apt-${CACHE_PLATFORM}',
]) {
  assert.match(
    dockerfile,
    new RegExp(cacheId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*sharing=locked', 'u'),
    `Docker dependency cache must use a stable locked ID: ${cacheId}`,
  );
}

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content);
  fs.chmodSync(filePath, 0o755);
}

function createFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'act-local-build-cache-'));
  const bin = path.join(fixture, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(fixture, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'node_modules/.bin'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'scripts/release'), { recursive: true });
  fs.copyFileSync(
    path.join(root, 'scripts/build.sh'),
    path.join(fixture, 'scripts/build.sh'),
  );
  fs.chmodSync(path.join(fixture, 'scripts/build.sh'), 0o755);
  fs.writeFileSync(
    path.join(fixture, '.dockerignore'),
    [
      'course-content/runtime',
      '!scripts/build-next-with-trace-check.mjs',
      '!scripts/prune-next-trace-boundary.mjs',
      '!scripts/assets/validate-optimized-models.mjs',
    ].join('\n') + '\n',
  );
  writeExecutable(path.join(fixture, 'node_modules/.bin/tsx'), '#!/usr/bin/env bash\nexit 0\n');
  writeExecutable(path.join(fixture, 'node_modules/.bin/prisma'), '#!/usr/bin/env bash\nexit 0\n');
  fs.writeFileSync(
    path.join(fixture, 'scripts/release/textbook-runtime-v2-provenance.mjs'),
    'process.exit(0);\n',
  );

  const dockerLog = path.join(fixture, 'docker.log');
  const builderMarker = path.join(fixture, 'builder.ready');
  writeExecutable(
    path.join(bin, 'git'),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "-C" ]]; then shift 2; fi
case "\${1:-}" in
  status) exit 0 ;;
  rev-parse) printf '%s\\n' '${'a'.repeat(40)}' ;;
  worktree)
    if [[ "\${2:-}" == "list" ]]; then
      while IFS= read -r worktree; do
        [[ -z "\$worktree" ]] || printf 'worktree %s\\n' "\$worktree"
      done <<< "\${FAKE_WORKTREES:-}"
    fi
    ;;
  *) exit 0 ;;
esac
`,
  );
  writeExecutable(path.join(bin, 'npm'), '#!/usr/bin/env bash\nexit 0\n');
  writeExecutable(
    path.join(bin, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "\$*" >> "\${FAKE_DOCKER_LOG}"
if [[ "\${1:-}" == "info" ]]; then
  printf '%s\\n' 32212254720
  exit 0
fi
if [[ "\${1:-}" != "buildx" ]]; then exit 0; fi
shift
command="\${1:-}"
shift || true
case "\$command" in
  inspect) [[ -f "\${FAKE_BUILDER_MARKER}" ]] ;;
  create) touch "\${FAKE_BUILDER_MARKER}" ;;
  build)
    target=""
    output_tar=""
    cache_to=""
    args=("\$@")
    for ((index = 0; index < \${#args[@]}; index += 1)); do
      arg="\${args[index]}"
      case "\$arg" in
        --target) target="\${args[index + 1]:-}" ;;
        --target=*) target="\${arg#--target=}" ;;
        --output=type=docker,dest=*) output_tar="\${arg#--output=type=docker,dest=}" ;;
        --cache-to=*) cache_to="\${arg#--cache-to=}" ;;
      esac
    done
    if [[ "\$target" == "runner-os" ]]; then
      printf '%s\\n' prewarm >> "\${FAKE_ORDER_FILE}"
      exit 0
    fi
    printf '%s\\n' final >> "\${FAKE_ORDER_FILE}"
    if [[ "\${FAKE_DOCKER_FAIL_FINAL:-0}" == 1 ]]; then exit 42; fi
    if [[ -n "\$output_tar" ]]; then
      mkdir -p "\$(dirname "\$output_tar")"
      printf '%s\\n' image > "\$output_tar"
    fi
    if [[ "\$cache_to" == type=local,* ]]; then
      destination="\${cache_to#*dest=}"
      destination="\${destination%%,mode=*}"
      mkdir -p "\$destination"
      printf '%s\\n' '{}' > "\$destination/index.json"
    fi
    ;;
esac
`,
  );
  return { fixture, bin, dockerLog, builderMarker };
}

function runFixture(fixtureInfo, extraEnv = {}) {
  const { fixture, bin, dockerLog, builderMarker } = fixtureInfo;
  const environment = { ...process.env };
  for (const name of [
    'ACT_BUILD_CACHE_ROOT',
    'CACHE_ROOT',
    'CACHE_MODE',
    'DATABASE_URL',
    'FAKE_DOCKER_FAIL_FINAL',
  ]) delete environment[name];
  Object.assign(environment, {
    PATH: `${bin}:${environment.PATH}`,
    BUILD_SCOPE: 'app-only',
    OUTPUT_TAR: 'out/image.tar',
    IMAGE_TAG: 'localhost/test:cache',
    HOME: path.join(fixture, 'home'),
    XDG_CACHE_HOME: path.join(fixture, 'xdg'),
    FAKE_DOCKER_LOG: dockerLog,
    FAKE_BUILDER_MARKER: builderMarker,
    FAKE_ORDER_FILE: path.join(fixture, 'order.log'),
    FAKE_WORKTREES: path.join(fixture, 'registered-worktree'),
    ...extraEnv,
  });
  return spawnSync('bash', [path.join(fixture, 'scripts/build.sh')], {
    cwd: fixture,
    env: environment,
    encoding: 'utf8',
  });
}

function currentPath(cacheRoot, platform = 'linux-amd64') {
  return path.join(cacheRoot, platform, 'buildkit', 'current');
}

const defaultFixture = createFixture();
try {
  const defaultResult = runFixture(defaultFixture);
  assert.equal(defaultResult.status, 0, defaultResult.stderr);
  const defaultRoot = process.platform === 'darwin'
    ? path.join(defaultFixture.fixture, 'home', 'Library', 'Caches', 'act-build-cache')
    : path.join(defaultFixture.fixture, 'xdg', 'act-build-cache');
  const defaultCurrent = currentPath(defaultRoot);
  assert.equal(fs.lstatSync(defaultCurrent).isSymbolicLink(), true);
  assert.match(fs.readlinkSync(defaultCurrent), /linux-amd64/u);

  const actRoot = path.join(defaultFixture.fixture, 'act-cache');
  const actResult = runFixture(defaultFixture, { ACT_BUILD_CACHE_ROOT: actRoot });
  assert.equal(actResult.status, 0, actResult.stderr);
  assert.equal(fs.lstatSync(currentPath(actRoot)).isSymbolicLink(), true);

  const legacyRoot = path.join(defaultFixture.fixture, 'legacy-cache');
  const legacyResult = runFixture(defaultFixture, {
    CACHE_ROOT: legacyRoot,
    PLATFORM: 'linux/arm64/v8',
  });
  assert.equal(legacyResult.status, 0, legacyResult.stderr);
  assert.equal(
    fs.lstatSync(currentPath(legacyRoot, 'linux-arm64-v8')).isSymbolicLink(),
    true,
  );

  const rejectionResult = runFixture(defaultFixture, {
    ACT_BUILD_CACHE_ROOT: path.join(defaultFixture.fixture, 'inside-worktree'),
    FAKE_WORKTREES: defaultFixture.fixture,
  });
  assert.notEqual(rejectionResult.status, 0);
  assert.match(rejectionResult.stderr, /不得位于已登记 ACT worktree/u);

  const staleRoot = path.join(defaultFixture.fixture, 'stale-cache');
  const staleLock = path.join(staleRoot, 'linux-amd64', 'lock');
  fs.mkdirSync(staleLock, { recursive: true });
  fs.writeFileSync(path.join(staleLock, 'pid'), '2147483647\n');
  fs.writeFileSync(path.join(staleLock, 'host'), `${os.hostname()}\n`);
  const staleResult = runFixture(defaultFixture, { ACT_BUILD_CACHE_ROOT: staleRoot });
  assert.equal(staleResult.status, 0, staleResult.stderr);
  assert.equal(fs.existsSync(staleLock), false, 'stale lock must be cleaned after publication');

  const liveRoot = path.join(defaultFixture.fixture, 'live-cache');
  const liveLock = path.join(liveRoot, 'linux-amd64', 'lock');
  fs.mkdirSync(liveLock, { recursive: true });
  fs.writeFileSync(path.join(liveLock, 'pid'), `${process.pid}\n`);
  fs.writeFileSync(path.join(liveLock, 'host'), `${os.hostname()}\n`);
  const liveResult = runFixture(defaultFixture, { ACT_BUILD_CACHE_ROOT: liveRoot });
  assert.notEqual(liveResult.status, 0);
  assert.match(liveResult.stderr, new RegExp(`pid=${process.pid}`));
  fs.rmSync(liveRoot, { recursive: true, force: true });

  const failureRoot = path.join(defaultFixture.fixture, 'failure-cache');
  const firstResult = runFixture(defaultFixture, { ACT_BUILD_CACHE_ROOT: failureRoot });
  assert.equal(firstResult.status, 0, firstResult.stderr);
  const failureCurrent = currentPath(failureRoot);
  const firstTarget = fs.readlinkSync(failureCurrent);
  const failedResult = runFixture(defaultFixture, {
    ACT_BUILD_CACHE_ROOT: failureRoot,
    FAKE_DOCKER_FAIL_FINAL: '1',
  });
  assert.notEqual(failedResult.status, 0);
  assert.equal(fs.readlinkSync(failureCurrent), firstTarget);
  assert.equal(
    fs.readdirSync(path.join(failureRoot, 'linux-amd64', 'buildkit', 'generations')).length,
    1,
    'failed generation must not remain after final build failure',
  );

  const secondResult = runFixture(defaultFixture, { ACT_BUILD_CACHE_ROOT: failureRoot });
  assert.equal(secondResult.status, 0, secondResult.stderr);
  assert.notEqual(fs.readlinkSync(failureCurrent), firstTarget);
  const order = fs.readFileSync(path.join(defaultFixture.fixture, 'order.log'), 'utf8')
    .trim()
    .split('\n');
  assert.ok(order.indexOf('prewarm') >= 0);
  assert.ok(order.indexOf('final') > order.indexOf('prewarm'));
  const dockerLog = fs.readFileSync(defaultFixture.dockerLog, 'utf8');
  assert.match(dockerLog, /target runner-os[\s\S]*output=type=cacheonly/u);
  assert.match(dockerLog, /cache-to=type=local[\s\S]*mode=max/u);
} finally {
  fs.rmSync(defaultFixture.fixture, { recursive: true, force: true });
}

console.log('test-local-container-build-cache passed');
