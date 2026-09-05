/**
 * 知识问答公平基线实验契约（Issue #1900）。
 *
 * 三臂共用同一题库、模型、采样参数、证据上下文与输出预算；生成回答
 * 作为固定快照原子落盘，结构评分按口径版本回放，汇总 fail closed。
 */

import type { StudyQuestionIntent, StudyQuestionScoringCaliber } from '@/lib/konling-study-question-structure';

export const KONLING_FAIR_EXPERIMENT_ARMS = [
  'plain-baseline',
  'enhanced-baseline',
  'full-feature',
] as const;

export type KonlingFairExperimentArm = (typeof KONLING_FAIR_EXPERIMENT_ARMS)[number];

export const KONLING_FAIR_EXPERIMENT_ERROR_CODES = [
  'rate-limited',
  'timeout',
  'insufficient-balance',
  'parse-failure',
  'provider-error',
] as const;

export type KonlingFairExperimentErrorCode = (typeof KONLING_FAIR_EXPERIMENT_ERROR_CODES)[number];

export interface KonlingFairExperimentBankItem {
  itemId: string;
  intent: StudyQuestionIntent;
  question: string;
  referenceAnswer: string;
  /** 分层标注（#1952，题库 V2）：难度、知识点与对抗风险类型；V1 条目缺省。 */
  difficulty?: KonlingFairExperimentBankDifficulty;
  topic?: string;
  riskType?: KonlingFairExperimentBankRiskType;
}

export const KONLING_FAIR_EXPERIMENT_BANK_DIFFICULTIES = [
  'foundational',
  'integrative',
  'adversarial',
] as const;

export type KonlingFairExperimentBankDifficulty = (typeof KONLING_FAIR_EXPERIMENT_BANK_DIFFICULTIES)[number];

export const KONLING_FAIR_EXPERIMENT_BANK_RISK_TYPES = [
  'false-premise',
  'evidence-conflict',
  'normative-currency',
  'hidden-defect',
  'boundary-condition',
  'insufficient-info',
] as const;

export type KonlingFairExperimentBankRiskType = (typeof KONLING_FAIR_EXPERIMENT_BANK_RISK_TYPES)[number];

export interface KonlingFairExperimentBank {
  bankVersion: string;
  items: readonly KonlingFairExperimentBankItem[];
  replicates: number;
}

export interface KonlingFairExperimentSampling {
  seed: number;
  temperature: number;
  topP: number | null;
  maxOutputTokens: number;
}

export interface KonlingFairExperimentConfig {
  model: string;
  provider: string;
  sampling: KonlingFairExperimentSampling;
  armPromptVersions: Record<KonlingFairExperimentArm, string>;
  /** 生成修订；评分口径不绑定 manifest——回放可对同一批快照追加口径。 */
  gitRevision: string;
  scorerRevision: string;
  bootstrapIterations: number;
  audit: {
    enabled: boolean;
    promptVersion: string;
    scoreVersion: string;
  };
}

export interface KonlingFairExperimentManifest {
  experimentVersion: string;
  bank: {
    version: string;
    hash: string;
    itemCount: number;
    replicates: number;
  };
  arms: readonly KonlingFairExperimentArm[];
  config: KonlingFairExperimentConfig;
}

export interface KonlingFairExperimentGenerateAttempt {
  startedAt: string;
  finishedAt: string;
  error: { code: KonlingFairExperimentErrorCode; message: string };
}

export interface KonlingFairExperimentAnswerRecord {
  taskKey: string;
  arm: KonlingFairExperimentArm;
  bankVersion: string;
  itemId: string;
  replicate: number;
  model: string;
  provider: string;
  sampling: KonlingFairExperimentSampling;
  promptVersion: string;
  gitRevision: string;
  status: 'completed';
  startedAt: string;
  finishedAt: string;
  answer: string;
  elapsedMs: number;
  /** full-feature 臂实际生效的运行时合同意图（与题库标注意图的差异单独报告）。 */
  contractIntent?: string;
}

export interface KonlingFairExperimentFailureRecord {
  taskKey: string;
  arm: KonlingFairExperimentArm;
  bankVersion: string;
  itemId: string;
  replicate: number;
  model: string;
  provider: string;
  sampling: KonlingFairExperimentSampling;
  promptVersion: string;
  gitRevision: string;
  status: 'failed';
  attempts: KonlingFairExperimentGenerateAttempt[];
}

