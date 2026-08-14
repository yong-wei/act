import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts/runtime-release/retire-legacy-runtime-after-oss-cutover.sh');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-legacy-retirement-'));
const bin = path.join(temporary, 'bin');
const legacy = path.join(temporary, 'legacy');
const mountRoot = path.join(temporary, 'mounts');
const state = path.join(temporary, 'state');
const report = path.join(temporary, 'report.json');

function executable(name, body) {
  const target = path.join(bin, name);
  fs.writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  fs.chmodSync(target, 0o755);
}

try {
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(legacy, { recursive: true });
  fs.mkdirSync(path.join(mountRoot, 'runtime-new'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'runtime.json'), '{"legacy":true}\n');
  const hostState = path.join(bin, 'host-state.py');
  fs.writeFileSync(hostState, '#!/usr/bin/env python3\nimport json\nimport os\nfrom pathlib import Path\nimport sys\ncounter = os.getenv("ACT_TEST_ACTIVE_COUNTER")\nif sys.argv[1] == "active":\n    previous = 0\n    if counter:\n        path = Path(counter)\n        previous = int(path.read_text()) if path.exists() else 0\n        path.write_text(str(previous + 1))\n    active = os.getenv("ACT_TEST_ACTIVE_AFTER_FIRST", "runtime-new") if previous else "runtime-new"\n    print(json.dumps({"activeReleaseId": active}))\nelse:\n    print(json.dumps({}))\n');
  fs.chmodSync(hostState, 0o755);
  executable('configure-ossfs', 'exit 0');
  executable('flock', 'exit 0');
  executable('systemctl', 'exit 0');
  executable('findmnt', 'if [[ "$*" == *FSTYPE* ]]; then printf "fuse.ossfs\\n"; else printf "ro\\n"; fi');
  executable('podman', 'if [[ "$*" == *"act-obe-app" ]]; then printf "%s\\t/app/course-content/runtime\\t%s\\n%s/knowledge/projection\\t/app/course-content/runtime/knowledge/projection\\tfalse\\n" "$ACT_TEST_MOUNT" "${ACT_TEST_RUNTIME_RW:-false}" "$ACT_TEST_MOUNT"; fi');
  executable('curl', 'exit 0');
  executable('df', 'printf "Filesystem 1B-blocks Used Available Use%% Mounted on\\n/dev/test 1000 100 900 10%% /\\n"');
  executable('du', 'printf "16\\t%s\\n" "${@: -1}"');
  executable('sync', 'exit 0');
  const rollbackReceipt = path.join(temporary, 'rollback.json');
  fs.writeFileSync(rollbackReceipt, '{}\n');

  const result = spawnSync('bash', [script,
    '--release-id', 'runtime-new',
    '--rollback-release-id', 'runtime-old',
    '--rollback-verification-receipt', rollbackReceipt,
    '--ram-role', 'act-runtime-oss-read',
    '--legacy-runtime-root', legacy,
    '--mount-root', mountRoot,
    '--state-dir', state,
    '--host-state-script', hostState,
    '--ossfs-config-script', path.join(bin, 'configure-ossfs'),
    '--app-port', '8084',
    '--report', report,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ACT_TEST_MOUNT: path.join(mountRoot, 'runtime-new') },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(legacy), false, 'retirement must remove only the verified legacy runtime root');
  const retirement = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.equal(retirement.releaseId, 'runtime-new');
  assert.equal(retirement.rollbackReleaseId, 'runtime-old');
  assert.equal(retirement.activeReceiptVerified, true);
  assert.equal(retirement.appUsesOssfsWorkerHasNoRuntimeMounts, true);
  assert.equal(retirement.rollbackMountVerified, true);
  assert.equal(retirement.legacyRuntimeBytesBefore, 16);
  assert.equal(retirement.legacyRuntimeFilesBefore, 1);
  const writableLegacy = path.join(temporary, 'legacy-writable');
  fs.mkdirSync(writableLegacy, { recursive: true });
  fs.writeFileSync(path.join(writableLegacy, 'runtime.json'), '{"legacy":true}\n');
  const writable = spawnSync('bash', [script,
    '--release-id', 'runtime-new',
    '--rollback-release-id', 'runtime-old',
    '--rollback-verification-receipt', rollbackReceipt,
    '--ram-role', 'act-runtime-oss-read',
    '--legacy-runtime-root', writableLegacy,
    '--mount-root', mountRoot,
    '--state-dir', state,
    '--host-state-script', hostState,
    '--ossfs-config-script', path.join(bin, 'configure-ossfs'),
    '--app-port', '8084',
    '--report', path.join(temporary, 'writable-report.json'),
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ACT_TEST_MOUNT: path.join(mountRoot, 'runtime-new'), ACT_TEST_RUNTIME_RW: 'true' },
  });
  assert.notEqual(writable.status, 0, 'a writable app runtime bind must block legacy retirement');
  assert.match(writable.stderr, /must bind the active OSS runtime exactly once read-only/);
  assert.equal(fs.existsSync(writableLegacy), true, 'a writable app runtime bind must preserve the legacy runtime');
  const driftLegacy = path.join(temporary, 'legacy-drift');
  const driftReport = path.join(temporary, 'drift-report.json');
  const activeCounter = path.join(temporary, 'active-count');
  fs.mkdirSync(driftLegacy, { recursive: true });
  fs.writeFileSync(path.join(driftLegacy, 'runtime.json'), '{"legacy":true}\n');
  const drift = spawnSync('bash', [script,
    '--release-id', 'runtime-new',
    '--rollback-release-id', 'runtime-old',
    '--rollback-verification-receipt', rollbackReceipt,
    '--ram-role', 'act-runtime-oss-read',
    '--legacy-runtime-root', driftLegacy,
    '--mount-root', mountRoot,
    '--state-dir', state,
    '--host-state-script', hostState,
    '--ossfs-config-script', path.join(bin, 'configure-ossfs'),
    '--app-port', '8084',
    '--report', driftReport,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ACT_TEST_MOUNT: path.join(mountRoot, 'runtime-new'), ACT_TEST_ACTIVE_COUNTER: activeCounter, ACT_TEST_ACTIVE_AFTER_FIRST: 'runtime-other' },
  });
  assert.notEqual(drift.status, 0, 'a changed active receipt after rollback verification must block legacy retirement');
  assert.match(drift.stderr, /active receipt does not select the requested OSS release/);
  assert.equal(fs.existsSync(driftLegacy), true, 'a changed active receipt must preserve the legacy runtime');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

