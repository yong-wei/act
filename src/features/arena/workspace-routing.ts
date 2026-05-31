import type { ChallengeObject, ChallengeTask } from './types';

type ArenaWorkspaceParams = Record<string, string | undefined>;

function buildSearchParams(params: ArenaWorkspaceParams) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) searchParams.set(key, value);
  }
  return searchParams;
}

function withArenaTask(path: string, taskId: string, params: ArenaWorkspaceParams = {}): string {
  const searchParams = buildSearchParams(params);
  searchParams.set('arenaTask', taskId);
  return `${path}?${searchParams.toString()}`;
}

function withControlWorkbenchTask(task: ChallengeTask, params: ArenaWorkspaceParams): string {
  const searchParams = buildSearchParams(params);
  searchParams.set('preset', task.workspaceMode);
  searchParams.set('arenaTask', task.id);
  return `/interactive-learning/control-workbench?${searchParams.toString()}`;
}

export function getArenaWorkspaceHref(
  task: ChallengeTask,
  object?: ChallengeObject,
  params: ArenaWorkspaceParams = {},
): string {
  if (object?.source === 'control-odyssey' || task.workspaceMode === 'control-odyssey') {
    return withArenaTask('/interactive-learning/control-odyssey', task.id, params);
  }

  return withControlWorkbenchTask(task, params);
}
