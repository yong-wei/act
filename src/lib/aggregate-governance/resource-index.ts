/**
 * Build #1124 resource segment index reverse map from validated ACT Crosswalks.
 * Without validated endpoints, candidateCanonicalIds stay empty (blocked binding).
 */
export function buildResourceIndexFromValidatedCrosswalks(input: {
  inventoryItems: ReadonlyArray<{
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
  }>;
  validatedCrosswalks: ReadonlyArray<{
    resourceId: string | null;
    structuralUnitId: string | null;
    segmentId: string | null;
    canonicalId: string | null;
    validationState: string;
    lifecycleState: string;
  }>;
}): Array<{
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  resourceSegmentHash: string;
  candidateCanonicalIds: string[];
  deterministicRole: null;
  evidenceIds: string[];
}> {
  const reverse = new Map<string, Set<string>>();
  for (const row of input.validatedCrosswalks) {
    if (row.validationState !== 'VALIDATED' || row.lifecycleState !== 'CURRENT') continue;
    if (!row.canonicalId) continue;
    if (!row.resourceId || !row.structuralUnitId || !row.segmentId) continue;
    const key = `${row.resourceId}\u001f${row.structuralUnitId}\u001f${row.segmentId}`;
    const set = reverse.get(key) ?? new Set<string>();
    set.add(row.canonicalId);
    reverse.set(key, set);
  }
  return input.inventoryItems.map((item) => {
    const key = `${item.resourceId}\u001f${item.structuralUnitId}\u001f${item.segmentId}`;
    return {
      resourceId: item.resourceId,
      structuralUnitId: item.structuralUnitId,
      segmentId: item.segmentId,
      resourceSegmentHash: item.resourceSegmentHash,
      candidateCanonicalIds: [...(reverse.get(key) ?? [])].sort(),
      deterministicRole: null,
      evidenceIds: [],
    };
  });
}

export interface DerivedChangedResourceSegment {
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  /**
   * Current segment hash when the endpoint still exists; prior hash when the
   * endpoint was removed (invalidation-only — no fabricated candidate).
   */
  resourceSegmentHash: string;
  /**
   * Canonical ids for resource-side candidate regeneration. Populated only for
   * currently present segments (from current index reverse map and/or CURRENT
   * prior bindings on that endpoint). Empty for removals so work-manifest does
   * not invent object-wide review.
   */
  candidateCanonicalIds: string[];
  /** True when the prior-bound endpoint is absent from the current index. */
  removed: boolean;
}

function segmentEndpointKey(input: {
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
}): string {
  return `${input.resourceId}\u001f${input.structuralUnitId}\u001f${input.segmentId}`;
}

/**
 * Derive resource-side segment changes for production aggregate governance.
 *
 * Compares previous CURRENT binding decision endpoints against the current
 * versioned resource index:
 * - same endpoint, different hash → changed current segment (candidates allowed)
 * - previously bound endpoint absent → removal / invalidation only
 * - same endpoint and hash → no resource-change work
 *
 * Deduplicated and sorted deterministically. Exported pure helper so production
 * runner wiring and tests share one implementation (no copied expressions).
 */
