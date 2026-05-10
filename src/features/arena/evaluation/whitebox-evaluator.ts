import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaMetricProfile,
} from '../data/seed-challenges';
import type { ChallengeObject, ChallengeTask, ControllerArtifact, MetricProfile } from '../types';
import type { ArenaEvaluationPenalty, ArenaEvaluationResult, HardConstraintResult, WhiteBoxEvaluationInput } from './types';
import { clampScore, normalizeMetricValue, scoreMetricSatisfaction } from './scoring';

interface ControllerSummary {
  effectiveGain: number;
  proportional: number;
  integral: number;
  derivative: number;
  shapeBoost: number;
  causal: boolean;
  finite: boolean;
  nonNegative: boolean;
}

function numberParam(artifact: ControllerArtifact, key: string, fallback = 0): number {
  const value = artifact.params[key];
  return typeof value === 'number' ? value : fallback;
}

function dcGain(object: ChallengeObject): number {
  const numerator = object.model.numerator;
  const denominator = object.model.denominator;
  const numeratorConstant = numerator[numerator.length - 1] ?? 0;
  const denominatorConstant = denominator[denominator.length - 1] ?? 0;
  if (Math.abs(denominatorConstant) < 1e-9) {
    return Math.abs(numerator[0] ?? 1);
  }
  return Math.abs(numeratorConstant / denominatorConstant);
}

function summarizeController(artifact: ControllerArtifact, object: ChallengeObject): ControllerSummary {
  if (artifact.method === 'pid') {
    const kp = numberParam(artifact, 'kp');
    const ki = numberParam(artifact, 'ki');
    const kd = numberParam(artifact, 'kd');
    const values = [kp, ki, kd];

    return {
      effectiveGain: dcGain(object) * (kp + 0.45 * ki + 0.25 * kd),
      proportional: kp,
      integral: ki,
      derivative: kd,
      shapeBoost: 1 + 0.2 * kd,
      causal: true,
      finite: values.every(Number.isFinite),
      nonNegative: values.every((value) => value >= 0),
    };
  }

  if (artifact.method === 'serial-compensator') {
    const gain = numberParam(artifact, 'gain', 1);
    const zero = numberParam(artifact, 'zero', 1);
    const pole = numberParam(artifact, 'pole', 4);
    const values = [gain, zero, pole];

    return {
      effectiveGain: dcGain(object) * gain * Math.max(0.2, zero / Math.max(pole, 0.2)),
      proportional: gain,
      integral: 0,
      derivative: Math.max(0, pole - zero) / Math.max(pole, 1),
      shapeBoost: 1 + Math.max(0, pole - zero) / Math.max(pole, 1),
      causal: pole > 0 && zero > 0,
      finite: values.every(Number.isFinite),
      nonNegative: values.every((value) => value >= 0),
    };
  }

  return {
    effectiveGain: 0,
    proportional: 0,
    integral: 0,
    derivative: 0,
    shapeBoost: 1,
    causal: false,
    finite: false,
    nonNegative: false,
  };
}

function evaluateHardConstraints(
  task: ChallengeTask,
  object: ChallengeObject,
  controller: ControllerSummary,
): HardConstraintResult[] {
  const stable = controller.finite && controller.nonNegative && controller.effectiveGain > 0 && controller.effectiveGain < 80;
  const controlNotSaturated = controller.effectiveGain < 42 && controller.derivative < 8;

  return [
    {
      id: 'closed_loop_stable',
      label: '闭环稳定',
      passed: stable,
      reason: stable ? undefined : '控制器参数导致闭环稳定性门槛未通过。',
    },
    {
      id: 'finite_response',
      label: '响应有限',
      passed: controller.finite,
      reason: controller.finite ? undefined : '控制器参数包含非有限数值。',
    },
    {
      id: 'controller_causal',
      label: '控制器因果',
      passed: controller.causal && task.allowedMethods.length > 0,
      reason: controller.causal ? undefined : '控制器形式不满足因果或任务许可方法。',
    },
    {
      id: 'control_not_saturated',
      label: '控制量未严重饱和',
      passed: !object.tags.includes('频域约束') || controlNotSaturated,
      reason: controlNotSaturated ? undefined : '控制作用过强，未通过控制量约束。',
    },
  ];
}

