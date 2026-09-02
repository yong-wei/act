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
// 发布槽创建后允许完成 holder 初始化的宽限；超龄无 holder 视为初始化
// 崩溃，允许竞争下一代槽（fail closed：宽限内一律拒绝启动）。
const SLOT_INIT_GRACE_MS = 5_000;
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

/**
 * 最新发布槽。持有权以 `pub-<n>` 目录表达：发布 = mkdir 下一代槽，
 * mkdir(2) 原子且单胜，任何时刻至多一个进程能发布成功。
 */
function latestHolderSlot(lockDir: string): HolderGeneration | null {
  let best: HolderGeneration | null = null;
  for (const entry of fs.readdirSync(lockDir)) {
    const match = entry.match(/^pub-(\d+)$/);
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
 * 获取运行锁（发布槽 mkdir 单胜）。
 *
 * 判定链（最新槽 holder 存活 → 拒绝；空 holder 且槽龄在宽限内 → 拒绝）
 * 只是进入竞争的许可条件；正确性完全由发布动作的原子单胜保证：
 * `mkdir pub-<n+1>` 恰好一个候选成功，其余 EEXIST 后拒绝启动。暂停
 * 恢复的旧候选要么在判定链被活持有者拒绝，要么竞争新槽单胜落败，
 * 要么在运行期归属断言（每个外部调用前）发现已失去最新槽而退出。
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
  const latest = latestHolderSlot(lockDir);
  if (latest) {
    const released = fs.existsSync(path.join(latest.dir, 'released'));
    const holder = readHolderToken(latest.dir);
    if (!released && holder) {
      const holderPid = Number(holder.split('-')[0]);
      if (Number.isInteger(holderPid) && isProcessAlive(holderPid)) {
        throw new KonlingBlindAuditRunLockError(runDir);
      }
    } else if (!released && !holder
      && Date.now() - fs.statSync(latest.dir).mtimeMs < SLOT_INIT_GRACE_MS) {
      // 最新槽仍在初始化宽限内：拒绝启动而不是误判为可接替。
      throw new KonlingBlindAuditRunLockError(runDir);
    }
    nextSeq = latest.seq + 1;
  }

  const slotDir = path.join(lockDir, `pub-${nextSeq}`);
  try {
    fs.mkdirSync(slotDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      // 并发候选已有胜者：本进程拒绝本轮。
      throw new KonlingBlindAuditRunLockError(runDir);
    }
    throw error;
  }
  fs.writeFileSync(path.join(slotDir, HOLDER_FILE), `${token}\n`, 'utf8');
}

/**
 * 运行期锁归属断言：最新一代 holder 令牌仍在本进程名下。
 */
export function assertKonlingBlindAuditLockHeld(runDir: string): void {
  const lockDir = path.join(runDir, LOCK_DIR);
  let current: HolderGeneration | null = null;
  try {
    current = latestHolderSlot(lockDir);
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
    const current = latestHolderSlot(lockDir);
    const holder = current ? readHolderToken(current.dir) : '';
    if (holder.startsWith(`${process.pid}-`) && current) {
      // 正常释放只在自有槽内写标记：锁结构与槽序列永不删除/重置，
      // 暂停恢复的旧候选必被最新活槽或更高序号拒绝（#1820）。
      fs.writeFileSync(
        path.join(current.dir, 'released'),
        `${new Date().toISOString()}\n`,
        'utf8',
      );
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

/**
 * 先写者胜的原子落盘：临时文件 + link(2) 发布——目标已存在时 EEXIST
 * 而非覆盖，并发写同一任务键时只有第一个写入者成功（#1820）。
 */
function writeAtomic(targetPath: string, contents: string): boolean {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmpPath, contents, 'utf8');
  try {
    fs.linkSync(tmpPath, targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally {
    fs.rmSync(tmpPath, { force: true });
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
 * 追加失败 attempt：每次失败一个独立 attempt 文件（唯一名，link 先写
 * 胜，天然单调追加），历史永不丢失也永不覆盖（#1820）。
 */
export function appendKonlingBlindAuditFailure(
  runDir: string,
  mode: KonlingBlindAuditMode,
  failure: KonlingBlindAuditFailureRecord,
  attempt: KonlingBlindAuditFailureRecord['attempts'][number],
): void {
  const failureDir = path.join(runDir, FAILURES_DIR, mode, failure.taskKey);
  writeAtomic(
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
    if (writeAtomic(path.join(failureDir, `attempt-${seq}.json`), JSON.stringify(attempt, null, 2))) {
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
  const failureDir = path.join(runDir, FAILURES_DIR, mode, taskKey);
  const metaPath = path.join(failureDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    // 兼容历史平铺布局（首版单文件 failure）。
    const legacy = path.join(runDir, FAILURES_DIR, mode, taskKeyFileName(taskKey));
    if (!fs.existsSync(legacy)) return null;
    return JSON.parse(fs.readFileSync(legacy, 'utf8')) as KonlingBlindAuditFailureRecord;
  }
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
  const keys = readFailureDirs(runDir, mode);
  // 兼容历史平铺布局。
  for (const file of readRecordsDir(runDir, FAILURES_DIR, mode)) {
    keys.push(file.replace(/\.json$/, ''));
  }
  return [...new Set(keys)].sort();
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
