import { admitQualifiedCandidates } from './admit';
import type { ActTeachingProjectionArtifacts, ActTeachingScope } from './contracts';
import { emptyDispositions } from './families';
import {
  COURSE_ROOT_PIPELINE_VERSION,
  generateCourseRootCandidates,
  pipelineConfigDigest,
} from './pipeline';
import { publishActTeachingProjection } from './projection';
import { qualifyPipeline, type QualificationDataset } from './qualify';
import { buildReviewPack } from './review-pack';
import { detectKaqConflicts, type KaqFallbackRelation } from './kaq-conflict';

export function buildActTeachingProjection(input: {
  scope: ActTeachingScope;
  gold: QualificationDataset;
  holdout: QualificationDataset;
  admittedGoldIds: readonly string[];
  admittedHoldoutIds: readonly string[];
  threshold: number;
  kaqFallbacks?: readonly KaqFallbackRelation[];
}): ActTeachingProjectionArtifacts {
  const pipelineConfig = pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION);
  const qualification = qualifyPipeline({
    pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
    pipelineConfigDigest: pipelineConfig,
    gold: input.gold,
    holdout: input.holdout,
    admittedGoldIds: input.admittedGoldIds,
    admittedHoldoutIds: input.admittedHoldoutIds,
    threshold: input.threshold,
  });
  const rootCandidates = generateCourseRootCandidates(input.scope);
  const candidates = detectKaqConflicts({
    candidates: rootCandidates,
    kaqFallbacks: input.kaqFallbacks ?? [],
  });
  const admitted = admitQualifiedCandidates({
    scope: input.scope,
    candidates,
    dispositions: emptyDispositions(input.scope),
    qualification,
    pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
    pipelineConfigDigest: pipelineConfig,
  });
  const reviewPack = buildReviewPack({
    scope: input.scope,
    candidates: admitted.pending,
    decisions: [],
  });
  return publishActTeachingProjection({
    scope: input.scope,
    dispositions: admitted.dispositions,
    edges: admitted.edges,
    reviewPack,
    qualification,
    candidates: admitted.pending,
    decisions: [],
  });
}
