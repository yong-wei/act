import { describe, expect, it } from 'vitest';

import { planLearningPath } from '@/features/personalization/path-planning/application/plan-learning-path';
import { resolveEngineeringResourceOrder } from '@/features/personalization/path-planning/engineering-resource-order';
import { buildIndexedCandidateResourceRecords } from '../indexed-resource-verification';
import { attachPublishedResourcesToRegistry } from '@/lib/published-resource-planning';
import { buildResourceNodeRegistry, type ResourceNode, type ResourceNodeRegistry } from '@/lib/resource-node-registry';
import type { PublishedResourceFeature, PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';

const PROJECTION_HASH = 'a'.repeat(64);
const SNAPSHOT_HASH = 'b'.repeat(64);
const INDEX_ID = 'c'.repeat(64);

function feature(resourceKey: string, canonicalIds: string[], version: string): PublishedResourceFeature {
  return {
    identity: {
      resourceId: `act:card:${resourceKey}`,
      projectionId: `proj-${PROJECTION_HASH}`,
      projectionHash: PROJECTION_HASH,
      snapshotId: `snap-${SNAPSHOT_HASH}`,
      snapshotHash: SNAPSHOT_HASH,
      runtimeReleaseId: null,
    },
    version, type: 'card', title: `${resourceKey} resource`, summary: `${resourceKey} summary`,
    canonicalIds, bindingIds: [`binding-${resourceKey}`], bindingRoles: ['COVERS'], sourcePath: null,
    baselineDifficulty: null, estimatedMinutes: 10, estimateSource: 'policy-estimate', executable: true,
    recommendable: true, limitation: null, backend: { kind: 'route', href: '/knowledge' },
  };
}

function indexFor(
  resources: PublishedResourceFeature[] = [
    feature('a', ['A'], '1'.repeat(64)),
    feature('b', ['B'], '2'.repeat(64)),
    feature('c', ['C'], '3'.repeat(64)),
  ],
  edges: PublishedResourceFeatureIndex['prerequisiteEdges'] = [
    { id: 'engineering:A->B', sourceId: 'A', targetId: 'B', origin: 'ENGINEERING' },
    { id: 'engineering:B->C', sourceId: 'B', targetId: 'C', origin: 'ENGINEERING' },
  ],
): PublishedResourceFeatureIndex {
  return {
    contract: 'published-resource-features/v1', indexId: INDEX_ID,
    projectionId: `proj-${PROJECTION_HASH}`, projectionHash: PROJECTION_HASH,
    snapshotId: `snap-${SNAPSHOT_HASH}`, snapshotHash: SNAPSHOT_HASH,
    runtimeReleaseId: null, authorityReleaseId: 'authority-engineering-fixture',
    generatedAt: '2026-09-08T00:00:00.000Z', resources, prerequisiteEdges: edges,
  };
}

function attachedRegistry(index = indexFor()): ResourceNodeRegistry {
  return attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), index);
}

function canonicalNode(registry: ResourceNodeRegistry, canonicalId: string): ResourceNode {
  const node = registry.nodes.find((entry) => entry.publishedResource?.canonicalIds.includes(canonicalId));
  if (!node) throw new Error(`fixture node missing: ${canonicalId}`);
  return node;
}

