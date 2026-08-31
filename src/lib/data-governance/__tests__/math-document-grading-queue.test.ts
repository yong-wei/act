import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queue: {
    add: vi.fn(),
    close: vi.fn(),
  },
  getClient: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: class {
    constructor() {
      return mocks.queue;
    }
  },
}));

vi.mock('@/lib/redis-client', () => ({
  redisClient: { getClient: mocks.getClient },
}));

import {
  closeMathDocumentGradingQueue,
  enqueueMathDocumentGradingJob,
  recoverMathDocumentGradingQueue,
} from '../math-document-grading-queue';

describe('math-document grading queue durability', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await closeMathDocumentGradingQueue();
    mocks.getClient.mockReturnValue({});
    mocks.queue.add.mockResolvedValue({ id: 'bull-job-1' });
  });

  it('marks durable records retryable instead of returning a false queued result when Redis enqueue fails', async () => {
    mocks.queue.add.mockRejectedValueOnce(new Error('redis unavailable'));
    const updates: any[] = [];
    const db = {
      gradingJob: { update: vi.fn(async ({ data }: any) => { updates.push(data); return data; }) },
      documentConversion: { update: vi.fn(async ({ data }: any) => { updates.push(data); return data; }) },
      gradingRun: { update: vi.fn(async ({ data }: any) => { updates.push(data); return data; }) },
      gradingBatch: { update: vi.fn(async ({ data }: any) => { updates.push(data); return data; }) },
    };

    const result = await enqueueMathDocumentGradingJob({
      kind: 'grading',
      jobId: 'job-1',
      gradingRunId: 'run-1',
    }, db);

    expect(result).toEqual(expect.objectContaining({ queued: false, state: 'RETRYABLE', retryable: true }));
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'RETRYABLE', lastErrorCode: 'queue-enqueue-failed' }),
    ]));
  });

  it('does not resurrect a retention-fenced job after Redis enqueue fails', async () => {
    mocks.queue.add.mockRejectedValueOnce(new Error('redis unavailable'));
    let durableJobState = 'CONTENT_UNAVAILABLE';
    const db: any = {
      gradingJob: {
        update: vi.fn(async ({ data }: any) => { durableJobState = data.state; return data; }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (where.state.in.includes(durableJobState)) {
            durableJobState = data.state;
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
      gradingRun: { updateMany: vi.fn(async () => ({ count: 0 })) },
    };

    const result = await enqueueMathDocumentGradingJob({ kind: 'grading', jobId: 'job-fenced-1', gradingRunId: 'run-fenced-1' }, db);

    expect(result).toEqual(expect.objectContaining({ queued: false, retryable: true }));
    expect(durableJobState).toBe('CONTENT_UNAVAILABLE');
    expect(db.gradingJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job-fenced-1', state: { in: ['QUEUED', 'RETRYABLE'] } } }));
    expect(db.gradingJob.update).not.toHaveBeenCalled();
    expect(db.gradingRun.updateMany).not.toHaveBeenCalled();
  });

  it('recovery scan re-enqueues queued or retryable durable jobs by their durable relationship', async () => {
    const db = {
      gradingJob: {
        findMany: vi.fn(async () => [{
          id: 'job-recover-1',
          kind: 'BATCH',
          state: 'RETRYABLE',
          batchId: 'batch-1',
          batchItemId: null,
          conversionId: null,
          gradingRunId: null,
          nextRunAt: null,
        }]),
        update: vi.fn(async ({ data }: any) => data),
      },
      gradingBatch: { update: vi.fn(async ({ data }: any) => data) },
    };

    const result = await recoverMathDocumentGradingQueue({ db, limit: 10 });

    expect(result).toEqual(expect.objectContaining({ scanned: 1, queued: 1, failed: 0 }));
    expect(mocks.queue.add).toHaveBeenCalledWith('batch', expect.objectContaining({ jobId: 'job-recover-1', batchId: 'batch-1' }), expect.objectContaining({ jobId: expect.stringMatching(/^delivery-batch-/) }));
  });

  it('limits recovery to explicitly selected durable jobs when requested', async () => {
    const findMany = vi.fn(async () => []);
    const now = new Date('2026-07-13T08:00:00.000Z');

    await recoverMathDocumentGradingQueue({ db: { gradingJob: { findMany } }, jobIds: ['job-selected-1'], now });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([expect.objectContaining({ id: { in: ['job-selected-1'] } })]) }),
    }));
  });

  it('uses a fresh BullMQ delivery id when a durable retryable job is re-enqueued', async () => {
    const input = { kind: 'grading' as const, jobId: 'job-delivery-identity', gradingRunId: 'run-delivery-identity' };
    await enqueueMathDocumentGradingJob(input);
    await enqueueMathDocumentGradingJob(input);

    const deliveryIds = mocks.queue.add.mock.calls.map((call: any[]) => call[2].jobId);
    expect(new Set(deliveryIds).size).toBe(2);
    expect(deliveryIds.every((id: string) => id.startsWith('delivery-grading-'))).toBe(true);
  });

  it('recovers an expired conversion lease with a CAS before re-enqueueing', async () => {
    const now = new Date('2026-07-13T08:00:00.000Z');
    const updates: any[] = [];
    const db: any = {
      gradingJob: {
        findMany: vi.fn(async () => [{ id: 'job-expired-lease', kind: 'CONVERSION', state: 'RUNNING', workerClaimToken: 'expired-token', workerLeaseExpiresAt: new Date(now.getTime() - 1), conversionId: 'conversion-expired-lease', nextRunAt: null }]),
        updateMany: vi.fn(async ({ where, data }: any) => { updates.push({ table: 'job', where, data }); return { count: 1 }; }),
      },
      documentConversion: { updateMany: vi.fn(async ({ where, data }: any) => { updates.push({ table: 'conversion', where, data }); return { count: 1 }; }) },
    };

    const result = await recoverMathDocumentGradingQueue({ db, now, limit: 10 });

    expect(result).toEqual(expect.objectContaining({ scanned: 1, queued: 1, failed: 0 }));
    expect(updates[0]).toEqual(expect.objectContaining({ table: 'job', where: expect.objectContaining({ workerClaimToken: 'expired-token', workerLeaseExpiresAt: { lte: now } }), data: expect.objectContaining({ state: 'RETRYABLE', workerClaimToken: null }) }));
    expect(updates[1]).toEqual(expect.objectContaining({ table: 'conversion', data: expect.objectContaining({ state: 'RETRYABLE' }) }));
  });

  it('resets the claimed batch item when recovering an expired rerun lease', async () => {
    const now = new Date('2026-07-13T08:00:00.000Z');
    const updates: any[] = [];
    const db: any = {
      gradingJob: {
        findMany: vi.fn(async () => [{ id: 'job-expired-rerun', kind: 'RERUN', state: 'RUNNING', workerClaimToken: 'expired-token', workerLeaseExpiresAt: new Date(now.getTime() - 1), gradingRunId: 'run-expired-rerun', batchItemId: 'item-expired-rerun', batchId: 'batch-expired-rerun' }]),
        updateMany: vi.fn(async ({ where, data }: any) => { updates.push({ table: 'job', where, data }); return { count: 1 }; }),
      },
      gradingRun: { updateMany: vi.fn(async ({ data }: any) => { updates.push({ table: 'run', data }); return { count: 1 }; }) },
      gradingBatchItem: { updateMany: vi.fn(async ({ where, data }: any) => { updates.push({ table: 'item', where, data }); return { count: 1 }; }) },
    };

    const result = await recoverMathDocumentGradingQueue({ db, now, limit: 10 });

    expect(result).toEqual(expect.objectContaining({ scanned: 1, queued: 1, failed: 0 }));
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'run', data: expect.objectContaining({ state: 'RETRYABLE' }) }),
      expect.objectContaining({ table: 'item', where: expect.objectContaining({ id: 'item-expired-rerun' }), data: expect.objectContaining({ state: 'RETRYABLE', workerClaimToken: null }) }),
    ]));
  });

  it('clears a stale claimed item when recovering an already queued rerun', async () => {
    const now = new Date('2026-07-13T08:00:00.000Z');
    const itemUpdates: any[] = [];
    const db: any = {
      gradingJob: {
        findMany: vi.fn(async () => [{ id: 'job-queued-rerun', kind: 'RERUN', state: 'QUEUED', batchId: 'batch-queued-rerun', batchItemId: 'item-queued-rerun', gradingRunId: 'run-queued-rerun', nextRunAt: null }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      gradingBatchItem: { updateMany: vi.fn(async ({ where, data }: any) => { itemUpdates.push({ where, data }); return { count: 1 }; }) },
    };

    const result = await recoverMathDocumentGradingQueue({ db, now, limit: 10 });

    expect(result).toEqual(expect.objectContaining({ scanned: 1, queued: 1, failed: 0 }));
    expect(itemUpdates).toEqual([expect.objectContaining({ where: expect.objectContaining({ id: 'item-queued-rerun' }), data: expect.objectContaining({ state: 'RETRYABLE', workerClaimToken: null }) })]);
  });

  it('does not re-enqueue a durable terminal job when BullMQ delivery is duplicated', async () => {
    const result = await enqueueMathDocumentGradingJob({ kind: 'grading', jobId: 'job-terminal-1', gradingRunId: 'run-terminal-1' }, {
      gradingJob: { findUnique: vi.fn(async () => ({ state: 'SUCCEEDED' })) },
    });
    expect(result).toEqual(expect.objectContaining({ queued: true, queueJobId: null, retryable: false }));
    expect(mocks.queue.add).not.toHaveBeenCalled();
  });

  it('does not overwrite a durable job or parent terminal state after queue.add wins the race', async () => {
    let durableJobState = 'QUEUED';
    let gradingRunState = 'QUEUED';
    mocks.queue.add.mockImplementationOnce(async () => {
      durableJobState = 'SUCCEEDED';
      gradingRunState = 'AWAITING_REVIEW';
      return { id: 'bull-job-race-1' };
    });
    const db: any = {
      gradingJob: {
        findUnique: vi.fn(async () => ({ state: durableJobState })),
        update: vi.fn(async ({ data }: any) => { durableJobState = data.state; return data; }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (where.state.in.includes(durableJobState)) {
            durableJobState = data.state;
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
      gradingRun: {
        update: vi.fn(async ({ data }: any) => { gradingRunState = data.state; return data; }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (where.state.in.includes(gradingRunState)) {
            gradingRunState = data.state;
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
    };

    await enqueueMathDocumentGradingJob({ kind: 'grading', jobId: 'job-race-1', gradingRunId: 'run-race-1' }, db);

    expect(durableJobState).toBe('SUCCEEDED');
    expect(gradingRunState).toBe('AWAITING_REVIEW');
    expect(db.gradingJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job-race-1', state: { in: ['QUEUED', 'RETRYABLE'] } } }));
    expect(db.gradingRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'run-race-1', state: { in: ['QUEUED', 'RETRYABLE'] } } }));
    expect(db.gradingJob.update).not.toHaveBeenCalled();
    expect(db.gradingRun.update).not.toHaveBeenCalled();
  });
});
