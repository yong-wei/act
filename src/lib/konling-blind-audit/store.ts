import fs from 'node:fs';
import path from 'node:path';

import { createEvalRunStoreKernel } from '@/lib/ai-eval-run-store';

import {
  taskKeyFileName,
  type KonlingBlindAuditFailureRecord,
  type KonlingBlindAuditMode,
  type KonlingBlindAuditRecord,
} from './types';

/**
 * artifacts/konling-blind-audit/<runId>/ 运行目录存储。
 *
 * 目录只增不改：completed 记录一经写入永不覆盖；失败记录以 attempts
 * 数组追加历史；单条记录经同目录临时文件 + rename 原子落盘。
 * 锁、原子写与清单漂移检查复用共享内核（#1900 抽取，行为不变）。
 */

const RECORDS_DIR = 'records';
const FAILURES_DIR = 'failures';

export class KonlingBlindAuditRunLockError extends Error {
  constructor(runDir: string) {
    super(`run directory is locked by another live process: ${runDir}`);
    this.name = 'KonlingBlindAuditRunLockError';
  }
}

export class KonlingBlindAuditManifestDriftError extends Error {
  constructor(runDir: string) {
    super(`benchmark manifest hash changed; refusing to resume run: ${runDir}`);
    this.name = 'KonlingBlindAuditManifestDriftError';
  }
}

const kernel = createEvalRunStoreKernel({
  artifactsSubdir: 'konling-blind-audit',
  lockError: KonlingBlindAuditRunLockError,
  manifestDriftError: KonlingBlindAuditManifestDriftError,
  tempSubdirs: [RECORDS_DIR, FAILURES_DIR],
});

export function konlingBlindAuditRunDir(root: string, runId: string): string {
  return kernel.runDir(root, runId);
}

/**
 * 创建（首次）或接管（续跑）运行目录：
 * - 独占锁防并发检查-后-写入竞态；持有者进程已退出时允许接管 stale 锁。
 * - 首次运行写入清单快照；续跑校验清单哈希，漂移即失败。
 */
export function prepareKonlingBlindAuditRun(input: {
  root: string;
  runId: string;
  manifestHash: string;
  manifestPayload: unknown;
}): string {
  return kernel.prepareRun(input);
}

/** 运行期锁归属断言：最新一代 holder 令牌仍在本进程名下。 */
export function assertKonlingBlindAuditLockHeld(runDir: string): void {
  kernel.assertLockHeld(runDir);
}

export function releaseKonlingBlindAuditRun(runDir: string): void {
  kernel.releaseRun(runDir);
}

export function cleanupTempFiles(runDir: string): void {
  kernel.cleanupTempFiles(runDir);
}

/**
 * 写入 completed 记录；同名记录已存在（已冻结）时返回 false 且不覆盖。
 */
export function writeKonlingBlindAuditRecord(
  runDir: string,
  mode: KonlingBlindAuditMode,
  record: KonlingBlindAuditRecord,
): boolean {
  const target = path.join(runDir, RECORDS_DIR, mode, taskKeyFileName(record.taskKey));
  if (fs.existsSync(target)) return false;
  return kernel.writeAtomic(target, JSON.stringify(record, null, 2));
}

/**
 * 追加失败 attempt：每次失败一个独立 attempt 文件（唯一名，link 先写
 * 胜，天然单调追加），历史永不丢失也永不覆盖（#1820）。
 */
export function appendKonlingBlindAuditFailure(
  runDir: string,
  mode: KonlingBlindAuditMode,
  failure: KonlingBlindAuditFailureRecord,
  attempt: KonlingBlindAuditFailureRecord['attempts'][number],
): void {
  const failureDir = path.join(runDir, FAILURES_DIR, mode, taskKeyFileName(failure.taskKey).replace(/\.json$/, ''));
  kernel.writeAtomic(
    path.join(failureDir, 'meta.json'),
    JSON.stringify({
      taskKey: failure.taskKey,
      mode: failure.mode,
      benchmarkVersion: failure.benchmarkVersion,
      itemId: failure.itemId,
      replicate: failure.replicate,
      model: failure.model,
      provider: failure.provider,
      promptVersion: failure.promptVersion,
      scoreVersion: failure.scoreVersion,
      gitRevision: failure.gitRevision,
    }, null, 2),
  );
  for (let seq = listFailureAttempts(failureDir).length + 1; ; seq += 1) {
    if (kernel.writeAtomic(path.join(failureDir, `attempt-${seq}.json`), JSON.stringify(attempt, null, 2))) {
      return;
    }
  }
}

function listFailureAttempts(failureDir: string): string[] {
  if (!fs.existsSync(failureDir)) return [];
  return fs.readdirSync(failureDir)
    .filter((entry) => /^attempt-\d+\.json$/.test(entry))
    .sort();
}

export function readKonlingBlindAuditFailure(
  runDir: string,
  mode: KonlingBlindAuditMode,
  taskKey: string,
): KonlingBlindAuditFailureRecord | null {
  const failureDir = path.join(runDir, FAILURES_DIR, mode, taskKeyFileName(taskKey).replace(/\.json$/, ''));
  const metaPath = path.join(failureDir, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Omit<KonlingBlindAuditFailureRecord, 'status' | 'attempts'>;
  return {
    ...meta,
    status: 'failed',
    attempts: listFailureAttempts(failureDir).map((file) => JSON.parse(
      fs.readFileSync(path.join(failureDir, file), 'utf8'),
    ) as KonlingBlindAuditFailureRecord['attempts'][number]),
  };
}

function readRecordsDir(runDir: string, subdir: string, mode: KonlingBlindAuditMode): string[] {
  const target = path.join(runDir, subdir, mode);
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target).filter((entry) => entry.endsWith('.json')).sort();
}

function readFailureDirs(runDir: string, mode: KonlingBlindAuditMode): string[] {
  const target = path.join(runDir, FAILURES_DIR, mode);
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function listKonlingBlindAuditRecordKeys(
  runDir: string,
  mode: KonlingBlindAuditMode,
): string[] {
  return readRecordsDir(runDir, RECORDS_DIR, mode)
    .map((file) => file.replace(/\.json$/, ''));
}

export function listKonlingBlindAuditFailureKeys(
  runDir: string,
  mode: KonlingBlindAuditMode,
): string[] {
  return readFailureDirs(runDir, mode);
}

export function loadKonlingBlindAuditRecords(
  runDir: string,
  mode: KonlingBlindAuditMode,
): KonlingBlindAuditRecord[] {
  return readRecordsDir(runDir, RECORDS_DIR, mode).map((file) => JSON.parse(
    fs.readFileSync(path.join(runDir, RECORDS_DIR, mode, file), 'utf8'),
  ) as KonlingBlindAuditRecord);
}

export function loadKonlingBlindAuditFailures(
  runDir: string,
  mode: KonlingBlindAuditMode,
): KonlingBlindAuditFailureRecord[] {
  return listKonlingBlindAuditFailureKeys(runDir, mode)
    .map((taskKey) => readKonlingBlindAuditFailure(runDir, mode, taskKey))
    .filter((failure): failure is KonlingBlindAuditFailureRecord => failure !== null);
}