{
  const result = spawnSync('bash', [script,
    '--release-id', 'runtime-new',
    '--rollback-release-id', 'runtime-new',
  ], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'the active release must not be accepted as its own rollback target');
  assert.match(result.stderr, /rollback release must differ from the active release/);
}

{
  const blocked = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-legacy-retirement-blocked-'));
  try {
    const blockedBin = path.join(blocked, 'bin');
    const blockedLegacy = path.join(blocked, 'legacy');
    const blockedMountRoot = path.join(blocked, 'mounts');
    const blockedState = path.join(blocked, 'state');
    const blockedReport = path.join(blocked, 'report.json');
    fs.mkdirSync(blockedBin, { recursive: true });
    fs.mkdirSync(blockedLegacy, { recursive: true });
    fs.mkdirSync(path.join(blockedMountRoot, 'runtime-new'), { recursive: true });
    fs.writeFileSync(path.join(blockedLegacy, 'runtime.json'), '{"legacy":true}\n');
    const blockedHostState = path.join(blockedBin, 'host-state.py');
    fs.writeFileSync(blockedHostState, '#!/usr/bin/env python3\nimport json\nprint(json.dumps({"activeReleaseId": "runtime-new"}))\n');
    fs.chmodSync(blockedHostState, 0o755);
    const makeBlocked = (name, body) => {
      const target = path.join(blockedBin, name);
      fs.writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
      fs.chmodSync(target, 0o755);
    };
    makeBlocked('configure-ossfs', 'exit 0');
    makeBlocked('flock', 'exit 0');
    makeBlocked('systemctl', 'exit 0');
    makeBlocked('findmnt', 'if [[ "$*" == *FSTYPE* ]]; then printf "fuse.ossfs\\n"; else printf "ro\\n"; fi');
    makeBlocked('podman', 'if [[ "$*" == *"act-obe-app" ]]; then printf "%s\\t/app/course-content/runtime\\tfalse\\n%s/knowledge/projection\\t/app/course-content/runtime/knowledge/projection\\tfalse\\n" "$ACT_TEST_MOUNT" "$ACT_TEST_MOUNT"; if [[ "${ACT_TEST_APP_NESTED:-}" == 1 ]]; then printf "%s\\t/app/course-content/runtime/knowledge/projection\\tfalse\\n" "$ACT_TEST_MOUNT"; fi; elif [[ "${ACT_TEST_WORKER_NESTED:-}" == 1 ]]; then printf "%s\\t/app/course-content/runtime/knowledge/projection\\tfalse\\n" "$ACT_TEST_MOUNT"; elif [[ "${ACT_TEST_WORKER_LEGACY:-}" == 1 ]]; then printf "%s/knowledge/projection\\t/app/other\\tfalse\\n" "$ACT_TEST_LEGACY"; fi');
    makeBlocked('curl', 'exit 0');
    makeBlocked('df', 'printf "Filesystem 1B-blocks Used Available Use%% Mounted on\\n/dev/test 1000 100 900 10%% /\\n"');
    makeBlocked('du', 'printf "16\\t%s\\n" "${@: -1}"');
    makeBlocked('sync', 'exit 0');
    const receipt = path.join(blocked, 'rollback.json');
    fs.writeFileSync(receipt, '{}\n');
    const result = spawnSync('bash', [script,
      '--release-id', 'runtime-new', '--rollback-release-id', 'runtime-old',
      '--rollback-verification-receipt', receipt, '--ram-role', 'act-runtime-oss-read',
      '--legacy-runtime-root', blockedLegacy, '--mount-root', blockedMountRoot,
      '--state-dir', blockedState, '--host-state-script', blockedHostState,
      '--ossfs-config-script', path.join(blockedBin, 'configure-ossfs'), '--app-port', '8084',
      '--report', blockedReport,
    ], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${blockedBin}:${process.env.PATH}`, ACT_TEST_MOUNT: path.join(blockedMountRoot, 'runtime-new'), ACT_TEST_WORKER_NESTED: '1' },
    });
    assert.notEqual(result.status, 0, 'worker runtime/projection mounts must block legacy retirement');
    assert.match(result.stderr, /forbidden runtime or knowledge bind/);
    assert.equal(fs.existsSync(blockedLegacy), true, 'blocked retirement must preserve the legacy runtime');
    const nestedApp = spawnSync('bash', [script,
      '--release-id', 'runtime-new', '--rollback-release-id', 'runtime-old',
      '--rollback-verification-receipt', receipt, '--ram-role', 'act-runtime-oss-read',
      '--legacy-runtime-root', blockedLegacy, '--mount-root', blockedMountRoot,
      '--state-dir', blockedState, '--host-state-script', blockedHostState,
      '--ossfs-config-script', path.join(blockedBin, 'configure-ossfs'), '--app-port', '8084',
      '--report', blockedReport,
    ], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${blockedBin}:${process.env.PATH}`, ACT_TEST_MOUNT: path.join(blockedMountRoot, 'runtime-new'), ACT_TEST_APP_NESTED: '1' },
    });
    assert.notEqual(nestedApp.status, 0, 'nested app runtime mounts must block legacy retirement');
    assert.match(nestedApp.stderr, /unexpected nested runtime mount/);
    const legacyWorker = spawnSync('bash', [script,
      '--release-id', 'runtime-new', '--rollback-release-id', 'runtime-old',
      '--rollback-verification-receipt', receipt, '--ram-role', 'act-runtime-oss-read',
      '--legacy-runtime-root', blockedLegacy, '--mount-root', blockedMountRoot,
      '--state-dir', blockedState, '--host-state-script', blockedHostState,
      '--ossfs-config-script', path.join(blockedBin, 'configure-ossfs'), '--app-port', '8084',
      '--report', blockedReport,
    ], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${blockedBin}:${process.env.PATH}`, ACT_TEST_MOUNT: path.join(blockedMountRoot, 'runtime-new'), ACT_TEST_LEGACY: blockedLegacy, ACT_TEST_WORKER_LEGACY: '1' },
    });
    assert.notEqual(legacyWorker.status, 0, 'legacy runtime descendants must block legacy retirement');
    assert.match(legacyWorker.stderr, /still references the legacy runtime/);
  } finally {
    fs.rmSync(blocked, { recursive: true, force: true });
  }
}

const executor = fs.readFileSync(path.join(root, 'scripts/runtime-release/execute-production-runtime-cutover.sh'), 'utf8');
assert.match(executor, /--delete-legacy-runtime/, 'legacy retirement must require an explicit cutover flag');
assert.match(executor, /retire-legacy-runtime-after-oss-cutover\.sh/, 'executor must run the guarded retirement script only after cutover');
assert.match(executor, /--rollback-release-id/, 'legacy retirement must retain an explicit rollback release identity');
assert.match(executor, /--rollback-verification-receipt/, 'legacy retirement must verify a retained rollback release before deletion');
const retirement = fs.readFileSync(script, 'utf8');
assert.match(retirement, /flock -x 9/, 'retirement must use the same host selection lock as activation');
assert.match(retirement, /assert_current_runtime_state/, 'retirement must recheck active state after rollback verification and before deletion');
console.log('runtime legacy retirement contract passed');
