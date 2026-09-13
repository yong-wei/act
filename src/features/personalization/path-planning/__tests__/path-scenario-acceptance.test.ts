import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAdaptivePathOptionDisplays } from '@/features/personalization/path-planning/adaptive-path-option-display';
import { goalCanonicalIds } from '@/features/personalization/path-planning/goal-canonical-knowledge';
import { assembleKnowledgePathPlan } from '@/features/personalization/path-planning/internal/knowledge-path-mount';
import {
  buildKnowledgeSkeleton,
  selectPriorityKnowledgeSkeleton,
} from '@/features/personalization/path-planning/knowledge-path-assembly';
import {
  isInternalPlanningTitle,
  loadPlanningAssertionKnowledgeIds,
  loadPlanningKnowledgeLabels,
} from '@/features/personalization/path-planning/planning-resource-titles';
import { loadGoalPlanningRegistry } from '@/features/personalization/path-planning/planning-projection-index';
import {
  PATH_SCENARIO_GOALS,
  PATH_SCENARIO_GOAL_TITLES,
  masteryTagsForScenario,
  type PathScenarioCohort,
} from '@/features/personalization/path-planning/scenario-mastery-fixtures';
import { resolveConfiguredTeachingProjectionRoot } from '@/lib/teaching-projection/live-course-pointer';

const COHORTS: PathScenarioCohort[] = ['zero', 'partial', 'mastered'];
const OPAQUE_TITLE = /(?:lesson\d+-[a-z0-9-]*[a-z0-9]{16,}|[a-z]{2,}[a-z0-9]{18,})/iu;

function hasLiveProjection() {
  try {
    return existsSync(join(resolveConfiguredTeachingProjectionRoot(process.cwd()), 'current.json'));
  } catch {
    return false;
  }
}

function buildGoalPlans(goalId: (typeof PATH_SCENARIO_GOALS)[number]) {
  const loaded = loadGoalPlanningRegistry(goalId);
  const targets = goalCanonicalIds(goalId);
  const feasible = new Set(loaded.universe.knowledgeIds);
  const expanded = buildKnowledgeSkeleton(targets, loaded.universe.edges, 'required')
    .knowledgeIds
    .filter((id) => feasible.has(id));
  const ordered = selectPriorityKnowledgeSkeleton(expanded, {}, {
    labels: loadPlanningKnowledgeLabels(),
    assertionIds: loadPlanningAssertionKnowledgeIds(),
    keepIds: targets,
  });
  const plans = Object.fromEntries(COHORTS.map((cohort) => {
    const tags = masteryTagsForScenario(cohort, ordered);
    const plan = assembleKnowledgePathPlan({
      studentId: `scenario-${cohort}`,
      goal: { id: goalId, title: PATH_SCENARIO_GOAL_TITLES[goalId], knowledgeTargets: [] },
      learnerState: Object.keys(tags).length
        ? { knowledgeMastery: { tags } }
        : null,
      registry: loaded.registry,
      planningScope: {
        knowledgeIds: loaded.universe.knowledgeIds,
        edges: loaded.universe.edges,
      },
      constraints: { timeBudgetMinutes: 180, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: loaded.universe.edges,
      heuristicTimeoutMs: 80,
    });
    return [cohort, plan] as const;
  }));
  return { ordered, plans };
}

const goalFixtures = hasLiveProjection()
  ? Object.fromEntries(PATH_SCENARIO_GOALS.map((goalId) => [goalId, buildGoalPlans(goalId)]))
  : {};

describe.skipIf(!hasLiveProjection())('path scenario acceptance', () => {
  for (const goalId of PATH_SCENARIO_GOALS) {
    const { ordered, plans } = goalFixtures[goalId]!;

    for (const cohort of COHORTS) {
      it(`${cohort} / ${PATH_SCENARIO_GOAL_TITLES[goalId]}`, () => {
        const plan = plans[cohort]!;
        const options = plan.policyBundle?.paths ?? [];
        expect(options.length).toBeGreaterThanOrEqual(1);
        const displays = buildAdaptivePathOptionDisplays(options.map((path) => ({
          optionId: path.styleId,
          label: path.label,
          nodeIds: path.nodeIds,
          nodeSummaries: path.nodeSummaries,
          lockedNodeIds: path.lockedNodeIds,
          readinessSummary: path.readinessSummary,
          targetDeficits: path.targetDeficits,
          evidenceBasis: path.evidenceBasis,
          resourceMix: path.resourceMix,
          effort: path.effort,
          expectedTargetLift: path.expectedTargetLift,
          terminalValidationNodeIds: path.terminalValidationNodeIds,
          terminalValidationStrategy: path.terminalValidationStrategy,
          limitations: path.limitations,
        })));

        const allNodes = options.flatMap((path) => path.planNodes ?? []);
        expect(allNodes.length).toBeGreaterThan(0);
        for (const node of allNodes) {
          expect(isInternalPlanningTitle(node.title), node.title).toBe(false);
          expect(node.title).not.toMatch(OPAQUE_TITLE);
          const [left, right] = node.title.split(' · ').map((part) => part.trim());
          if (right) expect(left?.toLowerCase()).not.toBe(right.toLowerCase());
          expect(node.title).not.toMatch(/^第\s*\d+\s*步/u);
        }
        for (const display of displays) {
          expect(display.checkpoints).not.toBe('检查节点待确认');
          expect(display.reason).not.toBe('按当前学习证据安排资源组合。');
          expect(display.expectedAbilityImprovement ?? '').not.toMatch(/^约 \+\d+$/u);
          expect(display.resources.every((resource) => resource.label !== 'lesson step')).toBe(true);
        }

        for (const path of options) {
          const nodes = path.planNodes ?? [];
          const first = nodes[0];
          if (first && (first.type === 'lesson_step' || first.type === 'handout')) {
            const hasLaterConcept = nodes.slice(1).some((node) =>
              node.type === 'knowledge_card' || node.type === 'textbook_section',
            );
            expect(hasLaterConcept).toBe(false);
          }
        }

        const uniqueCounts = displays.map((display) =>
          (display.orderedNodes ?? []).filter((node) => node.comparisonLabel === '本方案特有').length,
        );
        const longest = Math.max(0, ...displays.map((display) => display.orderedNodes?.length ?? 0));
        if (displays.length >= 2 && longest >= 3) {
          expect(Math.max(...uniqueCounts)).toBeGreaterThan(0);
        }
      });
    }

    it(`mastered starts later than zero for ${PATH_SCENARIO_GOAL_TITLES[goalId]}`, () => {
      const zeroStart = knowledgeId(plans.zero!.mainPath[0]);
      const masteredStart = knowledgeId(plans.mastered!.mainPath[0]);
      expect(masteredStart).toBeTruthy();
      if (zeroStart && ordered.includes(zeroStart)) {
        expect(masteredStart).not.toBe(zeroStart);
      }
      expect(plans.mastered!.mainPath.length).toBeLessThanOrEqual(plans.zero!.mainPath.length);
      expect(plans.partial!.mainPath.map((node) => node.nodeId).join('|'))
        .not.toBe(plans.zero!.mainPath.map((node) => node.nodeId).join('|'));
    });
  }
});

function knowledgeId(node: { reasonCodes?: string[] } | undefined): string | undefined {
  return node?.reasonCodes?.find((code) => code.startsWith('knowledge:'))?.slice('knowledge:'.length);
}