export interface KonlingFairExperimentScoreRecord {
  taskKey: string;
  caliber: StudyQuestionScoringCaliber;
  arm: KonlingFairExperimentArm;
  bankVersion: string;
  itemId: string;
  replicate: number;
  intent: StudyQuestionIntent;
  passed: boolean;
  matchedIds: string[];
  missingIds: string[];
  scoredAt: string;
  gitRevision: string;
}

export type KonlingFairExperimentGenerateResponse =
  | { ok: true; result: { answer: string; elapsedMs: number } }
  | { ok: false; error: { code: KonlingFairExperimentErrorCode; message: string } };

export interface KonlingFairExperimentGenerateTask {
  arm: KonlingFairExperimentArm;
  item: KonlingFairExperimentBankItem;
  replicate: number;
  systemPrompt: string;
  userPrompt: string;
  sampling: KonlingFairExperimentSampling;
}

export type KonlingFairExperimentGenerateProvider = (
  task: KonlingFairExperimentGenerateTask,
) => Promise<KonlingFairExperimentGenerateResponse>;

export interface KonlingFairExperimentRunSummary {
  runId: string;
  arms: readonly KonlingFairExperimentArm[];
  generation: Record<KonlingFairExperimentArm, {
    expected: number;
    completedBeforeRun: number;
    completedThisRun: number;
    failed: number;
    totalCompleted: number;
    complete: boolean;
  }>;
  scoring: {
    calibers: readonly StudyQuestionScoringCaliber[];
    scored: number;
    complete: boolean;
  };
  audit: {
    enabled: boolean;
    complete: boolean;
  };
  aggregateStatus: KonlingFairExperimentAggregateStatus;
}

export type KonlingFairExperimentAggregateStatus =
  | 'complete'
  | 'incomplete'
  | 'mixed-configuration'
  | 'manifest-missing';

export interface KonlingFairExperimentRateMetric {
  n: number;
  passed: number;
  rate: number;
}

/** #1948：分类一致率的逐意图混淆分解，按题库标注意图分组。 */
export interface KonlingFairExperimentIntentConfusion {
  intent: StudyQuestionIntent;
  n: number;
  matched: number;
  rate: number;
  /** 实际路由意图 → 出现次数；键为路由层输出的意图字符串。 */
  routedCounts: Record<string, number>;
}

export interface KonlingFairExperimentPairedDifference {
  metric: string;
  direction: 'higher-is-better';
  baseline: { label: string; metric: KonlingFairExperimentRateMetric };
  comparison: { label: string; metric: KonlingFairExperimentRateMetric };
  percentagePointDifference: number;
  pairedCi95: { low: number; high: number };
  pairedN: number;
}

export interface KonlingFairExperimentOfficialSummary {
  runId: string;
  experimentVersion: string;
  status: 'complete';
  bank: KonlingFairExperimentManifest['bank'];
  config: KonlingFairExperimentConfig;
  /** 本次汇总覆盖的评分口径（回放报告可与 run 初始口径不同）。 */
  calibers: readonly StudyQuestionScoringCaliber[];
  perArm: Record<KonlingFairExperimentArm, {
    structure: Record<string, KonlingFairExperimentRateMetric>;
    audit: null | KonlingFairExperimentRateMetric & { meanRuleScore: number };
    composite: Record<string, KonlingFairExperimentRateMetric & {
      components: { structure: KonlingFairExperimentRateMetric; audit: KonlingFairExperimentRateMetric | null };
    }>;
    classificationAgreement: null | (KonlingFairExperimentRateMetric & {
      byIntent: readonly KonlingFairExperimentIntentConfusion[];
    });
    /** #1952：分级盲审五子分与天花板/地板（graded rubric 记录缺省为 null）。 */
    auditDimensions: null | {
      verdictDistribution: Record<KonlingFairExperimentGradedVerdictName, number>;
      meanSubscores: Record<KonlingFairExperimentAuditDimension, number>;
      ceilingProportion: number;
      floorProportion: number;
    };
  }>;
  /** #1952：难度×意图分层结果与分层配对差值；V1 题库（无分层标注）为空数组。 */
  stratified: {
    layers: Array<{
      difficulty: KonlingFairExperimentBankDifficulty;
      intent: StudyQuestionIntent;
      itemCount: number;
      structure: Record<string, KonlingFairExperimentRateMetric>;
      meanSubscores: Record<KonlingFairExperimentAuditDimension, number> | null;
    }>;
    stratifiedDeltas: KonlingFairExperimentPairedDifference[];
  };
  /** #1952：教师双人复核校准（记录缺失时 pending，不阻塞正式摘要）。 */
  expertReview: {
    status: 'reported' | 'pending';
    subsetItemIds: readonly string[];
    agreementProportion: number | null;
    disagreements: ReadonlyArray<{
      itemId: string;
      reviewerA: KonlingFairExperimentGradedVerdictName;
      reviewerB: KonlingFairExperimentGradedVerdictName;
      resolution: 'pending-teacher';
    }>;
  };
  /** #1952：合成数据声明——合成实验结果不得表述为真人学习效果或教学因果结论。 */
  syntheticDisclaimer: string;
  /** 生成行为差值：同口径、跨臂。 */
  generationDeltas: KonlingFairExperimentPairedDifference[];
  /** 评分器口径差值：同臂快照、跨口径。 */
  caliberDeltas: KonlingFairExperimentPairedDifference[];
}

