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
  closedLoopStable: boolean;
  validationErrors: string[];
}

function numberParam(artifact: ControllerArtifact, key: string): number | undefined {
  const value = artifact.params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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

function trimPolynomial(poly: number[]): number[] {
  const firstNonZero = poly.findIndex((value) => Math.abs(value) > 1e-9);
  return firstNonZero === -1 ? [0] : poly.slice(firstNonZero);
}

function addPolynomials(left: number[], right: number[]): number[] {
  const length = Math.max(left.length, right.length);
  const paddedLeft = Array.from({ length }, (_, index) => left[index - (length - left.length)] ?? 0);
  const paddedRight = Array.from({ length }, (_, index) => right[index - (length - right.length)] ?? 0);
  return trimPolynomial(paddedLeft.map((value, index) => value + paddedRight[index]));
}

function multiplyPolynomials(left: number[], right: number[]): number[] {
  const result = Array(left.length + right.length - 1).fill(0) as number[];
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      result[leftIndex + rightIndex] += left[leftIndex] * right[rightIndex];
    }
  }
  return trimPolynomial(result);
}

function isHurwitzStable(polynomial: number[]): boolean {
  const coefficients = trimPolynomial(polynomial);
  if (coefficients.length < 2 || coefficients.some((value) => !Number.isFinite(value))) return false;

  const leading = coefficients[0] ?? 0;
  if (Math.abs(leading) < 1e-9) return false;
  const normalized = leading < 0 ? coefficients.map((value) => -value) : coefficients;
  if (normalized.some((value) => value <= 0)) return false;

  const columns = Math.ceil(normalized.length / 2);
  const rows = normalized.length;
  const table = Array.from({ length: rows }, () => Array(columns).fill(0) as number[]);

  for (let index = 0; index < columns; index += 1) {
    table[0][index] = normalized[index * 2] ?? 0;
    table[1][index] = normalized[index * 2 + 1] ?? 0;
  }

  for (let row = 2; row < rows; row += 1) {
    if (table[row - 1].every((value) => Math.abs(value) < 1e-9)) {
      const degree = rows - row + 1;
      for (let column = 0; column < columns; column += 1) {
        table[row - 1][column] = table[row - 2][column] * (degree - 2 * column);
      }
    }
    const pivot = Math.abs(table[row - 1][0]) < 1e-9 ? 1e-9 : table[row - 1][0];
    for (let column = 0; column < columns - 1; column += 1) {
      table[row][column] = ((pivot * table[row - 2][column + 1]) - (table[row - 2][0] * table[row - 1][column + 1])) / pivot;
    }
  }

  return table.every((row) => row[0] > 0);
}

function closedLoopStable(object: ChallengeObject, controllerNumerator: number[], controllerDenominator: number[]): boolean {
  const characteristic = addPolynomials(
    multiplyPolynomials(controllerDenominator, object.model.denominator),
    multiplyPolynomials(controllerNumerator, object.model.numerator),
  );
  return isHurwitzStable(characteristic);
}

