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
}

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
    classificationAgreement: null | KonlingFairExperimentRateMetric;
  }>;
  /** 生成行为差值：同口径、跨臂。 */
  generationDeltas: KonlingFairExperimentPairedDifference[];
  /** 评分器口径差值：同臂快照、跨口径。 */
  caliberDeltas: KonlingFairExperimentPairedDifference[];
}

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
