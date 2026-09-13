export const PATH_SCENARIO_GOALS = [
  'feedback-loop-concept-foundations',
  'root-locus-analysis-foundations',
  'frequency-response-foundations',
] as const;

export type PathScenarioGoalId = (typeof PATH_SCENARIO_GOALS)[number];
export type PathScenarioCohort = 'zero' | 'partial' | 'mastered';

export const PATH_SCENARIO_GOAL_TITLES: Record<PathScenarioGoalId, string> = {
  'feedback-loop-concept-foundations': '反馈与闭环结构基础',
  'root-locus-analysis-foundations': '根轨迹分析基础',
  'frequency-response-foundations': '频率响应基础',
};

export type ScenarioMasteryTag = {
  posteriorMastery: number;
  confidence: number;
  evidenceCount: number;
};

export function masteryTagsForScenario(
  cohort: PathScenarioCohort,
  orderedKnowledgeIds: readonly string[],
): Record<string, ScenarioMasteryTag> {
  if (cohort === 'zero' || orderedKnowledgeIds.length === 0) return {};
  const skipCount = cohort === 'partial'
    ? Math.min(1, Math.max(orderedKnowledgeIds.length - 1, 0))
    : Math.min(
      Math.max(2, Math.floor(orderedKnowledgeIds.length * 0.5)),
      Math.max(orderedKnowledgeIds.length - 1, 0),
    );
  const posterior = cohort === 'partial' ? 0.72 : 0.92;
  return Object.fromEntries(
    orderedKnowledgeIds.slice(0, skipCount).map((id) => [id, {
      posteriorMastery: posterior,
      confidence: 0.8,
      evidenceCount: 2,
    }]),
  );
}

export function unionMasteryTags(
  cohort: PathScenarioCohort,
  orderedByGoal: Readonly<Record<string, readonly string[]>>,
): Record<string, ScenarioMasteryTag> {
  const merged: Record<string, ScenarioMasteryTag> = {};
  for (const ids of Object.values(orderedByGoal)) {
    Object.assign(merged, masteryTagsForScenario(cohort, ids));
  }
  return merged;
}
