import { isMainThread, SHARE_ENV, Worker } from 'node:worker_threads';
import path from 'node:path';

export interface EncodedSimulationTrace {
  checksum: string;
  uncompressedBytes: number;
  compressed: Uint8Array;
}

export interface PreparedVesselTrace {
  runRef: string;
  chunkIndex: number;
  encoded: EncodedSimulationTrace;
}

type EvidenceCpuTasks = {
  encode: { input: unknown; output: EncodedSimulationTrace };
  decode: { input: { compressed: Uint8Array; checksum: string }; output: unknown };
  'trace-stage': { input: Uint8Array; output: PreparedVesselTrace };
  'open-prepare': { input: unknown; output: unknown };
  'close-prepare': { input: unknown; output: unknown };
};

export type EvidenceCpuOperation = keyof EvidenceCpuTasks;
export interface EvidenceCpuRequest {
  id: number;
  operation: EvidenceCpuOperation;
  payload: unknown;
}
export type EvidenceCpuResponse = { id: number; value: unknown; error?: never }
  | { id: number; value?: never; error: { message: string; status?: number } };

type PendingJob = {
  request: EvidenceCpuRequest;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};
type WorkerSlot = { worker: Worker; pending: Map<number, PendingJob> };
const MAX_PENDING_JOBS = 128;
const JOB_TIMEOUT_MS = 60_000;
const JOBS_PER_WORKER = 2;
const POOL_KEY = Symbol.for('act.simulation-evidence-cpu-pool.v1');
const globals = globalThis as typeof globalThis & { [POOL_KEY]?: EvidenceCpuPool };

export class EvidenceCpuError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'EvidenceCpuError';
  }
}

function unavailable(message = '保存服务暂时繁忙，请稍后重试。') {
  return new EvidenceCpuError(message, 503);
}

function configuredWorkers() {
  const value = Number(process.env.SIMULATION_CPU_WORKERS ?? 1);
  if (!Number.isInteger(value) || value < 0 || value > 8) {
    throw unavailable('实验保存服务配置无效。');
  }
  return value;
}

export function evidenceCpuWorkersEnabled() {
  return isMainThread && configuredWorkers() > 0;
}

class EvidenceCpuPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: PendingJob[] = [];
  private nextId = 0;
  private closed = false;
  private completedJobs = 0;
  private failedJobs = 0;

  constructor(private readonly workerCount: number) {}

  stats() {
    return { configuredWorkers: this.workerCount, workers: this.slots.length,
      activeJobs: this.slots.reduce((sum, slot) => sum + slot.pending.size, 0),
      queuedJobs: this.queue.length, completedJobs: this.completedJobs, failedJobs: this.failedJobs };
  }

  run(operation: EvidenceCpuOperation, payload: unknown): Promise<unknown> {
    const active = this.slots.reduce((sum, slot) => sum + slot.pending.size, 0);
    if (this.closed || active + this.queue.length >= MAX_PENDING_JOBS) return Promise.reject(unavailable());
    return new Promise((resolve, reject) => {
      const job: PendingJob = { request: { id: ++this.nextId, operation, payload }, resolve, reject };
      job.timer = setTimeout(() => this.expire(job), JOB_TIMEOUT_MS);
      this.queue.push(job);
      this.dispatch();
    });
  }

  private createSlot(): WorkerSlot {
    const entry = path.join(process.cwd(), 'scripts/workers/vessel-evidence-cpu-worker.ts');
    const worker = new Worker("require('tsx/cjs'); require(require('node:worker_threads').workerData.entry);", {
      eval: true, workerData: { entry }, env: SHARE_ENV,
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
    });
    const slot: WorkerSlot = { worker, pending: new Map() };
    this.slots.push(slot);
    worker.on('message', (reply: EvidenceCpuResponse) => {
      const job = slot.pending.get(reply.id);
      if (!job) return;
      slot.pending.delete(reply.id);
      clearTimeout(job.timer);
      if (reply.error) {
        this.failedJobs++;
        job.reject(reply.error.status ? new EvidenceCpuError(reply.error.message, reply.error.status)
          : new Error(reply.error.message));
      } else {
        this.completedJobs++;
        job.resolve(reply.value);
      }
      if (!slot.pending.size) worker.unref();
      this.dispatch();
    });
    worker.on('error', () => this.removeSlot(slot));
    worker.on('exit', () => this.removeSlot(slot));
    worker.unref();
    return slot;
  }

  private expire(job: PendingJob) {
    const queued = this.queue.indexOf(job);
    if (queued >= 0) {
      this.queue.splice(queued, 1);
      this.failedJobs++;
      job.reject(unavailable());
      return;
    }
    const slot = this.slots.find(candidate => candidate.pending.has(job.request.id));
    if (slot) this.removeSlot(slot);
  }

  private removeSlot(slot: WorkerSlot) {
    const index = this.slots.indexOf(slot);
    if (index < 0) return;
    this.slots.splice(index, 1);
    for (const job of slot.pending.values()) {
      clearTimeout(job.timer);
      this.failedJobs++;
      job.reject(unavailable());
    }
    slot.pending.clear();
    void slot.worker.terminate();
    this.dispatch();
  }

  private dispatch() {
    while (!this.closed && this.queue.length) {
      let slot = this.slots.find(candidate => candidate.pending.size < JOBS_PER_WORKER);
      if (!slot && this.slots.length < this.workerCount) {
        try { slot = this.createSlot(); }
        catch {
          const job = this.queue.shift()!;
          clearTimeout(job.timer);
          this.failedJobs++;
          job.reject(unavailable());
          continue;
        }
      }
      if (!slot) return;
      const job = this.queue.shift()!;
      slot.pending.set(job.request.id, job);
      slot.worker.ref();
      try { slot.worker.postMessage(job.request); }
      catch {
        slot.pending.delete(job.request.id);
        clearTimeout(job.timer);
        this.failedJobs++;
        job.reject(unavailable());
        if (!slot.pending.size) slot.worker.unref();
      }
    }
  }

  async close() {
    this.closed = true;
    for (const job of this.queue.splice(0)) {
      clearTimeout(job.timer);
      job.reject(unavailable());
    }
    const slots = this.slots.splice(0);
    for (const slot of slots) {
      for (const job of slot.pending.values()) {
        clearTimeout(job.timer);
        job.reject(unavailable());
      }
      slot.pending.clear();
    }
    await Promise.allSettled(slots.map(slot => slot.worker.terminate()));
  }
}

export function runEvidenceCpuTask<K extends EvidenceCpuOperation>(
  operation: K, payload: EvidenceCpuTasks[K]['input'],
): Promise<EvidenceCpuTasks[K]['output']> {
  if (!isMainThread) return Promise.reject(unavailable());
  const workerCount = configuredWorkers();
  if (!workerCount) return Promise.reject(unavailable());
  const pool = globals[POOL_KEY] ??= new EvidenceCpuPool(workerCount);
  return pool.run(operation, payload) as Promise<EvidenceCpuTasks[K]['output']>;
}

export function evidenceCpuPoolStats() {
  return globals[POOL_KEY]?.stats() ?? { configuredWorkers: configuredWorkers(), workers: 0,
    activeJobs: 0, queuedJobs: 0, completedJobs: 0, failedJobs: 0 };
}

export async function closeEvidenceCpuPool() {
  const pool = globals[POOL_KEY];
  delete globals[POOL_KEY];
  await pool?.close();
}
