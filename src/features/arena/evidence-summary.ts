import type { ArenaSubmissionRecord } from './submissions/submission-service';
import type { ControllerMethod } from './types';

const WEAK_METRIC_THRESHOLD = 0.6;

export interface ArenaLearningFactEvidence {
  factType: string;
  moduleId?: string | null;
  outcome: string;
  score?: number | null;
  contextJson?: unknown;
}

export interface ArenaStudentEvidenceSummary {
  submissionCount: number;
  bestScore: number | null;
  validSubmissionRate: number;
  recentChallenges: Array<{
    taskId: string;
    latestScore: number;
    valid: boolean;
    submittedAt: string;
  }>;
  weakMetrics: Array<{
    metricId: string;
    affectedTaskCount: number;
    lowestSatisfaction: number;
  }>;
  methodPreference: ControllerMethod | null;
  improvementCount: number;
  learningFactContextCount: number;
}

export interface ArenaClassEvidenceSummary {
  submissionCount: number;
  participantCount: number;
  taskAchievementRate: number;
  averageScore: number | null;
  hardConstraintFailureDistribution: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  weakMetricDistribution: Array<{
    metricId: string;
    affectedSubmissionCount: number;
    averageSatisfaction: number;
  }>;
  methodDistribution: Record<string, number>;
  nonSubmissionCount: number;
  learningFactContextCount: number;
}

export interface BuildArenaStudentEvidenceSummaryInput {
  userId: string;
  submissions: readonly ArenaSubmissionRecord[];
  learningFacts?: readonly ArenaLearningFactEvidence[];
}

