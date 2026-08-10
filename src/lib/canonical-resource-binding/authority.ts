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
  /**
   * #1265: unresolved resources block only the evaluated consumer package.
   * Engineering Authority and unrelated packages remain independently selectable.
   */
  scope: {
    packageId: string | null;
    blocksEngineeringAuthority: false;
    blocksUnrelatedConsumers: false;
    consumerState: 'READY' | 'PINNED_PREVIOUS' | 'BLOCKED_LOCAL_DEPENDENCY';
  };
}

export function evaluateCanonicalResourceCutoverReadiness(input: {
  inventory: ResourceBindingInventory;
  decisions: readonly CanonicalResourceBindingDecision[];
  /**
   * Optional ACT consumer package identity. When omitted, readiness is still
   * computed over the provided inventory only (never the full ActKG Release).
   */
  consumerPackageId?: string | null;
  /** Explicit pin while local readiness is incomplete. */
  pinnedPrevious?: boolean;
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
      && decision.inventoryRunId === input.inventory.runId
      && decision.captureRevision === input.inventory.captureRevision
      && decision.structuralUnitVersion === input.inventory.captureRevision
    ));
    if (bindings.length === 0) {
      blockers.push({ atomicResourceId: item.atomicResourceId, code: 'binding-missing' });
      continue;
    }
    const publishedBindings = bindings.filter(
      (binding) => binding.publicationState === 'SHADOW_PUBLISHED',
    );
    if (publishedBindings.length === 0) {
      blockers.push({
        atomicResourceId: item.atomicResourceId,
        code: 'binding-not-shadow-published',
      });
      continue;
    }
    const duplicatePairs = new Set<string>();
    const seenPairs = new Set<string>();
    for (const binding of publishedBindings) {
      const identity = `${binding.pairId}\u001f${binding.role}`;
      if (seenPairs.has(identity)) duplicatePairs.add(identity);
      seenPairs.add(identity);
    }
    if (duplicatePairs.size > 0) {
      blockers.push({ atomicResourceId: item.atomicResourceId, code: 'binding-non-unique' });
      continue;
    }
    if (publishedBindings.some((binding) => binding.reviewProvider === 'FIXTURE')) {
      blockers.push({ atomicResourceId: item.atomicResourceId, code: 'fixture-review' });
    }
  }
  const ready = blockers.length === 0;
  return {
    ready,
    // Readiness is diagnostic only; this change has no activation operation.
    authorityState: 'LEGACY',
    blockers: blockers.sort((left, right) => (
      left.atomicResourceId.localeCompare(right.atomicResourceId)
      || left.code.localeCompare(right.code)
    )),
    scope: {
      packageId: input.consumerPackageId ?? null,
      blocksEngineeringAuthority: false,
      blocksUnrelatedConsumers: false,
      consumerState: ready
        ? 'READY'
        : input.pinnedPrevious
          ? 'PINNED_PREVIOUS'
          : 'BLOCKED_LOCAL_DEPENDENCY',
    },
  };
}

/**
 * Engineering-only consumers (Engineering RAG) may proceed without ACT resource
 * bindings when Engineering Authority is ACTIVE (#1265).
 */
export function evaluateEngineeringOnlyResourceConsumer(input: {
  engineeringAuthorityActive: boolean;
  packageId: string;
}): {
  packageId: string;
  ready: boolean;
  requiresCanonicalResourceBindings: false;
  consumerState: 'READY' | 'PINNED_PREVIOUS' | 'BLOCKED_LOCAL_DEPENDENCY';
  blocksTeachingResourceRag: false;
} {
  return {
    packageId: input.packageId,
    ready: input.engineeringAuthorityActive,
    requiresCanonicalResourceBindings: false,
    consumerState: input.engineeringAuthorityActive ? 'READY' : 'BLOCKED_LOCAL_DEPENDENCY',
    blocksTeachingResourceRag: false,
  };
}
