import {
  applyPublicationGates,
  buildDeterministicDecision,
  canonicalCandidateId,
  canonicalSha256,
  decisionAttemptId,
  generateCandidatesForCanonicalChanges,
  generateCandidatesForResourceChanges,
  generatorCacheKey as buildGeneratorCacheKey,
  generatorDecision,
  invalidateChangedResourcePairs,
  reviewerCacheKey as buildReviewerCacheKey,
  type CanonicalBindingReviewProvider,
  type CanonicalCandidateIdentity,
  type CanonicalObjectIndexEntry,
  type CanonicalResourceBindingCandidate,
  type CanonicalResourceBindingDecision,
  type CanonicalResourceBindingRole,
  type EvidenceStructuralUnitCrosswalk,
  type PublicationGateContext,
  type ResourceSegmentIndexEntry,
} from '@/lib/canonical-resource-binding';

import type { CaptureIdentity, ResourceBindingWorkItem } from './contracts';
import {
  evaluateSemanticRevalidation,
  type RevalidationComparable,
} from './revalidation';
import type { PriorSemanticDecision, RevalidationReceipt } from './contracts';
import { sha256Canonical } from './hash';

/** Controlled binding review authoring entry (never auto-accepted as shadow). */
export interface BindingReviewAuthoringEntry {
  outcome: 'ACCEPT' | 'REJECT' | 'DISPUTE' | 'HUMAN_REQUIRED';
  proposedRole: CanonicalResourceBindingRole;
  reviewIdentity: string;
  reviewerPromptVersion: string;
  evidenceDigest: string;
  evidenceIds?: readonly string[];
  rationale: string;
  /** Real reviewer provider — must not be fabricated (e.g. GROK, not GPT). */
  reviewProvider: CanonicalBindingReviewProvider;
}

export interface BindingGovernanceResult {
  /** Full same-run candidates retained for #1124 review/decision/persistence. */
  candidates: CanonicalResourceBindingCandidate[];
  candidatesGenerated: number;
  /**
   * Decisions produced through #1124 contracts in this run.
   * Deterministic gates may yield SHADOW_PUBLISHED; semantic candidates without
   * controlled review are staged as HUMAN_REQUIRED and never auto-accepted.
   */
  decisions: CanonicalResourceBindingDecision[];
  /** Candidates still lacking a controlled role proposal (not discarded). */
  pendingReviewCandidates: CanonicalResourceBindingCandidate[];
  reusedDecisionIds: string[];
  invalidated: CanonicalResourceBindingDecision[];
  reusable: CanonicalResourceBindingDecision[];
  revalidationReceipts: RevalidationReceipt[];
  shadowPublishedCount: number;
}

/**
 * Semantic comparable for binding revalidation. Excludes ReleaseSet / Release /
 * capture / inventory publication identity so cross-ReleaseSet revalidation can
 * prove structural equivalence without copying old publication ids.
 */
function decisionSemanticComparable(input: {
  canonicalId: string;
  objectRevision: string;
  resourceSegmentHash: string;
  role: string | null;
  generatorPromptVersion: string;
  reviewerPromptVersion: string;
  evidenceDigest: string;
  structuralGateDigest: string | null;
}): RevalidationComparable {
  return {
    canonicalDigest: sha256Canonical({
      canonicalId: input.canonicalId,
      objectRevision: input.objectRevision,
    }),
    resourceSegmentHash: input.resourceSegmentHash,
    role: input.role,
    promptReviewerVersion: `${input.generatorPromptVersion}|${input.reviewerPromptVersion}`,
    evidenceDigest: input.evidenceDigest,
    structuralGateDigest: input.structuralGateDigest,
  };
}

function decisionComparable(
  decision: CanonicalResourceBindingDecision,
): RevalidationComparable {
  return decisionSemanticComparable({
    canonicalId: decision.canonicalId,
    objectRevision: decision.objectRevision,
    resourceSegmentHash: decision.resourceSegmentHash,
    role: decision.role,
    generatorPromptVersion: decision.generatorPromptVersion,
    reviewerPromptVersion: decision.reviewerPromptVersion,
    evidenceDigest: decision.evidenceDigest,
    structuralGateDigest: decision.validationDigest
      ?? decision.governedValidationDigest
      ?? null,
  });
}

