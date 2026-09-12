import { describe, expect, it } from 'vitest';

import { attachPublishedResourcesToRegistry } from '@/lib/published-resource-planning';
import { buildResourceNodeRegistry, type ResourceNode } from '@/lib/resource-node-registry';
import type { PublishedResourceFeature, PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';

import {
  KNOWLEDGE_PATH_MAX_STEPS,
  buildKnowledgeSkeleton,
  clipKnowledgeSkeleton,
  fillKnowledgeSkeleton,
  indexResourcesByKnowledge,
  rankBoundResources,
  scoreFilledPath,
} from '@/features/personalization/path-planning/knowledge-path-assembly';

const HASH = 'd'.repeat(64);
const TARGET = 'ctc:v11g-5845390ded447e37f06ea222';
const PRIOR = 'ctc:prior-root-locus';
const OUTSIDER = 'ctc:other-chapter';

describe('knowledge path assembly', () => {
  it('builds a prerequisite skeleton and indexes only in-scope bindings', () => {
    const nodes = nodesFor([
      feature('card-prior', [PRIOR], 'card', 8),
      feature('card-target', [TARGET], 'card', 10),
      feature('card-out', [OUTSIDER], 'card', 10),
    ]);
    const skeleton = buildKnowledgeSkeleton(
      [TARGET],
      [{ id: 'e1', sourceCanonicalId: PRIOR, targetCanonicalId: TARGET, strength: 'REQUIRED' }],
      'required',
    );
    expect(skeleton.knowledgeIds).toEqual([PRIOR, TARGET]);
    const index = indexResourcesByKnowledge(skeleton.knowledgeIds, nodes, canonicalIds);
    expect([...index.keys()]).toEqual([PRIOR, TARGET]);
    expect(index.get(PRIOR)?.map((node) => node.publishedResource?.identity.resourceId)).toEqual(['act:card:card-prior']);
    expect(index.get(TARGET)?.map((node) => node.publishedResource?.identity.resourceId)).toEqual(['act:card:card-target']);
  });

  it('fills every skeleton node from its bound pool and falls back when the heuristic has no time', () => {
    const nodes = nodesFor([
      feature('card-prior', [PRIOR], 'card', 8),
      feature('sim-prior', [PRIOR], 'simulation', 20),
      feature('card-target', [TARGET], 'card', 10),
      feature('sim-target', [TARGET], 'simulation', 25),
    ]);
    const byKnowledge = indexResourcesByKnowledge([PRIOR, TARGET], nodes, canonicalIds);
    const timeout = fillKnowledgeSkeleton({
      knowledgeIds: [PRIOR, TARGET],
      byKnowledge,
      styleKinds: ['knowledge_card', 'textbook_section'],
      preferredTypes: [],
      timeBudgetMinutes: 90,
      deadline: Date.now() - 1,
    });
    expect(timeout.method).toBe('deterministic-timeout');
    expect(timeout.mounted.map((entry) => entry.node.type)).toEqual(['knowledge_card', 'knowledge_card']);

    const heuristic = fillKnowledgeSkeleton({
      knowledgeIds: [PRIOR, TARGET],
      byKnowledge,
      styleKinds: ['simulation'],
      preferredTypes: ['simulation'],
      timeBudgetMinutes: 90,
      deadline: Date.now() + 80,
    });
    expect(heuristic.method).toBe('heuristic');
    expect(heuristic.mounted.map((entry) => entry.node.type)).toEqual(['simulation', 'simulation']);
    expect(heuristic.score).toBeGreaterThan(timeout.score);
  });

  it('ranks portrait-matching resources ahead of style-only ones', () => {
    const nodes = nodesFor([
      feature('card-target', [TARGET], 'card', 10),
      feature('sim-target', [TARGET], 'simulation', 20),
    ]);
    const ranked = rankBoundResources(nodes, {
      knowledgeIds: [TARGET],
      styleKinds: ['knowledge_card', 'simulation'],
      preferredTypes: ['simulation'],
      timeBudgetMinutes: 30,
    });
    expect(ranked[0]?.type).toBe('simulation');
    expect(scoreFilledPath([{ node: ranked[0]!, canonicalId: TARGET }], {
      knowledgeIds: [TARGET],
      styleKinds: ['simulation'],
      preferredTypes: ['simulation'],
      timeBudgetMinutes: 30,
    })).toBeGreaterThan(0);
  });

  it('clips a long skeleton from the target end and stops filling when the time budget is gone', () => {
    const ancestors = Array.from({ length: 20 }, (_, index) => `ctc:ancestor-${String(index).padStart(2, '0')}`);
    const ids = [...ancestors, TARGET];
    const clipped = clipKnowledgeSkeleton(ids, [TARGET]);
    expect(clipped).toHaveLength(KNOWLEDGE_PATH_MAX_STEPS);
    expect(clipped.at(-1)).toBe(TARGET);
    expect(clipped).not.toContain('ctc:ancestor-00');

    const nodes = nodesFor(clipped.map((id, index) =>
      feature(`card-${index}`, [id], 'card', 20),
    ));
    const fill = fillKnowledgeSkeleton({
      knowledgeIds: clipped,
      targetIds: [TARGET],
      byKnowledge: indexResourcesByKnowledge(clipped, nodes, canonicalIds),
      styleKinds: ['knowledge_card'],
      preferredTypes: [],
      timeBudgetMinutes: 50,
      deadline: Date.now() + 80,
    });
    expect(fill.mounted.length).toBeLessThanOrEqual(KNOWLEDGE_PATH_MAX_STEPS);
    expect(fill.mounted.at(-1)?.canonicalId).toBe(TARGET);
    expect(fill.mounted.slice(0, -1).reduce((sum, entry) =>
      sum + (entry.node.planningMetadata.estimatedTimeMinutes ?? 0), 0)).toBeLessThanOrEqual(50);
  });
});

function feature(
  resourceKey: string,
  canonicalIds: string[],
  type: PublishedResourceFeature['type'],
  minutes: number,
): PublishedResourceFeature {
  return {
    identity: {
      resourceId: `act:${type}:${resourceKey}`,
      projectionId: `proj-${HASH}`,
      projectionHash: HASH,
      snapshotId: `snap-${HASH}`,
      snapshotHash: HASH,
      runtimeReleaseId: null,
    },
    version: resourceKey.replace(/[^a-f0-9]/g, 'a').padEnd(64, '0').slice(0, 64),
    type,
    title: resourceKey,
    summary: resourceKey,
    canonicalIds,
    bindingIds: [`bind-${resourceKey}`],
    bindingRoles: ['COVERS'],
    sourcePath: null,
    baselineDifficulty: null,
    estimatedMinutes: minutes,
    estimateSource: 'policy-estimate',
    executable: true,
    recommendable: true,
    limitation: null,
    backend: { kind: 'route', href: `/learn/${resourceKey}` },
  };
}

function nodesFor(resources: PublishedResourceFeature[]): ResourceNode[] {
  const index: PublishedResourceFeatureIndex = {
    contract: 'published-resource-features/v1',
    indexId: HASH,
    projectionId: `proj-${HASH}`,
    projectionHash: HASH,
    snapshotId: `snap-${HASH}`,
    snapshotHash: HASH,
    runtimeReleaseId: null,
    authorityReleaseId: 'authority-test',
    generatedAt: '2026-09-12T00:00:00.000Z',
    resources,
    prerequisiteEdges: [],
  };
  return attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), index).nodes;
}

function canonicalIds(node: ResourceNode): string[] {
  return node.publishedResource?.canonicalIds ?? node.planningMetadata.knowledgeCoverage;
}
