import fs from 'node:fs';
import path from 'node:path';

import { createEvalRunStoreKernel } from '@/lib/ai-eval-run-store';

import type {
  KonlingFairExperimentAnswerRecord,
  KonlingFairExperimentArm,
  KonlingFairExperimentFailureRecord,
  KonlingFairExperimentScoreRecord,
} from './types';
import type { StudyQuestionScoringCaliber } from '@/lib/konling-study-question-structure';

/**
 * artifacts/konling-fair-experiment/<runId>/ 运行目录存储。
 *
 * 目录只增不改：回答快照一经写入永不覆盖；失败以 attempt 文件追加
 * 历史；原子性与独占锁复用共享内核（#1900）。
 */

const ANSWERS_DIR = 'answers';
const SCORES_DIR = 'scores';
const FAILURES_DIR = 'failures';
const SUMMARY_DIR = 'summary';

export class KonlingFairExperimentRunLockError extends Error {
  constructor(runDir: string) {
    super(`run directory is locked by another live process: ${runDir}`);
    this.name = 'KonlingFairExperimentRunLockError';
  }
}

export class KonlingFairExperimentManifestDriftError extends Error {
  constructor(runDir: string) {
    super(`experiment manifest hash changed; refusing to resume run: ${runDir}`);
    this.name = 'KonlingFairExperimentManifestDriftError';
  }
}

const kernel = createEvalRunStoreKernel({
  artifactsSubdir: 'konling-fair-experiment',
  lockError: KonlingFairExperimentRunLockError,
  manifestDriftError: KonlingFairExperimentManifestDriftError,
  tempSubdirs: [ANSWERS_DIR, SCORES_DIR, FAILURES_DIR, SUMMARY_DIR],
});

export function konlingFairExperimentRunDir(root: string, runId: string): string {
  return kernel.runDir(root, runId);
}

export function prepareKonlingFairExperimentRun(input: {
  root: string;
  runId: string;
  manifestHash: string;
  manifestPayload: unknown;
}): string {
  return kernel.prepareRun(input);
}

export function assertKonlingFairExperimentLockHeld(runDir: string): void {
  kernel.assertLockHeld(runDir);
}

export function releaseKonlingFairExperimentRun(runDir: string): void {
  kernel.releaseRun(runDir);
}

function safeFileName(taskKey: string): string {
  if (/[/\\]|\.\./.test(taskKey)) {
    throw new Error(`unsafe task key: ${taskKey}`);
  }
  return `${taskKey}.json`;
}

/** 写入回答快照；同名快照已存在（已冻结）时返回 false 且不覆盖。 */
export function writeKonlingFairExperimentAnswer(
  runDir: string,
  arm: KonlingFairExperimentArm,
  record: KonlingFairExperimentAnswerRecord,
): boolean {
  const target = path.join(runDir, ANSWERS_DIR, arm, safeFileName(record.taskKey));
  if (fs.existsSync(target)) return false;
  return kernel.writeAtomic(target, JSON.stringify(record, null, 2));
}

export function appendKonlingFairExperimentFailure(
  runDir: string,
  arm: KonlingFairExperimentArm,
  failure: Omit<KonlingFairExperimentFailureRecord, 'status' | 'attempts'>,
  attempt: KonlingFairExperimentFailureRecord['attempts'][number],
): void {
  const failureDir = path.join(runDir, FAILURES_DIR, 'generate', arm, safeFileName(failure.taskKey).replace(/\.json$/, ''));
  kernel.writeAtomic(path.join(failureDir, 'meta.json'), JSON.stringify(failure, null, 2));
  let seq = 1;
  while (fs.existsSync(path.join(failureDir, `attempt-${seq}.json`))) seq += 1;
  kernel.writeAtomic(path.join(failureDir, `attempt-${seq}.json`), JSON.stringify(attempt, null, 2));
}

export function readKonlingFairExperimentFailure(
  runDir: string,
  arm: KonlingFairExperimentArm,
  taskKey: string,
): KonlingFairExperimentFailureRecord | null {
  const failureDir = path.join(runDir, FAILURES_DIR, 'generate', arm, safeFileName(taskKey).replace(/\.json$/, ''));
  const metaPath = path.join(failureDir, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Omit<KonlingFairExperimentFailureRecord, 'status' | 'attempts'>;
  const attempts = fs.existsSync(failureDir)
    ? fs.readdirSync(failureDir)
      .filter((entry) => /^attempt-\d+\.json$/.test(entry))
      .sort()
      .map((file) => JSON.parse(fs.readFileSync(path.join(failureDir, file), 'utf8')) as KonlingFairExperimentFailureRecord['attempts'][number])
    : [];
  return { ...meta, status: 'failed', attempts };
}

function readJsonDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((entry) => entry.endsWith('.json')).sort();
}

export function listKonlingFairExperimentAnswerKeys(
  runDir: string,
  arm: KonlingFairExperimentArm,
): string[] {
  return readJsonDir(path.join(runDir, ANSWERS_DIR, arm)).map((file) => file.replace(/\.json$/, ''));
}

export function loadKonlingFairExperimentAnswers(
  runDir: string,
  arm: KonlingFairExperimentArm,
): KonlingFairExperimentAnswerRecord[] {
  const dir = path.join(runDir, ANSWERS_DIR, arm);
  return readJsonDir(dir).map((file) => JSON.parse(
    fs.readFileSync(path.join(dir, file), 'utf8'),
  ) as KonlingFairExperimentAnswerRecord);
}

export function listKonlingFairExperimentFailureKeys(
  runDir: string,
  arm: KonlingFairExperimentArm,
): string[] {
  const dir = path.join(runDir, FAILURES_DIR, 'generate', arm);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** 写入口径评分记录；已存在时跳过（确定性结果，重复评分无意义）。 */
export function writeKonlingFairExperimentScore(
  runDir: string,
  caliber: StudyQuestionScoringCaliber,
  arm: KonlingFairExperimentArm,
  record: KonlingFairExperimentScoreRecord,
): boolean {
  const target = path.join(runDir, SCORES_DIR, caliber, arm, safeFileName(record.taskKey));
  if (fs.existsSync(target)) return false;
  return kernel.writeAtomic(target, JSON.stringify(record, null, 2));
}

export function loadKonlingFairExperimentScores(
  runDir: string,
  caliber: StudyQuestionScoringCaliber,
  arm: KonlingFairExperimentArm,
): KonlingFairExperimentScoreRecord[] {
  const dir = path.join(runDir, SCORES_DIR, caliber, arm);
  return readJsonDir(dir).map((file) => JSON.parse(
    fs.readFileSync(path.join(dir, file), 'utf8'),
  ) as KonlingFairExperimentScoreRecord);
}

export function writeKonlingFairExperimentOfficialSummary(
  runDir: string,
  summary: unknown,
): boolean {
  const target = path.join(runDir, SUMMARY_DIR, 'official.json');
  if (fs.existsSync(target)) return false;
  return kernel.writeAtomic(target, JSON.stringify(summary, null, 2));
}
