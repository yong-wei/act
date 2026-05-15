import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaMetricProfile,
} from '../data/seed-challenges';
import type { ChallengeObject, ChallengeTask, ControllerArtifact, MetricProfile, TransferFunctionModel } from '../types';
import type { ArenaEvaluationPenalty, ArenaEvaluationResult, HardConstraintResult, WhiteBoxEvaluationInput } from './types';
import { normalizeMetricValue } from './scoring';
import { evaluateMetricProfile } from './metric-profile-evaluator';
import {
  createHeuristicWhiteBoxMetricProvider,
  normalizeWhiteBoxMetricProviderOutput,
  selectWhiteBoxMetricProvider,
  type WhiteBoxMetricProviderOutput,
} from './whitebox-metric-provider';

export interface ControllerSummary {
  effectiveGain: number;
  proportional: number;
  integral: number;
  derivative: number;
  shapeBoost: number;
  robustnessBoost: number;
  causal: boolean;
  finite: boolean;
  nonNegative: boolean;
  closedLoopStable: boolean;
  validationErrors: string[];
}

const COMPOSITE_LIMITS = {
  maxPrefilterGain: 5,
  maxForwardGain: 20,
  maxLocalFeedbackGain: 10,
  maxDisturbanceCompensation: 5,
};

const MPC_LIMITS = {
  minPredictionHorizon: 4,
  maxPredictionHorizon: 60,
  minControlHorizon: 1,
  maxControlHorizon: 20,
  maxOutputWeight: 20,
  minControlWeight: 0.01,
  maxControlWeight: 10,
  maxTerminalWeight: 30,
  maxInputLimit: 12,
  minSampleTime: 0.02,
  maxSampleTime: 1,
};

const OPTIMIZATION_LIMITS = {
  minWeight: 0.05,
  maxWeight: 8,
  minSearchBudget: 10,
  maxSearchBudget: 240,
};

