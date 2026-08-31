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

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function digest(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function wire(value) {
  return `${stableStringify(value)}\n`;
}

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
assert.match(source, /openPlannedGitManifest/, 'v2 streaming publish must validate the already planned manifest against the source-authoritative snapshot before publishing');
assert.match(source, /openGitRuntimeBlobReleaseSnapshot/, 'v2 streaming publish must reopen only Git tree metadata instead of rehashing the planned source blobs');
assert.match(source, /source-provenance-proof/, 'v2 streaming publish must bind an immutable source-provenance proof');
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
assert.match(source, /runtimeBlobReleaseManifestWireSha256/, 'v2 publish must compare the submitted manifest wire identity with the rebuilt snapshot');
assert.match(source, /Submitted v2 runtime manifest is not canonical/, 'v2 publish must reject non-canonical manifest bytes before local publication');
assert.match(source, /source-authoritative Git and external-input snapshot/, 'v2 publish must fail closed on a manifest identity mismatch before local publication');
assert.match(bridge, /api", "put-object"/, 'ECS bridge must use the ossutil v2 PutObject API');
assert.match(bridge, /"--forbid-overwrite", "true"/, 'v2 blob publication must use conditional no-overwrite semantics');
assert.match(bridge, /api", "head-object"/, 'v2 blob publication must use object metadata reads for unknown blobs');
assert.match(bridge, /x-oss-meta-sha256=.*expected_sha/, 'v2 blob publication must persist the source SHA-256 in immutable object metadata');
assert.match(bridge, /def parent_blob_bindings\(/, 'v2 publication must load the immutable parent receipt before reusing blobs');
assert.match(bridge, /inherited_blob_count/, 'v2 publication must report inherited blobs independently from metadata checks');
assert.match(bridge, /metadata_reuse_count/, 'v2 publication must report metadata-compliant blob reuse');
assert.match(bridge, /new_upload_count/, 'v2 publication must report newly uploaded blob count');
assert.match(bridge, /legacy_readback_count/, 'v2 publication must report metadata-less legacy readback count');
assert.match(bridge, /legacy_readback_bytes/, 'v2 publication must report metadata-less legacy readback bytes');
assert.match(bridge, /verified_blob_set_sha256/, 'v2 publication must report a deterministic verified blob set digest');
assert.match(bridge, /--if-match/, 'legacy blob compatibility must bind the readback to the observed ETag');
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
assert.match(bridge, /choices=\("list", "get", "publish", "import-v1", "verify", "blob-publish-read"\)/, 'ECS bridge must expose the bounded ECS readback protocol alongside publishing');
assert.match(bridge, /BLOB_RELEASE_KEY_PREFIX\s*=\s*["']runtime\/blob-releases\/["']/, 'v2 release documents must use a namespace separate from v1 runtime releases');
assert.match(bridge, /def import_v1_blob_release\(/, 'ECS bridge must provide the bounded fixed-v1 importer');
assert.match(bridge, /ECS_ROLE_NAME\s*=\s*["']act-runtime-oss-release-operator-ecs["']/, 'the retained ECS bridge must keep its explicit legacy role identity');
assert.match(bridge, /ECS_READ_ROLE_NAME\s*=\s*["']act-runtime-oss-read["']/, 'ECS readback must use the read-only runtime role');
assert.match(bridge, /"--credential-mode", "ecs-read"/, 'local publishing must request the ECS read-only mode for remote validation');
assert.match(bridge, /def blob_publish_read_operation\(/, 'ECS readback must expose a dedicated validation-only operation');
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
  const proofOutput = path.join(temporary, 'source-proof.json');
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
  const buildManifest = spawnSync('npx', ['tsx', script, 'build-manifest', '--repo-root', temporary, '--source-revision', sourceRevision, '--format', 'v2', '--output', output, '--receipt-output', receiptOutput, '--source-provenance-proof-output', proofOutput, '--daily-report-output', dailyReportOutput], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(buildManifest.status, 0, buildManifest.stderr);
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).schemaVersion, 'act-runtime-release.v2');
  assert.equal(JSON.parse(fs.readFileSync(receiptOutput, 'utf8')).schemaVersion, 'act-runtime-release-receipt.v2');
  const sourceProof = JSON.parse(fs.readFileSync(proofOutput, 'utf8'));
  assert.equal(sourceProof.schemaVersion, 'act-runtime-release-source-provenance-proof.v1');
  const manifestWire = fs.readFileSync(output);
  const releaseReceipt = JSON.parse(fs.readFileSync(receiptOutput, 'utf8'));
  assert.equal(releaseReceipt.sourceProvenanceProofSha256, sourceProof.proofSha256);
  assert.equal(releaseReceipt.manifestWireSha256, createHash('sha256').update(manifestWire).digest('hex'));
  assert.equal(releaseReceipt.manifestWireSizeBytes, manifestWire.byteLength);
  const dailyReport = JSON.parse(fs.readFileSync(dailyReportOutput, 'utf8'));
  assert.equal(dailyReport.schemaVersion, 'runtime-blob-daily-publication-report.v1');
  assert.equal(dailyReport.phase, 'planned');
  assert.equal(dailyReport.sourceProvenanceProofSha256, sourceProof.proofSha256);
  assert.equal(dailyReport.release.sourceRevision, sourceRevision);
  assert.deepEqual(dailyReport.deltaProof, {
    inheritedLogicalFileCount: 0,
    inheritedLogicalBytes: 0,
    bodyHashedUniqueGitBlobCount: 1,
    bodyHashedBytes: Buffer.byteLength('{"id":"1-1"}\n'),
  });
  assert.deepEqual(dailyReport.transfer, {
    putCount: 0,
    inheritedBlobCount: 0,
    metadataCheckCount: 0,
    uploadedBlobBytes: 0,
    metadataReuseCount: 0,
    newUploadCount: 0,
    legacyReadbackCount: 0,
    legacyReadbackBytes: 0,
    verifiedBlobSetAlgorithm: 'sha256',
    verifiedBlobSetSha256: createHash('sha256').update('[]').digest('hex'),
    verifiedBlobEntries: [],
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

const externalTemporary = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-release-cli-external-'));
try {
  const runtimeRoot = path.join(externalTemporary, 'course-content', 'runtime');
  const generatedRoot = path.join(externalTemporary, 'resources');
  const generatedPrefixes = [
    'textbooks-v2',
    path.join('textbook-hybrid-retrieval', 'bge-m3'),
    'textbooks',
  ];
  fs.mkdirSync(path.join(runtimeRoot, 'lessons'), { recursive: true });
  fs.writeFileSync(path.join(runtimeRoot, 'lessons', 'lesson.json'), '{"id":"git-source"}\n');
  for (const prefix of generatedPrefixes) fs.mkdirSync(path.join(generatedRoot, prefix), { recursive: true });
  const externalPath = path.join(generatedRoot, 'textbooks-v2', 'generated.json');
  const externalBytes = Buffer.from('{"generated":true}\n');
  fs.writeFileSync(externalPath, externalBytes);

  for (const args of [
    ['init', '-b', 'integration'],
    ['config', 'user.email', 'test@example.invalid'],
    ['config', 'user.name', 'Test'],
    ['add', '.'],
    ['commit', '-m', 'external base'],
  ]) {
    const result = spawnSync('git', args, { cwd: externalTemporary, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const baseRevision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: externalTemporary, encoding: 'utf8' }).stdout.trim();
  const tree = spawnSync('git', ['ls-tree', '-r', '--full-tree', baseRevision, '--', 'course-content/runtime'], { cwd: externalTemporary, encoding: 'utf8' });
  assert.equal(tree.status, 0, tree.stderr);
  const baseRuntimeTree = tree.stdout.split('\n').filter(Boolean).map((entry) => {
    const tab = entry.indexOf('\t');
    const header = entry.slice(0, tab).split(' ');
    return { path: entry.slice(tab + 1).slice('course-content/runtime/'.length), objectId: header[2] };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const baseRuntimeTreeSha256 = digest(baseRuntimeTree);
  const externalFile = {
    path: 'resources/textbooks-v2/generated.json',
    sizeBytes: externalBytes.byteLength,
    sha256: createHash('sha256').update(externalBytes).digest('hex'),
  };
  const prefixes = [
    'resources/textbooks-v2/',
    'resources/textbook-hybrid-retrieval/bge-m3/',
    'resources/textbooks/',
  ];
  const replacedPrefixes = [
    'resources/textbooks-v2/',
    'resources/textbook-retrieval/',
    'resources/textbook-hybrid-retrieval/bge-m3/',
    'resources/textbooks/',
  ];
  const overlay = {
    baseSourceRevision: baseRevision,
    baseRuntimeTreeSha256,
    replacedPrefixes,
    generatedPrefixes: prefixes,
    generatedTreeSha256: digest([externalFile]),
  };
  const inputDigest = 'a'.repeat(64);
  const provenance = {
    schemaVersion: 'act.textbook-runtime-input-provenance.v1',
    sourceRevision: baseRevision,
    inputDigest,
    inputFileCount: 1,
  };
  const bundleBody = {
    schemaVersion: 'act-runtime-external-input-bundle.v1',
    externalInputId: 'external-fixture-v1',
    sourceRevision: baseRevision,
    prefixes,
    baseSourceRevision: baseRevision,
    overlay,
    overlaySha256: digest(overlay),
    provenance,
    generator: { id: 'test-generator', version: '1' },
    fileCount: 1,
    totalBytes: externalFile.sizeBytes,
    treeSha256: digest([externalFile]),
    files: [externalFile],
  };
  const bundleManifestSha256 = digest(bundleBody);
  const bundleWire = wire({ ...bundleBody, manifestSha256: bundleManifestSha256 });
  const bundlePath = path.join(externalTemporary, 'external-bundle.json');
  fs.writeFileSync(bundlePath, bundleWire);
  const declaration = {
    schemaVersion: 'act-runtime-external-input-bundles.v1',
    inputs: [{
      externalInputId: bundleBody.externalInputId,
      prefixes,
      bundleSemanticSha256: bundleManifestSha256,
      bundleWireSha256: createHash('sha256').update(bundleWire).digest('hex'),
      sourceRevision: baseRevision,
      baseSourceRevision: baseRevision,
      overlaySha256: bundleBody.overlaySha256,
      inputDigest,
      inputFileCount: 1,
    }],
  };
  const declarationPath = path.join(externalTemporary, 'course-content', 'authoring', 'runtime-external-input-bundles.v1.json');
  fs.mkdirSync(path.dirname(declarationPath), { recursive: true });
  fs.writeFileSync(declarationPath, wire(declaration));
  let result = spawnSync('git', ['add', '.'], { cwd: externalTemporary, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('git', ['commit', '-m', 'declare external bundle'], { cwd: externalTemporary, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const sourceRevision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: externalTemporary, encoding: 'utf8' }).stdout.trim();
  result = spawnSync('git', ['update-ref', 'refs/remotes/origin/integration', sourceRevision], { cwd: externalTemporary, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const manifestPath = path.join(externalTemporary, 'manifest.json');
  const receiptPath = path.join(externalTemporary, 'planning-receipt.json');
  const proofPath = path.join(externalTemporary, 'source-proof.json');
  const build = spawnSync('npx', ['tsx', script, 'build-manifest', '--repo-root', externalTemporary, '--source-revision', sourceRevision, '--format', 'v2', '--external-bundle', bundlePath, '--external-bundle-root', runtimeRoot, '--generated-resources-root', generatedRoot, '--output', manifestPath, '--receipt-output', receiptPath, '--source-provenance-proof-output', proofPath], { cwd: root, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.files.some((file) => file.path === externalFile.path && file.source.bundleSemanticSha256 === bundleManifestSha256), true);

  const fakeBridge = path.join(externalTemporary, 'fake-publisher.py');
  fs.writeFileSync(fakeBridge, [
    'import base64, hashlib, json, os, sys',
    'input_stream = sys.stdin.buffer',
    'header = json.loads(input_stream.readline())',
    "manifest = json.loads(base64.urlsafe_b64decode(header['manifestWireBase64'] + '=='))",
    "files = {file['objectKey']: file for file in manifest['files']}",
    "missing = list(files.values())",
    "print(json.dumps({'status': 'stream', 'missingKeys': [file['objectKey'] for file in missing]}), flush=True)",
    "if os.environ.get('ACT_TEST_MUTATE_EXTERNAL'): open(os.environ['ACT_TEST_MUTATE_EXTERNAL'], 'wb').write(b'{\"generated\":false}\\n')",
    'for file in missing:',
    '  frame = json.loads(input_stream.readline())',
    "  assert frame['key'] == file['objectKey']",
    "  body = input_stream.read(file['sizeBytes'])",
    "  assert len(body) == file['sizeBytes'] and hashlib.sha256(body).hexdigest() == file['sha256']",
    "assert input_stream.readline() == b'DONE\\n'",
    "verified = [{'key': file['objectKey'], 'expectedSize': file['sizeBytes'], 'verifiedSha256': file['sha256'], 'etag': '\"' + '0' * 32 + '\"'} for file in sorted(missing, key=lambda item: item['objectKey'])]",
    "verified_digest = hashlib.sha256(json.dumps(verified, separators=(',', ':'), sort_keys=True).encode()).hexdigest()",
    'print(json.dumps({',
    "  'status': 'complete', 'releaseId': header['releaseId'], 'manifestSha256': header['manifestSha256'],",
    "  'wireSha256': header['wireSha256'], 'receiptWireSha256': header['receiptWireSha256'],",
    "  'treeSha256': manifest['treeSha256'], 'fileCount': manifest['fileCount'], 'totalBytes': manifest['totalBytes'],",
    "  'putCount': len(missing) + 2, 'inheritedBlobCount': 0, 'metadataCheckCount': len(missing),",
    "  'metadataReuseCount': 0, 'newUploadCount': len(missing), 'legacyReadbackCount': 0, 'legacyReadbackBytes': 0,",
    "  'verifiedBlobSetAlgorithm': 'sha256', 'verifiedBlobSetSha256': verified_digest, 'verifiedBlobEntries': verified,",
    '}), flush=True)',
  ].join('\n'));
  const pythonBinary = spawnSync('which', ['python3'], { encoding: 'utf8' }).stdout.trim();
  assert.ok(pythonBinary, 'python3 is required for the local publisher fixture');
  const localPublisherArgs = [
    '--bucket', 'test-bucket', '--local-bridge-path', fakeBridge, '--python-binary', pythonBinary,
    '--ossutil-path', '/bin/true', '--ossutil-sha256', '0'.repeat(64), '--identity-command-path', '/bin/true', '--identity-command-sha256', '0'.repeat(64),
    '--operator-account-id', '123456789012', '--operator-principal-arn', 'acs:ram::123456789012:user/test',
    '--lock-dir', path.join(externalTemporary, 'locks'), '--spool-dir', path.join(externalTemporary, 'spool'),
  ];
  const publishReceiptPath = path.join(externalTemporary, 'publish-receipt.json');
  const publishArgs = ['publish-streaming', '--repo-root', externalTemporary, '--source-revision', sourceRevision, '--release-id', manifest.releaseId, '--format', 'v2', '--manifest', manifestPath, '--receipt', receiptPath, '--source-provenance-proof', proofPath, '--external-bundle', bundlePath, '--external-bundle-root', runtimeRoot, '--generated-resources-root', generatedRoot, ...localPublisherArgs, '--output', publishReceiptPath];
  const publish = spawnSync('npx', ['tsx', script, ...publishArgs], { cwd: root, encoding: 'utf8', env: { ...process.env, ACT_TEST_MUTATE_EXTERNAL: externalPath } });
  assert.equal(publish.status, 0, publish.stderr);
  assert.equal(JSON.parse(fs.readFileSync(publishReceiptPath, 'utf8')).releaseId, manifest.releaseId, 'external-input v2 manifest must reach the local publisher');
  fs.writeFileSync(externalPath, externalBytes);

  const missingProof = path.join(externalTemporary, 'missing-proof-receipt.json');
  result = spawnSync('npx', ['tsx', script, 'publish-streaming', '--repo-root', externalTemporary, '--source-revision', sourceRevision, '--release-id', manifest.releaseId, '--format', 'v2', '--manifest', manifestPath, '--receipt', receiptPath, '--external-bundle', bundlePath, '--external-bundle-root', runtimeRoot, '--generated-resources-root', generatedRoot, ...localPublisherArgs, '--output', missingProof], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'a v2 publish without its source proof must fail before the publisher bridge starts');
  assert.match(result.stderr, /source-provenance proof|re-run planning/i);
  assert.equal(fs.existsSync(missingProof), false);

  const tamperedProofPath = path.join(externalTemporary, 'tampered-proof.json');
  const tamperedProof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
  tamperedProof.schemaVersion = 'act-runtime-release-source-provenance-proof.v999';
  fs.writeFileSync(tamperedProofPath, wire(tamperedProof));
  result = spawnSync('npx', ['tsx', script, ...publishArgs.map((arg) => arg === proofPath ? tamperedProofPath : arg)], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'an unknown source-proof schema must fail closed');
  assert.match(result.stderr, /unsupported proof schema|proof/i);

  const tamperedReceiptPath = path.join(externalTemporary, 'tampered-planning-receipt.json');
  const tamperedReceipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  tamperedReceipt.sourceProvenanceProofSha256 = 'f'.repeat(64);
  fs.writeFileSync(tamperedReceiptPath, wire(tamperedReceipt));
  result = spawnSync('npx', ['tsx', script, ...publishArgs.map((arg) => arg === receiptPath ? tamperedReceiptPath : arg)], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'a tampered planning receipt must fail closed');
  assert.match(result.stderr, /receipt|proof/i);

  const driftedProofPath = path.join(externalTemporary, 'drifted-tree-proof.json');
  const driftedProof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
  driftedProof.gitTree[0].gitObjectId = '0'.repeat(40);
  const driftedProofBody = { ...driftedProof };
  delete driftedProofBody.proofSha256;
  driftedProof.proofSha256 = digest(driftedProofBody);
  fs.writeFileSync(driftedProofPath, wire(driftedProof));
  const driftedReceiptPath = path.join(externalTemporary, 'drifted-tree-receipt.json');
  const driftedReceipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  driftedReceipt.sourceProvenanceProofSha256 = driftedProof.proofSha256;
  const driftedReceiptBody = { ...driftedReceipt };
  delete driftedReceiptBody.receiptSha256;
  driftedReceipt.receiptSha256 = digest(driftedReceiptBody);
  fs.writeFileSync(driftedReceiptPath, wire(driftedReceipt));
  const driftedTreePublishReceipt = path.join(externalTemporary, 'drifted-tree-publish-receipt.json');
  result = spawnSync('npx', ['tsx', script, ...publishArgs.map((arg) => arg === proofPath ? driftedProofPath : arg === receiptPath ? driftedReceiptPath : arg === publishReceiptPath ? driftedTreePublishReceipt : arg)], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'a source Git tree identity drift must fail closed');
  assert.match(result.stderr, /source-authoritative Git tree identity|source-provenance proof/i);
  assert.equal(fs.existsSync(driftedTreePublishReceipt), false);

  const missingBundle = path.join(externalTemporary, 'missing-bundle-receipt.json');
  result = spawnSync('npx', ['tsx', script, 'publish-streaming', '--repo-root', externalTemporary, '--source-revision', sourceRevision, '--release-id', manifest.releaseId, '--format', 'v2', '--manifest', manifestPath, '--receipt', receiptPath, '--source-provenance-proof', proofPath, ...localPublisherArgs, '--output', missingBundle], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'a bundle-backed manifest must not publish from a Git-only snapshot');
  assert.match(result.stderr, /source-authoritative|source identity|file count/i);
  assert.equal(fs.existsSync(missingBundle), false);

  const tamperedManifest = path.join(externalTemporary, 'tampered-manifest.json');
  const tampered = JSON.parse(JSON.stringify(manifest));
  const tamperedExternal = tampered.files.find((file) => file.path === externalFile.path);
  tamperedExternal.source.bundleSemanticSha256 = 'f'.repeat(64);
  fs.writeFileSync(tamperedManifest, wire(tampered));
  result = spawnSync('npx', ['tsx', script, 'publish-streaming', '--repo-root', externalTemporary, '--source-revision', sourceRevision, '--release-id', manifest.releaseId, '--format', 'v2', '--manifest', tamperedManifest, '--receipt', receiptPath, '--source-provenance-proof', proofPath, '--external-bundle', bundlePath, '--external-bundle-root', runtimeRoot, '--generated-resources-root', generatedRoot, ...localPublisherArgs, '--output', path.join(externalTemporary, 'tampered-receipt.json')], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'a tampered canonical manifest must fail before local publication');
  assert.match(result.stderr, /canonical content|manifest|source-authoritative/i);

  fs.writeFileSync(externalPath, '{"generated":false}\n');
  result = spawnSync('npx', ['tsx', script, 'publish-streaming', '--repo-root', externalTemporary, '--source-revision', sourceRevision, '--release-id', manifest.releaseId, '--format', 'v2', '--manifest', manifestPath, '--receipt', receiptPath, '--source-provenance-proof', proofPath, '--external-bundle', bundlePath, '--external-bundle-root', runtimeRoot, '--generated-resources-root', generatedRoot, ...localPublisherArgs, '--output', path.join(externalTemporary, 'drifted-receipt.json')], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0, 'external source bytes drifting from the declared bundle must fail closed');
  assert.match(result.stderr, /external.*changed|prepared manifest/i);
} finally {
  fs.rmSync(externalTemporary, { recursive: true, force: true });
}

console.log('runtime release CLI contract passed');
