import { rejectClientResultFields } from '@/lib/control-engine';
import { identifiedClaimWithoutParameters } from '@/lib/control-engine';

import { rejectHiddenPublicPayload } from './privacy';
import type { ArtifactRunIdentity } from './types';

export class ArtifactRunContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArtifactRunContractError';
  }
}

export function assertPreviewOrPracticeNotOfficial(identity: ArtifactRunIdentity): void {
  if (identity.evaluationVisibility === 'official' || identity.officialEligible) {
    throw new ArtifactRunContractError('Preview and Practice envelopes cannot be officialEligible.');
  }
  if (identity.sourceKind === 'arena-preview' && identity.evaluationVisibility !== 'preview') {
    throw new ArtifactRunContractError('Arena preview envelopes must use evaluationVisibility=preview.');
  }
  if (identity.sourceKind === 'practice-outcome' && identity.evaluationVisibility !== 'practice') {
    throw new ArtifactRunContractError('Practice envelopes must use evaluationVisibility=practice.');
  }
}

export function assertSurrogateTruth(identity: ArtifactRunIdentity): void {
  if (identity.modelRelation === 'surrogate') {
    if (!identity.teachingSemantics || identity.prohibitsMixedClaims !== true) {
      throw new ArtifactRunContractError('Surrogate envelopes require teachingSemantics and prohibitsMixedClaims.');
    }
    return;
  }
  throw new ArtifactRunContractError('Identified envelopes require authorized model parameters consumed by Rust.');
}

export function assertIdentifiedCapability(
  modelRelation: 'surrogate' | 'identified',
  authorizedModelParameters: Record<string, number> | null | undefined,
): void {
  if (identifiedClaimWithoutParameters(modelRelation, authorizedModelParameters)) {
    throw new ArtifactRunContractError('Identified envelopes require authorized model parameters consumed by Rust.');
  }
}

export function assertNoOfficialPromotion(identity: ArtifactRunIdentity, target: 'ArenaSubmission' | 'ArenaEvaluationRun' | 'leaderboard'): void {
  assertPreviewOrPracticeNotOfficial(identity);
  if (identity.sourceKind === 'arena-preview' || identity.sourceKind === 'practice-outcome') {
    throw new ArtifactRunContractError(`${identity.sourceKind} cannot create ${target}.`);
  }
}

export function assertEvaluationBoundToAcceptedSubmission(input: {
  ownerUserId: string;
  acceptedSubmissionUserIds: readonly string[];
}): void {
  if (!input.acceptedSubmissionUserIds.includes(input.ownerUserId)) {
    throw new ArtifactRunContractError('ArenaEvaluationRun without a uniquely accepted submission is unbound student evidence.');
  }
}

export function rejectVirtualPreviewRequestBody(body: unknown): string | null {
  const clientFields = rejectClientResultFields(body);
  if (clientFields) return clientFields;
  try {
    rejectHiddenPublicPayload(body);
  } catch (error) {
    return error instanceof Error ? error.message : 'Hidden fields are not accepted.';
  }
  return null;
}
