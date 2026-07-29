import type {
  ActStructuralUnitCrosswalkRecord,
  CaptureIdentity,
  DeterministicAlignmentInput,
  OpaqueUpstreamRagReference,
  SemanticAlignmentCandidate,
  SemanticAlignmentReview,
  StructuralUnitIndexEntry,
} from './contracts';
import { sha256Canonical, tripleKey } from './hash';

/**
 * Upstream triples are opaque positioning inputs. Governance references them
 * without rewriting authority data or assigning teaching roles.
 */
export function referenceOpaqueUpstream(
  upstream: OpaqueUpstreamRagReference,
): OpaqueUpstreamRagReference {
  return {
    publishedEntityId: upstream.publishedEntityId,
    retrievalChunkId: upstream.retrievalChunkId,
    citationTargetId: upstream.citationTargetId,
  };
}

export function crosswalkIdFor(input: {
  releaseSetId: string;
  releaseId: string;
  deltaReceiptId: string;
  upstream: OpaqueUpstreamRagReference;
  canonicalId: string | null;
  captureRevision: string;
}): string {
  return `act-xwalk:${sha256Canonical({
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    deltaReceiptId: input.deltaReceiptId,
    upstream: referenceOpaqueUpstream(input.upstream),
    canonicalId: input.canonicalId,
    captureRevision: input.captureRevision,
  })}`;
}

function matchingIndexEntries(
  index: readonly StructuralUnitIndexEntry[],
  stableIds: readonly string[],
  contentHashes: readonly string[],
): StructuralUnitIndexEntry[] {
  const idSet = new Set(stableIds.filter(Boolean));
  const hashSet = new Set(contentHashes.filter(Boolean));
  return index.filter((entry) => {
    const idHit = entry.stableIds.some((id) => idSet.has(id));
    const hashHit = entry.contentHashes.some((hash) => hashSet.has(hash));
    return idHit || hashHit;
  });
}

function completeTuple(entry: StructuralUnitIndexEntry, capture: CaptureIdentity): boolean {
  return Boolean(
    entry.sourceEditionId
    && entry.sourceVersion
    && entry.structuralUnitId
    && entry.structuralUnitVersion
    && entry.structuralUnitHash
    && entry.atomicResourceId
    && entry.resourceId
    && entry.segmentId
    && entry.resourceSegmentHash
    && capture.inventoryRunId
    && capture.captureRevision,
  );
}

function unresolvedRecord(input: {
  baseId: string;
  capture: CaptureIdentity;
  upstream: OpaqueUpstreamRagReference;
  canonicalId: string | null;
  validationState?: ActStructuralUnitCrosswalkRecord['validationState'];
  reviewIdentity?: string | null;
  evidenceDigest?: string | null;
}): ActStructuralUnitCrosswalkRecord {
  return {
    id: input.baseId,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    publishedEntityId: input.upstream.publishedEntityId,
    retrievalChunkId: input.upstream.retrievalChunkId,
    citationTargetId: input.upstream.citationTargetId,
    canonicalId: input.canonicalId,
    sourceEditionId: null,
    sourceVersion: null,
    structuralUnitId: null,
    structuralUnitVersion: null,
    structuralUnitHash: null,
    evidenceContentHash: null,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: null,
    resourceId: null,
    segmentId: null,
    resourceSegmentHash: null,
    captureRevision: input.capture.captureRevision,
    resolutionState: 'UNRESOLVED',
    validationState: input.validationState ?? 'UNRESOLVED',
    validationDigest: null,
    reviewIdentity: input.reviewIdentity ?? null,
    evidenceDigest: input.evidenceDigest ?? null,
    lifecycleState: 'CURRENT',
  };
}

/**
 * Deterministic alignment requires unique stable-ID/hash match against one
 * versioned ACT structural-unit index entry and the complete
 * edition/unit/version/hash/inventory/resource/segment tuple.
 */