export const KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS = [
  'correct',
  'minor-flaw',
  'major-error',
] as const;

export type KonlingFairExperimentGradedVerdictName = (typeof KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS)[number];

export const KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS = [
  'accuracy',
  'evidenceFaithfulness',
  'pedagogy',
  'structureCompliance',
  'traceCoverage',
] as const;

export type KonlingFairExperimentAuditDimension = (typeof KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS)[number];

/** #1952：分级盲审判定（rubric-graded.v2）。 */
export interface KonlingFairExperimentGradedVerdict {
  verdict: KonlingFairExperimentGradedVerdictName;
  /** 0-1 总分（与 rubric.v1 的 ruleScore 同尺度，供天花板/地板统计）。 */
  ruleScore: number;
  subscores: Record<KonlingFairExperimentAuditDimension, number>;
  notes: string | null;
}

/** #1952：盲审记录 result 的分级形态（judge 输出经解析器校验后落盘）。 */
export interface KonlingFairExperimentGradedAuditResult extends KonlingFairExperimentGradedVerdict {}

/**
 * 冻结记录的分级结果守卫：verdict 枚举、ruleScore 与五子分全部为合法
 * 0-1 有限数值才认定为 graded 记录；否则按记录现状回退二元语义或
 * fail closed（混合形态运行视为不完整）。
 */
export function isKonlingFairExperimentGradedAuditResult(value: unknown): value is KonlingFairExperimentGradedAuditResult {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { verdict?: unknown; ruleScore?: unknown; subscores?: unknown };
  if (!(KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS as readonly string[]).includes(String(record.verdict))) {
    return false;
  }
  if (typeof record.ruleScore !== 'number' || !Number.isFinite(record.ruleScore)
    || record.ruleScore < 0 || record.ruleScore > 1) {
    return false;
  }
  if (typeof record.subscores !== 'object' || record.subscores === null) return false;
  const subscores = record.subscores as Record<string, unknown>;
  return KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS.every((dimension) => {
    const score = subscores[dimension];
    return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1;
  });
}

/** #1952：合成实验边界声明——正式摘要固定携带，禁止表述为真人学习效果或教学因果结论。 */
export const KONLING_FAIR_EXPERIMENT_SYNTHETIC_DISCLAIMER
  = '本实验基于合成题库与模型生成的回答进行离线评测，盲审与专家复核均为离线判定；'
    + '结果仅描述评测配置下的系统行为差异，不得表述为真人学习者的学习效果或任何教学因果结论。';

export interface KonlingFairExperimentAggregateResult {
  runId: string;
  status: KonlingFairExperimentAggregateStatus;
  expected: number;
  officialSummary: KonlingFairExperimentOfficialSummary | null;
  incompleteDetail?: {
    phase: 'generate' | 'score' | 'audit';
    arm?: KonlingFairExperimentArm;
    missingTaskKeys?: string[];
    unexpectedKeys?: string[];
  };
  mixedConfigurationDetail?: {
    dimension: string;
    expected: string;
    observed: string;
    taskKey: string;
  };
}

function assertSafeTaskKeySegment(segment: string, label: string): void {
  if (!segment || /[\/\\]|\.\./.test(segment)) {
    throw new Error(`unsafe task key ${label}: ${segment}`);
  }
}

export function buildKonlingFairExperimentTaskKey(input: {
  bankVersion: string;
  arm: KonlingFairExperimentArm;
  itemId: string;
  replicate: number;
}): string {
  assertSafeTaskKeySegment(input.bankVersion, 'bankVersion');
  assertSafeTaskKeySegment(input.arm, 'arm');
  assertSafeTaskKeySegment(input.itemId, 'itemId');
  return [
    input.bankVersion,
    input.arm,
    input.itemId,
    String(input.replicate),
  ].join('--');
}
