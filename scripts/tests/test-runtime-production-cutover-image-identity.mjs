import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts/runtime-release/perform-production-runtime-cutover.sh');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-stream-image-id-'));
const bin = path.join(temporary, 'bin');
const stage = path.join(temporary, 'stage');
const graphRoot = path.join(temporary, 'graph');
const stateDir = path.join(temporary, 'state');
const sourceRevision = 'a'.repeat(40);
const integrationRevision = 'd'.repeat(40);
const treeSha256 = 'b'.repeat(64);
const releaseId = `runtime-${createHash('sha256').update(JSON.stringify({ sourceRevision, treeSha256 })).digest('hex').slice(0, 55)}`;
const imageTar = Buffer.from('streamed production image bytes');
const imageTarSha256 = createHash('sha256').update(imageTar).digest('hex');
const bareImageId = 'f'.repeat(64);
const pythonResolution = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' });
const realPython = pythonResolution.stdout.trim();

function executable(name, body) {
  const target = path.join(bin, name);
  fs.writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  fs.chmodSync(target, 0o755);
}

try {
  assert.equal(pythonResolution.status, 0, pythonResolution.stderr || 'a real python3 executable is required for the cutover metadata proof');
  assert.notEqual(realPython, '', 'a real python3 executable is required for the cutover metadata proof');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(stage, { recursive: true });
  fs.mkdirSync(graphRoot, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stage, 'provenance.json'), `${JSON.stringify({ appRevision: integrationRevision, imageTarSha256 })}\n`);
  fs.writeFileSync(path.join(stage, 'receipt.json'), `${JSON.stringify({ schemaVersion: 'runtime-release-verification.v1', releaseId, manifestSha256: 'e'.repeat(64), treeSha256 })}\n`);
  fs.writeFileSync(path.join(stage, 'locator.json'), `${JSON.stringify({ releaseId, sourceRevision, treeSha256, manifestSha256: 'e'.repeat(64) })}\n`);
  fs.writeFileSync(path.join(stage, 'activate-runtime-release.sh'), '#!/usr/bin/env bash\nset -euo pipefail\n');
  fs.chmodSync(path.join(stage, 'activate-runtime-release.sh'), 0o755);
  fs.writeFileSync(path.join(stage, 'runtime-release-host-state.py'), '# mock host-state entrypoint\n');
  fs.writeFileSync(path.join(stateDir, 'act-runtime-active-receipt.json'), `${JSON.stringify({ deployment: { appRevision: integrationRevision, imageDigest: `sha256:${bareImageId}`, releaseLocatorSha256: createHash('sha256').update(fs.readFileSync(path.join(stage, 'locator.json'))).digest('hex') } })}\n`);
  executable('curl', 'printf "%s\\n" act-runtime-oss-read');
  executable('df', 'printf "Filesystem 1B-blocks Used Available Use%% Mounted on\\n/dev/test 100 1 90 1%% /\\n"');
  executable('podman', `
if [[ "$1" == info ]]; then
  printf '%s\\n' '${graphRoot}'
elif [[ "$1" == load ]]; then
  cat >/dev/null
elif [[ "$1" == image && "$2" == inspect && "$4" == *'.Id'* ]]; then
  printf '%s\\n' '${bareImageId}'
elif [[ "$1" == image && "$2" == inspect ]]; then
  printf '%s\\n' '${integrationRevision}'
elif [[ "$1" == inspect ]]; then
  printf '%s\\n' '${bareImageId}'
else
  echo "unexpected podman invocation: $*" >&2
  exit 98
fi`);
  executable('python3', `
if [[ "$1" == "$ACT_TEST_HOST_STATE" && "$2" == active ]]; then
  printf '%s\\n' '{"activeReleaseId":"${releaseId}"}'
  exit 0
fi
exec '${realPython}' "$@"`);

  const result = spawnSync('bash', [script,
    '--release-id', releaseId,
    '--integration-revision', integrationRevision,
    '--image-stdin',
    '--expected-image-tar-sha256', imageTarSha256,
    '--expected-image-digest', `sha256:${bareImageId}`,
    '--minimum-available-bytes', '2',
    '--image-reference', 'localhost/test:latest',
    '--provenance', path.join(stage, 'provenance.json'),
    '--verification-receipt', path.join(stage, 'receipt.json'),
    '--release-locator', path.join(stage, 'locator.json'),
    '--ram-role', 'act-runtime-oss-read',
    '--stage-dir', stage,
  ], {
    cwd: root,
    input: imageTar,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ACT_TEST_HOST_STATE: path.join(stage, 'runtime-release-host-state.py'), ACT_RUNTIME_STATE_DIR: stateDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /runtime-cutover-complete/);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('runtime production cutover image-identity contract passed');
