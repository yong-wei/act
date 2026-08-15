/** Compound v0.18 cutover qualification: inactive, publication-only. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest, projectionSha256 } from '../hash';
import {
  V018_CURRENT_POINTER_PATHS,
} from '../rebase/v018-contracts';
import { readV018PointerSnapshots } from '../rebase/v018-receipt';

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

export function snapshotCurrentPointers(repoRoot: string) {
  return readV018PointerSnapshots(repoRoot, V018_CURRENT_POINTER_PATHS.filter((item) => !item.endsWith('production-cutover-transactions/current.json')));
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

function countJsonl(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  return readFileSync(filePath, 'utf8').split('\n').filter((line) => line.trim()).length;
}

function leakInDisplay(value: string): boolean {
  return SYSTEM_STRING.test(value);
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
  const authorityReceipt = readJson(path.join(
    repoRoot,
    'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/candidate-receipt.json',
  ));
  const teachingReceipt = readJson(path.join(
    repoRoot,
    'course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/candidate-receipt.json',
  ));
  const activation = readJson(path.join(
    repoRoot,
    'course-content/runtime/knowledge/consumer-activation/releases/first-cutover-7f4cdd1084af-769b1a832622/activation.json',
  ));
  const authorityManifest = readJson(path.join(
    repoRoot,
    'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/authority/releases/snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed/manifest.json',
  ));
  const engineering = readJson(path.join(
    repoRoot,
    'course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18/replay-1/authority/releases/snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed/engineering.json',
  ));

  if (authorityReceipt.status !== 'staged' || authorityReceipt.nonActivation !== true) {
    blockers.push('authority-candidate-not-inactive');
  }
  if (teachingReceipt.status !== 'READY' || teachingReceipt.nonActivation !== true || teachingReceipt.selectorConsumption !== false) {
    blockers.push('teaching-candidate-not-inactive');
  }
  if (String(authorityManifest.releaseId) !== 'ctr:release:control-theory-engineering-v0.18') {
    blockers.push('authority-release-drift');
  }
  if (String(authorityManifest.snapshotId) !== 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed') {
    blockers.push('authority-snapshot-drift');
  }

  const objects = Array.isArray(engineering.objects) ? engineering.objects : [];
  const relations = Array.isArray(engineering.relations) ? engineering.relations : [];
  const labelPath = path.join(
    repoRoot,
    'course-content/authoring/knowledge/releases/control-theory-engineering-v0.18/multilingual-label-index.jsonl',
  );
  const labelCount = countJsonl(labelPath);
  const mapping = asRecord(teachingReceipt.mapping);
  const reviewRequired = Number(mapping.reviewRequiredCount ?? -1);
  const infographCount = Number(asRecord(asRecord(teachingReceipt.denominator).referenceKindCounts).infograph ?? -1);

  const audit = {
    objectCount: objects.length,
    relationCount: relations.length,
    labelCount,
    expectedObjectCount: 6843,
    expectedRelationCount: 2811,
    expectedLabelCount: 1909,
    reviewRequiredCount: reviewRequired,
    infographCount,
  };
  if (objects.length !== 6843) blockers.push('object-count-drift');
  if (relations.length !== 2811) blockers.push('relation-count-drift');
  if (labelCount !== 1909) blockers.push('label-count-drift');
  if (reviewRequired !== 0) blockers.push('teaching-references-unclosed');
  if (infographCount < 1) blockers.push('infograph-denominator-missing');

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

  const consumers = Array.isArray(activation.consumers) ? activation.consumers : [];
  const consumerIds = consumers.map((row) => String(asRecord(row).consumerId)).sort();
  if (consumerIds.join(',') !== [...V018_NAMED_CONSUMERS].sort().join(',')) {
    blockers.push('named-consumer-set-drift');
  }
  const consumerResults = V018_NAMED_CONSUMERS.map((consumerId) => {
    const row = consumers.find((item) => asRecord(item).consumerId === consumerId);
    const combination = asRecord(asRecord(row).combination);
    const mixed = String(combination.authorityReleaseId ?? '') === candidateAuthority.releaseId
      && String(combination.projectionId ?? '') !== candidateTeaching.projectionId
      && combination.projectionId != null;
    const shadowCombination = {
      authorityReleaseId: candidateAuthority.releaseId,
      authoritySnapshotId: candidateAuthority.snapshotId,
      projectionId: consumerId === 'engineering-graph' || consumerId === 'engineering-rag'
        ? null
        : candidateTeaching.projectionId,
    };
    const visible = `${consumerId} ${consumerId === 'engineering-graph' ? '工程图谱' : '教学入口'}`;
    return {
      consumerId,
      status: mixed ? 'BLOCKED' : 'READY',
      shadowCombination,
      presentationLeak: leakInDisplay(visible),
    };
  });
  if (consumerResults.some((row) => row.status !== 'READY' || row.presentationLeak)) {
    blockers.push('consumer-or-presentation-blocked');
  }

  const firstDual = asRecord(teachingReceipt.dualBuild);
  const secondDual = asRecord(teachingReceipt.dualBuild);
  const dualRebuild = {
    firstProjectionId: String(firstDual.firstProjectionId ?? ''),
    secondProjectionId: String(secondDual.secondProjectionId ?? ''),
    byteEquivalent: firstDual.byteEquivalent === true
      && String(firstDual.firstProjectionId) === String(secondDual.secondProjectionId)
      && String(firstDual.firstPrerequisitePublicationId) === String(secondDual.secondPrerequisitePublicationId),
  };
  if (!dualRebuild.byteEquivalent) blockers.push('dual-rebuild-drift');

  const isolatedRoot = path.join(outputRoot, 'isolated-control-root');
  const isolatedBefore = pointersBefore.map((row) => ({
    path: row.path,
    content: row.content,
    sha256: row.sha256,
  }));
  for (const row of isolatedBefore) {
    const isolatedPath = path.join(isolatedRoot, row.path);
    mkdirSync(path.dirname(isolatedPath), { recursive: true });
    writeFileSync(isolatedPath, row.content, 'utf8');
  }
  for (const row of isolatedBefore) {
    const isolatedPath = path.join(isolatedRoot, row.path);
    const current = JSON.parse(row.content || '{}') as Record<string, unknown>;
    writeCanonical(isolatedPath, {
      ...current,
      qualificationExercise: true,
      candidateAuthority,
      candidateTeaching,
    });
  }
  for (const row of isolatedBefore) {
    writeFileSync(path.join(isolatedRoot, row.path), row.content, 'utf8');
  }
  const isolatedRestored = isolatedBefore.every((row) => (
    readFileSync(path.join(isolatedRoot, row.path), 'utf8') === row.content
  ));
  if (!isolatedRestored) blockers.push('isolated-rollback-drift');

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
    authority: candidateAuthority,
    teaching: candidateTeaching,
    predecessors: {
      authorityReleaseId: 'ctr:release:control-theory-engineering-v0.9',
      projectionId: 'proj-769b1a832622c0abb898becdf7218535ba6ab970ee7a7828afb067d14701e10d',
      activationId: 'first-cutover-7f4cdd1084af-769b1a832622',
    },
    audit,
    consumerResults,
    dualRebuild,
    isolatedRollback: {
      restored: isolatedRestored,
      realPointersUnchanged: uniqueBlockers.includes('production-pointer-drift') === false,
    },
    nextAction: uniqueBlockers.length === 0 ? 'publish-actkg-v018-cutover-runtime' : 'blocked',
    blockers: uniqueBlockers,
  };
  const report = { ...body, receiptDigest: projectionDigest(body) };
  const reportPath = path.join(outputRoot, 'qualification-readiness.json');
  writeCanonical(reportPath, report);
  writeCanonical(path.join(outputRoot, 'qualification-manifest.json'), {
    contract: 'actkg-v018-cutover-qualification-manifest/v1',
    authority: candidateAuthority,
    teaching: candidateTeaching,
    consumers: [...V018_NAMED_CONSUMERS],
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

export function pointerSha256(repoRoot: string, relativePath: string): string {
  return projectionSha256(readFileSync(path.join(repoRoot, relativePath)));
}
