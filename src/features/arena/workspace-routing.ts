import type { ChallengeObject, ChallengeTask } from './types';
import {
  appendArenaPathLaunchParams,
  ARENA_PUBLICATION_CONTEXT_KEYS,
  resolveArenaPathLaunchParams,
} from './arena-path-journey';
import { getOdysseyLevelForArenaTask } from './odyssey/assignment';

type ArenaWorkspaceParams = Record<string, string | undefined>;

function buildSearchParams(params: ArenaWorkspaceParams, taskId: string) {
  const searchParams = new URLSearchParams();
  for (const key of ARENA_PUBLICATION_CONTEXT_KEYS) {
    const value = params[key];
    if (value !== undefined) searchParams.set(key, value);
  }
  const pathContext = resolveArenaPathLaunchParams(new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  ), taskId);
  if (pathContext) appendArenaPathLaunchParams(searchParams, pathContext);
  return searchParams;
}

function withArenaTask(path: string, taskId: string, params: ArenaWorkspaceParams = {}): string {
  const searchParams = buildSearchParams(params, taskId);
  searchParams.set('arenaTask', taskId);
  const odysseyLevelId = getOdysseyLevelForArenaTask(taskId);
  if (odysseyLevelId) searchParams.set('odysseyLevelId', odysseyLevelId);
  return `${path}?${searchParams.toString()}`;
}

function withControlWorkbenchTask(task: ChallengeTask, params: ArenaWorkspaceParams): string {
  const searchParams = buildSearchParams(params, task.id);
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
