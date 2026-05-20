import type { ControllerMethod, LeaderboardType, MetricDefinition } from '../types';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { getArenaChallengeTask, getArenaLeaderboardPolicy, getArenaMetricProfile } from '../data/seed-challenges';

export interface ArenaLeaderboardOptions {
  taskId: string;
  type: LeaderboardType;
  method?: ControllerMethod;
  metricId?: string;
  metricIds?: string[];
  classId?: string;
  seasonId?: string;
  leaderboardPolicyId?: string;
}

export interface ArenaLeaderboardEntry {
  rank: number;
  submissionId: string;
  studentLabel: string;
  studentNumber?: string;
  taskId: string;
  method: ControllerMethod;
  score: number;
  valid: boolean;
  submittedAt: string;
  metricId?: string;
  metricValue?: number;
  paretoTier?: number;
  dominanceCount?: number;
  dominatedBySubmissionIds?: string[];
}

export interface ArenaLeaderboard {
  taskId: string;
  type: LeaderboardType;
  entries: ArenaLeaderboardEntry[];
}

function getMetricDefinition(taskId: string, metricId: string): MetricDefinition | undefined {
  const task = getArenaChallengeTask(taskId);
  const metricProfile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
  return metricProfile?.rankingMetrics.find((metric) => metric.id === metricId);
}

