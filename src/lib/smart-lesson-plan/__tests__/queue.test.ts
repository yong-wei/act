import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerMocks = vi.hoisted(() => ({ ensure: vi.fn() }));
const redisMocks = vi.hoisted(() => ({ getClient: vi.fn() }));

vi.mock('../worker', () => ({
  SMART_LESSON_GENERATION_QUEUE: 'smart-lesson-generation',
  ensureSmartLessonGenerationWorker: workerMocks.ensure,
}));
vi.mock('../../redis-client', () => ({ redisClient: { getClient: redisMocks.getClient } }));

import { enqueueSmartLessonGenerationJob } from '../queue';

function queueDb() {
  const job = { id: 'job-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE', draftId: 'draft-1', deliveryGeneration: 1 };
  const tx = {
    smartLessonDraft: { updateMany: vi.fn(async () => ({ count: 1 })) },
    smartLessonGenerationJob: {
      updateMany: vi.fn(async ({ data }) => { Object.assign(job, data); return { count: 1 }; }),
      findUniqueOrThrow: vi.fn(async () => ({ ...job })),
    },
  };
  return {
    job,
    db: {
      smartLessonGenerationJob: { findUnique: vi.fn(async () => ({ ...job })) },
      smartLessonGenerationStage: { findUnique: vi.fn(async () => ({ id: 'stage-1' })) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    },
    tx,
  };
}

describe('smart lesson BullMQ delivery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses a durable stage delivery identity', async () => {
    const fixture = queueDb();
    const add = vi.fn(async () => ({ id: 'queue-job-1' }));
    const result = await enqueueSmartLessonGenerationJob(fixture.db as never, fixture.job.id, { add, close: vi.fn() } as never);
    expect(result.queued).toBe(true);
    expect(add).toHaveBeenCalledWith('generate', { jobId: 'job-1' }, { jobId: 'smart-lesson-job-1-OUTLINE-1' });
  });

  it('turns Redis or enqueue failure into an explicit recoverable durable state', async () => {
    const fixture = queueDb();
    const result = await enqueueSmartLessonGenerationJob(fixture.db as never, fixture.job.id, {
      add: vi.fn(async () => { throw new Error('redis unavailable'); }),
      close: vi.fn(),
    } as never);
    expect(result).toMatchObject({ queued: false, errorCode: 'queue-unavailable', job: { state: 'RETRYABLE' } });
    expect(fixture.tx.smartLessonGenerationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'RETRYABLE', failureCode: 'queue-unavailable' },
    }));
    expect(fixture.tx.smartLessonDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { state: 'EDITABLE' } }));
  });

  it('does not leave a malformed delivery permanently queued', async () => {
    const fixture = queueDb();
    fixture.db.smartLessonGenerationStage.findUnique.mockResolvedValueOnce(null as never);

    const result = await enqueueSmartLessonGenerationJob(fixture.db as never, fixture.job.id);

    expect(result).toMatchObject({ queued: false, errorCode: 'generation-stage-not-found', job: { state: 'RETRYABLE' } });
    expect(fixture.tx.smartLessonGenerationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'RETRYABLE', failureCode: 'generation-stage-not-found' },
    }));
  });

  it('does not report QUEUED when Redis is absent', async () => {
    const fixture = queueDb();
    redisMocks.getClient.mockReturnValue(null);
    const result = await enqueueSmartLessonGenerationJob(fixture.db as never, fixture.job.id);
    expect(result).toMatchObject({ queued: false, errorCode: 'queue-unavailable', job: { state: 'RETRYABLE' } });
    expect(workerMocks.ensure).not.toHaveBeenCalled();
  });

  it('does not report QUEUED until the worker is reachable', async () => {
    const fixture = queueDb();
    redisMocks.getClient.mockReturnValue({ ping: vi.fn(async () => 'PONG') });
    workerMocks.ensure.mockRejectedValueOnce(new Error('worker unavailable'));

    const result = await enqueueSmartLessonGenerationJob(fixture.db as never, fixture.job.id);

    expect(result).toMatchObject({ queued: false, errorCode: 'queue-unavailable', job: { state: 'RETRYABLE' } });
    expect(workerMocks.ensure).toHaveBeenCalledTimes(1);
  });
});
