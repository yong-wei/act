import {
  projectKnowledgeGraphRelations,
} from './relation-contract';

export const KNOWLEDGE_GRAPH_CORRIDOR_LIMITS = {
  ancestorLevels: 4,
  descendantLevels: 4,
  nodes: 64,
  edges: 96,
} as const;

const KNOWLEDGE_GRAPH_CORRIDOR_PRIMARY_BRANCH_LIMIT = 2;

export interface KnowledgeGraphCorridorLink {
  id: string;
  relation: string;
  relationType?: string;
  sourceId: string;
  strength?: number;
  targetId: string;
}

export interface KnowledgeGraphAdjacentDomainNavigation {
  direction: 'ancestor' | 'descendant';
  domainId: string;
  edgeId: string;
  nodeId: string;
}

export interface SelectedKnowledgeGraphCorridor {
  ancestorNodeIds: string[];
  canvasVisibleEdgeIds: string[];
  canvasVisibleNodeIds: string[];
  adjacentDomainNavigations: KnowledgeGraphAdjacentDomainNavigation[];
  canonicalEdgeIds: string[];
  canonicalNodeIds: string[];
  descendantNodeIds: string[];
  motionEligibleEdgeIds: string[];
  motionSuppressedEdgeIds: string[];
  primaryEdgeIds: string[];
  primaryNodeIds: string[];
  selectedNodeId: string;
}

interface CorridorEdge {
  edgeId: string;
  key: string;
  sourceId: string;
  strength: number;
  targetId: string;
}

interface TraversalCandidate {
  direction: KnowledgeGraphAdjacentDomainNavigation['direction'];
  edge: CorridorEdge;
  nextNodeId: string;
}

function compareStableIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCandidates(left: TraversalCandidate, right: TraversalCandidate): number {
  return right.edge.strength - left.edge.strength
    || compareStableIds(left.edge.edgeId, right.edge.edgeId)
    || compareStableIds(left.direction, right.direction)
    || compareStableIds(left.nextNodeId, right.nextNodeId);
}

function projectCanonicalPostRequisiteEdges(
  links: readonly KnowledgeGraphCorridorLink[],
): CorridorEdge[] {
  const projection = projectKnowledgeGraphRelations(links.map((link) => ({
    id: link.id,
    relationType: link.relationType || link.relation,
    sourceId: link.sourceId,
    strength: link.strength,
    targetId: link.targetId,
  })));
  if (projection.blocked) return [];
  return projection.visualEdges
    .filter((edge) => edge.family === 'post-requisite')
    .map((edge) => {
      const relationIds = edge.contributingRelations
        .map((relation) => relation.relationId)
        .sort(compareStableIds);
      return {
        edgeId: relationIds[0] ?? edge.key,
        key: edge.key,
        sourceId: edge.sourceId,
        strength: edge.strength ?? 0,
        targetId: edge.targetId,
      };
    })
    .sort((left, right) => compareStableIds(left.edgeId, right.edgeId));
}

export function findCanonicalPostRequisiteCycleEdgeIds(
  links: readonly KnowledgeGraphCorridorLink[],
): string[] {
  const edges = projectCanonicalPostRequisiteEdges(links);
  const components = collectStronglyConnectedNodeIds(edges);
  const componentSizes = new Map<number, number>();
  components.forEach((id) => componentSizes.set(id, (componentSizes.get(id) ?? 0) + 1));
  return edges
    .filter((edge) => {
      const sourceComponent = components.get(edge.sourceId);
      return sourceComponent !== undefined
        && sourceComponent === components.get(edge.targetId)
        && ((componentSizes.get(sourceComponent) ?? 0) > 1 || edge.sourceId === edge.targetId);
    })
    .map((edge) => edge.edgeId)
    .sort(compareStableIds);
}

