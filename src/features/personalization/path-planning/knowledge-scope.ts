import type { TeachingPrerequisiteEdge } from './live-teaching-prerequisites';

export type KnowledgeExpansionMode = 'required' | 'required-recommended' | 'targets';

export function expandKnowledgeOrder(
  targets: readonly string[],
  edges: readonly TeachingPrerequisiteEdge[],
  mode: KnowledgeExpansionMode,
): string[] {
  if (targets.length === 0) return [];
  if (mode === 'targets') return [...targets];
  const allowed = mode === 'required'
    ? edges.filter((edge) => edge.strength === 'REQUIRED')
    : edges;
  return topologicalOrder(ancestors(targets, allowed), allowed);
}

/** Union of every style the planner may emit: targets plus all teaching-prerequisite ancestors. */
export function expandFeasibleKnowledgeIds(
  targets: readonly string[],
  edges: readonly TeachingPrerequisiteEdge[],
): string[] {
  return expandKnowledgeOrder(targets, edges, 'required-recommended');
}

export function ancestors(
  targets: readonly string[],
  edges: readonly TeachingPrerequisiteEdge[],
): Set<string> {
  const reverse = new Map<string, string[]>();
  for (const edge of edges) {
    const list = reverse.get(edge.targetCanonicalId) ?? [];
    list.push(edge.sourceCanonicalId);
    reverse.set(edge.targetCanonicalId, list);
  }
  const nodes = new Set(targets);
  const stack = [...targets];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const parent of reverse.get(current) ?? []) {
      if (!nodes.has(parent)) {
        nodes.add(parent);
        stack.push(parent);
      }
    }
  }
  return nodes;
}

export function topologicalOrder(
  nodes: ReadonlySet<string>,
  edges: readonly TeachingPrerequisiteEdge[],
): string[] {
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of nodes) {
    indegree.set(id, 0);
    adj.set(id, []);
  }
  for (const edge of edges) {
    if (!nodes.has(edge.sourceCanonicalId) || !nodes.has(edge.targetCanonicalId)) continue;
    adj.get(edge.sourceCanonicalId)!.push(edge.targetCanonicalId);
    indegree.set(edge.targetCanonicalId, (indegree.get(edge.targetCanonicalId) ?? 0) + 1);
  }
  const queue = [...nodes].filter((id) => (indegree.get(id) ?? 0) === 0).sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const next of (adj.get(current) ?? []).slice().sort()) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }
  for (const id of [...nodes].sort()) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}
