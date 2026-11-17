import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeEvidenceCpuPool, evidenceCpuPoolStats, evidenceCpuWorkersEnabled,
  runEvidenceCpuTask, type EvidenceCpuRequest } from '../control-engine/evidence-cpu-pool';

const workers = vi.hoisted(() => {
  class MockWorker {
    static instances: MockWorker[] = [];
    static failConstruction = false;
    handlers = new Map<string, Array<(value: unknown) => void>>();
    requests: EvidenceCpuRequest[] = [];
    ref = vi.fn();
    unref = vi.fn();
    terminate = vi.fn(async () => 0);
    postMessage = vi.fn((request: EvidenceCpuRequest) => this.requests.push(request));

    constructor() {
      if (MockWorker.failConstruction) throw new Error('cannot start worker');
      MockWorker.instances.push(this);
    }
    on(event: string, handler: (value: unknown) => void) {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(handler);
      this.handlers.set(event, handlers);
      return this;
    }
    emit(event: string, value: unknown) {
      for (const handler of this.handlers.get(event) ?? []) handler(value);
    }
    reply(index: number, value: unknown) {
      this.emit('message', { id: this.requests[index].id, value });
    }
  }
  return { MockWorker };
});

vi.mock('node:worker_threads', () => ({ isMainThread: true, SHARE_ENV: Symbol('share-env'), Worker: workers.MockWorker }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('SIMULATION_CPU_WORKERS', '1');
  workers.MockWorker.instances = [];
  workers.MockWorker.failConstruction = false;
});
afterEach(async () => {
  await closeEvidenceCpuPool();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('实验保存计算队列', () => {
  it('乱序完成仍按任务编号返回，空闲线程可由下一请求复用', async () => {
    const first = runEvidenceCpuTask('encode', { owner: 'first' });
    const second = runEvidenceCpuTask('encode', { owner: 'second' });
    const worker = workers.MockWorker.instances[0];
    worker.reply(1, { checksum: 'second' });
    worker.reply(0, { checksum: 'first' });
    expect(await first).toEqual({ checksum: 'first' });
    expect(await second).toEqual({ checksum: 'second' });
    expect(evidenceCpuPoolStats()).toMatchObject({ workers: 1, activeJobs: 0, completedJobs: 2 });
    expect(worker.unref).toHaveBeenCalled();
    const next = runEvidenceCpuTask('encode', {});
    worker.reply(2, { checksum: 'next' });
    expect(await next).toEqual({ checksum: 'next' });
    expect(workers.MockWorker.instances).toHaveLength(1);
  });

  it('校验失败保留状态码并继续处理后续任务', async () => {
    const pending = runEvidenceCpuTask('trace-stage', new Uint8Array());
    const assertion = expect(pending).rejects.toMatchObject({ status: 400, message: '正文无效' });
    const worker = workers.MockWorker.instances[0];
    worker.emit('message', { id: worker.requests[0].id, error: { message: '正文无效', status: 400 } });
    await assertion;
    const next = runEvidenceCpuTask('encode', {});
    worker.reply(1, { checksum: 'valid' });
    expect(await next).toEqual({ checksum: 'valid' });
    expect(evidenceCpuPoolStats()).toMatchObject({ failedJobs: 1, completedJobs: 1 });
  });

  it('线程异常使在途任务可重试，排队任务由新线程执行且忽略旧线程迟到回复', async () => {
    const first = runEvidenceCpuTask('encode', {});
    const second = runEvidenceCpuTask('encode', {});
    const failed = Promise.allSettled([first, second]);
    const queued = runEvidenceCpuTask('encode', {});
    const oldWorker = workers.MockWorker.instances[0];
    oldWorker.emit('error', new Error('worker stopped'));
    oldWorker.emit('exit', 1);
    for (const result of await failed) expect(result).toMatchObject({ status: 'rejected', reason: { status: 503 } });
    const replacement = workers.MockWorker.instances[1];
    expect(replacement.requests).toHaveLength(1);
    oldWorker.emit('message', { id: replacement.requests[0].id, value: { checksum: 'stale' } });
    replacement.reply(0, { checksum: 'current' });
    expect(await queued).toEqual({ checksum: 'current' });
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
  });

  it('等待与执行共用超时上限，超时后可建立新线程继续保存', async () => {
    const pending = Array.from({ length: 3 }, () => runEvidenceCpuTask('encode', {}));
    const settled = Promise.allSettled(pending);
    await vi.advanceTimersByTimeAsync(60_000);
    for (const result of await settled) expect(result).toMatchObject({ status: 'rejected', reason: { status: 503 } });
    expect(evidenceCpuPoolStats()).toMatchObject({ activeJobs: 0, queuedJobs: 0 });
    const next = runEvidenceCpuTask('encode', {});
    workers.MockWorker.instances.at(-1)!.reply(0, { checksum: 'retried' });
    expect(await next).toEqual({ checksum: 'retried' });
  });

  it('队列达到上限时及时拒绝，关闭时释放全部等待任务', async () => {
    vi.stubEnv('SIMULATION_CPU_WORKERS', '2');
    const pending = Array.from({ length: 128 }, () => runEvidenceCpuTask('encode', {}));
    const settled = Promise.allSettled(pending);
    expect(evidenceCpuPoolStats()).toMatchObject({ workers: 2, activeJobs: 4, queuedJobs: 124 });
    await expect(runEvidenceCpuTask('encode', {})).rejects.toMatchObject({ status: 503 });
    await closeEvidenceCpuPool();
    expect((await settled).every(result => result.status === 'rejected')).toBe(true);
    expect(workers.MockWorker.instances.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true);
  });

  it('构造及发送失败都释放超时计时器', async () => {
    workers.MockWorker.failConstruction = true;
    await expect(runEvidenceCpuTask('encode', {})).rejects.toMatchObject({ status: 503 });
    expect(vi.getTimerCount()).toBe(0);
    workers.MockWorker.failConstruction = false;
    const pending = runEvidenceCpuTask('encode', {});
    const worker = workers.MockWorker.instances[0];
    worker.reply(0, {});
    await pending;
    worker.postMessage.mockImplementation(() => { throw new Error('cannot clone'); });
    await expect(runEvidenceCpuTask('encode', {})).rejects.toMatchObject({ status: 503 });
  });

  it('可明确关闭线程模式，非法配置拒绝启动', () => {
    vi.stubEnv('SIMULATION_CPU_WORKERS', '0');
    expect(evidenceCpuWorkersEnabled()).toBe(false);
    for (const value of ['-1', '9', '1.5', 'invalid']) {
      vi.stubEnv('SIMULATION_CPU_WORKERS', value);
      expect(() => evidenceCpuWorkersEnabled()).toThrow('配置无效');
    }
  });
});
