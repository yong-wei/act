import type { ControllerArtifact, ControllerMethod, MetricDefinition } from '../types';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { getArenaChallengeTask, getArenaMetricProfile } from '../data/seed-challenges';
import { arenaMethodLabels, formatArenaMetric } from '../display-labels';
import { buildArenaLeaderboard } from './leaderboard';

export type ArenaLeaderboardHonorId =
  | 'first-pass'
  | 'low-energy'
  | 'fastest-response'
  | 'best-improvement'
  | 'pareto-front';

export interface ArenaLeaderboardHonor {
  id: ArenaLeaderboardHonorId;
  label: string;
  submissionId: string;
  studentLabel: string;
  evidenceLabel: string;
  evidenceMetricId?: string;
  evidenceValue?: number;
}

export interface ArenaShowcaseMetricSummary {
  id: string;
  label: string;
  unit?: string;
  value?: number;
}

export interface ArenaShowcaseSummary {
  submissionId: string;
  studentLabel: string;
  studentNumber?: string;
  method: ControllerMethod;
  methodLabel: string;
  score: number;
  metrics: ArenaShowcaseMetricSummary[];
  explanationSummary: string;
  honors: ArenaLeaderboardHonor[];
  privateControllerPayload?: ControllerArtifact;
}

type OfficialArenaSubmission = ArenaSubmissionRecord & { official?: boolean };

function isOfficialValidSubmission(
  submission: OfficialArenaSubmission,
  taskId: string,
): boolean {
  return submission.taskId === taskId && submission.official !== false && submission.evaluation.valid;
}

function participantKey(submission: ArenaSubmissionRecord): string {
  return submission.userId ?? `label:${submission.studentLabel}`;
}

function metricDefinition(taskId: string, metricId: string): MetricDefinition | undefined {
  const task = getArenaChallengeTask(taskId);
  const profile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
  return profile?.rankingMetrics.find((metric) => metric.id === metricId);
}

function compareMetricForHonor(
  left: ArenaSubmissionRecord,
  right: ArenaSubmissionRecord,
  metricId: string,
): number {
  const metric = metricDefinition(left.taskId, metricId);
  const leftValue = left.evaluation.metrics[metricId];
  const rightValue = right.evaluation.metrics[metricId];
  if (!Number.isFinite(leftValue) && !Number.isFinite(rightValue)) return 0;
  if (!Number.isFinite(leftValue)) return 1;
  if (!Number.isFinite(rightValue)) return -1;
  if (metric?.direction === 'maximize') return rightValue - leftValue;
  if (metric?.direction === 'target') {
    return Math.abs(leftValue - metric.idealValue) - Math.abs(rightValue - metric.idealValue);
  }
  return leftValue - rightValue;
}

function metricHonor(
  submissions: OfficialArenaSubmission[],
  metricId: string,
  id: ArenaLeaderboardHonorId,
  label: string,
): ArenaLeaderboardHonor | null {
  const ranked = submissions
    .filter((submission) => Number.isFinite(submission.evaluation.metrics[metricId]))
    .sort((left, right) => compareMetricForHonor(left, right, metricId));
  const winner = ranked[0];
  if (!winner) return null;
  const metric = metricDefinition(winner.taskId, metricId);
  const value = winner.evaluation.metrics[metricId];
  return {
    id,
    label,
    submissionId: winner.id,
    studentLabel: winner.studentLabel,
    evidenceLabel: `${formatArenaMetric(metricId, metric)} ${formatEvidenceValue(value, metric?.unit)}`,
    evidenceMetricId: metricId,
    evidenceValue: value,
  };
}

function firstPassHonor(submissions: OfficialArenaSubmission[]): ArenaLeaderboardHonor | null {
  const winner = submissions.slice().sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))[0];
  if (!winner) return null;
  return {
    id: 'first-pass',
    label: '首个达标',
    submissionId: winner.id,
    studentLabel: winner.studentLabel,
    evidenceLabel: `提交时间 ${winner.submittedAt}`,
  };
}

