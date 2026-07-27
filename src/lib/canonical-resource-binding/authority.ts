import type {
  CanonicalResourceBindingDecision,
  ResourceBindingInventory,
  ResourceKnowledgeAuthoritySelector,
} from './contracts';

export function selectResourceKnowledgeAuthority(
  consumer: ResourceKnowledgeAuthoritySelector['consumer'],
): ResourceKnowledgeAuthoritySelector {
  if (consumer === 'SHADOW_AUDIT') {
    return {
      consumer,
      authority: 'CANONICAL_SHADOW',
      canonicalBindingsVisible: true,
    };
  }
  return {
    consumer,
    authority: 'LEGACY',
    canonicalBindingsVisible: false,
  };
}

export interface CanonicalResourceCutoverReadiness {
  ready: boolean;
  authorityState: 'LEGACY';
  blockers: Array<{
    atomicResourceId: string;
    code:
      | 'inventory-unresolved'
      | 'binding-missing'
      | 'binding-non-unique'
      | 'binding-not-shadow-published'
      | 'fixture-review';
  }>;
}

export function evaluateCanonicalResourceCutoverReadiness(input: {
  inventory: ResourceBindingInventory;
  decisions: readonly CanonicalResourceBindingDecision[];
}): CanonicalResourceCutoverReadiness {
  const blockers: CanonicalResourceCutoverReadiness['blockers'] = [];
  for (const item of input.inventory.items) {
    if (item.disposition === 'UNRESOLVED') {
      blockers.push({
        atomicResourceId: item.atomicResourceId,
        code: 'inventory-unresolved',
      });
      continue;
    }
    if (item.disposition === 'EXCLUDED') continue;
    const bindings = input.decisions.filter((decision) => (
      decision.lifecycleState === 'CURRENT'
      && decision.resourceId === item.resourceId
      && decision.structuralUnitId === item.structuralUnitId
      && decision.segmentId === item.segmentId
      && decision.resourceSegmentHash === item.resourceSegmentHash
    ));
    if (bindings.length === 0) {
      blockers.push({ atomicResourceId: item.atomicResourceId, code: 'binding-missing' });
      continue;
    }
    const duplicatePairs = new Set<string>();
    const seenPairs = new Set<string>();
    for (const binding of bindings) {
      const identity = `${binding.pairId}\u001f${binding.role}`;
      if (seenPairs.has(identity)) duplicatePairs.add(identity);
      seenPairs.add(identity);
    }
    if (duplicatePairs.size > 0) {
      blockers.push({ atomicResourceId: item.atomicResourceId, code: 'binding-non-unique' });
      continue;
    }
    if (bindings.some((binding) => binding.reviewProvider === 'FIXTURE')) {
      blockers.push({ atomicResourceId: item.atomicResourceId, code: 'fixture-review' });
    } else if (bindings.some((binding) => binding.publicationState !== 'SHADOW_PUBLISHED')) {
      blockers.push({
        atomicResourceId: item.atomicResourceId,
        code: 'binding-not-shadow-published',
      });
    }
  }
  return {
    ready: blockers.length === 0,
    // Readiness is diagnostic only; this change has no activation operation.
    authorityState: 'LEGACY',
    blockers: blockers.sort((left, right) => (
      left.atomicResourceId.localeCompare(right.atomicResourceId)
      || left.code.localeCompare(right.code)
    )),
  };
}
