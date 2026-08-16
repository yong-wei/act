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
