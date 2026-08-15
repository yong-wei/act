/** Compound v0.18 cutover qualification: inactive, publication-only. */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { emptyTeachingSelectorFingerprint } from '../../authoritative-knowledge/authority-snapshot';
import {
  activateAuthoritySnapshot,
  readCurrentAuthorityPointer,
  resolveAuthorityStorePaths,
} from '../../authoritative-knowledge/authority-store';
import { projectionDigest, projectionSha256 } from '../hash';
import {
  activatePrerequisitePublication,
  readCurrentPrerequisitePointer,
  resolvePrerequisiteStorePaths,
} from '../prerequisites/store';
import { V018_CURRENT_POINTER_PATHS } from '../rebase/v018-contracts';
import { readV018PointerSnapshots } from '../rebase/v018-receipt';
import {
  activateTeachingProjection,
  loadStagedTeachingProjection,
  readCurrentTeachingProjectionPointer,
  resolveTeachingProjectionStorePaths,
} from '../store';

export const V018_QUALIFICATION_CONTRACT = 'actkg-v018-cutover-qualification/v1' as const;
export const V018_NAMED_CONSUMERS = [
  'course-runtime',
  'engineering-graph',
  'engineering-rag',
  'konling',
  'learning-path',
  'teaching-resource-rag',
] as const;

const SYSTEM_STRING = /(?:snap-|proj-|ads-|ctr:release:|first-cutover-|sha256:|[a-f0-9]{64})/i;
const V018_SNAPSHOT = 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed';
const V09_SNAPSHOT = 'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7';
const V09_PROJECTION = 'proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d';
const V09_PREREQUISITE = 'proj-b8100a7f322e588a620a2869b5fccafa22d501de9a85bb5882a7c56e9528a21b';

