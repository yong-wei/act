import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts/runtime-release/perform-production-runtime-cutover.sh');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-stream-capacity-'));
const bin = path.join(temporary, 'bin');
const stage = path.join(temporary, 'stage');
const graphRoot = path.join(temporary, 'graph');
const sourceRevision = 'a'.repeat(40);
const treeSha256 = 'b'.repeat(64);
const releaseId = `runtime-${createHash('sha256').update(JSON.stringify({ sourceRevision, treeSha256 })).digest('hex').slice(0, 55)}`;
const imageTarSha256 = 'c'.repeat(64);

function executable(name, body) {
  const target = path.join(bin, name);
  fs.writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  fs.chmodSync(target, 0o755);
}

try {
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(stage, { recursive: true });
  fs.mkdirSync(graphRoot, { recursive: true });
  fs.writeFileSync(path.join(stage, 'provenance.json'), `${JSON.stringify({ appRevision: 'd'.repeat(40), imageTarSha256 })}\n`);
  fs.writeFileSync(path.join(stage, 'receipt.json'), `${JSON.stringify({ schemaVersion: 'runtime-release-verification.v1', releaseId, manifestSha256: 'e'.repeat(64), treeSha256 })}\n`);
  fs.writeFileSync(path.join(stage, 'locator.json'), `${JSON.stringify({ releaseId, sourceRevision, treeSha256, manifestSha256: 'e'.repeat(64) })}\n`);
  executable('curl', 'printf "%s\\n" act-runtime-oss-read');
  executable('podman', `if [[ "$1" == info ]]; then printf '%s\\n' '${graphRoot}'; else echo "podman load must not run after a capacity rejection" >&2; exit 99; fi`);
  executable('df', 'printf "Filesystem 1B-blocks Used Available Use%% Mounted on\\n/dev/test 100 99 1 99%% /\\n"');

  const result = spawnSync('bash', [script,
    '--release-id', releaseId,
    '--integration-revision', 'd'.repeat(40),
    '--image-stdin',
    '--expected-image-tar-sha256', imageTarSha256,
    '--expected-image-digest', `sha256:${'f'.repeat(64)}`,
    '--minimum-available-bytes', '2',
    '--image-reference', 'localhost/test:latest',
    '--provenance', path.join(stage, 'provenance.json'),
    '--verification-receipt', path.join(stage, 'receipt.json'),
    '--release-locator', path.join(stage, 'locator.json'),
    '--ram-role', 'act-runtime-oss-read',
    '--stage-dir', stage,
  ], {
    cwd: root,
    input: 'must-not-be-read',
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.notEqual(result.status, 0, 'insufficient storage must reject streamed image import');
  assert.match(result.stderr, /insufficient Podman storage for streamed image import/);
  assert.doesNotMatch(result.stderr, /podman load must not run/, 'storage rejection must happen before consuming the image stream');
  assert.equal(fs.readdirSync(stage).some((entry) => entry.startsWith('.image-stream.')), false, 'capacity rejection must not create a stream spool directory');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('runtime production cutover stream-capacity contract passed');
