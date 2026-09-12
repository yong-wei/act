import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assembleKnowledgePathPlan } from '@/features/personalization/path-planning/internal/knowledge-path-mount';
import { isAssertionLikeKnowledge } from '@/features/personalization/path-planning/knowledge-path-assembly';
import {
  DEFAULT_KNOWLEDGE_PATH_POLICY,
  type KnowledgePathPolicy,
} from '@/features/personalization/path-planning/knowledge-path-policy';
import {
  isInternalPlanningTitle,
  loadPlanningAssertionKnowledgeIds,
  loadPlanningKnowledgeLabels,
} from '@/features/personalization/path-planning/planning-resource-titles';
import { loadGoalPlanningRegistry } from '@/features/personalization/path-planning/planning-projection-index';
import { resolveConfiguredTeachingProjectionRoot } from '@/lib/teaching-projection/live-course-pointer';

const SIM_TYPES = ['simulation', 'control_workbench', 'arena_task'] as const;
const GOAL_IDS = [
  'control-correction',
  'root-locus-analysis-foundations',
  'frequency-response-foundations',
] as const;

function hasLiveProjection() {
  try {
    return existsSync(join(resolveConfiguredTeachingProjectionRoot(process.cwd()), 'current.json'));
  } catch {
    return false;
  }
}