describe('engineering resource prerequisite order', () => {
  it('keeps an exact resource target when other resources share all its knowledge points', () => {
    const alternative = feature('alternative', ['B'], '2'.repeat(64));
    alternative.estimatedMinutes = 1;
    const requested = feature('requested', ['B'], '3'.repeat(64));
    const generate = (recommendable: boolean) => planLearningPath({
      studentId: 'exact-resource', goal: { id: 'exact-resource', title: '目标资源', knowledgeTargets: ['act:card:requested'] },
      learnerState: null,
      registry: attachedRegistry(indexFor([feature('a', ['A'], '1'.repeat(64)), alternative, { ...requested, recommendable }],
        [{ id: 'a-b', sourceId: 'A', targetId: 'B', origin: 'ENGINEERING' }])),
      constraints: { timeBudgetMinutes: 35, privacyScopes: ['student-visible'], device: 'desktop' },
    });
    const plan = generate(true);
    expect(plan.mainPath.map(node => node.resourceFeatureRef?.resourceId)).toEqual(['act:card:a', 'act:card:requested']);
    expect(generate(false).mainPath).toEqual([]);
  });

  it('resolves exact published resource targets per request without leaking aliases between plans', () => {
    const registry = attachedRegistry();
    const generate = (target: string) => planLearningPath({
      studentId: 'alias-proof', goal: { id: 'alias-proof', title: target, knowledgeTargets: [target] },
      learnerState: null, registry,
      constraints: { timeBudgetMinutes: 35, privacyScopes: ['student-visible'], device: 'desktop' },
    });
    const resourceTarget = generate('act:card:c');
    expect(resourceTarget.mainPath.map(node => node.resourceFeatureRef?.resourceId)).toEqual([
      'act:card:a', 'act:card:b', 'act:card:c',
    ]);
    expect(generate('act:card:missing').mainPath).toEqual([]);
    expect(generate('act:card:a').mainPath.map(node => node.resourceFeatureRef?.resourceId)).toEqual(['act:card:a']);
    expect(registry.nodes.every(node => node.planningMetadata.goalCoverage === undefined)).toBe(true);
  });

  it('continues through earlier prerequisites when one resource covers both B and C', () => {
    const registry = attachedRegistry(indexFor([feature('a', ['A'], '1'.repeat(64)), feature('bc', ['B', 'C'], '2'.repeat(64))]));
    const ordered = resolveEngineeringResourceOrder({ registry, rankedCandidates: registry.nodes, targetCanonicalIds: ['C'] });
    expect(canonicalNode(ordered, 'C').planningMetadata.prerequisites).toEqual([canonicalNode(ordered, 'A').id]);
    expect(ordered.engineeringOrder?.constraints[0]).toMatchObject({ sourceCanonicalId: 'A', targetCanonicalId: 'B' });
  });

  it('chooses one available alternative when another prerequisite resource depends on an excluded node', () => {
    const registry = attachedRegistry(indexFor([
      feature('preferred-a', ['A'], '1'.repeat(64)), feature('alternative-a', ['A'], '2'.repeat(64)),
      feature('b', ['B'], '3'.repeat(64)), feature('excluded', ['X'], '4'.repeat(64)),
    ], [{ id: 'a-b', sourceId: 'A', targetId: 'B', origin: 'ENGINEERING' }]));
    registry.nodes[0].planningMetadata.prerequisites = [registry.nodes[3].id];
    const ordered = resolveEngineeringResourceOrder({ registry, rankedCandidates: registry.nodes.slice(0, 3), targetCanonicalIds: ['B'] });
    expect(canonicalNode(ordered, 'B').planningMetadata.prerequisites).toEqual([registry.nodes[1].id]);
    expect(ordered.engineeringOrder?.blockedNodeIds).toEqual([]);
  });

  it('preserves indexed identity and refuses to verify a borrowed resource reference', () => {
    const registry = attachedRegistry();
    const plan = planLearningPath({ studentId: 'proof', goal: { id: 'proof-goal', title: 'C', knowledgeTargets: ['C'] },
      learnerState: null, registry, constraints: { timeBudgetMinutes: 35, privacyScopes: ['student-visible'], device: 'desktop' } });
    expect(plan.mainPath.length).toBeGreaterThan(0);
    const records = buildIndexedCandidateResourceRecords([{ styleId: 'proof', planNodes: plan.mainPath }], null, registry.featureIndex);
    expect(records.every((record) => record.state === 'index-verified')).toBe(true);
    const borrowed = { ...plan.mainPath[0], resourceFeatureRef: plan.mainPath.at(-1)!.resourceFeatureRef };
    expect(buildIndexedCandidateResourceRecords([{ styleId: 'proof', planNodes: [borrowed] }], null, registry.featureIndex)[0].state).toBe('unverified');
  });

  it('does not recommend C when the budget cannot accommodate its uncompleted prerequisites', () => {
    const plan = planLearningPath({ studentId: 'budget', goal: { id: 'budget-goal', title: 'C', knowledgeTargets: ['C'] },
      learnerState: null, registry: attachedRegistry(), constraints: { timeBudgetMinutes: 15, privacyScopes: ['student-visible'], device: 'desktop' } });
    expect(plan.mainPath.some((node) => node.knowledgeCoverage.includes('C'))).toBe(false);
  });
  it('attaches immutable published resource nodes and resolves A -> B -> C closure', () => {
    const source = buildResourceNodeRegistry({});
    const index = indexFor();
    const registry = attachPublishedResourcesToRegistry(source, index);
    const originalNodeCount = source.nodes.length;
    const beforePrerequisites = registry.nodes.map((node) => [node.id, [...node.planningMetadata.prerequisites]]);

    expect(source.nodes).toHaveLength(originalNodeCount);
    expect(registry).not.toBe(source);
    expect(registry.nodes).toHaveLength(3);
    expect(registry.nodes.every((node) => node.publishedResource?.indexId === INDEX_ID)).toBe(true);
    expect(registry.nodes.every((node) => node.launchTarget?.startsWith('/learning-resources/'))).toBe(true);

    const ordered = resolveEngineeringResourceOrder({
      registry, rankedCandidates: registry.nodes, targetCanonicalIds: ['C'],
    });
    const a = canonicalNode(ordered, 'A');
    const b = canonicalNode(ordered, 'B');
    const c = canonicalNode(ordered, 'C');
    expect(b.planningMetadata.prerequisites).toEqual([a.id]);
    expect(c.planningMetadata.prerequisites).toEqual([b.id]);
    expect(ordered.engineeringOrder?.blockedNodeIds).toEqual([]);
    expect(ordered.engineeringOrder?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceCanonicalId: 'A', targetCanonicalId: 'B', prerequisiteNodeId: a.id, dependentNodeId: b.id }),
      expect.objectContaining({ sourceCanonicalId: 'B', targetCanonicalId: 'C', prerequisiteNodeId: b.id, dependentNodeId: c.id }),
    ]));
    expect(registry.nodes.map((node) => [node.id, node.planningMetadata.prerequisites])).toEqual(beforePrerequisites);
    expect(registry.engineeringOrder).toBeUndefined();
  });

  it('blocks a dependent when an engineering prerequisite resource is missing', () => {
    const index = indexFor(
      [feature('b', ['B'], '2'.repeat(64)), feature('c', ['C'], '3'.repeat(64))],
      [{ id: 'engineering:A->B', sourceId: 'A', targetId: 'B', origin: 'ENGINEERING' },
        { id: 'engineering:B->C', sourceId: 'B', targetId: 'C', origin: 'ENGINEERING' }],
    );
    const registry = attachedRegistry(index);
    const ordered = resolveEngineeringResourceOrder({
      registry, rankedCandidates: registry.nodes, targetCanonicalIds: ['C'],
    });

    expect(ordered.engineeringOrder?.issues).toContain('engineering-prerequisite-resource-missing');
    expect(ordered.engineeringOrder?.blockedNodeIds).toEqual(expect.arrayContaining([
      expect.stringContaining('published-resource:'),
    ]));
    expect(canonicalNode(ordered, 'C').eligibility.pathEligible).toBe(false);
  });

  it('fails closed on prerequisite cycles and satisfies completed or mastered concepts', () => {
    const cycleIndex = indexFor(undefined, [
      { id: 'engineering:A->B', sourceId: 'A', targetId: 'B', origin: 'ENGINEERING' },
      { id: 'engineering:B->A', sourceId: 'B', targetId: 'A', origin: 'ENGINEERING' },
    ]);
    const cycle = resolveEngineeringResourceOrder({
      registry: attachedRegistry(cycleIndex), rankedCandidates: attachedRegistry(cycleIndex).nodes,
      targetCanonicalIds: ['A'],
    });
    expect(cycle.engineeringOrder?.issues).toContain('engineering-prerequisite-cycle');
    expect(cycle.engineeringOrder?.blockedNodeIds.length).toBeGreaterThan(0);

    const registry = attachedRegistry();
    const c = canonicalNode(registry, 'C');
    const completed = resolveEngineeringResourceOrder({
      registry, rankedCandidates: registry.nodes, targetCanonicalIds: ['C'], completedNodeIds: [c.id],
    });
    expect(completed.engineeringOrder?.constraints).toEqual([]);

    const mastered = resolveEngineeringResourceOrder({
      registry, rankedCandidates: registry.nodes, targetCanonicalIds: ['C'], masteredCanonicalIds: new Set(['B']),
    });
    expect(canonicalNode(mastered, 'C').planningMetadata.prerequisites).toEqual([]);
    expect(mastered.engineeringOrder?.constraints).toEqual([]);
  });

  it('reports the expansion budget instead of recursing without a bound', () => {
    const registry = attachedRegistry(indexFor([feature('c', ['C'], '3'.repeat(64))], []));
    const node = registry.nodes[0];
    const ordered = resolveEngineeringResourceOrder({
      registry, rankedCandidates: Array.from({ length: 50001 }, () => node), targetCanonicalIds: ['C'],
    });

    expect(ordered.engineeringOrder?.issues).toContain('engineering-prerequisite-resolution-limited');
    expect(ordered.engineeringOrder?.blockedNodeIds).toContain(node.id);
  });

  it('preserves resource references through the real planLearningPath pipeline', () => {
    const registry = attachedRegistry();
    const plan = planLearningPath({
      studentId: 'engineering-fixture-student',
      goal: { id: 'engineering-fixture-goal', title: '完成 C', knowledgeTargets: ['A', 'B', 'C'] },
      learnerState: null,
      registry,
      constraints: {
        timeBudgetMinutes: 120,
        privacyScopes: ['student-visible', 'teacher-scoped', 'class-shared', 'public'],
        device: 'desktop',
      },
    });

    expect(plan.mainPath.map((node) => node.knowledgeCoverage)).toEqual([
      ['A'], ['B'], ['C'],
    ]);
    expect(plan.mainPath.map((node) => node.resourceFeatureRef?.resourceId)).toEqual([
      'act:card:a', 'act:card:b', 'act:card:c',
    ]);
    expect(plan.mainPath.every((node) => node.resourceFeatureRef?.indexId === INDEX_ID)).toBe(true);
    expect(plan.mainPath[1]?.prerequisiteNodeIds).toContain(plan.mainPath[0]?.nodeId);
    expect(plan.mainPath[2]?.prerequisiteNodeIds).toContain(plan.mainPath[1]?.nodeId);
    const bundleNodes = plan.policyBundle?.paths.flatMap((path) => path.planNodes ?? []) ?? [];
    expect(bundleNodes.every((node) => node.resourceFeatureRef?.indexId === INDEX_ID)).toBe(true);
  });
});