export interface BuildArenaClassEvidenceSummaryInput {
  classId: string;
  expectedStudentCount?: number;
  submissions: readonly ArenaSubmissionRecord[];
  learningFacts?: readonly ArenaLearningFactEvidence[];
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hasArenaContext(fact: ArenaLearningFactEvidence): boolean {
  const context = fact.contextJson;
  return Boolean(
    context &&
    typeof context === 'object' &&
    !Array.isArray(context) &&
    (context as Record<string, unknown>).arena,
  );
}

function sortBySubmittedAtDesc(left: { submittedAt: string }, right: { submittedAt: string }): number {
  return Date.parse(right.submittedAt) - Date.parse(left.submittedAt);
}

function latestByTask(submissions: readonly ArenaSubmissionRecord[]): ArenaSubmissionRecord[] {
  const byTask = new Map<string, ArenaSubmissionRecord>();
  for (const submission of submissions.slice().sort((left, right) => Date.parse(left.submittedAt) - Date.parse(right.submittedAt))) {
    byTask.set(submission.taskId, submission);
  }
  return Array.from(byTask.values()).sort(sortBySubmittedAtDesc);
}

function buildMethodPreference(submissions: readonly ArenaSubmissionRecord[]): ControllerMethod | null {
  const counts = new Map<ControllerMethod, number>();
  for (const submission of submissions) {
    counts.set(submission.artifact.method, (counts.get(submission.artifact.method) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function buildStudentWeakMetrics(submissions: readonly ArenaSubmissionRecord[]): ArenaStudentEvidenceSummary['weakMetrics'] {
  const buckets = new Map<string, { affectedTaskCount: number; lowestSatisfaction: number }>();
  for (const submission of latestByTask(submissions)) {
    for (const [metricId, satisfaction] of Object.entries(submission.evaluation.satisfaction)) {
      if (!Number.isFinite(satisfaction) || satisfaction >= WEAK_METRIC_THRESHOLD) continue;
      const current = buckets.get(metricId) ?? { affectedTaskCount: 0, lowestSatisfaction: 1 };
      buckets.set(metricId, {
        affectedTaskCount: current.affectedTaskCount + 1,
        lowestSatisfaction: Math.min(current.lowestSatisfaction, round(satisfaction)),
      });
    }
  }
  return Array.from(buckets.entries())
    .map(([metricId, signal]) => ({ metricId, ...signal }))
    .sort((left, right) => (
      right.affectedTaskCount - left.affectedTaskCount
      || left.lowestSatisfaction - right.lowestSatisfaction
      || left.metricId.localeCompare(right.metricId)
    ));
}

function countImprovements(submissions: readonly ArenaSubmissionRecord[]): number {
  let count = 0;
  const byTask = new Map<string, ArenaSubmissionRecord[]>();
  for (const submission of submissions) {
    byTask.set(submission.taskId, [...(byTask.get(submission.taskId) ?? []), submission]);
  }
  for (const taskSubmissions of Array.from(byTask.values())) {
    const sorted = taskSubmissions.slice().sort((left, right) => Date.parse(left.submittedAt) - Date.parse(right.submittedAt));
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    if (first && latest && latest.evaluation.score > first.evaluation.score) {
      count += 1;
    }
  }
  return count;
}

export function buildArenaStudentEvidenceSummary(
  input: BuildArenaStudentEvidenceSummaryInput,
): ArenaStudentEvidenceSummary {
  const scoped = input.submissions
    .filter((submission) => submission.userId === input.userId)
    .slice()
    .sort((left, right) => Date.parse(left.submittedAt) - Date.parse(right.submittedAt));
  const validCount = scoped.filter((submission) => submission.evaluation.valid).length;
  const latestTasks = latestByTask(scoped);

  return {
    submissionCount: scoped.length,
    bestScore: scoped.length ? Math.max(...scoped.map((submission) => submission.evaluation.score)) : null,
    validSubmissionRate: scoped.length ? validCount / scoped.length : 0,
    recentChallenges: latestTasks.map((submission) => ({
      taskId: submission.taskId,
      latestScore: submission.evaluation.score,
      valid: submission.evaluation.valid,
      submittedAt: submission.submittedAt,
    })),
    weakMetrics: buildStudentWeakMetrics(scoped),
    methodPreference: buildMethodPreference(scoped),
    improvementCount: countImprovements(scoped),
    learningFactContextCount: (input.learningFacts ?? []).filter(hasArenaContext).length,
  };
}

function buildHardConstraintFailures(
  submissions: readonly ArenaSubmissionRecord[],
): ArenaClassEvidenceSummary['hardConstraintFailureDistribution'] {
  const failures = new Map<string, { label: string; count: number }>();
  for (const submission of submissions) {
    for (const result of submission.evaluation.hardConstraintResults) {
      if (result.passed) continue;
      const current = failures.get(result.id) ?? { label: result.label, count: 0 };
      failures.set(result.id, { label: current.label, count: current.count + 1 });
    }
  }
  return Array.from(failures.entries())
    .map(([id, failure]) => ({ id, label: failure.label, count: failure.count }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
}

function buildClassWeakMetrics(
  submissions: readonly ArenaSubmissionRecord[],
): ArenaClassEvidenceSummary['weakMetricDistribution'] {
  const buckets = new Map<string, number[]>();
  for (const submission of submissions) {
    for (const [metricId, satisfaction] of Object.entries(submission.evaluation.satisfaction)) {
      if (!Number.isFinite(satisfaction) || satisfaction >= WEAK_METRIC_THRESHOLD) continue;
      buckets.set(metricId, [...(buckets.get(metricId) ?? []), satisfaction]);
    }
  }
  return Array.from(buckets.entries())
    .map(([metricId, values]) => ({
      metricId,
      affectedSubmissionCount: values.length,
      averageSatisfaction: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((left, right) => (
      left.averageSatisfaction - right.averageSatisfaction
      || right.affectedSubmissionCount - left.affectedSubmissionCount
      || left.metricId.localeCompare(right.metricId)
    ));
}

export function buildArenaClassEvidenceSummary(
  input: BuildArenaClassEvidenceSummaryInput,
): ArenaClassEvidenceSummary {
  const scoped = input.submissions.filter((submission) => submission.classId === input.classId);
  const participantIds = new Set(scoped.map((submission) => submission.userId ?? submission.studentLabel));
  const validParticipantIds = new Set(
    scoped
      .filter((submission) => submission.evaluation.valid)
      .map((submission) => submission.userId ?? submission.studentLabel),
  );
  const expectedStudentCount = input.expectedStudentCount ?? participantIds.size;
  const methodDistribution: Record<string, number> = {};
  for (const submission of scoped) {
    methodDistribution[submission.artifact.method] = (methodDistribution[submission.artifact.method] ?? 0) + 1;
  }
  const scores = scoped.map((submission) => submission.evaluation.score);

  return {
    submissionCount: scoped.length,
    participantCount: participantIds.size,
    taskAchievementRate: expectedStudentCount ? validParticipantIds.size / expectedStudentCount : 0,
    averageScore: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length, 1) : null,
    hardConstraintFailureDistribution: buildHardConstraintFailures(scoped),
    weakMetricDistribution: buildClassWeakMetrics(scoped),
    methodDistribution,
    nonSubmissionCount: Math.max(expectedStudentCount - participantIds.size, 0),
    learningFactContextCount: (input.learningFacts ?? []).filter(hasArenaContext).length,
  };
}
