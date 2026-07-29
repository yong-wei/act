import {
  generateCandidatesForCanonicalChanges,
  generateCandidatesForResourceChanges,
  invalidateChangedResourcePairs,
  type CanonicalObjectIndexEntry,
  type CanonicalResourceBindingDecision,
  type ResourceSegmentIndexEntry,
} from '@/lib/canonical-resource-binding';

import type { CaptureIdentity, ResourceBindingWorkItem } from './contracts';
import {
  evaluateSemanticRevalidation,
  type RevalidationComparable,
} from './revalidation';
import type { PriorSemanticDecision, RevalidationReceipt } from './contracts';
import { sha256Canonical } from './hash';

export interface BindingGovernanceResult {
  candidatesGenerated: number;
  reusedDecisionIds: string[];
  invalidated: CanonicalResourceBindingDecision[];
  reusable: CanonicalResourceBindingDecision[];
  revalidationReceipts: RevalidationReceipt[];
  shadowPublishedCount: number;
}

function decisionComparable(
  decision: CanonicalResourceBindingDecision,
): RevalidationComparable {
  return {
    canonicalDigest: sha256Canonical({
      releaseSetId: decision.releaseSetId,
      releaseId: decision.releaseId,
      canonicalId: decision.canonicalId,
      objectRevision: decision.objectRevision,
    }),
    resourceSegmentHash: decision.resourceSegmentHash,
    role: decision.role,
    promptReviewerVersion: `${decision.generatorPromptVersion}|${decision.reviewerPromptVersion}`,
    evidenceDigest: decision.evidenceDigest,
    structuralGateDigest: decision.validationDigest,
  };
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

/**
 * Reuse #1124 candidate generation / invalidation under the current ReleaseSet
 * and Delta-scoped work items. Unchanged semantic work yields revalidation
 * receipts that do not copy old publication identities.
 */
export function governResourceBindings(input: {
  capture: CaptureIdentity;
  work: readonly ResourceBindingWorkItem[];
  previousDecisions: readonly CanonicalResourceBindingDecision[];
  canonicalIndex: readonly CanonicalObjectIndexEntry[];
  resourceIndex: readonly ResourceSegmentIndexEntry[];
  generatorPromptVersion: string;
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
  for (const decision of remaining) {
    const work = input.work.find((row) => (
      row.action === 'revalidate'
      && (
        row.canonicalId === decision.canonicalId
        || row.pairKey === decision.pairId
      )
    ));
    if (!work) {
      stillReusable.push(decision);
      continue;
    }
    const receipt = evaluateSemanticRevalidation({
      prior: priorFromDecision(decision),
      current: decisionComparable(decision),
      newReleaseSetId: input.capture.releaseSetId,
      newReleaseId: input.capture.releaseId,
      newDeltaReceiptId: input.capture.deltaReceiptId,
      captureRevision: input.capture.captureRevision,
      kind: 'binding',
    });
    revalidationReceipts.push(receipt);
    if (receipt.outcome === 'REVALIDATED') {
      // Keep historical record; revalidation does not copy publication id.
      stillReusable.push({
        ...decision,
        // Endpoint identity moves to the new ReleaseSet without reusing id.
        releaseSetId: input.capture.releaseSetId,
        releaseId: input.capture.releaseId,
        captureRevision: input.capture.captureRevision,
        inventoryRunId: input.capture.inventoryRunId,
      });
    }
  }

  const invalidated = [
    ...resourceInvalidated.map((row) => ({ ...row, lifecycleState: 'SUPERSEDED' as const })),
    ...objectInvalidated,
  ];
  const candidateCount = new Set([
    ...objectCandidates.candidates.map((row) => row.pairId),
    ...resourceCandidates.candidates.map((row) => row.pairId),
  ]).size;
  const reusedDecisionIds = [...new Set([
    ...objectCandidates.reusedDecisionIds,
    ...resourceCandidates.reusedDecisionIds,
  ])].sort();

  return {
    candidatesGenerated: candidateCount,
    reusedDecisionIds,
    invalidated,
    reusable: stillReusable,
    revalidationReceipts,
    shadowPublishedCount: stillReusable.filter(
      (row) => row.publicationState === 'SHADOW_PUBLISHED',
    ).length,
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
