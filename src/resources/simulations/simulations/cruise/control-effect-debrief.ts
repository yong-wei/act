import {
  CRUISE_SCENE_MODEL_ID,
  CRUISE_SCENE_MODEL_VERSION,
  CRUISE_TRACE_SCENARIO_ID,
  CRUISE_TRACE_SCENE_ID,
  validateCruiseTelemetryBridgeSummary,
  type CruiseTelemetryBridgeSummary,
} from './telemetry-bridge';

export const CRUISE_DEBRIEF_SCENE_ID = CRUISE_TRACE_SCENE_ID;
export const CRUISE_DEBRIEF_SCENARIO_ID = CRUISE_TRACE_SCENARIO_ID;
export const CRUISE_DEBRIEF_MODEL_ID = CRUISE_SCENE_MODEL_ID;

export const FORBIDDEN_DEBRIEF_PHRASES = [
  '表现良好',
  '需要关注',
  '优秀',
  '最优',
  '最佳',
] as const;

export type DebriefStatus = 'ready' | 'unavailable';
export type MeasurementKind = 'run-aggregate' | 'run-end-observation';
export type MetricGroup = 'response' | 'control';
export type ThresholdOperator = '<=' | '>=' | '<' | '>';

export interface CruiseDebriefMetricDefinition {
  metricId: string;
  label: string;
  unit: string;
  measurementKind: MeasurementKind;
  measurementLabel: string;
  group: MetricGroup;
  summaryKey: string;
}

export const CRUISE_DEBRIEF_METRIC_REGISTRY: CruiseDebriefMetricDefinition[] = [
  {
    metricId: 'turn_overshoot_percent',
    label: '转向超调',
    unit: '%',
    measurementKind: 'run-aggregate',
    measurementLabel: '本次转向过程聚合',
    group: 'response',
    summaryKey: 'turn_overshoot_percent',
  },
  {
    metricId: 'settling_time_s',
    label: '调节时间',
    unit: 's',
    measurementKind: 'run-aggregate',
    measurementLabel: '本次转向过程聚合',
    group: 'response',
    summaryKey: 'settling_time_s',
  },
  {
    metricId: 'heading_error_deg',
    label: '运行结束时航向误差',
    unit: '°',
    measurementKind: 'run-end-observation',
    measurementLabel: '运行结束时观察',
    group: 'response',
    summaryKey: 'heading_error_deg',
  },
  {
    metricId: 'peak_lateral_accel_g',
    label: '最大横向加速度',
    unit: 'g',
    measurementKind: 'run-aggregate',
    measurementLabel: '本次运行过程聚合',
    group: 'response',
    summaryKey: 'peak_lateral_accel_g',
  },
  {
    metricId: 'rudder_deg',
    label: '运行结束时舵角',
    unit: '°',
    measurementKind: 'run-end-observation',
    measurementLabel: '运行结束时观察',
    group: 'control',
    summaryKey: 'rudder_deg',
  },
  {
    metricId: 'fin_power_kw',
    label: '运行结束时减摇鳍功率',
    unit: 'kW',
    measurementKind: 'run-end-observation',
    measurementLabel: '运行结束时观察',
    group: 'control',
    summaryKey: 'fin_power_kw',
  },
];

export interface CruiseTaskThreshold {
  metricId: string;
  operator: ThresholdOperator;
  value: number;
  unit: string;
}

export interface CruiseTaskThresholdContract {
  taskId: string;
  provenance: 'registered-course-task';
  provenanceLabel: string;
  thresholds: CruiseTaskThreshold[];
}

export const CRUISE_COMFORT_COURSE_TURN_TASK: CruiseTaskThresholdContract = {
  taskId: 'cruise-comfort-course-turn',
  provenance: 'registered-course-task',
  provenanceLabel: '课程任务 cruise-comfort-course-turn',
  thresholds: [
    { metricId: 'turn_overshoot_percent', operator: '<=', value: 10, unit: '%' },
    { metricId: 'settling_time_s', operator: '<=', value: 45, unit: 's' },
  ],
};

