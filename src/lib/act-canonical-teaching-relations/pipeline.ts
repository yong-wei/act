import {
  ACT_TEACHING_CANDIDATE_CONTRACT,
  type ActTeachingCandidate,
  type ActTeachingScope,
} from './contracts';
import { MIN_AUTO_ADMIT_CONFIDENCE } from './families';
import { projectionDigest } from './hash';

export const COURSE_ROOT_PIPELINE_VERSION = 'act-course-root-containment/v1' as const;

export function pipelineConfigDigest(version: string): string {
  return projectionDigest({ version, rule: 'course-root-every-member' });
}

export function generateCourseRootCandidates(scope: ActTeachingScope): ActTeachingCandidate[] {
  const pipelineConfig = pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION);
  return scope.memberIds.map((canonicalId) => {
    const evidenceRefs = [
      `scope:${scope.scopeHash}`,
      `catalog:${scope.catalog.catalogHash}`,
      `member:${canonicalId}`,
    ];
    const evidenceDigest = projectionDigest(evidenceRefs);
    const candidateId = `cand-${projectionDigest({
      family: 'containment',
      sourceCanonicalId: canonicalId,
      scopeHash: scope.scopeHash,
      pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
    }).slice(0, 24)}`;
    return {
      contract: ACT_TEACHING_CANDIDATE_CONTRACT,
      candidateId,
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
      evidenceDigest,
      authority: scope.authority,
      conflicts: [],
      exceptionReasons: [],
    };
  });
}

export function generatePendingFamilyPlaceholders(
  scope: ActTeachingScope,
  family: 'prerequisite' | 'association',
): ActTeachingCandidate[] {
  const pipelineConfig = pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION);
  return scope.memberIds.map((canonicalId) => ({
    contract: ACT_TEACHING_CANDIDATE_CONTRACT,
    candidateId: `cand-${projectionDigest({
      family,
      sourceCanonicalId: canonicalId,
      scopeHash: scope.scopeHash,
      kind: 'placeholder',
    }).slice(0, 24)}`,
    scopeHash: scope.scopeHash,
    family,
    relationType: family === 'prerequisite' ? 'PREREQUISITE' : 'PEDAGOGICAL_ASSOCIATION',
    sourceCanonicalId: canonicalId,
    targetCanonicalId: null,
    direction: family === 'prerequisite' ? 'source_to_target' : 'symmetric',
    origin: 'QUALIFIED_PIPELINE',
    pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
    pipelineConfigDigest: pipelineConfig,
    confidence: 0,
    strength: null,
    evidenceRefs: [],
    evidenceDigest: projectionDigest([]),
    authority: scope.authority,
    conflicts: [],
    exceptionReasons: ['low-confidence', 'weak-evidence'],
  }));
}
