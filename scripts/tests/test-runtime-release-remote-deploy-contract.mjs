import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const remoteDeploy = fs.readFileSync(path.join(root, 'scripts/remote-deploy.sh'), 'utf8');
const podmanDeploy = fs.readFileSync(path.join(root, 'deploy/podman/deploy.sh'), 'utf8');
const activation = fs.readFileSync(path.join(root, 'scripts/runtime-release/activate-runtime-release.sh'), 'utf8');

const ossModeMatch = remoteDeploy.match(/\n\s+ossfs-release\)\n\s+log "- 同步 OSS runtime release 主机工具与已验证 receipt（不复制 runtime 内容）"([\s\S]*?)\n\s+\*\)/);
assert.ok(ossModeMatch, 'remote deploy must have an isolated ossfs-release branch');
const ossMode = ossModeMatch[0];

assert.equal(ossMode.includes('rsync '), false, 'ossfs-release branch must not copy runtime contents with rsync');
assert.match(remoteDeploy, /RUNTIME_DELIVERY_MODE="\$\{RUNTIME_DELIVERY_MODE:-ossfs-blob-view\}"/, 'runtime delivery mode must default to the production blob view');
const blobViewModeMatch = remoteDeploy.match(/\n\s+ossfs-blob-view\)\n\s+log "- ossfs-blob-view：不传输 runtime 内容，绑定远端已物化 view"([\s\S]*?)\n\s+legacy-rsync\)/);
assert.ok(blobViewModeMatch, 'remote deploy must have an isolated ossfs-blob-view branch');
assert.equal(blobViewModeMatch[0].includes('rsync '), false, 'ossfs-blob-view branch must not copy runtime contents with rsync');
assert.match(remoteDeploy, /check_remote_blob_view/, 'blob-view deployment must verify the already materialized view');
assert.match(
  remoteDeploy,
  /缺失时失败关闭而不是 rsync runtime/,
  'missing blob-view must fail closed instead of falling back to rsync',
);
assert.match(remoteDeploy, /require_oss_runtime_release_inputs\n/, 'OSS release selection must validate local inputs before remote mutation');
assert.match(remoteDeploy, /RUNTIME_VERIFICATION_RECEIPT="\$\{RUNTIME_VERIFICATION_RECEIPT:-\}"/, 'OSS deployment requires a verified release receipt');
assert.match(remoteDeploy, /sync_oss_runtime_release_host_tools/, 'OSS deployment must install only host activation tools and a receipt');
assert.ok(remoteDeploy.includes('--expected-active-release \\"${RUNTIME_EXPECTED_ACTIVE_RELEASE}\\"'), 'OSS activation must fence the expected active release');
assert.ok(remoteDeploy.includes('ACT_RUNTIME_OSS_RAM_ROLE=\\"${RUNTIME_OSS_RAM_ROLE}\\"'), 'app delivery must use the role name rather than static keys');
assert.match(remoteDeploy, /findmnt -rn -T '\$\{REMOTE_RUNTIME_DIR\}' -o OPTIONS \| grep -Eq '\(\^\|,\)ro/, 'post-deploy validation must keep the mounted runtime read-only');
assert.match(remoteDeploy, /REMOTE_RUNTIME_SELECTION_LOCK="\$\{REMOTE_RUNTIME_SELECTION_LOCK:-\$\{REMOTE_PROJECT_DIR\}\/data\/runtime\/\.act-runtime-selection\.lock\}"/, 'Legacy deployment must share the activation and retirement selection lock');
assert.match(remoteDeploy, /Step 0\/8: 在 runtime 锁内替换 Legacy runtime/, 'Legacy runtime replacement must happen inside the remote lock-held deployment transaction');
assert.match(remoteDeploy, /active OSS runtime receipt is present; Legacy deployment is forbidden/, 'a Legacy deployment must fail closed once OSS activation is recorded');

assert.match(podmanDeploy, /RUNTIME_DELIVERY_MODE="\$\{RUNTIME_DELIVERY_MODE:-ossfs-blob-view\}"/, 'Podman deploy must default to the production blob view');
assert.match(
  podmanDeploy,
  /data\/runtime\/blob-views\/current/,
  'Podman deploy must bind the materialized blob view when no runtime path is provided',
);
assert.match(podmanDeploy, /ossfs-release\)/, 'Podman deploy must have an OSS mount guard');
assert.match(podmanDeploy, /\.act-runtime-release\.v1\.json/, 'Podman deploy must require a mounted immutable manifest');
assert.match(podmanDeploy, /findmnt -rn -T "\$RUNTIME_CONTENT_DIR" -o OPTIONS/, 'Podman deploy must reject non-read-only runtime mounts');
assert.match(podmanDeploy, /-v "\$\{RUNTIME_CONTENT_DIR\}:\/app\/course-content\/runtime:ro"/, 'container runtime bind must remain read-only');
assert.match(podmanDeploy, /operator_runtime_content_dir_was_set/, 'explicit activation runtime path must not be overwritten by persisted legacy runtime env');
assert.match(podmanDeploy, /operator_runtime_delivery_mode_was_set/, 'explicit OSS delivery mode must not be overwritten by persisted legacy runtime env');
assert.ok(
  podmanDeploy.indexOf('if [ -f "$RUNTIME_ENV_FILE" ]; then')
    < podmanDeploy.indexOf('RUNTIME_CONTENT_DIR="$operator_runtime_content_dir"'),
  'runtime path override must be restored after the persisted runtime env is read',
);
assert.ok(
  podmanDeploy.indexOf('if [ -f "$RUNTIME_ENV_FILE" ]; then')
    < podmanDeploy.indexOf('RUNTIME_DELIVERY_MODE="$operator_runtime_delivery_mode"'),
  'runtime delivery mode override must be restored after the persisted runtime env is read',
);
assert.match(
  podmanDeploy,
  /if \[ "\$RUNTIME_DELIVERY_MODE" = "ossfs-release" \] \|\| \[ "\$RUNTIME_DELIVERY_MODE" = "ossfs-blob-view" \]; then\n  TEACHING_PROJECTION_STORE_DIR="\$\{RUNTIME_CONTENT_DIR\}\/knowledge\/projection"/,
  'OSS runtime cutover must not retain a nested projection bind from the legacy runtime tree',
);

assert.match(activation, /verify-mounted/, 'activation must verify the mounted release before replacing application containers');
assert.match(activation, /ACT_RUNTIME_OSS_RAM_ROLE="\$ram_role"/, 'activation must pass only a RAM role name to the application');
assert.equal(activation.includes('rm -rf'), false, 'activation must not delete a prior runtime release');

console.log('runtime release remote deployment contract passed');
