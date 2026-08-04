/**
 * Teaching Projection gate: fail-closed, scope-limited (#1267).
 *
 * Rejects invalid endpoints/cards/cycles and REQUIRED unbound resources.
 * Does not block on unprojected Authority nodes or missing optional cards.
 */

import type {
  AuthorityNodeIndexEntry,
  TeachingBindingRuntime,
  TeachingCardIndexEntry,
  TeachingCoreNodeRuntime,
  TeachingPrerequisiteRuntime,
  TeachingProjectionGateFinding,
  TeachingProjectionGateResult,
  TeachingResourceRuntime,
} from './contracts';

export interface ProjectionGateInput {
  resources: readonly TeachingResourceRuntime[];
  bindings: readonly TeachingBindingRuntime[];
  prerequisites: readonly TeachingPrerequisiteRuntime[];
  coreNodes: readonly TeachingCoreNodeRuntime[];
  cards: readonly TeachingCardIndexEntry[];
  authorityNodes: readonly AuthorityNodeIndexEntry[];
}

function authorityIndex(
  nodes: readonly AuthorityNodeIndexEntry[],
): Map<string, AuthorityNodeIndexEntry> {
  const map = new Map<string, AuthorityNodeIndexEntry>();
  for (const node of nodes) {
    map.set(node.canonicalId, node);
  }
  return map;
}

function isUsableAuthorityEndpoint(
  node: AuthorityNodeIndexEntry | undefined,
  index: Map<string, AuthorityNodeIndexEntry>,
): { ok: boolean; reason?: string } {
  if (!node) {
    return { ok: false, reason: 'canonical-id-unknown' };
  }
  const lifecycle = String(node.lifecycleStatus ?? '').toLowerCase();
  if (lifecycle === 'retired') {
    const successor = node.successorCanonicalId;
    if (!successor || !index.has(successor)) {
      return { ok: false, reason: 'retired-without-successor' };
    }
    // Retired with successor is still not a valid direct binding endpoint.
    return { ok: false, reason: 'retired-node' };
  }
  if (lifecycle === 'draft') {
    return { ok: false, reason: 'draft-node' };
  }
  return { ok: true };
}

function detectRequiredCycles(
  prerequisites: readonly TeachingPrerequisiteRuntime[],
): string[][] {
  const edges = new Map<string, string[]>();
  for (const edge of prerequisites) {
    if (edge.strength !== 'REQUIRED') continue;
    const list = edges.get(edge.sourceCanonicalId) ?? [];
    list.push(edge.targetCanonicalId);
    edges.set(edge.sourceCanonicalId, list);
  }

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) {
        cycles.push([...stack.slice(idx), node]);
      }
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      dfs(next);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of edges.keys()) {
    dfs(node);
  }
  return cycles;
}

/**
 * Evaluate the Teaching Projection gate.
 * Gate status maps to TeachingProjectionState: PUBLISHED | REVIEW_REQUIRED | NOT_PROJECTED.
 */