export interface CruiseDebriefMetricFact {
  metricId: string;
  label: string;
  value: number | null;
  unit: string;
  formattedValue: string | null;
  measurementKind: MeasurementKind;
  measurementLabel: string;
  group: MetricGroup;
  availability: 'available' | 'unavailable';
  unavailableReason: string | null;
  factText: string;
}

export interface CruiseDebriefThresholdOutcome {
  metricId: string;
  label: string;
  satisfied: boolean;
  observed: number;
  threshold: number;
  operator: ThresholdOperator;
  unit: string;
  comparisonText: string;
  outcomeText: string;
  taskId: string;
  provenance: 'registered-course-task';
  provenanceLabel: string;
}

export interface CruiseControlEffectDebrief {
  status: DebriefStatus;
  unavailableReason: string | null;
  runId: string | null;
  sceneId: typeof CRUISE_DEBRIEF_SCENE_ID;
  scenarioId: typeof CRUISE_DEBRIEF_SCENARIO_ID;
  modelId: typeof CRUISE_DEBRIEF_MODEL_ID;
  facts: CruiseDebriefMetricFact[];
  responseFacts: CruiseDebriefMetricFact[];
  controlFacts: CruiseDebriefMetricFact[];
  thresholds: CruiseDebriefThresholdOutcome[];
  hasAuthoritativeTask: boolean;
  taskJudgmentUnavailableReason: string | null;
  nextObservation: string | null;
  controlConstraintNote: string | null;
}

export interface ProjectCruiseControlEffectDebriefInput {
  currentRunId: string;
  isCompleted: boolean;
  isPaused: boolean;
  summary: CruiseTelemetryBridgeSummary | null;
  taskContract?: CruiseTaskThresholdContract | null;
}

export function resolveCruiseDebriefTaskContract(isBoundCourseTask: boolean): CruiseTaskThresholdContract | null {
  return isBoundCourseTask ? CRUISE_COMFORT_COURSE_TURN_TASK : null;
}

export function hasFiniteRequiredCruisePerformance<T extends { overshoot: number; settlingTime: number }>(
  performance: T | null | undefined,
): performance is T {
  return Boolean(
    performance
    && Number.isFinite(performance.overshoot)
    && Number.isFinite(performance.settlingTime)
  );
}

export function canEmitCruiseCompletionTelemetry(input: {
  isCompleted: boolean;
  runId: string;
  emittedRunId: string | null;
  summary: CruiseTelemetryBridgeSummary | null;
}): boolean {
  if (!input.isCompleted || !input.summary) return false;
  if (input.emittedRunId === input.runId) return false;
  if (!validateCruiseTelemetryBridgeSummary(input.summary)) return false;
  return input.summary.trace.envelope.runId === input.runId;
}

export function debriefContainsForbiddenPhrase(text: string): boolean {
  return FORBIDDEN_DEBRIEF_PHRASES.some((phrase) => text.includes(phrase));
}

