import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { KNOWLEDGE_PATH_MAX_STEPS } from '@/features/personalization/path-planning/knowledge-path-assembly';
import { assembleKnowledgePathPlan } from '@/features/personalization/path-planning/internal/knowledge-path-mount';
import { isInternalPlanningTitle } from '@/features/personalization/path-planning/planning-resource-titles';
import {
  loadGoalPlanningRegistry,
  sliceGoalPlanningUniverse,
} from '@/features/personalization/path-planning/planning-projection-index';
import { resolveConfiguredTeachingProjectionRoot } from '@/lib/teaching-projection/live-course-pointer';

const HASH = 'c'.repeat(64);

function hasLiveProjection() {
  try {
    return existsSync(join(resolveConfiguredTeachingProjectionRoot(process.cwd()), 'current.json'));
  } catch {
    return false;
  }
}

describe('goal planning universe', () => {
  it('keeps only the goal knowledge closure and resources bound inside it', () => {
    const target = 'ctc:v11g-5845390ded447e37f06ea222';
    const prior = 'ctc:prior-root-locus';
    const outsider = 'ctc:other-chapter';
    const universe = sliceGoalPlanningUniverse({
      goalId: 'root-locus-analysis-foundations',
      projectionId: `proj-${HASH}`,
      projectionHash: HASH,
      snapshotId: `snap-${HASH}`,
      snapshotHash: HASH,
      authorityReleaseId: 'authority-test',
      resources: [
        row('act:card:in-scope', 'card'),
        row('act:card:out-of-scope', 'card'),
        row('act:card:mixed', 'card'),
      ],
      bindings: [
        bind('act:card:in-scope', prior),
        bind('act:card:in-scope', target),
        bind('act:card:out-of-scope', outsider),
        bind('act:card:mixed', target),
        bind('act:card:mixed', outsider),
      ],
      edges: [{
        id: 'edge-1',
        sourceCanonicalId: prior,
        targetCanonicalId: target,
        strength: 'REQUIRED',
      }],
    });

    expect(universe.knowledgeIds).toEqual([prior, target]);
    expect(universe.resources.map((resource) => resource.identity.resourceId)).toEqual([
      'act:card:in-scope',
      'act:card:mixed',
    ]);
    expect(universe.resources.find((resource) => resource.identity.resourceId === 'act:card:mixed')?.canonicalIds)
      .toEqual([target]);
    expect(universe.edges).toEqual([{
      id: 'edge-1',
      sourceCanonicalId: prior,
      targetCanonicalId: target,
      strength: 'REQUIRED',
    }]);
  });

  it('leaves unregistered goals as an empty search space', () => {
    const universe = sliceGoalPlanningUniverse({
      goalId: 'unregistered-empty-goal',
      projectionId: `proj-${HASH}`,
      projectionHash: HASH,
      snapshotId: `snap-${HASH}`,
      snapshotHash: HASH,
      authorityReleaseId: 'authority-test',
      resources: [row('act:card:any', 'card')],
      bindings: [bind('act:card:any', 'ctc:other')],
      edges: [],
    });
    expect(universe.knowledgeIds).toEqual([]);
    expect(universe.resources).toEqual([]);
  });
});