export function attemptDeterministicAlignment(
  input: DeterministicAlignmentInput,
): ActStructuralUnitCrosswalkRecord {
  // Observed capture for deterministic work is the caller's capture identity
  // already verified at pipeline entry. Re-check shape only.
  if (!input.capture.inventoryRunId || !input.capture.captureRevision) {
    throw new Error(
      'Deterministic alignment rejected: inventoryRunId and captureRevision required',
    );
  }
  const upstream = referenceOpaqueUpstream(input.upstream);
  const baseId = crosswalkIdFor({
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    upstream,
    canonicalId: input.canonicalId,
    captureRevision: input.capture.captureRevision,
  });

  // Relation-type / non-object upstream cannot become VALIDATED Canonical Crosswalks.
  if (!input.canonicalId) {
    return unresolvedRecord({
      baseId,
      capture: input.capture,
      upstream,
      canonicalId: null,
    });
  }

  const matches = matchingIndexEntries(
    input.index,
    input.stableIds ?? [],
    input.contentHashes ?? [],
  ).filter((entry) => completeTuple(entry, input.capture));

  if (matches.length !== 1) {
    return unresolvedRecord({
      baseId,
      capture: input.capture,
      upstream,
      canonicalId: input.canonicalId,
    });
  }

  const match = matches[0]!;
  const validationDigest = sha256Canonical({
    upstream,
    canonicalId: input.canonicalId,
    sourceEditionId: match.sourceEditionId,
    sourceVersion: match.sourceVersion,
    structuralUnitId: match.structuralUnitId,
    structuralUnitVersion: match.structuralUnitVersion,
    structuralUnitHash: match.structuralUnitHash,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: match.atomicResourceId,
    resourceId: match.resourceId,
    segmentId: match.segmentId,
    resourceSegmentHash: match.resourceSegmentHash,
    captureRevision: input.capture.captureRevision,
    releaseSetId: input.capture.releaseSetId,
    deltaReceiptId: input.capture.deltaReceiptId,
  });

  return {
    id: baseId,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    publishedEntityId: upstream.publishedEntityId,
    retrievalChunkId: upstream.retrievalChunkId,
    citationTargetId: upstream.citationTargetId,
    canonicalId: input.canonicalId,
    sourceEditionId: match.sourceEditionId,
    sourceVersion: match.sourceVersion,
    structuralUnitId: match.structuralUnitId,
    structuralUnitVersion: match.structuralUnitVersion,
    structuralUnitHash: match.structuralUnitHash,
    evidenceContentHash: match.contentHashes[0] ?? match.structuralUnitHash,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: match.atomicResourceId,
    resourceId: match.resourceId,
    segmentId: match.segmentId,
    resourceSegmentHash: match.resourceSegmentHash,
    captureRevision: input.capture.captureRevision,
    resolutionState: 'DETERMINISTIC',
    validationState: 'VALIDATED',
    validationDigest,
    reviewIdentity: null,
    evidenceDigest: validationDigest,
    lifecycleState: 'CURRENT',
  };
}

/**
 * Generate semantic candidates from Canonical identity against one structural
 * index. Does not publish; acceptance requires isolated review.
 */
export function generateSemanticAlignmentCandidates(input: {
  upstream: OpaqueUpstreamRagReference;
  canonicalId: string;
  canonicalProfileDigest: string;
  index: readonly StructuralUnitIndexEntry[];
  generatorPromptVersion: string;
  maxCandidates?: number;
}): SemanticAlignmentCandidate[] {
  if (input.index.length === 0) return [];
  const limit = input.maxCandidates ?? 5;
  // Deterministic ranking by structural unit id to keep fixtures stable.
  return [...input.index]
    .filter((entry) => (
      entry.sourceEditionId
      && entry.sourceVersion
      && entry.structuralUnitId
      && entry.structuralUnitVersion
      && entry.structuralUnitHash
    ))
    .sort((a, b) => a.structuralUnitId.localeCompare(b.structuralUnitId))
    .slice(0, limit)
    .map((entry) => ({
      candidateId: sha256Canonical({
        upstream: referenceOpaqueUpstream(input.upstream),
        canonicalId: input.canonicalId,
        structuralUnitId: entry.structuralUnitId,
        structuralUnitVersion: entry.structuralUnitVersion,
        generatorPromptVersion: input.generatorPromptVersion,
      }),
      upstream: referenceOpaqueUpstream(input.upstream),
      canonicalId: input.canonicalId,
      structuralUnitId: entry.structuralUnitId,
      structuralUnitVersion: entry.structuralUnitVersion,
      structuralUnitHash: entry.structuralUnitHash,
      sourceEditionId: entry.sourceEditionId,
      sourceVersion: entry.sourceVersion,
      rationale: `profile:${input.canonicalProfileDigest.slice(0, 12)}`,
      generatorPromptVersion: input.generatorPromptVersion,
    }));
}

