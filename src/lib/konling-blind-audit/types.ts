/**
 * 知识问答盲审评测契约（Issue #1820）。
 *
 * 长批次 AI 评测把外部服务失败视为正常运行条件：每条任务原子落盘、
 * 唯一任务键幂等续跑、汇总阶段完整性门禁 fail closed。
 */

export const KONLING_BLIND_AUDIT_MODES = ['rule-score', 'blind-audit'] as const;

export type KonlingBlindAuditMode = (typeof KONLING_BLIND_AUDIT_MODES)[number];

export const KONLING_BLIND_AUDIT_ERROR_CODES = [
  'rate-limited',
  'timeout',
  'insufficient-balance',
  'parse-failure',
  'provider-error',
] as const;

export type KonlingBlindAuditErrorCode = (typeof KONLING_BLIND_AUDIT_ERROR_CODES)[number];

export interface KonlingBlindAuditItem {
  itemId: string;
  intent: string;
  question: string;
  referenceAnswer: string;
}

export interface KonlingBlindAuditManifest {
  benchmarkVersion: string;
  modes: readonly KonlingBlindAuditMode[];
  items: readonly KonlingBlindAuditItem[];
  replicates: number;
}

export interface KonlingBlindAuditRunConfig {
  mode: KonlingBlindAuditMode;
  model: string;
  provider: string;
  promptVersion: string;
  scoreVersion: string;
  gitRevision: string;
}

export interface KonlingBlindAuditAttempt {
  startedAt: string;
  finishedAt: string;
  error: { code: KonlingBlindAuditErrorCode; message: string };
}

export interface KonlingBlindAuditRecord {
  taskKey: string;
  mode: KonlingBlindAuditMode;
  benchmarkVersion: string;
  itemId: string;
  replicate: number;
  model: string;
  provider: string;
  promptVersion: string;
  scoreVersion: string;
  gitRevision: string;
  status: 'completed' | 'failed';
  startedAt: string;
  finishedAt: string;
  result?: unknown;
  error?: { code: KonlingBlindAuditErrorCode; message: string };
}

export interface KonlingBlindAuditFailureRecord {
  taskKey: string;
  mode: KonlingBlindAuditMode;
  benchmarkVersion: string;
  itemId: string;
  replicate: number;
  model: string;
  provider: string;
  promptVersion: string;
  scoreVersion: string;
  gitRevision: string;
  status: 'failed';
  attempts: KonlingBlindAuditAttempt[];
}

export type KonlingBlindAuditProviderResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: KonlingBlindAuditErrorCode; message: string } };

export type KonlingBlindAuditProvider = (
  item: KonlingBlindAuditItem,
  replicate: number,
  config: KonlingBlindAuditRunConfig,
) => Promise<KonlingBlindAuditProviderResponse>;

export interface KonlingBlindAuditRunSummary {
  runId: string;
  mode: KonlingBlindAuditMode;
  expected: number;
  completedBeforeRun: number;
  completedThisRun: number;
  retried: number;
  failed: number;
  totalCompleted: number;
  complete: boolean;
}

export type KonlingBlindAuditAggregateStatus =
  | 'complete'
  | 'incomplete'
  | 'mixed-configuration'
  | 'manifest-missing';

export interface KonlingBlindAuditAggregate {
  runId: string;
  mode: KonlingBlindAuditMode;
  benchmarkVersion: string;
  status: KonlingBlindAuditAggregateStatus;
  expected: number;
  completed: number;
  failed: number;
  officialMetrics: null | {
    completedRatio: number;
    meanRuleScore?: number;
  };
  configuration: null | {
    model: string;
    provider: string;
    promptVersion: string;
    scoreVersion: string;
  };
  incompleteDetail?: {
    missingTaskKeys: string[];
  };
}

export function buildKonlingBlindAuditTaskKey(input: {
  benchmarkVersion: string;
  mode: KonlingBlindAuditMode;
  itemId: string;
  replicate: number;
}): string {
  return [
    input.benchmarkVersion,
    input.mode,
    input.itemId,
    String(input.replicate),
  ].join('--');
}

export function taskKeyFileName(taskKey: string): string {
  if (/[/\\]|\.\./.test(taskKey)) {
    throw new Error(`unsafe task key: ${taskKey}`);
  }
  return `${taskKey}.json`;
}
