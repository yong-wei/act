import {
  CANONICAL_BINDING_HIGH_IMPACT_POLICY_VERSION,
  CANONICAL_RESOURCE_BINDING_ROLES,
  type CandidateGenerationOutput,
  type CandidateReviewerIdentity,
  type CanonicalBindingHighImpactReason,
  type CanonicalCandidateIdentity,
  type CanonicalObjectIndexEntry,
  type CanonicalResourceBindingCandidate,
  type CanonicalResourceBindingDecision,
  type GeneratorDecisionCacheRecord,
  type PublicationGateContext,
  type ResourceSegmentIndexEntry,
  type ReviewerDecision,
  type ReviewerInput,
} from './contracts';
import { canonicalSha256 } from './inventory';

function identityProjection(identity: CanonicalCandidateIdentity): CanonicalCandidateIdentity {
  return {
    releaseSetId: identity.releaseSetId,
    releaseId: identity.releaseId,
    canonicalId: identity.canonicalId,
    objectRevision: identity.objectRevision,
    resourceId: identity.resourceId,
    structuralUnitId: identity.structuralUnitId,
    segmentId: identity.segmentId,
    resourceSegmentHash: identity.resourceSegmentHash,
  };
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const extras = Object.keys(value).filter((key) => !expected.includes(key));
  if (extras.length > 0) throw new Error(`${label} contains forbidden fields: ${extras.join(',')}`);
}

export function canonicalCandidateId(identity: CanonicalCandidateIdentity): string {
  return `canonical-resource-pair:${canonicalSha256(identityProjection(identity))}`;
}

export function decisionAttemptId(input: {
  pairId: string;
  generatorPromptVersion: string;
  reviewerPromptVersion: string;
  reviewerInputDigest: string;
  attemptSequence: number;
}): string {
  return `canonical-resource-decision:${canonicalSha256(input)}`;
}

export function generatorCacheKey(
  identity: CanonicalCandidateIdentity,
  generatorPromptVersion: string,
): string {
  return canonicalSha256({ identity: identityProjection(identity), generatorPromptVersion });
}

export function reviewerCacheKey(input: {
  candidateDigest: string;
  reviewerRole: 'INDEPENDENT_REVIEWER';
  reviewerPromptVersion: string;
  reviewerInputDigest: string;
}): string {
  return canonicalSha256(input);
}

function candidate(
  object: CanonicalObjectIndexEntry,
  segment: ResourceSegmentIndexEntry,
  trigger: CanonicalResourceBindingCandidate['trigger'],
  generatorPromptVersion: string,
): CanonicalResourceBindingCandidate {
  const identity: CanonicalCandidateIdentity = {
    releaseSetId: object.releaseSetId,
    releaseId: object.releaseId,
    canonicalId: object.canonicalId,
    objectRevision: object.objectRevision,
    resourceId: segment.resourceId,
    structuralUnitId: segment.structuralUnitId,
    segmentId: segment.segmentId,
    resourceSegmentHash: segment.resourceSegmentHash,
  };
  const pairId = canonicalCandidateId(identity);
  return {
    ...identity,
    id: pairId,
    pairId,
    trigger,
    proposedRole: segment.deterministicRole,
    evidenceIds: [...new Set(segment.evidenceIds)].sort(),
    generatorPromptVersion,
    generatorCacheKey: generatorCacheKey(identity, generatorPromptVersion),
  };
}

function generationOutput(
  candidates: CanonicalResourceBindingCandidate[],
  previous: readonly CanonicalResourceBindingDecision[],
  reviewerIdentities: readonly CandidateReviewerIdentity[],
): CandidateGenerationOutput {
  const reviewerIdentityByPair = new Map(reviewerIdentities.map((identity) => [
    identity.pairId,
    identity,
  ]));
  const previousByKey = new Map(previous
    .filter((row) => row.lifecycleState === 'CURRENT' && row.reviewState !== 'REVIEW_RETRYABLE')
    .map((row) => [
      canonicalSha256({
        generatorCacheKey: row.generatorCacheKey,
        reviewerPromptVersion: row.reviewerPromptVersion,
        reviewerInputDigest: row.reviewerInputDigest,
      }),
      row.id,
    ]));
  const unique = new Map<string, CanonicalResourceBindingCandidate>();
  const reusedDecisionIds = new Set<string>();
  for (const row of candidates) {
    const reviewerIdentity = reviewerIdentityByPair.get(row.pairId);
    const previousId = reviewerIdentity
      ? previousByKey.get(canonicalSha256({
          generatorCacheKey: row.generatorCacheKey,
          reviewerPromptVersion: reviewerIdentity.reviewerPromptVersion,
          reviewerInputDigest: reviewerIdentity.reviewerInputDigest,
        }))
      : undefined;
    if (previousId) reusedDecisionIds.add(previousId);
    else unique.set(row.pairId, row);
  }
  return {
    candidates: [...unique.values()].sort((left, right) => left.pairId.localeCompare(right.pairId)),
    reusedDecisionIds: [...reusedDecisionIds].sort(),
  };
}