export function acceptSemanticAlignment(input: {
  candidate: SemanticAlignmentCandidate;
  review: SemanticAlignmentReview;
  capture: CaptureIdentity;
  inventoryAtomic?: {
    atomicResourceId: string | null;
    resourceId: string | null;
    segmentId: string | null;
    resourceSegmentHash: string | null;
  };
}): ActStructuralUnitCrosswalkRecord {
  const upstream = referenceOpaqueUpstream(input.candidate.upstream);
  const baseId = crosswalkIdFor({
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    upstream,
    canonicalId: input.candidate.canonicalId,
    captureRevision: input.capture.captureRevision,
  });

  if (
    input.review.outcome !== 'ACCEPT'
    || !input.review.reviewIdentity
    || !input.review.evidenceDigest
  ) {
    return unresolvedRecord({
      baseId,
      capture: input.capture,
      upstream,
      canonicalId: input.candidate.canonicalId,
      validationState: input.review.outcome === 'REJECT' ? 'REJECTED' : 'UNRESOLVED',
      reviewIdentity: input.review.reviewIdentity,
      evidenceDigest: input.review.evidenceDigest,
    });
  }

  // Explicit evidence-bearing isolated review is required for semantic accept.
  // Still need the complete inventory/resource tuple for publication gates.
  const atomic = input.inventoryAtomic;
  if (
    !atomic?.atomicResourceId
    || !atomic.resourceId
    || !atomic.segmentId
    || !atomic.resourceSegmentHash
    || !input.capture.inventoryRunId
  ) {
    return unresolvedRecord({
      baseId,
      capture: input.capture,
      upstream,
      canonicalId: input.candidate.canonicalId,
      validationState: 'UNRESOLVED',
      reviewIdentity: input.review.reviewIdentity,
      evidenceDigest: input.review.evidenceDigest,
    });
  }

  const validationDigest = sha256Canonical({
    upstream,
    canonicalId: input.candidate.canonicalId,
    structuralUnitId: input.candidate.structuralUnitId,
    structuralUnitVersion: input.candidate.structuralUnitVersion,
    structuralUnitHash: input.candidate.structuralUnitHash,
    reviewIdentity: input.review.reviewIdentity,
    evidenceDigest: input.review.evidenceDigest,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: atomic.atomicResourceId,
    resourceId: atomic.resourceId,
    segmentId: atomic.segmentId,
    resourceSegmentHash: atomic.resourceSegmentHash,
    captureRevision: input.capture.captureRevision,
    deltaReceiptId: input.capture.deltaReceiptId,
  });

  return {
    id: baseId,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    publishedEntityId: upstream.publishedEntityId,
    retrievalChunkId: upstream.retrievalChunkId,
    citationTargetId: upstream.citationTargetId,
    canonicalId: input.candidate.canonicalId,
    sourceEditionId: input.candidate.sourceEditionId,
    sourceVersion: input.candidate.sourceVersion,
    structuralUnitId: input.candidate.structuralUnitId,
    structuralUnitVersion: input.candidate.structuralUnitVersion,
    structuralUnitHash: input.candidate.structuralUnitHash,
    evidenceContentHash: input.candidate.structuralUnitHash,
    inventoryRunId: input.capture.inventoryRunId,
    atomicResourceId: atomic.atomicResourceId,
    resourceId: atomic.resourceId,
    segmentId: atomic.segmentId,
    resourceSegmentHash: atomic.resourceSegmentHash,
    captureRevision: input.capture.captureRevision,
    resolutionState: 'SEMANTIC',
    validationState: 'VALIDATED',
    validationDigest,
    reviewIdentity: input.review.reviewIdentity,
    evidenceDigest: input.review.evidenceDigest,
    lifecycleState: 'CURRENT',
  };
}

