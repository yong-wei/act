import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const config = fs.readFileSync(path.join(root, 'scripts/runtime-release/configure-runtime-ossfs-release.sh'), 'utf8');
const service = fs.readFileSync(path.join(root, 'scripts/runtime-release/act-runtime-ossfs@.service'), 'utf8');
const activation = fs.readFileSync(path.join(root, 'scripts/runtime-release/activate-runtime-release.sh'), 'utf8');
const rollback = fs.readFileSync(path.join(root, 'scripts/runtime-release/rollback-runtime-release.sh'), 'utf8');
const hostState = fs.readFileSync(path.join(root, 'scripts/runtime-release/runtime-release-host-state.py'), 'utf8');
const nextConfig = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');

for (const invariant of [
  '--oss_endpoint=https://oss-cn-hangzhou-internal.aliyuncs.com',
  '--oss_bucket=act-course-assets',
  '--oss_region=cn-hangzhou',
  '--ram_role=${ram_role}',
  '--oss_bucket_prefix=runtime/releases/${release_id}/',
  '--ro=true',
  '--allow_other=true',
  '--file_mode=0644',
  '--dir_mode=0755',
]) {
  assert.ok(config.includes(invariant), `ossfs configuration must include ${invariant}`);
}
assert.doesNotMatch(config, /OSS_ACCESS_KEY|ACCESS_KEY_SECRET|access_key_secret/i, 'ossfs configuration must not write long-lived credentials');
assert.match(nextConfig, /serverExternalPackages:\s*\['@alicloud\/credentials', 'ali-oss'\]/, 'Aliyun Node SDKs must remain external server packages for standalone builds');
assert.match(service, /ossfs2 mount/, 'systemd unit must mount ossfs2');
assert.match(service, /RemainAfterExit=yes/, 'systemd unit must track the mounted state');
for (const invariant of [
  'flock -x 9',
  '--verification-receipt',
  'verify-mounted',
  'findmnt -rn -T "$MOUNT_ROOT/$release_id" -o FSTYPE',
  "grep -Eq '(^|,)ro(,|$)'",
  'RUNTIME_CONTENT_DIR="$MOUNT_ROOT/$release_id"',
  'LEGACY_RUNTIME_ROOT=',
  'candidate_deploy_attempted=1',
  'mark-active',
  'rollback()',
  'ACT_RUNTIME_DEPLOY_MODE',
  'invalid runtime deploy mode',
  'capture_rollback_image()',
  'existing app image digest is invalid',
  'existing worker image digest is invalid',
  'app_image="sha256:${BASH_REMATCH[2]}"',
  'app and worker must use the same image before runtime cutover',
  'APP_IMAGE="$rollback_app_image"',
  'ACT_RUNTIME_APP_REVISION',
  'ACT_RUNTIME_IMAGE_DIGEST',
  'ACT_RUNTIME_RELEASE_LOCATOR_SHA256',
  'configure_startup_order()',
  'restore_startup_order()',
  'Requires=act-runtime-ossfs@${release_id}.service',
  'systemctl enable "act-runtime-ossfs@${release_id}.service"',
]) {
  assert.ok(activation.includes(invariant), `activation must include ${invariant}`);
}
assert.match(config, /--ram_role=\$\{ram_role\}/, 'ossfs configuration must bind the ECS RAM role');
assert.match(activation, /\[\[ "\$DEPLOY_MODE" == "--app-only" \|\| "\$DEPLOY_MODE" == "--runtime-cutover-app-only" \]\]/, 'activation must allow only fixed app deployment modes');
assert.match(rollback, /--expected-active-release/, 'rollback must fence the actually active release before switching');
assert.match(rollback, /--verification-receipt/, 'rollback must require a revalidated immutable release receipt');
assert.doesNotMatch(hostState, /from __future__ import annotations|\b(?:list|dict|tuple|set)\[/, 'host state utility must remain Python 3.6 syntax-compatible with ECS');
assert.doesNotMatch(hostState, /add_subparsers\([^\n]*required=/, 'host state utility must not rely on Python 3.7 argparse subparser requirements');

console.log('runtime release deployment contract passed');
