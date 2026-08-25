import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const activation = fs.readFileSync(path.join(root, 'scripts/runtime-release/activate-runtime-blob-release.sh'), 'utf8');
const activationTransaction = fs.readFileSync(path.join(root, 'scripts/runtime-release/runtime-blob-activation-transaction.py'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'scripts/runtime-release/runtime-blob-release-lifecycle.py'), 'utf8');
const runtimeDeploy = fs.readFileSync(path.join(root, 'scripts/deploy-runtime-blob-release.sh'), 'utf8');
const appDeploy = fs.readFileSync(path.join(root, 'scripts/remote-deploy.sh'), 'utf8');
const deployAll = fs.readFileSync(path.join(root, 'scripts/deploy-all-with-runtime-blobs.sh'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const podmanDeploy = fs.readFileSync(path.join(root, 'deploy/podman/deploy.sh'), 'utf8');
const config = fs.readFileSync(path.join(root, 'scripts/runtime-release/configure-runtime-blob-ossfs.sh'), 'utf8');
const service = fs.readFileSync(path.join(root, 'scripts/runtime-release/act-runtime-blob-ossfs.service'), 'utf8');
const helperService = fs.readFileSync(
  path.join(root, 'scripts/runtime-release/act-runtime-blob-view-helper.service'),
  'utf8',
);
const helperBind = fs.readFileSync(
  path.join(root, 'scripts/runtime-release/bind-runtime-blob-view-helper.sh'),
  'utf8',
);

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
  'ACT_RUNTIME_BLOB_LIFECYCLE_SCRIPT',
  'begin-publish',
  'set-desired',
  'ACT_RUNTIME_BLOB_ACTIVATION_TRANSACTION',
  'ACTIVATION_TRANSACTION',
  'recover',
  'expected-generation',
  'lifecycle_generation',
  'restore_runtime_consumers()',
  'ACT_RUNTIME_ACTIVE_RECEIPT_PATH',
  'candidate-readyz-receipt',
  'write_candidate_readyz_receipt()',
  'candidate_receipt_path',
  'candidate_receipt_rebound',
  'run_candidate_consumer_smoke()',
  'run_active_media_resolver_smoke()',
  '/interactive-learning/courses/unit-1-1-see-the-full-picture',
  "src/lib/runtime-lesson-media-document.ts",
  "scripts/db/seed-all-knowledge.mjs",
  "src/lib/textbook-reader.ts",
  "src/lib/runtime-release-textbook-candidate-smoke.ts",
  'smokeCandidateTextbookCorpus',
  'ACT_RUNTIME_CANDIDATE_TEXTBOOK_ROOT',
  'ACT_RUNTIME_CANDIDATE_INDEX_ROOT',
  'candidate media, knowledge, or textbook consumer smoke failed',
  'active media resolver did not return a private signed redirect',
  'candidate media smoke failed and lifecycle rollback could not complete',
  'ACT_RUNTIME_BLOB_MEDIA_SMOKE_FAIL',
  'podman container exists "$APP_CONTAINER"',
  "grep -E '^APP_IMAGE=(sha256:)?[a-f0-9]{64}$' \"$ENV_FILE\"",
  'persisted runtime environment does not contain a valid app image digest',
  'podman image exists "$rollback_app_image"',
]) {
  assert.ok(activation.includes(invariant), `runtime-only activation must include ${invariant}`);
}
assert.ok(lifecycle.includes('mark-active-v2'), 'lifecycle-owned activation must project identity with mark-active-v2');
assert.ok(lifecycle.includes('activate-and-project'), 'lifecycle-owned activation primitive is required');
assert.match(podmanDeploy, /ACT_RUNTIME_ACTIVE_RECEIPT_PATH/, 'container must receive the active receipt path');
assert.match(podmanDeploy, /act-runtime-state:ro/, 'container must receive the host active receipt directory read-only');
assert.match(podmanDeploy, /RUNTIME_ACTIVE_RECEIPT_HOST_DIR/, 'deployment must bind the receipt parent directory, not an atomic-renamed inode');
assert.ok(
  activation.indexOf('stage_lifecycle_desired') < activation.indexOf('python3 "$HOST_STATE_SCRIPT" select'),
  'v2 desired lifecycle state must be staged before the legacy selector changes',
);
assert.ok(
  activation.lastIndexOf('python3 "$HOST_STATE_SCRIPT" select') < activation.lastIndexOf('write_candidate_readyz_receipt'),
  'candidate readiness receipt must be derived only after the desired selection is fenced',
);
assert.ok(
  activation.lastIndexOf('write_candidate_readyz_receipt') < activation.lastIndexOf('python3 "$MATERIALIZER" select --release-id "$release_id"'),
  'candidate readiness receipt must be prepared before its view reaches consumers',
);
assert.ok(
  activation.lastIndexOf('trap restore_runtime_consumers ERR') <
    activation.lastIndexOf('python3 "$MATERIALIZER" select --release-id "$release_id"'),
  'ERR recovery must be installed before current view selection',
);
assert.ok(
  activation.lastIndexOf('restore_parent_host_overlays "$overlay_source" "$candidate_view"') <
    activation.lastIndexOf('python3 "$HOST_STATE_SCRIPT" "${verify_args[@]}"'),
  'control-plane overlay restore must happen before post-overlay verification',
);
assert.ok(
  activation.lastIndexOf('python3 "$HOST_STATE_SCRIPT" "${verify_args[@]}"') <
    activation.lastIndexOf('python3 "$MATERIALIZER" select --release-id "$release_id"'),
  'post-overlay verification must happen before current view selection',
);
assert.ok(
  activation.lastIndexOf('python3 "$HOST_STATE_SCRIPT" "${verify_args[@]}"') <
    activation.lastIndexOf('candidate_current_selected=1'),
  'failed post-overlay verification must not mark the candidate current view selected',
);
assert.ok(
  activation.lastIndexOf('python3 "$HOST_STATE_SCRIPT" "${verify_args[@]}"') <
    activation.lastIndexOf('candidate_deploy_attempted=1'),
  'failed post-overlay verification must not restart runtime consumers',
);
assert.match(
  activation,
  /restore-overlays/,
  'overlay restore must use the host-state allowlist command',
);
assert.match(
  activation,
  /--replace-existing/,
  'activation must be able to rematerialize an existing host view from immutable blobs',
);
assert.match(
  activation,
  /umount "\$final_view\/\.act-runtime-blobs"/,
  'rebuild swap must unmount the live helper before replacing the active view',
);
assert.match(
  activation,
  /rebuild_backup="\$backup_view"/,
  'same-release rebuild must keep the replaced live view as a backup',
);
assert.match(
  activation,
  /restore_rebuild_backup/,
  'failed same-release rebuild must restore the replaced live view',
);
assert.match(
  activation,
  /rebuild_failed="\$failed_view"/,
  'a live failed rebuild view must be retained while consumers still bind it',
);
assert.ok(
  activation.lastIndexOf('restored_rebuild" == "1"') < activation.lastIndexOf('cleanup_rebuild_failed'),
  'failed rebuild view must be deleted only after rollback consumer remount succeeds',
);
assert.ok(
  activation.lastIndexOf('post_activation_media_smoke_passed=1') <
    activation.lastIndexOf('rm -rf -- "$rebuild_backup"'),
  'rebuild backup must be deleted only after consumer switch and media smoke succeed',
);
assert.match(
  activation,
  /prepare_result="\$\(python3 "\$MATERIALIZER" "\$\{prepare_args\[@\]\}"\)"/,
  'activation must use the materializer viewPath, including rebuild staging views',
);
assert.match(
  activation,
  /candidate_current_selected" == "1"[\s\S]*MATERIALIZER" select --release-id "\$old_active"/,
  'ERR recovery must revert current even when consumers were not switched',
);
assert.match(
  activation,
  /Same-identity host view repair must not enter begin-publish\/set-desired/,
  'same-identity rebuild must skip lifecycle publish transitions',
);
assert.match(
  activation,
  /same-identity repair did not keep the active lifecycle identity/,
  'same-identity rebuild must keep the existing active lifecycle identity',
);
assert.ok(
  activation.lastIndexOf('if [[ "$release_id" == "$old_active" ]]; then') <
    activation.lastIndexOf('python3 "$ACTIVATION_TRANSACTION" activate'),
  'same-identity repair must decide before lifecycle activate',
);
assert.ok(
  activation.indexOf('python3 "$ACTIVATION_TRANSACTION" activate') < activation.indexOf('trap - ERR'),
  'v2 cross-state activation must complete before clearing rollback handling',
);
assert.ok(
  activation.indexOf('run_candidate_consumer_smoke') < activation.indexOf('python3 "$ACTIVATION_TRANSACTION" activate'),
  'candidate course, media, knowledge, and textbook consumers must pass before lifecycle activation',
);
assert.match(
  activation,
  /\[\[ -f "\$candidate_view\/lessons\/1-1\/lesson\.json" \]\]/,
  'candidate course smoke must accept the logical symlink leaf exposed by the blob view',
);
assert.doesNotMatch(
  activation,
  /candidate_view\/lessons\/1-1\/lesson\.json" && ! -L/,
  'candidate course smoke must not reject the blob view because its logical files are symlinks',
);
assert.match(
  activation,
  /podman exec -i --workdir \/app "\$APP_CONTAINER" \/bin\/sh -eu -c '[\s\S]*mktemp \/tmp\/act-runtime-blob-candidate-smoke\.XXXXXX\.ts[\s\S]*\.\/node_modules\/\.bin\/tsx "\$smoke_file"/,
  'candidate consumer smoke must execute a temporary TypeScript file through the deployed application runtime',
);
assert.doesNotMatch(
  activation,
  /course-runtime\/\$\{encoded_path\}/,
  'candidate validation must not reduce all consumers to raw runtime file reads',
);
const activationCommitIndex = activation.lastIndexOf('python3 "$ACTIVATION_TRANSACTION" activate');
const activeMediaSmokeIndex = activation.lastIndexOf('run_active_media_resolver_smoke');
const activationAttemptIndex = activation.lastIndexOf('activation_attempted=1');
assert.ok(
  activationCommitIndex < activeMediaSmokeIndex,
  'the normal private media resolver must be verified only after the active receipt is committed',
);
const canonicalReceiptRebindIndex = activation.lastIndexOf('ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json"');
assert.ok(
  activationCommitIndex < canonicalReceiptRebindIndex && canonicalReceiptRebindIndex < activeMediaSmokeIndex,
  'a successful lifecycle activation must rebind consumers to the canonical receipt before active media smoke',
);
assert.ok(
  activationAttemptIndex < activationCommitIndex,
  'post-activation rollback eligibility must be durable in the shell before the lifecycle transaction starts',
);
assert.match(
  activation,
  /activation_attempted" == "1"[\s\S]*post_activation_media_smoke_passed" != "1"[\s\S]*lifecycle_active_release" == "\$release_id"/,
  'ERR recovery must roll back a committed candidate even when activate exits before its caller returns',
);
assert.doesNotMatch(
  activation,
  /activation_committed/,
  'ERR recovery must not depend on a flag set only after activate returns',
);
assert.ok(
  activeMediaSmokeIndex < activation.lastIndexOf('post_activation_media_smoke_passed=1'),
  'a successful private media resolver smoke must fence completion',
);
assert.match(
  activation,
  /ACTIVATION_TRANSACTION" rollback[\s\S]*--expected-generation "\$rollback_generation"/,
  'a failed post-activation private media resolver smoke must roll back the lifecycle candidate',
);
const consumerModule = activation.match(
  /podman exec -i --workdir \/app "\$APP_CONTAINER" \/bin\/sh -eu -c '[\s\S]*' <<'TS'\n([\s\S]+?)\nTS\n  \)"; then/,
);
assert.ok(consumerModule, 'candidate consumer module must remain extractable for a local regression run');
const consumerDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-blob-candidate-smoke-'));
const consumerPath = path.join(consumerDirectory, 'candidate-smoke.ts');
fs.writeFileSync(consumerPath, consumerModule[1], { encoding: 'utf8', mode: 0o600 });
const textbookFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'act-runtime-blob-textbook-smoke-'));
const textbookRoot = path.join(textbookFixture, 'textbooks-v2');
const indexRoot = path.join(textbookFixture, 'index');
const fixtureBooks = [
  ['control-encyclopedia', '2015'],
  ['hu-shousong-exercise-analysis-3rd', '第三版'],
];
const fixtureRevision = 'a'.repeat(40);
fs.mkdirSync(textbookRoot, { recursive: true });
for (const [bookId, edition] of fixtureBooks) {
  const bookRoot = path.join(textbookRoot, bookId);
  fs.mkdirSync(bookRoot, { recursive: true });
  const unitId = `textbook-unit:${bookId}@edition/chapter-chapter-01`;
  const unit = {
    id: unitId,
    bookId,
    edition,
    chapterId: 'chapter-01',
    structuralPath: ['chapter-chapter-01'],
    parentId: null,
    ancestorIds: [],
    level: 1,
    kind: 'chapter',
    naturalNumber: '1',
    title: '第一章',
    markdown: '# 第一章\n正文',
    sourceSpan: {
      sourcePath: `textbooks/${bookId}/chapter-01/textbook.md`,
      startLine: 1,
      endLine: 1,
      startByte: 0,
      endByte: 8,
    },
    fragmentAnchorIds: [],
    recordType: 'structure-unit',
    schemaVersion: 'structured-textbook-runtime.v2',
  };
  fs.writeFileSync(path.join(bookRoot, 'manifest.json'), JSON.stringify({
    recordType: 'export-manifest',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId,
    edition,
    sourceRevision: fixtureRevision,
    sourceHashes: {},
    counts: { structureUnits: 1, fragmentAnchors: 0, retrievalWindows: 1, navigationEntries: 1 },
  }));
  fs.writeFileSync(path.join(bookRoot, 'navigation.json'), JSON.stringify({
    recordType: 'navigation-index',
    schemaVersion: 'structured-textbook-runtime.v2',
    bookId,
    entries: [{ unitId, parentId: null, childIds: [], previousUnitId: null, nextUnitId: null }],
  }));
  fs.writeFileSync(path.join(bookRoot, 'units.jsonl'), `${JSON.stringify(unit)}\n`);
  fs.writeFileSync(path.join(bookRoot, 'anchors.jsonl'), '');
  fs.writeFileSync(path.join(bookRoot, 'windows.jsonl'), `${JSON.stringify({
    id: unitId.replace('textbook-unit:', 'textbook-window:'),
    primaryUnitId: unitId,
    segments: [{ owningUnitId: unitId, markdown: unit.markdown, sourceSpan: unit.sourceSpan }],
    citationTarget: false,
    recordType: 'retrieval-window',
    schemaVersion: 'structured-textbook-runtime.v2',
  })}\n`);
}
fs.writeFileSync(path.join(textbookRoot, 'input-provenance.json'), JSON.stringify({
  schemaVersion: 'act.textbook-runtime-input-provenance.v1',
  sourceRevision: fixtureRevision,
  inputDigest: 'b'.repeat(64),
  inputFileCount: 2,
}));
fs.mkdirSync(indexRoot, { recursive: true });
for (const fileName of [
  'windows.jsonl', 'bodies.utf8', 'vectors.f32', 'lexical-terms.jsonl', 'lexical-postings.bin', 'build-report.json',
]) {
  fs.writeFileSync(path.join(indexRoot, fileName), '');
}
fs.writeFileSync(path.join(indexRoot, 'manifest.json'), JSON.stringify({
  recordType: 'index-manifest',
  formatVersion: 'textbook-hybrid-retrieval.v1',
  sourceRevision: fixtureRevision,
  resourceSetId: 'current-authoring-bundle-v1',
  books: fixtureBooks.map(([bookId, edition]) => ({
    bookId,
    edition,
    manifestHash: `sha256:${'0'.repeat(64)}`,
    sourceHashes: { 'manifest.json': `sha256:${'1'.repeat(64)}` },
  })),
}));
let consumerOutput;
try {
  consumerOutput = execFileSync(
    path.join(root, 'node_modules', '.bin', 'tsx'),
    [consumerPath],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        ACT_RUNTIME_CANDIDATE_TEXTBOOK_ROOT: textbookRoot,
        ACT_RUNTIME_CANDIDATE_INDEX_ROOT: indexRoot,
      },
    },
  ).trim();
} finally {
  fs.rmSync(consumerDirectory, { recursive: true, force: true });
  fs.rmSync(textbookFixture, { recursive: true, force: true });
}
const consumerResult = JSON.parse(consumerOutput);
assert.match(
  consumerResult.mediaPath,
  /^lessons\/[A-Za-z0-9][A-Za-z0-9._-]*\/media\/[A-Za-z0-9][A-Za-z0-9._-]*$/,
  'candidate consumer module must resolve a parser-declared local media object',
);
assert.match(activation, /LIFECYCLE_SCRIPT=.*runtime-blob-release-lifecycle\.py/, 'activation must invoke the v2 lifecycle authority');
assert.match(activation, /ACTIVATION_TRANSACTION=.*runtime-blob-activation-transaction\.py/, 'activation must invoke the cross-state transaction helper');
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
assert.match(
  podmanDeploy,
  /if \[ ! -f "\$pointer" \] && \[ ! -L "\$pointer" \]; then/,
  'cutover activation pointers must accept blob-view leaf symlinks that root cannot follow through FUSE',
);
assert.match(podmanDeploy, /-v "\$\{RUNTIME_CONTENT_DIR\}:\/app\/course-content\/runtime:ro"/, 'application runtime bind must remain read-only');
assert.match(
  podmanDeploy,
  /-v "\$\{RUNTIME_CONTENT_DIR\}\/\.act-runtime-blobs:\/app\/course-content\/runtime\/\.act-runtime-blobs:ro"/,
  'v2 blob helper FUSE must be bind-mounted into the app; a parent directory bind does not propagate the nested mount',
);

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
assert.match(
  helperService,
  /Requires=act-runtime-blob-ossfs\.service/,
  'helper bind unit must start only after the shared blob FUSE is up',
);
assert.match(
  helperService,
  /ExecStart=\/home\/projects\/act\/scripts\/runtime-release\/bind-runtime-blob-view-helper\.sh/,
  'helper bind unit must call the host bind script',
);
assert.match(helperService, /RemainAfterExit=yes/, 'helper bind unit must track its bind mount state');
assert.doesNotMatch(helperService, /ACCESS_KEY|SECRET/i, 'helper bind unit must not persist access keys');
assert.match(helperBind, /mount --bind "\$BLOB_ROOT" "\$helper"/, 'helper bind script must bind the shared blob root');
assert.match(
  helperBind,
  /mount -o remount,bind,ro "\$helper"/,
  'helper bind script must remount the view helper read-only',
);
assert.match(
  helperBind,
  /findmnt -rn -M "\$BLOB_ROOT" -o OPTIONS/,
  'helper bind script must refuse a writable blob root',
);
assert.doesNotMatch(helperBind, /systemctl /, 'helper bind script must not change systemd units');

