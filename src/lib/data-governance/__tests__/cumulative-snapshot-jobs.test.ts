import { describe, expect, it, vi } from 'vitest';

import {
  buildCumulativeClassSnapshotJob,
  claimCumulativeLearnerReconciliations,
  completeCumulativeLearnerReconciliation,
  enqueueCumulativeClassReconciliation,
  requestCumulativeLearnerReconciliation,
} from '../cumulative-snapshot-jobs';

const fence = {
  calculationVersion: 'portrait-v2.cumulative.v2',
  learnerGeneration: BigInt(3),
  classGeneration: BigInt(5),
  queueGeneration: BigInt(7),
  fence: BigInt(11),
  activeMigrationRunId: 'migration-989',
};

describe('cumulative class snapshot jobs', () => {
  it('deduplicates old and new classes and attaches the complete active fence', async () => {
    const add = vi.fn(async (
      _name: string,
      _data: unknown,
      _options: { jobId: string },
    ) => undefined);
    const db = {
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => fence),
      },
    };

    const result = await enqueueCumulativeClassReconciliation({
      classIds: ['class-old', 'class-new', 'class-old'],
      mutationIdentity: 'profile-mutation-1',
      db,
      queue: { add },
    });

    expect(result).toEqual({ scheduled: 2, skipped: false });
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls.map((call) => call[1])).toEqual([
      buildCumulativeClassSnapshotJob('class-old', fence),
      buildCumulativeClassSnapshotJob('class-new', fence),
    ]);
    expect(add.mock.calls.map((call) => call[2].jobId)).toEqual([
      expect.stringMatching(/^class-reconcile-[0-9a-f]{64}$/),
      expect.stringMatching(/^class-reconcile-[0-9a-f]{64}$/),
    ]);
    expect(add.mock.calls[0][2].jobId).not.toBe(add.mock.calls[1][2].jobId);
  });

  it('does not enqueue or fail when no active fence exists', async () => {
    const add = vi.fn(async (
      _name: string,
      _data: unknown,
      _options: { jobId: string },
    ) => undefined);
    const db = {
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => ({
          ...fence,
          activeMigrationRunId: null,
        })),
      },
    };

    await expect(enqueueCumulativeClassReconciliation({
      classIds: ['class-1'],
      mutationIdentity: 'profile-mutation-2',
      db,
      queue: { add },
    })).resolves.toEqual({
      scheduled: 0,
      skipped: true,
      reason: 'no-active-fence',
    });
    expect(add).not.toHaveBeenCalled();
  });
});

describe('cumulative learner reconciliation requests', () => {
  it('creates, claims, and CAS-completes a request bound to the active fence', async () => {
    let request: any = null;
    const db: any = {
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(async () => fence),
      },
      learningMaterializationRebuildRequest: {
        findUnique: vi.fn(async () => request),
        findMany: vi.fn(async () => request ? [request] : []),
        create: vi.fn(async ({ data }) => {
          request = data;
          return data;
        }),
        updateMany: vi.fn(async ({ where, data }) => {
          if (
            !request ||
            request.userId !== where.userId ||
            request.generation !== where.generation ||
            (where.status && request.status !== where.status) ||
            (where.claimToken && request.claimToken !== where.claimToken)
          ) return { count: 0 };
          request = {
            ...request,
            ...data,
            attemptCount: typeof data.attemptCount === 'object'
              ? request.attemptCount + data.attemptCount.increment
              : data.attemptCount ?? request.attemptCount,
          };
          return { count: 1 };
        }),
      },
    };

    await expect(requestCumulativeLearnerReconciliation(db, {
      userId: 'student-1',
      classIds: ['class-1'],
      reason: 'document-rubric-grading-approved',
      now: new Date('2026-07-23T01:00:00Z'),
    })).resolves.toBe(1);
    expect(request).toMatchObject({
      userId: 'student-1',
      classIds: ['class-1'],
      kind: 'CUMULATIVE_RECONCILIATION',
      migrationRunId: fence.activeMigrationRunId,
      calculationVersion: fence.calculationVersion,
      learnerGeneration: fence.learnerGeneration,
      queueGeneration: fence.queueGeneration,
      cutoverFence: fence.fence,
      status: 'PENDING',
      generation: 1,
    });

    const [claim] = await claimCumulativeLearnerReconciliations(db, fence);
    expect(claim).toMatchObject({
      userId: 'student-1',
      classIds: ['class-1'],
      generation: 1,
      fence,
    });
    await expect(completeCumulativeLearnerReconciliation(
      db,
      claim,
      new Date('2026-07-23T01:02:00Z'),
    )).resolves.toBe(true);
    expect(request).toMatchObject({
      status: 'COMPLETED',
      generation: 1,
      claimToken: null,
    });
  });
});
