import { opaqueSubjectRef } from '@/features/learning-record/event-contract/allowlist';
import { sha256Canonical } from '@/features/learning-record/event-contract/digest';
import { inspectProjectionBoundary } from './boundary';
import {
  PROJECTION_STATUS,
  type ProjectionAnchors,
  type ProjectionEnvelope,
  type ProjectionStatus,
  type ProjectionTimes,
} from './types';

export function emptyAnchors(revision: string): ProjectionAnchors {
  return {
    sourceEventIds: [],
    sourceLogIds: [],
    canonicalActivityIds: [],
    canonicalResourceIds: [],
    canonicalKnowledgeIds: [],
    revision,
    captureRevision: revision,
    schemaVersion: '1',
    decoderVersion: '1',
    materializerVersion: '1',
  };
}

export function projectionInputDigest(input: {
  anchors: ProjectionAnchors;
  stateWatermark: string;
  trustedFactIds: string[];
  calculationVersion: string;
}): string {
  return sha256Canonical({
    anchors: {
      ...input.anchors,
      sourceEventIds: [...input.anchors.sourceEventIds].sort(),
      sourceLogIds: [...input.anchors.sourceLogIds].sort(),
      canonicalActivityIds: [...input.anchors.canonicalActivityIds].sort(),
      canonicalResourceIds: [...input.anchors.canonicalResourceIds].sort(),
      canonicalKnowledgeIds: [...input.anchors.canonicalKnowledgeIds].sort(),
    },
    stateWatermark: input.stateWatermark,
    trustedFactIds: [...input.trustedFactIds].sort(),
    calculationVersion: input.calculationVersion,
  });
}

export function projectionTrustedSetDigest(input: {
  anchors: ProjectionAnchors;
  times: Pick<ProjectionTimes, 'trustedOccurredAt'>;
  subjectRef: string;
}): string {
  return sha256Canonical({
    trustedOccurredAt: input.times.trustedOccurredAt,
    subjectRef: input.subjectRef,
    sourceEventIds: [...input.anchors.sourceEventIds].sort(),
  });
}

export function projectionOutputDigest(envelope: Omit<ProjectionEnvelope, 'outputDigest'>): string {
  return sha256Canonical({
    subjectRef: envelope.subjectRef,
    stateWatermark: envelope.stateWatermark,
    inputDigest: envelope.inputDigest,
    qualification: envelope.qualification,
    coverage: envelope.coverage,
    confidence: envelope.confidence,
  });
}

export function qualifyCandidate(input: {
  trustedEvidenceCount: number;
  minimumEvidence?: number;
  inputDigest: string;
  expectedInputDigest?: string;
  payload: Record<string, unknown>;
}): { qualification: ProjectionStatus; violations: string[] } {
  const violations = inspectProjectionBoundary(input.payload);
  if (violations.length > 0) {
    return { qualification: PROJECTION_STATUS.failed, violations };
  }
  if (
    typeof input.expectedInputDigest === 'string'
    && input.expectedInputDigest !== input.inputDigest
  ) {
    return { qualification: PROJECTION_STATUS.partial, violations: ['input-digest-mismatch'] };
  }
  if (input.trustedEvidenceCount < (input.minimumEvidence ?? 1)) {
    return { qualification: PROJECTION_STATUS.partial, violations: ['insufficient-evidence'] };
  }
  return { qualification: PROJECTION_STATUS.qualified, violations: [] };
}

export function buildProjectionEnvelope(input: {
  subjectUserId: string;
  scope?: 'learner' | 'class';
  classId?: string;
  processingWatermark: string;
  stateWatermark: string;
  calculationVersion: string;
  captureRevision: string;
  generation: string;
  queueGeneration: string;
  cutoverFence: string;
  coverage: number;
  freshness: string;
  confidence: number;
  qualification: ProjectionStatus;
  anchors: ProjectionAnchors;
  times: ProjectionTimes;
  trustedFactIds: string[];
  rematerialization?: ProjectionEnvelope['rematerialization'];
}): ProjectionEnvelope {
  if (
    input.captureRevision !== input.anchors.revision
    || input.captureRevision !== input.anchors.captureRevision
  ) {
    throw new Error('projection-revision-mismatch');
  }
  const subjectRef = opaqueSubjectRef(input.subjectUserId);
  const inputDigest = projectionInputDigest({
    anchors: input.anchors,
    stateWatermark: input.stateWatermark,
    trustedFactIds: input.trustedFactIds,
    calculationVersion: input.calculationVersion,
  });
  const trustedSetDigest = projectionTrustedSetDigest({
    anchors: input.anchors,
    times: input.times,
    subjectRef,
  });
  const base = {
    subjectRef,
    scope: input.scope ?? 'learner',
    classId: input.classId,
    processingWatermark: input.processingWatermark,
    stateWatermark: input.stateWatermark,
    calculationVersion: input.calculationVersion,
    captureRevision: input.captureRevision,
    generation: input.generation,
    queueGeneration: input.queueGeneration,
    cutoverFence: input.cutoverFence,
    inputDigest,
    trustedSetDigest,
    coverage: input.coverage,
    freshness: input.freshness,
    confidence: input.confidence,
    qualification: input.qualification,
    anchors: input.anchors,
    times: input.times,
    rematerialization: input.rematerialization,
  };
  return {
    ...base,
    outputDigest: projectionOutputDigest(base),
  };
}
