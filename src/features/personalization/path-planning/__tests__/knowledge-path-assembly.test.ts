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
  isAssertionLikeKnowledge,
  isCourseLikeResource,
  masteryByCanonicalId,
  planningResourceIdentity,
  rankBoundResources,
  scoreFilledPath,
  selectPriorityKnowledgeSkeleton,
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

  it('keeps recommended ancestors out of the executable required skeleton', () => {
    const advised = 'ctc:advised-only';
    const required = buildKnowledgeSkeleton(
      [TARGET],
      [
        { id: 'e-required', sourceCanonicalId: PRIOR, targetCanonicalId: TARGET, strength: 'REQUIRED' },
        { id: 'e-advised', sourceCanonicalId: advised, targetCanonicalId: TARGET, strength: 'RECOMMENDED' },
      ],
      'required',
    );
    expect(required.knowledgeIds).toEqual([PRIOR, TARGET]);
    expect(required.knowledgeIds).not.toContain(advised);

    const pool = buildKnowledgeSkeleton(
      [TARGET],
      [
        { id: 'e-required', sourceCanonicalId: PRIOR, targetCanonicalId: TARGET, strength: 'REQUIRED' },
        { id: 'e-advised', sourceCanonicalId: advised, targetCanonicalId: TARGET, strength: 'RECOMMENDED' },
      ],
      'required-recommended',
    );
    expect(pool.knowledgeIds).toContain(advised);
  });

  it('only maps mastery that has trusted confidence and evidence', () => {
    expect(masteryByCanonicalId({
      [PRIOR]: { posteriorMastery: 0.92, confidence: 0.8, evidenceCount: 3 },
      [TARGET]: { posteriorMastery: 0.99, confidence: 0.2, evidenceCount: 4 },
      [OUTSIDER]: { posteriorMastery: 0.99, confidence: 0.9, evidenceCount: 0 },
    })).toEqual({ [PRIOR]: 0.92 });
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

  it('clips a long skeleton from the default head and skips mastered prefix nodes', () => {
    const ancestors = Array.from({ length: 20 }, (_, index) => `ctc:ancestor-${String(index).padStart(2, '0')}`);
    const ids = [...ancestors, TARGET];
    const clipped = clipKnowledgeSkeleton(ids, [TARGET]);
    expect(clipped).toHaveLength(KNOWLEDGE_PATH_MAX_STEPS);
    expect(clipped[0]).toBe('ctc:ancestor-00');
    expect(clipped).not.toContain(TARGET);

    const remaining = selectPriorityKnowledgeSkeleton(ids, {
      'ctc:ancestor-00': 0.9,
      'ctc:ancestor-01': 0.8,
    });
    expect(remaining[0]).toBe('ctc:ancestor-02');
    expect(remaining).toHaveLength(KNOWLEDGE_PATH_MAX_STEPS);
    expect(remaining).not.toContain('ctc:ancestor-00');

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
    expect(fill.mounted[0]?.canonicalId).toBe('ctc:ancestor-00');
    expect(fill.mounted.reduce((sum, entry) =>
      sum + (entry.node.planningMetadata.estimatedTimeMinutes ?? 0), 0)).toBeLessThanOrEqual(50);
  });

  it('keeps style as a tendency and lowers an early wide course', () => {
    const early = feature('lesson-early', [PRIOR], 'step', 10);
    const late = feature('lesson-late', [TARGET], 'step', 10);
    const card = feature('card-prior', [PRIOR], 'card', 10);
    const targetCard = feature('card-target', [TARGET], 'card', 10);
    const nodes = nodesFor([early, late, card, targetCard]);
    const priorNodes = nodes.filter((node) => canonicalIds(node).includes(PRIOR));
    const earlyRank = rankBoundResources(priorNodes, {
      knowledgeIds: [PRIOR, TARGET],
      styleKinds: ['simulation'],
      preferredTypes: [],
      timeBudgetMinutes: 60,
      fillIndex: 0,
      currentCanonicalId: PRIOR,
    });
    const lateRank = rankBoundResources(
      nodes.filter((node) => canonicalIds(node).includes(TARGET)),
      {
        knowledgeIds: [PRIOR, TARGET],
        styleKinds: ['simulation'],
        preferredTypes: [],
        timeBudgetMinutes: 60,
        fillIndex: 1,
        currentCanonicalId: TARGET,
      },
    );
    expect(earlyRank[0]?.type).toBe('knowledge_card');
    expect(isCourseLikeResource(lateRank[0]!)).toBe(true);
  });

  it('drops assertion-like knowledge from the default skeleton and keeps explicit targets', () => {
    const statement = 'ctkg:knowledgestatement:deadbeefdeadbeef';
    const concept = 'ctc:root-locus-drawing';
    const labels = new Map([
      [PRIOR, '系统'],
      [statement, '属性断言：The zeros correspond to the signal transmission-blocking properties of the system.'],
      [concept, '根轨迹画法'],
      [TARGET, '根轨迹'],
    ]);
    const assertionIds = new Set([statement]);
    expect(isAssertionLikeKnowledge(statement, { label: labels.get(statement), assertionIds })).toBe(true);
    expect(isAssertionLikeKnowledge(concept, { label: labels.get(concept), assertionIds })).toBe(false);

    const remaining = selectPriorityKnowledgeSkeleton(
      [PRIOR, statement, concept, TARGET],
      {},
      { labels, assertionIds },
    );
    expect(remaining).toEqual([PRIOR, concept, TARGET]);

    const kept = selectPriorityKnowledgeSkeleton(
      [PRIOR, statement, concept],
      {},
      { labels, assertionIds, keepIds: [statement] },
    );
    expect(kept).toEqual([PRIOR, statement, concept]);
  });

  it('does not remount the same resource identity or consecutive identical title', () => {
    const mid = 'ctc:root-locus-zero';
    const late = 'ctc:root-locus-rule';
    const shared = 'act:simulation:shared-zero-effect';
    const nodes = nodesFor([
      feature('shared-a', [PRIOR], 'simulation', 15, { title: '传输零点', resourceId: shared, version: '1'.repeat(64) }),
      feature('shared-b', [mid], 'simulation', 15, { title: '传输零点', resourceId: shared, version: '2'.repeat(64) }),
      feature('same-title', [late], 'simulation', 15, { title: '传输零点' }),
      feature('card-mid', [mid], 'card', 10, { title: '零点位置' }),
      feature('card-late', [late], 'card', 10, { title: '根轨迹规则' }),
    ]);
    const consecutive = fillKnowledgeSkeleton({
      knowledgeIds: [PRIOR, late],
      byKnowledge: indexResourcesByKnowledge([PRIOR, late], nodes, canonicalIds),
      styleKinds: ['simulation'],
      preferredTypes: ['simulation'],
      timeBudgetMinutes: 90,
      deadline: Date.now() + 80,
    });
    expect(consecutive.mounted.map((entry) => entry.node.type)).toEqual(['simulation', 'knowledge_card']);
    expect(consecutive.mounted.map((entry) => entry.node.publishedResource?.title)).toEqual(['传输零点', '根轨迹规则']);
    const fill = fillKnowledgeSkeleton({
      knowledgeIds: [PRIOR, mid, late],
      byKnowledge: indexResourcesByKnowledge([PRIOR, mid, late], nodes, canonicalIds),
      styleKinds: ['simulation'],
      preferredTypes: ['simulation'],
      timeBudgetMinutes: 90,
      deadline: Date.now() + 80,
    });
    const identities = fill.mounted.map((entry) => planningResourceIdentity(entry.node));
    const titles = fill.mounted.map((entry) => entry.node.publishedResource?.title ?? entry.node.title);
    expect(identities.filter((id) => id === shared)).toHaveLength(1);
    expect(adjacentDuplicates(identities)).toEqual([]);
    expect(adjacentDuplicates(titles)).toEqual([]);
    expect(fill.mounted.map((entry) => entry.canonicalId)).toEqual([PRIOR, mid, late]);
    expect(fill.mounted[1]?.node.type).toBe('knowledge_card');
  });
});

function feature(
  resourceKey: string,
  canonicalIds: string[],
  type: PublishedResourceFeature['type'],
  minutes: number,
  extras: { title?: string; resourceId?: string; version?: string } = {},
): PublishedResourceFeature {
  return {
    identity: {
      resourceId: extras.resourceId ?? `act:${type}:${resourceKey}`,
      projectionId: `proj-${HASH}`,
      projectionHash: HASH,
      snapshotId: `snap-${HASH}`,
      snapshotHash: HASH,
      runtimeReleaseId: null,
    },
    version: extras.version ?? resourceKey.replace(/[^a-f0-9]/g, 'a').padEnd(64, '0').slice(0, 64),
    type,
    title: extras.title ?? resourceKey,
    summary: extras.title ?? resourceKey,
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

function adjacentDuplicates(values: string[]): string[] {
  return values.filter((value, index) => index > 0 && value === values[index - 1]);
}
