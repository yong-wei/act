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