function priorFromDecision(
  decision: CanonicalResourceBindingDecision,
): PriorSemanticDecision {
  const comparable = decisionComparable(decision);
  return {
    kind: 'binding',
    identityKey: decision.pairId,
    releaseSetId: decision.releaseSetId,
    releaseId: decision.releaseId,
    ...comparable,
    publicationIdentity: decision.id,
    lifecycleState: decision.lifecycleState,
  };
}

export function bindingCaptureIdentityDrift(
  decision: CanonicalResourceBindingDecision,
  capture: CaptureIdentity,
): boolean {
  if (
    decision.releaseSetId !== capture.releaseSetId
    || decision.releaseId !== capture.releaseId
  ) {
    return true;
  }
  if (
    decision.captureRevision != null
    && decision.captureRevision !== capture.captureRevision
  ) {
    return true;
  }
  if (
    decision.governedCaptureRevision != null
    && decision.governedCaptureRevision !== capture.captureRevision
  ) {
    return true;
  }
  if (
    capture.inventoryRunId != null
    && decision.inventoryRunId != null
    && decision.inventoryRunId !== capture.inventoryRunId
  ) {
    return true;
  }
  if (
    capture.inventoryRunId != null
    && decision.governedInventoryRunId != null
    && decision.governedInventoryRunId !== capture.inventoryRunId
  ) {
    return true;
  }
  return false;
}

/**
 * Seal a revalidation reviewer/revalidation digest for the new candidate
 * identity. Does not pretend the prior reviewer input was executed against the
 * new identity — it records prior decision/review evidence + revalidation
 * receipt + current candidate identity only (no semantic re-review).
 */
function revalidationReviewerInputDigest(input: {
  prior: CanonicalResourceBindingDecision;
  candidateIdentity: CanonicalCandidateIdentity;
  revalidationReceipt: RevalidationReceipt;
}): string {
  return canonicalSha256({
    kind: 'binding-revalidation',
    priorDecisionId: input.prior.id,
    priorPairId: input.prior.pairId,
    priorReviewerInputDigest: input.prior.reviewerInputDigest,
    priorReviewState: input.prior.reviewState,
    priorEvidenceDigest: input.prior.evidenceDigest,
    priorRole: input.prior.role,
    candidateIdentity: input.candidateIdentity,
    revalidationReceiptId: input.revalidationReceipt.id,
    revalidationOutcome: input.revalidationReceipt.outcome,
    revalidationIdentityDigest: input.revalidationReceipt.identityDigest,
  });
}

