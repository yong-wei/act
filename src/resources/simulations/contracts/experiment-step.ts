/**
 * 七船教学总合同：机读步骤 schema、现实因素等级与评分框架
 * （issue-2149 阶段 A 合同基础设施）。
 *
 * 步骤内容严格来自专项 issue（#2154/#2158–#2163）；本模块只承载合同
 * 结构与冻结常量，实现层按 schema 填充，校验器 fail-fast 防漂移。
 */

/** 认知层级（issue §2 能力列；每步一个主层级）。 */
export type CognitiveLevel =
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'design'
  | 'evaluate'
  | 'synthesize'
  | 'engineering-judgment';

/** 步骤形态：运行步骤需要真实运行证据；纯分析步骤不强行凑交互。 */
export type StepKind = 'run' | 'analysis';

/** 训练/验证角色（issue §2 训练 seed 20261106、验证 17/29/43）。 */
export type TrainValidationRole = 'training' | 'validation' | 'none';

/** 现实因素开放等级（数值见 #2156 阶段 A 模块；factorMask 引用）。 */
export type RealityFactorLevel =
  | 'P0' | 'N0'
  | 'W1' | 'W2'
  | 'V1' | 'V2' | 'V3'
  | 'C1' | 'C2'
  | 'E1' | 'E2'
  | 'N1' | 'N2';

/** 学生可控变量及范围（缺范围即非法）。 */
export interface StudentControl {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  /** 锁定原因（本步不可调时显式说明教学条件）。 */
  readonly lockedReason?: string;
}

export interface StepRubric {
  /** 设计型步骤 40% 对半：性能/约束 与 证据质量。 */
  readonly kind: 'standard' | 'design';
  readonly performanceCriteria?: string;
  readonly evidenceCriteria?: string;
}

export interface ExperimentStep {
  readonly experimentId: string;
  readonly experimentVersion: string;
  readonly stepId: string;
  readonly title: string;
  readonly learningObjective: string;
  readonly cognitiveLevel: CognitiveLevel;
  readonly stepKind: StepKind;
  readonly trainValidationRole: TrainValidationRole;
  readonly prerequisites: readonly string[];
  /** 引用本实验内步骤或空；不得跨实验（七船不共享通关资格）。 */
  readonly initialCondition: Record<string, number | string | boolean>;
  readonly factorMask: readonly RealityFactorLevel[];
  readonly studentControls: readonly StudentControl[];
  readonly eventTimeline: readonly string[];
  readonly runDurationS?: number;
  readonly termination: string;
  readonly measurementSignals: readonly string[];
  readonly observationWindowS: readonly [number, number];
  readonly requiredArtifacts: readonly string[];
  readonly rubric: StepRubric;
  readonly hints: readonly string[];
  readonly retryPolicy: 'free' | 'limited' | 'once';
}

export interface StepValidationError {
  readonly stepId: string;
  readonly field: string;
  readonly reason: string;
}

const COGNITIVE_LEVELS: readonly CognitiveLevel[] = [
  'understand', 'apply', 'analyze', 'design', 'evaluate', 'synthesize', 'engineering-judgment',
];

const FACTOR_LEVELS: readonly RealityFactorLevel[] = [
  'P0', 'N0', 'W1', 'W2', 'V1', 'V2', 'V3', 'C1', 'C2', 'E1', 'E2', 'N1', 'N2',
];

const EXPERIMENT_IDS: readonly string[] = [
  'exp-01-055-heading',
  'exp-02-lng-berthing',
  'exp-03-container-schedule',
  'exp-04-cruise-comfort',
  'exp-05-981-dp',
  'exp-06-xuelong2-ice',
  'exp-07-tianjing-dredging',
];

/** 冻结评分框架（issue §5；任何漂移由 validateScoring 检出）。 */
export const STEP_SCORE_DISTRIBUTION: readonly number[] = [
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 10,
] as const;

export const EXPERIMENT_TOTAL_SCORE = 100;
export const MID_STEP_RATIOS = { prediction: 0.3, operation: 0.4, interpretation: 0.3 } as const;
export const FINAL_STEP_BREAKDOWN = { modelAssumptions: 3, ownEvidence: 3, comparison: 2, boundary: 2 } as const;