export function projectCruiseControlEffectDebrief(
  input: ProjectCruiseControlEffectDebriefInput,
): CruiseControlEffectDebrief {
  const unavailable = (reason: string): CruiseControlEffectDebrief => ({
    status: 'unavailable',
    unavailableReason: reason,
    runId: input.currentRunId || null,
    sceneId: CRUISE_DEBRIEF_SCENE_ID,
    scenarioId: CRUISE_DEBRIEF_SCENARIO_ID,
    modelId: CRUISE_DEBRIEF_MODEL_ID,
    facts: [],
    responseFacts: [],
    controlFacts: [],
    thresholds: [],
    hasAuthoritativeTask: false,
    taskJudgmentUnavailableReason: reason,
    nextObservation: null,
    controlConstraintNote: null,
  });

  if (!input.isCompleted) {
    return unavailable(input.isPaused
      ? '运行在完成前暂停，不能给出确定性复盘。'
      : '运行尚未完成，不能给出确定性复盘。');
  }
  if (!input.summary || !validateCruiseTelemetryBridgeSummary(input.summary)) {
    return unavailable('当前运行摘要未通过校验，不能给出确定性复盘。');
  }

  const envelope = input.summary.trace.envelope;
  if (
    envelope.runId !== input.currentRunId
    || envelope.sceneId !== CRUISE_TRACE_SCENE_ID
    || envelope.scenarioId !== CRUISE_TRACE_SCENARIO_ID
    || envelope.modelVersion !== CRUISE_SCENE_MODEL_VERSION
  ) {
    return unavailable('运行身份与当前场景不一致，不能给出确定性复盘。');
  }

  const metrics = input.summary.trace.summary.metrics ?? {};
  const requiredIds = ['turn_overshoot_percent', 'settling_time_s'] as const;
  if (requiredIds.some((metricId) => !Number.isFinite(metrics[metricId]))) {
    return unavailable('必要响应指标无效，不能给出确定性复盘。');
  }

  const facts = CRUISE_DEBRIEF_METRIC_REGISTRY.map((definition) => projectFact(definition, metrics[definition.summaryKey]));
  const taskContract = isAuthoritativeTaskContract(input.taskContract) ? input.taskContract : null;
  const thresholds = taskContract
    ? taskContract.thresholds.flatMap((threshold) => {
      const fact = facts.find((item) => item.metricId === threshold.metricId);
      if (!fact || fact.availability !== 'available' || fact.value === null) return [];
      if (threshold.unit !== fact.unit || !Number.isFinite(threshold.value)) return [];
      return [projectThreshold(fact, threshold, taskContract)];
    })
    : [];

  const unsatisfied = thresholds.find((item) => !item.satisfied);
  const nextObservation = unsatisfied
    ? nextObservationForUnsatisfied(unsatisfied.metricId)
    : taskContract
      ? '可以继续观察航向曲线和结束时刻舵角，确认跟踪过程是否仍有可改进的余量。'
      : '当前没有权威任务阈值。可以继续观察航向曲线、调节过程和结束时刻控制量，不要把自填目标当成任务结论。';

  const debrief: CruiseControlEffectDebrief = {
    status: 'ready',
    unavailableReason: null,
    runId: envelope.runId,
    sceneId: CRUISE_DEBRIEF_SCENE_ID,
    scenarioId: CRUISE_DEBRIEF_SCENARIO_ID,
    modelId: CRUISE_DEBRIEF_MODEL_ID,
    facts,
    responseFacts: facts.filter((item) => item.group === 'response'),
    controlFacts: facts.filter((item) => item.group === 'control'),
    thresholds,
    hasAuthoritativeTask: Boolean(taskContract),
    taskJudgmentUnavailableReason: taskContract
      ? null
      : '没有权威任务阈值，本卡片只陈述已计算事实，不输出任务结论。',
    nextObservation,
    controlConstraintNote: '结束时刻舵角和减摇鳍功率只是瞬时观察，现有数据不能判断控制需求是否过大。',
  };
  assertNoForbiddenCopy(debrief);
  return debrief;
}

function isAuthoritativeTaskContract(
  contract: CruiseTaskThresholdContract | null | undefined,
): contract is CruiseTaskThresholdContract {
  return Boolean(
    contract
    && contract.provenance === 'registered-course-task'
    && contract.taskId.trim().length > 0
    && contract.thresholds.length > 0,
  );
}

function projectFact(definition: CruiseDebriefMetricDefinition, raw: number | undefined): CruiseDebriefMetricFact {
  if (!Number.isFinite(raw)) {
    return {
      metricId: definition.metricId,
      label: definition.label,
      value: null,
      unit: definition.unit,
      formattedValue: null,
      measurementKind: definition.measurementKind,
      measurementLabel: definition.measurementLabel,
      group: definition.group,
      availability: 'unavailable',
      unavailableReason: `${definition.label}缺少有效有限值。`,
      factText: `${definition.label}当前不可用：缺少有效有限值。`,
    };
  }
  const value = raw as number;
  return {
    metricId: definition.metricId,
    label: definition.label,
    value,
    unit: definition.unit,
    formattedValue: formatWithUnit(value, definition.unit),
    measurementKind: definition.measurementKind,
    measurementLabel: definition.measurementLabel,
    group: definition.group,
    availability: 'available',
    unavailableReason: null,
    factText: factTextFor(definition.metricId, value, definition.unit),
  };
}