export class V018QualificationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V018QualificationError';
    this.code = code;
  }
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function writeCanonical(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

function shaFile(filePath: string): string {
  return projectionSha256(readFileSync(filePath));
}

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
  const authorityReceiptPath = path.join(repoRoot, 'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/candidate-receipt.json');
  const teachingReceiptPath = path.join(repoRoot, 'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/candidate-receipt.json');
  const labelPath = path.join(repoRoot, 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.18/multilingual-label-index.jsonl');
  const authorityReceipt = readJson(authorityReceiptPath);
  const teachingReceipt = readJson(teachingReceiptPath);
  const authorityManifestPath = path.join(
    repoRoot,
    `course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/authority/releases/${V018_SNAPSHOT}/manifest.json`,
  );
  const authorityEngineeringPath = path.join(
    repoRoot,
    `course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/authority/releases/${V018_SNAPSHOT}/engineering.json`,
  );
  const authorityManifest = readJson(authorityManifestPath);
  const engineering = readJson(authorityEngineeringPath);
  const objects = Array.isArray(engineering.objects) ? engineering.objects : [];
  const relations = Array.isArray(engineering.relations) ? engineering.relations : [];
  const labels = existsSync(labelPath)
    ? readFileSync(labelPath, 'utf8').split('\n').filter((line) => line.trim())
    : [];

  const inputHashes = {
    authorityReceipt: shaFile(authorityReceiptPath),
    teachingReceipt: shaFile(teachingReceiptPath),
    authorityManifest: shaFile(authorityManifestPath),
    authorityEngineering: shaFile(authorityEngineeringPath),
    labels: existsSync(labelPath) ? shaFile(labelPath) : '',
    captureRevision: String(authorityManifest.captureRevision ?? ''),
  };
  const outputs = Array.isArray(authorityReceipt.outputs) ? authorityReceipt.outputs : [];
  const outputByPath = new Map(outputs.map((row) => {
    const rec = asRecord(row);
    return [String(rec.path ?? ''), String(rec.sha256 ?? '')];
  }));
  const replay1Eng = `course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/authority/releases/${V018_SNAPSHOT}/engineering.json`;
  const replay2Eng = `course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-2/authority/releases/${V018_SNAPSHOT}/engineering.json`;
  if (outputByPath.get(replay1Eng) !== shaFile(path.join(repoRoot, replay1Eng))) blockers.push('authority-engineering-hash-drift');
  if (outputByPath.get(replay2Eng) !== shaFile(path.join(repoRoot, replay2Eng))) blockers.push('authority-replay-2-hash-drift');
  if (outputByPath.get(replay1Eng) !== outputByPath.get(replay2Eng)) blockers.push('authority-dual-replay-drift');
  if (teachingReceipt.receiptDigest !== projectionDigest((({ receiptDigest: _ignored, ...rest }) => rest)(teachingReceipt))) {
    blockers.push('teaching-receipt-digest-drift');
  }

  if (authorityReceipt.status !== 'staged' || authorityReceipt.nonActivation !== true) blockers.push('authority-candidate-not-inactive');
  if (teachingReceipt.status !== 'READY' || teachingReceipt.nonActivation !== true) blockers.push('teaching-candidate-not-inactive');
  if (String(authorityManifest.snapshotId) !== V018_SNAPSHOT) blockers.push('authority-snapshot-drift');

  const mapping = asRecord(teachingReceipt.mapping);
  const audit = {
    objectCount: objects.length,
    relationCount: relations.length,
    labelCount: labels.length,
    expectedObjectCount: 6843,
    expectedRelationCount: 2811,
    expectedLabelCount: 1909,
    reviewRequiredCount: Number(mapping.reviewRequiredCount ?? -1),
    infographCount: Number(asRecord(asRecord(teachingReceipt.denominator).referenceKindCounts).infograph ?? -1),
    inputHashes,
  };
  if (audit.objectCount !== 6843) blockers.push('object-count-drift');
  if (audit.relationCount !== 2811) blockers.push('relation-count-drift');
  if (audit.labelCount !== 1909) blockers.push('label-count-drift');
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

  const candidateProjectionRoot = path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/projection',
  );
  const loadedProjection = loadStagedTeachingProjection(
    resolveTeachingProjectionStorePaths(candidateProjectionRoot),
    candidateTeaching.projectionId,
  );
  if (loadedProjection.projectionId !== candidateTeaching.projectionId) blockers.push('teaching-projection-load-drift');
  if (loadedProjection.artifacts.manifest.authorityReleaseId !== candidateAuthority.releaseId) {
    blockers.push('teaching-projection-authority-mix');
  }

  const labelLeaks = labels.slice(0, 64).filter((line) => {
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

  const consumerResults = V018_NAMED_CONSUMERS.map((consumerId) => {
    const requiresProjection = consumerId !== 'engineering-graph' && consumerId !== 'engineering-rag';
    const projectionOk = !requiresProjection || loadedProjection.artifacts.gate.passed;
    const authorityOk = candidateAuthority.snapshotId === V018_SNAPSHOT;
    return {
      consumerId,
      status: projectionOk && authorityOk ? 'READY' : 'BLOCKED',
      shadowCombination: {
        authorityReleaseId: candidateAuthority.releaseId,
        authoritySnapshotId: candidateAuthority.snapshotId,
        projectionId: requiresProjection ? candidateTeaching.projectionId : null,
      },
      presentationLeak: labelLeaks.length > 0,
    };
  });
  if (consumerResults.some((row) => row.status !== 'READY' || row.presentationLeak)) {
    blockers.push('consumer-or-presentation-blocked');
  }

  const dual = asRecord(teachingReceipt.dualBuild);
  const dualRebuild = {
    firstProjectionId: String(dual.firstProjectionId ?? ''),
    secondProjectionId: String(dual.secondProjectionId ?? ''),
    firstPrerequisitePublicationId: String(dual.firstPrerequisitePublicationId ?? ''),
    secondPrerequisitePublicationId: String(dual.secondPrerequisitePublicationId ?? ''),
    authorityReplayEquivalent: outputByPath.get(replay1Eng) === outputByPath.get(replay2Eng),
    byteEquivalent: dual.byteEquivalent === true
      && String(dual.firstProjectionId) === String(dual.secondProjectionId)
      && String(dual.firstPrerequisitePublicationId) === String(dual.secondPrerequisitePublicationId)
      && outputByPath.get(replay1Eng) === outputByPath.get(replay2Eng),
  };
  if (!dualRebuild.byteEquivalent) blockers.push('dual-rebuild-drift');

  const isolated = rehearseIsolatedActivation(repoRoot, outputRoot, candidateTeaching, candidateAuthority);
  if (!isolated.advanced) blockers.push('isolated-activation-failed');
  if (!isolated.restored) blockers.push('isolated-rollback-drift');

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
      activationId: 'first-cutover-7f4cdd1084af-769b1a832622',
    },
    inputHashes,
    audit,
    consumerResults,
    dualRebuild,
    isolatedRollback: {
      advanced: isolated.advanced,
      restored: isolated.restored,
      realPointersUnchanged: !uniqueBlockers.includes('production-pointer-drift'),
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

function leakInDisplay(value: string): boolean {
  return SYSTEM_STRING.test(value);
}

function copyTree(fromPath: string, toPath: string): void {
  if (!existsSync(fromPath)) {
    throw new V018QualificationError('isolated-source-missing', `missing ${fromPath}`);
  }
  mkdirSync(path.dirname(toPath), { recursive: true });
  cpSync(fromPath, toPath, { recursive: true });
}

function rehearseIsolatedActivation(
  repoRoot: string,
  outputRoot: string,
  candidateTeaching: { projectionId: string; publicationId: string },
  candidateAuthority: { snapshotId: string },
): { advanced: boolean; restored: boolean } {
  const isolated = path.join(outputRoot, 'isolated-control-root');
  const authorityRoot = path.join(isolated, 'authority');
  const projectionRoot = path.join(isolated, 'projection');
  const prerequisiteRoot = path.join(isolated, 'prerequisites');
  copyTree(path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json'), path.join(authorityRoot, 'current.json'));
  copyTree(path.join(repoRoot, `course-content/authoring/knowledge/authority/releases/${V09_SNAPSHOT}`), path.join(authorityRoot, 'releases', V09_SNAPSHOT));
  copyTree(
    path.join(repoRoot, `course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/authority/releases/${V018_SNAPSHOT}`),
    path.join(authorityRoot, 'releases', V018_SNAPSHOT),
  );
  copyTree(path.join(repoRoot, 'course-content/runtime/knowledge/projection/current.json'), path.join(projectionRoot, 'current.json'));
  copyTree(path.join(repoRoot, `course-content/runtime/knowledge/projection/releases/${V09_PROJECTION}`), path.join(projectionRoot, 'releases', V09_PROJECTION));
  copyTree(
    path.join(repoRoot, `course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/projection/releases/${candidateTeaching.projectionId}`),
    path.join(projectionRoot, 'releases', candidateTeaching.projectionId),
  );
  copyTree(path.join(repoRoot, 'course-content/runtime/knowledge/prerequisites/current.json'), path.join(prerequisiteRoot, 'current.json'));
  copyTree(path.join(repoRoot, `course-content/runtime/knowledge/prerequisites/releases/${V09_PREREQUISITE}`), path.join(prerequisiteRoot, 'releases', V09_PREREQUISITE));
  copyTree(
    path.join(repoRoot, `course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/prerequisites/releases/${candidateTeaching.publicationId}`),
    path.join(prerequisiteRoot, 'releases', candidateTeaching.publicationId),
  );

  const authorityPaths = resolveAuthorityStorePaths(authorityRoot);
  const projectionPaths = resolveTeachingProjectionStorePaths(projectionRoot);
  const prerequisitePaths = resolvePrerequisiteStorePaths(prerequisiteRoot);
  const advancedAuthority = activateAuthoritySnapshot(authorityPaths, {
    snapshotId: candidateAuthority.snapshotId,
    teachingSelectors: emptyTeachingSelectorFingerprint(),
    activationReceiptId: 'qualification-isolated-v018-authority',
  });
  const advancedProjection = activateTeachingProjection(projectionPaths, {
    projectionId: candidateTeaching.projectionId,
  });
  const advancedPrerequisite = activatePrerequisitePublication(prerequisitePaths, candidateTeaching.publicationId);
  const advanced = advancedAuthority.status === 'activated'
    && advancedProjection.status === 'activated'
    && advancedPrerequisite.publicationId === candidateTeaching.publicationId
    && readCurrentAuthorityPointer(authorityPaths)?.snapshotId === candidateAuthority.snapshotId
    && readCurrentTeachingProjectionPointer(projectionPaths)?.projectionId === candidateTeaching.projectionId
    && readCurrentPrerequisitePointer(prerequisitePaths)?.publicationId === candidateTeaching.publicationId;

  const restoredAuthority = activateAuthoritySnapshot(authorityPaths, {
    snapshotId: V09_SNAPSHOT,
    teachingSelectors: emptyTeachingSelectorFingerprint(),
    activationReceiptId: 'qualification-isolated-v09-authority',
  });
  const restoredProjection = activateTeachingProjection(projectionPaths, { projectionId: V09_PROJECTION });
  const restoredPrerequisite = activatePrerequisitePublication(prerequisitePaths, V09_PREREQUISITE);
  const restored = restoredAuthority.status === 'activated'
    && restoredProjection.status === 'activated'
    && restoredPrerequisite.publicationId === V09_PREREQUISITE
    && readCurrentAuthorityPointer(authorityPaths)?.snapshotId === V09_SNAPSHOT
    && readCurrentTeachingProjectionPointer(projectionPaths)?.projectionId === V09_PROJECTION
    && readCurrentPrerequisitePointer(prerequisitePaths)?.publicationId === V09_PREREQUISITE;
  writeCanonical(path.join(isolated, 'isolated-rollback.json'), {
    advanced: Boolean(advanced),
    restored: Boolean(restored),
    v018SnapshotId: candidateAuthority.snapshotId,
    v09SnapshotId: V09_SNAPSHOT,
  });
  rmSync(authorityRoot, { recursive: true, force: true });
  rmSync(projectionRoot, { recursive: true, force: true });
  rmSync(prerequisiteRoot, { recursive: true, force: true });
  return { advanced: Boolean(advanced), restored: Boolean(restored) };
}
