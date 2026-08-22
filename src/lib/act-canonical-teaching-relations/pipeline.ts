import {
  ACT_TEACHING_CANDIDATE_CONTRACT,
  ACT_TEACHING_FAMILIES,
  type ActTeachingCandidate,
  type ActTeachingFamily,
  type ActTeachingScope,
} from './contracts';
import { MIN_AUTO_ADMIT_CONFIDENCE } from './families';
import {
  ActTeachingRelationError,
  evidenceAttestsClaim,
  freezeEvidenceRecord,
  projectionDigest,
  type FrozenEvidenceClaim,
  type FrozenEvidenceRecord,
} from './hash';
import type { GoldRelationItem, QualificationDataset } from './qualify';

export const COURSE_ROOT_PIPELINE_VERSION = 'act-explicit-containment-evidence/v1' as const;

export const FROZEN_TEACHING_EVIDENCE_REGISTRY = Object.freeze([
  freezeEvidenceRecord(
    'evidence:handout-course-root-a',
    'handout 1-1 names ctc:a as the course root',
    {
      kind: 'COURSE_ROOT',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: 'ctc:a',
      targetCanonicalId: null,
    },
  ),
  freezeEvidenceRecord(
    'evidence:handout-a-contains-b',
    'handout 1-2 places ctc:b under ctc:a',
    {
      kind: 'CONTAINMENT_PARENT',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: 'ctc:b',
      targetCanonicalId: 'ctc:a',
    },
  ),
  freezeEvidenceRecord(
    'evidence:handout-a-contains-c',
    'handout 1-3 places ctc:c under ctc:a',
    {
      kind: 'CONTAINMENT_PARENT',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: 'ctc:c',
      targetCanonicalId: 'ctc:a',
    },
  ),
]);