export function evaluateTeachingProjectionGate(
  input: ProjectionGateInput,
): TeachingProjectionGateResult {
  const findings: TeachingProjectionGateFinding[] = [];
  const index = authorityIndex(input.authorityNodes);
  const bindingsByResource = new Map<string, TeachingBindingRuntime[]>();

  for (const binding of input.bindings) {
    const list = bindingsByResource.get(binding.resourceId) ?? [];
    list.push(binding);
    bindingsByResource.set(binding.resourceId, list);

    const endpoint = isUsableAuthorityEndpoint(index.get(binding.canonicalId), index);
    if (!endpoint.ok) {
      findings.push({
        code: endpoint.reason ?? 'invalid-canonical-id',
        severity: 'error',
        message: `binding ${binding.bindingId} targets invalid Canonical ID ${binding.canonicalId}`,
        bindingId: binding.bindingId,
        resourceId: binding.resourceId,
        canonicalId: binding.canonicalId,
      });
    }
  }

  const unboundRequiredResourceIds: string[] = [];
  const unboundOptionalResourceIds: string[] = [];

  for (const resource of input.resources) {
    // Bindings for a different teaching scope must not satisfy this resource.
    const bound = (bindingsByResource.get(resource.resourceId) ?? []).some(
      (binding) => binding.scopeId === resource.scopeId,
    );

    if (resource.projectionMode === 'REQUIRED' && !bound) {
      unboundRequiredResourceIds.push(resource.resourceId);
      findings.push({
        code: 'required-resource-unbound',
        severity: 'error',
        message: `REQUIRED resource ${resource.resourceId} has no valid binding`,
        resourceId: resource.resourceId,
      });
    } else if (resource.projectionMode === 'OPTIONAL' && !bound) {
      unboundOptionalResourceIds.push(resource.resourceId);
      findings.push({
        code: 'optional-resource-unbound',
        severity: 'info',
        message: `OPTIONAL resource ${resource.resourceId} has no binding`,
        resourceId: resource.resourceId,
      });
    } else if (resource.projectionMode === 'NONE' && !bound) {
      findings.push({
        code: 'none-resource-unbound',
        severity: 'info',
        message: `NONE resource ${resource.resourceId} carries no knowledge semantics`,
        resourceId: resource.resourceId,
      });
    }
  }

  // Cards: duplicate active cards per Canonical ID fail; required unresolved fail.
  const activeByCanonical = new Map<string, string[]>();
  for (const card of input.cards) {
    if (card.active) {
      const list = activeByCanonical.get(card.canonicalId) ?? [];
      list.push(card.cardId);
      activeByCanonical.set(card.canonicalId, list);
    }
    if (card.required) {
      if (!card.active) {
        findings.push({
          code: 'required-card-inactive',
          severity: 'error',
          message: `required card ${card.cardId} is not active`,
          cardId: card.cardId,
          canonicalId: card.canonicalId,
        });
      }
      const endpoint = isUsableAuthorityEndpoint(index.get(card.canonicalId), index);
      if (!endpoint.ok) {
        findings.push({
          code: 'required-card-unresolved',
          severity: 'error',
          message: `required card ${card.cardId} unresolved Canonical ID ${card.canonicalId}`,
          cardId: card.cardId,
          canonicalId: card.canonicalId,
        });
      }
    } else if (!card.active) {
      // Optional missing/inactive cards do not block.
      findings.push({
        code: 'optional-card-absent',
        severity: 'info',
        message: `optional card ${card.cardId} is inactive or absent`,
        cardId: card.cardId,
        canonicalId: card.canonicalId,
      });
    }
  }

  for (const [canonicalId, cardIds] of activeByCanonical) {
    if (cardIds.length > 1) {
      findings.push({
        code: 'duplicate-active-cards',
        severity: 'error',
        message: `Canonical ID ${canonicalId} has multiple active cards: ${cardIds.join(', ')}`,
        canonicalId,
      });
    }
  }

  // Prerequisites: dangling endpoints, self-loops, required cycles.
  for (const edge of input.prerequisites) {
    if (edge.sourceCanonicalId === edge.targetCanonicalId) {
      findings.push({
        code: 'prerequisite-self-loop',
        severity: 'error',
        message: `prerequisite ${edge.prerequisiteId} is a self-loop on ${edge.sourceCanonicalId}`,
        prerequisiteId: edge.prerequisiteId,
        canonicalId: edge.sourceCanonicalId,
      });
    }
    for (const endpointId of [edge.sourceCanonicalId, edge.targetCanonicalId]) {
      const endpoint = isUsableAuthorityEndpoint(index.get(endpointId), index);
      if (!endpoint.ok) {
        findings.push({
          code: 'prerequisite-dangling-endpoint',
          severity: 'error',
          message: `prerequisite ${edge.prerequisiteId} has invalid endpoint ${endpointId}`,
          prerequisiteId: edge.prerequisiteId,
          canonicalId: endpointId,
        });
      }
    }
  }

  const cycles = detectRequiredCycles(input.prerequisites);
  for (const cycle of cycles) {
    findings.push({
      code: 'required-prerequisite-cycle',
      severity: 'error',
      message: `REQUIRED prerequisite cycle: ${cycle.join(' -> ')}`,
    });
  }

  // Core nodes reference validity (invalid core-node endpoints fail).
  // cardPolicy REQUIRED (#1271): only explicit core records gate on an active card.
  for (const core of input.coreNodes) {
    const endpoint = isUsableAuthorityEndpoint(index.get(core.canonicalId), index);
    if (!endpoint.ok) {
      findings.push({
        code: 'core-node-invalid-endpoint',
        severity: 'error',
        message: `core-node ${core.canonicalId} is not a usable Authority endpoint`,
        canonicalId: core.canonicalId,
      });
    }
    if (core.cardPolicy === 'required') {
      const actives = activeByCanonical.get(core.canonicalId) ?? [];
      if (actives.length === 0) {
        findings.push({
          code: 'required-core-card-missing',
          severity: 'error',
          message: `core-node ${core.canonicalId} has cardPolicy REQUIRED but no active card`,
          canonicalId: core.canonicalId,
        });
      }
    } else if (core.cardPolicy === 'optional') {
      const actives = activeByCanonical.get(core.canonicalId) ?? [];
      if (actives.length === 0) {
        findings.push({
          code: 'optional-card-absent',
          severity: 'info',
          message: `optional card absent for core-node ${core.canonicalId}`,
          canonicalId: core.canonicalId,
        });
      }
    }
  }

  // Unprojected Authority nodes: diagnostic only, never block.
  const referenced = new Set<string>();
  for (const binding of input.bindings) referenced.add(binding.canonicalId);
  for (const core of input.coreNodes) referenced.add(core.canonicalId);
  for (const card of input.cards) referenced.add(card.canonicalId);
  for (const edge of input.prerequisites) {
    referenced.add(edge.sourceCanonicalId);
    referenced.add(edge.targetCanonicalId);
  }

  const notProjectedCanonicalIds: string[] = [];
  for (const node of input.authorityNodes) {
    if (!referenced.has(node.canonicalId)) {
      notProjectedCanonicalIds.push(node.canonicalId);
      findings.push({
        code: 'authority-node-not-projected',
        severity: 'info',
        message: `Authority node ${node.canonicalId} is NOT_PROJECTED`,
        canonicalId: node.canonicalId,
      });
    }
  }

  const hasErrors = findings.some((f) => f.severity === 'error');
  const hasAnyTeachingContent =
    input.resources.length > 0
    || input.bindings.length > 0
    || input.coreNodes.length > 0
    || input.prerequisites.length > 0
    || input.cards.length > 0;

  let status: TeachingProjectionGateResult['status'];
  if (hasErrors) {
    status = 'REVIEW_REQUIRED';
  } else if (!hasAnyTeachingContent) {
    // Empty projection is legal and publishable (deterministic empty hash).
    status = 'PUBLISHED';
  } else {
    status = 'PUBLISHED';
  }

  return {
    status,
    passed: !hasErrors,
    findings,
    unboundRequiredResourceIds: unboundRequiredResourceIds.sort(),
    notProjectedCanonicalIds: notProjectedCanonicalIds.sort(),
    unboundOptionalResourceIds: unboundOptionalResourceIds.sort(),
  };
}
