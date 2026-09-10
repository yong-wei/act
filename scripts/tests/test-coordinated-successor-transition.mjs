import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const remote = fs.readFileSync(path.join(root, 'scripts/knowledge-cutover/remote-activate-r4-coordinated-cutover.sh'), 'utf8');
const cutoverInputBuilder = fs.readFileSync(path.join(root, 'scripts/knowledge-cutover/build-r4-c5-cutover-input.ts'), 'utf8');
const deploy = fs.readFileSync(path.join(root, 'deploy/podman/deploy.sh'), 'utf8');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'coordinated-successor-'));
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',')}}`
    : JSON.stringify(value);
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value) + '\n');
function extract(name) {
  const start = remote.indexOf(name + '() {');
  const end = remote.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, name);
  return remote.slice(start, end + 3);
}
function run(body, variables = {}) {
  const assignments = Object.entries(variables).map(([key, value]) => `${key}=${quote(value)}`).join('\n');
  return spawnSync('bash', ['-c', 'set -euo pipefail\n' + assignments + '\n' + body], { encoding: 'utf8' });
}

try {
  const state = path.join(fixture, 'data/runtime');
  const candidate = path.join(fixture, 'new-candidate');
  const oldDir = path.join(fixture, 'old-candidate');
  fs.mkdirSync(state, { recursive: true });
  fs.mkdirSync(candidate);
  fs.mkdirSync(oldDir);
  const envFile = path.join(state, 'act-obe.env');
  fs.writeFileSync(envFile, `LATEST_CUTOVER_CANDIDATE_DIR=${oldDir}\n`);
  write(path.join(candidate, 'candidate-receipt.json'), { receiptHash: 'c'.repeat(64) });
  const stub = path.join(fixture, 'deploy.sh');
  fs.writeFileSync(stub, '#!/usr/bin/env bash\nprintf "%s %s\\n" "$LATEST_CUTOVER_CANDIDATE_DIR" "$ACT_COORDINATED_CUTOVER_REQUIRED"\n', { mode: 0o755 });
  const mountVars = { PROJECT_DIR: fixture, STATE_DIR: state, candidate_dir: candidate,
    previous_candidate_mount: path.join(candidate, 'previous-candidate-mount.json'), DEPLOY: stub,
    RAM_ROLE: 'role', VIEW_ROOT: '/views', rollback_image: 'old-image', final_receipt: '/receipt' };
  const mountFunctions = ['capture_candidate_mount_predecessor', 'candidate_mount_for_deploy', 'deploy_runtime_cutover_app'].map(extract).join('\n');
  const mounted = run(mountFunctions + '\ncapture_candidate_mount_predecessor\ndeploy_runtime_cutover_app true 0 successor\ndeploy_runtime_cutover_app true 0 predecessor', mountVars);
  assert.equal(mounted.status, 0, mounted.stderr);
  assert.deepEqual(mounted.stdout.trim().split('\n'), [candidate + ' true', oldDir + ' true']);

  const start = deploy.indexOf('# Capture caller values');
  const end = deploy.indexOf('if [ "$runtime_knowledge_mode_was_set" = "1" ]; then');
  const precedence = run(deploy.slice(start, end) + '\nprintf "%s" "$LATEST_CUTOVER_CANDIDATE_DIR"', {
    PROJECT_DIR: fixture, SCRIPT_DIR: path.join(fixture, 'scripts'), RUNTIME_ENV_FILE: envFile,
    LATEST_CUTOVER_CANDIDATE_DIR: candidate,
  });
  assert.equal(precedence.status, 0, precedence.stderr);
  assert.equal(precedence.stdout, candidate, 'caller candidate must win over the persisted predecessor');

  const authorityPath = path.join(fixture, 'authority.json');
  const authorityWire = JSON.stringify({ snapshotId: 'predecessor' });
  fs.writeFileSync(authorityPath, authorityWire);
  const identity = { schemaVersion: 'runtime-blob-release-identity.v1', releaseId: 'runtime-old',
    manifestVersion: 'act-runtime-release.v2', manifestSha256: 'a'.repeat(64), manifestWireSha256: 'b'.repeat(64),
    manifestWireSizeBytes: 123, treeSha256: 'd'.repeat(64) };
  const journalBody = { transactionId: 'tx-old', openedAt: '2026-09-09T00:00:00.000Z', candidateReceiptHash: 'e'.repeat(64),
    predecessor: [], orderedMutations: [{ selectorId: 'authority:current', successorIdentity: sha(authorityWire) }], compensationPlan: [] };
  const journal = { ...journalBody, journalHash: sha(canonical(journalBody)) };
  const journalPath = path.join(fixture, 'journal.json');
  write(journalPath, journal);
  const receiptBody = { transactionId: journal.transactionId, journalHash: journal.journalHash, candidateReceiptHash: journal.candidateReceiptHash,
    committedSelectors: [{ selectorId: 'authority:current', identity: sha(authorityWire) }], mutationReceiptHashes: [],
    runtimeActiveReceiptHash: 'f'.repeat(64), runtimeActiveIdentity: identity };
  const receiptPath = path.join(fixture, 'receipt.json');
  const receipt = { contract: 'coordinated-active-receipt/v1', ...receiptBody, receiptHash: sha(canonical(receiptBody)) };
  write(receiptPath, receipt);
  const predecessorPath = path.join(candidate, 'lifecycle-predecessor.json');
  write(predecessorPath, { active: identity });
  const lifecycle = path.join(fixture, 'lifecycle.py');
  fs.writeFileSync(lifecycle, 'import json\nprint(' + JSON.stringify(JSON.stringify({ active: identity })) + ')\n');
  const candidateReceipt = { receiptHash: 'c'.repeat(64), predecessor: [{ selectorId: 'authority:current', identity: sha(authorityWire) }] };
  write(path.join(candidate, 'candidate-receipt.json'), candidateReceipt);
  const vars = { journal_path: journalPath, candidate_dir: candidate, final_receipt: receiptPath,
    AUTHORITY_ROOT: fixture, LIFECYCLE: lifecycle, STATE_DIR: state };
  fs.copyFileSync(authorityPath, path.join(fixture, 'current.json'));
  const follow = extract('new_candidate_follows_committed') + '\nnew_candidate_follows_committed';
  const before = fs.readFileSync(journalPath);
  assert.equal(run(follow, vars).status, 0, 'a different candidate may follow the exact committed predecessor');
  assert.deepEqual(fs.readFileSync(journalPath), before, 'historical journal stays immutable');
  write(path.join(candidate, 'candidate-receipt.json'), { ...candidateReceipt, receiptHash: journal.candidateReceiptHash });
  assert.notEqual(run(follow, vars).status, 0, 'same-candidate replay stays forbidden');
  write(path.join(candidate, 'candidate-receipt.json'), { ...candidateReceipt, predecessor: [] });
  assert.notEqual(run(follow, vars).status, 0, 'foreign Authority predecessor stays forbidden');
  write(path.join(candidate, 'candidate-receipt.json'), candidateReceipt);
  write(predecessorPath, { active: { ...identity, releaseId: 'runtime-other' } });
  assert.notEqual(run(follow, vars).status, 0, 'foreign Runtime predecessor stays forbidden');
  write(predecessorPath, { active: identity });
  write(receiptPath, { ...receipt, receiptHash: '0'.repeat(64) });
  assert.notEqual(run(follow, vars).status, 0, 'tampered committed receipt stays forbidden');

  const proofDir = path.join(fixture, 'resource-proof');
  fs.mkdirSync(proofDir);
  const proofCandidate = path.join(proofDir, 'candidate-receipt.json');
  const successorPath = path.join(proofDir, 'authority-current.json');
  const projectionHash = '1'.repeat(64);
  const qualificationBody = { contract: 'published-resource-cutover-qualification/v1', projectionHash,
    projectionId: 'proj-' + projectionHash, snapshotId: 'snap-' + '2'.repeat(64), snapshotHash: '2'.repeat(64),
    resources: [{ resourceId: 'resource', bindingCount: 1, bindingIds: ['binding'], readable: true }] };
  const resourceBlockStart = remote.indexOf('formal_path=os.path.join');
  const resourceBlockEnd = remote.indexOf("reclosure_hash=teaching_reclosure.get", resourceBlockStart);
  assert.ok(resourceBlockStart >= 0 && resourceBlockEnd > resourceBlockStart);
  const checkResourceProof = (body) => {
    const qualification = { ...body, qualificationHash: sha(canonical(body)) };
    write(path.join(proofDir, 'resource-qualification.json'), qualification);
    const formalBody = { contract: 'coordinated-formal-resource-envelope-incremental-reuse/v1', allocationHash: '3'.repeat(64),
      scopeHash: '4'.repeat(64), resourceQualificationHash: qualification.qualificationHash };
    const formal = { ...formalBody, envelopeHash: sha(canonical(formalBody)) };
    write(path.join(proofDir, 'formal-resource-envelope.json'), formal);
    write(proofCandidate, { formalResourceEnvelopeHash: formal.envelopeHash, allocationHash: formal.allocationHash, teachingProjectionHash: projectionHash });
    write(successorPath, { snapshotId: qualificationBody.snapshotId, snapshotHash: qualificationBody.snapshotHash });
    const prefix = 'import os,json,hashlib\n'
      + `candidate_path=${JSON.stringify(proofCandidate)}\nsuccessor_path=${JSON.stringify(successorPath)}\n`
      + 'candidate=json.load(open(candidate_path))\n'
      + `policy={'projectionScopeHash':${JSON.stringify(formal.scopeHash)}}\n`
      + "canonical=lambda value:json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()\n"
      + 'sha=lambda value:hashlib.sha256(value).hexdigest()\n';
    return spawnSync('python3', ['-c', prefix + remote.slice(resourceBlockStart, resourceBlockEnd)], { encoding: 'utf8' });
  };
  assert.equal(checkResourceProof(qualificationBody).status, 0);
  assert.notEqual(checkResourceProof({ ...qualificationBody, resources: [{ ...qualificationBody.resources[0], readable: false }] }).status, 0);
  assert.notEqual(checkResourceProof({ ...qualificationBody, snapshotHash: '5'.repeat(64) }).status, 0);

  const reclosureBlockStart = remote.indexOf("if teaching_reclosure.get('successorSnapshotHash')");
  const reclosureBlockEnd = remote.indexOf("if projection_adjustment.get('authoritySnapshotHash')", reclosureBlockStart);
  assert.ok(reclosureBlockStart >= 0 && reclosureBlockEnd > reclosureBlockStart, 'remote preflight must validate the sealed governance reclosure fields');
  const sourceOwnedReclosure = JSON.parse(fs.readFileSync(
    path.join(root, 'course-content/authoring/knowledge/cutover/candidates/graph-course-app-0-7-6-3120f2fa-source-owned/teaching-reclosure-receipt.json'),
    'utf8',
  ));
  const checkRemoteReclosure = (changedFields) => spawnSync('python3', ['-c', [
    'import sys',
    `successor={'snapshotHash':${JSON.stringify(sourceOwnedReclosure.successorSnapshotHash)}}`,
    `teaching_reclosure={'successorSnapshotHash':${JSON.stringify(sourceOwnedReclosure.successorSnapshotHash)},'changedFields':${JSON.stringify(changedFields)}}`,
    remote.slice(reclosureBlockStart, reclosureBlockEnd),
  ].join('\n')], { encoding: 'utf8' });
  assert.deepEqual(
    sourceOwnedReclosure.changedFields,
    ['scopeHash', 'retiredMembers', 'prerequisiteDispositions'],
    'the source-owned candidate must declare every reclosed governance field',
  );
  assert.ok(
    cutoverInputBuilder.includes("JSON.stringify(['scopeHash', 'retiredMembers', 'prerequisiteDispositions'])"),
    'the local c5 candidate builder must accept the reclosure contract emitted by the source-owned producer',
  );
  assert.equal(
    checkRemoteReclosure(sourceOwnedReclosure.changedFields).status,
    0,
    'the complete remote preflight must accept the sealed source-owned reclosure receipt',
  );
  assert.equal(checkRemoteReclosure(['scopeHash']).status, 0, 'the remote preflight preserves the legacy sealed receipt contract');
  assert.notEqual(
    checkRemoteReclosure(['scopeHash', 'retiredMembers']).status,
    0,
    'the remote preflight rejects a partial governance reclosure field set',
  );
  console.log('coordinated successor transition checks passed');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