describe.skipIf(!hasLiveProjection())('live teaching projection planning universe', () => {
  it('loads only the control-correction knowledge subset and its bound resources', () => {
    const loaded = loadGoalPlanningRegistry('control-correction');
    const knowledge = new Set(loaded.universe.knowledgeIds);
    expect(knowledge.size).toBeGreaterThan(0);
    expect(knowledge.size).toBeLessThan(50);
    expect(loaded.registry.nodes.length).toBe(loaded.universe.resources.length);
    expect(loaded.registry.nodes.length).toBeGreaterThan(0);
    expect(loaded.registry.nodes.length).toBeLessThan(1200);
    expect(loaded.universe.resources.every((resource) =>
      resource.canonicalIds.length > 0
      && resource.canonicalIds.every((id) => knowledge.has(id)),
    )).toBe(true);
    expect(loaded.universe.edges.every((edge) =>
      knowledge.has(edge.sourceCanonicalId) && knowledge.has(edge.targetCanonicalId),
    )).toBe(true);

    const plan = assembleKnowledgePathPlan({
      studentId: 'student-live',
      goal: { id: 'control-correction', title: '控制系统校正设计', knowledgeTargets: [] },
      learnerState: null,
      registry: loaded.registry,
      planningScope: {
        knowledgeIds: loaded.universe.knowledgeIds,
        edges: loaded.universe.edges,
      },
      constraints: { timeBudgetMinutes: 90, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: loaded.universe.edges,
      heuristicTimeoutMs: 80,
    });

    const mounted = [
      ...plan.mainPath,
      ...(plan.policyBundle?.paths.flatMap((path) => path.planNodes ?? []) ?? []),
    ];
    const resourceIds = new Set(loaded.universe.resources.map((resource) => resource.identity.resourceId));
    expect(mounted.every((node) => resourceIds.has(node.resourceFeatureRef?.resourceId ?? ''))).toBe(true);
    expect(mounted.every((node) => node.knowledgeCoverage.every((id) => knowledge.has(id)))).toBe(true);
  });

  it('clips the live skeleton from the default head and keeps style as a tendency', () => {
    const loaded = loadGoalPlanningRegistry('root-locus-analysis-foundations');
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-live',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: null,
      registry: loaded.registry,
      planningScope: {
        knowledgeIds: loaded.universe.knowledgeIds,
        edges: loaded.universe.edges,
      },
      constraints: { timeBudgetMinutes: 90, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: loaded.universe.edges,
      heuristicTimeoutMs: 80,
    });
    const paths = plan.policyBundle?.paths ?? [];
    expect(paths.every((path) => (path.planNodes?.length ?? 0) <= KNOWLEDGE_PATH_MAX_STEPS)).toBe(true);
    expect(plan.mainPath.length).toBeLessThanOrEqual(KNOWLEDGE_PATH_MAX_STEPS);
    expect(plan.policyFamily).toBe('foundation-remediation');
    const simulation = paths.find((path) => path.policyFamily === 'simulation-driven');
    const foundation = paths.find((path) => path.policyFamily === 'foundation-remediation');
    const simShare = shareOf(simulation?.planNodes ?? [], ['simulation', 'control_workbench', 'arena_task']);
    const foundationSimShare = shareOf(foundation?.planNodes ?? [], ['simulation', 'control_workbench', 'arena_task']);
    expect(simShare).toBeGreaterThan(foundationSimShare);
    expect(simShare).toBeLessThan(1);
    expect(simulation?.planNodes?.every((node) => node.type === 'simulation')).toBe(false);
    expect(plan.mainPath.every((node) => !isInternalPlanningTitle(node.title))).toBe(true);
  });

  it('maps the previously empty goals onto a non-empty live universe', () => {
    for (const goalId of ['simulation-validation-practice', 'ship-ocean-transfer-application'] as const) {
      const loaded = loadGoalPlanningRegistry(goalId);
      expect(loaded.universe.knowledgeIds.length).toBeGreaterThan(0);
      expect(loaded.universe.resources.length).toBeGreaterThan(0);
    }
  });
});

function shareOf(
  nodes: Array<{ type: string }>,
  kinds: readonly string[],
): number {
  if (nodes.length === 0) return 0;
  return nodes.filter((node) => kinds.includes(node.type)).length / nodes.length;
}

function row(resourceId: string, resourceType: string) {
  return {
    resourceId,
    resourceType,
    title: resourceId,
    sourcePath: null,
    bindingDigest: HASH,
    projectionStatus: 'ready',
  };
}

function bind(resourceId: string, canonicalId: string) {
  return {
    bindingId: `bind-${resourceId}-${canonicalId}`,
    resourceId,
    canonicalId,
    role: 'COVERS',
  };
}
