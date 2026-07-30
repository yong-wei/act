/**
 * Explicit RAG semantic adapters for relation expansion.
 *
 * Presence in CTKG storage is not enough: only predicates listed here expand,
 * and only in the adapter's declared direction. Directed predicates never
 * expand backwards from target → source.
 */

import { CTKG_0_2_RELATION_SEMANTIC_CONTRACT } from '@/lib/authoritative-knowledge/contracts';

export type RagExpansionDirection = 'outgoing' | 'both';

export interface RagPredicateAdapter {
  predicate: string;
  /** Graph edge direction contract this adapter requires. */
  graphDirection: 'source_to_target' | 'unordered';
  /**
   * - outgoing: expand only seed==source → target
   * - both: unordered association may expand either endpoint
   */
  expansion: RagExpansionDirection;
  rationale: string;
}

/**
 * Closed set of RAG-supported precise engineering predicates.
 * Unsupported stored predicates (mentions, prerequisite, refers_to, contains, …)
 * have no adapter and must never expand.
 */
export const RAG_PREDICATE_ADAPTERS = Object.freeze({
  is_a: {
    predicate: 'is_a',
    graphDirection: 'source_to_target',
    expansion: 'outgoing',
    rationale: 'Subtype → supertype candidate expansion for concept alignment.',
  },
  part_of: {
    predicate: 'part_of',
    graphDirection: 'source_to_target',
    expansion: 'outgoing',
    rationale: 'Component → whole candidate expansion.',
  },
  has_component: {
    predicate: 'has_component',
    graphDirection: 'source_to_target',
    expansion: 'outgoing',
    rationale: 'Assembly → component candidate expansion.',
  },
  has_formula: {
    predicate: 'has_formula',
    graphDirection: 'source_to_target',
    expansion: 'outgoing',
    rationale: 'Concept → formula candidate expansion.',
  },
  has_representation: {
    predicate: 'has_representation',
    graphDirection: 'source_to_target',
    expansion: 'outgoing',
    rationale: 'Object → representation candidate expansion.',
  },
  applies_to: {
    predicate: 'applies_to',
    graphDirection: 'source_to_target',
    expansion: 'outgoing',
    rationale: 'Method/statement → applicable target expansion.',
  },
  used_to_analyze: {
    predicate: 'used_to_analyze',
    graphDirection: 'source_to_target',
    expansion: 'outgoing',
    rationale: 'Analysis tool → analyzed object expansion.',
  },
  derived_from: {
    predicate: 'derived_from',
    graphDirection: 'source_to_target',
    expansion: 'outgoing',
    rationale: 'Derived object → source object expansion.',
  },
  association: {
    predicate: 'association',
    graphDirection: 'unordered',
    expansion: 'both',
    rationale: 'Reviewed undirected semantic association; expand either endpoint.',
  },
} as const satisfies Record<string, RagPredicateAdapter>);

export type RagSupportedPredicate = keyof typeof RAG_PREDICATE_ADAPTERS;

export const RAG_SUPPORTED_PREDICATES = Object.freeze(
  (Object.keys(RAG_PREDICATE_ADAPTERS) as RagSupportedPredicate[]).sort(
    (a, b) => a.localeCompare(b),
  ),
);

export function getRagPredicateAdapter(
  predicate: string,
): RagPredicateAdapter | null {
  const adapter = RAG_PREDICATE_ADAPTERS[predicate as RagSupportedPredicate];
  return adapter ?? null;
}

/**
 * Resolve the neighbor id when expanding from `seedId` along `relation`.
 * Returns null when the predicate is unsupported or the direction is wrong.
 */
export function resolveExpansionNeighbor(input: {
  seedId: string;
  predicate: string;
  sourceId: string;
  targetId: string;
}): {
  neighborId: string | null;
  supported: boolean;
  skipReason: 'unsupported-predicate' | 'wrong-direction' | 'self-loop' | null;
} {
  const adapter = getRagPredicateAdapter(input.predicate);
  if (!adapter) {
    return { neighborId: null, supported: false, skipReason: 'unsupported-predicate' };
  }

  // Adapter direction must agree with the pinned CTKG semantic contract.
  const pinned = CTKG_0_2_RELATION_SEMANTIC_CONTRACT[
    input.predicate as keyof typeof CTKG_0_2_RELATION_SEMANTIC_CONTRACT
  ];
  if (!pinned || pinned.direction !== adapter.graphDirection) {
    return { neighborId: null, supported: false, skipReason: 'unsupported-predicate' };
  }

  if (input.sourceId === input.targetId) {
    return { neighborId: null, supported: false, skipReason: 'self-loop' };
  }

  if (adapter.expansion === 'both') {
    if (input.seedId === input.sourceId) {
      return { neighborId: input.targetId, supported: true, skipReason: null };
    }
    if (input.seedId === input.targetId) {
      return { neighborId: input.sourceId, supported: true, skipReason: null };
    }
    return { neighborId: null, supported: true, skipReason: 'wrong-direction' };
  }

  // Directed: only seed == source expands to target.
  if (input.seedId === input.sourceId) {
    return { neighborId: input.targetId, supported: true, skipReason: null };
  }
  if (input.seedId === input.targetId) {
    return { neighborId: null, supported: true, skipReason: 'wrong-direction' };
  }
  return { neighborId: null, supported: true, skipReason: 'wrong-direction' };
}
