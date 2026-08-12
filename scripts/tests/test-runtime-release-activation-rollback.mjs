import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const activation = path.join(root, 'scripts/runtime-release/activate-runtime-release.sh');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-activation-rollback-'));
const bin = path.join(temporary, 'bin');
const state = path.join(temporary, 'state');
const mountRoot = path.join(temporary, 'mounts');
const legacyRoot = path.join(temporary, 'legacy-runtime');
const log = path.join(temporary, 'events.log');
const curlCalls = path.join(temporary, 'curl-calls.log');

function executable(name, body) {
  const target = path.join(bin, name);
  fs.writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  fs.chmodSync(target, 0o755);
  return target;
}

try {
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(legacyRoot, { recursive: true });
  const receipt = path.join(temporary, 'receipt.json');
  const environment = path.join(temporary, 'runtime.env');
  fs.writeFileSync(receipt, JSON.stringify({
    schemaVersion: 'runtime-release-verification.v1',
    releaseId: 'runtime-candidate',
    manifestSha256: 'a'.repeat(64),
    treeSha256: 'b'.repeat(64),
  }));
  fs.writeFileSync(environment, 'APP_PORT=9999\n');

  const hostState = path.join(bin, 'host-state.py');
  fs.writeFileSync(hostState, `
import json
import sys

print(json.dumps({'activeReleaseId': None} if sys.argv[1] == 'active' else {}))
`);
  const config = executable('configure-ossfs', 'exit 0');
  executable('flock', 'exit 0');
  executable('podman', `
if [[ "$1" == 'inspect' && "$2" == '--format' ]]; then
  case "$4" in
    act-obe-app|act-obe-worker)
      image='sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
      if [[ "\${ACT_TEST_BARE_IMAGE_ID:-0}" == 1 ]]; then image="\${image#sha256:}"; fi
      printf '%s\\n' "$image"
      ;;
    *) exit 1 ;;
  esac
  exit 0
fi
exit 1
`);
  const deploy = executable('deploy-app', `
printf 'deploy:%s:%s:%s\\n' "\${RUNTIME_DELIVERY_MODE:-}" "\${RUNTIME_CONTENT_DIR:-}" "\${APP_IMAGE:-}" >> "$ACT_TEST_EVENT_LOG"
`);
  executable('systemctl', `
printf 'systemctl:%s:%s\\n' "$1" "\${2:-}" >> "$ACT_TEST_EVENT_LOG"
`);
  executable('findmnt', `
if [[ "$*" == *FSTYPE* ]]; then
  printf '%s\\n' 'fuse.ossfs'
else
  printf '%s\\n' 'ro'
fi
`);
  executable('curl', `
max_time=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == '--max-time' ]]; then
    max_time="$2"
    shift 2
    continue
  fi
  shift
done
[[ "$max_time" =~ ^[0-9]+(\.[0-9]{1,3})?$ ]] || exit 64
awk -v value="$max_time" 'BEGIN { exit(value > 0 ? 0 : 1) }' || exit 64
calls=0
if [[ -f "$ACT_TEST_CURL_CALLS" ]]; then calls="$(wc -l < "$ACT_TEST_CURL_CALLS")"; fi
calls=$((calls + 1))
printf '%s:%s\\n' "$calls" "$max_time" >> "$ACT_TEST_CURL_CALLS"
if [[ "\${ACT_TEST_CURL_DELAY_SECONDS:-0}" != 0 ]]; then /bin/sleep "$ACT_TEST_CURL_DELAY_SECONDS"; fi
if [[ "$calls" -ge "\${ACT_TEST_CURL_SUCCEEDS_ON:-999999}" ]]; then exit 0; fi
exit 22
`);
  executable('sleep', 'if [[ "${ACT_TEST_REAL_SLEEP:-0}" == 1 ]]; then /bin/sleep "$1"; fi');

  function runActivation(overrides = {}) {
    return spawnSync('bash', [activation,
    '--release-id', 'runtime-candidate',
    '--expected-active-release', 'none',
    '--verification-receipt', receipt,
    '--ram-role', 'act-runtime-role',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ACT_RUNTIME_STATE_DIR: state,
      ACT_RUNTIME_MOUNT_ROOT: mountRoot,
      ACT_RUNTIME_HOST_STATE_SCRIPT: hostState,
      ACT_RUNTIME_OSSFS_CONFIG_SCRIPT: config,
      ACT_RUNTIME_DEPLOY_SCRIPT: deploy,
      ACT_RUNTIME_ENV_FILE: environment,
      ACT_RUNTIME_LEGACY_ROOT: legacyRoot,
      ACT_RUNTIME_APP_SERVICE_DROPIN_PATH: path.join(temporary, 'act-obe-stack.service.d', '20-runtime-ossfs.conf'),
      ACT_TEST_EVENT_LOG: log,
      ACT_TEST_BARE_IMAGE_ID: '1',
      ACT_TEST_CURL_CALLS: curlCalls,
      ACT_RUNTIME_READYZ_TIMEOUT_SECONDS: '1',
      ...overrides,
    },
  });
  }

  const result = runActivation();

  assert.notEqual(result.status, 0, 'failed candidate readiness must fail activation');
  assert.ok(fs.existsSync(log), `activation did not reach its controlled candidate attempt: ${result.stderr}`);
  const events = fs.readFileSync(log, 'utf8').trim().split('\n');
  const candidate = `deploy:ossfs-release:${mountRoot}/runtime-candidate:`;
  const legacy = `deploy:legacy-rsync:${legacyRoot}:sha256:${'c'.repeat(64)}`;
  assert.ok(events.includes(candidate), 'candidate deployment must be attempted before readiness');
  assert.ok(events.includes(legacy), 'first activation readiness failure must restore the legacy runtime deployment');
  assert.ok(events.indexOf(legacy) < events.indexOf('systemctl:stop:act-runtime-ossfs@runtime-candidate.service'), 'candidate mount is stopped only after legacy deployment is restored');

  fs.rmSync(log, { force: true });
  fs.rmSync(curlCalls, { force: true });
  const delayedReadyResult = runActivation({
    ACT_RUNTIME_READYZ_TIMEOUT_SECONDS: '6',
    ACT_TEST_CURL_SUCCEEDS_ON: '2',
    ACT_TEST_REAL_SLEEP: '1',
  });
  assert.equal(delayedReadyResult.status, 0, `delayed readiness must not roll back: ${delayedReadyResult.stderr}`);
  const delayedTimeouts = fs.readFileSync(curlCalls, 'utf8').trim().split('\n').map((entry) => Number(entry.split(':')[1]));
  assert.equal(delayedTimeouts.length, 2, 'activation must retry readiness until the app listens');
  assert.ok(delayedTimeouts[0] > 5 && delayedTimeouts[0] <= 6, 'first readiness request must receive the initial deadline');
  assert.ok(delayedTimeouts[1] > 0 && delayedTimeouts[1] < delayedTimeouts[0], 'second readiness request must receive only the remaining deadline');
  const delayedEvents = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.ok(delayedEvents.includes(candidate), 'candidate deployment must precede delayed readiness');
  assert.ok(!delayedEvents.includes(legacy), 'a later successful readiness response must not restore legacy runtime');

  fs.rmSync(log, { force: true });
  fs.rmSync(curlCalls, { force: true });
  const timeoutStart = Date.now();
  const wallClockTimeout = runActivation({
    ACT_RUNTIME_READYZ_TIMEOUT_SECONDS: '1',
    ACT_TEST_CURL_DELAY_SECONDS: '2',
  });
  const timeoutElapsedMs = Date.now() - timeoutStart;
  assert.notEqual(wallClockTimeout.status, 0, 'a hung readiness call must fail activation');
  assert.ok(timeoutElapsedMs < 4_000, `readiness timeout must use a real deadline, received ${timeoutElapsedMs}ms`);
  const timeoutCalls = fs.readFileSync(curlCalls, 'utf8').trim().split('\n');
  assert.equal(timeoutCalls.length, 1, 'a delayed failed request must not receive a second budget window');
  const timeoutBudget = Number(timeoutCalls[0].split(':')[1]);
  assert.ok(timeoutBudget > 0 && timeoutBudget <= 1, 'the final request must receive the remaining sub-second deadline');
  const timeoutEvents = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.ok(timeoutEvents.includes(legacy), 'wall-clock readiness timeout must restore legacy runtime');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('runtime release first-activation rollback contract passed');
