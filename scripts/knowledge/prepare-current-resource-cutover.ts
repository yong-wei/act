import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { TeachingProjectionArtifacts } from '@/lib/teaching-projection/contracts';
import { loadStagedTeachingProjection, resolveTeachingProjectionStorePaths } from '@/lib/teaching-projection/store';
import { loadPublishedResourceFeatureIndexCapture } from '@/lib/published-resource-index';
import type { PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';
import { projectionDigest } from '@/lib/teaching-projection/hash';
import { buildActiveBaseline, buildCombinedDenominator, buildExplicitDelta } from '@/lib/latest-authority-oss-cutover/denominator';
import { evaluateContinuityGate } from '@/lib/latest-authority-oss-cutover/continuity-gate';
import { reopenAuthorityCaptureReceipt } from '@/lib/latest-authority-oss-cutover/capture';
import { assertAllocationRecordSealed, sealCoordinationAllocationRecord } from '@/lib/latest-authority-oss-cutover/envelope';
import { reopenResourceEnvelope, type RemediationResourceEnvelope } from '@/lib/formal-resource-remediation/envelope';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import type { ActiveBaseline, ExplicitDeltaInput, ResourceSuccessorDisposition } from '@/lib/latest-authority-oss-cutover/contracts';

export function qualifyPublishedResourceInputs(artifacts: TeachingProjectionArtifacts, index: PublishedResourceFeatureIndex, members: ReadonlySet<string>) {
  const manifest = artifacts.manifest;
  if (!artifacts.gate.passed || !manifest.gatePassed || index.projectionId !== manifest.projectionId
    || index.projectionHash !== manifest.projectionHash || index.snapshotId !== manifest.authoritySnapshotId
    || index.snapshotHash !== manifest.authoritySnapshotHash) throw new Error('resource qualification: publication mismatch');
  const byId = new Map(index.resources.map((row) => [row.identity.resourceId, row]));
  if (byId.size !== index.resources.length || byId.size !== artifacts.resources.length
    || new Set(artifacts.resources.map((row) => row.resourceId)).size !== artifacts.resources.length) throw new Error('resource qualification: resource set mismatch');
  const resources = artifacts.resources.map((row) => {
    const feature = byId.get(row.resourceId);
    if (!feature || feature.type !== row.resourceType || !/^[a-f0-9]{64}$/.test(feature.version)) throw new Error('resource qualification: feature mismatch');
    if (feature.identity.projectionId !== index.projectionId || feature.identity.projectionHash !== index.projectionHash
      || feature.identity.snapshotId !== index.snapshotId || feature.identity.snapshotHash !== index.snapshotHash
      || feature.identity.runtimeReleaseId !== index.runtimeReleaseId) throw new Error('resource qualification: feature identity mismatch');
    const bindings = artifacts.bindings.filter((binding) => binding.resourceId === row.resourceId);
    if (row.bindingCount !== bindings.length || !bindings.length && feature.recommendable) throw new Error('resource qualification: binding count mismatch');
    const canonicalIds = [...new Set(bindings.map((binding) => binding.canonicalId))].sort();
    if (canonicalIds.some((id) => !members.has(id)) || JSON.stringify([...feature.canonicalIds].sort()) !== JSON.stringify(canonicalIds)
      || JSON.stringify([...feature.bindingIds].sort()) !== JSON.stringify(bindings.map((binding) => binding.bindingId).sort())) throw new Error('resource qualification: binding mismatch');
    const readable = feature.backend.kind !== 'reference-only'
      && (feature.backend.kind !== 'container' || feature.backend.childResourceIds.length > 0);
    if (bindings.length && !readable) throw new Error('resource qualification: bound resource is unreadable: ' + row.resourceId);
    return { resourceId: row.resourceId, type: row.resourceType, version: feature.version,
      canonicalIds, bindingIds: bindings.map((binding) => binding.bindingId).sort(), bindingCount: bindings.length,
      backendKind: feature.backend.kind, readable, sourcePath: row.sourcePath,
      projectionStatus: row.projectionStatus, pathEligible: feature.recommendable };
  }).sort((a, b) => a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0);
  const body = { contract: 'published-resource-cutover-qualification/v1', readerContract: index.contract,
    projectionId: index.projectionId, projectionHash: index.projectionHash, snapshotId: index.snapshotId,
    snapshotHash: index.snapshotHash, resources };
  return { ...body, qualificationHash: projectionDigest(body) };
}

async function main() {
  const root = process.cwd();
  const option = (name: string) => { const i = process.argv.indexOf(name); const v = i < 0 ? undefined : process.argv[i + 1];
    if (!v || v.startsWith('--')) throw new Error('missing ' + name); return v; };
  const candidate = option('--candidate-root'), privateRoot = option('--baseline-root'), appRevision = option('--app-revision');
  if (!/^[a-f0-9]{40}$/.test(appRevision) || !candidate.startsWith('course-content/authoring/knowledge/cutover/candidates/') || candidate.split('/').includes('..')) throw new Error('invalid frozen input');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, maxBuffer: 96 * 1024 * 1024 });
  const compilerRevision = process.argv.includes('--compiler-revision') ? option('--compiler-revision') : git('rev-parse', 'HEAD').toString().trim();
  if (!/^[a-f0-9]{40}$/.test(compilerRevision)) throw new Error('full compiler revision required');
  const script = 'scripts/knowledge/prepare-current-resource-cutover.ts';
  if (!git('show', compilerRevision + ':' + script).equals(readFileSync(join(root, script)))) throw new Error('commit resource compiler before sealing');
  const read = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
  const frozen = <T,>(revision: string, p: string): T => JSON.parse(git('show', revision + ':' + p).toString()) as T;
  const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
  const hashFile = (p: string) => sha(readFileSync(p));
  const hashLargeFile = async (p: string) => {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(p)) hash.update(chunk);
    return hash.digest('hex');
  };
  const observed = read<{ lifecycle: { value: { active: Record<string, unknown> } }; activeReceipt: { sha256: string }; manifest: { value: { files: { path: string; sha256: string }[] } } }>(join(privateRoot, 'production-observation.json'));
  const classification = read<{ activeRelease: ActiveBaseline['activeRelease']; entries: ActiveBaseline['entries']; baseline: ActiveBaseline }>(join(privateRoot, 'active-baseline-classification.json'));
  const baseline = buildActiveBaseline({ activeRelease: classification.activeRelease, entries: classification.entries });
  if (baseline.baselineHash !== classification.baseline.baselineHash || baseline.activeRelease.activeReceiptHash !== observed.activeReceipt.sha256) throw new Error('baseline capture mismatch');
  for (const key of ['releaseId', 'manifestSha256', 'treeSha256'] as const) if (baseline.activeRelease[key] !== observed.lifecycle.value.active[key]) throw new Error('baseline Runtime mismatch');
  const pointer = read<{ projectionId: string; projectionHash: string }>(join(root, 'course-content/runtime/knowledge/projection/current.json'));
  const staged = loadStagedTeachingProjection(resolveTeachingProjectionStorePaths(join(root, 'course-content/runtime/knowledge/projection')), pointer.projectionId);
  if (staged.projectionHash !== pointer.projectionHash || staged.artifacts.manifest.authoringRevision !== appRevision) throw new Error('resource source is not the frozen application capture');
  const scope = read<{ scopeHash: string; members: { canonicalId: string }[] }>(join(root, candidate, 'domain-catalog/scope.json'));
  const indexCapture = await loadPublishedResourceFeatureIndexCapture();
  const qualification = qualifyPublishedResourceInputs(staged.artifacts, indexCapture.index, new Set(scope.members.map((row) => row.canonicalId)));
  const resourceById = new Map(qualification.resources.map((row) => [row.resourceId, row]));
  const baselineResources = baseline.entries.filter((row) => row.classification === 'resource' && row.resourceId);
  const baselineIds = new Set(baselineResources.map((row) => row.resourceId));
  const activeFiles = new Map(observed.manifest.value.files.map((row) => [row.path, row.sha256]));
  const retainedFiles = new Map<string, { path: string; predecessorSha256: string; sha256: string }>();
  for (const row of baselineResources) if (row.runtimePath && !retainedFiles.has(row.runtimePath)) {
    if (isAbsolute(row.runtimePath) || row.runtimePath.split('/').includes('..')) throw new Error('unsafe baseline path');
    const predecessorSha256 = activeFiles.get(row.runtimePath);
    if (!predecessorSha256) throw new Error('baseline file lacks manifest evidence');
    retainedFiles.set(row.runtimePath, { path: row.runtimePath, predecessorSha256,
      sha256: await hashLargeFile(join(root, 'course-content/runtime', row.runtimePath)) });
  }
  const deltaInputs: ExplicitDeltaInput[] = qualification.resources.map((row) => ({ resourceId: row.resourceId, subtype: row.type,
    change: baselineIds.has(row.resourceId) ? 'CHANGED' : 'NEW',
    sourceIdentity: 'published:' + qualification.projectionHash + ':' + row.resourceId + ':' + row.version }));
  for (const row of baselineResources) {
    const file = row.runtimePath ? retainedFiles.get(row.runtimePath) : undefined;
    if (row.resourceId && !resourceById.has(row.resourceId) && file && file.predecessorSha256 !== file.sha256) {
      if (!row.subtype) throw new Error('changed baseline resource lacks a subtype');
      deltaInputs.push({ resourceId: row.resourceId, subtype: row.subtype, change: 'CHANGED',
        sourceIdentity: 'runtime:' + file.path + ':sha256:' + file.sha256 });
    }
  }
  const delta = buildExplicitDelta(deltaInputs), denominator = buildCombinedDenominator(baseline, delta);
  const sourceRows = new Map(baselineResources.map((row) => [row.resourceId!, row]));
  const legacyPath = 'course-content/runtime/knowledge/projection/releases/proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d/resources.jsonl';
  const legacyResources = new Map(git('show', appRevision + ':' + legacyPath).toString().trim().split('\n').map((line) => {
    const row = JSON.parse(line) as { resourceId: string; projectionStatus: string; bindingCount: number; sourcePath: string | null };
    return [row.resourceId, row] as const;
  }));
  const dispositions: ResourceSuccessorDisposition[] = denominator.entries.filter((row) => row.classification === 'resource').map((entry) => {
    const resource = resourceById.get(entry.resourceId);
    if (resource) return { resourceId: resource.resourceId, obligation: resource.bindingCount ? 'FORMAL_TEACHING' : 'CATALOG_ONLY',
      obligationEvidenceHash: projectionDigest(resource), currentPathEligible: resource.pathEligible,
      atomicDispositionsComplete: resource.bindingCount ? resource.readable : true,
      canonicalBindingCount: resource.bindingCount, launchContractQualified: resource.bindingCount ? resource.readable : true, failureKinds: [] };
    const source = sourceRows.get(entry.resourceId);
    if (!source) throw new Error('unaccounted baseline resource');
    if (/^act:(?:lesson|step|handout):/.test(entry.resourceId)) {
      const old = legacyResources.get(entry.resourceId);
      if (!old || old.projectionStatus !== 'EXPLICIT_NONE' || old.bindingCount !== 0) throw new Error('current course teaching resource was lost: ' + entry.resourceId);
    }
    return { resourceId: entry.resourceId, obligation: source.courseScope === 'out-of-course' ? 'CATALOG_ONLY' : 'RUNTIME_SUPPORT',
      obligationEvidenceHash: projectionDigest({ source, file: source.runtimePath ? retainedFiles.get(source.runtimePath) : null }),
      currentPathEligible: false, atomicDispositionsComplete: true, canonicalBindingCount: 0, launchContractQualified: true, failureKinds: [] };
  });
  const continuity = evaluateContinuityGate({ denominator, baselineReleaseId: baseline.activeRelease.releaseId, dispositions, retirements: [] });
  if (continuity.status !== 'QUALIFIED') throw new Error('resource continuity is not qualified');
  const capturePath = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r6/authority-capture.json';
  const capture = reopenAuthorityCaptureReceipt(frozen(appRevision, capturePath));
  const transactionPath = 'scripts/knowledge-cutover/remote-activate-r4-coordinated-cutover.sh';
  if (!git('show', compilerRevision + ':' + transactionPath).equals(readFileSync(join(root, transactionPath)))) throw new Error('commit transaction before allocating');
  const allocationPath = join(root, candidate, 'allocation.json');
  const allocation = existsSync(allocationPath) ? read<ReturnType<typeof sealCoordinationAllocationRecord>>(allocationPath)
    : sealCoordinationAllocationRecord({ sealedAt: new Date().toISOString(), capture: { captureHash: capture.captureHash, compatibility: capture.compatibility },
    scopeHash: scope.scopeHash, denominatorHash: denominator.denominatorHash,
    policyVersions: { continuity: 'resource-continuity/v1', teachingClosure: 'coordinated-teaching-closure/v1', rollback: 'coordinated-cutover-rollback/v1' },
    implementationIdentities: { builder: 'latest-authority-oss-cutover-builder/v1', transaction: hashFile(join(root, transactionPath)) } });
  assertAllocationRecordSealed(allocation);
  if (allocation.captureHash !== capture.captureHash || allocation.scopeHash !== scope.scopeHash
    || allocation.denominatorHash !== denominator.denominatorHash
    || allocation.implementationIdentities.transaction !== hashFile(join(root, transactionPath))) throw new Error('existing allocation differs from the frozen inputs');
  const historicalRevision = '425ebc3bf00fa39f7da623d994f24eb091c35247';
  const historicalRoot = 'course-content/authoring/knowledge/formal-resource-remediation';
  const historicalEnvelope = frozen<RemediationResourceEnvelope>(historicalRevision, historicalRoot + '/resource-envelope.json');
  const recordPaths = ['resource-layer/text/text-processing-records.json', '20260823-asr-batch/asr-processing-records.json',
    'resource-layer/exercises/exercise-processing-records.json', 'resource-layer/intro-videos/intro-video-processing-records.json',
    'resource-layer/simulations/simulation-processing-records.json', 'resource-layer/handout-exercises/handout-exercise-processing-records.json'];
  const records = recordPaths.flatMap((p) => frozen<ResourceProcessingRecord[]>(historicalRevision, historicalRoot + '/' + p));
  const reopened = reopenResourceEnvelope({ envelope: historicalEnvelope, processingRecords: records,
    artifactSha256: (p) => sha(git('show', historicalRevision + ':' + p)) });
  if (reopened.state !== 'SEALED') throw new Error('historical resource envelope did not reopen at its original revision');
  const semanticCache = read<{ cacheHash: string }>(join(root, candidate, 'production-authority-semantic-cache.json'));
  const formalBody = { contract: 'coordinated-formal-resource-envelope-incremental-reuse/v1', allocationHash: allocation.allocationHash,
    authorityCaptureHash: capture.captureHash, scopeHash: scope.scopeHash, semanticCacheHash: semanticCache.cacheHash,
    priorEnvelopeHash: historicalEnvelope.envelopeHash, priorEnvelopeContract: historicalEnvelope.contract,
    priorEnvelopeSourceRevision: historicalRevision, resourceQualificationHash: qualification.qualificationHash,
    currentProjectionId: qualification.projectionId, currentProjectionHash: qualification.projectionHash,
    resourceCount: qualification.resources.length, boundResourceCount: qualification.resources.filter((row) => row.bindingCount > 0).length,
    bindingCount: staged.artifacts.bindings.length, appRevision, compilerRevision };
  const formal = { ...formalBody, envelopeHash: projectionDigest(formalBody) };
  const derivationBody = { contract: 'coordinated-baseline-derivation-incremental-reuse/v1', allocationHash: allocation.allocationHash,
    semanticCacheHash: semanticCache.cacheHash, formalResourceEnvelopeHash: formal.envelopeHash,
    sourceBaselineHash: baseline.baselineHash, sourceResourceEnvelopeHash: historicalEnvelope.envelopeHash,
    resourceQualificationHash: qualification.qualificationHash, retainedFileCount: retainedFiles.size,
    changedFileCount: [...retainedFiles.values()].filter((file) => file.sha256 !== file.predecessorSha256).length };
  indexCapture.assertCurrent();
  const write = (name: string, value: unknown) => { const p = join(root, candidate, name); mkdirSync(dirname(p), { recursive: true });
    const bytes = JSON.stringify(value, null, 2) + '\n';
    try { if (readFileSync(p, 'utf8') === bytes) return; throw new Error('immutable prestage artifact differs: ' + name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    writeFileSync(p, bytes, { flag: 'wx' }); };
  write('allocation.json', allocation);
  write('active-baseline.json', baseline);
  write('explicit-resource-delta.json', delta);
  write('denominator.json', denominator);
  write('resource-dispositions.json', dispositions);
  write('resource-qualification.json', qualification);
  write('retained-runtime-files.json', [...retainedFiles.values()]);
  write('continuity-receipt.json', continuity);
  write('formal-resource-envelope.json', formal);
  write('derivation-receipt.json', { ...derivationBody, receiptHash: projectionDigest(derivationBody) });
  write('resource-source-reopen.json', { sourceRevision: historicalRevision, envelopeHash: historicalEnvelope.envelopeHash,
    state: reopened.state, resources: historicalEnvelope.resourceCount,
    privateObservationHashes: { runtime: hashFile(join(privateRoot, 'production-observation.json')), database: hashFile(join(privateRoot, 'production-db-observation.json')) } });
  console.log(JSON.stringify({ continuity: continuity.status, resources: formal.resourceCount, boundResources: formal.boundResourceCount,
    baselineResources: baselineResources.length, allocationHash: allocation.allocationHash, formalResourceEnvelopeHash: formal.envelopeHash }));
}

if (process.argv[1]?.endsWith('prepare-current-resource-cutover.ts')) main().catch((error) => { console.error(error); process.exitCode = 1; });
