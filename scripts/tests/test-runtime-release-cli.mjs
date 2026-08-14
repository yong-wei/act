import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const script = path.join(root, 'scripts/runtime-release/act-runtime-release.ts');
const source = fs.readFileSync(script, 'utf8');
const bridge = fs.readFileSync(path.join(root, 'scripts/runtime-release/runtime-release-oss-publisher-bridge.py'), 'utf8');
const blobPublish = bridge.slice(bridge.indexOf('def publish_blob_release('), bridge.indexOf('def validate_blob_import_header('));
const resolverRoute = fs.readFileSync(path.join(root, 'src/app/api/course-runtime/assets/[...assetPath]/route.ts'), 'utf8');

assert.match(source, /\['plan', 'build-manifest', 'verify-media-closure', 'publish-streaming', 'import-v1', 'verify', 'inspect'\]/, 'CLI must expose only Git streaming publish and the fixed v1 import write commands');
assert.doesNotMatch(source, /command === ['"]publish['"]|\bpublish --runtime-root/, 'CLI must not expose a direct mutating publish command');
assert.match(source, /verifyPublishedRuntimeReleaseViaSsh/, 'verify must run through the ECS read-role bridge instead of local IMDS');
assert.match(source, /verifyPublishedRuntimeBlobReleaseViaSsh/, 'v2 verify must run through the ECS read-role bridge instead of local IMDS');
assert.match(source, /sshBridgeOptions\(\)/, 'verify and inspect must require the pinned SSH bridge options');
assert.doesNotMatch(source, /createEcsRamRoleOssRuntimeReleaseReader|--role-name|--region/, 'local CLI must not pretend to hold ECS RAM role credentials');
assert.doesNotMatch(source, /ACCESS_KEY|accessKeySecret|--secret|--access-key/i, 'CLI must not accept static AccessKey or Secret input');
assert.doesNotMatch(source, /createEcsRamRoleOssRuntimeReleaseStore|publishRuntimeRelease\(/, 'production CLI must not import a direct mutating store helper');
assert.doesNotMatch(resolverRoute, /createEcsRamRoleOssRuntimeReleaseStore|publishRuntimeRelease\(|putStream/, 'runtime asset resolver must remain read/sign-only');
assert.match(source, /inspectPublishedRuntimeRelease/, 'inspect must read the published manifest');
assert.match(source, /deriveRuntimeReleaseId/, 'plan and publish must derive the content-addressed release identity');
assert.match(source, /publishRuntimeReleaseViaSsh/, 'streaming publish must use the SSH source-authoritative transport');
assert.match(source, /publishRuntimeBlobReleaseLocally/, 'v2 streaming publish must use the local operator transport');
assert.match(source, /openPlannedGitManifest/, 'v2 streaming publish must reuse the already planned manifest rather than rebuild and rehash it');
assert.match(source, /--manifest <manifest\.json>/, 'v2 streaming publish must require an immutable planned manifest');
assert.match(source, /--daily-report-output <report\.json>/, 'v2 CLI must emit a separately mutable operational report without extending the immutable receipt');
assert.doesNotMatch(source, /publishRuntimeBlobReleaseViaSsh/, 'daily v2 publishing must not retain the ECS SSH writer path');
assert.match(source, /importV1RuntimeBlobReleaseViaSsh/, 'the one-time v1 import must use the SSH source-authoritative transport');
assert.match(source, /--source-release-id <immutable-v1-release-id>/, 'v1 import must require an immutable source release rather than a selector alias');
assert.match(source, /--source-manifest-sha256 <sha256>/, 'v1 import must pin the source manifest identity');
assert.match(source, /buildRuntimeBlobReleaseManifest/, 'v2 CLI operations must build the deterministic blob-backed manifest locally before streaming');
assert.match(source, /integrationRef: ['"]origin\/integration['"]/, 'production v2 CLI must pin ancestry authority to origin/integration');
assert.doesNotMatch(source, /--integration-ref <ref>/, 'production v2 CLI must not expose an ancestry override');
assert.match(source, /buildRuntimeReleaseMediaClosure/, 'media closure verification must bind published resources to the release manifest');
assert.match(source, /--known-hosts-file/, 'streaming publish must require an explicit known-hosts file');
assert.match(source, /--local-bridge-path/, 'v2 publishing must require an explicit local bridge path');
assert.match(source, /--ossutil-sha256/, 'v2 publishing must pin the local ossutil binary');
assert.match(source, /--identity-command-sha256/, 'v2 publishing must pin the local identity command');
assert.match(source, /--operator-principal-arn/, 'v2 publishing must require the expected local operator principal');
assert.match(bridge, /api", "put-object"/, 'ECS bridge must use the ossutil v2 PutObject API');
assert.match(bridge, /"--forbid-overwrite", "true"/, 'v2 blob publication must use conditional no-overwrite semantics');
assert.match(bridge, /api", "head-object"/, 'v2 blob publication must use object metadata reads for unknown blobs');
assert.match(bridge, /x-oss-meta-sha256=.*expected_sha/, 'v2 blob publication must persist the source SHA-256 in immutable object metadata');
assert.match(bridge, /def parent_blob_bindings\(/, 'v2 publication must load the immutable parent receipt before reusing blobs');
assert.match(bridge, /inherited_blob_count/, 'v2 publication must report inherited blobs independently from metadata checks');
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
assert.match(bridge, /configure_local_publisher|current_local_principal/, 'the bridge must provide a separately preflighted local publisher mode');
assert.match(bridge, /GetCallerIdentity/, 'the local publisher must verify the configured operator principal before OSS writes');
assert.doesNotMatch(bridge, /GetCallerIdentity", "--output", "json"/, 'the local publisher identity preflight must remain compatible with the installed Alibaba Cloud CLI output contract');
assert.match(bridge, /--credential-mode/, 'the bridge must require an explicit credential-mode boundary');
assert.match(bridge, /return \[ossutil_command\(version\)\] \+ arguments \+ \["--endpoint", LOCAL_OSS_ENDPOINT, "--region", OSS_REGION\]/, 'local publishing must use the configured local credential provider without an ECS RAM role flag');
assert.match(bridge, /ECS_OSS_ENDPOINT\s*=\s*["']oss-cn-hangzhou-internal\.aliyuncs\.com["']/, 'ECS bridge must use the internal OSS endpoint');
assert.match(bridge, /LOCAL_OSS_ENDPOINT\s*=\s*["']https:\/\/oss-cn-hangzhou\.aliyuncs\.com["']/, 'the local publisher must use the public Hangzhou endpoint instead of ECS-only DNS');
assert.match(bridge, /"--region", OSS_REGION/, 'ECS bridge must pin the v2 OSS region');
assert.match(bridge, /remote_digest\(bucket, key\)/, 'immutable release documents must retain byte-level verification');
assert.doesNotMatch(blobPublish, /list_objects_v2\(bucket, BLOB_KEY_PREFIX\)/, 'daily v2 publication must not inventory the complete shared blob namespace');
assert.match(bridge, /fcntl\.flock\(lock_file\.fileno\(\), fcntl\.LOCK_EX\)/, 'ECS bridge must hold an exclusive per-release lock');
assert.match(bridge, /DEFAULT_LOCK_DIR\s*=\s*["']\/var\/lib\/act\/runtime-release-locks["']/, 'ECS bridge must default its release lock outside globally writable temporary storage');
assert.match(bridge, /DEFAULT_SPOOL_DIR\s*=\s*["']\/var\/lib\/act\/runtime-release-spool["']/, 'ECS bridge must use the fixed private spool root');
assert.match(bridge, /MAX_FRAME_BYTES\s*=\s*256 \* 1024 \* 1024/, 'ECS bridge must cap each spooled frame at 256 MiB');
assert.match(bridge, /MIN_FREE_BYTES\s*=\s*1024 \* 1024 \* 1024/, 'ECS bridge must preserve a 1 GiB spool reserve');
assert.match(bridge, /tempfile\.mkstemp/, 'ECS bridge must exclusively create unpredictable spool files');
assert.match(bridge, /runtime release spool contains residual files/, 'ECS bridge must reject residual spool files instead of broad cleanup');
assert.match(bridge, /choices=\("list", "get", "publish", "import-v1", "verify"\)/, 'ECS bridge must expose the fixed v1 import and verification protocols alongside publishing');
assert.match(bridge, /BLOB_RELEASE_KEY_PREFIX\s*=\s*["']runtime\/blob-releases\/["']/, 'v2 release documents must use a namespace separate from v1 runtime releases');
assert.match(bridge, /def import_v1_blob_release\(/, 'ECS bridge must provide the bounded fixed-v1 importer');
assert.match(bridge, /ECS_ROLE_NAME\s*=\s*["']act-runtime-oss-release-operator-ecs["']/, 'the retained ECS bridge must keep its explicit legacy role identity');
assert.match(bridge, /EXPECTED_ECS_ROLE_NAME\s*=\s*ECS_ROLE_NAME/, 'ECS bridge operations must use one immutable role allowlist');
assert.doesNotMatch(bridge, /act-runtime-oss-(?:publisher|read)/, 'bridge must not retain the retired split publisher/read role names');
assert.match(bridge, /def verify_operation\(/, 'read-role verification must execute entirely on ECS');
assert.match(bridge, /READINESS_SAMPLE_MAX_BYTES\s*=\s*4 \* 1024 \* 1024/, 'read-role verification must bound representative content reads');
assert.match(bridge, /selected_indexes = sorted\(\{0, len\(candidates\) \/\/ 2, len\(candidates\) - 1\}\)/, 'read-role verification must sample deterministic representatives');
assert.doesNotMatch(bridge, /for entry in files:\n        if remote_digest\(bucket, entry\["key"\]\)/, 'read-role verification must not rehash every published object');
assert.match(bridge, /MANIFEST_SCHEMA_VERSION\s*=\s*["']act-runtime-release\.v1["']/, 'read-role verification must pin the manifest schema version');
assert.match(bridge, /BLOB_MANIFEST_SCHEMA_VERSION\s*=\s*["']act-runtime-release\.v2["']/, 'v2 publishing must pin the blob manifest schema version');
assert.match(bridge, /BLOB_RECEIPT_SCHEMA_VERSION\s*=\s*["']act-runtime-release-receipt\.v2["']/, 'v2 publishing must pin the immutable blob receipt schema version');
assert.match(bridge, /manifest tree digest does not match its files/, 'read-role verification must recompute the manifest tree digest');
assert.match(bridge, /manifest\.files must be strictly code-point sorted/, 'read-role verification must enforce deterministic manifest ordering');
assert.match(bridge, /put_payload\(bucket, manifest_key, wire, wire_sha/, 'ECS bridge must upload the completion manifest after object frames');
assert.match(bridge, /put_payload\(bucket, manifest_key, manifest_wire, manifest_wire_sha/, 'v2 ECS bridge must upload the completion manifest after every blob and immutable receipt verification');
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

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-release-cli-'));
try {
  const output = path.join(temporary, 'manifest.json');
  const receiptOutput = path.join(temporary, 'release-receipt.json');
  const dailyReportOutput = path.join(temporary, 'daily-publication-report.json');
  const gitRuntimeRoot = path.join(temporary, 'course-content', 'runtime');
  fs.mkdirSync(path.join(gitRuntimeRoot, 'lessons', '1-1'), { recursive: true });
  fs.writeFileSync(path.join(gitRuntimeRoot, 'lessons', '1-1', 'lesson.json'), '{"id":"1-1"}\n');
  for (const args of [
    ['init', '-b', 'integration'],
    ['config', 'user.email', 'test@example.invalid'],
    ['config', 'user.name', 'Test'],
    ['add', '.'],
    ['commit', '-m', 'fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: temporary, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const sourceRevision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: temporary, encoding: 'utf8' }).stdout.trim();
  let result = spawnSync('git', ['update-ref', 'refs/remotes/origin/integration', sourceRevision], { cwd: temporary, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const buildManifest = spawnSync('npx', ['tsx', script, 'build-manifest', '--repo-root', temporary, '--source-revision', sourceRevision, '--format', 'v2', '--output', output, '--receipt-output', receiptOutput, '--daily-report-output', dailyReportOutput], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(buildManifest.status, 0, buildManifest.stderr);
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).schemaVersion, 'act-runtime-release.v2');
  assert.equal(JSON.parse(fs.readFileSync(receiptOutput, 'utf8')).schemaVersion, 'act-runtime-release-receipt.v2');
  const manifestWire = fs.readFileSync(output);
  const releaseReceipt = JSON.parse(fs.readFileSync(receiptOutput, 'utf8'));
  assert.equal(releaseReceipt.manifestWireSha256, createHash('sha256').update(manifestWire).digest('hex'));
  assert.equal(releaseReceipt.manifestWireSizeBytes, manifestWire.byteLength);
  const dailyReport = JSON.parse(fs.readFileSync(dailyReportOutput, 'utf8'));
  assert.equal(dailyReport.schemaVersion, 'runtime-blob-daily-publication-report.v1');
  assert.equal(dailyReport.phase, 'planned');
  assert.equal(dailyReport.release.sourceRevision, sourceRevision);
  assert.deepEqual(dailyReport.deltaProof, {
    inheritedLogicalFileCount: 0,
    inheritedLogicalBytes: 0,
    bodyHashedUniqueGitBlobCount: 1,
    bodyHashedBytes: Buffer.byteLength('{"id":"1-1"}\n'),
  });
  assert.match(JSON.stringify(JSON.parse(fs.readFileSync(output, 'utf8'))), /gitObjectId/, 'Git-backed v2 manifests must bind each logical file to its Git blob identity');
  const parentPlan = spawnSync('npx', ['tsx', script, 'plan', '--repo-root', temporary, '--source-revision', sourceRevision, '--format', 'v2', '--parent-manifest', output], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(parentPlan.status, 0, parentPlan.stderr);
  assert.deepEqual(JSON.parse(parentPlan.stdout).parentReuse, {
    reusedFileCount: 1,
    reusedBytes: Buffer.byteLength('{"id":"1-1"}\n'),
    hashedFileCount: 0,
    hashedBytes: 0,
  }, 'a matching parent manifest must avoid a second Git blob body hash');

  result = spawnSync('git', ['checkout', '-b', 'unpublished'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(gitRuntimeRoot, 'lessons', '1-1', 'unpublished.json'), 'not-on-integration\n');
  result = spawnSync('git', ['add', '.'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('git', ['commit', '-m', 'unpublished'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const unpublishedRevision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: temporary, encoding: 'utf8' }).stdout.trim();
  result = spawnSync('git', ['checkout', 'integration'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const unpublishedBuild = spawnSync('npx', ['tsx', script, 'build-manifest', '--repo-root', temporary, '--source-revision', unpublishedRevision, '--format', 'v2', '--output', path.join(temporary, 'unpublished.json')], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(unpublishedBuild.status, 0, 'a commit outside origin/integration must be rejected');
  assert.match(unpublishedBuild.stderr, /not an ancestor of origin\/integration/);
  const bypassAttempt = spawnSync('npx', ['tsx', script, 'build-manifest', '--repo-root', temporary, '--source-revision', unpublishedRevision, '--integration-ref', 'unpublished', '--format', 'v2', '--output', path.join(temporary, 'bypass.json')], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(bypassAttempt.status, 0, 'the public CLI must reject an ancestry override');
  assert.match(bypassAttempt.stderr, /--integration-ref is not supported/);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('runtime release CLI contract passed');