export function generateCandidatesForCanonicalChanges(input: {
  changedObjects: readonly CanonicalObjectIndexEntry[];
  resourceIndex: readonly ResourceSegmentIndexEntry[];
  generatorPromptVersion: string;
  previousDecisions?: readonly CanonicalResourceBindingDecision[];
  reviewerIdentities?: readonly CandidateReviewerIdentity[];
}): CandidateGenerationOutput {
  return generationOutput(input.changedObjects.flatMap((object) => input.resourceIndex
    .filter((segment) => segment.candidateCanonicalIds.includes(object.canonicalId))
    .map((segment) => candidate(
      object,
      segment,
      'CANONICAL_CHANGE',
      input.generatorPromptVersion,
    ))), input.previousDecisions ?? [], input.reviewerIdentities ?? []);
}

export function generateCandidatesForResourceChanges(input: {
  changedSegments: readonly ResourceSegmentIndexEntry[];
  canonicalIndex: readonly CanonicalObjectIndexEntry[];
  generatorPromptVersion: string;
  previousDecisions?: readonly CanonicalResourceBindingDecision[];
  reviewerIdentities?: readonly CandidateReviewerIdentity[];
}): CandidateGenerationOutput {
  const byId = new Map<string, CanonicalObjectIndexEntry[]>();
  for (const object of input.canonicalIndex) {
    const matches = byId.get(object.canonicalId) ?? [];
    matches.push(object);
    byId.set(object.canonicalId, matches);
  }
  return generationOutput(input.changedSegments.flatMap((segment) => (
    segment.candidateCanonicalIds.flatMap((canonicalId) => {
      const objects = byId.get(canonicalId) ?? [];
      return objects.map((object) => candidate(
        object,
        segment,
        'RESOURCE_CHANGE',
        input.generatorPromptVersion,
      ));
    })
  )), input.previousDecisions ?? [], input.reviewerIdentities ?? []);
}

export function invalidateChangedResourcePairs(
  previous: readonly CanonicalResourceBindingDecision[],
  changedSegments: readonly Pick<
    ResourceSegmentIndexEntry,
    'resourceId' | 'structuralUnitId' | 'segmentId' | 'resourceSegmentHash'
  >[],
): { reusable: CanonicalResourceBindingDecision[]; invalidated: CanonicalResourceBindingDecision[] } {
  const changed = new Map(changedSegments.map((segment) => [
    `${segment.resourceId}\u001f${segment.structuralUnitId}\u001f${segment.segmentId}`,
    segment.resourceSegmentHash,
  ]));
  const invalidated: CanonicalResourceBindingDecision[] = [];
  const reusable: CanonicalResourceBindingDecision[] = [];
  for (const decision of previous) {
    const currentHash = changed.get(
      `${decision.resourceId}\u001f${decision.structuralUnitId}\u001f${decision.segmentId}`,
    );
    (currentHash !== undefined && currentHash !== decision.resourceSegmentHash
      ? invalidated
      : reusable).push(decision);
  }
  return { reusable, invalidated };
}

export function generatorDecision(
  candidateRow: CanonicalResourceBindingCandidate,
  input: Omit<GeneratorDecisionCacheRecord, 'candidateId' | 'generatorCacheKey'>,
): GeneratorDecisionCacheRecord {
  assertExactKeys(input as unknown as Record<string, unknown>, [
    'proposedRole', 'evidenceDigest', 'evidenceIds', 'highImpactReasons',
  ], 'generator decision');
  return {
    candidateId: candidateRow.pairId,
    generatorCacheKey: candidateRow.generatorCacheKey,
    proposedRole: input.proposedRole,
    evidenceDigest: input.evidenceDigest,
    evidenceIds: [...new Set(input.evidenceIds)].sort(),
    highImpactReasons: [...new Set(input.highImpactReasons)].sort(),
  };
}