function summarizeController(artifact: ControllerArtifact, object: ChallengeObject): ControllerSummary {
  if (artifact.method === 'pid') {
    const kp = numberParam(artifact, 'kp');
    const ki = numberParam(artifact, 'ki');
    const kd = numberParam(artifact, 'kd');
    const values = [kp, ki, kd];
    const validationErrors = [
      kp === undefined ? 'kp 必须是有限数字。' : undefined,
      ki === undefined ? 'ki 必须是有限数字。' : undefined,
      kd === undefined ? 'kd 必须是有限数字。' : undefined,
      kp !== undefined && kp <= 0 ? 'kp 必须大于 0。' : undefined,
      ki !== undefined && ki < 0 ? 'ki 不能为负。' : undefined,
      kd !== undefined && kd < 0 ? 'kd 不能为负。' : undefined,
    ].filter(Boolean) as string[];
    const validValues = validationErrors.length === 0;
    const safeKp = kp ?? 0;
    const safeKi = ki ?? 0;
    const safeKd = kd ?? 0;
    const controllerNumerator = [safeKd, safeKp, safeKi];
    const controllerDenominator = [1, 0];

    return {
      effectiveGain: dcGain(object) * (safeKp + 0.45 * safeKi + 0.25 * safeKd),
      proportional: safeKp,
      integral: safeKi,
      derivative: safeKd,
      shapeBoost: 1 + 0.2 * safeKd,
      causal: true,
      finite: values.every((value) => value !== undefined),
      nonNegative: [safeKp, safeKi, safeKd].every((value) => value >= 0),
      closedLoopStable: validValues && closedLoopStable(object, controllerNumerator, controllerDenominator),
      validationErrors,
    };
  }

  if (artifact.method === 'serial-compensator') {
    const gain = numberParam(artifact, 'gain');
    const zero = numberParam(artifact, 'zero');
    const pole = numberParam(artifact, 'pole');
    const values = [gain, zero, pole];
    const validationErrors = [
      gain === undefined ? 'gain 必须是有限数字。' : undefined,
      zero === undefined ? 'zero 必须是有限数字。' : undefined,
      pole === undefined ? 'pole 必须是有限数字。' : undefined,
      gain !== undefined && gain <= 0 ? 'gain 必须大于 0。' : undefined,
      zero !== undefined && zero <= 0 ? 'zero 必须大于 0。' : undefined,
      pole !== undefined && pole <= 0 ? 'pole 必须大于 0。' : undefined,
    ].filter(Boolean) as string[];
    const validValues = validationErrors.length === 0;
    const safeGain = gain ?? 0;
    const safeZero = zero ?? 0;
    const safePole = pole ?? 1;
    const controllerNumerator = [safeGain, safeGain * safeZero];
    const controllerDenominator = [1, safePole];

    return {
      effectiveGain: dcGain(object) * safeGain * Math.max(0.2, safeZero / Math.max(safePole, 0.2)),
      proportional: safeGain,
      integral: 0,
      derivative: Math.max(0, safePole - safeZero) / Math.max(safePole, 1),
      shapeBoost: 1 + Math.max(0, safePole - safeZero) / Math.max(safePole, 1),
      causal: validValues,
      finite: values.every((value) => value !== undefined),
      nonNegative: [safeGain, safeZero, safePole].every((value) => value >= 0),
      closedLoopStable: validValues && closedLoopStable(object, controllerNumerator, controllerDenominator),
      validationErrors,
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
    closedLoopStable: false,
    validationErrors: ['未知控制器方法。'],
  };
}

function evaluateHardConstraints(
  task: ChallengeTask,
  object: ChallengeObject,
  metricProfile: MetricProfile,
  controller: ControllerSummary,
  metrics: Record<string, number>,
): HardConstraintResult[] {
  const stable = controller.finite && controller.nonNegative && controller.closedLoopStable;
  const controlEnergyLimit = metricProfile.rankingMetrics.find((metric) => metric.id === 'controlEnergy')?.unacceptableValue ?? 24;
  const controlNotSaturated = (metrics.controlEnergy ?? Number.POSITIVE_INFINITY) <= controlEnergyLimit;

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
      passed: controller.finite && controller.validationErrors.length === 0,
      reason: controller.validationErrors.length === 0 ? undefined : controller.validationErrors.join(' '),
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
      reason: controlNotSaturated ? undefined : `控制能量超过不可接受值 ${controlEnergyLimit}。`,
    },
  ];
}

function estimateMetrics(object: ChallengeObject, controller: ControllerSummary): Record<string, number> {
  if (!controller.finite || !Number.isFinite(controller.effectiveGain)) {
    return {
      settlingTime: 0,
      overshoot: 0,
      steadyStateError: 0,
      itae: 0,
      controlEnergy: 0,
      comfortBandPeak: 0,
    };
  }
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

  const round = (value: number, scale: number) => (Number.isFinite(value) ? Math.round(value * scale) / scale : 0);

  return {
    settlingTime: round(settlingTime, 1000),
    overshoot: round(overshoot, 1000),
    steadyStateError: round(steadyStateError, 10000),
    itae: round(itae, 1000),
    controlEnergy: round(controlEnergy, 1000),
    comfortBandPeak: round(comfortBandPeak, 1000),
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
  const metrics = estimateMetrics(object, controller);
  const hardConstraintResults = evaluateHardConstraints(task, object, metricProfile, controller, metrics);
  const valid = hardConstraintResults.every((result) => result.passed);
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
