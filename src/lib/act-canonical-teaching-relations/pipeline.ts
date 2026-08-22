import {
  ACT_TEACHING_CANDIDATE_CONTRACT,
  type ActTeachingCandidate,
  type ActTeachingScope,
} from './contracts';
import { MIN_AUTO_ADMIT_CONFIDENCE } from './families';
import { projectionDigest } from './hash';
import type { GoldRelationItem, QualificationDataset } from './qualify';

export const COURSE_ROOT_PIPELINE_VERSION = 'act-explicit-containment-evidence/v1' as const;

export interface ContainmentEvidence {
  readonly courseRootIds: readonly string[];
  readonly parents: readonly {
    readonly childCanonicalId: string;
    readonly parentCanonicalId: string;
    readonly evidenceRefs: readonly string[];
  }[];
}

export function pipelineConfigDigest(
  version: string,
  evidence: ContainmentEvidence,
): string {
  return projectionDigest({
    version,
    rule: 'explicit-root-or-parent-evidence',
    courseRootIds: [...evidence.courseRootIds].sort(),
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
  for (const canonicalId of evidence.courseRootIds) {
    if (!members.has(canonicalId)) continue;
    const evidenceRefs = [
      `scope:${scope.scopeHash}`,
      `course-root:${canonicalId}`,
    ];
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
  const evidence: ContainmentEvidence = { courseRootIds: [], parents: [] };
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
    return evidence.courseRootIds.includes(item.sourceCanonicalId);
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
