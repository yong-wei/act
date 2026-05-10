import type { ChallengeObject, ChallengeTask } from './types';

function withArenaTask(path: string, taskId: string, params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams({ arenaTask: taskId, ...params });
  return `${path}?${searchParams.toString()}`;
}

export function getArenaWorkspaceHref(task: ChallengeTask, object?: ChallengeObject): string {
  if (object?.source === 'control-odyssey' || task.workspaceMode === 'control-odyssey') {
    return withArenaTask('/interactive-learning/control-odyssey', task.id);
  }

  if (task.workspaceMode === 'black-box-identification') {
    return withArenaTask('/simulations/cruise', task.id, { mode: 'black-box-identification' });
  }

  if (task.workspaceMode === 'block-diagram-workbench') {
    return withArenaTask('/interactive-learning/lesson-05', task.id, { workspace: 'block-diagram' });
  }

  if (task.workspaceMode === 'predictive-control') {
    return withArenaTask('/interactive-learning/courses/unit-5-4-data-driven-mpc-transition', task.id);
  }

  return withArenaTask('/interactive-learning/multi-representation-linkage', task.id);
}