function collectStronglyConnectedNodeIds(edges: readonly CorridorEdge[]): Map<string, number> {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const nodeIds = new Set<string>();
  edges.forEach((edge) => {
    nodeIds.add(edge.sourceId);
    nodeIds.add(edge.targetId);
    outgoing.set(edge.sourceId, [...(outgoing.get(edge.sourceId) ?? []), edge.targetId]);
    incoming.set(edge.targetId, [...(incoming.get(edge.targetId) ?? []), edge.sourceId]);
  });
  outgoing.forEach((targets) => targets.sort(compareStableIds));
  incoming.forEach((sources) => sources.sort(compareStableIds));

  const visited = new Set<string>();
  const finishOrder: string[] = [];
  for (const rootId of [...nodeIds].sort(compareStableIds)) {
    if (visited.has(rootId)) continue;
    visited.add(rootId);
    const stack = [{ nodeId: rootId, nextTargetIndex: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const targets = outgoing.get(frame.nodeId) ?? [];
      const targetId = targets[frame.nextTargetIndex];
      if (targetId !== undefined) {
        frame.nextTargetIndex += 1;
        if (visited.has(targetId)) continue;
        visited.add(targetId);
        stack.push({ nodeId: targetId, nextTargetIndex: 0 });
        continue;
      }
      finishOrder.push(frame.nodeId);
      stack.pop();
    }
  }

  const componentByNodeId = new Map<string, number>();
  let componentId = 0;
  for (const rootId of finishOrder.reverse()) {
    if (componentByNodeId.has(rootId)) continue;
    componentByNodeId.set(rootId, componentId);
    const stack = [rootId];
    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      for (const sourceId of incoming.get(nodeId) ?? []) {
        if (componentByNodeId.has(sourceId)) continue;
        componentByNodeId.set(sourceId, componentId);
        stack.push(sourceId);
      }
    }
    componentId += 1;
  }
  return componentByNodeId;
}

function selectTraceablePrimaryCorridorEdges({
  selectedNodeId,
  corridorEdges,
  suppressedEdgeIds,
}: {
  selectedNodeId: string;
  corridorEdges: readonly CorridorEdge[];
  suppressedEdgeIds: ReadonlySet<string>;
}): CorridorEdge[] {
  const incomingByNodeId = new Map<string, CorridorEdge[]>();
  const outgoingByNodeId = new Map<string, CorridorEdge[]>();
  corridorEdges.forEach((edge) => {
    incomingByNodeId.set(edge.targetId, [...(incomingByNodeId.get(edge.targetId) ?? []), edge]);
    outgoingByNodeId.set(edge.sourceId, [...(outgoingByNodeId.get(edge.sourceId) ?? []), edge]);
  });
  const compareEdges = (left: CorridorEdge, right: CorridorEdge) => (
    right.strength - left.strength || compareStableIds(left.edgeId, right.edgeId)
  );
  const primaryEdgesById = new Map<string, CorridorEdge>();

  const trace = (
    direction: KnowledgeGraphAdjacentDomainNavigation['direction'],
    edgesByNodeId: ReadonlyMap<string, CorridorEdge[]>,
  ) => {
    let frontier = [selectedNodeId];
    const visited = new Set([selectedNodeId]);
    for (let level = 0; level < KNOWLEDGE_GRAPH_CORRIDOR_LIMITS.ancestorLevels; level += 1) {
      const next = new Set<string>();
      frontier.sort(compareStableIds).forEach((nodeId) => {
        const branchLimit = level === 0 ? KNOWLEDGE_GRAPH_CORRIDOR_PRIMARY_BRANCH_LIMIT : 1;
        const candidates = [...(edgesByNodeId.get(nodeId) ?? [])]
          .sort(compareEdges)
          .filter((edge) => !visited.has(direction === 'ancestor' ? edge.sourceId : edge.targetId))
          .slice(0, branchLimit);
        candidates.forEach((edge) => {
          const nextNodeId = direction === 'ancestor' ? edge.sourceId : edge.targetId;
          if (!suppressedEdgeIds.has(edge.edgeId)) primaryEdgesById.set(edge.edgeId, edge);
          visited.add(nextNodeId);
          next.add(nextNodeId);
        });
      });
      frontier = [...next];
      if (frontier.length === 0) break;
    }
  };

  trace('ancestor', incomingByNodeId);
  trace('descendant', outgoingByNodeId);
  return [...primaryEdgesById.values()]
    .sort((left, right) => compareStableIds(left.edgeId, right.edgeId));
}