function stageSemanticBindingDecision(input: {
  candidate: CanonicalResourceBindingCandidate;
  role: CanonicalResourceBindingRole;
  evidenceDigest: string;
  evidenceIds: readonly string[];
  reviewerPromptVersion: string;
  outcome: BindingReviewAuthoringEntry['outcome'];
  reviewIdentity: string;
  rationale: string;
  reviewProvider: CanonicalBindingReviewProvider;
  publicationGateContext?: PublicationGateContext | null;
}): CanonicalResourceBindingDecision {
  if (!input.reviewIdentity.trim()) {
    throw new Error('Binding review rejected: reviewIdentity is required');
  }
  if (!input.rationale.trim()) {
    throw new Error('Binding review rejected: rationale is required');
  }
  if (input.reviewProvider === 'GPT' && /grok/iu.test(input.reviewIdentity)) {
    throw new Error(
      'Binding review rejected: reviewProvider=GPT conflicts with Grok reviewIdentity',
    );
  }
  const generated = generatorDecision(input.candidate, {
    proposedRole: input.role,
    evidenceDigest: input.evidenceDigest,
    evidenceIds: [...input.evidenceIds],
    highImpactReasons: input.outcome === 'DISPUTE' ? ['review-disputed'] : [],
  });
  const candidateDigest = sha256Canonical({
    releaseSetId: input.candidate.releaseSetId,
    releaseId: input.candidate.releaseId,
    canonicalId: input.candidate.canonicalId,
    objectRevision: input.candidate.objectRevision,
    resourceId: input.candidate.resourceId,
    structuralUnitId: input.candidate.structuralUnitId,
    segmentId: input.candidate.segmentId,
    resourceSegmentHash: input.candidate.resourceSegmentHash,
  });
  const reviewerInputDigest = sha256Canonical({
    candidateIdentity: {
      releaseSetId: input.candidate.releaseSetId,
      releaseId: input.candidate.releaseId,
      canonicalId: input.candidate.canonicalId,
      objectRevision: input.candidate.objectRevision,
      resourceId: input.candidate.resourceId,
      structuralUnitId: input.candidate.structuralUnitId,
      segmentId: input.candidate.segmentId,
      resourceSegmentHash: input.candidate.resourceSegmentHash,
    },
    proposedRole: input.role,
    evidenceDigest: input.evidenceDigest,
    evidenceIds: [...input.evidenceIds].sort(),
    outcome: input.outcome,
    reviewIdentity: input.reviewIdentity,
    rationale: input.rationale,
    reviewProvider: input.reviewProvider,
  });
  const humanRequired = input.outcome === 'HUMAN_REQUIRED'
    || input.outcome === 'DISPUTE'
    || generated.highImpactReasons.length > 0
    || input.reviewProvider === 'FIXTURE';
  const reviewState = humanRequired
    ? 'HUMAN_REQUIRED' as const
    : input.outcome === 'ACCEPT'
      ? 'ACCEPTED' as const
      : 'REJECTED' as const;
  const base: CanonicalResourceBindingDecision = {
    ...input.candidate,
    id: `canonical-resource-decision:${sha256Canonical({
      pairId: input.candidate.pairId,
      generatorPromptVersion: input.candidate.generatorPromptVersion,
      reviewerPromptVersion: input.reviewerPromptVersion,
      reviewerInputDigest,
      attemptSequence: 1,
    })}`,
    role: input.role,
    evidenceId: input.evidenceIds.length === 1 ? input.evidenceIds[0]! : null,
    evidenceDigest: input.evidenceDigest,
    reviewerPromptVersion: input.reviewerPromptVersion,
    reviewerRole: 'INDEPENDENT_REVIEWER',
    reviewerInputDigest,
    candidateDigest,
    reviewerCacheKey: sha256Canonical({
      candidateDigest,
      reviewerRole: 'INDEPENDENT_REVIEWER',
      reviewerPromptVersion: input.reviewerPromptVersion,
      reviewerInputDigest,
    }),
    reviewProvider: input.reviewProvider,
    reviewState,
    // REJECT / HUMAN_REQUIRED / DISPUTE never publish; ACCEPT needs gates.
    publicationState: humanRequired
      ? 'HUMAN_REQUIRED'
      : input.outcome === 'ACCEPT'
        ? 'CANDIDATE'
        : 'CANDIDATE',
    highImpactPolicyVersion: 'binding-impact/v1',
    highImpactReasons: [...generated.highImpactReasons].sort(),
    attemptSequence: 1,
    lifecycleState: 'CURRENT',
    supersedesDecisionId: null,
    crosswalkId: null,
    inventoryRunId: null,
    captureRevision: null,
    structuralUnitVersion: null,
    validationDigest: null,
    reviewIdentity: input.reviewIdentity.trim(),
    reviewRationale: input.rationale.trim(),
  };
  if (input.outcome === 'ACCEPT' && !humanRequired && input.publicationGateContext) {
    const gated = applyPublicationGates(base, input.publicationGateContext);
    // Map publication identity onto #1126 governed* fields. Never write legacy
    // EvidenceStructuralUnitCrosswalk tuple for aggregate-governed decisions.
    if (gated.publicationState === 'SHADOW_PUBLISHED') {
      return {
        ...gated,
        // #1126 governed path only — leave legacy EvidenceStructuralUnit tuple null.
        governedCrosswalkId: gated.crosswalkId,
        governedInventoryRunId: gated.inventoryRunId,
        governedCaptureRevision: gated.captureRevision,
        governedStructuralUnitVersion: gated.structuralUnitVersion,
        governedValidationDigest: gated.validationDigest,
        crosswalkId: null,
        inventoryRunId: null,
        captureRevision: null,
        structuralUnitVersion: null,
        validationDigest: null,
        // evidenceId may be inventory atomic id, not ActkgEvidenceSegment.
        evidenceId: null,
      };
    }
    return gated;
  }
  if (input.outcome === 'REJECT') {
    return {
      ...base,
      reviewState: 'REJECTED',
      publicationState: 'CANDIDATE',
    };
  }
  return base;
}

/**
 * Reuse #1124 candidate generation / invalidation under the current ReleaseSet
 * and Delta-scoped work items. Unchanged semantic work yields revalidation
 * receipts that do not copy old publication identities.
 *
 * Same-run candidates are retained and fed into #1124 decision contracts:
 * deterministic pairs may pass publication gates; semantic pairs require
 * controlled review authoring and are never auto-accepted as shadow.
 */
