import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 长批次 AI 评测的共享运行目录内核（#1900，自 #1820 盲审 store 抽出）。
 *
 * 与具体评测类型无关：发布槽单胜独占锁、link(2) 先写胜原子落盘、
 * 运行清单快照与漂移 fail closed。锁语义只允许存在这一份实现。
 */

const LOCK_DIR = 'run.lock.d';
const HOLDER_FILE = 'holder';
// 发布槽创建后允许完成 holder 初始化的宽限；超龄无 holder 视为初始化
// 崩溃，允许竞争下一代槽（fail closed：宽限内一律拒绝启动）。
const SLOT_INIT_GRACE_MS = 5_000;
const MANIFEST_SNAPSHOT = 'manifest.snapshot.json';

export type EvalRunLockErrorFactory = new (runDir: string) => Error;
export type EvalRunManifestDriftErrorFactory = new (runDir: string) => Error;

export interface EvalRunStoreKernel {
  runDir(root: string, runId: string): string;
  prepareRun(input: {
    root: string;
    runId: string;
    manifestHash: string;
    manifestPayload: unknown;
  }): string;
  assertLockHeld(runDir: string): void;
  releaseRun(runDir: string): void;
  /** 递归清理运行目录各子树下的 `.tmp` 残留（上次进程崩溃的半成品）。 */
  cleanupTempFiles(runDir: string): void;
  writeAtomic(targetPath: string, contents: string): boolean;
}

export function createEvalRunStoreKernel(options: {
  artifactsSubdir: string;
  lockError: EvalRunLockErrorFactory;
  manifestDriftError: EvalRunManifestDriftErrorFactory;
  tempSubdirs: readonly string[];
}): EvalRunStoreKernel {
  function isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
  }

  function latestHolderSlot(lockDir: string): { seq: number; dir: string } | null {
    let best: { seq: number; dir: string } | null = null;
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
          throw new options.lockError(runDir);
        }
      } else if (!released && !holder
        && Date.now() - fs.statSync(latest.dir).mtimeMs < SLOT_INIT_GRACE_MS) {
        // 最新槽仍在初始化宽限内：拒绝启动而不是误判为可接替。
        throw new options.lockError(runDir);
      }
      nextSeq = latest.seq + 1;
    }

    const slotDir = path.join(lockDir, `pub-${nextSeq}`);
    try {
      fs.mkdirSync(slotDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        // 并发候选已有胜者：本进程拒绝本轮。
        throw new options.lockError(runDir);
      }
      throw error;
    }
    fs.writeFileSync(path.join(slotDir, HOLDER_FILE), `${token}\n`, 'utf8');
  }

  return {
    runDir(root, runId) {
      return path.join(root, 'artifacts', options.artifactsSubdir, runId);
    },
    /**
     * 创建（首次）或接管（续跑）运行目录：
     * - `wx`/O_EXCL 语义由发布槽 mkdir 承担，防并发检查-后-写入竞态；
     *   持有者进程已退出时允许接管 stale 锁。
     * - 首次运行写入清单快照；续跑校验清单哈希，漂移即失败。
     */
    prepareRun(input) {
      const runDir = this.runDir(input.root, input.runId);
      for (const subdir of options.tempSubdirs) {
        fs.mkdirSync(path.join(runDir, subdir), { recursive: true });
      }
      acquireRunLock(runDir);
      const snapshotPath = path.join(runDir, MANIFEST_SNAPSHOT);
      if (fs.existsSync(snapshotPath)) {
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { manifestHash?: string };
        if (snapshot.manifestHash !== input.manifestHash) {
          throw new options.manifestDriftError(runDir);
        }
      } else {
        this.writeAtomic(snapshotPath, JSON.stringify(
          { manifestHash: input.manifestHash, payload: input.manifestPayload, capturedAt: new Date().toISOString() },
          null,
          2,
        ));
      }
      this.cleanupTempFiles(runDir);
      return runDir;
    },
    /** 运行期锁归属断言：最新一代 holder 令牌仍在本进程名下。 */
    assertLockHeld(runDir) {
      const lockDir = path.join(runDir, LOCK_DIR);
      let current: { seq: number; dir: string } | null = null;
      try {
        current = latestHolderSlot(lockDir);
      } catch {
        throw new options.lockError(runDir);
      }
      const holder = current ? readHolderToken(current.dir) : '';
      if (!holder.startsWith(`${process.pid}-`)) {
        throw new options.lockError(runDir);
      }
    },
    releaseRun(runDir) {
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
    },
    cleanupTempFiles(runDir) {
      const visit = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const target = path.join(dir, entry.name);
          if (entry.isDirectory()) visit(target);
          else if (entry.name.endsWith('.tmp')) fs.rmSync(target, { force: true });
        }
      };
      for (const subdir of options.tempSubdirs) visit(path.join(runDir, subdir));
    },
    /**
     * 先写者胜的原子落盘：临时文件 + link(2) 发布——目标已存在时 EEXIST
     * 而非覆盖，并发写同一任务键时只有第一个写入者成功（#1820）。
     */
    writeAtomic(targetPath, contents) {
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
    },
  };
}
