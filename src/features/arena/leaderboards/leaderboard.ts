import type { ControllerMethod, LeaderboardType } from '../types';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { getArenaChallengeTask, getArenaLeaderboardPolicy } from '../data/seed-challenges';

export interface ArenaLeaderboardOptions {
  taskId: string;
  type: LeaderboardType;
  method?: ControllerMethod;
  leaderboardPolicyId?: string;
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

function compareSubmissions(
  left: ArenaSubmissionRecord,
  right: ArenaSubmissionRecord,
  tieBreakers: string[],
): number {
  for (const tieBreaker of tieBreakers) {
    if (tieBreaker === 'hardConstraintPass' && left.evaluation.valid !== right.evaluation.valid) {
      return left.evaluation.valid ? -1 : 1;
    }
    if (tieBreaker === 'score' && left.evaluation.score !== right.evaluation.score) {
      return right.evaluation.score - left.evaluation.score;
    }
    if (tieBreaker === 'submittedAt' && left.submittedAt !== right.submittedAt) {
      return left.submittedAt.localeCompare(right.submittedAt);
    }

    const leftMetric = left.evaluation.metrics[tieBreaker];
    const rightMetric = right.evaluation.metrics[tieBreaker];
    if (Number.isFinite(leftMetric) && Number.isFinite(rightMetric) && leftMetric !== rightMetric) {
      return leftMetric - rightMetric;
    }
  }
  return left.submittedAt.localeCompare(right.submittedAt);
}

function participantKey(submission: ArenaSubmissionRecord): string {
  return submission.userId ?? `label:${submission.studentLabel}`;
}

function leaderboardDedupeKey(submission: ArenaSubmissionRecord, options: ArenaLeaderboardOptions): string {
  const base = participantKey(submission);
  return options.type === 'method' && !options.method ? `${base}:${submission.artifact.method}` : base;
}

export function buildArenaLeaderboard(
  submissions: readonly ArenaSubmissionRecord[],
  options: ArenaLeaderboardOptions,
): ArenaLeaderboard {
  const task = getArenaChallengeTask(options.taskId);
  const policy = getArenaLeaderboardPolicy(options.leaderboardPolicyId ?? task?.leaderboardPolicyId ?? '');
  const tieBreakers = policy?.tieBreakers ?? ['hardConstraintPass', 'score', 'submittedAt'];
  const sorted = submissions
    .filter((submission) => submission.taskId === options.taskId)
    .filter((submission) => options.type !== 'method' || !options.method || submission.artifact.method === options.method)
    .slice()
    .sort((left, right) => compareSubmissions(left, right, tieBreakers));
  const seen = new Set<string>();
  const ranked = sorted.filter((submission) => {
    const key = leaderboardDedupeKey(submission, options);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    taskId: options.taskId,
    type: options.type,
    entries: ranked.map((submission, index) => ({
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
