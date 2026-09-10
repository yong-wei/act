import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { projectionDigest } from '@/lib/teaching-projection/hash';
import { assertKnowledgePublicationConsistency } from './assert-knowledge-publication-consistency';
import { shardDigest } from '@/lib/authority-domain-shards/hash';
import { assertCandidateReceiptSelfHash, assertAllocationRecordSealed } from '@/lib/latest-authority-oss-cutover/envelope';
import type { CoordinatedCandidateReceipt, CoordinationAllocationRecord } from '@/lib/latest-authority-oss-cutover/contracts';
import { loadStagedTeachingProjection, resolveTeachingProjectionStorePaths } from '@/lib/teaching-projection/store';
import { loadPrerequisitePublication, resolvePrerequisiteStorePaths } from '@/lib/teaching-projection/prerequisites/store';
import { loadStagedConsumerActivation, resolveConsumerActivationStorePaths } from '@/lib/versioned-knowledge-activation/store';
import { loadCandidateDomainFragments } from '@/lib/latest-authority-oss-cutover/domain-fragment-files';
import { evaluateTeachingClosure } from '@/lib/latest-authority-oss-cutover/teaching-closure';
import { reopenAuthorityCaptureReceipt } from '@/lib/latest-authority-oss-cutover/capture';
import { parseRuntimeBlobReleaseManifest } from '@/lib/runtime-release';
import { loadPublishedResourceFeatureIndexCapture } from '@/lib/published-resource-index';
import { qualifyPublishedResourceInputs } from './prepare-current-resource-cutover';
import type { DomainTeachingComposedManifest } from '@/lib/teaching-projection/domain-fragments/contracts';
import type { ActTeachingFamilyDisposition } from '@/lib/act-canonical-teaching-relations/contracts';

const root = process.cwd();
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const hashFile = (p: string) => sha(readFileSync(p));
const read = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const option = (name: string) => { const i = process.argv.indexOf(name); const value = i < 0 ? undefined : process.argv[i + 1];
  if (!value || value.startsWith('--')) throw new Error('missing ' + name); return value; };
function write(file: string, value: unknown) {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  if (existsSync(file)) { if (readFileSync(file, 'utf8') !== bytes) throw new Error('immutable artifact differs: ' + file); return; }
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes, { flag: 'wx' });
}

