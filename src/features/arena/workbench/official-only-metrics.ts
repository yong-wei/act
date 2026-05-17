import type { ChallengeTask, WorkspaceMode } from '../types';

export const PREDICTIVE_WORKBENCH_OFFICIAL_ONLY_METRIC_IDS = ['hiddenScenarioWorst'] as const;

export function resolveWorkbenchOfficialOnlyMetricIds({
  workspaceMode,
  task,
  explicitMetricIds,
}: {
  workspaceMode: WorkspaceMode;
  task: Pick<ChallengeTask, 'primaryMetrics'>;
  explicitMetricIds?: string[];
}): string[] | undefined {
  if (explicitMetricIds !== undefined) {
    return [...explicitMetricIds];
  }

  if (workspaceMode !== 'predictive-control') {
    return undefined;
  }

  return PREDICTIVE_WORKBENCH_OFFICIAL_ONLY_METRIC_IDS.filter((metricId) => (
    task.primaryMetrics.includes(metricId)
  ));
}
