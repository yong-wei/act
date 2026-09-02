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

const LOCK_DIR = 'run.lock.d';
const HOLDER_FILE = 'holder';
// 持有权目录创建后允许完成 holder 初始化的宽限；超龄无 holder 视为
// 初始化崩溃，允许下一代接替（fail closed：宽限内一律拒绝启动）。
const HOLDER_INIT_GRACE_MS = 5_000;
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

interface HolderGeneration {
  seq: number;
  dir: string;
}

function currentHolderGeneration(lockDir: string): HolderGeneration | null {
  let best: HolderGeneration | null = null;
  for (const entry of fs.readdirSync(lockDir)) {
    const match = entry.match(/^hold-(\d+)$/);
    if (!match) continue;
    const seq = Number(match[1]);
    if (!best || seq > best.seq) {
      best = { seq, dir: path.join(lockDir, entry) };
    }
  }
  return best;
}

function readHolderToken(holderDir: string): string {
  try {
    return fs.readFileSync(path.join(holderDir, HOLDER_FILE), 'utf8').trim();
  } catch {
    return '';
  }
}

/**
 * 获取运行锁（mkdir 原子 + 代次接替，全程无覆盖写）。
 *
 * - 首次：mkdir run.lock.d → mkdir hold-1 → 写 holder。
 * - 持有中：最新代 holder pid 存活 → 拒绝启动。
 * - stale 接替：mkdir hold-<n+1> 与并发候选竞争，恰好一个成功；
 *   败者一律拒绝（design：第二个进程拒绝而不是竞写）。
 * - 初始化窗口（hold-n 已建、holder 未写）：宽限内拒绝，超龄可接替。
 */
function acquireRunLock(runDir: string): void {
  const lockDir = path.join(runDir, LOCK_DIR);
  const token = `${process.pid}-${randomUUID()}`;
  try {
    fs.mkdirSync(lockDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }

  let nextSeq = 1;
  const current = currentHolderGeneration(lockDir);
  if (current) {
    const holder = readHolderToken(current.dir);
    if (holder) {
      const holderPid = Number(holder.split('-')[0]);
      if (Number.isInteger(holderPid) && isProcessAlive(holderPid)) {
        throw new KonlingBlindAuditRunLockError(runDir);
      }
    } else {
      const ageMs = Date.now() - fs.statSync(current.dir).mtimeMs;
      if (ageMs < HOLDER_INIT_GRACE_MS) {
        throw new KonlingBlindAuditRunLockError(runDir);
      }
    }
    nextSeq = current.seq + 1;
  }

  const nextDir = path.join(lockDir, `hold-${nextSeq}`);
  try {
    fs.mkdirSync(nextDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      // 并发接替候选已有胜者：本进程拒绝本轮。
      throw new KonlingBlindAuditRunLockError(runDir);
    }
    throw error;
  }
  fs.writeFileSync(path.join(nextDir, HOLDER_FILE), `${token}\n`, 'utf8');
}

/**
 * 运行期锁归属断言：最新一代 holder 令牌仍在本进程名下。
 */
export function assertKonlingBlindAuditLockHeld(runDir: string): void {
  const lockDir = path.join(runDir, LOCK_DIR);
  let current: HolderGeneration | null = null;
  try {
    current = currentHolderGeneration(lockDir);
  } catch {
    throw new KonlingBlindAuditRunLockError(runDir);
  }
  const holder = current ? readHolderToken(current.dir) : '';
  if (!holder.startsWith(`${process.pid}-`)) {
    throw new KonlingBlindAuditRunLockError(runDir);
  }
}

export function releaseKonlingBlindAuditRun(runDir: string): void {
  const lockDir = path.join(runDir, LOCK_DIR);
  try {
    const current = currentHolderGeneration(lockDir);
    const holder = current ? readHolderToken(current.dir) : '';
    if (holder.startsWith(`${process.pid}-`)) {
      fs.rmSync(lockDir, { recursive: true, force: true });
    }
  } catch {
    // 锁目录不存在或不可读：释放是 best-effort。
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