function capturePredecessor() {
  throw new Error('Runtime lifecycle inspect 已退役。知识合同通过后请使用 npm run runtime:activate');
  const program = String.raw`const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const root='/home/projects/act',state=root+'/data/runtime';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const wire=p=>{const b=fs.readFileSync(p);return {sha256:hash(b),value:JSON.parse(b)}};
const inspect=()=>JSON.parse(cp.execFileSync('python3',[root+'/scripts/runtime-release/runtime-blob-release-lifecycle.py','inspect','--state-dir',state],{encoding:'utf8'}));
const life=inspect();const status=wire(state+'/knowledge-cutover-transactions/r4-c5-current.json');
if(!['COMMITTED','ROLLED_BACK'].includes(status.value.status))throw Error('production transaction is not terminal');
const receipt=wire(state+'/act-runtime-active-receipt.json');const base=state+'/blob-views/current/knowledge';
const selectors={authority:wire(root+'/course-content/authoring/knowledge/authority/current.json'),projection:wire(base+'/projection/current.json'),prerequisite:wire(base+'/prerequisites/current.json'),catalog:wire(base+'/authority-domain-catalog/current.json'),shards:wire(base+'/authority-domain-shards/current.json'),consumerActivation:wire(base+'/consumer-activation/current.json')};
if(JSON.stringify(life)!==JSON.stringify(inspect())||status.sha256!==wire(state+'/knowledge-cutover-transactions/r4-c5-current.json').sha256)throw Error('production changed during capture');
for(const key of ['releaseId','manifestSha256','treeSha256'])if(receipt.value.selection[key]!==life.active[key])throw Error('active receipt mismatch');
const body={contract:'r4-production-predecessor-observation/v1',capturedAt:new Date().toISOString(),runtime:{...life.active,activeReceiptHash:receipt.sha256,lifecycleGeneration:life.generation},stagedDesired:life.desired,lifecycle:life,selectors};
process.stdout.write(JSON.stringify({...body,observationHash:hash(JSON.stringify(body))}));`;
  const command = "node -e '" + program.replaceAll("'", "'\\''") + "'";
  const args = ['-o', 'BatchMode=yes'];
  if (process.env.ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE) args.push('-o', 'UserKnownHostsFile=' + process.env.ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE, '-o', 'StrictHostKeyChecking=yes');
  const value = JSON.parse(execFileSync('ssh', [...args, 'root@121.40.124.135', command], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
  write(option('--out'), value);
  console.log(JSON.stringify({ generation: value.runtime.lifecycleGeneration, active: value.runtime.releaseId, desired: value.stagedDesired?.releaseId }));
}

async function main() {
  if (process.argv[2] === 'capture-predecessor') { capturePredecessor(); return; }
  const candidate = option('--candidate-root');
  if (!candidate.startsWith('course-content/authoring/knowledge/cutover/candidates/') || candidate.split('/').includes('..')) throw new Error('invalid candidate root');
  const out = join(root, candidate), appRevision = option('--app-revision');
  if (!/^[a-f0-9]{40}$/.test(appRevision)) throw new Error('full application revision required');
  const gitRead = (p: string) => execFileSync('git', ['show', appRevision + ':' + p], { cwd: root, encoding: 'utf8', maxBuffer: 96 * 1024 * 1024 });
  assertKnowledgePublicationConsistency((p) => readFileSync(join(root, p), 'utf8'), gitRead);
  const allocation = read<CoordinationAllocationRecord>(join(out, 'allocation.json'));
  assertAllocationRecordSealed(allocation);
  const pointer = (p: string) => read<Record<string, string>>(join(root, 'course-content/runtime/knowledge', p, 'current.json'));
  const course = pointer('projection'), prereq = pointer('prerequisites'), catalog = pointer('authority-domain-catalog'), shards = pointer('authority-domain-shards'), consumer = pointer('consumer-activation');
  const manifestPath = join(root, 'course-content/runtime/knowledge/projection/releases', course.projectionId, 'projection-manifest.json');
  const manifest = read<{ authoritySnapshotId: string; authoritySnapshotHash: string; authorityReleaseId: string; authorityReleaseSetId: string }>(manifestPath);
  const authority = { snapshotId: manifest.authoritySnapshotId, snapshotHash: manifest.authoritySnapshotHash,
    releaseId: manifest.authorityReleaseId, releaseSetId: manifest.authorityReleaseSetId };
  const scope = read<{ courseId: string; scopeHash: string }>(join(out, 'domain-catalog/scope.json'));
  if (scope.scopeHash !== allocation.scopeHash) throw new Error('allocation scope drift');
  if (process.argv[2] === 'observe') {
    const shardManifest = read<{ shardSetId: string; shardSetHash: string; envelope: { authority: unknown; catalog: unknown }; files: Record<string, string> }>(join(root, 'course-content/runtime/knowledge/authority-domain-shards/sets', shards.shardSetId, 'manifest.json'));
    if (shardDigest({ envelope: shardManifest.envelope, files: shardManifest.files }) !== shards.shardSetHash) throw new Error('shard manifest drift');
    write(join(out, 'domain-shards/stage.json'), { authority: shardManifest.envelope.authority, catalog: shardManifest.envelope.catalog,
      shardSetId: shards.shardSetId, shardSetHash: shards.shardSetHash });
    const scopeBody = { contract: 'r4-coordinated-teaching-projection-scope-binding/v1', courseId: scope.courseId, scopeHash: scope.scopeHash,
      projectionId: course.projectionId, projectionHash: course.projectionHash, projectionManifestSha256: hashFile(manifestPath), authority };
    write(join(out, 'projection-scope-binding.json'), { ...scopeBody, bindingHash: projectionDigest(scopeBody) });
    write(join(out, 'projection-adjustments.json'), { contract: 'act-coordinated-projection-adjustments/v1', scopeHash: scope.scopeHash,
      authoritySnapshotHash: authority.snapshotHash, stagedAt: allocation.sealedAt, suppressedSelfLoopPrerequisites: [], inactiveDuplicateCards: [],
      retirementRuling: 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r6/domain-catalog/retirement-ruling.json' });
    execFileSync(join(root, 'node_modules/.bin/tsx'), [join(root, 'scripts/knowledge-cutover/verify-r4-authority-presentation-labels.ts'),
      '--snapshot-dir', 'course-content/authoring/knowledge/authority/releases/' + authority.snapshotId,
      '--catalog', candidate + '/domain-catalog/catalog.json', '--shard-stage', candidate + '/domain-shards/stage.json',
      '--out', candidate + '/presentation-label-qualification.json'], { cwd: root, stdio: 'inherit' });
    write(join(out, 'locale-qualification.json'), read(join(root, 'course-content/runtime/knowledge/composite-envelopes/locale-manifests/control-theory-engineering-v0.37.json')));
    console.log('current cutover observations sealed');
    return;
  }
  if (process.argv[2] !== 'finalize') throw new Error('expected observe, finalize, or capture-predecessor');
  const stagePath = option('--runtime-stage'), predecessorPath = option('--predecessor');
  const stage = read<{ contract: string; runtimeRelease: Record<string, unknown>; materializationReceiptSha256: string }>(stagePath);
  const predecessor = read<{ runtime: Record<string, unknown>; stagedDesired: unknown; lifecycle: unknown; selectors: { authority: { sha256: string } } }>(predecessorPath);
  if (stage.contract !== 'coordinated-runtime-stage/v1' || projectionDigest(stage.runtimeRelease) !== projectionDigest(predecessor.stagedDesired)) throw new Error('stage is not the exact desired Runtime');
  const runtimeManifestPath = join(dirname(stagePath), 'manifest.json');
  const runtimeManifest = parseRuntimeBlobReleaseManifest(read(runtimeManifestPath));
  for (const key of ['releaseId', 'manifestSha256', 'treeSha256'] as const) if (runtimeManifest[key] !== stage.runtimeRelease[key]) throw new Error('staged Runtime manifest mismatch');
  if (hashFile(runtimeManifestPath) !== stage.runtimeRelease.manifestWireSha256
    || readFileSync(runtimeManifestPath).length !== stage.runtimeRelease.manifestWireSizeBytes
    || hashFile(join(dirname(stagePath), 'materialization-receipt.json')) !== stage.materializationReceiptSha256) throw new Error('staged Runtime wire evidence mismatch');
  const baseline = read<{ activeRelease: Record<string, unknown>; entries: unknown[] }>(join(out, 'active-baseline.json'));
  for (const field of ['releaseId', 'manifestSha256', 'treeSha256', 'activeReceiptHash']) if (baseline.activeRelease[field] !== predecessor.runtime[field]) throw new Error('active predecessor changed since resource capture');
  const transactionPath = join(root, 'scripts/knowledge-cutover/remote-activate-r4-coordinated-cutover.sh');
  const transactionHash = hashFile(transactionPath);
  if (allocation.implementationIdentities.transaction !== transactionHash) throw new Error('transaction changed after allocation');
  const formal = read<{ envelopeHash: string; resourceQualificationHash: string }>(join(out, 'formal-resource-envelope.json'));
  const derivation = read<{ receiptHash: string }>(join(out, 'derivation-receipt.json'));
  const teaching = read<{ dispositions: ActTeachingFamilyDisposition[] }>(join(out, 'teaching-dispositions.json'));
  const composed = read<DomainTeachingComposedManifest>(join(out, 'composed-domain-fragment-manifest.json'));
  loadCandidateDomainFragments(out, composed);
  const courseArtifacts = loadStagedTeachingProjection(resolveTeachingProjectionStorePaths(join(root, 'course-content/runtime/knowledge/projection')), course.projectionId);
  const scopeMembers = read<{ members: { canonicalId: string }[] }>(join(out, 'domain-catalog/scope.json')).members;
  const indexCapture = await loadPublishedResourceFeatureIndexCapture();
  const qualifiedResources = qualifyPublishedResourceInputs(courseArtifacts.artifacts, indexCapture.index, new Set(scopeMembers.map((row) => row.canonicalId)));
  if (qualifiedResources.qualificationHash !== formal.resourceQualificationHash) throw new Error('resource content changed after prestage qualification');
  const { envelopeHash: formalClaim, ...formalBody } = formal;
  if (projectionDigest(formalBody) !== formalClaim) throw new Error('formal envelope hash mismatch');
  const { receiptHash: derivationClaim, ...derivationBody } = derivation;
  if (projectionDigest(derivationBody) !== derivationClaim) throw new Error('derivation hash mismatch');
  const capture = reopenAuthorityCaptureReceipt(read(join(out, 'authority-capture/authority-capture.json')));
  const closure = evaluateTeachingClosure({ scopeHash: scope.scopeHash, authorityCaptureHash: capture.captureHash,
    members: scopeMembers, dispositions: teaching.dispositions, candidates: [], decisions: [] });
  const prerequisiteArtifacts = loadPrerequisitePublication(resolvePrerequisiteStorePaths(join(root, 'course-content/runtime/knowledge/prerequisites')), prereq.publicationId);
  const activation = loadStagedConsumerActivation(resolveConsumerActivationStorePaths(join(root, 'course-content/runtime/knowledge/consumer-activation')), consumer.activationId);
  const labels = read<{ qualificationHash: string }>(join(out, 'presentation-label-qualification.json'));
  const reclosure = read<{ receiptHash: string; semanticCacheHash: string }>(join(out, 'teaching-reclosure-receipt.json'));
  const scopeBinding = read<{ bindingHash: string }>(join(out, 'projection-scope-binding.json'));
  const successor = { contract: 'actkg-engineering-authority-current/v1', ...authority,
    activationReceiptId: 'coordinated-graph-course-0-7-6-3120f2fa', activatedAt: allocation.sealedAt };
  write(join(out, 'authority-current.json'), successor);
  const successorIdentity = hashFile(join(out, 'authority-current.json'));
  const policyBody = { contract: 'r4-c5-coordinated-production-verification/v1', semanticCacheHash: reclosure.semanticCacheHash,
    presentationLabelQualificationHash: labels.qualificationHash, presentationLabelQualificationSha256: hashFile(join(out, 'presentation-label-qualification.json')),
    projectionScopeHash: scope.scopeHash, projectionScopeAdjustmentSha256: hashFile(join(out, 'projection-adjustments.json')),
    projectionScopeBindingHash: scopeBinding.bindingHash, projectionScopeBindingSha256: hashFile(join(out, 'projection-scope-binding.json')),
    teachingGovernanceReclosureHash: reclosure.receiptHash, teachingGovernanceReclosureSha256: hashFile(join(out, 'teaching-reclosure-receipt.json')),
    requireFinalReceiptBeforeConsumerRestart: true, sourceRevisionMustBeIntegrationAncestor: true };
  const policy = { ...policyBody, verificationPolicyHash: projectionDigest(policyBody) };
  write(join(out, 'verification-policy.json'), policy);
  const delta = read<{ orderedInputs: unknown[] }>(join(out, 'explicit-resource-delta.json'));
  const input = { activeRelease: baseline.activeRelease, runtimePredecessorForBinding: predecessor.runtime, entries: baseline.entries,
    delta: delta.orderedInputs, dispositions: read(join(out, 'resource-dispositions.json')), scope: read(join(out, 'domain-catalog/scope.json')),
    teaching: { dispositions: teaching.dispositions, candidates: [], decisions: [] }, allocation,
    inner: { localeQualificationHash: hashFile(join(out, 'locale-qualification.json')), teachingProjectionHash: course.projectionHash,
      composedDomainFragmentManifestHash: composed.projectionHash, domainFragmentSetHash: composed.sourceHashes.fragments,
      formalResourceEnvelopeHash: formal.envelopeHash, derivationReceiptHash: derivation.receiptHash,
      successorRuntimeManifest: stage.runtimeRelease, successorRuntimeMaterializationHash: stage.materializationReceiptSha256,
      domainShardCatalogHash: catalog.catalogHash, domainShardSetHash: shards.shardSetHash,
      prerequisitePublicationHash: prereq.publicationHash, consumerActivationHash: consumer.activationHash },
    predecessor: [{ selectorId: 'authority:current', identity: predecessor.selectors.authority.sha256 }],
    predecessorRuntimeLifecycleGeneration: predecessor.runtime.lifecycleGeneration,
    successorSelectorExpectations: [{ selectorId: 'authority:current', expectedSuccessorIdentity: successorIdentity }],
    transactionImplementationIdentity: transactionHash,
    rollbackPlanHash: projectionDigest({ authorityBefore: predecessor.selectors.authority.sha256, authorityAfter: successorIdentity,
      runtimeLifecycleBefore: predecessor.lifecycle, runtimeAfter: stage.runtimeRelease }), verificationPolicyHash: policy.verificationPolicyHash };
  write(join(out, 'prepare-input.json'), input);
  write(join(out, 'runtime-stage.json'), stage);
  write(join(out, 'predecessor-observation.json'), read(predecessorPath));
  write(join(out, 'lifecycle-predecessor.json'), predecessor.lifecycle);
  write(join(out, 'successor-manifest.json'), stage.runtimeRelease);
  write(join(out, 'reuse-receipt.json'), { contract: 'graph-course-prestage-reuse/v1', allocationHash: allocation.allocationHash,
    formalResourceEnvelopeHash: formal.envelopeHash, derivationReceiptHash: derivation.receiptHash });
  const coordinator = join(root, 'scripts/knowledge-cutover/coordinate-latest-authority-oss-cutover.ts');
  execFileSync(join(root, 'node_modules/.bin/tsx'), [coordinator, 'prepare', '--capture', join(out, 'authority-capture/authority-capture.json'),
    '--input', join(out, 'prepare-input.json'), '--out', out], { cwd: root, stdio: 'inherit' });
  const receipt = read<CoordinatedCandidateReceipt>(join(out, 'candidate-receipt.json'));
  assertCandidateReceiptSelfHash(receipt);
  const extension = read(join(out, 'successor-runtime-manifest-extension.json'));
  const reopenedContinuity = read<{ receiptHash: string }>(join(out, 'continuity-receipt.json'));
  const shardManifest = read<{ shardSetHash: string; envelope: unknown; files: Record<string, string> }>(join(root, 'course-content/runtime/knowledge/authority-domain-shards/sets', shards.shardSetId, 'manifest.json'));
  const shardHash = shardDigest({ envelope: shardManifest.envelope, files: shardManifest.files });
  if (shardHash !== shards.shardSetHash) throw new Error('shard hash mismatch');
  const artifacts = [
    ['authority-capture', capture.captureHash], ['locale-qualification', hashFile(join(out, 'locale-qualification.json'))],
    ['teaching-projection', courseArtifacts.projectionHash], ['teaching-closure-receipt', closure.receiptHash],
    ['composed-domain-fragment-manifest', composed.projectionHash], ['domain-fragment-set', composed.sourceHashes.fragments],
    ['formal-resource-envelope', formalClaim], ['continuity-receipt', reopenedContinuity.receiptHash],
    ['derivation-receipt', derivationClaim], ['successor-runtime-manifest', projectionDigest({ successorManifest: stage.runtimeRelease, materializationReceiptHash: stage.materializationReceiptSha256, extension })],
    ['successor-runtime-materialization', hashFile(join(dirname(stagePath), 'materialization-receipt.json'))], ['authority-domain-shard-catalog', catalog.catalogHash],
    ['authority-domain-shard-set', shardHash], ['prerequisite-publication', prerequisiteArtifacts.manifest.publicationHash],
    ['consumer-activation', activation.activationHash],
  ].map(([artifactId, artifactHash]) => ({ artifactId, artifactHash }));
  indexCapture.assertCurrent();
  write(join(out, 'outer-artifacts.json'), artifacts);
  execFileSync(join(root, 'node_modules/.bin/tsx'), [coordinator, 'qualify', '--candidate', join(out, 'candidate-receipt.json'),
    '--artifacts', join(out, 'outer-artifacts.json')], { cwd: root, stdio: 'inherit' });
}

if (process.argv[1]?.endsWith('finalize-current-resource-cutover.ts')) main().catch((error) => { console.error(error); process.exitCode = 1; });
