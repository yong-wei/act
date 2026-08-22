import {
  ACT_TEACHING_CANDIDATE_CONTRACT,
  type ActTeachingCandidate,
  type ActTeachingScope,
} from './contracts';
import { MIN_AUTO_ADMIT_CONFIDENCE } from './families';
import { ActTeachingRelationError, projectionDigest } from './hash';
import type { GoldRelationItem, QualificationDataset } from './qualify';

export const COURSE_ROOT_PIPELINE_VERSION = 'act-explicit-containment-evidence/v1' as const;

export interface CourseRootEvidence {
  readonly canonicalId: string;
  readonly evidenceRefs: readonly string[];
}

export interface FrozenEvidenceRecord {
  readonly ref: string;
  readonly sha256: string;
}

export interface ContainmentEvidence {
  readonly courseRoots: readonly CourseRootEvidence[];
  readonly parents: readonly {
    readonly childCanonicalId: string;
    readonly parentCanonicalId: string;
    readonly evidenceRefs: readonly string[];
  }[];
  readonly records: readonly FrozenEvidenceRecord[];
}

function assertVerifiableRefs(
  refs: readonly string[],
  records: readonly FrozenEvidenceRecord[],
  label: string,
): void {
  if (refs.length === 0) {
    throw new ActTeachingRelationError('invalid-evidence-ref', `${label} requires verifiable evidence refs`);
  }
  const byRef = new Map(records.map((row) => [row.ref, row]));
  for (const ref of refs) {
    const record = byRef.get(ref);
    if (!record || !/^[a-f0-9]{64}$/u.test(record.sha256)) {
      throw new ActTeachingRelationError(
        'invalid-evidence-ref',
        `${label} evidence ref is not bound to a frozen source digest: ${ref}`,
      );
    }
  }
}

export function pipelineConfigDigest(
  version: string,
  evidence: ContainmentEvidence,
): string {
  return projectionDigest({
    version,
    rule: 'explicit-root-or-parent-evidence',
    records: evidence.records.map((row) => ({
      ref: row.ref,
      sha256: row.sha256,
    })).sort((a, b) => a.ref.localeCompare(b.ref)),
    courseRoots: evidence.courseRoots.map((row) => ({
      canonicalId: row.canonicalId,
      evidenceRefs: [...row.evidenceRefs].sort(),
    })).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId)),
    parents: evidence.parents.map((row) => ({
      childCanonicalId: row.childCanonicalId,
      parentCanonicalId: row.parentCanonicalId,
      evidenceRefs: [...row.evidenceRefs].sort(),
    })).sort((a, b) => a.childCanonicalId.localeCompare(b.childCanonicalId)),
  });
}

function candidateId(input: {
  family: ActTeachingCandidate['family'];
  sourceCanonicalId: string;
  targetCanonicalId: string | null;
  scopeHash: string;
}): string {
  return `cand-${projectionDigest(input).slice(0, 24)}`;
}

export function generateContainmentCandidates(
  scope: ActTeachingScope,
  evidence: ContainmentEvidence,
): ActTeachingCandidate[] {
  const pipelineConfig = pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION, evidence);
  const members = new Set(scope.memberIds);
  const rows: ActTeachingCandidate[] = [];
  for (const root of evidence.courseRoots) {
    if (!members.has(root.canonicalId)) continue;
    assertVerifiableRefs(root.evidenceRefs, evidence.records, `COURSE_ROOT ${root.canonicalId}`);
    const evidenceRefs = [...root.evidenceRefs];
    const canonicalId = root.canonicalId;
    rows.push({
      contract: ACT_TEACHING_CANDIDATE_CONTRACT,
      candidateId: candidateId({
        family: 'containment',
        sourceCanonicalId: canonicalId,
        targetCanonicalId: null,
        scopeHash: scope.scopeHash,
      }),
      scopeHash: scope.scopeHash,
      family: 'containment',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: canonicalId,
      targetCanonicalId: null,
      direction: 'source_to_target',
      origin: 'QUALIFIED_PIPELINE',
      pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
      pipelineConfigDigest: pipelineConfig,
      confidence: MIN_AUTO_ADMIT_CONFIDENCE,
      strength: null,
      evidenceRefs,
      evidenceDigest: projectionDigest(evidenceRefs),
      authority: scope.authority,
      conflicts: [],
      exceptionReasons: [],
    });
  }
  for (const parent of evidence.parents) {
    if (!members.has(parent.childCanonicalId) || !members.has(parent.parentCanonicalId)) {
      continue;
    }
    assertVerifiableRefs(parent.evidenceRefs, evidence.records, `parent ${parent.childCanonicalId}`);
    rows.push({
      contract: ACT_TEACHING_CANDIDATE_CONTRACT,
      candidateId: candidateId({
        family: 'containment',
        sourceCanonicalId: parent.childCanonicalId,
        targetCanonicalId: parent.parentCanonicalId,
        scopeHash: scope.scopeHash,
      }),
      scopeHash: scope.scopeHash,
      family: 'containment',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: parent.childCanonicalId,
      targetCanonicalId: parent.parentCanonicalId,
      direction: 'source_to_target',
      origin: 'QUALIFIED_PIPELINE',
      pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
      pipelineConfigDigest: pipelineConfig,
      confidence: MIN_AUTO_ADMIT_CONFIDENCE,
      strength: 'REQUIRED',
      evidenceRefs: parent.evidenceRefs,
      evidenceDigest: projectionDigest(parent.evidenceRefs),
      authority: scope.authority,
      conflicts: [],
      exceptionReasons: [],
    });
  }
  return rows.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}

