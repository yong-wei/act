/** Compound v0.18 cutover qualification: inactive, publication-only. */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  AuthorityEngineeringBody,
  AuthoritySnapshotManifest,
} from '../../authoritative-knowledge/authority-snapshot';
import { projectionDigest } from '../hash';
import { V018_CURRENT_POINTER_PATHS } from '../rebase/v018-contracts';
import { readV018PointerSnapshots } from '../rebase/v018-receipt';
import {
  loadStagedTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '../store';

import { runNamedConsumerShadowReads, type ConsumerShadowResult } from './v018-consumers';
import {
  collectDeclaredCandidateHashes,
  compareDualReplayArtifactBytes,
  verifyDeclaredCandidateHashes,
  verifyTeachingArtifactHashes,
} from './v018-hashes';
import { rehearseIsolatedFiveSelectorActivation } from './v018-isolated';
import {
  V018_NAMED_CONSUMERS,
  V018_QUALIFICATION_CONTRACT,
} from './v018-qualify-contract';
import { V018QualificationError } from './v018-qualify-error';
import {
  AUTHORITY_CANDIDATE_RELATIVE,
  TEACHING_CANDIDATE_RELATIVE,
  V018_RELEASE_RELATIVE,
  V018_SNAPSHOT,
  V09_ACTIVATION,
  V09_PREREQUISITE,
  V09_PROJECTION,
  V09_SNAPSHOT,
  asRecord,
  leakInDisplay,
  readJson,
  shaFile,
  writeCanonical,
} from './v018-shared';

export { V018_NAMED_CONSUMERS, V018_QUALIFICATION_CONTRACT };
export { V018QualificationError };
export {
  collectDeclaredCandidateHashes,
  compareDualReplayArtifactBytes,
  verifyAbsoluteFileHash,
  verifyDeclaredCandidateHashes,
} from './v018-hashes';

export function snapshotCurrentPointers(repoRoot: string) {
  return readV018PointerSnapshots(
    repoRoot,
    V018_CURRENT_POINTER_PATHS.filter((item) => !item.endsWith('production-cutover-transactions/current.json')),
  );
}

export function assertV018ProductionPointersUnchanged(
  before: ReturnType<typeof snapshotCurrentPointers>,
  after: ReturnType<typeof snapshotCurrentPointers>,
): void {
  const beforeMap = new Map(before.map((row) => [row.path, row.sha256]));
  for (const row of after) {
    if (beforeMap.get(row.path) !== row.sha256) {
      throw new V018QualificationError('production-pointer-drift', `real pointer changed: ${row.path}`);
    }
  }
}

export async function qualifyActKgV018CutoverCandidate(input: {
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
    'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18',
  ));
  if (outputRoot.includes(`${path.sep}runtime${path.sep}knowledge${path.sep}`) || outputRoot.endsWith('current.json')) {
    throw new V018QualificationError('selector-unsafe', 'qualification output cannot be a runtime selector path');
  }

  const pointersBefore = snapshotCurrentPointers(repoRoot);
  const blockers: string[] = [];
  const authorityReceiptPath = path.join(repoRoot, AUTHORITY_CANDIDATE_RELATIVE, 'candidate-receipt.json');
  const teachingReceiptPath = path.join(repoRoot, TEACHING_CANDIDATE_RELATIVE, 'candidate-receipt.json');
  const labelPath = path.join(repoRoot, V018_RELEASE_RELATIVE, 'multilingual-label-index.jsonl');
  const authorityReceipt = readJson(authorityReceiptPath);
  const teachingReceipt = readJson(teachingReceiptPath);
  const authorityManifestPath = path.join(
    repoRoot,
    AUTHORITY_CANDIDATE_RELATIVE,
    `replay-1/authority/releases/${V018_SNAPSHOT}/manifest.json`,
  );
  const authorityEngineeringPath = path.join(
    repoRoot,
    AUTHORITY_CANDIDATE_RELATIVE,
    `replay-1/authority/releases/${V018_SNAPSHOT}/engineering.json`,
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

  const inputHashes = {
    authorityReceipt: shaFile(authorityReceiptPath),
    teachingReceipt: shaFile(teachingReceiptPath),
    authorityManifest: shaFile(authorityManifestPath),
    authorityEngineering: shaFile(authorityEngineeringPath),
    labels: existsSync(labelPath) ? shaFile(labelPath) : '',
    captureRevision: String(authorityManifest.captureRevision ?? ''),
    declaredHashCount: collectDeclaredCandidateHashes(repoRoot).length,
  };

  if (authorityReceipt.status !== 'staged' || authorityReceipt.nonActivation !== true) blockers.push('authority-candidate-not-inactive');
  if (teachingReceipt.status !== 'READY' || teachingReceipt.nonActivation !== true) blockers.push('teaching-candidate-not-inactive');
  if (String(authorityManifest.snapshotId) !== V018_SNAPSHOT) blockers.push('authority-snapshot-drift');

  const mapping = asRecord(teachingReceipt.mapping);
  const validated = asRecord(authorityReceipt.validated);
  const audit = {
    objectCount: objects.length,
    relationCount: relations.length,
    labelCount: labels.length,
    releaseNodeCount: Number(validated.releaseNodes ?? -1),
    expectedObjectCount: 6843,
    expectedRelationCount: 2811,
    expectedLabelCount: 1909,
    expectedReleaseNodeCount: 7061,
    reviewRequiredCount: Number(mapping.reviewRequiredCount ?? -1),
    infographCount: Number(asRecord(asRecord(teachingReceipt.denominator).referenceKindCounts).infograph ?? -1),
    inputHashes,
    dualReplayComparedFiles: dualReplay.comparedFiles,
  };
  if (audit.objectCount !== 6843) blockers.push('object-count-drift');
  if (audit.relationCount !== 2811) blockers.push('relation-count-drift');
  if (audit.labelCount !== 1909) blockers.push('label-count-drift');
  if (audit.releaseNodeCount !== 7061) blockers.push('release-node-count-drift');
  if (audit.reviewRequiredCount !== 0) blockers.push('teaching-references-unclosed');
  if (audit.infographCount < 1) blockers.push('infograph-denominator-missing');

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
        prerequisitePaths: context.prerequisitePaths,
        publicationId: candidateTeaching.publicationId,
        infographCount: audit.infographCount,
      });
    },
  });
  blockers.push(...isolated.blockers);
  if (consumerResults.length !== V018_NAMED_CONSUMERS.length) {
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
    assertV018ProductionPointersUnchanged(pointersBefore, pointersAfter);
  } catch (error) {
    blockers.push(error instanceof V018QualificationError ? error.code : 'production-pointer-drift');
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  const body = {
    contract: V018_QUALIFICATION_CONTRACT,
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
    nextAction: uniqueBlockers.length === 0 ? 'publish-actkg-v018-cutover-runtime' : 'blocked',
    blockers: uniqueBlockers,
  };
  const report = { ...body, receiptDigest: projectionDigest(body) };
  const reportPath = path.join(outputRoot, 'qualification-readiness.json');
  writeCanonical(reportPath, report);
  writeCanonical(path.join(outputRoot, 'qualification-manifest.json'), {
    contract: 'actkg-v018-cutover-qualification-manifest/v1',
    captureRevision: inputHashes.captureRevision,
    authority: candidateAuthority,
    teaching: candidateTeaching,
    predecessors: body.predecessors,
    consumers: [...V018_NAMED_CONSUMERS],
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
