import type { LeaderboardType } from '../types';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { buildArenaLeaderboard, type ArenaLeaderboard, type ArenaLeaderboardEntry, type ArenaLeaderboardOptions } from './leaderboard';

export { type ArenaLeaderboard, type ArenaLeaderboardEntry, type ArenaLeaderboardOptions };

export interface LeaderboardViewModel {
  taskId: string;
  type: LeaderboardType;
  typeLabel: string;
  entries: ArenaLeaderboardEntry[];
  isEmpty: boolean;
  hasNoValidSubmissions: boolean;
  totalSubmissions: number;
  totalParticipants: number;
  availableTypes: LeaderboardType[];
  availableMethods: string[];
}

const TYPE_LABELS: Record<LeaderboardType, string> = {
  main: '主榜',
  method: '方法榜',
  metric: '指标榜',
  pareto: 'Pareto 榜',
  class: '班级榜',
  season: '赛季榜',
};

export function getLeaderboardViewModel(
  submissions: readonly ArenaSubmissionRecord[],
  taskId: string,
  currentType: LeaderboardType,
  availableTypes: LeaderboardType[],
  options?: Partial<ArenaLeaderboardOptions>,
): LeaderboardViewModel {
  const taskSubmissions = submissions.filter((s) => s.taskId === taskId);
  const validSubmissions = taskSubmissions.filter((s) => s.evaluation.valid);
  const allMethods = Array.from(new Set(taskSubmissions.map((s) => s.artifact.method)));

  const { taskId: _optsTaskId, type: _optsType, ...safeOptions } = options ?? {};
  const leaderboard = buildArenaLeaderboard(submissions, {
    taskId,
    type: currentType,
    ...safeOptions,
  });

  return {
    taskId,
    type: currentType,
    typeLabel: TYPE_LABELS[currentType] ?? currentType,
    entries: leaderboard.entries,
    isEmpty: taskSubmissions.length === 0,
    hasNoValidSubmissions: taskSubmissions.length > 0 && validSubmissions.length === 0,
    totalSubmissions: taskSubmissions.length,
    totalParticipants: new Set(taskSubmissions.map((s) => s.userId ?? s.studentLabel)).size,
    availableTypes,
    availableMethods: allMethods,
  };
}

export function getEmptyLeaderboardViewModel(
  taskId: string,
  availableTypes: LeaderboardType[],
): LeaderboardViewModel {
  return {
    taskId,
    type: 'main',
    typeLabel: '主榜',
    entries: [],
    isEmpty: true,
    hasNoValidSubmissions: false,
    totalSubmissions: 0,
    totalParticipants: 0,
    availableTypes,
    availableMethods: [],
  };
}
