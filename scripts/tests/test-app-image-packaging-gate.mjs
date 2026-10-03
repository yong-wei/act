import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const policyPath = path.join(root, 'scripts/release/app-image-packaging-policy.json');
const splitter = path.join(root, 'scripts/release/split-app-image.py');
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
const nextConfig = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');
const prune = fs.readFileSync(path.join(root, 'scripts/prune-next-trace-boundary.mjs'), 'utf8');
const buildScript = fs.readFileSync(path.join(root, 'scripts/build.sh'), 'utf8');
const remoteDeploy = fs.readFileSync(path.join(root, 'scripts/remote-deploy.sh'), 'utf8');
const assemble = fs.readFileSync(path.join(root, 'scripts/release/assemble-app-image.mjs'), 'utf8');

assert.equal(policy.schema, 'act.app-image-packaging-policy.v1');

const runnerStage = dockerfile.slice(dockerfile.indexOf('FROM runner-os AS runner'));
const runnerCopyLines = runnerStage.split('\n').filter((line) => line.includes('COPY'));
for (const forbidden of policy.runnerCopyForbidden) {
  assert.equal(
    runnerCopyLines.some((line) => line.includes(forbidden)),
    false,
    `runner COPY 不得包含 ${forbidden}`,
  );
}
for (const rule of policy.contextDeny) {
  assert.ok(dockerignore.includes(rule), `.dockerignore 缺少排除规则 ${rule}`);
}
for (const rule of policy.contextMustNotAllow) {
  assert.equal(dockerignore.includes(rule), false, `.dockerignore 不得放行 ${rule}`);
}
for (const glob of policy.traceExcludeGlobs) {
  assert.ok(nextConfig.includes(glob), `Next 追踪排除缺少 ${glob}`);
}
for (const relativePath of policy.pruneStandalonePaths) {
  const parts = relativePath.split('/');
  const joined = `path.join(${parts.map((part) => `'${part}'`).join(', ')})`;
  assert.ok(
    prune.includes(relativePath) || prune.includes(joined) || prune.includes(`'${relativePath}'`),
    `standalone 清理缺少 ${relativePath}`,
  );
}