function numberParam(artifact: ControllerArtifact, key: string): number | undefined {
  const value = artifact.params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function dcGain(model: TransferFunctionModel): number {
  const numerator = model.numerator;
  const denominator = model.denominator;
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

function closedLoopStable(model: TransferFunctionModel, controllerNumerator: number[], controllerDenominator: number[]): boolean {
  const characteristic = addPolynomials(
    multiplyPolynomials(controllerDenominator, model.denominator),
    multiplyPolynomials(controllerNumerator, model.numerator),
  );
  return isHurwitzStable(characteristic);
}

function buildPidFamilyTransferFunction({
  kp,
  ki,
  kd,
}: {
  kp: number;
  ki: number;
  kd: number;
}): { numerator: number[]; denominator: number[] } {
  if (ki > 0) {
    return { numerator: [kd, kp, ki], denominator: [1, 0] };
  }
  if (kd > 0) {
    return { numerator: [kd, kp], denominator: [1] };
  }
  return { numerator: [kp], denominator: [1] };
}

export function summarizeController(artifact: ControllerArtifact, model: TransferFunctionModel): ControllerSummary {
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
    const controllerTransfer = buildPidFamilyTransferFunction({
      kp: safeKp,
      ki: safeKi,
      kd: safeKd,
    });

    return {
      effectiveGain: dcGain(model) * (safeKp + 0.45 * safeKi + 0.25 * safeKd),
      proportional: safeKp,
      integral: safeKi,
      derivative: safeKd,
      shapeBoost: 1 + 0.2 * safeKd,
      robustnessBoost: 1,
      causal: true,
      finite: values.every((value) => value !== undefined),
      nonNegative: [safeKp, safeKi, safeKd].every((value) => value >= 0),
      closedLoopStable: validValues && closedLoopStable(
        model,
        controllerTransfer.numerator,
        controllerTransfer.denominator,
      ),
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
    const serialShape = safeZero > 0 ? safePole / safeZero : 0;
    const controllerNumerator = [safeGain * serialShape, safeGain * safePole];
    const controllerDenominator = [1, safePole];

    return {
      effectiveGain: dcGain(model) * safeGain,
      proportional: safeGain,
      integral: 0,
      derivative: Math.max(0, safePole - safeZero) / Math.max(safePole, 1),
      shapeBoost: 1 + Math.max(0, safePole - safeZero) / Math.max(safePole, 1),
      robustnessBoost: 1 + Math.max(0, safePole - safeZero) / Math.max(safePole, 2),
      causal: validValues,
      finite: values.every((value) => value !== undefined),
      nonNegative: [safeGain, safeZero, safePole].every((value) => value >= 0),
      closedLoopStable: validValues && closedLoopStable(model, controllerNumerator, controllerDenominator),
      validationErrors,
    };
  }

  if (artifact.method === 'composite-compensation') {
    const structure = artifact.params.structure;
    const prefilterGain = numberParam(artifact, 'prefilterGain');
    const forwardGain = numberParam(artifact, 'forwardGain');
    const localFeedbackGain = numberParam(artifact, 'localFeedbackGain');
    const disturbanceCompensation = numberParam(artifact, 'disturbanceCompensation');
    const values = [prefilterGain, forwardGain, localFeedbackGain, disturbanceCompensation];
    const validationErrors = [
      structure !== 'prefilter-forward-local-feedback-disturbance'
        ? 'structure 必须是 prefilter-forward-local-feedback-disturbance。'
        : undefined,
      prefilterGain === undefined ? 'prefilterGain 必须是有限数字。' : undefined,
      forwardGain === undefined ? 'forwardGain 必须是有限数字。' : undefined,
      localFeedbackGain === undefined ? 'localFeedbackGain 必须是有限数字。' : undefined,
      disturbanceCompensation === undefined ? 'disturbanceCompensation 必须是有限数字。' : undefined,
      prefilterGain !== undefined && prefilterGain <= 0 ? 'prefilterGain 必须大于 0。' : undefined,
      forwardGain !== undefined && forwardGain <= 0 ? 'forwardGain 必须大于 0。' : undefined,
      localFeedbackGain !== undefined && localFeedbackGain < 0 ? 'localFeedbackGain 不能为负。' : undefined,
      disturbanceCompensation !== undefined && disturbanceCompensation < 0 ? 'disturbanceCompensation 不能为负。' : undefined,
      prefilterGain !== undefined && prefilterGain > COMPOSITE_LIMITS.maxPrefilterGain
        ? `prefilterGain 不能超过 ${COMPOSITE_LIMITS.maxPrefilterGain}。`
        : undefined,
      forwardGain !== undefined && forwardGain > COMPOSITE_LIMITS.maxForwardGain
        ? `forwardGain 不能超过 ${COMPOSITE_LIMITS.maxForwardGain}。`
        : undefined,
      localFeedbackGain !== undefined && localFeedbackGain > COMPOSITE_LIMITS.maxLocalFeedbackGain
        ? `localFeedbackGain 不能超过 ${COMPOSITE_LIMITS.maxLocalFeedbackGain}。`
        : undefined,
      disturbanceCompensation !== undefined &&
        disturbanceCompensation > COMPOSITE_LIMITS.maxDisturbanceCompensation
        ? `disturbanceCompensation 不能超过 ${COMPOSITE_LIMITS.maxDisturbanceCompensation}。`
        : undefined,
    ].filter(Boolean) as string[];
    const validValues = validationErrors.length === 0;
    const safePrefilterGain = prefilterGain ?? 0;
    const safeForwardGain = forwardGain ?? 0;
    const safeLocalFeedbackGain = localFeedbackGain ?? 0;
    const safeDisturbanceCompensation = disturbanceCompensation ?? 0;
    const loopGain = (safePrefilterGain * safeForwardGain) / (1 + safeLocalFeedbackGain);
    const disturbanceLoopBoost = 1 + 0.2 * safeDisturbanceCompensation;
    const controllerNumerator = [loopGain * disturbanceLoopBoost];
    const controllerDenominator = [1];

    return {
      effectiveGain: dcGain(model) * loopGain * disturbanceLoopBoost,
      proportional: safeForwardGain,
      integral: 2 * safeDisturbanceCompensation,
      derivative: safeLocalFeedbackGain / (1 + safeLocalFeedbackGain),
      shapeBoost: 1 +
        (safeLocalFeedbackGain / (1 + safeLocalFeedbackGain)) +
        0.2 * safeDisturbanceCompensation,
      robustnessBoost: 1 + safeLocalFeedbackGain / (1 + safeLocalFeedbackGain),
      causal: validValues,
      finite: values.every((value) => value !== undefined),
      nonNegative: [
        safePrefilterGain,
        safeForwardGain,
        safeLocalFeedbackGain,
        safeDisturbanceCompensation,
      ].every((value) => value >= 0),
      closedLoopStable: validValues && closedLoopStable(model, controllerNumerator, controllerDenominator),
      validationErrors,
    };
  }

  if (artifact.method === 'optimized-pid') {
    const template = artifact.params.template;
    const speedWeight = numberParam(artifact, 'speedWeight');
    const energyWeight = numberParam(artifact, 'energyWeight');
    const robustnessWeight = numberParam(artifact, 'robustnessWeight');
    const overshootWeight = numberParam(artifact, 'overshootWeight');
    const searchBudget = numberParam(artifact, 'searchBudget');
    const values = [speedWeight, energyWeight, robustnessWeight, overshootWeight, searchBudget];
    const integerBudget = searchBudget !== undefined && Number.isInteger(searchBudget);
    const weightError = (key: string, value: number | undefined): string | undefined => {
      if (value === undefined) return `${key} 必须是有限数字。`;
      if (value < OPTIMIZATION_LIMITS.minWeight || value > OPTIMIZATION_LIMITS.maxWeight) {
        return `${key} 必须在 ${OPTIMIZATION_LIMITS.minWeight} 到 ${OPTIMIZATION_LIMITS.maxWeight} 之间。`;
      }
      return undefined;
    };
    const validationErrors = [
      template !== 'bounded-optimized-pid' ? 'template 必须是 bounded-optimized-pid。' : undefined,
      weightError('speedWeight', speedWeight),
      weightError('energyWeight', energyWeight),
      weightError('robustnessWeight', robustnessWeight),
      weightError('overshootWeight', overshootWeight),
      searchBudget === undefined ? 'searchBudget 必须是有限数字。' : undefined,
      searchBudget !== undefined && !integerBudget ? 'searchBudget 必须是整数。' : undefined,
      searchBudget !== undefined &&
        (searchBudget < OPTIMIZATION_LIMITS.minSearchBudget ||
          searchBudget > OPTIMIZATION_LIMITS.maxSearchBudget)
        ? `searchBudget 必须在 ${OPTIMIZATION_LIMITS.minSearchBudget} 到 ${OPTIMIZATION_LIMITS.maxSearchBudget} 之间。`
        : undefined,
    ].filter(Boolean) as string[];
    const validValues = validationErrors.length === 0;
    const safeSpeedWeight = speedWeight ?? 0;
    const safeEnergyWeight = energyWeight ?? 0;
    const safeRobustnessWeight = robustnessWeight ?? 0;
    const safeOvershootWeight = overshootWeight ?? 0;
    const safeSearchBudget = searchBudget ?? 0;
    const budgetBoost = Math.min(1.5, Math.log1p(safeSearchBudget) / Math.log1p(OPTIMIZATION_LIMITS.maxSearchBudget));
    const effectiveGain = dcGain(model) *
      (0.7 + 0.55 * safeSpeedWeight + 0.25 * safeOvershootWeight + 0.18 * safeRobustnessWeight) *
      budgetBoost /
      (1 + 0.32 * safeEnergyWeight);
    const dampingShape = 1 + 0.22 * safeOvershootWeight + 0.18 * safeRobustnessWeight + 0.12 * budgetBoost;

    return {
      effectiveGain,
      proportional: safeSpeedWeight,
      integral: 0.18 * (safeSpeedWeight + safeRobustnessWeight),
      derivative: (safeOvershootWeight + safeRobustnessWeight) / (1 + safeEnergyWeight),
      shapeBoost: dampingShape,
      robustnessBoost: 1 + 0.22 * safeRobustnessWeight + 0.08 * budgetBoost,
      causal: validValues,
      finite: values.every((value) => value !== undefined),
      nonNegative: [
        safeSpeedWeight,
        safeEnergyWeight,
        safeRobustnessWeight,
        safeOvershootWeight,
        safeSearchBudget,
      ].every((value) => value >= 0),
      closedLoopStable: validValues && closedLoopStable(model, [Math.max(effectiveGain, 0.001)], [1]),
      validationErrors,
    };
  }

  if (artifact.method === 'mpc') {
    const template = artifact.params.template;
    const predictionHorizon = numberParam(artifact, 'predictionHorizon');
    const controlHorizon = numberParam(artifact, 'controlHorizon');
    const outputWeight = numberParam(artifact, 'outputWeight');
    const controlWeight = numberParam(artifact, 'controlWeight');
    const terminalWeight = numberParam(artifact, 'terminalWeight');
    const inputLimit = numberParam(artifact, 'inputLimit');
    const sampleTime = numberParam(artifact, 'sampleTime');
    const values = [
      predictionHorizon,
      controlHorizon,
      outputWeight,
      controlWeight,
      terminalWeight,
      inputLimit,
      sampleTime,
    ];
    const integerPrediction = predictionHorizon !== undefined && Number.isInteger(predictionHorizon);
    const integerControl = controlHorizon !== undefined && Number.isInteger(controlHorizon);
    const validationErrors = [
      template !== 'bounded-linear-mpc' ? 'template 必须是 bounded-linear-mpc。' : undefined,
      predictionHorizon === undefined ? 'predictionHorizon 必须是有限数字。' : undefined,
      controlHorizon === undefined ? 'controlHorizon 必须是有限数字。' : undefined,
      outputWeight === undefined ? 'outputWeight 必须是有限数字。' : undefined,
      controlWeight === undefined ? 'controlWeight 必须是有限数字。' : undefined,
      terminalWeight === undefined ? 'terminalWeight 必须是有限数字。' : undefined,
      inputLimit === undefined ? 'inputLimit 必须是有限数字。' : undefined,
      sampleTime === undefined ? 'sampleTime 必须是有限数字。' : undefined,
      predictionHorizon !== undefined && !integerPrediction ? 'predictionHorizon 必须是整数。' : undefined,
      controlHorizon !== undefined && !integerControl ? 'controlHorizon 必须是整数。' : undefined,
      predictionHorizon !== undefined &&
        (predictionHorizon < MPC_LIMITS.minPredictionHorizon || predictionHorizon > MPC_LIMITS.maxPredictionHorizon)
        ? `predictionHorizon 必须在 ${MPC_LIMITS.minPredictionHorizon} 到 ${MPC_LIMITS.maxPredictionHorizon} 之间。`
        : undefined,
      controlHorizon !== undefined &&
        (controlHorizon < MPC_LIMITS.minControlHorizon || controlHorizon > MPC_LIMITS.maxControlHorizon)
        ? `controlHorizon 必须在 ${MPC_LIMITS.minControlHorizon} 到 ${MPC_LIMITS.maxControlHorizon} 之间。`
        : undefined,
      predictionHorizon !== undefined && controlHorizon !== undefined && controlHorizon > predictionHorizon
        ? 'controlHorizon 不能超过 predictionHorizon。'
        : undefined,
      outputWeight !== undefined && (outputWeight <= 0 || outputWeight > MPC_LIMITS.maxOutputWeight)
        ? `outputWeight 必须大于 0 且不超过 ${MPC_LIMITS.maxOutputWeight}。`
        : undefined,
      controlWeight !== undefined &&
        (controlWeight < MPC_LIMITS.minControlWeight || controlWeight > MPC_LIMITS.maxControlWeight)
        ? `controlWeight 必须在 ${MPC_LIMITS.minControlWeight} 到 ${MPC_LIMITS.maxControlWeight} 之间。`
        : undefined,
      terminalWeight !== undefined && (terminalWeight < 0 || terminalWeight > MPC_LIMITS.maxTerminalWeight)
        ? `terminalWeight 必须在 0 到 ${MPC_LIMITS.maxTerminalWeight} 之间。`
        : undefined,
      inputLimit !== undefined && (inputLimit <= 0 || inputLimit > MPC_LIMITS.maxInputLimit)
        ? `inputLimit 必须大于 0 且不超过 ${MPC_LIMITS.maxInputLimit}。`
        : undefined,
      sampleTime !== undefined && (sampleTime < MPC_LIMITS.minSampleTime || sampleTime > MPC_LIMITS.maxSampleTime)
        ? `sampleTime 必须在 ${MPC_LIMITS.minSampleTime} 到 ${MPC_LIMITS.maxSampleTime} 之间。`
        : undefined,
    ].filter(Boolean) as string[];
    const validValues = validationErrors.length === 0;
    const safePredictionHorizon = predictionHorizon ?? 0;
    const safeControlHorizon = controlHorizon ?? 0;
    const safeOutputWeight = outputWeight ?? 0;
    const safeControlWeight = controlWeight ?? 0;
    const safeTerminalWeight = terminalWeight ?? 0;
    const safeInputLimit = inputLimit ?? 0;
    const horizonRatio = safePredictionHorizon > 0 ? safeControlHorizon / safePredictionHorizon : 0;
    const loopGain = dcGain(model) *
      safeOutputWeight *
      (1 + 0.08 * safeTerminalWeight) *
      (0.8 + 1.7 * horizonRatio) /
      (1 + 1.4 * safeControlWeight);
    const dampingShape = 1 +
      0.2 * Math.log1p(safePredictionHorizon) +
      0.12 * Math.log1p(safeTerminalWeight) +
      0.05 * safeInputLimit;

    return {
      effectiveGain: loopGain,
      proportional: safeOutputWeight,
      integral: 0.2 * safeTerminalWeight,
      derivative: Math.max(0, horizonRatio),
      shapeBoost: dampingShape,
      robustnessBoost: 1 + 0.12 * Math.log1p(safePredictionHorizon) + 0.08 * Math.log1p(safeInputLimit),
      causal: validValues,
      finite: values.every((value) => value !== undefined),
      nonNegative: [
        safePredictionHorizon,
        safeControlHorizon,
        safeOutputWeight,
        safeControlWeight,
        safeTerminalWeight,
        safeInputLimit,
        sampleTime ?? 0,
      ].every((value) => value >= 0),
      closedLoopStable: validValues && closedLoopStable(model, [Math.max(loopGain, 0.001)], [1]),
      validationErrors,
    };
  }

  return {
    effectiveGain: 0,
    proportional: 0,
    integral: 0,
    derivative: 0,
    shapeBoost: 1,
    robustnessBoost: 1,
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
  providerOutput?: WhiteBoxMetricProviderOutput,
): HardConstraintResult[] {
  const stable = controller.finite &&
    controller.nonNegative &&
    controller.closedLoopStable &&
    (providerOutput?.analysisClosedLoopStable ?? true);
  const controlEnergyLimit = metricProfile.rankingMetrics.find((metric) => metric.id === 'controlEnergy')?.unacceptableValue ?? 24;
  const controlNotSaturated = (metrics.controlEnergy ?? Number.POSITIVE_INFINITY) <= controlEnergyLimit;
  const controlConstraintPassed = !object.tags.includes('频域约束') || controlNotSaturated;
  const hiddenScenarioLimit = metricProfile.rankingMetrics.find((metric) => metric.id === 'hiddenScenarioWorst')?.unacceptableValue;
  const hiddenScenarioPassed = hiddenScenarioLimit === undefined ||
    (metrics.hiddenScenarioWorst ?? Number.POSITIVE_INFINITY) <= hiddenScenarioLimit;

  const results: HardConstraintResult[] = [
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
      passed: controlConstraintPassed,
      reason: controlConstraintPassed ? undefined : `控制能量超过不可接受值 ${controlEnergyLimit}。`,
    },
  ];

  if (metricProfile.hardConstraints.includes('hidden_scenarios_passed')) {
    results.push({
      id: 'hidden_scenarios_passed',
      label: '隐藏场景通过',
      passed: hiddenScenarioPassed,
      reason: hiddenScenarioPassed ? undefined : `隐藏场景最差表现超过不可接受值 ${hiddenScenarioLimit}。`,
    });
  }

  const requiredMetrics = metricProfile.rankingMetrics.map((metric) => metric.id);
  const analysisBacked = providerOutput?.analysisClosedLoopStable !== undefined;
  const missingAnalysisMetrics = requiredMetrics.filter((metricId) =>
    analysisBacked && !Number.isFinite(metrics[metricId]),
  );
  if (missingAnalysisMetrics.length > 0) {
    results.push({
      id: 'analysis_metrics_available',
      label: '分析指标可用',
      passed: false,
      reason: `ControlAnalysisResult 缺少必要指标：${missingAnalysisMetrics.join(', ')}。`,
    });
  }

  return results;
}

export function estimateMetrics(model: TransferFunctionModel, controller: ControllerSummary): Record<string, number> {
  if (!controller.finite || !Number.isFinite(controller.effectiveGain)) {
    return {
      settlingTime: 0,
      overshoot: 0,
      steadyStateError: 0,
      itae: 0,
      controlEnergy: 0,
      comfortBandPeak: 0,
      hiddenScenarioWorst: 0,
    };
  }
  const gain = Math.max(0.05, controller.effectiveGain);
  const inertia = Math.max(1, model.denominator.length - 1);
  const dampingBoost = 1 + controller.derivative + 0.12 * controller.shapeBoost;
  const integralBoost = controller.integral > 0 ? controller.integral : 0;
  const settlingTime = Math.max(0.4, (7.5 * inertia) / (1 + 0.9 * gain + dampingBoost));
  const overshoot = Math.max(0, 34 / dampingBoost + 0.18 * gain - 3 * Math.min(integralBoost, 2));
  const steadyStateError = Math.max(0.001, 1 / (1 + gain + 8 * integralBoost));
  const itae = settlingTime * (0.55 + steadyStateError) + overshoot / 18;
  const controlEnergy = gain * (1 + 0.4 * controller.derivative + 0.2 * integralBoost);
  const comfortBandPeak = Math.max(0.1, overshoot / 11 + controlEnergy / 18);
  const hiddenScenarioWorst = Math.max(
    0.08,
    ((settlingTime / 5) + (overshoot / 34) + (controlEnergy / 18)) /
      Math.max(controller.robustnessBoost, 0.5),
  );

  const round = (value: number, scale: number) => (Number.isFinite(value) ? Math.round(value * scale) / scale : 0);

  return {
    settlingTime: round(settlingTime, 1000),
    overshoot: round(overshoot, 1000),
    steadyStateError: round(steadyStateError, 10000),
    itae: round(itae, 1000),
    controlEnergy: round(controlEnergy, 1000),
    comfortBandPeak: round(comfortBandPeak, 1000),
    hiddenScenarioWorst: round(hiddenScenarioWorst, 1000),
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

export async function evaluateWhiteBoxSubmission(input: WhiteBoxEvaluationInput): Promise<ArenaEvaluationResult> {
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
  if (!object.model) {
    throw new Error(`Arena object ${object.id} does not expose a transfer-function model for white-box evaluation.`);
  }

  const controller = summarizeController(input.artifact, object.model);
  const provider = input.metricProviderMode === 'template-preview' || controller.validationErrors.length > 0
    ? createHeuristicWhiteBoxMetricProvider()
    : selectWhiteBoxMetricProvider(input.artifact.method, {
      controlAnalysisService: input.controlAnalysisService,
    });
  const providerOutput = normalizeWhiteBoxMetricProviderOutput(await provider.evaluate({
    task,
    object,
    artifact: input.artifact,
  }));
  const hardConstraintResults = evaluateHardConstraints(task, object, metricProfile, controller, providerOutput.metrics, providerOutput);

  const result = evaluateMetricProfile({
    taskId: task.id,
    artifact: input.artifact,
    metricProfile,
    metrics: providerOutput.metrics,
    hardConstraintResults,
    primaryMetrics: task.primaryMetrics,
  });

  return {
    ...result,
    explanation: [
      ...result.explanation,
      ...providerOutput.explanation,
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