export function deriveSelectedKnowledgeGraphCorridor({
  selectedNodeId,
  links,
  domainMemberNodeIds,
  visibleNodeIds = domainMemberNodeIds,
  domainIdByNodeId,
  precomputedMotionSuppressedEdgeIds,
}: {
  selectedNodeId: string;
  links: readonly KnowledgeGraphCorridorLink[];
  domainMemberNodeIds: ReadonlySet<string>;
  visibleNodeIds?: ReadonlySet<string>;
  domainIdByNodeId: ReadonlyMap<string, string>;
  precomputedMotionSuppressedEdgeIds?: ReadonlySet<string>;
}): SelectedKnowledgeGraphCorridor {
  const edges = projectCanonicalPostRequisiteEdges(links);
  const fullGraphSuppressedEdgeIds = precomputedMotionSuppressedEdgeIds
    ?? new Set(findCanonicalPostRequisiteCycleEdgeIds(links));
  const incomingByNodeId = new Map<string, CorridorEdge[]>();
  const outgoingByNodeId = new Map<string, CorridorEdge[]>();
  edges.forEach((edge) => {
    incomingByNodeId.set(edge.targetId, [...(incomingByNodeId.get(edge.targetId) ?? []), edge]);
    outgoingByNodeId.set(edge.sourceId, [...(outgoingByNodeId.get(edge.sourceId) ?? []), edge]);
  });

  const corridorNodeIds = new Set([selectedNodeId]);
  const corridorEdgesByKey = new Map<string, CorridorEdge>();
  const visitedByDirection = {
    ancestor: new Set([selectedNodeId]),
    descendant: new Set([selectedNodeId]),
  };
  let ancestorFrontier = [selectedNodeId];
  let descendantFrontier = [selectedNodeId];

  for (let level = 1; level <= KNOWLEDGE_GRAPH_CORRIDOR_LIMITS.ancestorLevels; level += 1) {
    const candidates: TraversalCandidate[] = [];
    ancestorFrontier.forEach((nodeId) => {
      (incomingByNodeId.get(nodeId) ?? []).forEach((edge) => candidates.push({
        direction: 'ancestor',
        edge,
        nextNodeId: edge.sourceId,
      }));
    });
    descendantFrontier.forEach((nodeId) => {
      (outgoingByNodeId.get(nodeId) ?? []).forEach((edge) => candidates.push({
        direction: 'descendant',
        edge,
        nextNodeId: edge.targetId,
      }));
    });

    const nextAncestors = new Set<string>();
    const nextDescendants = new Set<string>();
    for (const candidate of candidates.sort(compareCandidates)) {
      const alreadyHasNode = corridorNodeIds.has(candidate.nextNodeId);
      if (!alreadyHasNode && corridorNodeIds.size >= KNOWLEDGE_GRAPH_CORRIDOR_LIMITS.nodes) continue;
      const alreadyHasEdge = corridorEdgesByKey.has(candidate.edge.key);
      if (!alreadyHasEdge && corridorEdgesByKey.size >= KNOWLEDGE_GRAPH_CORRIDOR_LIMITS.edges) continue;
      corridorNodeIds.add(candidate.nextNodeId);
      corridorEdgesByKey.set(candidate.edge.key, candidate.edge);
      const visited = visitedByDirection[candidate.direction];
      if (visited.has(candidate.nextNodeId)) continue;
      visited.add(candidate.nextNodeId);
      if (candidate.direction === 'ancestor') nextAncestors.add(candidate.nextNodeId);
      else nextDescendants.add(candidate.nextNodeId);
    }
    ancestorFrontier = [...nextAncestors].sort(compareStableIds);
    descendantFrontier = [...nextDescendants].sort(compareStableIds);
    if (ancestorFrontier.length === 0 && descendantFrontier.length === 0) break;
  }

  const corridorEdges = [...corridorEdgesByKey.values()]
    .sort((left, right) => compareStableIds(left.edgeId, right.edgeId));
  const canonicalNodeIds = [...corridorNodeIds].sort(compareStableIds);
  const canonicalEdgeIds = corridorEdges.map((edge) => edge.edgeId);
  const canvasVisibleNodeIds = canonicalNodeIds.filter((nodeId) => (
    domainMemberNodeIds.has(nodeId) && visibleNodeIds.has(nodeId)
  ));
  const canvasVisibleEdgeIds = corridorEdges
    .filter((edge) => (
      domainMemberNodeIds.has(edge.sourceId)
      && domainMemberNodeIds.has(edge.targetId)
      && visibleNodeIds.has(edge.sourceId)
      && visibleNodeIds.has(edge.targetId)
    ))
    .map((edge) => edge.edgeId);

  const motionSuppressedEdgeIds = corridorEdges
    .filter((edge) => fullGraphSuppressedEdgeIds.has(edge.edgeId))
    .map((edge) => edge.edgeId);
  const suppressed = new Set(motionSuppressedEdgeIds);
  const primaryCorridorEdges = selectTraceablePrimaryCorridorEdges({
    selectedNodeId,
    corridorEdges,
    suppressedEdgeIds: suppressed,
  });
  const canvasVisibleEdgeIdSet = new Set(canvasVisibleEdgeIds);
  const primaryEdgeIds = primaryCorridorEdges
    .map((edge) => edge.edgeId)
    .filter((edgeId) => canvasVisibleEdgeIdSet.has(edgeId));
  const primaryEdgeIdSet = new Set(primaryEdgeIds);
  const primaryNodeIds = [...new Set([
    selectedNodeId,
    ...primaryCorridorEdges
      .filter((edge) => primaryEdgeIdSet.has(edge.edgeId))
      .flatMap((edge) => [edge.sourceId, edge.targetId]),
  ])].filter((nodeId) => canvasVisibleNodeIds.includes(nodeId)).sort(compareStableIds);
  const motionEligibleEdgeIds = primaryEdgeIds.filter((edgeId) => !suppressed.has(edgeId));

  const adjacentDomainNavigations = corridorEdges.flatMap((edge) => {
    const sourceIsDomainMember = domainMemberNodeIds.has(edge.sourceId);
    const targetIsDomainMember = domainMemberNodeIds.has(edge.targetId);
    if (sourceIsDomainMember === targetIsDomainMember) return [];
    const nodeId = sourceIsDomainMember ? edge.targetId : edge.sourceId;
    const domainId = domainIdByNodeId.get(nodeId);
    if (!domainId) return [];
    return [{
      direction: sourceIsDomainMember ? 'descendant' as const : 'ancestor' as const,
      domainId,
      edgeId: edge.edgeId,
      nodeId,
    }];
  }).sort((left, right) => (
    compareStableIds(left.direction, right.direction)
    || compareStableIds(left.domainId, right.domainId)
    || compareStableIds(left.nodeId, right.nodeId)
    || compareStableIds(left.edgeId, right.edgeId)
  ));

  return {
    ancestorNodeIds: [...visitedByDirection.ancestor]
      .filter((nodeId) => nodeId !== selectedNodeId)
      .sort(compareStableIds),
    canvasVisibleEdgeIds,
    canvasVisibleNodeIds,
    adjacentDomainNavigations,
    canonicalEdgeIds,
    canonicalNodeIds,
    descendantNodeIds: [...visitedByDirection.descendant]
      .filter((nodeId) => nodeId !== selectedNodeId)
      .sort(compareStableIds),
    motionEligibleEdgeIds,
    motionSuppressedEdgeIds,
    primaryEdgeIds,
    primaryNodeIds,
    selectedNodeId,
  };
}
