import {
  getArenaChallengeObject,
  getArenaChallengeTask,
  getArenaMetricProfile,
} from '../data/seed-challenges';
import type { ControllerArtifact, MetricProfile } from '../types';
import type { ArenaEvaluationResult, HardConstraintResult } from './types';
import { clampScore, normalizeMetricValue, scoreMetricSatisfaction } from './scoring';

interface BlackBoxSummary {
  representation: string | undefined;
  experimentDatasetHash: string | undefined;
  identificationModelId: string | undefined;
  claimedIdentificationQuality: number | undefined;
  experimentCount: number | undefined;
  controllerGain: number | undefined;
  dampingCompensation: number | undefined;
  energyBudget: number | undefined;
  validationErrors: string[];
}

const BLACKBOX_LIMITS = {
  minExperimentCount: 3,
  maxExperimentCount: 20,
  maxControllerGain: 8,
  maxDampingCompensation: 3,
  maxEnergyBudget: 30,
};

function numberParam(artifact: ControllerArtifact, key: string): number | undefined {
  const value = artifact.params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function summarizeBlackBoxArtifact(artifact: ControllerArtifact): BlackBoxSummary {
  const representation = typeof artifact.params.representation === 'string'
    ? artifact.params.representation
    : undefined;
  const experimentDatasetHash = typeof artifact.params.experimentDatasetHash === 'string'
    ? artifact.params.experimentDatasetHash
    : undefined;
  const identificationModelId = typeof artifact.params.identificationModelId === 'string'
    ? artifact.params.identificationModelId
    : undefined;
  const claimedIdentificationQuality = numberParam(artifact, 'identificationQuality');
  const experimentCount = numberParam(artifact, 'experimentCount');
  const controllerGain = numberParam(artifact, 'controllerGain');
  const dampingCompensation = numberParam(artifact, 'dampingCompensation');
  const energyBudget = numberParam(artifact, 'energyBudget');
  const validationErrors = [
    representation !== 'identified-model-controller'
      ? 'representation 必须是 identified-model-controller。'
      : undefined,
    !experimentDatasetHash?.startsWith('arena-blackbox-dataset-')
      ? 'experimentDatasetHash 必须来自黑箱实验数据集。'
      : undefined,
    !identificationModelId?.trim() ? 'identificationModelId 不能为空。' : undefined,
    claimedIdentificationQuality === undefined ? 'identificationQuality 必须是有限数字。' : undefined,
    experimentCount === undefined ? 'experimentCount 必须是有限数字。' : undefined,
    controllerGain === undefined ? 'controllerGain 必须是有限数字。' : undefined,
    dampingCompensation === undefined ? 'dampingCompensation 必须是有限数字。' : undefined,
    energyBudget === undefined ? 'energyBudget 必须是有限数字。' : undefined,
    claimedIdentificationQuality !== undefined && claimedIdentificationQuality < 0 ? 'identificationQuality 不能为负。' : undefined,
    claimedIdentificationQuality !== undefined && claimedIdentificationQuality > 1 ? 'identificationQuality 不能超过 1。' : undefined,
    experimentCount !== undefined && !Number.isInteger(experimentCount) ? 'experimentCount 必须是整数。' : undefined,
    experimentCount !== undefined && experimentCount < BLACKBOX_LIMITS.minExperimentCount
      ? `experimentCount 不能低于 ${BLACKBOX_LIMITS.minExperimentCount}。`
      : undefined,
    experimentCount !== undefined && experimentCount > BLACKBOX_LIMITS.maxExperimentCount
      ? `experimentCount 不能超过 ${BLACKBOX_LIMITS.maxExperimentCount}。`
      : undefined,
    controllerGain !== undefined && controllerGain <= 0 ? 'controllerGain 必须大于 0。' : undefined,
    controllerGain !== undefined && controllerGain > BLACKBOX_LIMITS.maxControllerGain
      ? `controllerGain 不能超过 ${BLACKBOX_LIMITS.maxControllerGain}。`
      : undefined,
    dampingCompensation !== undefined && dampingCompensation < 0 ? 'dampingCompensation 不能为负。' : undefined,
    dampingCompensation !== undefined && dampingCompensation > BLACKBOX_LIMITS.maxDampingCompensation
      ? `dampingCompensation 不能超过 ${BLACKBOX_LIMITS.maxDampingCompensation}。`
      : undefined,
    energyBudget !== undefined && energyBudget <= 0 ? 'energyBudget 必须大于 0。' : undefined,
    energyBudget !== undefined && energyBudget > BLACKBOX_LIMITS.maxEnergyBudget
      ? `energyBudget 不能超过 ${BLACKBOX_LIMITS.maxEnergyBudget}。`
      : undefined,
  ].filter(Boolean) as string[];

  return {
    representation,
    experimentDatasetHash,
    identificationModelId,
    claimedIdentificationQuality,
    experimentCount,
    controllerGain,
    dampingCompensation,
    energyBudget,
    validationErrors,
  };
}

function round(value: number, scale: number): number {
  return Number.isFinite(value) ? Math.round(value * scale) / scale : 0;
}

function estimateBlackBoxMetrics(summary: BlackBoxSummary): Record<string, number> {
  const officialIdentificationFit = deriveOfficialIdentificationFit(summary);
  if (summary.validationErrors.length > 0) {
    return {
      trackingError: 0,
      worstCaseDeviation: 0,
      controlEnergy: 0,
      constraintViolations: 0,
      identificationFit: officialIdentificationFit,
      disturbanceRecovery: 0,
      smoothness: 0,
    };
  }

  const identificationQuality = officialIdentificationFit;
  const experimentCount = summary.experimentCount ?? 0;
  const controllerGain = summary.controllerGain ?? 0;
  const dampingCompensation = summary.dampingCompensation ?? 0;
  const energyBudget = summary.energyBudget ?? 1;
  const experimentPenalty = experimentCount < 6 ? (6 - experimentCount) * 0.018 : 0;
  const trackingError = Math.max(
    0.035,
    0.5 * (1 - identificationQuality) +
      Math.abs(controllerGain - 1.6) * 0.045 +
      Math.max(0, 0.55 - dampingCompensation) * 0.15 +
      experimentPenalty,
  );
  const worstCaseDeviation = trackingError * 1.75 +
    Math.max(0, controllerGain - 3) * 0.08 +
    Math.max(0, 0.45 - dampingCompensation) * 0.2;
  const controlEnergy = controllerGain * 4 + dampingCompensation * 2.2;
  const constraintViolations = Math.max(
    0,
    Math.ceil(Math.max(0, controlEnergy - energyBudget) / 3) +
      Math.ceil(Math.max(0, trackingError - 0.45) * 8) +
      (identificationQuality < 0.45 ? 2 : 0),
  );
  const disturbanceRecovery = Math.max(0, 1 - trackingError);
  const smoothness = Math.max(0.1, 1 - Math.abs(controllerGain - 1.4) * 0.12 - dampingCompensation * 0.04);

  return {
    trackingError: round(trackingError, 1000),
    worstCaseDeviation: round(worstCaseDeviation, 1000),
    controlEnergy: round(controlEnergy, 1000),
    constraintViolations,
    identificationFit: round(identificationQuality, 1000),
    disturbanceRecovery: round(disturbanceRecovery, 1000),
    smoothness: round(smoothness, 1000),
  };
}

function deriveOfficialIdentificationFit(summary: BlackBoxSummary): number {
  const experimentCount = summary.experimentCount ?? 0;
  const controllerGain = summary.controllerGain ?? 0;
  const dampingCompensation = summary.dampingCompensation ?? 0;
  const energyBudget = summary.energyBudget ?? 0;
  const experimentFit = Math.min(1, experimentCount / 8);
  const gainFit = Math.max(0, 1 - Math.abs(controllerGain - 1.6) / 4);
  const dampingFit = Math.max(0, 1 - Math.abs(dampingCompensation - 0.7) / 2);
  const budgetFit = Math.max(0, 1 - Math.abs(energyBudget - 12) / 24);
  return round((0.4 * experimentFit) + (0.25 * gainFit) + (0.2 * dampingFit) + (0.15 * budgetFit), 1000);
}

function evaluateHardConstraints(
  summary: BlackBoxSummary,
  metrics: Record<string, number>,
): HardConstraintResult[] {
  const validParameters = summary.validationErrors.length === 0;
  const scenarioBatchCompleted = validParameters &&
    (summary.experimentCount ?? 0) >= BLACKBOX_LIMITS.minExperimentCount;
  const safetyConstraintsPassed = validParameters && (metrics.constraintViolations ?? 0) === 0;
  const authorizedInterfaceOnly = validParameters &&
    summary.representation === 'identified-model-controller';

  return [
    {
      id: 'scenario_batch_completed',
      label: '官方场景批量评测完成',
      passed: scenarioBatchCompleted,
      reason: scenarioBatchCompleted ? undefined : summary.validationErrors.join(' ') || '黑箱实验次数不足。',
    },
    {
      id: 'safety_constraints_passed',
      label: '安全约束通过',
      passed: safetyConstraintsPassed,
      reason: safetyConstraintsPassed ? undefined : '隐藏海况中存在约束违反。',
    },
    {
      id: 'authorized_interface_only',
      label: '只使用授权接口',
      passed: authorizedInterfaceOnly,
      reason: authorizedInterfaceOnly ? undefined : summary.validationErrors.join(' ') || '控制器工件不符合黑箱接口。',
    },
  ];
}

function buildSatisfaction(metricProfile: MetricProfile, metrics: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    metricProfile.rankingMetrics.map((metric) => [
      metric.id,
      Math.round(normalizeMetricValue(metric, metrics[metric.id] ?? Number.POSITIVE_INFINITY) * 1000) / 1000,
    ]),
  );
}

