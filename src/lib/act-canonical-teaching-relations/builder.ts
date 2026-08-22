import { admitQualifiedCandidates } from './admit';
import type { ActTeachingProjectionArtifacts, ActTeachingScope } from './contracts';
import { emptyDispositions } from './families';
import {
  COURSE_ROOT_PIPELINE_VERSION,
  generateContainmentCandidates,
  generatePendingFamilyPlaceholders,
  measurePipelineDataset,
  pipelineConfigDigest,
  type ContainmentEvidence,
} from './pipeline';
import { publishActTeachingProjection } from './projection';
import { qualifyPipeline, type QualificationDataset } from './qualify';
import { buildReviewPack } from './review-pack';
import { detectKaqConflicts, type KaqFallbackRelation } from './kaq-conflict';

export function buildActTeachingProjection(input: {
  scope: ActTeachingScope;
  evidence: ContainmentEvidence;
  gold: QualificationDataset;
  holdout: QualificationDataset;
  threshold: number;
  kaqFallbacks?: readonly KaqFallbackRelation[];
}): ActTeachingProjectionArtifacts {
  const pipelineConfig = pipelineConfigDigest(COURSE_ROOT_PIPELINE_VERSION, input.evidence);
  const qualification = qualifyPipeline({
    pipelineVersion: COURSE_ROOT_PIPELINE_VERSION,
    pipelineConfigDigest: pipelineConfig,
    gold: input.gold,
    holdout: input.holdout,
    admittedGoldIds: measurePipelineDataset(input.gold, input.evidence),
    admittedHoldoutIds: measurePipelineDataset(input.holdout, input.evidence),
    threshold: input.threshold,
  });
  const generated = generateContainmentCandidates(input.scope, input.evidence);
  const covered = new Set(generated.map((row) => row.sourceCanonicalId));
  const pendingGaps = [
    ...generatePendingFamilyPlaceholders(input.scope, 'containment')
      .filter((row) => !covered.has(row.sourceCanonicalId)),
    ...generatePendingFamilyPlaceholders(input.scope, 'prerequisite'),
    ...generatePendingFamilyPlaceholders(input.scope, 'association'),
  ];
  const candidates = detectKaqConflicts({
    candidates: [...generated, ...pendingGaps],
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
  if (reviewPack.pendingCount !== admitted.pending.length) {
    throw new Error('review pack pending count drifted from admission');
  }
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
