import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const activation = fs.readFileSync(path.join(root, 'scripts/runtime-release/activate-runtime-blob-release.sh'), 'utf8');
const runtimeDeploy = fs.readFileSync(path.join(root, 'scripts/deploy-runtime-blob-release.sh'), 'utf8');
const appDeploy = fs.readFileSync(path.join(root, 'scripts/remote-deploy.sh'), 'utf8');
const deployAll = fs.readFileSync(path.join(root, 'scripts/deploy-all-with-runtime-blobs.sh'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const podmanDeploy = fs.readFileSync(path.join(root, 'deploy/podman/deploy.sh'), 'utf8');
const config = fs.readFileSync(path.join(root, 'scripts/runtime-release/configure-runtime-blob-ossfs.sh'), 'utf8');
const service = fs.readFileSync(path.join(root, 'scripts/runtime-release/act-runtime-blob-ossfs.service'), 'utf8');

for (const invariant of [
  '--manifest',
  '--release-receipt',
  '--verification-receipt',
  '--parent-view',
  '--parent-runtime-root',
  'verify-mounted --format v2',
  'mount --bind "$BLOB_ROOT" "$helper"',
  'mount -o remount,bind,ro "$helper"',
  'RUNTIME_DELIVERY_MODE=ossfs-blob-view',
  '--runtime-cutover-app-only',
  'mark-active',
  'ACT_RUNTIME_BLOB_LIFECYCLE_SCRIPT',
  'begin-publish',
  'set-desired',
  'activate_lifecycle()',
  'expected-generation',
  'lifecycle_generation',
  'restore_runtime_consumers()',
]) {
  assert.ok(activation.includes(invariant), `runtime-only activation must include ${invariant}`);
}
assert.ok(
  activation.indexOf('stage_lifecycle_desired') < activation.indexOf('python3 "$HOST_STATE_SCRIPT" select'),
  'v2 desired lifecycle state must be staged before the legacy selector changes',
);
assert.ok(
  activation.indexOf('activate_lifecycle') < activation.indexOf('python3 "$HOST_STATE_SCRIPT" mark-active'),
  'v2 lifecycle activation must precede the legacy active receipt projection',
);
assert.match(activation, /LIFECYCLE_SCRIPT=.*runtime-blob-release-lifecycle\.py/, 'activation must invoke the v2 lifecycle authority');
assert.ok(activation.includes('"$LIFECYCLE_SCRIPT" rollback'), 'failed post-activation work must roll back the v2 lifecycle');
for (const forbidden of [
  'scripts/build.sh',
  'act-obe.tar',
  'export-db',
  'import-db',
  'configure-nginx',
  'systemctl ',
]) {
  assert.equal(activation.includes(forbidden), false, `runtime-only activation must not contain ${forbidden}`);
}

assert.match(podmanDeploy, /ossfs-blob-view\)/, 'Podman deployment must recognize the v2 blob view mode');
assert.match(podmanDeploy, /\.act-runtime-release\.v2\.json/, 'v2 blob views must require their manifest');
assert.match(podmanDeploy, /\.act-runtime-release-materialization\.v1\.json/, 'v2 blob views must require their local receipt');
assert.match(podmanDeploy, /findmnt -rn -M "\$helper_root" -o OPTIONS/, 'v2 blob helper mount must be checked read-only');
assert.match(podmanDeploy, /-v "\$\{RUNTIME_CONTENT_DIR\}:\/app\/course-content\/runtime:ro"/, 'application runtime bind must remain read-only');

for (const invariant of [
  '--oss_bucket_prefix=runtime/blobs/sha256/',
  '--ro=true',
  '--ram_role=${ram_role}',
]) {
  assert.ok(config.includes(invariant), `blob ossfs config must include ${invariant}`);
}
assert.doesNotMatch(config, /ACCESS_KEY|SECRET/i, 'blob ossfs config must not persist access keys');
assert.match(service, /ossfs2 mount/, 'blob ossfs service must mount ossfs2');
assert.match(service, /RemainAfterExit=yes/, 'blob ossfs service must track its mount state');

for (const invariant of [
  'build-manifest',
  'publish-streaming',
  '--parent-manifest',
  '--expected-active-release',
  'publisher-verification.json',
  'daily-publication-report.json',
  '--daily-report-output',
  'timingMilliseconds',
  'lifecycle-identity.json',
  'runtime-blob-release-lifecycle.py',
  'begin-publish',
  'activate-runtime-blob-release.sh',
  'remote path is unsafe',
  'treeSha256',
  'noRuntimeChange',
]) {
  assert.ok(runtimeDeploy.includes(invariant), `runtime deploy must include ${invariant}`);
}
assert.match(
  runtimeDeploy,
  /publish-streaming[^\n]*--manifest "\$manifest"/,
  'runtime deploy must publish the already planned manifest without a second Git body-hash pass',
);
assert.match(
  runtimeDeploy,
  /publish_args\+=\(--parent-manifest "\$parent_manifest"\)/,
  'runtime deploy must pass the parent manifest to publish-streaming so inherited Git blobs remain body-read and HEAD free',
);
assert.match(
  runtimeDeploy,
  /matching_parent_release_id" && "\$matching_parent_release_id" == "\$expected_active_release"/,
  'unchanged runtime may bypass publication only when its parent is the expected active release',
);
assert.match(
  runtimeDeploy,
  /active runtime selection does not match the unchanged parent manifest/,
  'unchanged runtime must validate the active identity before returning no-op',
);
assert.ok(
  runtimeDeploy.indexOf('begin-publish') < runtimeDeploy.indexOf('publish_started_seconds=$SECONDS'),
  'candidate lifecycle protection must be recorded before local blob publication starts',
);
assert.ok(
  runtimeDeploy.indexOf('copy_atomic "$ROOT_DIR/scripts/runtime-release/runtime-blob-release-lifecycle.py"') < runtimeDeploy.indexOf('begin-publish'),
  'the lifecycle authority must be synchronized before it records the candidate root',
);

assert.equal(packageJson.scripts['deploy:runtime'], 'bash ./scripts/deploy-runtime-blob-release.sh');
assert.equal(packageJson.scripts['deploy:app'], 'bash ./scripts/remote-deploy.sh --app-only');
assert.equal(packageJson.scripts['deploy:all'], 'bash ./scripts/deploy-all-with-runtime-blobs.sh');
assert.match(deployAll, /deploy-runtime-blob-release\.sh" "\$@"/, 'combined deployment must forward release arguments only to the runtime operation');
assert.match(deployAll, /remote-deploy\.sh" --app-only/, 'combined deployment must run application deployment without a runtime pipeline');
assert.match(appDeploy, /DEPLOY_SCOPE="app"/, 'application deployment must select its app-only scope explicitly');
assert.match(appDeploy, /--app-only：保留当前 runtime 选择/, 'application deployment must retain the existing runtime selection');
assert.match(appDeploy, /if \[\[ "\$\{DEPLOY_SCOPE\}" == "all" && "\$\{RUNTIME_DELIVERY_MODE\}" == "legacy-rsync" \]\]; then/, 'legacy runtime synchronization must be gated to the full deployment scope');
assert.match(appDeploy, /--app-only：跳过 runtime release 验证/, 'application deployment must skip runtime release verification');
for (const forbidden of [
  'scripts/build.sh',
  'act-obe.tar',
  'export-db',
  'import-db',
  'configure-nginx',
  'systemctl ',
  'rsync ',
]) {
  assert.equal(runtimeDeploy.includes(forbidden), false, `runtime deploy must not contain ${forbidden}`);
}

console.log('runtime blob runtime-only deployment contract passed');