export function buildReviewerInput(input: {
  candidate: CanonicalResourceBindingCandidate;
  generatorDecision: GeneratorDecisionCacheRecord;
  canonicalProfile: ReviewerInput['canonicalProfile'];
  resourceSegment: ReviewerInput['resourceSegment'];
}): ReviewerInput {
  assertExactKeys(input.generatorDecision as unknown as Record<string, unknown>, [
    'candidateId', 'generatorCacheKey', 'proposedRole', 'evidenceDigest',
    'evidenceIds', 'highImpactReasons',
  ], 'generator decision');
  assertExactKeys(input.canonicalProfile as unknown as Record<string, unknown>, [
    'canonicalId', 'canonicalType', 'semanticProfile',
  ], 'canonical profile');
  assertExactKeys(input.resourceSegment as unknown as Record<string, unknown>, [
    'structuralUnitId', 'segmentId', 'contentHash', 'content',
  ], 'resource segment');
  if (
    input.generatorDecision.candidateId !== input.candidate.pairId
    || input.generatorDecision.generatorCacheKey !== input.candidate.generatorCacheKey
    || input.canonicalProfile.canonicalId !== input.candidate.canonicalId
    || input.resourceSegment.structuralUnitId !== input.candidate.structuralUnitId
    || input.resourceSegment.segmentId !== input.candidate.segmentId
    || input.resourceSegment.contentHash !== input.candidate.resourceSegmentHash
  ) {
    throw new Error('review input identity does not match candidate');
  }
  return {
    candidateIdentity: identityProjection(input.candidate),
    canonicalProfile: { ...input.canonicalProfile },
    resourceSegment: { ...input.resourceSegment },
    proposedRole: input.generatorDecision.proposedRole,
    evidenceIds: [...input.generatorDecision.evidenceIds],
    evidenceDigest: input.generatorDecision.evidenceDigest,
  };
}

function decisionBase(input: {
  candidate: CanonicalResourceBindingCandidate;
  generated: GeneratorDecisionCacheRecord;
  reviewerPromptVersion: string;
  reviewerInput: ReviewerInput;
  attemptSequence: number;
  supersedesDecisionId?: string | null;
}) {
  const candidateDigest = canonicalSha256(identityProjection(input.candidate));
  const reviewerInputDigest = canonicalSha256(input.reviewerInput);
  return {
    ...input.candidate,
    id: decisionAttemptId({
      pairId: input.candidate.pairId,
      generatorPromptVersion: input.candidate.generatorPromptVersion,
      reviewerPromptVersion: input.reviewerPromptVersion,
      reviewerInputDigest,
      attemptSequence: input.attemptSequence,
    }),
    role: input.generated.proposedRole,
    evidenceId: input.generated.evidenceIds.length === 1 ? input.generated.evidenceIds[0]! : null,
    evidenceDigest: input.generated.evidenceDigest,
    reviewerPromptVersion: input.reviewerPromptVersion,
    reviewerRole: 'INDEPENDENT_REVIEWER' as const,
    reviewerInputDigest,
    candidateDigest,
    reviewerCacheKey: reviewerCacheKey({
      candidateDigest,
      reviewerRole: 'INDEPENDENT_REVIEWER',
      reviewerPromptVersion: input.reviewerPromptVersion,
      reviewerInputDigest,
    }),
    highImpactPolicyVersion: CANONICAL_BINDING_HIGH_IMPACT_POLICY_VERSION as
      typeof CANONICAL_BINDING_HIGH_IMPACT_POLICY_VERSION,
    attemptSequence: input.attemptSequence,
    lifecycleState: 'CURRENT' as const,
    supersedesDecisionId: input.supersedesDecisionId ?? null,
    crosswalkId: null,
    inventoryRunId: null,
    captureRevision: null,
    structuralUnitVersion: null,
    validationDigest: null,
  };
}

