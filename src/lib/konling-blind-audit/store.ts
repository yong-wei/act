import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
 */

const LOCK_FILE = 'run.lock';
const MANIFEST_SNAPSHOT = 'manifest.snapshot.json';
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

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function konlingBlindAuditRunDir(root: string, runId: string): string {
  return path.join(root, 'artifacts', 'konling-blind-audit', runId);
}

/**
 * 创建（首次）或接管（续跑）运行目录：
 * - `wx`/O_EXCL 原子创建独占锁，防止并发进程检查-后-写入竞态；
 *   持有者进程已退出时允许接管 stale 锁。
 * - 首次运行写入清单快照；续跑校验清单哈希，漂移即失败。
 */
export function prepareKonlingBlindAuditRun(input: {
  root: string;
  runId: string;
  manifestHash: string;
  manifestPayload: unknown;
}): string {
  const runDir = konlingBlindAuditRunDir(input.root, input.runId);
  fs.mkdirSync(path.join(runDir, RECORDS_DIR), { recursive: true });
  fs.mkdirSync(path.join(runDir, FAILURES_DIR), { recursive: true });
  acquireRunLock(runDir);
  const snapshotPath = path.join(runDir, MANIFEST_SNAPSHOT);
  if (fs.existsSync(snapshotPath)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { manifestHash?: string };
    if (snapshot.manifestHash !== input.manifestHash) {
      throw new KonlingBlindAuditManifestDriftError(runDir);
    }
  } else {
    writeAtomic(snapshotPath, JSON.stringify(
      { manifestHash: input.manifestHash, payload: input.manifestPayload, capturedAt: new Date().toISOString() },
      null,
      2,
    ));
  }
  cleanupTempFiles(runDir);
  return runDir;
}

function acquireRunLock(runDir: string): void {
  const lockPath = path.join(runDir, LOCK_FILE);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = `${process.pid}-${randomUUID()}`;
    try {
      // wx = O_CREAT|O_EXCL：只有第一个进程能创建锁，无检查-后-写入窗口。
      fs.writeFileSync(lockPath, `${token}\n`, { encoding: 'utf8', flag: 'wx' });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    let current: string;
    try {
      current = fs.readFileSync(lockPath, 'utf8').trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    const holderPid = Number(current.split('-')[0]);
    if (Number.isInteger(holderPid) && isProcessAlive(holderPid)) {
      throw new KonlingBlindAuditRunLockError(runDir);
    }
    // 条件替换接管 stale 锁：rename 后 tombstone 内容必须等于读取时的
    // stale 实例。内容不一致说明持有者已更换（ABA），以不覆盖原语恢复
    // 后者的活锁并拒绝本轮接管（#1820）。
    const tombstone = `${lockPath}.stale-${token}`;
    try {
      fs.renameSync(lockPath, tombstone);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const removed = fs.readFileSync(tombstone, 'utf8').trim();
    if (removed !== current) {
      // 误移了后继持有者的活锁：用 link(2) 做不覆盖的原子恢复——目标
      // 已被新持有者合法占用时返回 EEXIST 而非覆盖。恢复让位时由
      // 运行期锁归属断言让被移位方在下一次外部调用前退出。
      try {
        fs.linkSync(tombstone, lockPath);
        fs.rmSync(tombstone, { force: true });
      } catch {
        // EEXIST：路径由新持有者持有；tombstone 保留为审计痕迹。
      }
      throw new KonlingBlindAuditRunLockError(runDir);
    }
    fs.rmSync(tombstone, { force: true });
  }
  throw new KonlingBlindAuditRunLockError(runDir);
}

/**
 * 运行期锁归属断言：持有者令牌仍在本进程名下。锁文件被并发接管移走
 * 时，本进程在下一次外部调用前主动终止，收敛独占性。
 */
export function assertKonlingBlindAuditLockHeld(runDir: string): void {
  const lockPath = path.join(runDir, LOCK_FILE);
  let holder: string;
  try {
    holder = fs.readFileSync(lockPath, 'utf8').trim();
  } catch {
    throw new KonlingBlindAuditRunLockError(runDir);
  }
  if (!holder.startsWith(`${process.pid}-`)) {
    throw new KonlingBlindAuditRunLockError(runDir);
  }
}

export function releaseKonlingBlindAuditRun(runDir: string): void {
  const lockPath = path.join(runDir, LOCK_FILE);
  try {
    const holder = fs.readFileSync(lockPath, 'utf8').trim();
    if (holder.startsWith(`${process.pid}-`)) fs.rmSync(lockPath);
  } catch {
    // 锁文件不存在或不可读：释放是 best-effort。
  }
}

export function cleanupTempFiles(runDir: string): void {
  for (const dir of [RECORDS_DIR, FAILURES_DIR]) {
    const target = path.join(runDir, dir);
    if (!fs.existsSync(target)) continue;
    for (const entry of fs.readdirSync(target)) {
      if (entry.endsWith('.tmp')) {
        fs.rmSync(path.join(target, entry), { force: true });
      }
    }
  }
}

function writeAtomic(targetPath: string, contents: string): boolean {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmpPath, contents, 'utf8');
  try {
    fs.renameSync(tmpPath, targetPath);
    return true;
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    throw error;
  }
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
  return writeAtomic(target, JSON.stringify(record, null, 2));
}

/**
 * 追加失败 attempt（保留历史），失败文件不存在时创建。
 */
export function writeKonlingBlindAuditFailure(
  runDir: string,
  mode: KonlingBlindAuditMode,
  failure: KonlingBlindAuditFailureRecord,
): void {
  const target = path.join(runDir, FAILURES_DIR, mode, taskKeyFileName(failure.taskKey));
  writeAtomic(target, JSON.stringify(failure, null, 2));
}

export function readKonlingBlindAuditFailure(
  runDir: string,
  mode: KonlingBlindAuditMode,
  taskKey: string,
): KonlingBlindAuditFailureRecord | null {
  const target = path.join(runDir, FAILURES_DIR, mode, taskKeyFileName(taskKey));
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8')) as KonlingBlindAuditFailureRecord;
}

function readRecordsDir(runDir: string, subdir: string, mode: KonlingBlindAuditMode): string[] {
  const target = path.join(runDir, subdir, mode);
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target).filter((entry) => entry.endsWith('.json')).sort();
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
  return readRecordsDir(runDir, FAILURES_DIR, mode)
    .map((file) => file.replace(/\.json$/, ''));
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
  return readRecordsDir(runDir, FAILURES_DIR, mode).map((file) => JSON.parse(
    fs.readFileSync(path.join(runDir, FAILURES_DIR, mode, file), 'utf8'),
  ) as KonlingBlindAuditFailureRecord);
}