export function evaluateBlackBoxSubmission({
  taskId,
  artifact,
}: {
  taskId: string;
  artifact: ControllerArtifact;
}): ArenaEvaluationResult {
  const task = getArenaChallengeTask(taskId);
  if (!task) {
    throw new Error(`Unknown arena task: ${taskId}`);
  }
  if (!task.allowedMethods.includes(artifact.method)) {
    throw new Error(`Controller method ${artifact.method} is not allowed for ${task.id}`);
  }
  if (artifact.method !== 'black-box-control') {
    throw new Error(`Controller method ${artifact.method} is not a black-box control artifact.`);
  }

  const object = getArenaChallengeObject(task.objectId);
  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  if (!object || !metricProfile) {
    throw new Error(`Arena task ${task.id} has incomplete evaluation configuration.`);
  }
  if (object.visibility !== 'black-box' || object.adapterType !== 'virtual-simulation') {
    throw new Error(`Arena task ${task.id} is not configured for black-box virtual simulation evaluation.`);
  }

  const summary = summarizeBlackBoxArtifact(artifact);
  const metrics = estimateBlackBoxMetrics(summary);
  const hardConstraintResults = evaluateHardConstraints(summary, metrics);
  const satisfaction = buildSatisfaction(metricProfile, metrics);
  const valid = hardConstraintResults.every((result) => result.passed);

  if (!valid) {
    return {
      taskId: task.id,
      artifact,
      valid: false,
      score: 0,
      metrics,
      satisfaction,
      hardConstraintResults,
      penalties: [],
      explanation: [
        '黑箱官方评测硬约束未全部通过，提交未进入正式排名。',
        ...hardConstraintResults.filter((item) => !item.passed).map((item) => `${item.label}: ${item.reason}`),
      ],
    };
  }

  const weights = Object.fromEntries(task.primaryMetrics.map((metricId) => [metricId, 1]));
  const baseScore = scoreMetricSatisfaction(satisfaction, weights);
  const experimentPenalty = Math.max(0, ((summary.experimentCount ?? 0) - 12) * 0.4);
  const score = clampScore(baseScore - experimentPenalty);

  return {
    taskId: task.id,
    artifact,
    valid: true,
    score,
    metrics,
    satisfaction,
    hardConstraintResults,
    penalties: experimentPenalty > 0
      ? [{ id: 'experiment_budget_high', label: '黑箱实验调用偏多', value: experimentPenalty }]
      : [],
    explanation: [
      '黑箱官方评测硬约束全部通过，提交进入正式排名。',
      `基础分 ${baseScore.toFixed(1)}，实验预算惩罚 ${experimentPenalty.toFixed(1)}，最终分 ${score.toFixed(1)}。`,
    ],
  };
}