describe.skipIf(!hasLiveProjection())('knowledge path quality on live projection', () => {
  it('locks the default policy after comparing nearby style and course weights', () => {
    const loaded = Object.fromEntries(GOAL_IDS.map((goalId) => [goalId, loadGoalPlanningRegistry(goalId)]));
    const defaultScore = scorePolicy(DEFAULT_KNOWLEDGE_PATH_POLICY, loaded);
    expect(defaultScore.accepted).toBe(true);

    const neighbors: Array<Partial<KnowledgePathPolicy>> = [
      { styleKindBonus: 4 },
      { styleKindBonus: 10 },
      { courseEarlyPenalty: 4 },
      { courseEarlyPenalty: 12 },
      { masterySkipThreshold: 0.5 },
      { masterySkipThreshold: 0.8 },
    ];
    const neighborScores = neighbors.map((override) =>
      scorePolicy({ ...DEFAULT_KNOWLEDGE_PATH_POLICY, ...override }, loaded),
    );
    const better = neighborScores.filter((score) =>
      score.accepted && score.total > defaultScore.total + 0.08,
    );
    expect(better).toEqual([]);
    expect(defaultScore.simShareGap).toBeGreaterThan(0);
    expect(defaultScore.internalTitleCount).toBe(0);
  });

  it('skips a mastered live prefix and keeps courses out of the cold-start head', () => {
    const loaded = loadGoalPlanningRegistry('control-correction');
    const head = loaded.universe.knowledgeIds.slice(0, 6);
    const mastery = Object.fromEntries(head.map((id) => [id, { posteriorMastery: 0.92 }]));
    const advanced = assembleKnowledgePathPlan({
      studentId: 'student-seeded',
      goal: { id: 'control-correction', title: '控制系统校正设计', knowledgeTargets: [] },
      learnerState: { knowledgeMastery: { tags: mastery } },
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
    expect(advanced.explanations.fallbackReasons).toContain('mastered-knowledge-skipped');
    expect(mountedKnowledgeId(advanced.mainPath[0])).toBeTruthy();
    expect(head).not.toContain(mountedKnowledgeId(advanced.mainPath[0]));
    expect(courseHeadShare(advanced.mainPath)).toBeLessThan(0.35);
  });

  it('keeps assertion statements out of the live skeleton and does not remount the same resource', () => {
    const loaded = loadGoalPlanningRegistry('root-locus-analysis-foundations');
    const labels = loadPlanningKnowledgeLabels();
    const assertionIds = loadPlanningAssertionKnowledgeIds();
    const conceptual = loaded.universe.knowledgeIds.filter((id) =>
      !isAssertionLikeKnowledge(id, { label: labels.get(id), assertionIds }),
    );
    const head = conceptual.slice(0, 6);
    const mastery = Object.fromEntries(head.map((id) => [id, { posteriorMastery: 0.92 }]));
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-seeded',
      goal: { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: { knowledgeMastery: { tags: mastery } },
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

    expect(plan.explanations.fallbackReasons).toContain('assertion-knowledge-skipped');
    const paths = [plan.mainPath, ...(plan.policyBundle?.paths.map((path) => path.planNodes ?? []) ?? [])];
    for (const nodes of paths) {
      const knowledgeIds = nodes.map(mountedKnowledgeId).filter((id): id is string => Boolean(id));
      expect(knowledgeIds.every((id) =>
        !isAssertionLikeKnowledge(id, { label: labels.get(id), assertionIds }),
      )).toBe(true);
      expect(adjacentSame(nodes.map((node) => node.resourceFeatureRef?.resourceId ?? node.resourceId))).toEqual([]);
      expect(adjacentSame(nodes.map((node) => node.title))).toEqual([]);
    }
    expect(plan.mainPath.length).toBeGreaterThan(0);
  });
});

function scorePolicy(
  policy: KnowledgePathPolicy,
  loaded: Record<string, ReturnType<typeof loadGoalPlanningRegistry>>,
) {
  let simShareGap = 0;
  let exclusiveSim = 0;
  let foundationMain = 0;
  let internalTitleCount = 0;
  let earlyCourseShare = 0;
  let samples = 0;

  for (const goalId of GOAL_IDS) {
    const current = loaded[goalId]!;
    const plan = assembleKnowledgePathPlan({
      studentId: 'student-experiment',
      goal: { id: goalId, title: goalId, knowledgeTargets: [] },
      learnerState: null,
      registry: current.registry,
      planningScope: {
        knowledgeIds: current.universe.knowledgeIds,
        edges: current.universe.edges,
      },
      constraints: { timeBudgetMinutes: 90, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: current.universe.edges,
      heuristicTimeoutMs: 80,
      policy,
    });
    const simulation = plan.policyBundle?.paths.find((path) => path.policyFamily === 'simulation-driven');
    const foundation = plan.policyBundle?.paths.find((path) => path.policyFamily === 'foundation-remediation');
    const simShare = shareOf(simulation?.planNodes ?? [], SIM_TYPES);
    const foundationSimShare = shareOf(foundation?.planNodes ?? [], SIM_TYPES);
    simShareGap += simShare - foundationSimShare;
    if (simShare >= 0.999 && (simulation?.planNodes?.length ?? 0) > 1) exclusiveSim += 1;
    if (plan.policyFamily === 'foundation-remediation') foundationMain += 1;
    internalTitleCount += [...plan.mainPath, ...(simulation?.planNodes ?? []), ...(foundation?.planNodes ?? [])]
      .filter((node) => isInternalPlanningTitle(node.title)).length;
    earlyCourseShare += courseHeadShare(plan.mainPath);
    samples += 1;
  }

  const accepted = samples > 0
    && simShareGap / samples > 0
    && exclusiveSim === 0
    && foundationMain === samples
    && internalTitleCount === 0
    && earlyCourseShare / samples < 0.4;
  return {
    accepted,
    total: (simShareGap / Math.max(samples, 1))
      - exclusiveSim
      + foundationMain
      - internalTitleCount * 0.5
      - (earlyCourseShare / Math.max(samples, 1)),
    simShareGap: simShareGap / Math.max(samples, 1),
    exclusiveSim,
    foundationMain,
    internalTitleCount,
    earlyCourseShare: earlyCourseShare / Math.max(samples, 1),
  };
}

function shareOf(nodes: Array<{ type: string }>, kinds: readonly string[]): number {
  if (nodes.length === 0) return 0;
  return nodes.filter((node) => kinds.includes(node.type)).length / nodes.length;
}

function mountedKnowledgeId(node: { reasonCodes?: string[] } | undefined): string | undefined {
  return node?.reasonCodes?.find((code) => code.startsWith('knowledge:'))?.slice('knowledge:'.length);
}

function adjacentSame(values: string[]): string[] {
  return values.filter((value, index) => index > 0 && value === values[index - 1]);
}

function courseHeadShare(nodes: Array<{ type: string }>): number {
  if (nodes.length === 0) return 0;
  const head = nodes.slice(0, Math.max(1, Math.ceil(nodes.length * 0.55)));
  return head.filter((node) => node.type === 'lesson_step').length / head.length;
}
