import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeGraphDomainRequestUrl,
  buildKnowledgeGraphRootRequestUrl,
} from '../graph/knowledge-graph-request';

type CorridorModule = typeof import('../graph/selected-corridor');

const post = (
  id: string,
  sourceId: string,
  targetId: string,
  strength = 1,
  relation = 'prerequisite',
) => ({ id, sourceId, targetId, strength, relation });

async function loadCorridorModule(): Promise<CorridorModule | null> {
  return import('../graph/selected-corridor').catch(() => null);
}

async function requireCorridorModule(): Promise<CorridorModule | null> {
  const corridorModule = await loadCorridorModule();
  expect(corridorModule).not.toBeNull();
  return corridorModule;
}

describe('selected canonical knowledge graph corridor', () => {
  it('excludes every newly registered association type from corridor and motion eligibility', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const associationTypes = [
      'causes', 'demonstrates', 'equivalent_to', 'exemplifies', 'extends', 'has_stage',
      'precedes', 'produces', 'provides_context', 'refined_by', 'refines',
    ];
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links: associationTypes.map((relation, index) => post(
        `association-${index}`,
        'selected',
        `target-${index}`,
        1,
        relation,
      )),
      domainMemberNodeIds: new Set([
        'selected',
        ...associationTypes.map((_, index) => `target-${index}`),
      ]),
      domainIdByNodeId: new Map(),
    });

    expect(result.canonicalEdgeIds).toEqual([]);
    expect(result.motionEligibleEdgeIds).toEqual([]);
  });

  it('uses only authored canonical post-requisite edges and deduplicates shared branch segments', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links: [
        post('ancestor', 'ancestor', 'selected'),
        post('branch-a', 'selected', 'branch-a'),
        post('branch-b', 'selected', 'branch-b'),
        post('converge-a', 'branch-a', 'shared'),
        post('converge-b', 'branch-b', 'shared'),
        post('duplicate-segment', 'selected', 'branch-a', 0.2, 'follows'),
        post('association', 'selected', 'ignored-association', 10, 'related'),
        post('membership', 'selected', 'ignored-child', 10, 'contains'),
        post('chapter-link:chapter-node:domain-a->selected', 'chapter-node:domain-a', 'selected', 10, 'contains'),
      ],
      domainMemberNodeIds: new Set(['ancestor', 'selected', 'branch-a', 'branch-b', 'shared']),
      domainIdByNodeId: new Map(),
    });

    expect(result.canonicalNodeIds).toEqual(['ancestor', 'branch-a', 'branch-b', 'selected', 'shared']);
    expect(result.canonicalEdgeIds).toEqual([
      'ancestor', 'branch-a', 'branch-b', 'converge-a', 'converge-b',
    ]);
    expect(result.canonicalEdgeIds).not.toContain('duplicate-segment');
  });

  it('enforces four-level, 64-node, and 96-edge hard bounds with strength then stable-id capping', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const wide = Array.from({ length: 80 }, (_, index) => post(
      `wide-${String(index).padStart(2, '0')}`,
      'selected',
      `node-${String(index).padStart(2, '0')}`,
      index < 2 ? 10 : 1,
    ));
    const deep = Array.from({ length: 6 }, (_, index) => post(
      `deep-${index + 1}`,
      index === 0 ? 'selected' : `deep-node-${index}`,
      `deep-node-${index + 1}`,
      20,
    ));
    const wideResult = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links: wide,
      domainMemberNodeIds: new Set(['selected', ...wide.map((link) => link.targetId)]),
      domainIdByNodeId: new Map(),
    });
    const deepResult = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links: deep,
      domainMemberNodeIds: new Set(['selected', ...deep.map((link) => link.targetId)]),
      domainIdByNodeId: new Map(),
    });
    const firstLayer = Array.from({ length: 20 }, (_, index) => `first-${index}`);
    const secondLayer = Array.from({ length: 20 }, (_, index) => `second-${index}`);
    const dense = [
      ...firstLayer.map((targetId, index) => post(`root-${index}`, 'selected', targetId)),
      ...firstLayer.flatMap((sourceId) => secondLayer.map((targetId) => post(`${sourceId}-${targetId}`, sourceId, targetId))),
    ];
    const denseResult = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links: dense,
      domainMemberNodeIds: new Set(['selected', ...firstLayer, ...secondLayer]),
      domainIdByNodeId: new Map(),
    });

    expect(wideResult.canonicalNodeIds).toHaveLength(64);
    expect(wideResult.canonicalEdgeIds).toContain('wide-00');
    expect(wideResult.canonicalEdgeIds).toContain('wide-01');
    expect(deepResult.canonicalNodeIds).toContain('deep-node-4');
    expect(deepResult.canonicalNodeIds).not.toContain('deep-node-5');
    expect(denseResult.canonicalEdgeIds).toHaveLength(96);
  });

  it('clips canvas emphasis to the active domain and exposes explicit adjacent-domain navigation', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links: [
        post('inside', 'selected', 'inside'),
        post('outgoing', 'inside', 'outside-b'),
        post('incoming', 'outside-c', 'selected'),
      ],
      domainMemberNodeIds: new Set(['selected', 'inside']),
      domainIdByNodeId: new Map([
        ['selected', 'domain-a'],
        ['inside', 'domain-a'],
        ['outside-b', 'domain-b'],
        ['outside-c', 'domain-c'],
      ]),
    });

    expect(result.canvasVisibleNodeIds).toEqual(['inside', 'selected']);
    expect(result.canvasVisibleEdgeIds).toEqual(['inside']);
    expect(result.ancestorNodeIds).toEqual(['outside-c']);
    expect(result.descendantNodeIds).toEqual(['inside', 'outside-b']);
    expect(result.adjacentDomainNavigations).toEqual([
      { direction: 'ancestor', domainId: 'domain-c', edgeId: 'incoming', nodeId: 'outside-c' },
      { direction: 'descendant', domainId: 'domain-b', edgeId: 'outgoing', nodeId: 'outside-b' },
    ]);
  });

  it('separates complete domain membership from canvas visibility', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links: [
        post('visible', 'selected', 'visible-peer'),
        post('hidden-same-domain', 'visible-peer', 'hidden-peer'),
        post('cross-domain', 'hidden-peer', 'outside'),
      ],
      domainMemberNodeIds: new Set(['selected', 'visible-peer', 'hidden-peer']),
      visibleNodeIds: new Set(['selected', 'visible-peer']),
      domainIdByNodeId: new Map([
        ['hidden-peer', 'domain-a'],
        ['outside', 'domain-b'],
      ]),
    });

    expect(result.canvasVisibleNodeIds).toEqual(['selected', 'visible-peer']);
    expect(result.canvasVisibleEdgeIds).toEqual(['visible']);
    expect(result.motionEligibleEdgeIds).toEqual(['visible']);
    expect(result.adjacentDomainNavigations).toEqual([
      { direction: 'descendant', domainId: 'domain-b', edgeId: 'cross-domain', nodeId: 'outside' },
    ]);
  });

  it('marks every selected-corridor edge inside an SCC as motion suppressed', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'a',
      links: [post('a-b', 'a', 'b'), post('b-c', 'b', 'c'), post('c-a', 'c', 'a'), post('c-d', 'c', 'd')],
      domainMemberNodeIds: new Set(['a', 'b', 'c', 'd']),
      domainIdByNodeId: new Map(),
    });

    expect(result.motionSuppressedEdgeIds).toEqual(['a-b', 'b-c', 'c-a']);
    expect(result.motionEligibleEdgeIds).toEqual(['c-d']);
  });

  it('computes SCC suppression on the complete canonical graph before level capping', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const ring = Array.from({ length: 10 }, (_, index) => post(
      `ring-${index}`,
      `node-${index}`,
      `node-${(index + 1) % 10}`,
    ));
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'node-0',
      links: ring,
      domainMemberNodeIds: new Set(ring.flatMap((edge) => [edge.sourceId, edge.targetId])),
      domainIdByNodeId: new Map(),
    });

    expect(result.canonicalNodeIds).toHaveLength(9);
    expect(result.canonicalEdgeIds.length).toBeGreaterThan(0);
    expect(result.motionSuppressedEdgeIds).toEqual(result.canonicalEdgeIds);
  });

  it('retains full-graph SCC suppression when node and edge caps cut the cycle', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const nodeRing = Array.from({ length: 65 }, (_, index) => post(
      `node-ring-${String(index).padStart(2, '0')}`,
      `node-${index}`,
      `node-${(index + 1) % 65}`,
    ));
    const nodeCappedRing = [
      ...nodeRing,
      ...Array.from({ length: 64 }, (_, index) => post(
        `node-spoke-${String(index + 1).padStart(2, '0')}`,
        'node-0',
        `node-${index + 1}`,
      )),
    ];
    const denseNodes = Array.from({ length: 12 }, (_, index) => `dense-${index}`);
    const edgeCappedCycle = denseNodes.flatMap((sourceId, sourceIndex) => denseNodes
      .filter((_, targetIndex) => sourceIndex !== targetIndex)
      .map((targetId) => post(`dense-${sourceId}-${targetId}`, sourceId, targetId)));

    for (const [selectedNodeId, links] of [
      ['node-0', nodeCappedRing],
      ['dense-0', edgeCappedCycle],
    ] as const) {
      const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
        selectedNodeId,
        links,
        domainMemberNodeIds: new Set(links.flatMap((edge) => [edge.sourceId, edge.targetId])),
        domainIdByNodeId: new Map(),
      });
      expect(result.canonicalNodeIds.length).toBeLessThanOrEqual(64);
      expect(result.canonicalEdgeIds.length).toBeLessThanOrEqual(96);
      expect(result.motionSuppressedEdgeIds).toEqual(result.canonicalEdgeIds);
    }
  });

  it.each([
    [63, 63],
    [64, 64],
    [65, 64],
  ])('caps a %i-node candidate corridor at %i nodes', async (candidateNodeCount, expectedNodeCount) => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const links = Array.from({ length: candidateNodeCount - 1 }, (_, index) => post(
      `node-boundary-${String(index).padStart(2, '0')}`,
      'selected',
      `target-${String(index).padStart(2, '0')}`,
    ));
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links,
      domainMemberNodeIds: new Set(['selected', ...links.map((edge) => edge.targetId)]),
      domainIdByNodeId: new Map(),
    });
    expect(result.canonicalNodeIds).toHaveLength(expectedNodeCount);
  });

  it.each([95, 96, 97])('caps a %i-edge candidate corridor at the 96-edge boundary', async (candidateEdgeCount) => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const firstLayer = Array.from({ length: 12 }, (_, index) => `first-${index}`);
    const secondLayer = Array.from({ length: 12 }, (_, index) => `second-${index}`);
    const candidates = [
      ...firstLayer.map((targetId, index) => post(`root-${index}`, 'selected', targetId)),
      ...firstLayer.flatMap((sourceId) => secondLayer.map((targetId) => post(`${sourceId}-${targetId}`, sourceId, targetId))),
    ].slice(0, candidateEdgeCount);
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links: candidates,
      domainMemberNodeIds: new Set(['selected', ...firstLayer, ...secondLayer]),
      domainIdByNodeId: new Map(),
    });
    expect(result.canonicalEdgeIds).toHaveLength(Math.min(candidateEdgeCount, 96));
  });

  it('includes exactly four levels and excludes the fifth', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const links = Array.from({ length: 5 }, (_, index) => post(
      `level-${index + 1}`,
      index === 0 ? 'selected' : `level-node-${index}`,
      `level-node-${index + 1}`,
    ));
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links,
      domainMemberNodeIds: new Set(['selected', ...links.map((edge) => edge.targetId)]),
      domainIdByNodeId: new Map(),
    });
    expect(result.canonicalEdgeIds).toEqual(['level-1', 'level-2', 'level-3', 'level-4']);
    expect(result.canonicalNodeIds).toContain('level-node-4');
    expect(result.canonicalNodeIds).not.toContain('level-node-5');
  });

  it('deduplicates a real branch-convergence-shared-tail corridor', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const links = [
      post('branch-a', 'selected', 'a'),
      post('branch-b', 'selected', 'b'),
      post('converge-a', 'a', 'converged'),
      post('converge-b', 'b', 'converged'),
      post('shared-tail-1', 'converged', 'tail-1'),
      post('shared-tail-2', 'tail-1', 'tail-2'),
    ];
    const result = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      selectedNodeId: 'selected',
      links,
      domainMemberNodeIds: new Set(links.flatMap((edge) => [edge.sourceId, edge.targetId])),
      domainIdByNodeId: new Map(),
    });
    expect(result.canonicalEdgeIds).toEqual([
      'branch-a', 'branch-b', 'converge-a', 'converge-b', 'shared-tail-1', 'shared-tail-2',
    ]);
    expect(result.canonicalNodeIds.filter((nodeId) => nodeId === 'converged')).toHaveLength(1);
  });

  it('does not consume persisted LearningPath or ResourceNode path context', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const canonicalInput = {
      selectedNodeId: 'selected',
      links: [post('canonical', 'selected', 'canonical-target')],
      domainMemberNodeIds: new Set(['selected', 'canonical-target', 'persisted-target']),
      domainIdByNodeId: new Map<string, string>(),
    };
    const baseline = corridorModule.deriveSelectedKnowledgeGraphCorridor(canonicalInput);
    const withPersistedContext = corridorModule.deriveSelectedKnowledgeGraphCorridor({
      ...canonicalInput,
      persistedLearningPath: [{ sourceId: 'selected', targetId: 'persisted-target' }],
      resourceNodePathContext: { pathEligibility: true, plannedSegments: ['persisted-target'] },
    } as Parameters<typeof corridorModule.deriveSelectedKnowledgeGraphCorridor>[0] & Record<string, unknown>);

    expect(withPersistedContext).toEqual(baseline);
    expect(withPersistedContext.canonicalNodeIds).not.toContain('persisted-target');
  });

  it('keeps production API, system, cache, and inspector free of persisted path consumption', () => {
    const productionFiles = [
      'src/app/api/knowledge/graph/route.ts',
      'src/lib/knowledge-graph-source.ts',
      'src/features/knowledge/knowledge-graph-system.tsx',
      'src/features/knowledge/progressive-graph-cache.ts',
      'src/features/knowledge/resource-panel/resource-panel.tsx',
      'src/features/knowledge/graph/selected-corridor.ts',
    ];
    const forbidden = /LearningPath|persistedLearningPath|resourceNodePathContext|pathEligibility|plannedSegments|\/api\/learning-paths/u;
    productionFiles.forEach((file) => {
      expect(readFileSync(join(process.cwd(), file), 'utf8'), file).not.toMatch(forbidden);
    });
  });

  it('builds system graph requests without consuming persisted path request context', () => {
    expect(buildKnowledgeGraphRootRequestUrl({
      lessonId: '1-1',
      persistedLearningPath: 'path-1',
      resourceNodePathContext: { plannedSegments: ['hidden'] },
    } as Parameters<typeof buildKnowledgeGraphRootRequestUrl>[0])).toBe(
      '/api/knowledge/graph?mode=root&lessonId=1-1'
    );
    expect(buildKnowledgeGraphDomainRequestUrl({
      domainId: 'chapter-node:系统模型',
      pathEligibility: true,
    } as Parameters<typeof buildKnowledgeGraphDomainRequestUrl>[0])).toBe(
      '/api/knowledge/graph?mode=expansion&domainId=chapter-node%3A%E7%B3%BB%E7%BB%9F%E6%A8%A1%E5%9E%8B'
    );
  });

  it('is deterministic under input reordering and equal-strength branches', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const links = Array.from({ length: 70 }, (_, index) => post(
      `edge-${String(index).padStart(2, '0')}`,
      'selected',
      `node-${String(index).padStart(2, '0')}`,
      1,
    ));
    const input = {
      selectedNodeId: 'selected',
      domainMemberNodeIds: new Set(['selected', ...links.map((link) => link.targetId)]),
      domainIdByNodeId: new Map<string, string>(),
    };

    const forward = corridorModule.deriveSelectedKnowledgeGraphCorridor({ ...input, links });
    const reverse = corridorModule.deriveSelectedKnowledgeGraphCorridor({ ...input, links: [...links].reverse() });
    expect(reverse).toEqual(forward);
    expect(forward.canonicalEdgeIds.at(-1)).toBe('edge-62');
  });

  it('selects a deterministic traceable foreground without removing canonical corridor relations', async () => {
    const corridorModule = await requireCorridorModule();
    if (!corridorModule) return;
    const links = [
      post('ancestor-a', 'ancestor-a', 'selected', 1),
      post('ancestor-b', 'ancestor-b', 'selected', 0.9),
      post('ancestor-c', 'ancestor-c', 'selected', 0.8),
      post('ancestor-a-2', 'ancestor-a-2', 'ancestor-a', 1),
      post('descendant-a', 'selected', 'descendant-a', 1),
      post('descendant-b', 'selected', 'descendant-b', 0.9),
      post('descendant-c', 'selected', 'descendant-c', 0.8),
      post('descendant-a-2', 'descendant-a', 'descendant-a-2', 1),
      post('cross-link', 'ancestor-b', 'descendant-b', 1),
    ];
    const input = {
      selectedNodeId: 'selected',
      domainMemberNodeIds: new Set(links.flatMap((edge) => [edge.sourceId, edge.targetId])),
      domainIdByNodeId: new Map<string, string>(),
    };

    const forward = corridorModule.deriveSelectedKnowledgeGraphCorridor({ ...input, links });
    const reverse = corridorModule.deriveSelectedKnowledgeGraphCorridor({ ...input, links: [...links].reverse() });

    expect(reverse.primaryEdgeIds).toEqual(forward.primaryEdgeIds);
    expect(forward.canonicalEdgeIds).toHaveLength(8);
    expect(forward.primaryEdgeIds).toEqual([
      'ancestor-a', 'ancestor-a-2', 'ancestor-b',
      'descendant-a', 'descendant-a-2', 'descendant-b',
    ]);
    expect(forward.primaryEdgeIds.length).toBeLessThan(forward.canonicalEdgeIds.length);
    expect(forward.motionEligibleEdgeIds).toEqual(forward.primaryEdgeIds);
    expect(forward.primaryNodeIds).toEqual([
      'ancestor-a', 'ancestor-a-2', 'ancestor-b',
      'descendant-a', 'descendant-a-2', 'descendant-b', 'selected',
    ]);
  });
});