export interface CourseRootEvidence {
  readonly canonicalId: string;
  readonly evidenceRefs: readonly string[];
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

export function sealEvidence(_evidence?: ContainmentEvidence): ContainmentEvidence {
  const courseRoots: CourseRootEvidence[] = [];
  const parents: ContainmentEvidence['parents'][number][] = [];
  for (const row of FROZEN_TEACHING_EVIDENCE_REGISTRY) {
    if (row.claim.kind === 'COURSE_ROOT') {
      courseRoots.push({
        canonicalId: row.claim.sourceCanonicalId,
        evidenceRefs: [row.ref],
      });
      continue;
    }
    parents.push({
      childCanonicalId: row.claim.sourceCanonicalId,
      parentCanonicalId: row.claim.targetCanonicalId as string,
      evidenceRefs: [row.ref],
    });
  }
  return {
    courseRoots,
    parents,
    records: FROZEN_TEACHING_EVIDENCE_REGISTRY,
  };
}

function assertRefsAttestClaim(
  refs: readonly string[],
  records: readonly FrozenEvidenceRecord[],
  claim: FrozenEvidenceClaim,
  label: string,
): void {
  if (refs.length === 0) {
    throw new ActTeachingRelationError('invalid-evidence-ref', `${label} requires verifiable evidence refs`);
  }
  const byRef = new Map(records.map((row) => [row.ref, row]));
  for (const ref of refs) {
    const record = byRef.get(ref);
    if (!record?.body) {
      throw new ActTeachingRelationError(
        'invalid-evidence-ref',
        `${label} evidence ref is not bound to a frozen source digest: ${ref}`,
      );
    }
    if (!evidenceAttestsClaim(record, claim)) {
      throw new ActTeachingRelationError(
        'invalid-evidence-ref',
        `${label} evidence ref does not attest the declared relation: ${ref}`,
      );
    }
  }
}

export function pipelineConfigDigest(
  version: string,
  evidence: ContainmentEvidence,
): string {
  evidence = sealEvidence(evidence);
  return projectionDigest({
    version,
    rule: 'explicit-root-or-parent-evidence',
    records: evidence.records.map((row) => ({
      ref: row.ref,
      digest: projectionDigest(row.body),
      claim: row.claim,
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
  const sealed = sealEvidence(evidence);
  const pipelineConfig = pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION, sealed);
  const members = new Set(scope.memberIds);
  const rows: ActTeachingCandidate[] = [];
  for (const root of sealed.courseRoots) {
    if (!members.has(root.canonicalId)) continue;
    const canonicalId = root.canonicalId;
    assertRefsAttestClaim(
      root.evidenceRefs,
      sealed.records,
      {
        kind: 'COURSE_ROOT',
        relationType: 'CONTAINMENT',
        sourceCanonicalId: canonicalId,
        targetCanonicalId: null,
      },
      `COURSE_ROOT ${canonicalId}`,
    );
    const evidenceRefs = [...root.evidenceRefs];
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
      evidenceDigest: projectionDigest({
        refs: evidenceRefs,
        claim: {
          kind: 'COURSE_ROOT',
          relationType: 'CONTAINMENT',
          sourceCanonicalId: canonicalId,
          targetCanonicalId: null,
        },
      }),
      authority: scope.authority,
      conflicts: [],
      exceptionReasons: [],
    });
  }
  for (const parent of sealed.parents) {
    if (!members.has(parent.childCanonicalId) || !members.has(parent.parentCanonicalId)) {
      continue;
    }
    assertRefsAttestClaim(
      parent.evidenceRefs,
      sealed.records,
      {
        kind: 'CONTAINMENT_PARENT',
        relationType: 'CONTAINMENT',
        sourceCanonicalId: parent.childCanonicalId,
        targetCanonicalId: parent.parentCanonicalId,
      },
      `parent ${parent.childCanonicalId}`,
    );
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
      evidenceDigest: projectionDigest({
        refs: parent.evidenceRefs,
        claim: {
          kind: 'CONTAINMENT_PARENT',
          relationType: 'CONTAINMENT',
          sourceCanonicalId: parent.childCanonicalId,
          targetCanonicalId: parent.parentCanonicalId,
        },
      }),
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
  const sealed = sealEvidence(evidence);
  if (item.family === 'containment' && item.targetCanonicalId === null) {
    return sealed.courseRoots.some((row) => (
      row.canonicalId === item.sourceCanonicalId && row.evidenceRefs.length > 0
    )) && FROZEN_TEACHING_EVIDENCE_REGISTRY.some((record) => evidenceAttestsClaim(record, {
      kind: 'COURSE_ROOT',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: item.sourceCanonicalId,
      targetCanonicalId: null,
    }));
  }
  if (item.family === 'containment' && item.targetCanonicalId) {
    return sealed.parents.some((row) => (
      row.childCanonicalId === item.sourceCanonicalId
      && row.parentCanonicalId === item.targetCanonicalId
    )) && FROZEN_TEACHING_EVIDENCE_REGISTRY.some((record) => evidenceAttestsClaim(record, {
      kind: 'CONTAINMENT_PARENT',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: item.sourceCanonicalId,
      targetCanonicalId: item.targetCanonicalId,
    }));
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

export function authorizedAutoAdmitFamilies(): ActTeachingFamily[] {
  const evidence = sealEvidence();
  const gold = frozenQualificationGold();
  const admitted = new Set(measurePipelineDataset(gold, evidence));
  return ACT_TEACHING_FAMILIES.filter((family) => (
    gold.items.some((item) => (
      item.family === family && item.expected === 'admit' && admitted.has(item.id)
    ))
  ));
}

export function frozenQualificationGold(): QualificationDataset {
  return {
    name: 'gold',
    items: [
      {
        id: 'gold-root-a',
        family: 'containment',
        relationType: 'CONTAINMENT',
        sourceCanonicalId: 'ctc:a',
        targetCanonicalId: null,
        expected: 'admit',
      },
      {
        id: 'gold-parent-b',
        family: 'containment',
        relationType: 'CONTAINMENT',
        sourceCanonicalId: 'ctc:b',
        targetCanonicalId: 'ctc:a',
        expected: 'admit',
      },
      {
        id: 'gold-cycle',
        family: 'prerequisite',
        relationType: 'PREREQUISITE',
        sourceCanonicalId: 'ctc:a',
        targetCanonicalId: 'ctc:a',
        expected: 'exclude',
      },
      {
        id: 'gold-low-conf',
        family: 'association',
        relationType: 'PEDAGOGICAL_ASSOCIATION',
        sourceCanonicalId: 'ctc:a',
        targetCanonicalId: 'ctc:b',
        expected: 'exclude',
      },
    ],
  };
}

export function frozenQualificationHoldout(): QualificationDataset {
  return {
    name: 'holdout',
    items: [
      {
        id: 'holdout-parent-c',
        family: 'containment',
        relationType: 'CONTAINMENT',
        sourceCanonicalId: 'ctc:c',
        targetCanonicalId: 'ctc:a',
        expected: 'admit',
      },
      {
        id: 'holdout-weak',
        family: 'prerequisite',
        relationType: 'PREREQUISITE',
        sourceCanonicalId: 'ctc:c',
        targetCanonicalId: 'ctc:a',
        expected: 'exclude',
      },
    ],
  };
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