export async function runIndependentReview(input: {
  candidate: CanonicalResourceBindingCandidate;
  generatorDecision: GeneratorDecisionCacheRecord;
  canonicalProfile: ReviewerInput['canonicalProfile'];
  resourceSegment: ReviewerInput['resourceSegment'];
  reviewerPromptVersion: string;
  attemptSequence?: number;
  supersedesDecisionId?: string | null;
  review: (reviewerInput: ReviewerInput) => Promise<Pick<ReviewerDecision, 'outcome' | 'provider'>>;
}): Promise<CanonicalResourceBindingDecision> {
  const reviewerInput = buildReviewerInput(input);
  const base = decisionBase({
    candidate: input.candidate,
    generated: input.generatorDecision,
    reviewerPromptVersion: input.reviewerPromptVersion,
    reviewerInput,
    attemptSequence: input.attemptSequence ?? 1,
    supersedesDecisionId: input.supersedesDecisionId,
  });
  try {
    const review = await input.review(reviewerInput);
    assertExactKeys(review as Record<string, unknown>, ['outcome', 'provider'], 'review decision');
    if (!['GPT', 'FIXTURE'].includes(review.provider)) {
      throw new Error('review provider is not supported');
    }
    const reasons = new Set<CanonicalBindingHighImpactReason>(
      input.generatorDecision.highImpactReasons,
    );
    if (review.provider === 'FIXTURE') reasons.add('fixture-review-not-authoritative');
    if (review.outcome === 'DISPUTE') reasons.add('review-disputed');
    const humanRequired = reasons.size > 0;
    return {
      ...base,
      reviewProvider: review.provider,
      reviewState: humanRequired
        ? 'HUMAN_REQUIRED'
        : review.outcome === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
      publicationState: humanRequired ? 'HUMAN_REQUIRED' : 'CANDIDATE',
      highImpactReasons: [...reasons].sort(),
    };
  } catch {
    return {
      ...base,
      reviewProvider: 'GPT',
      reviewState: 'REVIEW_RETRYABLE',
      publicationState: 'REVIEW_RETRYABLE',
      highImpactReasons: [...input.generatorDecision.highImpactReasons],
    };
  }
}

function withHumanRequired(
  decision: CanonicalResourceBindingDecision,
  reasons: CanonicalBindingHighImpactReason[],
): CanonicalResourceBindingDecision {
  return {
    ...decision,
    reviewState: 'HUMAN_REQUIRED',
    publicationState: 'HUMAN_REQUIRED',
    highImpactReasons: [...new Set([...decision.highImpactReasons, ...reasons])].sort(),
  };
}

export function applyPublicationGates(
  decision: CanonicalResourceBindingDecision,
  context: PublicationGateContext,
  options: { humanApproved?: boolean } = {},
): CanonicalResourceBindingDecision {
  if (!['ACCEPTED', 'NOT_REQUIRED'].includes(decision.reviewState)) return decision;
  const failures: CanonicalBindingHighImpactReason[] = [];
  if (!context.canonicalObjects.some((row) => (
    row.releaseSetId === decision.releaseSetId
    && row.releaseId === decision.releaseId
    && row.canonicalId === decision.canonicalId
    && row.objectRevision === decision.objectRevision
  ))) failures.push('canonical-endpoint-or-revision-mismatch');
  if (!CANONICAL_RESOURCE_BINDING_ROLES.includes(decision.role)) {
    failures.push('invalid-teaching-role');
  }
  const crosswalks = context.crosswalks.filter((row) => (
    row.releaseId === decision.releaseId
    && row.evidenceId === decision.evidenceId
    && row.canonicalId === decision.canonicalId
    && row.resourceId === decision.resourceId
    && row.structuralUnitId === decision.structuralUnitId
    && row.segmentId === decision.segmentId
    && row.resourceSegmentHash === decision.resourceSegmentHash
    && row.inventoryRunId === context.captureIdentity.inventoryRunId
    && row.captureRevision === context.captureIdentity.captureRevision
    && row.structuralUnitVersion === context.captureIdentity.structuralUnitVersion
    && row.validationState === 'VALIDATED'
  ));
  if (crosswalks.length !== 1) failures.push('crosswalk-not-unique');
  const alignmentCanonicalIds = new Set(context.evidenceAlignments.filter((row) => (
    row.releaseId === decision.releaseId
    && row.evidenceId === decision.evidenceId
  )).map((row) => row.canonicalId));
  if (
    alignmentCanonicalIds.size !== 1
    || !alignmentCanonicalIds.has(decision.canonicalId)
  ) failures.push('evidence-alignment-not-unique');
  if (context.existingPublished.some((row) => (
    row.id !== decision.id
    && row.id !== decision.supersedesDecisionId
    && row.pairId === decision.pairId
    && row.role === decision.role
    && row.lifecycleState === 'CURRENT'
    && row.publicationState === 'SHADOW_PUBLISHED'
  ))) failures.push('binding-role-not-unique');
  if (decision.reviewProvider === 'FIXTURE' && !options.humanApproved) {
    failures.push('fixture-review-not-authoritative');
  }
  if (failures.length > 0) return withHumanRequired(decision, failures);
  const crosswalk = crosswalks[0]!;
  return {
    ...decision,
    publicationState: 'SHADOW_PUBLISHED',
    crosswalkId: crosswalk.id,
    inventoryRunId: crosswalk.inventoryRunId,
    captureRevision: crosswalk.captureRevision,
    structuralUnitVersion: crosswalk.structuralUnitVersion,
    validationDigest: crosswalk.validationDigest,
  };
}