function bestImprovementHonor(submissions: OfficialArenaSubmission[]): ArenaLeaderboardHonor | null {
  const groups = new Map<string, OfficialArenaSubmission[]>();
  for (const submission of submissions) {
    const key = participantKey(submission);
    groups.set(key, [...(groups.get(key) ?? []), submission]);
  }

  let best: { submission: OfficialArenaSubmission; delta: number } | null = null;
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;
    const ordered = group.slice().sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
    const first = ordered[0];
    const bestSubmission = ordered.slice().sort((left, right) => right.evaluation.score - left.evaluation.score)[0];
    const delta = bestSubmission.evaluation.score - first.evaluation.score;
    if (delta > 0 && (!best || delta > best.delta)) {
      best = { submission: bestSubmission, delta };
    }
  }
  if (!best) return null;
  return {
    id: 'best-improvement',
    label: '最大进步',
    submissionId: best.submission.id,
    studentLabel: best.submission.studentLabel,
    evidenceLabel: `得分提升 ${best.delta.toFixed(1)}`,
    evidenceValue: best.delta,
  };
}

function paretoHonors(taskId: string, submissions: OfficialArenaSubmission[]): ArenaLeaderboardHonor[] {
  const task = getArenaChallengeTask(taskId);
  if (!task?.leaderboardTypes.includes('pareto')) return [];
  const leaderboard = buildArenaLeaderboard(submissions, {
    taskId,
    type: 'pareto',
    metricIds: task.primaryMetrics,
  });
  return leaderboard.entries
    .filter((entry) => entry.paretoTier === 1)
    .map((entry) => ({
      id: 'pareto-front' as const,
      label: 'Pareto 前沿',
      submissionId: entry.submissionId,
      studentLabel: entry.studentLabel,
      evidenceLabel: '多目标指标未被其他有效方案支配',
    }));
}

function formatEvidenceValue(value: number, unit?: string): string {
  const formatted = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(3).replace(/\.?0+$/, '');
  return `${formatted}${unit ?? ''}`;
}

export function buildArenaLeaderboardHonors(
  submissions: readonly OfficialArenaSubmission[],
  options: { taskId: string },
): ArenaLeaderboardHonor[] {
  const official = submissions.filter((submission) => isOfficialValidSubmission(submission, options.taskId));
  const honors = [
    firstPassHonor(official),
    metricHonor(official, 'controlEnergy', 'low-energy', '低能耗'),
    metricHonor(official, 'settlingTime', 'fastest-response', '最快响应'),
    bestImprovementHonor(official),
    ...paretoHonors(options.taskId, official),
  ];
  return honors.filter((honor): honor is ArenaLeaderboardHonor => Boolean(honor));
}

export function buildArenaShowcaseSummaries(
  submissions: readonly OfficialArenaSubmission[],
  options: {
    taskId: string;
    limit?: number;
    includePrivatePayload?: boolean;
  },
): ArenaShowcaseSummary[] {
  const official = submissions.filter((submission) => isOfficialValidSubmission(submission, options.taskId));
  const task = getArenaChallengeTask(options.taskId);
  const profile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
  const metricIds = task?.primaryMetrics?.length
    ? task.primaryMetrics
    : profile?.rankingMetrics.map((metric) => metric.id) ?? [];
  const metricsById = new Map((profile?.rankingMetrics ?? []).map((metric) => [metric.id, metric]));
  const honors = buildArenaLeaderboardHonors(official, { taskId: options.taskId });
  const honorsBySubmission = new Map<string, ArenaLeaderboardHonor[]>();
  for (const honor of honors) {
    honorsBySubmission.set(honor.submissionId, [...(honorsBySubmission.get(honor.submissionId) ?? []), honor]);
  }
  const leaderboard = buildArenaLeaderboard(official, {
    taskId: options.taskId,
    type: 'main',
  });
  const byId = new Map(official.map((submission) => [submission.id, submission]));

  return leaderboard.entries.slice(0, options.limit ?? 3).flatMap((entry) => {
    const submission = byId.get(entry.submissionId);
    if (!submission) return [];
    return [{
      submissionId: submission.id,
      studentLabel: submission.studentLabel,
      studentNumber: submission.studentNumber,
      method: submission.artifact.method,
      methodLabel: arenaMethodLabels[submission.artifact.method],
      score: submission.evaluation.score,
      metrics: metricIds.map((metricId) => {
        const metric = metricsById.get(metricId);
        return {
          id: metricId,
          label: formatArenaMetric(metricId, metric),
          unit: metric?.unit,
          value: submission.evaluation.metrics[metricId],
        };
      }),
      explanationSummary: submission.evaluation.explanation[0] ?? '官方评测记录未给出额外解释。',
      honors: honorsBySubmission.get(submission.id) ?? [],
      ...(options.includePrivatePayload ? { privateControllerPayload: submission.artifact } : {}),
    }];
  });
}
