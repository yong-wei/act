import { describe, expect, it } from 'vitest';

import { assembleKnowledgePathPlan } from '@/features/personalization/path-planning/internal/knowledge-path-mount';
import { buildIndexedCandidateResourceRecords } from '@/features/personalization/path-planning/indexed-resource-verification';
import { attachPublishedResourcesToRegistry } from '@/lib/published-resource-planning';
import { buildResourceNodeRegistry } from '@/lib/resource-node-registry';
import type { PublishedResourceFeature, PublishedResourceFeatureIndex } from '@/lib/published-resource-reference';

const PROJECTION_HASH = 'a'.repeat(64);
const SNAPSHOT_HASH = 'b'.repeat(64);

function feature(
  resourceKey: string,
  canonicalIds: string[],
  type: PublishedResourceFeature['type'] = 'card',
  recommendable = true,
): PublishedResourceFeature {
  return {
    identity: {
      resourceId: `act:${type}:${resourceKey}`,
      projectionId: `proj-${PROJECTION_HASH}`,
      projectionHash: PROJECTION_HASH,
      snapshotId: `snap-${SNAPSHOT_HASH}`,
      snapshotHash: SNAPSHOT_HASH,
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
    estimatedMinutes: 10,
    estimateSource: 'policy-estimate',
    executable: true,
    recommendable,
    limitation: null,
    backend: { kind: 'route', href: `/learn/${resourceKey}` },
  };
}

function indexFor(resources: PublishedResourceFeature[]): PublishedResourceFeatureIndex {
  return {
    contract: 'published-resource-features/v1',
    indexId: 'd'.repeat(64),
    projectionId: `proj-${PROJECTION_HASH}`,
    projectionHash: PROJECTION_HASH,
    snapshotId: `snap-${SNAPSHOT_HASH}`,
    snapshotHash: SNAPSHOT_HASH,
    runtimeReleaseId: null,
    authorityReleaseId: 'authority-test',
    generatedAt: '2026-09-12T00:00:00.000Z',
    resources,
    prerequisiteEdges: [],
  };
}

describe('knowledge path mount', () => {
  it('walks teaching prerequisites and mounts bound resources without recommendable', () => {
    const rootLocus = 'ctc:v11g-5845390ded447e37f06ea222';
    const prior = 'ctc:prior-root-locus';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('card-prior', [prior], 'card', false),
      feature('card-locus', [rootLocus], 'card', false),
      feature('sim-locus', [rootLocus], 'simulation', true),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: null,
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: [{
        id: 'edge-1',
        sourceCanonicalId: prior,
        targetCanonicalId: rootLocus,
        strength: 'REQUIRED',
      }],
      now: new Date('2026-09-12T00:00:00.000Z'),
    });

    expect(plan.status).toBe('ready');
    expect(plan.mainPath.map((node) => node.resourceFeatureRef?.resourceId)).toEqual([
      'act:card:card-prior',
      'act:card:card-locus',
    ]);
    expect(plan.mainPath[0]?.knowledgeCoverage).toContain(prior);
    expect(plan.policyBundle?.paths).toHaveLength(3);
    const simulationPath = plan.policyBundle?.paths.find((path) => path.policyFamily === 'simulation-driven');
    expect(simulationPath?.planNodes?.map((node) => node.type)).toEqual(['knowledge_card', 'simulation']);
    expect(plan.explanations.selectedReasons).toContain('knowledge-skeleton');
    expect(plan.explanations.selectedReasons).toContain('bound-resource-fill');
    const published = plan.policyBundle?.paths.flatMap((path) => path.planNodes ?? [])
      .filter((node) => node.resourceFeatureRef) ?? [];
    const records = buildIndexedCandidateResourceRecords(
      [{ styleId: 'persistence', planNodes: published }],
      null,
      registry.featureIndex,
    );
    expect(records).toHaveLength(published.length);
    expect(records.every((record) => record.state === 'index-verified')).toBe(true);
  });

  it('keeps unbound goals empty instead of mixing the old resource pool', () => {
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('unrelated', ['ctc:other'], 'card'),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'simulation-validation-practice', title: '仿真验证实践', knowledgeTargets: ['跨模型验证比较_4_47006'] },
      learnerState: null,
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, { prerequisiteEdges: [] });

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('goal-knowledge-unbound');
  });

  it('ignores resources outside the goal knowledge closure even if the registry is fat', () => {
    const rootLocus = 'ctc:v11g-5845390ded447e37f06ea222';
    const prior = 'ctc:prior-root-locus';
    const unrelated = 'ctc:other-chapter';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('card-prior', [prior], 'card'),
      feature('card-locus', [rootLocus], 'card'),
      feature('card-unrelated', [unrelated], 'card'),
      feature('card-mixed', [rootLocus, unrelated], 'card'),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: null,
      registry,
      planningScope: {
        knowledgeIds: [prior, rootLocus],
        edges: [{
          id: 'edge-1',
          sourceCanonicalId: prior,
          targetCanonicalId: rootLocus,
          strength: 'REQUIRED',
        }],
      },
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, { heuristicTimeoutMs: 0 });

    const mountedIds = [
      ...plan.mainPath.map((node) => node.resourceFeatureRef?.resourceId),
      ...(plan.policyBundle?.paths.flatMap((path) => path.planNodes ?? [])
        .map((node) => node.resourceFeatureRef?.resourceId) ?? []),
    ];
    expect(mountedIds).not.toContain('act:card:card-unrelated');
    expect(plan.mainPath.flatMap((node) => node.knowledgeCoverage)).not.toContain(unrelated);
    expect(plan.explanations.selectedReasons).toContain('fill:deterministic-timeout');
  });

  it('fills each skeleton node from its bound resources and prefers the portrait type', () => {
    const rootLocus = 'ctc:v11g-5845390ded447e37f06ea222';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('card-locus', [rootLocus], 'card'),
      feature('sim-locus', [rootLocus], 'simulation'),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: {
        resourcePreference: { preferredModalities: ['simulation'], confidence: 'medium' },
      },
      registry,
      resourcePreferences: ['simulation'],
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, { prerequisiteEdges: [], heuristicTimeoutMs: 80 });

    const preferencePath = plan.policyBundle?.paths.find((path) => path.policyFamily === 'preference-matched');
    expect(preferencePath?.planNodes?.map((node) => node.type)).toEqual(['simulation']);
    expect(plan.mainPath.length).toBeGreaterThan(0);
    expect(plan.mainPath.every((node) => node.knowledgeCoverage.includes(rootLocus))).toBe(true);
  });
});