for (const invariant of [
  'build-manifest',
  'publish-streaming',
  '--parent-manifest',
  '--external-bundle',
  '--external-bundle-root',
  '--generated-resources-root',
  '--expected-active-release',
  'publisher-verification.json',
  'source-provenance-proof.json',
  '--receipt',
  '--source-provenance-proof',
  'daily-publication-report.json',
  '--daily-report-output',
  'timingMilliseconds',
  'lifecycle-identity.json',
  'runtime-blob-release-lifecycle.py',
  'runtime-blob-activation-transaction.py',
  'begin-publish',
  'cancel-publishing',
  'publishing_identity_started',
  'publishing root cleanup failed',
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
  /publish_args\+=\(--external-bundle "\$external_bundle"\)/,
  'runtime deploy must pass the declared external bundle to publish-streaming',
);
assert.match(
  runtimeDeploy,
  /build_args\+=\(--external-bundle "\$external_bundle"\)/,
  'runtime deploy must bind the declared external bundle while planning the Git-source manifest',
);
assert.match(
  runtimeDeploy,
  /publish_args\+=\(--blob-parent-release-id "\$ACT_RUNTIME_BLOB_PARENT_RELEASE_ID" --blob-parent-manifest-sha256 "\$ACT_RUNTIME_BLOB_PARENT_MANIFEST_SHA256"\)/,
  'runtime deploy may inherit content-addressed blobs from an existing v2 release without a Git-source parent',
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
assert.ok(
  runtimeDeploy.indexOf('copy_atomic "$ROOT_DIR/scripts/runtime-release/runtime-blob-activation-transaction.py"') < runtimeDeploy.indexOf('begin-publish'),
  'the activation transaction helper must be synchronized before it records the candidate root',
);
assert.ok(
  runtimeDeploy.indexOf('cancel-publishing') > runtimeDeploy.indexOf('publish-streaming'),
  'a failed local publication must clean up only after publish-streaming returns',
);
assert.match(
  runtimeDeploy,
  /publishing root cleanup failed[^\n]*remains protected/,
  'cleanup failure must preserve the publishing root and report the original failure',
);

assert.equal(packageJson.scripts['deploy:runtime'], 'bash ./scripts/deploy-runtime-blob-release.sh');
assert.equal(packageJson.scripts['deploy:app'], 'bash ./scripts/remote-deploy.sh --app-only');
assert.equal(packageJson.scripts['deploy:all'], 'bash ./scripts/deploy-all-with-runtime-blobs.sh');
assert.match(deployAll, /deploy-runtime-blob-release\.sh" "\$@"/, 'combined deployment must forward release arguments only to the runtime operation');
assert.match(deployAll, /remote-deploy\.sh" --app-only/, 'combined deployment must run application deployment without a runtime pipeline');
assert.match(appDeploy, /DEPLOY_SCOPE="app"/, 'application deployment must select its app-only scope explicitly');
assert.match(appDeploy, /--app-only：保留当前 runtime 选择/, 'application deployment must retain the existing runtime selection');
assert.match(appDeploy, /RUNTIME_DELIVERY_MODE="\$\{RUNTIME_DELIVERY_MODE:-ossfs-blob-view\}"/, 'application deployment must default to the production blob view');
assert.match(appDeploy, /legacy-rsync 已退役/, 'legacy-rsync must fail closed instead of synchronizing runtime');
assert.equal(
  appDeploy.includes('rsync "${runtime_rsync_args[@]}"'),
  false,
  'application deployment must not retain a leftover runtime rsync implementation',
);
assert.match(appDeploy, /ossfs-blob-view：不传输 runtime 内容/, 'full application deployment must retain the existing blob view instead of rsync');
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
