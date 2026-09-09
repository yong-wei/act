import type { ResourceNode, ResourceNodeRegistry } from '@/lib/resource-node-registry';
import type { EngineeringResourceOrderEvidence, PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';

type Constraint = EngineeringResourceOrderEvidence['constraints'][number];
interface Fragment { dependencies: Map<string, Set<string>>; constraints: Constraint[] }

function mergeFragment(target: Fragment, source: Fragment): void {
  for (const [id, dependencies] of source.dependencies) {
    const merged = target.dependencies.get(id) ?? new Set<string>();
    for (const dependency of dependencies) merged.add(dependency);
    target.dependencies.set(id, merged);
  }
  target.constraints.push(...source.constraints);
}

function isAcyclic(edges: readonly { sourceId: string; targetId: string }[]): boolean {
  const outgoing = new Map<string, Set<string>>();
  const degree = new Map<string, number>();
  for (const edge of edges) {
    const targets = outgoing.get(edge.sourceId) ?? new Set<string>();
    if (!targets.has(edge.targetId)) degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
    targets.add(edge.targetId); outgoing.set(edge.sourceId, targets);
    if (!degree.has(edge.sourceId)) degree.set(edge.sourceId, 0);
  }
  const queue = [...degree].filter(([, count]) => count === 0).map(([id]) => id);
  for (let offset = 0; offset < queue.length; offset += 1) {
    for (const target of outgoing.get(queue[offset]) ?? []) {
      degree.set(target, degree.get(target)! - 1);
      if (degree.get(target) === 0) queue.push(target);
    }
  }
  return queue.length === degree.size;
}

export function resolveEngineeringResourceOrder(input: {
  registry: ResourceNodeRegistry;
  rankedCandidates: readonly ResourceNode[];
  targetCanonicalIds: readonly string[];
  completedNodeIds?: readonly string[];
  masteredCanonicalIds?: ReadonlySet<string>;
}): ResourceNodeRegistry {
  const index = input.registry.featureIndex;
  if (!index || input.targetCanonicalIds.length === 0) return input.registry;
  const incoming = new Map<string, PublishedResourceFeatureIndex['prerequisiteEdges']>();
  for (const edge of index.prerequisiteEdges) {
    const list = incoming.get(edge.targetId) ?? [];
    list.push(edge); incoming.set(edge.targetId, list);
  }
  const targets = new Set(input.targetCanonicalIds);
  const completed = new Set(input.completedNodeIds ?? []);
  const availableNodes = new Map(input.rankedCandidates.map((node) => [node.id, node]));
  const nativeReadiness = new Map<string, boolean>();
  function nativePrerequisitesAvailable(id: string, visiting: ReadonlySet<string> = new Set()): boolean {
    if (completed.has(id)) return true;
    if (visiting.has(id)) return false;
    const cached = nativeReadiness.get(id);
    if (cached !== undefined) return cached;
    const node = availableNodes.get(id);
    const next = new Set(visiting); next.add(id);
    const ready = Boolean(node && node.planningMetadata.prerequisites.every((dependency) => nativePrerequisitesAvailable(dependency, next)));
    nativeReadiness.set(id, ready);
    return ready;
  }
  const coverage = (node: ResourceNode) => node.publishedResource?.canonicalIds ?? node.planningMetadata.knowledgeCoverage;
  const candidates = new Map<string, ResourceNode[]>();
  for (const node of input.rankedCandidates) {
    for (const canonicalId of coverage(node)) {
      const list = candidates.get(canonicalId) ?? [];
      list.push(node); candidates.set(canonicalId, list);
    }
  }
  // Rank for the prerequisite concept itself: a course-wide binding must not
  // displace its focused learning unit merely because it also covers the final goal.
  for (const list of candidates.values()) list.sort((a, b) => coverage(a).length - coverage(b).length);
  const satisfied = new Set(input.masteredCanonicalIds ?? []);
  for (const node of input.rankedCandidates) {
    if (completed.has(node.id)) for (const id of coverage(node)) satisfied.add(id);
  }
  const result: Fragment = { dependencies: new Map(), constraints: [] };
  const blocked = new Set<string>();
  const issues = new Set<string>();
  const graphValid = isAcyclic(index.prerequisiteEdges);
  if (!graphValid) issues.add('engineering-prerequisite-cycle');
  let expansions = 0;
  function solve(node: ResourceNode, concept: string, visiting: ReadonlySet<string>): Fragment | null {
    if (visiting.has(node.id) || ++expansions > 50000 || !nativePrerequisitesAvailable(node.id)) return null;
    const next = new Set(visiting); next.add(node.id);
    const local: Fragment = { dependencies: new Map(), constraints: [] };
    const own = new Set(node.planningMetadata.prerequisites);
    const pendingConcepts = [concept];
    const expandedConcepts = new Set<string>();
    for (let offset = 0; offset < pendingConcepts.length; offset += 1) {
      const currentConcept = pendingConcepts[offset];
      if (expandedConcepts.has(currentConcept)) continue;
      expandedConcepts.add(currentConcept);
      for (const edge of incoming.get(currentConcept) ?? []) {
      // A single learning unit may cover the prerequisite and the target together.
      if (satisfied.has(edge.sourceId)) continue;
      if (coverage(node).includes(edge.sourceId)) {
        pendingConcepts.push(edge.sourceId);
        continue;
      }
      let selected: ResourceNode | undefined;
      let prerequisite: Fragment | null = null;
      for (const candidate of candidates.get(edge.sourceId) ?? []) {
        if (next.has(candidate.id)) continue;
        const fragment = solve(candidate, edge.sourceId, next);
        if (fragment) { selected = candidate; prerequisite = fragment; break; }
      }
      if (!selected || !prerequisite) return null;
      mergeFragment(local, prerequisite);
      own.add(selected.id);
      local.constraints.push({ relationId: edge.id, sourceCanonicalId: edge.sourceId,
        targetCanonicalId: edge.targetId, prerequisiteNodeId: selected.id, dependentNodeId: node.id, source: 'ENGINEERING' });
      }
    }
    local.dependencies.set(node.id, own);
    return local;
  }
  for (const node of input.rankedCandidates) {
    const goals = coverage(node).filter((id) => targets.has(id));
    if (!goals.length || completed.has(node.id)) continue;
    const local: Fragment = { dependencies: new Map(), constraints: [] };
    let valid = graphValid;
    for (const goal of goals) {
      const fragment = valid ? solve(node, goal, new Set()) : null;
      if (!fragment) { valid = false; break; }
      mergeFragment(local, fragment);
    }
    if (valid) mergeFragment(result, local);
    else blocked.add(node.id);
  }
  if (blocked.size && graphValid) issues.add(expansions > 50000
    ? 'engineering-prerequisite-resolution-limited' : 'engineering-prerequisite-resource-missing');
  const resourceEdges = [...result.dependencies].flatMap(([targetId, sources]) =>
    [...sources].map((sourceId) => ({ sourceId, targetId })));
  if (!isAcyclic(resourceEdges)) {
    for (const id of result.dependencies.keys()) blocked.add(id);
    issues.add('engineering-resource-order-conflict');
  }
  // A blocked prerequisite cannot silently make a dependent candidate appear ready.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, dependencies] of result.dependencies) {
      if (!blocked.has(id) && [...dependencies].some((dependency) => blocked.has(dependency))) {
        blocked.add(id); changed = true;
      }
    }
  }
  const constraints = result.constraints.filter((entry) => !blocked.has(entry.dependentNodeId) && !blocked.has(entry.prerequisiteNodeId));
  return {
    ...input.registry,
    nodes: input.registry.nodes.map((node) => ({ ...node,
      planningMetadata: { ...node.planningMetadata, prerequisites: [...(result.dependencies.get(node.id)
        ?? new Set(node.planningMetadata.prerequisites))].sort() },
      eligibility: blocked.has(node.id) ? { ...node.eligibility, pathEligible: false,
        reasons: [...node.eligibility.reasons, 'invalid-prerequisite'],
        auditIssues: [...node.eligibility.auditIssues, { code: 'invalid-prerequisite' as const,
          severity: 'blocking' as const, message: '所需的工程前置知识暂缺可用资源，或资源顺序无法成立。' }],
      } : node.eligibility,
    })),
    engineeringOrder: {
      requiredNodeIds: [...new Set(constraints.map((entry) => entry.prerequisiteNodeId))],
      blockedNodeIds: [...blocked], constraints: [...new Map(constraints.map((entry) => [
        [entry.relationId, entry.prerequisiteNodeId, entry.dependentNodeId].join('|'), entry,
      ])).values()], issues: [...issues],
    },
  };
}