export function deriveChangedResourceSegments(input: {
  previousDecisions: ReadonlyArray<{
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    canonicalId: string;
    lifecycleState?: string | null;
  }>;
  currentResourceIndex: ReadonlyArray<{
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    candidateCanonicalIds?: readonly string[];
  }>;
}): DerivedChangedResourceSegment[] {
  const currentByEndpoint = new Map<string, {
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    candidateCanonicalIds: Set<string>;
  }>();
  for (const row of input.currentResourceIndex) {
    const key = segmentEndpointKey(row);
    const existing = currentByEndpoint.get(key);
    if (existing) {
      if (existing.resourceSegmentHash !== row.resourceSegmentHash) {
        throw new Error(
          `Aggregate governance rejected: ambiguous current resource segment hash for ${key}`,
        );
      }
      for (const canonicalId of row.candidateCanonicalIds ?? []) {
        existing.candidateCanonicalIds.add(canonicalId);
      }
      continue;
    }
    currentByEndpoint.set(key, {
      resourceId: row.resourceId,
      structuralUnitId: row.structuralUnitId,
      segmentId: row.segmentId,
      resourceSegmentHash: row.resourceSegmentHash,
      candidateCanonicalIds: new Set(row.candidateCanonicalIds ?? []),
    });
  }

  type PriorEndpoint = {
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    boundCanonicalIds: Set<string>;
  };
  const priorByEndpoint = new Map<string, PriorEndpoint>();
  for (const decision of input.previousDecisions) {
    if (decision.lifecycleState != null && decision.lifecycleState !== 'CURRENT') {
      continue;
    }
    if (
      !decision.resourceId
      || !decision.structuralUnitId
      || !decision.segmentId
      || !decision.resourceSegmentHash
    ) {
      continue;
    }
    const key = segmentEndpointKey(decision);
    const existing = priorByEndpoint.get(key);
    if (existing) {
      if (existing.resourceSegmentHash !== decision.resourceSegmentHash) {
        throw new Error(
          `Aggregate governance rejected: ambiguous prior binding segment hash for ${key}`,
        );
      }
      existing.boundCanonicalIds.add(decision.canonicalId);
      continue;
    }
    priorByEndpoint.set(key, {
      resourceId: decision.resourceId,
      structuralUnitId: decision.structuralUnitId,
      segmentId: decision.segmentId,
      resourceSegmentHash: decision.resourceSegmentHash,
      boundCanonicalIds: new Set([decision.canonicalId]),
    });
  }

  const changed: DerivedChangedResourceSegment[] = [];
  for (const [key, prior] of [...priorByEndpoint.entries()].sort(([a], [b]) => (
    a.localeCompare(b, 'en')
  ))) {
    const current = currentByEndpoint.get(key);
    if (!current) {
      // Removal: invalidate only — do not fabricate candidates.
      changed.push({
        resourceId: prior.resourceId,
        structuralUnitId: prior.structuralUnitId,
        segmentId: prior.segmentId,
        resourceSegmentHash: prior.resourceSegmentHash,
        candidateCanonicalIds: [],
        removed: true,
      });
      continue;
    }
    if (current.resourceSegmentHash === prior.resourceSegmentHash) {
      continue;
    }
    // Hash changed: candidates come from current segment reverse map plus any
    // currently-bound canonicals still attached to this endpoint. Never expand
    // to unrelated full-object review via work-manifest object slots.
    const candidateCanonicalIds = new Set<string>([
      ...current.candidateCanonicalIds,
      ...prior.boundCanonicalIds,
    ]);
    // Prefer current reverse-map when present; bound ids remain for regeneration
    // against the current segment endpoint only.
    changed.push({
      resourceId: current.resourceId,
      structuralUnitId: current.structuralUnitId,
      segmentId: current.segmentId,
      resourceSegmentHash: current.resourceSegmentHash,
      candidateCanonicalIds: [...candidateCanonicalIds].sort((a, b) => a.localeCompare(b, 'en')),
      removed: false,
    });
  }

  return changed;
}

/**
 * Map derived segment changes into the work-manifest / pipeline input shape.
 *
 * Never attach candidateCanonicalIds here: work-manifest would promote them to
 * object-wide review. Resource-side candidates are regenerated only from the
 * current resource index endpoint (enriched separately when needed).
 */
export function toChangedResourceSegmentWorkItems(
  derived: readonly DerivedChangedResourceSegment[],
): Array<{
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  resourceSegmentHash: string;
}> {
  return derived.map((row) => ({
    resourceId: row.resourceId,
    structuralUnitId: row.structuralUnitId,
    segmentId: row.segmentId,
    resourceSegmentHash: row.resourceSegmentHash,
  }));
}

/**
 * Enrich current resource-index endpoints with candidateCanonicalIds from
 * derived changes (current reverse map ∪ prior CURRENT bindings on that
 * endpoint). Unrelated endpoints are left untouched — no full-object fan-out.
 */
export function enrichResourceIndexWithChangedSegmentCandidates(input: {
  resourceIndex: ReadonlyArray<{
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    candidateCanonicalIds?: readonly string[];
    deterministicRole?: null;
    evidenceIds?: readonly string[];
  }>;
  changedSegments: readonly DerivedChangedResourceSegment[];
}): Array<{
  resourceId: string;
  structuralUnitId: string;
  segmentId: string;
  resourceSegmentHash: string;
  candidateCanonicalIds: string[];
  deterministicRole: null;
  evidenceIds: string[];
}> {
  const byEndpoint = new Map(
    input.changedSegments
      .filter((row) => !row.removed)
      .map((row) => [segmentEndpointKey(row), row] as const),
  );
  return input.resourceIndex.map((row) => {
    const key = segmentEndpointKey(row);
    const changed = byEndpoint.get(key);
    const merged = new Set<string>([
      ...(row.candidateCanonicalIds ?? []),
      ...(changed?.candidateCanonicalIds ?? []),
    ]);
    return {
      resourceId: row.resourceId,
      structuralUnitId: row.structuralUnitId,
      segmentId: row.segmentId,
      resourceSegmentHash: row.resourceSegmentHash,
      candidateCanonicalIds: [...merged].sort((a, b) => a.localeCompare(b, 'en')),
      deterministicRole: null,
      evidenceIds: [...(row.evidenceIds ?? [])],
    };
  });
}
