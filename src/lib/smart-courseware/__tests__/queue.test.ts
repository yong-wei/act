import { describe, expect, it, vi } from 'vitest';

import { enqueueCoursewareGenerationJob } from '../queue';

describe('smart courseware queue', () => {
  it('uses delivery generation and first incomplete unit in the BullMQ identity', async () => {
    const add = vi.fn();
    const db = {
      smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue({ id: 'job-1', draftId: 'draft-1', mode: 'INITIAL', targetModuleId: null, state: 'QUEUED', firstIncompleteUnitKey: 'pre-assessment', deliveryGeneration: 3 }) },
      smartCoursewareGenerationUnit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit-3' }) },
    };
    await expect(enqueueCoursewareGenerationJob(db as never, 'job-1', { add, close: vi.fn() })).resolves.toMatchObject({ queued: true });
    expect(add).toHaveBeenCalledWith('generate', { jobId: 'job-1' }, { jobId: 'smart-courseware-job-1-pre-assessment-3' });
  });

  it('queues MODULE work without requiring a generation unit', async () => {
    const add = vi.fn();
    const db = {
      smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue({
        id: 'job-module', draftId: 'draft-1', mode: 'MODULE', targetModuleId: 'module-3',
        state: 'QUEUED', firstIncompleteUnitKey: null, deliveryGeneration: 2,
      }) },
      smartCoursewareGenerationUnit: { findUnique: vi.fn() },
    };

    await expect(enqueueCoursewareGenerationJob(db as never, 'job-module', { add, close: vi.fn() }))
      .resolves.toMatchObject({ queued: true });
    expect(db.smartCoursewareGenerationUnit.findUnique).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith('generate', { jobId: 'job-module' }, {
      jobId: 'smart-courseware-job-module-module-module-3-2',
    });
  });

  it('treats an ambiguous enqueue failure as accepted when another worker already moved the job to RUNNING', async () => {
    const updateDraft = vi.fn();
    const updateJob = vi.fn().mockResolvedValue({ count: 0 });
    const running = { id: 'job-1', draftId: 'draft-1', mode: 'INITIAL', targetModuleId: null, state: 'RUNNING', firstIncompleteUnitKey: 'bridge-in', deliveryGeneration: 1 };
    const db = {
      smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue({ ...running, state: 'QUEUED' }) },
      smartCoursewareGenerationUnit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit-1' }) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: updateJob, findUniqueOrThrow: vi.fn().mockResolvedValue(running) },
        smartCoursewareDraft: { updateMany: updateDraft },
      })),
    };
    const add = vi.fn().mockRejectedValue(new Error('ambiguous-network-failure'));

    await expect(enqueueCoursewareGenerationJob(db as never, 'job-1', { add, close: vi.fn() }))
      .resolves.toEqual({ queued: true, job: running, errorCode: null });
    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'job-1', state: 'QUEUED' } }));
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('never enqueues work for an ACCEPTED draft', async () => {
    const add = vi.fn();
    const db = {
      smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue({
        id: 'accepted-job', draftId: 'accepted-draft', mode: 'INITIAL', targetModuleId: null,
        state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in', deliveryGeneration: 1,
        draft: { state: 'ACCEPTED' },
      }) },
    };
    await expect(enqueueCoursewareGenerationJob(db as never, 'accepted-job', { add, close: vi.fn() }))
      .rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
    expect(add).not.toHaveBeenCalled();
  });
});
