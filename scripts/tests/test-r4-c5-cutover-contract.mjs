import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const builder = path.join(root, 'scripts/knowledge-cutover/build-r4-c5-cutover-input.ts');
const coordinator = path.join(root, 'scripts/knowledge-cutover/coordinate-latest-authority-oss-cutover.ts');
const qualificationArtifacts = path.join(root, 'scripts/knowledge-cutover/build-r4-c5-qualification-artifacts.ts');
const remote = fs.readFileSync(path.join(root, 'scripts/knowledge-cutover/remote-activate-r4-coordinated-cutover.sh'), 'utf8');
const deploy = fs.readFileSync(path.join(root, 'scripts/knowledge-cutover/deploy-r4-c5-coordinated-cutover.sh'), 'utf8');
const activationTransaction = fs.readFileSync(path.join(root, 'scripts/runtime-release/runtime-blob-activation-transaction.py'), 'utf8');

for (const invariant of [
  'flock -x 9',
  'stop_consumers',
  'act-obe-app act-obe-worker act-obe-submission-scanner act-obe-submission-gc',
  'cutover-transaction-journal/v1',
  'coordinated-runtime-authorization/v1',
  '--coordinated-activate-before-consumers',
  '--verify-active-consumers',
  'coordinated-active-receipt/v1',
  'ACT_COORDINATED_CUTOVER_REQUIRED=true',
  'BLOCKED_RECOVERY',
  'restore-coordinated-predecessor',
  'lifecycle-predecessor.json',
  'curl -fsS "http://127.0.0.1:${app_port}/api/readyz"',
  'Authority successor snapshot is not installed as a regular manifest',
  'Teaching Projection scope binding does not select the candidate Projection',
  'Runtime manifest extension does not match the sealed candidate',
  'candidate rollback plan does not bind the observed Runtime and Authority identities',
]) {
  assert.ok(remote.includes(invariant), `coordinated remote transaction must include ${invariant}`);
}
assert.ok(
  remote.lastIndexOf('--coordinated-activate-before-consumers') < remote.lastIndexOf('seal_final_receipt'),
  'Runtime must activate with consumers stopped before the final active receipt is sealed',
);
assert.doesNotMatch(
  remote,
  /"\$DEPLOY" --runtime-cutover-app-only[^\n]*\|\| true/,
  'recovery deployment failure must not be reported as a completed rollback',
);
assert.ok(
  remote.lastIndexOf('seal_final_receipt') < remote.lastIndexOf('"$DEPLOY" --runtime-cutover-app-only'),
  'consumer visibility must wait until the final coordinated receipt is durable',
);
assert.ok(
  remote.lastIndexOf('"$DEPLOY" --runtime-cutover-app-only')
    < remote.lastIndexOf('--verify-active-consumers')
    && remote.lastIndexOf('--verify-active-consumers') < remote.lastIndexOf('write_journal SUCCESSOR_READY')
    && remote.lastIndexOf('write_journal SUCCESSOR_READY') < remote.lastIndexOf('write_journal COMMITTED'),
  'a restarted successor must pass readiness, consumer, and signed-media verification before COMMITTED',
);
assert.ok(
  remote.indexOf("'status': status") > remote.indexOf("'journalHash'"),
  'mutable transaction status must not participate in the immutable journal hash',
);
assert.ok(
  remote.includes('journal_path="$journal_dir/${transaction_id}.json"'),
  'each production invocation must write an immutable journal named by its unique transaction id',
);
assert.ok(
  remote.indexOf('transaction_id="tx-') < remote.indexOf('journal_path="$journal_dir/${transaction_id}.json"'),
  'the immutable journal path must be allocated only after the transaction id exists',
);
assert.ok(
  remote.lastIndexOf('recover_incomplete_transaction') < remote.indexOf('transaction_id="tx-'),
  'a durable incomplete transaction must be recovered before a new transaction id is allocated',
);
assert.match(
  remote,
  /if \[\[ "\$prior_status" == "COMMITTED" \]\]; then[\s\S]*?completed=1[\s\S]*?trap - ERR INT TERM[\s\S]*?exit 1/u,
  'a replay after COMMITTED must terminate without entering recovery or rewriting the terminal journal',
);
assert.match(
  remote,
  /if \[\[ "\$prior_status" == "ROLLED_BACK" \]\]; then[\s\S]*?transaction_id=""[\s\S]*?journal_path=""[\s\S]*?return 0/u,
  'a replacement transaction after ROLLED_BACK must not inherit terminal journal context into its ERR trap',
);
assert.match(
  remote,
  /status_record\.get\('status'\) not in \{'PREPARED', 'AUTHORITY_APPLIED', 'RUNTIME_ACTIVATED', 'FINAL_RECEIPT_WRITTEN', 'SUCCESSOR_READY'\}/u,
  'only explicitly recoverable durable transaction states may enter automatic compensation',
);
assert.match(
  remote,
  /incomplete transaction has an inconsistent Authority and Runtime predecessor state/u,
  'mixed predecessor state must fail closed instead of opening a replacement transaction',
);
assert.match(
  remote,
  /load_prior_transaction_context\(\)/u,
  'the durable status pointer must be loaded before candidate-specific reconciliation',
);
assert.ok(
  remote.indexOf('block_incomplete_recovery') < remote.indexOf('recover_incomplete_transaction'),
  'a reconciliation failure must enter the durable blocked-recovery path',
);
assert.match(
  remote,
  /stop_consumers \|\| true\n\s+if \[\[ -n "\$transaction_id" && -n "\$journal_path" \]\]; then\n\s+write_recovery_status BLOCKED_RECOVERY/u,
  'an unreconciled durable transaction must stop consumers and persist BLOCKED_RECOVERY before exiting',
);
assert.match(
  remote,
  /r4-coordinated-production-recovery-block\/v1/u,
  'an unreadable status pointer must leave a separate durable blocked-recovery record without overwriting evidence',
);
assert.ok(
  remote.includes('status_path="$journal_dir/r4-c5-current.json"')
    && remote.includes("'journalPath': os.path.basename(output_path)"),
  'the mutable current status must point to the immutable transaction journal instead of replacing it',
);
assert.match(
  remote,
  /stop_consumers\(\) \{\n\s+consumers_stop_intent=1\n\s+local name/u,
  'consumer stop intent must be durable in process state before the first stop can partially succeed',
);
assert.match(
  remote,
  /if \[\[ "\$recovery_safe" == "1" && "\$consumers_stop_intent" == "1" && -n "\$rollback_image" \]\]; then/u,
  'partial consumer stop recovery must redeploy the predecessor even when not every stop completed',
);
assert.ok(
  remote.indexOf('stop_consumers || recovery_safe=0') < remote.indexOf('restore_runtime_predecessor || recovery_safe=0'),
  'a successor that has already restarted consumers must be stopped before lifecycle and Authority compensation',
);
assert.match(deploy, /tar -C "\$\(dirname "\$source_snapshot"\)" -cf - "\$snapshot"/, 'local wrapper must transfer the immutable Authority snapshot');
assert.match(deploy, /authority-current\.json/, 'local wrapper must derive and validate the Authority snapshot from the sealed successor');
assert.doesNotMatch(deploy, /snap-0d9014eb9041af5b339084c3ceb7a64b007ef852519386e4c2239ed4aee7fd1a/, 'local wrapper must not retain the superseded c4 snapshot');
assert.doesNotMatch(deploy, /scripts\/build\.sh|docker buildx/, 'outer cutover wrapper must not build on the production path');
assert.match(activationTransaction, /--coordinated-runtime-authorization/, 'activation wrapper must forward the pre-activation authorization');
assert.doesNotMatch(activationTransaction, /coordinated-graph-receipt/, 'activation wrapper must not retain the cyclic final-receipt argument');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'act-r4-c5-builder-'));
try {
  const baseline = JSON.parse(fs.readFileSync(
    path.join(root, 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4/active-baseline/active-baseline-classification.json'),
    'utf8',
  )).activeRelease;
  const predecessorRuntime = {
    schemaVersion: 'runtime-blob-release-identity.v1',
    releaseId: baseline.releaseId,
    manifestVersion: 'act-runtime-release.v2',
    manifestSha256: baseline.manifestSha256,
    manifestWireSha256: '9'.repeat(64),
    manifestWireSizeBytes: 456,
    treeSha256: baseline.treeSha256,
    activeReceiptHash: baseline.activeReceiptHash,
    lifecycleGeneration: baseline.lifecycleGeneration,
  };
  const predecessorIdentity = {
    schemaVersion: predecessorRuntime.schemaVersion,
    releaseId: predecessorRuntime.releaseId,
    manifestVersion: predecessorRuntime.manifestVersion,
    manifestSha256: predecessorRuntime.manifestSha256,
    manifestWireSha256: predecessorRuntime.manifestWireSha256,
    manifestWireSizeBytes: predecessorRuntime.manifestWireSizeBytes,
    treeSha256: predecessorRuntime.treeSha256,
  };
  const authority = {
    contract: 'actkg-engineering-authority-current/v1',
    snapshotId: 'snap-9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
    snapshotHash: '9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
    releaseId: 'ctr:release:control-theory-engineering-v0.22',
    releaseSetId: 'actkg-authoritative-candidate-control-theory-engineering-v0.22',
    activationReceiptId: 'v022-cutover-authority',
    activatedAt: '2026-08-20T00:00:00.000Z',
  };
  const predecessorPath = path.join(fixture, 'predecessor.json');
  const stagePath = path.join(fixture, 'stage.json');
  const out = path.join(fixture, 'candidate');
  const writePredecessor = (stagedDesired) => {
    const lifecycle = {
      schemaVersion: 'runtime-blob-release-lifecycle.v2',
      generation: predecessorRuntime.lifecycleGeneration,
      transactionId: '1'.repeat(32),
      desired: stagedDesired,
      active: predecessorIdentity,
      rollback: null,
      publishing: [],
      retained: [],
    };
    fs.writeFileSync(predecessorPath, `${JSON.stringify({
      contract: 'r4-production-predecessor-observation/v1',
      runtime: predecessorRuntime,
      stagedDesired,
      lifecycle,
      selectors: { authority: { sha256: 'a'.repeat(64), value: authority } },
      observationHash: 'b'.repeat(64),
    })}\n`);
    return lifecycle;
  };
  writePredecessor(null);
  const run = (args) => execFileSync(path.join(root, 'node_modules/.bin/tsx'), [builder, '--', ...args], { cwd: root, encoding: 'utf8' });
  const expectFailure = (args, pattern) => {
    const result = spawnSync(path.join(root, 'node_modules/.bin/tsx'), [builder, '--', ...args], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0, 'expected the c5 builder to fail');
    assert.match(`${result.stdout}${result.stderr}`, pattern);
  };
  run(['--prestage', '--predecessor', predecessorPath, '--out', out, '--sealed-at', '2026-08-26T09:00:00.000Z']);
  const allocation = JSON.parse(fs.readFileSync(path.join(out, 'allocation.json'), 'utf8'));
  const envelope = JSON.parse(fs.readFileSync(path.join(out, 'formal-resource-envelope.json'), 'utf8'));
  assert.match(allocation.allocationHash, /^[a-f0-9]{64}$/);
  assert.match(envelope.envelopeHash, /^[a-f0-9]{64}$/);
  const runtimeRelease = {
    schemaVersion: 'runtime-blob-release-identity.v1',
    releaseId: 'runtime-r4-c5-test',
    manifestVersion: 'act-runtime-release.v2',
    manifestSha256: 'c'.repeat(64),
    manifestWireSha256: 'd'.repeat(64),
    manifestWireSizeBytes: 123,
    treeSha256: 'e'.repeat(64),
  };
  fs.writeFileSync(stagePath, `${JSON.stringify({
    contract: 'coordinated-runtime-stage/v1',
    runtimeRelease,
    materializationReceiptSha256: 'e'.repeat(64),
  })}\n`);
  const stagedLifecycle = writePredecessor(runtimeRelease);
  run(['--runtime-stage', stagePath, '--predecessor', predecessorPath, '--out', out, '--sealed-at', '2026-08-26T09:01:00.000Z']);
  const input = JSON.parse(fs.readFileSync(path.join(out, 'prepare-input.json'), 'utf8'));
  assert.equal(input.allocation.allocationHash, allocation.allocationHash, 'Runtime staging must consume the presealed allocation');
  assert.equal(input.inner.formalResourceEnvelopeHash, envelope.envelopeHash, 'Runtime staging must consume the presealed formal envelope');
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(out, 'lifecycle-predecessor.json'), 'utf8')),
    stagedLifecycle,
    'candidate must retain the complete staged Runtime lifecycle predecessor for compensation',
  );
  const labels = JSON.parse(fs.readFileSync(path.join(out, 'presentation-label-qualification.json'), 'utf8'));
  const adjustments = JSON.parse(fs.readFileSync(path.join(out, 'projection-adjustments.json'), 'utf8'));
  const scopeBinding = JSON.parse(fs.readFileSync(path.join(out, 'projection-scope-binding.json'), 'utf8'));
  const reclosure = JSON.parse(fs.readFileSync(path.join(out, 'teaching-reclosure-receipt.json'), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.join(out, 'verification-policy.json'), 'utf8'));
  assert.equal(labels.status, 'PASS', 'candidate must carry the automated presentation-label qualification');
  assert.match(adjustments.scopeHash, /^[a-f0-9]{64}$/, 'candidate must carry the Teaching Projection scope binding');
  assert.equal(policy.projectionScopeHash, adjustments.scopeHash, 'candidate must bind the Teaching Projection scope');
  assert.equal(scopeBinding.projectionHash, input.inner.teachingProjectionHash, 'scope binding must select the exact Teaching Projection');
  assert.equal(policy.projectionScopeBindingHash, scopeBinding.bindingHash, 'candidate must bind the exact Teaching Projection scope receipt');
  assert.equal(reclosure.status, 'COMPLETE', 'candidate must carry the completed teaching-governance reclosure');
  assert.equal(policy.teachingGovernanceReclosureHash, reclosure.receiptHash, 'candidate must bind the teaching-governance reclosure');
  assert.equal(policy.verificationPolicyHash, input.verificationPolicyHash, 'candidate must bind the presentation-label verification policy');
  execFileSync(path.join(root, 'node_modules/.bin/tsx'), [coordinator, 'prepare',
    '--capture', 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4/authority-capture/authority-capture.json',
    '--input', path.join(out, 'prepare-input.json'), '--out', out,
  ], { cwd: root, encoding: 'utf8' });
  execFileSync(path.join(root, 'node_modules/.bin/tsx'), [qualificationArtifacts, '--candidate-dir', out], { cwd: root, encoding: 'utf8' });
  execFileSync(path.join(root, 'node_modules/.bin/tsx'), [coordinator, 'qualify',
    '--candidate', path.join(out, 'candidate-receipt.json'), '--artifacts', path.join(out, 'outer-artifacts.json'),
  ], { cwd: root, encoding: 'utf8' });
  const tamperedRuntimeRelease = { ...runtimeRelease, manifestWireSha256: 'f'.repeat(64) };
  fs.writeFileSync(stagePath, `${JSON.stringify({
    contract: 'coordinated-runtime-stage/v1',
    runtimeRelease: tamperedRuntimeRelease,
    materializationReceiptSha256: 'e'.repeat(64),
  })}\n`);
  expectFailure(
    ['--runtime-stage', stagePath, '--predecessor', predecessorPath, '--out', out, '--sealed-at', '2026-08-26T09:01:00.000Z'],
    /fresh predecessor observation is not the expected staged Runtime lifecycle/,
  );
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

process.stdout.write('r4 c5 coordinated cutover contract tests passed\n');