export function governResourceBindings(input: {
  capture: CaptureIdentity;
  work: readonly ResourceBindingWorkItem[];
  previousDecisions: readonly CanonicalResourceBindingDecision[];
  canonicalIndex: readonly CanonicalObjectIndexEntry[];
  resourceIndex: readonly ResourceSegmentIndexEntry[];
  generatorPromptVersion: string;
  /**
   * Optional controlled binding reviews keyed by pairId.
   * Absent reviews leave non-deterministic candidates pending (not discarded).
   */
  bindingReviews?: Readonly<Record<string, BindingReviewAuthoringEntry>>;
  /** Optional #1124 publication gate context for deterministic elevation. */
  publicationGateContext?: PublicationGateContext | null;
}): BindingGovernanceResult {
  const reviewCanonicalIds = new Set(
    input.work
      .filter((row) => row.action === 'review' && row.canonicalId)
      .map((row) => row.canonicalId as string),
  );
  const invalidateSegments = input.work
    .filter((row) => (
      row.action === 'invalidate'
      && row.resourceId
      && row.structuralUnitId
      && row.segmentId
    ))
    .map((row) => ({
      resourceId: row.resourceId as string,
      structuralUnitId: row.structuralUnitId as string,
      segmentId: row.segmentId as string,
      // Force invalidation by presenting a different hash sentinel when unknown.
      resourceSegmentHash: `invalidated:${row.pairKey}`,
    }));

  const removedCanonicalIds = new Set(
    input.work
      .filter((row) => row.action === 'invalidate' && row.canonicalId && !row.resourceId)
      .map((row) => row.canonicalId as string),
  );

  const { reusable: resourceReusable, invalidated: resourceInvalidated } =
    invalidateChangedResourcePairs(input.previousDecisions, invalidateSegments);

  const objectInvalidated: CanonicalResourceBindingDecision[] = [];
  const remaining: CanonicalResourceBindingDecision[] = [];
  for (const decision of resourceReusable) {
    if (
      removedCanonicalIds.has(decision.canonicalId)
      || reviewCanonicalIds.has(decision.canonicalId)
    ) {
      objectInvalidated.push({
        ...decision,
        lifecycleState: 'SUPERSEDED',
      });
    } else {
      remaining.push(decision);
    }
  }

  const changedObjects = input.canonicalIndex.filter((row) => (
    reviewCanonicalIds.has(row.canonicalId)
  ));
  const objectCandidates = generateCandidatesForCanonicalChanges({
    changedObjects,
    resourceIndex: input.resourceIndex,
    generatorPromptVersion: input.generatorPromptVersion,
    previousDecisions: remaining,
  });

  const changedSegments = input.resourceIndex.filter((segment) => (
    invalidateSegments.some((row) => (
      row.resourceId === segment.resourceId
      && row.structuralUnitId === segment.structuralUnitId
      && row.segmentId === segment.segmentId
    ))
  ));
  const resourceCandidates = generateCandidatesForResourceChanges({
    changedSegments,
    canonicalIndex: input.canonicalIndex,
    generatorPromptVersion: input.generatorPromptVersion,
    previousDecisions: remaining,
  });

  const revalidationReceipts: RevalidationReceipt[] = [];
  const stillReusable: CanonicalResourceBindingDecision[] = [];
  const revalidatedDecisions: CanonicalResourceBindingDecision[] = [];
  const driftInvalidated: CanonicalResourceBindingDecision[] = [];

  for (const decision of remaining) {
    const revalidateWork = input.work.find((row) => (
      row.action === 'revalidate'
      && (
        row.canonicalId === decision.canonicalId
        || row.pairKey === decision.pairId
      )
    ));
    const drift = bindingCaptureIdentityDrift(decision, input.capture);

    // Same capture identity with no revalidate work — retain as-is.
    if (!drift && !revalidateWork) {
      stillReusable.push(decision);
      continue;
    }

    const currentCanon = input.canonicalIndex.find(
      (row) => row.canonicalId === decision.canonicalId,
    );
    const currentSegment = input.resourceIndex.find((row) => (
      row.resourceId === decision.resourceId
      && row.structuralUnitId === decision.structuralUnitId
      && row.segmentId === decision.segmentId
    ));

    const currentComparable = currentCanon && currentSegment
      ? decisionSemanticComparable({
          canonicalId: decision.canonicalId,
          objectRevision: currentCanon.objectRevision,
          resourceSegmentHash: currentSegment.resourceSegmentHash,
          role: decision.role,
          generatorPromptVersion: decision.generatorPromptVersion,
          reviewerPromptVersion: decision.reviewerPromptVersion,
          evidenceDigest: decision.evidenceDigest,
          structuralGateDigest: decision.validationDigest
            ?? decision.governedValidationDigest
            ?? null,
        })
      : {
          canonicalDigest: null,
          resourceSegmentHash: null,
          role: null,
          promptReviewerVersion: null,
          evidenceDigest: null,
          structuralGateDigest: null,
        };

    const receipt = evaluateSemanticRevalidation({
      prior: priorFromDecision(decision),
      current: currentComparable,
      newReleaseSetId: input.capture.releaseSetId,
      newReleaseId: input.capture.releaseId,
      newDeltaReceiptId: input.capture.deltaReceiptId,
      captureRevision: input.capture.captureRevision,
      kind: 'binding',
    });
    revalidationReceipts.push(receipt);

    if (receipt.outcome !== 'REVALIDATED' || !currentCanon || !currentSegment) {
      // Cannot prove equivalence under current indexes — candidate-side
      // unavailable. Same-ReleaseSet prior is closed via supersession.
      if (decision.releaseSetId === input.capture.releaseSetId) {
        driftInvalidated.push({
          ...decision,
          lifecycleState: 'SUPERSEDED',
        });
      }
      continue;
    }

    const attemptSequence = decision.attemptSequence + 1;
    // Recompute the complete #1124 candidate identity under the current
    // ReleaseSet/Release/revision/segment. Never retain sealed digests from the
    // prior publication (pairId, generatorCacheKey, candidateDigest,
    // reviewerInputDigest, reviewerCacheKey).
    const candidateIdentity: CanonicalCandidateIdentity = {
      releaseSetId: input.capture.releaseSetId,
      releaseId: input.capture.releaseId,
      canonicalId: decision.canonicalId,
      objectRevision: currentCanon.objectRevision,
      resourceId: decision.resourceId,
      structuralUnitId: decision.structuralUnitId,
      segmentId: decision.segmentId,
      resourceSegmentHash: currentSegment.resourceSegmentHash,
    };
    const pairId = canonicalCandidateId(candidateIdentity);
    const generatorCacheKey = buildGeneratorCacheKey(
      candidateIdentity,
      decision.generatorPromptVersion,
    );
    const candidateDigest = canonicalSha256(candidateIdentity);
    const reviewerInputDigest = revalidationReviewerInputDigest({
      prior: decision,
      candidateIdentity,
      revalidationReceipt: receipt,
    });
    const reviewerCacheKey = buildReviewerCacheKey({
      candidateDigest,
      reviewerRole: 'INDEPENDENT_REVIEWER',
      reviewerPromptVersion: decision.reviewerPromptVersion,
      reviewerInputDigest,
    });
    const newId = decisionAttemptId({
      pairId,
      generatorPromptVersion: decision.generatorPromptVersion,
      reviewerPromptVersion: decision.reviewerPromptVersion,
      reviewerInputDigest,
      attemptSequence,
    });
    const identityChanged = (
      decision.releaseSetId !== candidateIdentity.releaseSetId
      || decision.releaseId !== candidateIdentity.releaseId
      || decision.objectRevision !== candidateIdentity.objectRevision
      || decision.resourceSegmentHash !== candidateIdentity.resourceSegmentHash
    );
    if (newId === decision.id) {
      throw new Error(
        'Aggregate governance rejected: revalidated binding must not copy prior publication identity',
      );
    }
    if (identityChanged && pairId === decision.pairId) {
      throw new Error(
        'Aggregate governance rejected: revalidated binding pairId must follow current candidate identity',
      );
    }
    if (identityChanged && generatorCacheKey === decision.generatorCacheKey) {
      throw new Error(
        'Aggregate governance rejected: revalidated binding generatorCacheKey must follow current candidate identity',
      );
    }
    if (identityChanged && candidateDigest === decision.candidateDigest) {
      throw new Error(
        'Aggregate governance rejected: revalidated binding candidateDigest must follow current candidate identity',
      );
    }
    if (reviewerInputDigest === decision.reviewerInputDigest) {
      throw new Error(
        'Aggregate governance rejected: revalidated binding must seal a new reviewer/revalidation digest',
      );
    }
    if (reviewerCacheKey === decision.reviewerCacheKey) {
      throw new Error(
        'Aggregate governance rejected: revalidated binding must seal a new reviewerCacheKey',
      );
    }

    const sameReleaseSet = decision.releaseSetId === input.capture.releaseSetId;
    let reissued: CanonicalResourceBindingDecision = {
      ...decision,
      id: newId,
      pairId,
      releaseSetId: candidateIdentity.releaseSetId,
      releaseId: candidateIdentity.releaseId,
      canonicalId: candidateIdentity.canonicalId,
      objectRevision: candidateIdentity.objectRevision,
      resourceId: candidateIdentity.resourceId,
      structuralUnitId: candidateIdentity.structuralUnitId,
      segmentId: candidateIdentity.segmentId,
      resourceSegmentHash: candidateIdentity.resourceSegmentHash,
      generatorCacheKey,
      candidateDigest,
      reviewerInputDigest,
      reviewerCacheKey,
      inventoryRunId: input.capture.inventoryRunId,
      captureRevision: input.capture.captureRevision,
      attemptSequence,
      lifecycleState: 'CURRENT',
      supersedesDecisionId: sameReleaseSet ? decision.id : null,
      governedInventoryRunId: decision.governedInventoryRunId
        ? input.capture.inventoryRunId
        : null,
      governedCaptureRevision: decision.governedCaptureRevision
        ? input.capture.captureRevision
        : null,
    };

    // SHADOW_PUBLISHED only survives when the same-run publication gate still
    // admits the reissued decision under the candidate capture.
    if (decision.publicationState === 'SHADOW_PUBLISHED') {
      if (!input.publicationGateContext) {
        if (sameReleaseSet) {
          driftInvalidated.push({
            ...decision,
            lifecycleState: 'SUPERSEDED',
          });
        }
        continue;
      }

      // Resolve the unique current VALIDATED crosswalk/evidence from the
      // same-run gate context. Prior rows often have evidenceId=null after the
      // #1126 governed path cleared the legacy tuple — never pass null evidence
      // into applyPublicationGates.
      const gateMatches = input.publicationGateContext.crosswalks.filter((row) => (
        row.releaseId === reissued.releaseId
        && row.canonicalId === reissued.canonicalId
        && row.resourceId === reissued.resourceId
        && row.structuralUnitId === reissued.structuralUnitId
        && row.segmentId === reissued.segmentId
        && row.resourceSegmentHash === reissued.resourceSegmentHash
        && row.inventoryRunId === input.publicationGateContext!.captureIdentity.inventoryRunId
        && row.captureRevision === input.publicationGateContext!.captureIdentity.captureRevision
        && row.structuralUnitVersion
          === input.publicationGateContext!.captureIdentity.structuralUnitVersion
        && row.validationState === 'VALIDATED'
      ));
      if (gateMatches.length !== 1) {
        if (sameReleaseSet) {
          driftInvalidated.push({
            ...decision,
            lifecycleState: 'SUPERSEDED',
          });
        }
        continue;
      }
      const gateCrosswalk = gateMatches[0]!;
      const reviewStateForGate = (
        decision.reviewState === 'ACCEPTED' || decision.reviewState === 'NOT_REQUIRED'
      )
        ? decision.reviewState
        : 'ACCEPTED';
      const gated = applyPublicationGates(
        {
          ...reissued,
          publicationState: 'CANDIDATE',
          reviewState: reviewStateForGate,
          evidenceId: gateCrosswalk.evidenceId,
          // Leave legacy tuple null; gate fills crosswalk identity from match.
          crosswalkId: null,
          inventoryRunId: null,
          captureRevision: null,
          structuralUnitVersion: null,
          validationDigest: null,
        },
        input.publicationGateContext,
      );
      if (gated.publicationState !== 'SHADOW_PUBLISHED') {
        if (sameReleaseSet) {
          driftInvalidated.push({
            ...decision,
            lifecycleState: 'SUPERSEDED',
          });
        }
        continue;
      }
      reissued = {
        ...reissued,
        publicationState: 'SHADOW_PUBLISHED',
        reviewState: gated.reviewState,
        evidenceId: null,
        // #1126 governed path only — clear legacy EvidenceStructuralUnit tuple.
        governedCrosswalkId: gated.crosswalkId,
        governedInventoryRunId: gated.inventoryRunId,
        governedCaptureRevision: gated.captureRevision,
        governedStructuralUnitVersion: gated.structuralUnitVersion,
        governedValidationDigest: gated.validationDigest,
        crosswalkId: null,
        inventoryRunId: null,
        captureRevision: null,
        structuralUnitVersion: null,
        validationDigest: null,
      };
    }

    // Persistable decision under candidate capture (new immutable id).
    revalidatedDecisions.push(reissued);
    if (sameReleaseSet) {
      // Predecessor will be SUPERSEDED via supersedesDecisionId path.
      // Do not also list as invalidated (avoid double tombstone).
    }
  }

  const invalidated = [
    ...resourceInvalidated.map((row) => ({ ...row, lifecycleState: 'SUPERSEDED' as const })),
    ...objectInvalidated,
    ...driftInvalidated,
  ];

  const candidateByPair = new Map<string, CanonicalResourceBindingCandidate>();
  for (const row of [
    ...objectCandidates.candidates,
    ...resourceCandidates.candidates,
  ]) {
    candidateByPair.set(row.pairId, row);
  }
  const candidates = [...candidateByPair.values()]
    .sort((left, right) => left.pairId.localeCompare(right.pairId));

  const decisions: CanonicalResourceBindingDecision[] = [...revalidatedDecisions];
  const pendingReviewCandidates: CanonicalResourceBindingCandidate[] = [];
  const bindingReviews = input.bindingReviews ?? {};

  for (const candidate of candidates) {
    const controlled = bindingReviews[candidate.pairId];
    if (
      candidate.proposedRole
      && candidate.evidenceIds.length === 1
      && input.publicationGateContext
    ) {
      decisions.push(buildDeterministicDecision({
        candidate,
        evidenceDigest: sha256Canonical({
          pairId: candidate.pairId,
          role: candidate.proposedRole,
          evidenceIds: candidate.evidenceIds,
        }),
        context: input.publicationGateContext,
      }));
      continue;
    }
    if (controlled) {
      decisions.push(stageSemanticBindingDecision({
        candidate,
        role: controlled.proposedRole,
        evidenceDigest: controlled.evidenceDigest,
        evidenceIds: controlled.evidenceIds ?? candidate.evidenceIds,
        reviewerPromptVersion: controlled.reviewerPromptVersion,
        outcome: controlled.outcome,
        reviewIdentity: controlled.reviewIdentity,
        rationale: controlled.rationale,
        reviewProvider: controlled.reviewProvider,
        publicationGateContext: input.publicationGateContext,
      }));
      continue;
    }
    // Retain for #1124 reviewer queue — do not invent teaching roles.
    pendingReviewCandidates.push(candidate);
  }

  const reusedDecisionIds = [...new Set([
    ...objectCandidates.reusedDecisionIds,
    ...resourceCandidates.reusedDecisionIds,
  ])].sort();

  // Readiness only counts CURRENT SHADOW_PUBLISHED under the candidate capture.
  const shadowFromReusable = stillReusable.filter((row) => (
    row.publicationState === 'SHADOW_PUBLISHED'
    && row.lifecycleState === 'CURRENT'
    && row.releaseSetId === input.capture.releaseSetId
    && row.releaseId === input.capture.releaseId
  )).length;
  const shadowFromDecisions = decisions.filter((row) => (
    row.publicationState === 'SHADOW_PUBLISHED'
    && row.lifecycleState === 'CURRENT'
    && row.releaseSetId === input.capture.releaseSetId
    && row.releaseId === input.capture.releaseId
  )).length;

  return {
    candidates,
    candidatesGenerated: candidates.length,
    decisions,
    pendingReviewCandidates,
    reusedDecisionIds,
    invalidated,
    reusable: stillReusable,
    revalidationReceipts,
    shadowPublishedCount: shadowFromReusable + shadowFromDecisions,
  };
}

