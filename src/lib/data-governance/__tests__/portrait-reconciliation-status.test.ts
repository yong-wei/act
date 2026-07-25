import { describe, expect, it, vi } from 'vitest';

import { readCumulativeLearnerReconciliationStatus } from '../cumulative-snapshot-jobs';

const fence = {
  calculationVersion: 'portrait-v2.cumulative.2',
  learnerGeneration: BigInt(7),
  classGeneration: BigInt(9),
  queueGeneration: BigInt(11),
  fence: BigInt(4),
  activeMigrationRunId: 'run-1',
};

function database(request: Record<string, unknown>, current: Record<string, unknown> | null = null) {
  return {
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn().mockResolvedValue(fence),
    },
    learningMaterializationRebuildRequest: {
      findUnique: vi.fn().mockResolvedValue({
        userId: 'student-1',
        generation: 3,
        kind: 'CUMULATIVE_RECONCILIATION',
        migrationRunId: fence.activeMigrationRunId,
        calculationVersion: fence.calculationVersion,
        learnerGeneration: fence.learnerGeneration,
        queueGeneration: fence.queueGeneration,
        cutoverFence: fence.fence,
        simulationTaskInput: { inputDigest: 'task-input-1' },
        lastErrorCode: null,
        completedAt: null,
        ...request,
      }),
    },
    learnerPortraitCurrentState: {
      findUnique: vi.fn().mockResolvedValue(current),
    },
  };
}

describe('cumulative learner reconciliation status', () => {
  it.each([
    ['PENDING', 'queued'],
    ['CLAIMED', 'processing'],
  ])('maps %s to %s', async (requestStatus, expectedStatus) => {
    await expect(readCumulativeLearnerReconciliationStatus(
      database({ status: requestStatus }),
      { userId: 'student-1', generation: 3 },
    )).resolves.toMatchObject({ status: expectedStatus, generation: 3 });
  });

  it('reports retryable failure without treating a pending retry as queued', async () => {
    await expect(readCumulativeLearnerReconciliationStatus(
      database({ status: 'PENDING', lastErrorCode: 'worker-failed' }),
      { userId: 'student-1', generation: 3 },
    )).resolves.toEqual({
      status: 'failed',
      generation: 3,
      errorCode: 'worker-failed',
    });
  });

  it('only completes after the active pointer publishes the expected task input identity', async () => {
    const db = database(
      { status: 'COMPLETED', completedAt: new Date('2026-07-25T10:00:00.000Z') },
      {
        calculationVersion: fence.calculationVersion,
        generation: fence.learnerGeneration,
        queueGeneration: fence.queueGeneration,
        cutoverFence: fence.fence,
        taskInputDigest: 'task-input-1',
      },
    );
    await expect(readCumulativeLearnerReconciliationStatus(
      db,
      { userId: 'student-1', generation: 3 },
    )).resolves.toMatchObject({ status: 'completed', generation: 3 });

    db.learnerPortraitCurrentState.findUnique.mockResolvedValueOnce({
      calculationVersion: fence.calculationVersion,
      generation: fence.learnerGeneration,
      queueGeneration: fence.queueGeneration,
      cutoverFence: fence.fence,
      taskInputDigest: 'stale-task-input',
    });
    await expect(readCumulativeLearnerReconciliationStatus(
      db,
      { userId: 'student-1', generation: 3 },
    )).resolves.toMatchObject({
      status: 'failed',
      errorCode: 'reconciliation-result-input-identity-mismatch',
    });
  });

  it('marks a target generation superseded after a newer request replaces it', async () => {
    await expect(readCumulativeLearnerReconciliationStatus(
      database({ status: 'PENDING', generation: 4 }),
      { userId: 'student-1', generation: 3 },
    )).resolves.toMatchObject({ status: 'superseded', generation: 3 });
  });
});