/**
 * Re-run endpoint/version/hash/uniqueness/ReleaseSet/Delta/capture gates.
 */
export function validateCrosswalkForShadowPublication(input: {
  crosswalk: ActStructuralUnitCrosswalkRecord;
  capture: CaptureIdentity;
  existingCurrent: readonly ActStructuralUnitCrosswalkRecord[];
}): { ok: true; crosswalk: ActStructuralUnitCrosswalkRecord } | { ok: false; reason: string } {
  const row = input.crosswalk;
  if (row.validationState !== 'VALIDATED') {
    return { ok: false, reason: 'not-validated' };
  }
  if (!row.canonicalId) {
    return { ok: false, reason: 'missing-canonical-object' };
  }
  if (
    !row.structuralUnitId
    || !row.structuralUnitVersion
    || !row.structuralUnitHash
    || !row.sourceEditionId
    || !row.sourceVersion
    || !row.validationDigest
    || !row.inventoryRunId
    || !row.atomicResourceId
    || !row.resourceId
    || !row.segmentId
    || !row.resourceSegmentHash
  ) {
    return { ok: false, reason: 'missing-structural-or-inventory-identity' };
  }
  if (
    row.releaseSetId !== input.capture.releaseSetId
    || row.releaseId !== input.capture.releaseId
    || row.deltaReceiptId !== input.capture.deltaReceiptId
    || row.captureRevision !== input.capture.captureRevision
  ) {
    return { ok: false, reason: 'capture-or-release-drift' };
  }
  if (
    input.capture.inventoryRunId != null
    && row.inventoryRunId !== input.capture.inventoryRunId
  ) {
    return { ok: false, reason: 'inventory-run-drift' };
  }
  const duplicates = input.existingCurrent.filter((other) => (
    other.id !== row.id
    && other.lifecycleState === 'CURRENT'
    && other.validationState === 'VALIDATED'
    && other.publishedEntityId === row.publishedEntityId
    && other.retrievalChunkId === row.retrievalChunkId
    && other.citationTargetId === row.citationTargetId
    && other.canonicalId === row.canonicalId
  ));
  if (duplicates.length > 0) {
    return { ok: false, reason: 'non-unique-crosswalk' };
  }
  return { ok: true, crosswalk: row };
}

export function invalidateCrosswalks(input: {
  current: readonly ActStructuralUnitCrosswalkRecord[];
  removedObjectIds?: readonly string[];
  removedTripleKeys?: readonly string[];
  changedStructuralUnitIds?: readonly string[];
}): {
  retained: ActStructuralUnitCrosswalkRecord[];
  invalidated: ActStructuralUnitCrosswalkRecord[];
} {
  const removedObjects = new Set(input.removedObjectIds ?? []);
  const removedTriples = new Set(input.removedTripleKeys ?? []);
  const changedUnits = new Set(input.changedStructuralUnitIds ?? []);
  const retained: ActStructuralUnitCrosswalkRecord[] = [];
  const invalidated: ActStructuralUnitCrosswalkRecord[] = [];
  for (const row of input.current) {
    const key = tripleKey(row);
    const hit = (row.canonicalId != null && removedObjects.has(row.canonicalId))
      || removedTriples.has(key)
      || (row.structuralUnitId != null && changedUnits.has(row.structuralUnitId));
    if (hit) {
      invalidated.push({
        ...row,
        lifecycleState: 'STALE',
        resolutionState: 'STALE',
        validationState: 'STALE',
      });
    } else {
      retained.push(row);
    }
  }
  return { retained, invalidated };
}
