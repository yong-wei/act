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
  | 'adaptive_assessment_evidence';

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
      evidenceQuality: 'rich',
      profileWeight: 1,
      skipProfileContribution: false,
      policyReason: 'official_arena_evaluation',
    });
  }

  return null;
}

export function resolveLearningFactProfileWeight(contextJson: unknown): number {
  const governance = readRecord(readRecord(contextJson).evidenceGovernance);
  if (governance.skipProfileContribution === true) return 0;
  const profileWeight = readFiniteNumber(governance.profileWeight);
  if (profileWeight === null) return 1;
  return Math.max(0, Math.min(1, profileWeight));
}
