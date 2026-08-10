/**
 * Historical adapters retained after retirement (#1277 task 3.2).
 *
 * Proves LearningFact crosswalk / audit / snapshot readers remain available
 * without creating new active selectors or mutating facts.
 */

import {
  buildLearningFactCrosswalkIndex,
  resolveHistoricalLearningFactDisplayContext,
} from '@/lib/canonical-learning-fact-identity/crosswalk-serving';
import type { LearningFactServingRecord } from '@/lib/canonical-learning-fact-identity/serving';
import type { LegacyIdCrosswalkEntry } from '@/lib/teaching-projection/migration-contracts';

import {
  LegacyRetirementError,
  RETAINED_HISTORICAL_ARTIFACTS,
  type RetainedHistoricalArtifact,
} from './contracts';
import {
  isLegacyCardDirectReaderPermitted,
  type RetirementGateState,
} from './gate';

export interface HistoricalReadResult {
  mode: 'historical';
  artifactId: RetainedHistoricalArtifact | string;
  readable: true;
  createdActiveSelector: false;
  mutatedFact: false;
  detail: Record<string, unknown>;
}

/**
 * List retained historical artifact ids that must stay after retirement.
 */
export function listRetainedHistoricalArtifacts(): readonly RetainedHistoricalArtifact[] {
  return RETAINED_HISTORICAL_ARTIFACTS;
}

/**
 * Resolve a pre-cutover LearningFact via the retained crosswalk adapter.
 * Never mutates fact bytes or creates an active production selector.
 */
export function readHistoricalLearningFactContext(input: {
  fact: LearningFactServingRecord;
  crosswalk: readonly LegacyIdCrosswalkEntry[];
  gate?: RetirementGateState;
}): HistoricalReadResult {
  // Historical mode is always permitted — even when production card reader is retired.
  void isLegacyCardDirectReaderPermitted(input.gate);
  const index = buildLearningFactCrosswalkIndex(input.crosswalk);
  const context = resolveHistoricalLearningFactDisplayContext({
    fact: input.fact,
    crosswalk: index,
  });

  return {
    mode: 'historical',
    artifactId: 'historical-learning-fact-crosswalk-adapter',
    readable: true,
    createdActiveSelector: false,
    mutatedFact: false,
    detail: {
      identityNamespace: context.identityNamespace,
      legacyKnowledgeNodeIds: context.legacyKnowledgeNodeIds,
      displayCanonicalIds: context.displayCanonicalIds,
      crosswalkApplied: context.crosswalkApplied,
      originalFactUnchanged: context.originalFactUnchanged,
    },
  };
}

/**
 * Prove a retained artifact id is still declared after retirement.
 */
export function assertHistoricalArtifactRetained(
  artifactId: string,
): void {
  if (
    !(RETAINED_HISTORICAL_ARTIFACTS as readonly string[]).includes(artifactId)
  ) {
    throw new LegacyRetirementError(
      'historical-artifact-not-retained',
      `artifact is not in the retained historical set: ${artifactId}`,
    );
  }
}

/**
 * Historical audit of the legacy CourseCoverage manifest remains available;
 * it never becomes a production selector after retirement.
 */
export function historicalAuditSelectorAuthority(): {
  authority: 'AUDIT_ONLY';
  selectorAuthority: false;
  productionSelector: false;
} {
  return {
    authority: 'AUDIT_ONLY',
    selectorAuthority: false,
    productionSelector: false,
  };
}
