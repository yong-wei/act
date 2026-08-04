import type { Prisma } from '@prisma/client';

import {
  summarizeSubmissionEvidencePayload,
  type SubmissionEvidenceQuality,
  type SubmissionPayloadEvidenceQuality,
  type SubmissionEvidenceSourceState,
} from './submission-evidence-quality';

export type LearningFactProfilePolicyReason =
  | 'rich_objective_evidence'
  | 'partial_evidence_low_weight'
  | 'legacy_evidence_context_only'
  | 'missing_evidence_context_only'
  | 'official_arena_evaluation'
  | 'arena_client_evaluation_context_only'
  | 'adaptive_assessment_evidence'
  | 'adaptive_assessment_provisional_context_only'
  | 'adaptive_assessment_missing_kaq_context_only'
  | 'unmanaged_learning_fact_context_only';

export interface LearningFactEvidenceGovernance {
  evidenceQuality: SubmissionEvidenceQuality;
  payloadEvidenceQuality?: SubmissionPayloadEvidenceQuality;
  sourceState?: SubmissionEvidenceSourceState;
  evidenceReason?: string;
  profileWeight: number;
  skipProfileContribution: boolean;
  policyReason: LearningFactProfilePolicyReason;
}

export const PARTIAL_EVIDENCE_PROFILE_WEIGHT = 0.25;

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function hasStringArray(value: unknown): boolean {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => readNonEmptyString(item) !== null);
}

function hasKaqQuizVersionRefs(value: unknown): boolean {
  const refs = readRecord(value);
  return [
    'artifactVersioningVersion',
    'learningGoalPackageVersion',
    'objectiveCatalogVersion',
    'graphCatalogVersion',
    'resourceRegistryVersion',
    'resourceProjectionVersion',
    'overlayVersion',
    'plannerVersion',
    'groundingVersion',
    'questionBankVersion',
  ].every((ref) => readNonEmptyString(refs[ref]) !== null);
}

function hasGovernedKaqQuizEvidence(value: Record<string, unknown>): boolean {
  const reviewAudit = readRecord(value.reviewAudit);
  const confidence = readRecord(value.confidence);
  const retryPolicy = readRecord(value.retryPolicy);
  const denominator = readFiniteNumber(value.denominator);
  const score = readFiniteNumber(value.score);
  return value.learningFactEligible === true
    && value.studentCompetencySnapshotEffect === 'update'
    && value.reviewState === 'reviewed'
    && readNonEmptyString(value.questionSnapshotId) !== null
    && readNonEmptyString(value.quizSetId) !== null
    && readNonEmptyString(value.attemptKey) !== null
    && readNonEmptyString(value.scoringVersion) !== null
    && readNonEmptyString(value.rubricVersion) !== null
    && readNonEmptyString(value.sourceLogId) !== null
    && readNonEmptyString(value.dedupeKey) !== null
    && readNonEmptyString(value.occurredAt) !== null
    && value.eventSource === 'adaptive_assessment'
    && value.eventType === 'answer_submit'
    && score !== null
    && score >= 0
    && score <= 100
    && typeof value.isCorrect === 'boolean'
    && denominator !== null
    && denominator >= 1
    && readFiniteNumber(retryPolicy.maxAttemptsAffectingMastery) !== null
    && readNonEmptyString(retryPolicy.idempotencyScope) !== null
    && hasStringArray(value.learningGoalIds)
    && hasStringArray(value.kaqObjectiveIds)
    && hasStringArray(value.knowledgeObjectiveIds)
    && hasStringArray(value.applicationObjectiveIds)
    && hasStringArray(value.qualityObjectiveIds)
    && hasStringArray(value.graphNodeIds)
    && hasStringArray(value.capabilityTargetIds)
    && hasStringArray(value.qualityTargetIds)
    && hasKaqQuizVersionRefs(value.versionRefs)
    && reviewAudit.state === 'reviewed'
    && readNonEmptyString(reviewAudit.reviewBatchId) !== null
    && readNonEmptyString(reviewAudit.sourceHash) !== null
    && readNonEmptyString(reviewAudit.metadataVersionRef) !== null
    && readNonEmptyString(confidence.level) !== null
    && readFiniteNumber(confidence.score) !== null;
}

function toJsonObject(value: LearningFactEvidenceGovernance): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Prisma.InputJsonObject;
}

