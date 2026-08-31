import type { IndexedResourceEntry, RegistryIndex } from '../resource-index/types';

import { evidenceFromIndexedEntry, type IndexedEligibilityObservation } from './adapters';
import { evaluateResourceEligibility } from './evaluate';
import type { ResourceEligibilityContext, ResourceEligibilitySnapshot } from './types';

export function observeIndexedResourceEligibility(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: ResourceEligibilityContext;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilitySnapshot {
  return evaluateResourceEligibility({
    context: input.context,
    entry: input.entry,
    index: input.index,
    evidence: evidenceFromIndexedEntry({
      index: input.index,
      entry: input.entry,
      context: input.context,
      observation: input.observation,
    }),
  });
}