function estimateMetrics(object: ChallengeObject, controller: ControllerSummary): Record<string, number> {
  const gain = Math.max(0.05, controller.effectiveGain);
  const inertia = Math.max(1, object.model.denominator.length - 1);
  const dampingBoost = 1 + controller.derivative + 0.12 * controller.shapeBoost;
  const integralBoost = controller.integral > 0 ? controller.integral : 0;
  const settlingTime = Math.max(0.4, (7.5 * inertia) / (1 + 0.9 * gain + dampingBoost));
  const overshoot = Math.max(0, 34 / dampingBoost + 0.18 * gain - 3 * Math.min(integralBoost, 2));
  const steadyStateError = Math.max(0.001, 1 / (1 + gain + 8 * integralBoost));
  const itae = settlingTime * (0.55 + steadyStateError) + overshoot / 18;
  const controlEnergy = gain * (1 + 0.4 * controller.derivative + 0.2 * integralBoost);
  const comfortBandPeak = Math.max(0.1, overshoot / 11 + controlEnergy / 18);

  return {
    settlingTime: Math.round(settlingTime * 1000) / 1000,
    overshoot: Math.round(overshoot * 1000) / 1000,
    steadyStateError: Math.round(steadyStateError * 10000) / 10000,
    itae: Math.round(itae * 1000) / 1000,
    controlEnergy: Math.round(controlEnergy * 1000) / 1000,
    comfortBandPeak: Math.round(comfortBandPeak * 1000) / 1000,
  };
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

export function evaluateWhiteBoxSubmission(input: WhiteBoxEvaluationInput): ArenaEvaluationResult {
  const task = getArenaChallengeTask(input.taskId);
  if (!task) {
    throw new Error(`Unknown arena task: ${input.taskId}`);
  }
  if (!task.allowedMethods.includes(input.artifact.method)) {
    throw new Error(`Controller method ${input.artifact.method} is not allowed for ${task.id}`);
  }

  const object = getArenaChallengeObject(task.objectId);
  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  if (!object || !metricProfile) {
    throw new Error(`Arena task ${task.id} has incomplete evaluation configuration.`);
  }

  const controller = summarizeController(input.artifact, object);
  const hardConstraintResults = evaluateHardConstraints(task, object, controller);
  const valid = hardConstraintResults.every((result) => result.passed);
  const metrics = estimateMetrics(object, controller);
  const satisfaction = buildSatisfaction(metricProfile, metrics);

  if (!valid) {
    return {
      taskId: task.id,
      artifact: input.artifact,
      valid: false,
      score: 0,
      metrics,
      satisfaction,
      hardConstraintResults,
      penalties: [],
      explanation: [
        '硬约束未全部通过，提交未进入正式排名。',
        ...hardConstraintResults.filter((item) => !item.passed).map((item) => `${item.label}: ${item.reason}`),
      ],
    };
  }

  const weights = Object.fromEntries(task.primaryMetrics.map((metricId) => [metricId, 1]));
  const baseScore = scoreMetricSatisfaction(satisfaction, weights);
  const penalties = computePenalties(metrics);
  const penaltyValue = penalties.reduce((sum, penalty) => sum + penalty.value, 0);
  const score = clampScore(baseScore - penaltyValue);

  return {
    taskId: task.id,
    artifact: input.artifact,
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

function buildSatisfaction(metricProfile: MetricProfile, metrics: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    metricProfile.rankingMetrics.map((metric) => [
      metric.id,
      Math.round(normalizeMetricValue(metric, metrics[metric.id] ?? Number.POSITIVE_INFINITY) * 1000) / 1000,
    ]),
  );
}
