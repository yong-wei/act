export interface AdaptivePathComparisonPair {
  leftOptionId: string;
  rightOptionId: string;
  pairKey: string;
}

export interface AdaptivePathComparisonKeyInput {
  candidateBatchId: string;
  pathVersion: string;
  pairKey: string;
}

export interface AdaptivePathComparisonCandidateIdentity {
  optionId: string;
  styleId: string;
}

export type AdaptivePathComparisonAuthorization =
  | {
      ok: true;
      comparisonKey: string;
      pair: AdaptivePathComparisonPair;
      pathVersion: string;
    }
  | {
      ok: false;
      reason: 'invalid-pair' | 'invalid-version' | 'stale-path-version' | 'comparison-key-mismatch';
    };

export function normalizeAdaptivePathComparisonPair(
  leftOptionId: string | null | undefined,
  rightOptionId: string | null | undefined,
  orderedOptionIds: readonly string[],
): AdaptivePathComparisonPair | null {
  if (!leftOptionId || !rightOptionId || leftOptionId === rightOptionId) return null;
  const leftIndex = orderedOptionIds.indexOf(leftOptionId);
  const rightIndex = orderedOptionIds.indexOf(rightOptionId);
  if (leftIndex < 0 || rightIndex < 0) return null;
  const [first, second] = leftIndex < rightIndex
    ? [leftOptionId, rightOptionId]
    : [rightOptionId, leftOptionId];
  return {
    leftOptionId: first,
    rightOptionId: second,
    pairKey: `${first}:${second}`,
  };
}

export function enumerateAdaptivePathComparisonPairs(
  orderedOptionIds: readonly string[],
): AdaptivePathComparisonPair[] {
  const pairs: AdaptivePathComparisonPair[] = [];
  for (let leftIndex = 0; leftIndex < orderedOptionIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < orderedOptionIds.length; rightIndex += 1) {
      const pair = normalizeAdaptivePathComparisonPair(
        orderedOptionIds[leftIndex],
        orderedOptionIds[rightIndex],
        orderedOptionIds,
      );
      if (pair) pairs.push(pair);
    }
  }
  return pairs;
}

export function buildAdaptivePathComparisonVersion(
  candidateBatchId: string | null | undefined,
  pathVersion: string,
  orderedOptionIds: readonly string[],
): string {
  return [candidateBatchId ?? 'no-batch', pathVersion, ...orderedOptionIds].join('|');
}

export function buildAdaptivePathComparisonKey(input: AdaptivePathComparisonKeyInput): string {
  return `${input.candidateBatchId}|${input.pathVersion}|${input.pairKey}`;
}

export function authorizeAdaptivePathComparisonIdentity(input: {
  candidateBatchId: string;
  candidateBatchCreatedAt: string;
  currentPathUpdatedAt: string;
  candidates: readonly AdaptivePathComparisonCandidateIdentity[];
  selectedStyleId: string | null | undefined;
  comparedStyleId: string | null | undefined;
  requestedComparisonKey: string | null | undefined;
}): AdaptivePathComparisonAuthorization {
  const selectedOptionId = input.candidates.find(
    (candidate) => candidate.styleId === input.selectedStyleId,
  )?.optionId;
  const comparedOptionId = input.candidates.find(
    (candidate) => candidate.styleId === input.comparedStyleId,
  )?.optionId;
  const orderedOptionIds = input.candidates.map((candidate) => candidate.optionId);
  const pair = normalizeAdaptivePathComparisonPair(
    selectedOptionId,
    comparedOptionId,
    orderedOptionIds,
  );
  if (!pair) return { ok: false, reason: 'invalid-pair' };

  const candidateBatchCreatedAt = Date.parse(input.candidateBatchCreatedAt);
  const currentPathUpdatedAt = Date.parse(input.currentPathUpdatedAt);
  if (!Number.isFinite(candidateBatchCreatedAt) || !Number.isFinite(currentPathUpdatedAt)) {
    return { ok: false, reason: 'invalid-version' };
  }
  if (currentPathUpdatedAt > candidateBatchCreatedAt) {
    return { ok: false, reason: 'stale-path-version' };
  }

  const comparisonKey = buildAdaptivePathComparisonKey({
    candidateBatchId: input.candidateBatchId,
    pathVersion: input.currentPathUpdatedAt,
    pairKey: pair.pairKey,
  });
  if (input.requestedComparisonKey !== comparisonKey) {
    return { ok: false, reason: 'comparison-key-mismatch' };
  }
  return {
    ok: true,
    comparisonKey,
    pair,
    pathVersion: input.currentPathUpdatedAt,
  };
}
