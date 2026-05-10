import type { ControllerMethod, LeaderboardType } from '../types';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';

export interface ArenaLeaderboardOptions {
  taskId: string;
  type: LeaderboardType;
  method?: ControllerMethod;
}

export interface ArenaLeaderboardEntry {
  rank: number;
  submissionId: string;
  studentLabel: string;
  taskId: string;
  method: ControllerMethod;
  score: number;
  valid: boolean;
  submittedAt: string;
}

export interface ArenaLeaderboard {
  taskId: string;
  type: LeaderboardType;
  entries: ArenaLeaderboardEntry[];
}

export function buildArenaLeaderboard(
  submissions: readonly ArenaSubmissionRecord[],
  options: ArenaLeaderboardOptions,
): ArenaLeaderboard {
  const filtered = submissions
    .filter((submission) => submission.taskId === options.taskId)
    .filter((submission) => options.type !== 'method' || !options.method || submission.artifact.method === options.method)
    .slice()
    .sort((left, right) => {
      if (left.evaluation.valid !== right.evaluation.valid) {
        return left.evaluation.valid ? -1 : 1;
      }
      if (left.evaluation.score !== right.evaluation.score) {
        return right.evaluation.score - left.evaluation.score;
      }
      return left.submittedAt.localeCompare(right.submittedAt);
    });

  return {
    taskId: options.taskId,
    type: options.type,
    entries: filtered.map((submission, index) => ({
      rank: index + 1,
      submissionId: submission.id,
      studentLabel: submission.studentLabel,
      taskId: submission.taskId,
      method: submission.artifact.method,
      score: submission.evaluation.score,
      valid: submission.evaluation.valid,
      submittedAt: submission.submittedAt,
    })),
  };
}