export function generateCourseRootCandidates(
  scope: ActTeachingScope,
  evidence: ContainmentEvidence,
): ActTeachingCandidate[] {
  return generateContainmentCandidates(scope, evidence).filter((row) => (
    row.family === 'containment' && row.targetCanonicalId === null
  ));
}

export function generatePendingFamilyPlaceholders(
  scope: ActTeachingScope,
  family: 'containment' | 'prerequisite' | 'association',
): ActTeachingCandidate[] {
  const evidence: ContainmentEvidence = { courseRoots: [], parents: [], records: [] };
  const pipelineConfig = pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION, evidence);
  return scope.memberIds.map((canonicalId) => ({
    contract: ACT_TEACHING_CANDIDATE_CONTRACT,
    candidateId: candidateId({
      family,
      sourceCanonicalId: canonicalId,
      targetCanonicalId: `pending:${family}`,
      scopeHash: scope.scopeHash,
    }),
    scopeHash: scope.scopeHash,
    family,
    relationType: family === 'containment'
      ? 'CONTAINMENT'
      : family === 'prerequisite'
        ? 'PREREQUISITE'
        : 'PEDAGOGICAL_ASSOCIATION',
    sourceCanonicalId: canonicalId,
    targetCanonicalId: null,
    direction: family === 'association' ? 'symmetric' : 'source_to_target',
    origin: 'QUALIFIED_PIPELINE',
    pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
    pipelineConfigDigest: pipelineConfig,
    confidence: 0,
    strength: null,
    evidenceRefs: [`pending:${family}:${canonicalId}`],
    evidenceDigest: projectionDigest([`pending:${family}:${canonicalId}`]),
    authority: scope.authority,
    conflicts: [],
    exceptionReasons: ['low-confidence', 'weak-evidence'],
  }));
}

export function pipelineAdmitsItem(
  item: GoldRelationItem,
  evidence: ContainmentEvidence,
): boolean {
  if (item.family === 'containment' && item.targetCanonicalId === null) {
    return evidence.courseRoots.some((row) => (
      row.canonicalId === item.sourceCanonicalId && row.evidenceRefs.length > 0
    ));
  }
  if (item.family === 'containment' && item.targetCanonicalId) {
    return evidence.parents.some((row) => (
      row.childCanonicalId === item.sourceCanonicalId
      && row.parentCanonicalId === item.targetCanonicalId
    ));
  }
  return false;
}

export function measurePipelineDataset(
  dataset: QualificationDataset,
  evidence: ContainmentEvidence,
): string[] {
  return dataset.items
    .filter((item) => pipelineAdmitsItem(item, evidence))
    .map((item) => item.id);
}

export function assertEvidenceBoundToQualificationDatasets(
  evidence: ContainmentEvidence,
  gold: QualificationDataset,
  holdout: QualificationDataset,
): void {
  const admitted = [...gold.items, ...holdout.items].filter((item) => item.expected === 'admit');
  for (const root of evidence.courseRoots) {
    const matched = admitted.some((item) => (
      item.family === 'containment'
      && item.sourceCanonicalId === root.canonicalId
      && item.targetCanonicalId === null
    ));
    if (!matched) {
      throw new Error(`COURSE_ROOT ${root.canonicalId} is not a gold/holdout admitted item`);
    }
  }
  for (const parent of evidence.parents) {
    const matched = admitted.some((item) => (
      item.family === 'containment'
      && item.sourceCanonicalId === parent.childCanonicalId
      && item.targetCanonicalId === parent.parentCanonicalId
    ));
    if (!matched) {
      throw new Error(`parent ${parent.childCanonicalId} is not a gold/holdout admitted item`);
    }
  }
}
