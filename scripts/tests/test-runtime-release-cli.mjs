import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts/runtime-release/act-runtime-release.ts');
const source = fs.readFileSync(script, 'utf8');
const bridge = fs.readFileSync(path.join(root, 'scripts/runtime-release/runtime-release-oss-publisher-bridge.py'), 'utf8');
const resolverRoute = fs.readFileSync(path.join(root, 'src/app/api/course-runtime/assets/[...assetPath]/route.ts'), 'utf8');

assert.match(source, /\['plan', 'verify-media-closure', 'publish-streaming', 'verify', 'inspect'\]/, 'CLI must expose only the streaming write command');
assert.doesNotMatch(source, /command === ['"]publish['"]|\bpublish --runtime-root/, 'CLI must not expose a direct mutating publish command');
assert.match(source, /roleName: required\('--role-name'\)/, 'CLI must require an ECS RAM role name');
assert.doesNotMatch(source, /ACCESS_KEY|accessKeySecret|--secret|--access-key/i, 'CLI must not accept static AccessKey or Secret input');
assert.doesNotMatch(source, /createEcsRamRoleOssRuntimeReleaseStore|publishRuntimeRelease\(/, 'production CLI must not import a direct mutating store helper');
assert.doesNotMatch(resolverRoute, /createEcsRamRoleOssRuntimeReleaseStore|publishRuntimeRelease\(|putStream/, 'runtime asset resolver must remain read/sign-only');
assert.match(source, /verifyPublishedRuntimeRelease/, 'verify must revalidate the published release');
assert.match(source, /inspectPublishedRuntimeRelease/, 'inspect must read the published manifest');
assert.match(source, /deriveRuntimeReleaseId/, 'plan and publish must derive the content-addressed release identity');
assert.match(source, /publishRuntimeReleaseViaSsh/, 'streaming publish must use the SSH source-authoritative transport');
assert.match(source, /buildRuntimeReleaseMediaClosure/, 'media closure verification must bind published resources to the release manifest');
assert.match(source, /--known-hosts-file/, 'streaming publish must require an explicit known-hosts file');
assert.match(bridge, /api", "put-object"/, 'ECS bridge must use the ossutil v2 PutObject API');
assert.match(bridge, /--forbid-overwrite/, 'ECS bridge must use conditional no-overwrite semantics');
assert.match(bridge, /api", "list-objects-v2"/, 'ECS bridge must use the ossutil v2 JSON listing API');
assert.match(bridge, /DEFAULT_OSSUTIL_PATH\s*=\s*["']\/opt\/act-ops\/ossutil-2\.3\.0\/ossutil["']/, 'ECS bridge must use the fixed v2 ossutil writer path by default');
assert.match(bridge, /EXPECTED_OSSUTIL_SHA256\s*=\s*["']1a0b6d3f955d464a6dec9d7c3f81c036781619f012311d20a4c69a4c626ed356["']/, 'ECS bridge must pin the v2 ossutil writer SHA-256');
assert.match(bridge, /os\.lstat\(DEFAULT_OSSUTIL_PATH\)/, 'ECS bridge must inspect the fixed v2 writer on every production process start');
assert.match(bridge, /details\.st_uid != 0|details\.st_uid\s*!=\s*0/, 'ECS bridge must require a root-owned v2 writer');
assert.match(bridge, /stat\.S_IMODE\(details\.st_mode\) & 0o022/, 'ECS bridge must reject group/other-writable v2 writers');
assert.match(bridge, /DEFAULT_V1_OSSUTIL_PATH\s*=\s*["']\/usr\/local\/bin\/ossutil["']/, 'ECS bridge must retain only the fixed v1 read-only cross-check path');
assert.doesNotMatch(bridge, /--role-arn/, 'ECS bridge must not pass a role name as a v2 ARN');
assert.doesNotMatch(bridge, /os\.environ\.get\(['"]ACT_RUNTIME_RELEASE_OSSUTIL['"],\s*['"]ossutil['"]\)/, 'ECS bridge must not resolve the writer through PATH');
assert.match(bridge, /OBJECT_NUMBER_SUMMARY|TOTAL_SIZE_SUMMARY|ELAPSED_SUMMARY/, 'ECS bridge must recognize only explicit v1 summary lines');
assert.match(bridge, /remote release list contains duplicate object/, 'ECS bridge must reject duplicate v1 object URLs');
assert.match(bridge, /continuation-token|NextContinuationToken/, 'ECS bridge must consume complete v2 continuation pages');
assert.match(bridge, /cross_check_v1_keys/, 'ECS bridge must cross-check the final v2 key set with v1 ls');
assert.match(bridge, /--ecs-role-name|EXPECTED_ECS_ROLE_NAME/, 'ECS bridge must bind ossutil to the expected ECS RAM role');
assert.match(bridge, /DEFAULT_IMDS_ROLE_URL|current_ecs_role_name/, 'ECS bridge must validate the current ECS RAM role through IMDS');
assert.match(bridge, /oss-cn-hangzhou-internal\.aliyuncs\.com/, 'ECS bridge must use the internal OSS endpoint');
assert.match(bridge, /"--region", OSS_REGION/, 'ECS bridge must pin the v2 OSS region');
assert.match(bridge, /remote_digest\(bucket, key\)/, 'ECS bridge must re-read and hash every uploaded object');
assert.match(bridge, /fcntl\.flock\(lock_file\.fileno\(\), fcntl\.LOCK_EX\)/, 'ECS bridge must hold an exclusive per-release lock');
assert.match(bridge, /DEFAULT_LOCK_DIR\s*=\s*["']\/var\/lib\/act\/runtime-release-locks["']/, 'ECS bridge must default its release lock outside globally writable temporary storage');
assert.match(bridge, /DEFAULT_SPOOL_DIR\s*=\s*["']\/var\/lib\/act\/runtime-release-spool["']/, 'ECS bridge must use the fixed private spool root');
assert.match(bridge, /MAX_FRAME_BYTES\s*=\s*256 \* 1024 \* 1024/, 'ECS bridge must cap each spooled frame at 256 MiB');
assert.match(bridge, /MIN_FREE_BYTES\s*=\s*1024 \* 1024 \* 1024/, 'ECS bridge must preserve a 1 GiB spool reserve');
assert.match(bridge, /tempfile\.mkstemp/, 'ECS bridge must exclusively create unpredictable spool files');
assert.match(bridge, /runtime release spool contains residual files/, 'ECS bridge must reject residual spool files instead of broad cleanup');
assert.match(bridge, /choices=\("list", "get", "publish"\)/, 'ECS bridge must expose the transaction publish protocol only');
assert.match(bridge, /put_payload\(bucket, manifest_key, wire, wire_sha/, 'ECS bridge must upload the completion manifest after object frames');
assert.match(bridge, /wire digest does not match the serialized bytes/, 'ECS bridge must validate manifest wireSha256');
assert.doesNotMatch(bridge, /ossutil_argv\("v1", \["cp"/, 'ECS bridge must never write through ossutil v1');
assert.doesNotMatch(bridge, /from __future__ import annotations|\b(?:list|dict|tuple|set)\[|\b\w+\s*\|\s*\w+/, 'ECS bridge must remain Python 3.6 syntax-compatible');
assert.match(bridge, /universal_newlines=True/, 'ECS bridge must use the Python 3.6 subprocess text compatibility spelling');
assert.doesNotMatch(bridge, /current\.json|selector|container|rsync/, 'ECS bridge must not touch runtime selection or staging state');

const result = spawnSync('npx', ['tsx', script, '--help'], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /AccessKey or Secret/, 'help must state the credential boundary');

console.log('runtime release CLI contract passed');