export function buildDeterministicDecision(input: {
  candidate: CanonicalResourceBindingCandidate;
  evidenceDigest: string;
  context: PublicationGateContext;
  attemptSequence?: number;
}): CanonicalResourceBindingDecision {
  if (!input.candidate.proposedRole || input.candidate.evidenceIds.length !== 1) {
    throw new Error('deterministic binding requires one evidence segment and one role');
  }
  const generated = generatorDecision(input.candidate, {
    proposedRole: input.candidate.proposedRole,
    evidenceDigest: input.evidenceDigest,
    evidenceIds: input.candidate.evidenceIds,
    highImpactReasons: [],
  });
  const reviewerInput: ReviewerInput = {
    candidateIdentity: identityProjection(input.candidate),
    canonicalProfile: {
      canonicalId: input.candidate.canonicalId,
      canonicalType: 'deterministic',
      semanticProfile: 'deterministic',
    },
    resourceSegment: {
      structuralUnitId: input.candidate.structuralUnitId,
      segmentId: input.candidate.segmentId,
      contentHash: input.candidate.resourceSegmentHash,
      content: '',
    },
    proposedRole: generated.proposedRole,
    evidenceIds: generated.evidenceIds,
    evidenceDigest: generated.evidenceDigest,
  };
  return applyPublicationGates({
    ...decisionBase({
      candidate: input.candidate,
      generated,
      reviewerPromptVersion: 'not-required',
      reviewerInput,
      attemptSequence: input.attemptSequence ?? 1,
    }),
    reviewProvider: 'NONE',
    reviewState: 'NOT_REQUIRED',
    publicationState: 'CANDIDATE',
    highImpactReasons: [],
  }, input.context);
}

export function applyHumanDecision(input: {
  decision: CanonicalResourceBindingDecision;
  outcome: 'ACCEPT' | 'REJECT';
  context: PublicationGateContext;
  attemptSequence?: number;
}): CanonicalResourceBindingDecision {
  const next = {
    ...input.decision,
    id: decisionAttemptId({
      pairId: input.decision.pairId,
      generatorPromptVersion: input.decision.generatorPromptVersion,
      reviewerPromptVersion: 'human-adjudication/v1',
      reviewerInputDigest: input.decision.reviewerInputDigest,
      attemptSequence: input.attemptSequence ?? input.decision.attemptSequence + 1,
    }),
    reviewerPromptVersion: 'human-adjudication/v1',
    reviewProvider: 'HUMAN' as const,
    reviewState: input.outcome === 'ACCEPT' ? 'ACCEPTED' as const : 'REJECTED' as const,
    publicationState: 'CANDIDATE' as const,
    attemptSequence: input.attemptSequence ?? input.decision.attemptSequence + 1,
    supersedesDecisionId: input.decision.id,
    crosswalkId: null,
    inventoryRunId: null,
    captureRevision: null,
    structuralUnitVersion: null,
    validationDigest: null,
  };
  return input.outcome === 'REJECT'
    ? next
    : applyPublicationGates(next, input.context, { humanApproved: true });
}
