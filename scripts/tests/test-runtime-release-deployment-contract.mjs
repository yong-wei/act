import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const config = fs.readFileSync(path.join(root, 'scripts/runtime-release/configure-runtime-ossfs-release.sh'), 'utf8');
const service = fs.readFileSync(path.join(root, 'scripts/runtime-release/act-runtime-ossfs@.service'), 'utf8');
const activation = fs.readFileSync(path.join(root, 'scripts/runtime-release/activate-runtime-release.sh'), 'utf8');
const rollback = fs.readFileSync(path.join(root, 'scripts/runtime-release/rollback-runtime-release.sh'), 'utf8');
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
]) {
  assert.ok(activation.includes(invariant), `activation must include ${invariant}`);
}
assert.match(rollback, /--expected-active-release/, 'rollback must fence the actually active release before switching');
assert.match(rollback, /--verification-receipt/, 'rollback must require a revalidated immutable release receipt');

console.log('runtime release deployment contract passed');