export function resolveLearningFactEvidenceGovernance(
  actionType: string,
  payload: Record<string, unknown>,
): Prisma.InputJsonObject | null {
  if (actionType === 'answer_submit' && payload.assessmentSource === 'adaptive_assessment') {
    const kaqQuizEvidence = readRecord(payload.kaqQuizEvidence);
    if (Object.keys(kaqQuizEvidence).length === 0) {
      return toJsonObject({
        evidenceQuality: 'partial',
        payloadEvidenceQuality: 'partial',
        sourceState: 'manifest-submission-v2',
        evidenceReason: 'adaptive_assessment_missing_kaq_evidence',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_missing_kaq_context_only',
      });
    }
    if (
      kaqQuizEvidence.learningFactEligible === false ||
      kaqQuizEvidence.studentCompetencySnapshotEffect === 'no-op'
    ) {
      return toJsonObject({
        evidenceQuality: 'partial',
        payloadEvidenceQuality: 'partial',
        sourceState: 'manifest-submission-v2',
        evidenceReason: 'adaptive_assessment_provisional',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_provisional_context_only',
      });
    }
    if (!hasGovernedKaqQuizEvidence(kaqQuizEvidence)) {
      return toJsonObject({
        evidenceQuality: 'partial',
        payloadEvidenceQuality: 'partial',
        sourceState: 'manifest-submission-v2',
        evidenceReason: 'adaptive_assessment_incomplete_kaq_evidence',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'adaptive_assessment_missing_kaq_context_only',
      });
    }
    return toJsonObject({
      evidenceQuality: 'rich',
      payloadEvidenceQuality: 'rich',
      sourceState: 'manifest-submission-v2',
      evidenceReason: 'adaptive_assessment_persisted',
      profileWeight: 1,
      skipProfileContribution: false,
      policyReason: 'adaptive_assessment_evidence',
    });
  }

  if (actionType === 'lesson_submit' || actionType === 'lesson_resubmit') {
    const summary = summarizeSubmissionEvidencePayload(payload);
    const base = {
      evidenceQuality: summary.quality,
      payloadEvidenceQuality: summary.payloadEvidenceQuality,
      sourceState: summary.sourceState,
      evidenceReason: summary.reason,
    };

    if (summary.quality === 'rich') {
      return toJsonObject({
        ...base,
        profileWeight: 1,
        skipProfileContribution: false,
        policyReason: 'rich_objective_evidence',
      });
    }

    if (summary.quality === 'partial') {
      return toJsonObject({
        ...base,
        profileWeight: PARTIAL_EVIDENCE_PROFILE_WEIGHT,
        skipProfileContribution: false,
        policyReason: 'partial_evidence_low_weight',
      });
    }

    return toJsonObject({
      ...base,
      profileWeight: 0,
      skipProfileContribution: true,
      policyReason: summary.quality === 'legacy'
        ? 'legacy_evidence_context_only'
        : 'missing_evidence_context_only',
    });
  }

  if (
    actionType === 'arena_evaluation_complete'
    && readFiniteNumber(payload.score) !== null
    && typeof payload.valid === 'boolean'
  ) {
    return toJsonObject({
      evidenceQuality: 'partial',
      profileWeight: 0,
      skipProfileContribution: true,
      policyReason: 'arena_client_evaluation_context_only',
    });
  }

  return toJsonObject({
    evidenceQuality: 'missing',
    profileWeight: 0,
    skipProfileContribution: true,
    policyReason: 'unmanaged_learning_fact_context_only',
  });
}

export function hasCompleteLearningFactEvidenceGovernance(contextJson: unknown): boolean {
  const governance = readRecord(readRecord(contextJson).evidenceGovernance);
  return readFiniteNumber(governance.profileWeight) !== null
    && typeof governance.skipProfileContribution === 'boolean'
    && readNonEmptyString(governance.policyReason) !== null;
}

export function resolveLearningFactProfileWeight(contextJson: unknown): number {
  if (!hasCompleteLearningFactEvidenceGovernance(contextJson)) return 0;
  const governance = readRecord(readRecord(contextJson).evidenceGovernance);
  if (governance.skipProfileContribution === true) return 0;
  const profileWeight = readFiniteNumber(governance.profileWeight);
  if (profileWeight === null) return 0;
  return Math.max(0, Math.min(1, profileWeight));
}
