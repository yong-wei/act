import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts/runtime-release/act-runtime-release.ts');
const source = fs.readFileSync(script, 'utf8');
const bridge = fs.readFileSync(path.join(root, 'scripts/runtime-release/runtime-release-oss-publisher-bridge.py'), 'utf8');
const resolverRoute = fs.readFileSync(path.join(root, 'src/app/api/course-runtime/assets/[...assetPath]/route.ts'), 'utf8');

assert.match(source, /\['plan', 'publish-streaming', 'verify', 'inspect'\]/, 'CLI must expose only the streaming write command');
assert.doesNotMatch(source, /command === ['"]publish['"]|\bpublish --runtime-root/, 'CLI must not expose a direct mutating publish command');
assert.match(source, /roleName: required\('--role-name'\)/, 'CLI must require an ECS RAM role name');
assert.doesNotMatch(source, /ACCESS_KEY|accessKeySecret|--secret|--access-key/i, 'CLI must not accept static AccessKey or Secret input');
assert.doesNotMatch(source, /createEcsRamRoleOssRuntimeReleaseStore|publishRuntimeRelease\(/, 'production CLI must not import a direct mutating store helper');
assert.doesNotMatch(resolverRoute, /createEcsRamRoleOssRuntimeReleaseStore|publishRuntimeRelease\(|putStream/, 'runtime asset resolver must remain read/sign-only');
assert.match(source, /verifyPublishedRuntimeRelease/, 'verify must revalidate the published release');
assert.match(source, /inspectPublishedRuntimeRelease/, 'inspect must read the published manifest');
assert.match(source, /deriveRuntimeReleaseId/, 'plan and publish must derive the content-addressed release identity');
assert.match(source, /publishRuntimeReleaseViaSsh/, 'streaming publish must use the SSH source-authoritative transport');
assert.match(source, /--known-hosts-file/, 'streaming publish must require an explicit known-hosts file');
assert.match(bridge, /ossutil_command\(\), "cp", "-"/, 'ECS bridge must stream stdin directly to ossutil cp -');
assert.match(bridge, /"--force=false"/, 'ECS bridge must refuse overwrite semantics at the ossutil boundary');
assert.match(bridge, /remote_digest\(bucket, key\)/, 'ECS bridge must re-read and hash every uploaded object');
assert.match(bridge, /fcntl\.flock\(lock_file\.fileno\(\), fcntl\.LOCK_EX\)/, 'ECS bridge must hold an exclusive per-release lock');
assert.match(bridge, /ACT_RUNTIME_RELEASE_LOCK_DIR", "\/var\/lib\/act\/runtime-release-locks"/, 'ECS bridge must default its release lock outside globally writable temporary storage');
assert.match(bridge, /choices=\("list", "get", "publish"\)/, 'ECS bridge must expose the transaction publish protocol only');
assert.match(bridge, /put_bytes\(bucket, manifest_key, wire, len\(wire\), wire_sha/, 'ECS bridge must upload the completion manifest after object frames');
assert.match(bridge, /wire digest does not match the serialized bytes/, 'ECS bridge must validate manifest wireSha256');
assert.doesNotMatch(bridge, /current\.json|selector|container|rsync/, 'ECS bridge must not touch runtime selection or staging state');

const result = spawnSync('npx', ['tsx', script, '--help'], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /AccessKey or Secret/, 'help must state the credential boundary');

console.log('runtime release CLI contract passed');