/** Build #1124 publication gate context from same-run validated ACT Crosswalks. */
export function buildBindingPublicationGateContext(input: {
  capture: CaptureIdentity;
  canonicalIndex: readonly CanonicalObjectIndexEntry[];
  /** Same-run VALIDATED ActGoverned structural-unit crosswalks. */
  validatedCrosswalks: ReadonlyArray<{
    id: string;
    releaseId: string;
    canonicalId: string | null;
    resourceId: string | null;
    structuralUnitId: string | null;
    structuralUnitVersion: string | null;
    structuralUnitHash: string | null;
    segmentId: string | null;
    resourceSegmentHash: string | null;
    inventoryRunId: string | null;
    atomicResourceId: string | null;
    captureRevision: string;
    validationDigest: string | null;
    sourceEditionId?: string | null;
    sourceVersion?: string | null;
    evidenceContentHash?: string | null;
  }>;
  existingPublished?: readonly CanonicalResourceBindingDecision[];
}): PublicationGateContext {
  const crosswalks: EvidenceStructuralUnitCrosswalk[] = [];
  const evidenceAlignments: PublicationGateContext['evidenceAlignments'] = [];
  for (const row of input.validatedCrosswalks) {
    if (
      !row.canonicalId
      || !row.resourceId
      || !row.structuralUnitId
      || !row.structuralUnitVersion
      || !row.structuralUnitHash
      || !row.segmentId
      || !row.resourceSegmentHash
      || !row.inventoryRunId
      || !row.atomicResourceId
      || !row.validationDigest
      || !row.sourceEditionId
      || !row.sourceVersion
    ) {
      continue;
    }
    const evidenceId = row.atomicResourceId;
    crosswalks.push({
      id: row.id,
      releaseId: row.releaseId,
      evidenceId,
      sourceEditionId: row.sourceEditionId,
      sourceVersion: row.sourceVersion,
      evidenceContentHash: row.evidenceContentHash ?? row.structuralUnitHash,
      structuralUnitId: row.structuralUnitId,
      structuralUnitVersion: row.structuralUnitVersion,
      structuralUnitHash: row.structuralUnitHash,
      inventoryRunId: row.inventoryRunId,
      atomicResourceId: row.atomicResourceId,
      resourceId: row.resourceId,
      segmentId: row.segmentId,
      resourceSegmentHash: row.resourceSegmentHash,
      captureRevision: row.captureRevision,
      canonicalId: row.canonicalId,
      validationState: 'VALIDATED',
      validationDigest: row.validationDigest,
    });
    evidenceAlignments.push({
      releaseId: row.releaseId,
      evidenceId,
      canonicalId: row.canonicalId,
    });
  }
  // structuralUnitVersion must be the per-crosswalk unit version (inventory
  // capture revision for index-built rows), NOT structuralUnitIndexVersion digest.
  const versions = new Set(
    crosswalks.map((row) => row.structuralUnitVersion).filter(Boolean),
  );
  if (versions.size > 1) {
    throw new Error(
      `Aggregate governance rejected: incompatible structuralUnitVersion set in same-run validated Crosswalks (${[...versions].sort().join(',')})`,
    );
  }
  const structuralUnitVersion = versions.size === 1 ? [...versions][0]! : '';
  const inventoryRuns = new Set(
    crosswalks.map((row) => row.inventoryRunId).filter(Boolean),
  );
  if (inventoryRuns.size > 1) {
    throw new Error(
      `Aggregate governance rejected: incompatible inventoryRunId set in same-run validated Crosswalks`,
    );
  }
  if (
    input.capture.inventoryRunId
    && inventoryRuns.size === 1
    && ![...inventoryRuns][0]
  ) {
    // unreachable
  }
  if (
    input.capture.inventoryRunId
    && inventoryRuns.size === 1
    && [...inventoryRuns][0] !== input.capture.inventoryRunId
  ) {
    throw new Error(
      'Aggregate governance rejected: validated Crosswalk inventoryRunId drifts from capture',
    );
  }

  return {
    captureIdentity: {
      inventoryRunId: input.capture.inventoryRunId
        ?? (inventoryRuns.size === 1 ? [...inventoryRuns][0]! : ''),
      captureRevision: input.capture.captureRevision,
      structuralUnitVersion,
    },
    canonicalObjects: [...input.canonicalIndex],
    crosswalks,
    evidenceAlignments,
    existingPublished: [...(input.existingPublished ?? [])],
  };
}

export function assertFormalSelectorsRemainLegacy(input: {
  selectAuthority: (consumer: 'FORMAL_RECOMMENDATION' | 'FORMAL_PATH' | 'FORMAL_EVIDENCE' | 'SHADOW_AUDIT') => {
    authority: string;
    canonicalBindingsVisible: boolean;
  };
}): true {
  for (const consumer of [
    'FORMAL_RECOMMENDATION',
    'FORMAL_PATH',
    'FORMAL_EVIDENCE',
  ] as const) {
    const selected = input.selectAuthority(consumer);
    if (selected.authority !== 'LEGACY' || selected.canonicalBindingsVisible !== false) {
      throw new Error(`Production selector drifted for ${consumer}`);
    }
  }
  const shadow = input.selectAuthority('SHADOW_AUDIT');
  if (shadow.authority !== 'CANONICAL_SHADOW' || shadow.canonicalBindingsVisible !== true) {
    throw new Error('Shadow audit selector must expose Canonical bindings');
  }
  return true;
}