function compareMetricValue(left: number, right: number, metric: MetricDefinition | undefined): number {
  if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
  if (!Number.isFinite(left)) return 1;
  if (!Number.isFinite(right)) return -1;

  if (metric?.direction === 'maximize') return right - left;
  if (metric?.direction === 'target') {
    const ideal = metric.idealValue;
    return Math.abs(left - ideal) - Math.abs(right - ideal);
  }
  return left - right;
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

function compareMetricSubmissions(
  left: ArenaSubmissionRecord,
  right: ArenaSubmissionRecord,
  metricId: string,
): number {
  if (left.evaluation.valid !== right.evaluation.valid) {
    return left.evaluation.valid ? -1 : 1;
  }
  const metric = getMetricDefinition(left.taskId, metricId);
  const metricComparison = compareMetricValue(
    left.evaluation.metrics[metricId],
    right.evaluation.metrics[metricId],
    metric,
  );
  if (metricComparison !== 0) return metricComparison;
  return compareSubmissions(left, right, ['hardConstraintPass', 'score', 'submittedAt']);
}

function participantKey(submission: ArenaSubmissionRecord): string {
  return submission.userId ?? `label:${submission.studentLabel}`;
}

function leaderboardDedupeKey(submission: ArenaSubmissionRecord, options: ArenaLeaderboardOptions): string {
  const base = participantKey(submission);
  return options.type === 'method' && !options.method ? `${base}:${submission.artifact.method}` : base;
}

function metricIdsForPareto(options: ArenaLeaderboardOptions): string[] {
  if (options.metricIds?.length) return options.metricIds;
  const task = getArenaChallengeTask(options.taskId);
  return task?.primaryMetrics ?? [];
}

function dominates(left: ArenaSubmissionRecord, right: ArenaSubmissionRecord, metricIds: string[]): boolean {
  if (!left.evaluation.valid || !right.evaluation.valid) return left.evaluation.valid && !right.evaluation.valid;

  let strictlyBetter = false;
  for (const metricId of metricIds) {
    const metric = getMetricDefinition(left.taskId, metricId);
    const comparison = compareMetricValue(
      left.evaluation.metrics[metricId],
      right.evaluation.metrics[metricId],
      metric,
    );
    if (comparison > 0) return false;
    if (comparison < 0) strictlyBetter = true;
  }
  return strictlyBetter;
}

function buildParetoEvidence(
  submissions: readonly ArenaSubmissionRecord[],
  metricIds: string[],
): Map<string, { tier: number; dominatedBySubmissionIds: string[] }> {
  const evidence = new Map<string, { tier: number; dominatedBySubmissionIds: string[] }>();
  for (const submission of submissions) {
    const dominatedBy = submissions
      .filter((candidate) => candidate.id !== submission.id && dominates(candidate, submission, metricIds))
      .map((candidate) => candidate.id);
    evidence.set(submission.id, {
      tier: dominatedBy.length === 0 ? 1 : 2,
      dominatedBySubmissionIds: dominatedBy,
    });
  }
  return evidence;
}

function filterByLeaderboardScope(
  submissions: readonly ArenaSubmissionRecord[],
  options: ArenaLeaderboardOptions,
): ArenaSubmissionRecord[] {
  if (options.type === 'class' && !options.classId) return [];
  if (options.type === 'season' && !options.seasonId) return [];
  if (options.type === 'method' && !options.method) return [];

  return submissions.filter((submission) => {
    if (submission.taskId !== options.taskId) return false;
    if (options.type === 'class' && submission.classId !== options.classId) return false;
    if (options.type === 'season' && submission.seasonId !== options.seasonId) return false;
    if (options.type === 'method' && submission.artifact.method !== options.method) return false;
    return true;
  });
}

function sortSubmissionsForLeaderboard(
  submissions: ArenaSubmissionRecord[],
  options: ArenaLeaderboardOptions,
  tieBreakers: string[],
): ArenaSubmissionRecord[] {
  if (options.type === 'metric' && options.metricId) {
    return submissions.slice().sort((left, right) => compareMetricSubmissions(left, right, options.metricId as string));
  }

  if (options.type === 'pareto') {
    const metricIds = metricIdsForPareto(options);
    const evidence = buildParetoEvidence(submissions, metricIds);
    return submissions.slice().sort((left, right) => {
      const leftEvidence = evidence.get(left.id);
      const rightEvidence = evidence.get(right.id);
      const tierComparison = (leftEvidence?.tier ?? 2) - (rightEvidence?.tier ?? 2);
      if (tierComparison !== 0) return tierComparison;
      const dominanceComparison = (leftEvidence?.dominatedBySubmissionIds.length ?? 0) -
        (rightEvidence?.dominatedBySubmissionIds.length ?? 0);
      if (dominanceComparison !== 0) return dominanceComparison;
      return compareSubmissions(left, right, tieBreakers);
    });
  }

  return submissions.slice().sort((left, right) => compareSubmissions(left, right, tieBreakers));
}

export function buildArenaLeaderboard(
  submissions: readonly ArenaSubmissionRecord[],
  options: ArenaLeaderboardOptions,
): ArenaLeaderboard {
  const task = getArenaChallengeTask(options.taskId);
  const policy = getArenaLeaderboardPolicy(options.leaderboardPolicyId ?? task?.leaderboardPolicyId ?? '');
  const tieBreakers = policy?.tieBreakers ?? ['hardConstraintPass', 'score', 'submittedAt'];
  const metricId = options.type === 'metric' ? options.metricId : undefined;
  const eligibleSubmissions = filterByLeaderboardScope(submissions, options)
    .filter((submission) => submission.evaluation.valid);
  const sorted = sortSubmissionsForLeaderboard(eligibleSubmissions, options, tieBreakers);
  const seen = new Set<string>();
  const ranked = sorted.filter((submission) => {
    const key = leaderboardDedupeKey(submission, options);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const paretoEvidence = options.type === 'pareto'
    ? buildParetoEvidence(ranked, metricIdsForPareto(options))
    : new Map<string, { tier: number; dominatedBySubmissionIds: string[] }>();

  return {
    taskId: options.taskId,
    type: options.type,
    entries: ranked.map((submission, index) => {
      const evidence = paretoEvidence.get(submission.id);
      return {
        rank: index + 1,
        submissionId: submission.id,
        studentLabel: submission.studentLabel,
        studentNumber: submission.studentNumber,
        taskId: submission.taskId,
        method: submission.artifact.method,
        score: submission.evaluation.score,
        valid: submission.evaluation.valid,
        submittedAt: submission.submittedAt,
        metricId,
        metricValue: metricId ? submission.evaluation.metrics[metricId] : undefined,
        paretoTier: evidence?.tier,
        dominanceCount: evidence?.dominatedBySubmissionIds.length,
        dominatedBySubmissionIds: evidence?.dominatedBySubmissionIds,
      };
    }),
  };
}
