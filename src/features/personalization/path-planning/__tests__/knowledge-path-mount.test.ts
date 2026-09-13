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
  title = resourceKey,
  extras: { resourceId?: string; version?: string } = {},
): PublishedResourceFeature {
  return {
    identity: {
      resourceId: extras.resourceId ?? `act:${type}:${resourceKey}`,
      projectionId: `proj-${PROJECTION_HASH}`,
      projectionHash: PROJECTION_HASH,
      snapshotId: `snap-${SNAPSHOT_HASH}`,
      snapshotHash: SNAPSHOT_HASH,
      runtimeReleaseId: null,
    },
    version: extras.version ?? resourceKey.replace(/[^a-f0-9]/g, 'a').padEnd(64, '0').slice(0, 64),
    type,
    title,
    summary: title,
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

  it('keeps unregistered goals empty instead of mixing the old resource pool', () => {
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('unrelated', ['ctc:other'], 'card'),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'unregistered-empty-goal', title: '未登记目标', knowledgeTargets: ['跨模型验证比较_4_47006'] },
      learnerState: null,
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, { prerequisiteEdges: [] });

    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('goal-knowledge-unbound');
  });

  it('uses foundation remediation as the cold-start main path and skips mastered prefix nodes', () => {
    const rootLocus = 'ctc:v11g-5845390ded447e37f06ea222';
    const prior = 'ctc:prior-root-locus';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('card-prior', [prior], 'card'),
      feature('card-locus', [rootLocus], 'card'),
      feature('sim-locus', [rootLocus], 'simulation'),
    ]));
    const cold = assembleKnowledgePathPlan({
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
    });
    expect(cold.policyFamily).toBe('foundation-remediation');
    expect(cold.mainPath[0]?.resourceFeatureRef?.resourceId).toBe('act:card:card-prior');

    const advanced = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: {
        knowledgeMastery: {
          tags: { [prior]: { posteriorMastery: 0.9, confidence: 0.8, evidenceCount: 3 } },
        },
      },
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: [{
        id: 'edge-1',
        sourceCanonicalId: prior,
        targetCanonicalId: rootLocus,
        strength: 'REQUIRED',
      }],
    });
    expect(advanced.explanations.fallbackReasons).toContain('mastered-knowledge-skipped');
    expect(advanced.mainPath.map((node) => node.resourceFeatureRef?.resourceId)).toEqual([
      'act:card:card-locus',
    ]);

    const untrusted = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: {
        knowledgeMastery: { tags: { [prior]: { posteriorMastery: 0.9, confidence: 0.2, evidenceCount: 1 } } },
      },
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: [{
        id: 'edge-1',
        sourceCanonicalId: prior,
        targetCanonicalId: rootLocus,
        strength: 'REQUIRED',
      }],
    });
    expect(untrusted.explanations.fallbackReasons ?? []).not.toContain('mastered-knowledge-skipped');
    expect(untrusted.mainPath[0]?.resourceFeatureRef?.resourceId).toBe('act:card:card-prior');
  });

  it('does not put recommended-only ancestors on the executable path', () => {
    const rootLocus = 'ctc:v11g-5845390ded447e37f06ea222';
    const prior = 'ctc:prior-root-locus';
    const advised = 'ctc:advised-only';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('card-prior', [prior], 'card'),
      feature('card-advised', [advised], 'card'),
      feature('card-locus', [rootLocus], 'card'),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: null,
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: [
        {
          id: 'edge-required',
          sourceCanonicalId: prior,
          targetCanonicalId: rootLocus,
          strength: 'REQUIRED',
        },
        {
          id: 'edge-advised',
          sourceCanonicalId: advised,
          targetCanonicalId: rootLocus,
          strength: 'RECOMMENDED',
        },
      ],
    });
    expect(plan.mainPath.map((node) => node.resourceFeatureRef?.resourceId)).toEqual([
      'act:card:card-prior',
      'act:card:card-locus',
    ]);
  });

  it('fails closed when the authority release for the live projection is missing', () => {
    const rootLocus = 'ctc:v11g-5845390ded447e37f06ea222';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature(
        'ctc-modeling-865eb1c8824e157c2f05a903',
        [rootLocus],
        'card',
        true,
        'ctc modeling-865eb1c8824e157c2f05a903',
      ),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: null,
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: [],
      authorityReleaseSetId: 'actkg-authoritative-candidate-control-theory-engineering-v9.99-r1',
    });
    expect(plan.status).toBe('fallback');
    expect(plan.mainPath).toEqual([]);
    expect(plan.policyBundle?.paths).toEqual([]);
    expect(plan.explanations.fallbackReasons).toContain('authority-release-unavailable');
    expect(plan.mainPath.some((node) => node.title.includes('ctc '))).toBe(false);
  });

  it('resolves internal step titles from authoritative labels', () => {
    const rootLocus = 'ctc:v11g-5845390ded447e37f06ea222';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature(
        'ctc-modeling-865eb1c8824e157c2f05a903',
        [rootLocus],
        'card',
        true,
        'ctc modeling-865eb1c8824e157c2f05a903',
      ),
    ]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: null,
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, { prerequisiteEdges: [] });
    expect(plan.mainPath[0]?.title).toBe('传递函数');
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

  it('skips assertion-like skeleton nodes and does not remount the same resource', () => {
    const rootLocus = 'ctc:v11g-5845390ded447e37f06ea222';
    const statement = 'ctkg:knowledgestatement:deadbeefdeadbeef';
    const next = 'ctc:root-locus-drawing';
    const shared = 'act:simulation:shared-zero-effect';
    const registry = attachPublishedResourcesToRegistry(buildResourceNodeRegistry({}), indexFor([
      feature('shared-a', [statement], 'simulation', true, '传输零点', { resourceId: shared, version: '1'.repeat(64) }),
      feature('shared-b', [rootLocus], 'simulation', true, '传输零点', { resourceId: shared, version: '2'.repeat(64) }),
      feature('card-locus', [rootLocus], 'card', true, '根轨迹'),
      feature('card-next', [next], 'card', true, '根轨迹画法'),
    ]));

    const plan = assembleKnowledgePathPlan({
      studentId: 'student-1',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: null,
      registry,
      constraints: { timeBudgetMinutes: 60, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: [
        { id: 'e1', sourceCanonicalId: statement, targetCanonicalId: rootLocus, strength: 'REQUIRED' },
        { id: 'e2', sourceCanonicalId: rootLocus, targetCanonicalId: next, strength: 'REQUIRED' },
      ],
    });

    expect(plan.explanations.fallbackReasons).toContain('assertion-knowledge-skipped');
    expect(plan.mainPath.flatMap((node) => node.reasonCodes ?? []).join(' ')).not.toContain(`knowledge:${statement}`);
    const allNodes = [
      ...plan.mainPath,
      ...(plan.policyBundle?.paths.flatMap((path) => path.planNodes ?? []) ?? []),
    ];
    expect(allNodes.flatMap((node) => node.reasonCodes ?? []).join(' ')).not.toContain(`knowledge:${statement}`);
    const simulation = plan.policyBundle?.paths.find((path) => path.policyFamily === 'simulation-driven');
    const simIds = simulation?.planNodes?.map((node) => node.resourceFeatureRef?.resourceId) ?? [];
    expect(simIds.filter((id) => id === shared)).toHaveLength(1);
    expect(adjacentSame(simulation?.planNodes?.map((node) => node.title) ?? [])).toEqual([]);
  });
});

function adjacentSame(values: string[]): string[] {
  return values.filter((value, index) => index > 0 && value === values[index - 1]);
}
