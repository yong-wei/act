/** Compound v0.22 cutover qualification: inactive, publication-only. */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  AuthorityEngineeringBody,
  AuthoritySnapshotManifest,
} from '../../authoritative-knowledge/authority-snapshot';
import { loadPinnedV022Envelope } from '../../actkg-v022-display-projections';
import { buildAuthorityDomainCatalog } from '../../authority-domain-catalog';
import type { AuthorityDomainCatalogAuthoring } from '../../authority-domain-catalog';
import { projectionDigest } from '../hash';
import {
  CTKG_SCHEMA_V2_RAW_SHA256,
  CTKG_SCHEMA_V2_VERSION,
} from '../../../../scripts/actkg-release/bundle-compatibility-registry-v2';
import { REVIEWED_V0_22_V2_REGISTRY } from '../../../../scripts/actkg-release/bundle-compatibility-registry-v022';
import { V022_CURRENT_POINTER_PATHS } from '../rebase/v022-contracts';
import { readV022PointerSnapshots } from '../rebase/v022-receipt';
import {
  loadStagedTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '../store';

import { runNamedConsumerShadowReads, type ConsumerShadowResult } from './v022-consumers';
import {
  collectDeclaredCandidateHashes,
  compareDualReplayArtifactBytes,
  verifyDeclaredCandidateHashes,
  verifyTeachingArtifactHashes,
} from './v022-hashes';
import { rehearseIsolatedFiveSelectorActivation } from './v022-isolated';
import {
  V022_NAMED_CONSUMERS,
  V022_QUALIFICATION_CONTRACT,
} from './v022-qualify-contract';
import { V022QualificationError } from './v022-qualify-error';
import {
  AUTHORITY_CANDIDATE_RELATIVE,
  CATALOG_CANDIDATE_RELATIVE,
  TEACHING_CANDIDATE_RELATIVE,
  V022_RELEASE_ID,
  V022_RELEASE_RELATIVE,
  V022_SNAPSHOT,
  V09_ACTIVATION,
  V09_PREREQUISITE,
  V09_PROJECTION,
  V09_SNAPSHOT,
  asRecord,
  leakInDisplay,
  readJson,
  shaFile,
  writeCanonical,
} from './v022-shared';

export { V022_NAMED_CONSUMERS, V022_QUALIFICATION_CONTRACT };
export { V022QualificationError };
export {
  collectDeclaredCandidateHashes,
  compareDualReplayArtifactBytes,
  verifyAbsoluteFileHash,
  verifyDeclaredCandidateHashes,
} from './v022-hashes';

export function snapshotCurrentPointers(repoRoot: string) {
  return readV022PointerSnapshots(
    repoRoot,
    V022_CURRENT_POINTER_PATHS.filter((item) => !item.endsWith('production-cutover-transactions/current.json')),
  );
}

export function assertV022ProductionPointersUnchanged(
  before: ReturnType<typeof snapshotCurrentPointers>,
  after: ReturnType<typeof snapshotCurrentPointers>,
): void {
  const beforeMap = new Map(before.map((row) => [row.path, row.sha256]));
  for (const row of after) {
    if (beforeMap.get(row.path) !== row.sha256) {
      throw new V022QualificationError('production-pointer-drift', `real pointer changed: ${row.path}`);
    }
  }
}

export async function qualifyActKgV022CutoverCandidate(input: {
  repoRoot: string;
  outputRoot?: string;
}): Promise<{
  status: 'READY' | 'BLOCKED';
  reportPath: string;
  blockers: string[];
  receiptDigest: string;
}> {
  const repoRoot = path.resolve(input.repoRoot);
  const outputRoot = path.resolve(input.outputRoot ?? path.join(
    repoRoot,
    'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.22',
  ));
  if (outputRoot.includes(`${path.sep}runtime${path.sep}knowledge${path.sep}`) || outputRoot.endsWith('current.json')) {
    throw new V022QualificationError('selector-unsafe', 'qualification output cannot be a runtime selector path');
  }

  const pointersBefore = snapshotCurrentPointers(repoRoot);
  const blockers: string[] = [];
  const authorityReceiptPath = path.join(repoRoot, AUTHORITY_CANDIDATE_RELATIVE, 'candidate-receipt.json');
  const teachingReceiptPath = path.join(repoRoot, TEACHING_CANDIDATE_RELATIVE, 'candidate-receipt.json');
  const labelPath = path.join(repoRoot, V022_RELEASE_RELATIVE, 'multilingual-label-index.jsonl');
  const authorityReceipt = readJson(authorityReceiptPath);
  const teachingReceipt = readJson(teachingReceiptPath);
  const authorityManifestPath = path.join(
    repoRoot,
    AUTHORITY_CANDIDATE_RELATIVE,
    `replay-1/authority/releases/${V022_SNAPSHOT}/manifest.json`,
  );
  const authorityEngineeringPath = path.join(
    repoRoot,
    AUTHORITY_CANDIDATE_RELATIVE,
    `replay-1/authority/releases/${V022_SNAPSHOT}/engineering.json`,
  );
  const authorityManifest = readJson(authorityManifestPath) as unknown as AuthoritySnapshotManifest;
  const engineering = readJson(authorityEngineeringPath) as unknown as AuthorityEngineeringBody;
  const objects = Array.isArray(engineering.objects) ? engineering.objects : [];
  const relations = Array.isArray(engineering.relations) ? engineering.relations : [];
  const labels = existsSync(labelPath)
    ? readFileSync(labelPath, 'utf8').split('\n').filter((line) => line.trim())
    : [];

  blockers.push(...verifyDeclaredCandidateHashes(repoRoot));
  blockers.push(...verifyTeachingArtifactHashes(repoRoot));
  const dualReplay = compareDualReplayArtifactBytes(repoRoot);
  blockers.push(...dualReplay.blockers);

  const envelope = loadPinnedV022Envelope(repoRoot);
  const catalogReceiptPath = path.join(repoRoot, CATALOG_CANDIDATE_RELATIVE, 'candidate-receipt.json');
  const catalogReceipt = readJson(catalogReceiptPath);
  const catalogEnvelope = asRecord(catalogReceipt.envelope);
  const inputHashes = {
    authorityReceipt: shaFile(authorityReceiptPath),
    teachingReceipt: shaFile(teachingReceiptPath),
    catalogReceipt: shaFile(catalogReceiptPath),
    authorityManifest: shaFile(authorityManifestPath),
    authorityEngineering: shaFile(authorityEngineeringPath),
    labels: existsSync(labelPath) ? shaFile(labelPath) : '',
    captureRevision: String(authorityManifest.captureRevision ?? ''),
    declaredHashCount: collectDeclaredCandidateHashes(repoRoot).length,
    schemaRawSha256: REVIEWED_V0_22_V2_REGISTRY.schemaRawSha256,
  };
  if (REVIEWED_V0_22_V2_REGISTRY.schemaVersion !== CTKG_SCHEMA_V2_VERSION
    || REVIEWED_V0_22_V2_REGISTRY.schemaRawSha256 !== CTKG_SCHEMA_V2_RAW_SHA256) {
    blockers.push('schema-hash-mismatch');
  }
  if (envelope.releaseId !== V022_RELEASE_ID || envelope.snapshotId !== V022_SNAPSHOT) {
    blockers.push('envelope-mismatch');
  }
  if (catalogEnvelope.releaseId !== V022_RELEASE_ID || catalogEnvelope.snapshotId !== V022_SNAPSHOT) {
    blockers.push('selector-catalog-authority-mix');
  }
  if (catalogReceipt.nonActivation !== true || catalogReceipt.status !== 'staged') {
    blockers.push('catalog-candidate-not-inactive');
  }
  const catalogAuthoringPath = path.join(repoRoot, CATALOG_CANDIDATE_RELATIVE, 'catalog.json');
  const catalogRuntimePath = path.join(repoRoot, CATALOG_CANDIDATE_RELATIVE, 'runtime.json');
  const declaredOutputs = Array.isArray(catalogReceipt.outputs) ? catalogReceipt.outputs : [];
  for (const relative of [catalogAuthoringPath, catalogRuntimePath].map((item) => path.relative(repoRoot, item).split(path.sep).join('/'))) {
    const declared = declaredOutputs.find((row) => asRecord(row).path === relative);
    const expectedSha = String(asRecord(declared).sha256 ?? '');
    if (!expectedSha) blockers.push(`catalog-output-hash-missing:${relative}`);
    else if (shaFile(path.join(repoRoot, relative)) !== expectedSha) blockers.push(`catalog-output-hash-mismatch:${relative}`);
  }
  const catalogAuthoring = readJson(catalogAuthoringPath) as unknown as AuthorityDomainCatalogAuthoring;
  if (catalogAuthoring.authorityBinding.releaseId !== V022_RELEASE_ID
    || catalogAuthoring.authorityBinding.snapshotId !== V022_SNAPSHOT) {
    blockers.push('selector-catalog-authority-mix');
  }
  const rebuiltCatalog = buildAuthorityDomainCatalog(
    catalogAuthoring,
    catalogAuthoring.memberships.map((row) => ({ canonicalId: row.canonicalId })),
  );
  const catalogRuntime = readJson(catalogRuntimePath);
  if (rebuiltCatalog.catalogHash !== String(catalogRuntime.catalogHash ?? '')) {
    blockers.push('catalog-rebuild-hash-drift');
  }
  if (rebuiltCatalog.memberships.length !== Number(catalogReceipt.membershipCount ?? -1)) {
    blockers.push('catalog-membership-incomplete');
  }

  if (authorityReceipt.status !== 'staged' || authorityReceipt.nonActivation !== true) blockers.push('authority-candidate-not-inactive');
  if (teachingReceipt.status !== 'READY' || teachingReceipt.nonActivation !== true) blockers.push('teaching-candidate-not-inactive');
  if (String(authorityManifest.snapshotId) !== V022_SNAPSHOT) blockers.push('authority-snapshot-drift');
  if (String(authorityManifest.releaseId) !== V022_RELEASE_ID) blockers.push('authority-release-mix');

  const mapping = asRecord(teachingReceipt.mapping);
  const validated = asRecord(authorityReceipt.validated);
  const expectedObjectCount = Number(validated.runtimeProjectionNodes ?? -1);
  const expectedRelationCount = Number(validated.runtimeProjectionLinks ?? -1);
  const expectedLabelCount = Number(validated.multilingualLabels ?? -1);
  const expectedReleaseNodeCount = Number(validated.releaseNodes ?? -1);
  const audit = {
    objectCount: objects.length,
    relationCount: relations.length,
    labelCount: labels.length,
    releaseNodeCount: expectedReleaseNodeCount,
    expectedObjectCount,
    expectedRelationCount,
    expectedLabelCount,
    expectedReleaseNodeCount,
    reviewRequiredCount: Number(mapping.reviewRequiredCount ?? 0),
    teachingCoverageGap: Number(mapping.excludedUnreferencedCount ?? 0),
    infographCount: Number(asRecord(asRecord(teachingReceipt.denominator).referenceKindCounts).infograph ?? -1),
    domainCount: Number(catalogReceipt.domainCount ?? -1),
    membershipCount: Number(catalogReceipt.membershipCount ?? -1),
    inputHashes,
    dualReplayComparedFiles: dualReplay.comparedFiles,
  };
  if (audit.objectCount !== expectedObjectCount) blockers.push('object-count-drift');
  if (audit.relationCount !== expectedRelationCount) blockers.push('relation-count-drift');
  if (audit.labelCount !== expectedLabelCount) blockers.push('label-count-drift');
  if (audit.reviewRequiredCount !== 0) blockers.push('teaching-references-unclosed');
  if (audit.infographCount < 1) blockers.push('infograph-denominator-missing');
  if (audit.membershipCount !== expectedReleaseNodeCount) blockers.push('catalog-membership-incomplete');
  if (Number(catalogReceipt.orphanCount ?? -1) !== 0) blockers.push('catalog-orphan-members');

  const teachingProjection = asRecord(teachingReceipt.projection);
  const teachingPrerequisite = asRecord(teachingReceipt.prerequisite);
  const candidateAuthority = {
    releaseId: String(authorityManifest.releaseId),
    snapshotId: String(authorityManifest.snapshotId),
    snapshotHash: String(authorityManifest.snapshotHash),
  };
  const candidateTeaching = {
    projectionId: String(teachingProjection.projectionId ?? ''),
    projectionHash: String(teachingProjection.projectionHash ?? ''),
    publicationId: String(teachingPrerequisite.publicationId ?? ''),
    publicationHash: String(teachingPrerequisite.publicationHash ?? ''),
  };

  const candidateProjectionRoot = path.join(repoRoot, TEACHING_CANDIDATE_RELATIVE, 'projection');
  const loadedProjection = loadStagedTeachingProjection(
    resolveTeachingProjectionStorePaths(candidateProjectionRoot),
    candidateTeaching.projectionId,
  );
  if (loadedProjection.projectionId !== candidateTeaching.projectionId) blockers.push('teaching-projection-load-drift');
  if (loadedProjection.artifacts.manifest.authorityReleaseId !== candidateAuthority.releaseId) {
    blockers.push('teaching-projection-authority-mix');
  }

  const labelLeaks = labels.filter((line) => {
    try {
      const rec = asRecord(JSON.parse(line));
      return [rec.localizedName, rec.displayName, rec.label, rec.zhCN, rec.text]
        .filter((value) => typeof value === 'string')
        .some((value) => leakInDisplay(String(value)));
    } catch {
      return leakInDisplay(line);
    }
  });
  if (labelLeaks.length > 0) blockers.push('label-presentation-leak');

  let consumerResults: ConsumerShadowResult[] = [];
  const isolated = rehearseIsolatedFiveSelectorActivation({
    repoRoot,
    outputRoot,
    authorityManifest,
    engineering,
    projectionId: candidateTeaching.projectionId,
    publicationId: candidateTeaching.publicationId,
    projectionHash: candidateTeaching.projectionHash,
    publicationHash: candidateTeaching.publicationHash,
    captureRevision: String(authorityManifest.captureRevision ?? ''),
    projectionFileHashes: loadedProjection.fileHashes,
    projectionReleaseDir: loadedProjection.releaseDir,
    authorityArtifactPaths: {
      'manifest.json': authorityManifestPath,
      'engineering.json': authorityEngineeringPath,
    },
    authorityArtifactHashes: {
      'manifest.json': shaFile(authorityManifestPath),
      'engineering.json': shaFile(authorityEngineeringPath),
    },
    onAdvanced(context) {
      consumerResults = runNamedConsumerShadowReads({
        authorityManifest,
        engineering,
        loadedProjection,
        catalog: context.catalog,
        shardContext: context.shardContext,
        shardPaths: context.shardPaths,
        authorityPaths: context.authorityPaths,
        activationPaths: context.activationPaths,
        projectionPaths: context.projectionPaths,
        prerequisitePaths: context.prerequisitePaths,
        publicationId: candidateTeaching.publicationId,
        infographCount: audit.infographCount,
      });
    },
  });
  blockers.push(...isolated.blockers);
  if (consumerResults.length !== V022_NAMED_CONSUMERS.length) {
    blockers.push('consumer-shadow-reads-incomplete');
  }
  if (consumerResults.some((row) => row.status !== 'READY' || row.presentationLeak)) {
    blockers.push('consumer-or-presentation-blocked');
  }
  if (!isolated.advanced) blockers.push('isolated-activation-failed');
  if (!isolated.restored) blockers.push('isolated-rollback-drift');
  if (SELECTOR_KEYS.some((key) => !isolated.selectors[key]?.advanced || !isolated.selectors[key]?.restored)) {
    blockers.push('isolated-five-selector-incomplete');
  }

  const pointersAfter = snapshotCurrentPointers(repoRoot);
  try {
    assertV022ProductionPointersUnchanged(pointersBefore, pointersAfter);
  } catch (error) {
    blockers.push(error instanceof V022QualificationError ? error.code : 'production-pointer-drift');
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const body = {
    contract: V022_QUALIFICATION_CONTRACT,
    status: uniqueBlockers.length === 0 ? 'READY' as const : 'BLOCKED' as const,
    mode: 'local-disposable-non-activation',
    publicationOnly: true,
    productionCutoverAuthorized: false,
    selectorConsumption: false,
    captureRevision: inputHashes.captureRevision,
    authority: candidateAuthority,
    teaching: candidateTeaching,
    predecessors: {
      authorityReleaseId: 'ctr:release:control-theory-engineering-v0.9',
      authoritySnapshotId: V09_SNAPSHOT,
      projectionId: V09_PROJECTION,
      publicationId: V09_PREREQUISITE,
      activationId: V09_ACTIVATION,
    },
    inputHashes,
    audit,
    consumerResults,
    dualRebuild: {
      firstProjectionId: dualReplay.firstProjectionId,
      secondProjectionId: dualReplay.secondProjectionId,
      firstPrerequisitePublicationId: dualReplay.firstPrerequisitePublicationId,
      secondPrerequisitePublicationId: dualReplay.secondPrerequisitePublicationId,
      authorityReplayEquivalent: dualReplay.authorityReplayEquivalent,
      comparedFiles: dualReplay.comparedFiles,
      byteEquivalent: dualReplay.byteEquivalent,
    },
    isolatedRollback: {
      advanced: isolated.advanced,
      restored: isolated.restored,
      realPointersUnchanged: !uniqueBlockers.includes('production-pointer-drift'),
      selectors: isolated.selectors,
    },
    nextAction: uniqueBlockers.length === 0 ? 'activate-v022-production-composite-cutover' : 'blocked',
    blockers: uniqueBlockers,
  };
  const report = { ...body, receiptDigest: projectionDigest(body) };
  const reportPath = path.join(outputRoot, 'qualification-readiness.json');
  writeCanonical(reportPath, report);
  writeCanonical(path.join(outputRoot, 'qualification-manifest.json'), {
    contract: 'actkg-v022-cutover-qualification-manifest/v1',
    captureRevision: inputHashes.captureRevision,
    authority: candidateAuthority,
    teaching: candidateTeaching,
    predecessors: body.predecessors,
    consumers: [...V022_NAMED_CONSUMERS],
    inputHashes,
    receiptDigest: report.receiptDigest,
    publicationOnly: true,
  });
  return {
    status: report.status,
    reportPath: path.relative(repoRoot, reportPath).split(path.sep).join('/'),
    blockers: uniqueBlockers,
    receiptDigest: report.receiptDigest,
  };
}

const SELECTOR_KEYS = [
  'authority',
  'projection',
  'prerequisites',
  'authority-domain-shards',
  'consumer-activation',
] as const;
