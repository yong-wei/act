/**
 * Explicit SAR semantic whitelist for composition traversal (#1114).
 *
 * Stored-but-unsupported types and predicates may surface as read-only context
 * but never participate in hop expansion.
 */

import {
  SAR_SUPPORTED_OBJECT_TYPES,
  SAR_SUPPORTED_TRAVERSAL_PREDICATES,
  SAR_UNSUPPORTED_STORED_PREDICATES,
  type SarSupportedObjectType,
  type SarSupportedTraversalPredicate,
  type SarTraversalSkipReason,
} from './contracts';

export function isSarSupportedObjectType(
  objectType: string | undefined | null,
): objectType is SarSupportedObjectType {
  if (!objectType) return false;
  return (SAR_SUPPORTED_OBJECT_TYPES as readonly string[]).includes(objectType);
}

export function isSarSupportedTraversalPredicate(
  predicate: string | undefined | null,
): predicate is SarSupportedTraversalPredicate {
  if (!predicate) return false;
  return (SAR_SUPPORTED_TRAVERSAL_PREDICATES as readonly string[]).includes(
    predicate,
  );
}

export function isSarUnsupportedStoredPredicate(predicate: string): boolean {
  return (SAR_UNSUPPORTED_STORED_PREDICATES as readonly string[]).includes(
    predicate,
  );
}

export type SarPredicateExpansion = 'outgoing' | 'both';

export interface SarPredicateAdapter {
  predicate: SarSupportedTraversalPredicate;
  expansion: SarPredicateExpansion;
  rationale: string;
}

/**
 * Closed adapter table. Only listed predicates expand.
 * Cross-namespace binding predicates expand as undirected association edges
 * between already-reviewed endpoints.
 */
export const SAR_PREDICATE_ADAPTERS = Object.freeze({
  is_a: {
    predicate: 'is_a',
    expansion: 'outgoing',
    rationale: 'Subtype → supertype expansion.',
  },
  part_of: {
    predicate: 'part_of',
    expansion: 'outgoing',
    rationale: 'Component → whole expansion.',
  },
  has_component: {
    predicate: 'has_component',
    expansion: 'outgoing',
    rationale: 'Assembly → component expansion.',
  },
  has_formula: {
    predicate: 'has_formula',
    expansion: 'outgoing',
    rationale: 'Concept → formula expansion.',
  },
  has_representation: {
    predicate: 'has_representation',
    expansion: 'outgoing',
    rationale: 'Object → representation expansion.',
  },
  applies_to: {
    predicate: 'applies_to',
    expansion: 'outgoing',
    rationale: 'Method → applicable target expansion.',
  },
  used_to_analyze: {
    predicate: 'used_to_analyze',
    expansion: 'outgoing',
    rationale: 'Analysis tool → analyzed object expansion.',
  },
  derived_from: {
    predicate: 'derived_from',
    expansion: 'outgoing',
    rationale: 'Derived → source expansion.',
  },
  association: {
    predicate: 'association',
    expansion: 'both',
    rationale: 'Reviewed undirected association.',
  },
  kaq_primary_identity: {
    predicate: 'kaq_primary_identity',
    expansion: 'both',
    rationale: 'Reviewed KAQ primary identity binding.',
  },
  kaq_composition_part: {
    predicate: 'kaq_composition_part',
    expansion: 'both',
    rationale: 'Reviewed KAQ composition-part binding.',
  },
  kaq_supporting_object: {
    predicate: 'kaq_supporting_object',
    expansion: 'both',
    rationale: 'Reviewed KAQ supporting-object binding.',
  },
  resource_explains: {
    predicate: 'resource_explains',
    expansion: 'both',
    rationale: 'Reviewed resource EXPLAINS binding.',
  },
  resource_practices: {
    predicate: 'resource_practices',
    expansion: 'both',
    rationale: 'Reviewed resource PRACTICES binding.',
  },
  resource_assesses: {
    predicate: 'resource_assesses',
    expansion: 'both',
    rationale: 'Reviewed resource ASSESSES binding.',
  },
  resource_references: {
    predicate: 'resource_references',
    expansion: 'both',
    rationale: 'Reviewed resource REFERENCES binding.',
  },
  path_covers: {
    predicate: 'path_covers',
    expansion: 'both',
    rationale: 'Reviewed path-covers-canonical binding.',
  },
  learner_targets: {
    predicate: 'learner_targets',
    expansion: 'both',
    rationale: 'Reviewed learner-state-targets-canonical binding.',
  },
} as const satisfies Record<SarSupportedTraversalPredicate, SarPredicateAdapter>);

export function getSarPredicateAdapter(
  predicate: string,
): SarPredicateAdapter | null {
  if (!isSarSupportedTraversalPredicate(predicate)) return null;
  return SAR_PREDICATE_ADAPTERS[predicate];
}

/**
 * Resolve neighbor identity when expanding from seed along a directed/both edge.
 */
export function resolveSarTraversalNeighbor(input: {
  seedId: string;
  predicate: string;
  fromId: string;
  toId: string;
}): {
  neighborId: string | null;
  supported: boolean;
  skipReason: SarTraversalSkipReason | null;
} {
  const adapter = getSarPredicateAdapter(input.predicate);
  if (!adapter) {
    return {
      neighborId: null,
      supported: false,
      skipReason: 'unsupported-predicate',
    };
  }
  if (input.fromId === input.toId) {
    return { neighborId: null, supported: false, skipReason: 'self-loop' };
  }
  if (adapter.expansion === 'both') {
    if (input.seedId === input.fromId) {
      return { neighborId: input.toId, supported: true, skipReason: null };
    }
    if (input.seedId === input.toId) {
      return { neighborId: input.fromId, supported: true, skipReason: null };
    }
    return { neighborId: null, supported: true, skipReason: 'wrong-direction' };
  }
  // Directed: only seed == from expands to to.
  if (input.seedId === input.fromId) {
    return { neighborId: input.toId, supported: true, skipReason: null };
  }
  if (input.seedId === input.toId) {
    return { neighborId: null, supported: true, skipReason: 'wrong-direction' };
  }
  return { neighborId: null, supported: true, skipReason: 'wrong-direction' };
}

/**
 * Map KAQ binding role / resource role names onto SAR traversal predicates.
 */
export function mapKaqRoleToSarPredicate(
  bindingRole: string,
): SarSupportedTraversalPredicate | null {
  switch (bindingRole) {
    case 'PRIMARY_IDENTITY':
      return 'kaq_primary_identity';
    case 'COMPOSITION_PART':
      return 'kaq_composition_part';
    case 'SUPPORTING_OBJECT':
      return 'kaq_supporting_object';
    default:
      return null;
  }
}

export function mapResourceRoleToSarPredicate(
  role: string,
): SarSupportedTraversalPredicate | null {
  switch (role) {
    case 'EXPLAINS':
      return 'resource_explains';
    case 'PRACTICES':
      return 'resource_practices';
    case 'ASSESSES':
      return 'resource_assesses';
    case 'REFERENCES':
      return 'resource_references';
    default:
      return null;
  }
}
