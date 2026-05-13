import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
} from '../data/seed-challenges';
import type { WorkspaceMode } from '../types';
import { inferArenaObjectCapabilities } from './capabilities';
import type { ArenaEntryMode, ArenaWorkbenchContext } from './types';
import { getArenaWorkspaceHref } from '../workspace-routing';

function inferEntryMode(taskId: string): ArenaEntryMode {
  if (taskId.startsWith('task-odyssey-')) return 'odyssey';
  return 'challenge';
}

function isLockedByChallenge(entryMode: ArenaEntryMode): boolean {
  return entryMode === 'challenge' || entryMode === 'assignment' || entryMode === 'odyssey';
}

export function resolveArenaWorkbenchContext(taskId: string): ArenaWorkbenchContext | null {
  const task = getArenaChallengeTask(taskId);
  if (!task) return null;

  const object = getArenaChallengeObject(task.objectId);
  if (!object) return null;

  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  if (!metricProfile) return null;

  const leaderboardPolicy = getArenaLeaderboardPolicy(task.leaderboardPolicyId);
  if (!leaderboardPolicy) return null;

  const capabilities = object.capabilities ?? inferArenaObjectCapabilities(object);
  const entryMode = inferEntryMode(taskId);
  const recommendedWorkspaceMode: WorkspaceMode = task.workspaceMode;
  const returnHref = `/arena/challenges/${taskId}`;

  return {
    entryMode,
    locked: isLockedByChallenge(entryMode),
    task,
    object,
    metricProfile,
    leaderboardPolicy,
    capabilities,
    allowedMethods: task.allowedMethods,
    recommendedWorkspaceMode,
    returnHref,
  };
}