/** 校验单步合同（fail-fast；返回空数组=通过）。 */
export function validateStep(step: ExperimentStep): StepValidationError[] {
  const errors: StepValidationError[] = [];
  const push = (field: string, reason: string) => errors.push({ stepId: step.stepId, field, reason });

  if (!step.experimentId || !EXPERIMENT_IDS.includes(step.experimentId)) {
    push('experimentId', `未知实验标识：${step.experimentId}`);
  }
  for (const field of ['experimentVersion', 'stepId', 'title', 'learningObjective', 'termination'] as const) {
    if (!step[field]) push(field, '必填字段缺失');
  }
  if (!COGNITIVE_LEVELS.includes(step.cognitiveLevel)) {
    push('cognitiveLevel', `非法认知层级：${step.cognitiveLevel as string}`);
  }
  if (step.factorMask.length === 0) {
    push('factorMask', '至少引用一个现实因素等级（P0 等关态也是显式声明）');
  }
  for (const factor of step.factorMask) {
    if (!FACTOR_LEVELS.includes(factor)) {
      push('factorMask', `非法因素等级：${factor as string}`);
    }
  }
  if (step.studentControls.length === 0) {
    push('studentControls', '至少一个可控变量或显式锁定说明');
  }
  for (const control of step.studentControls) {
    if (!(control.min < control.max)) {
      push('studentControls', `可控变量 ${control.key} 缺有效范围（min<max）`);
    }
    if (!control.unit) {
      push('studentControls', `可控变量 ${control.key} 缺单位`);
    }
  }
  if (step.stepKind === 'run') {
    if (step.measurementSignals.length === 0) {
      push('measurementSignals', '运行步骤必须声明测量信号');
    }
    if (step.eventTimeline.length === 0) {
      push('eventTimeline', '运行步骤必须有事件时间线');
    }
  }
  if (step.observationWindowS[0] >= step.observationWindowS[1]) {
    push('observationWindowS', '观测窗起点必须早于终点');
  }
  // 跨船前置：prerequisites 只允许本实验内步骤（形如 `<experimentId>#<stepId>` 或裸 stepId）。
  for (const prerequisite of step.prerequisites) {
    if (prerequisite.includes('#') && !prerequisite.startsWith(`${step.experimentId}#`)) {
      push('prerequisites', `跨实验前置（七船不共享通关资格）：${prerequisite}`);
    }
  }
  if (step.rubric.kind === 'design' && !step.rubric.performanceCriteria) {
    push('rubric', '设计型步骤必须声明性能/约束判据');
  }
  return errors;
}

/** 校验整组步骤（含量化评分合同）。 */
export function validateExperiment(steps: readonly ExperimentStep[]): StepValidationError[] {
  const errors = steps.flatMap(validateStep);
  if (steps.length !== 20) {
    errors.push({ stepId: '*', field: 'steps', reason: `每实验固定 20 步，得到 ${steps.length}` });
  }
  return errors;
}

/** 评分合同校验：分值分布与总分冻结（issue §5）。 */
export function validateScoring(): readonly string[] {
  const problems: string[] = [];
  if (STEP_SCORE_DISTRIBUTION.length !== 20) {
    problems.push(`分值分布必须 20 项，得到 ${STEP_SCORE_DISTRIBUTION.length}`);
  }
  const total = STEP_SCORE_DISTRIBUTION.reduce((sum, value) => sum + value, 0);
  if (total !== EXPERIMENT_TOTAL_SCORE) {
    problems.push(`步骤原始分合计 ${total} ≠ 总分 ${EXPERIMENT_TOTAL_SCORE}`);
  }
  const ratioSum =
    MID_STEP_RATIOS.prediction + MID_STEP_RATIOS.operation + MID_STEP_RATIOS.interpretation;
  if (Math.abs(ratioSum - 1) > 1e-9) {
    problems.push(`三段占比合计 ${ratioSum} ≠ 1`);
  }
  const finalSum =
    FINAL_STEP_BREAKDOWN.modelAssumptions +
    FINAL_STEP_BREAKDOWN.ownEvidence +
    FINAL_STEP_BREAKDOWN.comparison +
    FINAL_STEP_BREAKDOWN.boundary;
  if (finalSum !== STEP_SCORE_DISTRIBUTION[19]) {
    problems.push(`第 20 步四分合计 ${finalSum} ≠ ${STEP_SCORE_DISTRIBUTION[19]}`);
  }
  return problems;
}

/** 旧 24 步 → 新合同迁移记录（成绩只读映射；不把旧满分转成新完成）。 */
export interface StepMigrationEntry {
  readonly oldStepId: string;
  readonly newStepId: string | 'retired';
  readonly objectiveChange: string;
  readonly dataCompatible: boolean;
}
