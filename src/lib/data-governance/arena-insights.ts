import type { ArenaSubmissionRecord } from '@/features/arena/submissions/submission-service';

export interface ArenaClassInsightAggregationInput {
  classId?: string;
  publicationId?: string;
  taskId?: string;
  submissions: readonly ArenaSubmissionRecord[];
}

export interface ArenaWeakMetricAggregate {
  metricId: string;
  count: number;
  averageSatisfaction: number;
}

export interface ArenaClassInsightAggregation {
  submissionCount: number;
  validRate: number;
  scoreDistribution: {
    min: number | null;
    max: number | null;
    average: number | null;
  };
  weakMetrics: ArenaWeakMetricAggregate[];
  methodDistribution: Record<string, number>;
}

function inScope(submission: ArenaSubmissionRecord, input: ArenaClassInsightAggregationInput): boolean {
  if (input.classId && submission.classId !== input.classId) return false;
  if (input.publicationId && submission.publicationId !== input.publicationId) return false;
  if (input.taskId && submission.taskId !== input.taskId) return false;
  return true;
}

export function buildArenaClassInsightAggregation(
  input: ArenaClassInsightAggregationInput,
): ArenaClassInsightAggregation {
  const scoped = input.submissions.filter((submission) => inScope(submission, input));
  const scores = scoped
    .map((submission) => submission.evaluation.score)
    .filter((score) => Number.isFinite(score));
  const validCount = scoped.filter((submission) => submission.evaluation.valid).length;
  const methodDistribution: Record<string, number> = {};
  const weakMetricBuckets = new Map<string, number[]>();

  for (const submission of scoped) {
    const method = submission.artifact.method;
    methodDistribution[method] = (methodDistribution[method] ?? 0) + 1;
    const satisfaction = submission.evaluation.satisfaction ?? {};
    for (const [metricId, value] of Object.entries(satisfaction)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value >= 0.5) continue;
      const bucket = weakMetricBuckets.get(metricId) ?? [];
      bucket.push(value);
      weakMetricBuckets.set(metricId, bucket);
    }
  }

  return {
    submissionCount: scoped.length,
    validRate: scoped.length === 0 ? 0 : validCount / scoped.length,
    scoreDistribution: {
      min: scores.length ? Math.min(...scores) : null,
      max: scores.length ? Math.max(...scores) : null,
      average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    },
    weakMetrics: Array.from(weakMetricBuckets.entries())
      .map(([metricId, values]) => ({
        metricId,
        count: values.length,
        averageSatisfaction: values.reduce((sum, value) => sum + value, 0) / values.length,
      }))
      .sort((left, right) => left.averageSatisfaction - right.averageSatisfaction),
    methodDistribution,
  };
}
