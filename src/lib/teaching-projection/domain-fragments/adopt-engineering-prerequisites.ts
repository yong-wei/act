/**
 * Build-time teaching-order planner (#2007).
 * Ingests published prerequisites. Missing connections require explicit
 * course authoring decisions; ordering identifiers or units never makes facts.
 * Runtime loaders must not call this against live family shards.
 */

import { getKnowledgeGraphRelationContract } from '@/features/knowledge/graph/relation-contract';
import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';
import type { PrerequisiteStrength } from '../contracts';

/** Syllabus unit order from course-content/syllabus-refactor/blueprint.md. */
export const COURSE_UNIT_ORDER = [
  '1-1', '1-2', '1-3', '1-4', '1-5',
  '2-1', '2-2', '2-3', '2-4',
  '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9',
  '4-1', '4-2', '4-3', '4-4', '4-5', '4-6', '4-7',
  '5-1', '5-2', '5-3', '5-4', '5-5', '5-6',
] as const;

const UNIT_RANK = new Map(COURSE_UNIT_ORDER.map((unit, index) => [unit, index]));

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
  provenance: 'engineering-post-requisite' | 'course-prerequisite' | 'teaching-extension' | 'unscheduled-extension';
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

export function unitRank(unit: string | null | undefined): number {
  if (!unit) return COURSE_UNIT_ORDER.length;
  return UNIT_RANK.get(unit as typeof COURSE_UNIT_ORDER[number]) ?? COURSE_UNIT_ORDER.length;
}

function edgeKey(sourceNodeId: string, targetNodeId: string): string {
  return `${sourceNodeId}\u001f${targetNodeId}`;
}

function uniquePreserveOrder(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

export function planOverviewTeachingOrder(input: {
  overviews: ReadonlyArray<{ domainId: RegisteredPeerDomainId; nodeIds: readonly string[] }>;
  contentNodeIds: readonly string[];
  nodeUnits?: ReadonlyMap<string, string>;
  engineeringRelations?: ReadonlyArray<{
    id: string;
    predicate: string;
    sourceId: string;
    targetId: string;
  }>;
  existingTeaching: ReadonlyArray<{
    sourceNodeId: string;
    targetNodeId: string;
    relationType: string;
    strength?: PrerequisiteStrength;
  }>;
}): OverviewTeachingOrderPlan {
  const adopted: PlannedTeachingOrderEdge[] = [];
  const extensions: PlannedTeachingOrderEdge[] = [];
  const emitted = new Set<string>();
  const requiredPairs: Array<{ sourceNodeId: string; targetNodeId: string }> = [];
  const content = new Set(input.contentNodeIds);

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
    if (edge.provenance === 'teaching-extension' || edge.provenance === 'unscheduled-extension') {
      extensions.push(edge);
    } else {
      adopted.push(edge);
    }
  };

  const existingPrereq = input.existingTeaching.filter(
    (edge) => edge.relationType === 'PREREQUISITE' && edge.sourceNodeId !== edge.targetNodeId,
  );
  requiredPairs.push(...existingPrereq.filter((edge) => edge.strength === 'REQUIRED'));

  for (const overview of input.overviews) {
    const related = uniquePreserveOrder(overview.nodeIds.filter((id) => content.has(id)));
    if (related.length === 0) continue;
    const members = new Set(related);
    const forest = createUnionFind(related);

    for (const edge of existingPrereq) {
      if (!members.has(edge.sourceNodeId) || !members.has(edge.targetNodeId)) continue;
      forest.union(edge.sourceNodeId, edge.targetNodeId);
      emitted.add(edgeKey(edge.sourceNodeId, edge.targetNodeId));
    }

    for (const relation of input.engineeringRelations ?? []) {
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

    const roots = new Set(related.map((id) => forest.find(id)));
    if (roots.size > 1) {
      throw new OverviewTeachingOrderError(
        'overview-disconnected',
        `domain ${overview.domainId} needs explicit course-order/dependencies.jsonl decisions; automatic gap filling is forbidden`,
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