assert.match(buildScript, /split-app-image\.py" split/u);
assert.match(remoteDeploy, /assemble-app-image\.mjs/u);
assert.match(remoteDeploy, /podman load -i/u);
assert.doesNotMatch(remoteDeploy, /podman\s+build|docker\s+build|npm\s+run\s+build|next\s+build/u);
assert.doesNotMatch(assemble, /podman\s+build|docker\s+build|npm\s+run\s+build|next\s+build/u);
assert.match(dockerfile, /chromium[\s\S]*libreoffice/u);

function runPython(args, cwd = root) {
  return spawnSync('python3', [splitter, ...args], { cwd, encoding: 'utf8' });
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'act-image-packaging-'));
try {
  const revision = 'a'.repeat(40);
  const runnerRev = '2026-08-01.1';
  const monolith = path.join(work, 'monolith.tar');
  const bundle = path.join(work, 'app.tar');
  const runnerOs = path.join(work, 'runner-os.tar');
  const poison = path.join(work, 'poison.tar');
  const poisonBundle = path.join(work, 'poison-app.tar');
  const poisonRunner = path.join(work, 'poison-runner.tar');

  const written = runPython([
    'write-fixture', '--dest', monolith, '--revision', revision, '--runner-os-rev', runnerRev,
  ]);
  assert.equal(written.status, 0, written.stderr);

  const split = runPython([
    'split',
    '--image-tar', monolith,
    '--policy', policyPath,
    '--bundle-tar', bundle,
    '--runner-os-tar', runnerOs,
    '--expected-revision', revision,
    '--expected-runner-os-rev', runnerRev,
  ]);
  assert.equal(split.status, 0, split.stderr);
  assert.match(split.stdout, /bundle=\d+/u);
  assert.equal(runPython(['kind', '--image-tar', bundle]).stdout.trim(), 'bundle');
  assert.equal(runPython(['kind', '--image-tar', runnerOs]).stdout.trim(), 'docker-image');

  const inspected = JSON.parse(runPython(['inspect-bundle', '--bundle', bundle]).stdout);
  assert.equal(inspected.appRevision, revision);
  assert.equal(inspected.runnerOsRev, runnerRev);
  assert.deepEqual(inspected.deletions, ['usr/bin/keep']);
  assert.equal(inspected.user, 'nextjs');
  const names = inspected.files.map((file) => file.name);
  assert.ok(names.includes('app/hello.txt'));
  assert.equal(names.includes('usr/bin/keep'), false);
  assert.equal(names.includes('usr/bin/chromium'), false);
  const link = inspected.files.find((file) => file.name === 'app/link.txt');
  assert.equal(link.type, '1');
  assert.equal(link.linkname, 'app/hello.txt');
  assert.equal(link.uid, 1001);

  const poisoned = runPython([
    'write-fixture', '--dest', poison, '--revision', revision, '--runner-os-rev', runnerRev,
    '--poison-path', 'app/course-content/authoring/resources/leak.txt',
  ]);
  assert.equal(poisoned.status, 0, poisoned.stderr);
  const rejected = runPython([
    'split',
    '--image-tar', poison,
    '--policy', policyPath,
    '--bundle-tar', poisonBundle,
    '--runner-os-tar', poisonRunner,
    '--expected-revision', revision,
    '--expected-runner-os-rev', runnerRev,
  ]);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /禁止打包的路径/u);
  assert.equal(fs.existsSync(poisonBundle), false);

  const layersFile = path.join(work, 'layers.json');
  const mount = path.join(work, 'mount');
  const commitLog = path.join(work, 'commit.txt');
  const loaded = path.join(work, 'loaded');
  fs.writeFileSync(layersFile, `${JSON.stringify(inspected.runnerOsDiffIds)}\n`);
  const fakeBin = path.join(work, 'bin');
  fs.mkdirSync(fakeBin);
  fs.writeFileSync(path.join(fakeBin, 'podman'), `#!/usr/bin/env bash
set -euo pipefail
cmd="\${1:-}"
shift || true
case "\$cmd" in
  image)
    sub="\${1:-}"
    if [[ "\$sub" == "exists" ]]; then
      if [[ -f ${JSON.stringify(loaded)} ]]; then exit 0; fi
      exit 1
    fi
    if [[ "\$sub" == "inspect" ]]; then
      cat ${JSON.stringify(layersFile)}
      exit 0
    fi
    ;;
  load)
    touch ${JSON.stringify(loaded)}
    exit 0
    ;;
  create)
    mkdir -p ${JSON.stringify(path.join(mount, 'usr/bin'))}
    printf 'base\\n' > ${JSON.stringify(path.join(mount, 'usr/bin/keep'))}
    exit 0
    ;;
  mount)
    printf '%s\\n' ${JSON.stringify(mount)}
    exit 0
    ;;
  umount)
    exit 0
    ;;
  commit)
    printf '%s\\n' "\$*" > ${JSON.stringify(commitLog)}
    exit 0
    ;;
  rm)
    exit 0
    ;;
esac
printf 'unexpected podman %s\\n' "\$cmd" >&2
exit 99
`, { mode: 0o755 });
  const assembled = spawnSync('node', [
    path.join(root, 'scripts/release/assemble-app-image.mjs'),
    '--bundle', bundle,
    '--runner-os-tar', runnerOs,
    '--image', 'localhost/act-obe-platform:test',
  ], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
  });
  assert.equal(assembled.status, 0, `${assembled.stderr}\n${assembled.stdout}`);
  assert.equal(fs.readFileSync(path.join(mount, 'app/hello.txt'), 'utf8'), 'hi\n');
  assert.equal(fs.existsSync(path.join(mount, 'usr/bin/keep')), false);
  const commit = fs.readFileSync(commitLog, 'utf8');
  assert.match(commit, /USER nextjs/u);
  assert.match(commit, new RegExp(`org.opencontainers.image.revision=${revision}`));
  assert.match(commit, /localhost\/act-obe-platform:test/u);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('app image packaging gate passed');
