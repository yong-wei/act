import type { IndexedResourceEntry, RegistryIndex } from '../resource-index/types';

import type { IndexedEligibilityObservation } from './adapters';
import { observeIndexedResourceEligibility } from './observe';
import type {
  ResourceEligibilityContext,
  ResourceEligibilityPurpose,
  ResourceEligibilitySnapshot,
} from './types';

type CallerContext = Omit<ResourceEligibilityContext, 'purpose'>;

function observePurpose(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: CallerContext;
  purpose: ResourceEligibilityPurpose;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilitySnapshot {
  return observeIndexedResourceEligibility({
    index: input.index,
    entry: input.entry,
    context: { ...input.context, purpose: input.purpose },
    observation: input.observation,
  });
}

export function observeBrowseEligibility(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: CallerContext;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilitySnapshot {
  return observePurpose({ ...input, purpose: 'browse' });
}

export function observeRecommendEligibility(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: CallerContext;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilitySnapshot {
  return observePurpose({ ...input, purpose: 'recommend' });
}

export function observePathEligibility(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: CallerContext;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilitySnapshot {
  return observePurpose({ ...input, purpose: 'path' });
}

export function observeLaunchEligibility(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: CallerContext;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilitySnapshot {
  return observePurpose({ ...input, purpose: 'launch' });
}

export function observeFormalBindEligibility(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: CallerContext;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilitySnapshot {
  return observePurpose({ ...input, purpose: 'formal-bind' });
}

export function observeNamedConsumerEligibility(input: {
  index: RegistryIndex;
  entry: IndexedResourceEntry;
  context: CallerContext;
  observation?: IndexedEligibilityObservation;
}): ResourceEligibilitySnapshot {
  return observePurpose({ ...input, purpose: 'named-consumer' });
}
