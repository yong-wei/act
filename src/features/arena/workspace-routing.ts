import type { ChallengeObject, ChallengeTask } from './types';

function withArenaTask(path: string, taskId: string, params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams(params);
  searchParams.set('arenaTask', taskId);
  return `${path}?${searchParams.toString()}`;
}

function withControlWorkbenchTask(task: ChallengeTask, params: Record<string, string>): string {
  const searchParams = new URLSearchParams(params);
  searchParams.set('preset', task.workspaceMode);
  searchParams.set('arenaTask', task.id);
  return `/interactive-learning/control-workbench?${searchParams.toString()}`;
}

export function getArenaWorkspaceHref(
  task: ChallengeTask,
  object?: ChallengeObject,
  params: Record<string, string> = {},
): string {
  if (object?.source === 'control-odyssey' || task.workspaceMode === 'control-odyssey') {
    return withArenaTask('/interactive-learning/control-odyssey', task.id, params);
  }

  return withControlWorkbenchTask(task, params);
}
