import { goalCanonicalIds } from '../../src/features/personalization/path-planning/goal-canonical-knowledge';
import { buildKnowledgeSkeleton, selectPriorityKnowledgeSkeleton } from '../../src/features/personalization/path-planning/knowledge-path-assembly';
import { loadPlanningAssertionKnowledgeIds, loadPlanningKnowledgeLabels } from '../../src/features/personalization/path-planning/planning-resource-titles';
import { loadGoalPlanningRegistry } from '../../src/features/personalization/path-planning/planning-projection-index';
import {
  PATH_SCENARIO_GOALS,
  unionMasteryTags,
  type PathScenarioCohort,
} from '../../src/features/personalization/path-planning/scenario-mastery-fixtures';

export function liveOrderedKnowledgeByGoal() {
  const labels = loadPlanningKnowledgeLabels();
  const assertionIds = loadPlanningAssertionKnowledgeIds();
  return Object.fromEntries(PATH_SCENARIO_GOALS.map((goalId) => {
    const loaded = loadGoalPlanningRegistry(goalId);
    const targets = goalCanonicalIds(goalId);
    const feasible = new Set(loaded.universe.knowledgeIds);
    const expanded = buildKnowledgeSkeleton(targets, loaded.universe.edges, 'required')
      .knowledgeIds
      .filter((id) => feasible.has(id));
    const ordered = selectPriorityKnowledgeSkeleton(expanded, {}, {
      labels,
      assertionIds,
      keepIds: targets,
    });
    return [goalId, ordered] as const;
  }));
}

export function liveMasteryTags(cohort: PathScenarioCohort) {
  return unionMasteryTags(cohort, liveOrderedKnowledgeByGoal());
}

if (process.argv[1] && process.argv[1].includes('seed-path-mastery-live-tags')) {
  const cohort = (process.argv[2] ?? 'partial') as PathScenarioCohort;
  process.stdout.write(`${JSON.stringify(liveMasteryTags(cohort), null, 2)}\n`);
}
