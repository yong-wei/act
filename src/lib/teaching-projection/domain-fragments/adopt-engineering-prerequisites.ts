/**
 * Build-time teaching-order planner (#2007).
 * Adopts engineering post-requisites and spans remaining overview concepts.
 * Runtime loaders must not call this against live family shards.
 */

import { getKnowledgeGraphRelationContract } from '@/features/knowledge/graph/relation-contract';
import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';
import type { PrerequisiteStrength } from '../contracts';

export class OverviewTeachingOrderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OverviewTeachingOrderError';
    this.code = code;
  }
}

export interface PlannedTeachingOrderEdge {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: 'PREREQUISITE';
  strength: PrerequisiteStrength;
  domainKeys: RegisteredPeerDomainId[];
  provenance: 'engineering-post-requisite' | 'teaching-extension';
  engineeringRelationId: string | null;
}

export interface OverviewTeachingOrderPlan {
  adopted: PlannedTeachingOrderEdge[];
  extensions: PlannedTeachingOrderEdge[];
}

interface UnionFind {
  parent: Map<string, string>;
  find(id: string): string;
  union(left: string, right: string): void;
}

function createUnionFind(nodeIds: readonly string[]): UnionFind {
  const parent = new Map(nodeIds.map((id) => [id, id]));
  const find = (id: string): string => {
    const current = parent.get(id);
    if (current === undefined) return id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  return {
    parent,
    find,
    union(left: string, right: string) {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot === rightRoot) return;
      if (leftRoot < rightRoot) parent.set(rightRoot, leftRoot);
      else parent.set(leftRoot, rightRoot);
    },
  };
}

function hasDirectedCycle(
  nodeIds: readonly string[],
  edges: ReadonlyArray<{ sourceNodeId: string; targetNodeId: string }>,
): boolean {
  const adjacency = new Map(nodeIds.map((id) => [id, [] as string[]]));
  for (const edge of edges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };
  return nodeIds.some((nodeId) => visit(nodeId));
}

export function isEngineeringPostRequisitePredicate(predicate: string): boolean {
  return getKnowledgeGraphRelationContract(predicate)?.family === 'post-requisite';
}

function edgeKey(sourceNodeId: string, targetNodeId: string): string {
  return `${sourceNodeId}\u001f${targetNodeId}`;
}

export function planOverviewTeachingOrder(input: {
  overviews: ReadonlyArray<{ domainId: RegisteredPeerDomainId; nodeIds: readonly string[] }>;
  engineeringRelations: ReadonlyArray<{
    id: string;
    predicate: string;
    sourceId: string;
    targetId: string;
  }>;
  existingTeaching: ReadonlyArray<{
    sourceNodeId: string;
    targetNodeId: string;
    relationType: string;
  }>;
}): OverviewTeachingOrderPlan {
  const adopted: PlannedTeachingOrderEdge[] = [];
  const extensions: PlannedTeachingOrderEdge[] = [];
  const emitted = new Set<string>();
  const requiredPairs: Array<{ sourceNodeId: string; targetNodeId: string }> = [];

  const planned = new Map<string, PlannedTeachingOrderEdge>();
  const mark = (edge: PlannedTeachingOrderEdge) => {
    const key = edgeKey(edge.sourceNodeId, edge.targetNodeId);
    const existing = planned.get(key);
    if (existing) {
      existing.domainKeys = [...new Set([...existing.domainKeys, ...edge.domainKeys])]
        .sort() as RegisteredPeerDomainId[];
      return;
    }
    if (emitted.has(key)) return;
    emitted.add(key);
    planned.set(key, edge);
    if (edge.provenance === 'engineering-post-requisite') adopted.push(edge);
    else extensions.push(edge);
  };

  const existingPrereq = input.existingTeaching.filter(
    (edge) => edge.relationType === 'PREREQUISITE' && edge.sourceNodeId !== edge.targetNodeId,
  );

  for (const overview of input.overviews) {
    const nodeIds = [...new Set(overview.nodeIds)].sort();
    if (nodeIds.length === 0) continue;
    const members = new Set(nodeIds);
    const forest = createUnionFind(nodeIds);

    for (const edge of existingPrereq) {
      if (!members.has(edge.sourceNodeId) || !members.has(edge.targetNodeId)) continue;
      forest.union(edge.sourceNodeId, edge.targetNodeId);
      emitted.add(edgeKey(edge.sourceNodeId, edge.targetNodeId));
    }

    for (const relation of input.engineeringRelations) {
      if (!isEngineeringPostRequisitePredicate(relation.predicate)) continue;
      if (relation.sourceId === relation.targetId) continue;
      if (!members.has(relation.sourceId) || !members.has(relation.targetId)) continue;
      forest.union(relation.sourceId, relation.targetId);
      requiredPairs.push({ sourceNodeId: relation.sourceId, targetNodeId: relation.targetId });
      mark({
        sourceNodeId: relation.sourceId,
        targetNodeId: relation.targetId,
        relationType: 'PREREQUISITE',
        strength: 'REQUIRED',
        domainKeys: [overview.domainId],
        provenance: 'engineering-post-requisite',
        engineeringRelationId: relation.id,
      });
    }

    const components = new Map<string, string[]>();
    for (const nodeId of nodeIds) {
      const root = forest.find(nodeId);
      const membersOfRoot = components.get(root) ?? [];
      membersOfRoot.push(nodeId);
      components.set(root, membersOfRoot);
    }
    const orderedComponents = [...components.values()]
      .map((ids) => ids.sort())
      .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));
    for (let index = 1; index < orderedComponents.length; index += 1) {
      const sourceNodeId = orderedComponents[index - 1][0]!;
      const targetNodeId = orderedComponents[index][0]!;
      mark({
        sourceNodeId,
        targetNodeId,
        relationType: 'PREREQUISITE',
        strength: 'RECOMMENDED',
        domainKeys: [overview.domainId],
        provenance: 'teaching-extension',
        engineeringRelationId: null,
      });
    }

    const connected = createUnionFind(nodeIds);
    for (const edge of existingPrereq) {
      if (members.has(edge.sourceNodeId) && members.has(edge.targetNodeId)) {
        connected.union(edge.sourceNodeId, edge.targetNodeId);
      }
    }
    for (const edge of [...adopted, ...extensions]) {
      if (!edge.domainKeys.includes(overview.domainId)) continue;
      if (!members.has(edge.sourceNodeId) || !members.has(edge.targetNodeId)) continue;
      connected.union(edge.sourceNodeId, edge.targetNodeId);
    }
    const roots = new Set(nodeIds.map((id) => connected.find(id)));
    if (roots.size > 1) {
      throw new OverviewTeachingOrderError(
        'overview-disconnected',
        `domain ${overview.domainId} overview is not weakly connected`,
      );
    }
  }

  const requiredNodes = [...new Set(requiredPairs.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]))];
  if (hasDirectedCycle(requiredNodes, requiredPairs)) {
    throw new OverviewTeachingOrderError(
      'required-cycle',
      'adopted REQUIRED teaching prerequisites contain a directed cycle',
    );
  }

  return { adopted, extensions };
}
