import type { MetricProfile, MetricDefinition } from '../types';
import type { ArenaEvaluationPenalty, ArenaEvaluationResult, HardConstraintResult } from './types';
import type { ControllerArtifact } from '../types';
import { clampScore, normalizeMetricValue, scoreMetricSatisfaction } from './scoring';

export interface MetricProfileEvaluationInput {
  taskId: string;
  artifact: ControllerArtifact;
  metricProfile: MetricProfile;
  metrics: Record<string, number>;
  hardConstraintResults: HardConstraintResult[];
  primaryMetrics?: string[];
}

export function evaluateMetricProfile(input: MetricProfileEvaluationInput): ArenaEvaluationResult {
  const { taskId, artifact, metricProfile, metrics, hardConstraintResults } = input;
  const valid = hardConstraintResults.every((result) => result.passed);

  if (!valid) {
    const failedConstraints = hardConstraintResults.filter((item) => !item.passed);
    return {
      taskId,
      artifact,
      valid: false,
      score: 0,
      metrics,
      satisfaction: buildSatisfaction(metricProfile, metrics),
      hardConstraintResults,
      penalties: [],
      explanation: [
        '硬约束未全部通过，提交未进入正式排名。',
        ...failedConstraints.map((item) => `${item.label}: ${item.reason}`),
      ],
    };
  }

  const scoringMetrics = input.primaryMetrics?.length
    ? metricProfile.rankingMetrics.filter((m) => input.primaryMetrics!.includes(m.id))
    : metricProfile.rankingMetrics;
  const weights = buildDefaultWeights(scoringMetrics);
  const satisfaction = buildSatisfaction(metricProfile, metrics);
  const baseScore = scoreMetricSatisfaction(satisfaction, weights);
  const penalties = computePenalties(metrics);
  const penaltyValue = penalties.reduce((sum, penalty) => sum + penalty.value, 0);
  const score = clampScore(baseScore - penaltyValue);

  return {
    taskId,
    artifact,
    valid: true,
    score,
    metrics,
    satisfaction,
    hardConstraintResults,
    penalties,
    explanation: [
      '硬约束全部通过，提交进入正式排名。',
      `基础分 ${baseScore.toFixed(1)}，惩罚 ${penaltyValue.toFixed(1)}，最终分 ${score.toFixed(1)}。`,
    ],
  };
}

function buildDefaultWeights(rankingMetrics: MetricDefinition[]): Record<string, number> {
  return Object.fromEntries(rankingMetrics.map((metric) => [metric.id, 1]));
}

function buildSatisfaction(
  metricProfile: MetricProfile,
  metrics: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    metricProfile.rankingMetrics.map((metric) => [
      metric.id,
      Math.round(normalizeMetricValue(metric, metrics[metric.id] ?? Number.POSITIVE_INFINITY) * 1000) / 1000,
    ]),
  );
}

function computePenalties(metrics: Record<string, number>): ArenaEvaluationPenalty[] {
  const penalties: ArenaEvaluationPenalty[] = [];
  if ((metrics.controlEnergy ?? 0) > 24) {
    penalties.push({ id: 'control_energy_high', label: '控制能量偏高', value: 4 });
  }
  if ((metrics.overshoot ?? 0) > 28) {
    penalties.push({ id: 'overshoot_high', label: '超调量偏高', value: 3 });
  }
  return penalties;
}