function projectThreshold(
  fact: CruiseDebriefMetricFact,
  threshold: CruiseTaskThreshold,
  contract: CruiseTaskThresholdContract,
): CruiseDebriefThresholdOutcome {
  const observed = fact.value as number;
  const satisfied = compare(observed, threshold.operator, threshold.value);
  const comparisonText = satisfied
    ? `${formatWithUnit(observed, fact.unit)} ${operatorSymbol(threshold.operator)} ${formatWithUnit(threshold.value, threshold.unit)}`
    : `${formatWithUnit(observed, fact.unit)} ${observed > threshold.value ? '>' : '<'} ${formatWithUnit(threshold.value, threshold.unit)}`;
  return {
    metricId: fact.metricId,
    label: fact.label,
    satisfied,
    observed,
    threshold: threshold.value,
    operator: threshold.operator,
    unit: fact.unit,
    comparisonText,
    outcomeText: satisfied ? `${fact.label}要求已满足` : `${fact.label}要求未满足`,
    taskId: contract.taskId,
    provenance: contract.provenance,
    provenanceLabel: contract.provenanceLabel,
  };
}

function compare(observed: number, operator: ThresholdOperator, threshold: number): boolean {
  if (operator === '<=') return observed <= threshold;
  if (operator === '>=') return observed >= threshold;
  if (operator === '<') return observed < threshold;
  return observed > threshold;
}

function operatorSymbol(operator: ThresholdOperator): string {
  if (operator === '<=') return '≤';
  if (operator === '>=') return '≥';
  return operator;
}

function formatNumber(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(normalized);
}

function formatWithUnit(value: number, unit: string): string {
  const formatted = formatNumber(value);
  if (!unit) return formatted;
  return unit === '%' || unit === '°' ? `${formatted}${unit}` : `${formatted} ${unit}`;
}

function factTextFor(metricId: string, value: number, unit: string): string {
  const formatted = formatWithUnit(value, unit);
  if (metricId === 'turn_overshoot_percent') {
    return `本次转向过程的峰值航向相对目标偏了 ${formatted}。`;
  }
  if (metricId === 'settling_time_s') {
    return `本次转向过程的调节时间为 ${formatted}。`;
  }
  if (metricId === 'heading_error_deg') {
    return `运行结束时航向误差为 ${formatted}。这是结束时刻观察，不是稳态误差。`;
  }
  if (metricId === 'peak_lateral_accel_g') {
    return `本次运行记录的最大横向加速度为 ${formatted}。`;
  }
  if (metricId === 'rudder_deg') {
    return `运行结束时舵角为 ${formatted}。这是结束时刻观察，不能代表全程峰值、控制能量或执行器约束。`;
  }
  if (metricId === 'fin_power_kw') {
    return `运行结束时减摇鳍功率为 ${formatted}。这是结束时刻观察，不能代表全程峰值、控制能量或执行器约束。`;
  }
  return `${formatted}（${unit}）`;
}

function nextObservationForUnsatisfied(metricId: string): string {
  if (metricId === 'turn_overshoot_percent') {
    return '可以继续观察航向峰值相对目标的偏离，并对比一次更小峰值的转向过程。';
  }
  if (metricId === 'settling_time_s') {
    return '可以继续观察航向进入目标附近后的停留过程，并记录调节时间如何变化。';
  }
  return '可以继续观察该项对应的曲线或结束时刻读数，而不是把结果当成根因诊断。';
}

function assertNoForbiddenCopy(debrief: CruiseControlEffectDebrief): void {
  const corpus = [
    debrief.unavailableReason,
    debrief.taskJudgmentUnavailableReason,
    debrief.nextObservation,
    debrief.controlConstraintNote,
    ...debrief.facts.map((item) => item.factText),
    ...debrief.thresholds.map((item) => `${item.outcomeText} ${item.comparisonText}`),
  ].filter((item): item is string => Boolean(item)).join('\n');
  if (debriefContainsForbiddenPhrase(corpus) || corpus.includes('稳态误差') && !corpus.includes('不是稳态误差')) {
    throw new Error('Cruise debrief copy violated evidence boundaries.');
  }
}
