import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildSimulationTaskInputIdentityFromFactJournal: vi.fn(),
  requestCumulativeLearnerReconciliation: vi.fn(),
}));

vi.mock('../simulation-task-portrait-projection', () => ({
  buildSimulationTaskInputIdentityFromFactJournal:
    mocks.buildSimulationTaskInputIdentityFromFactJournal,
  computeSimulationTaskCatalogDigest: () => 'catalog-digest',
  findSimulationTaskProjectionCandidateUserIds: vi.fn(),
}));

vi.mock('../cumulative-snapshot-jobs', () => ({
  readActiveCumulativePublicationFence: vi.fn().mockResolvedValue({
    calculationVersion: 'portrait-v2',
    learnerGeneration: BigInt(3),
    classGeneration: BigInt(2),
    queueGeneration: BigInt(4),
    fence: BigInt(5),
    activeMigrationRunId: 'migration-1',
  }),
  requestCumulativeLearnerReconciliation:
    mocks.requestCumulativeLearnerReconciliation,
}));

import { requestRealtimeSimulationTaskReconciliation } from '../simulation-task-reconciliation';

function createDb() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn(),
    },
    learningFact: {
      findMany: vi.fn().mockResolvedValue([{ id: 'fact-1', userId: 'student-1' }]),
    },
    learnerFactTransition: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    learningMaterializationRebuildRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    learnerPortraitCurrentState: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
  return {
    tx,
    db: {
      $transaction: vi.fn(async (callback) => callback(tx)),
    },
  };
}

describe('requestRealtimeSimulationTaskReconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildSimulationTaskInputIdentityFromFactJournal.mockReturnValue({
      factWatermark: '1',
      catalogDigest: 'catalog-digest',
      projectionCalculationVersion: 'simulation-task-projection-v2',
      historicalCandidatePlanDigest: 'plan-digest',
      inputDigest: 'input-digest-1',
    });
    mocks.requestCumulativeLearnerReconciliation.mockResolvedValue(7);
  });

  it('requests one fenced reconciliation for the current committed fact identity', async () => {
    const { db, tx } = createDb();

    await expect(requestRealtimeSimulationTaskReconciliation(db, {
      userId: 'student-1',
      classIds: ['class-a'],
      reason: 'arena-task-evidence',
    })).resolves.toBe(7);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.requestCumulativeLearnerReconciliation).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: 'student-1',
        classIds: ['class-a'],
        simulationTaskInput: expect.objectContaining({ inputDigest: 'input-digest-1' }),
      }),
    );
  });

  it('does not advance generation when the same input is already pending or projected', async () => {
    const pending = createDb();
    pending.tx.learningMaterializationRebuildRequest.findUnique.mockResolvedValue({
      status: 'PENDING',
      migrationRunId: 'migration-1',
      calculationVersion: 'portrait-v2',
      learnerGeneration: BigInt(3),
      queueGeneration: BigInt(4),
      cutoverFence: BigInt(5),
      simulationTaskInput: { inputDigest: 'input-digest-1' },
    });
    const current = createDb();
    current.tx.learnerPortraitCurrentState.findUnique.mockResolvedValue({
      calculationVersion: 'portrait-v2',
      generation: BigInt(3),
      queueGeneration: BigInt(4),
      cutoverFence: BigInt(5),
      taskInputDigest: 'input-digest-1',
    });

    await expect(requestRealtimeSimulationTaskReconciliation(pending.db, {
      userId: 'student-1',
      reason: 'duplicate-task-evidence',
    })).resolves.toBeNull();
    await expect(requestRealtimeSimulationTaskReconciliation(current.db, {
      userId: 'student-1',
      reason: 'duplicate-task-evidence',
    })).resolves.toBeNull();

    expect(mocks.requestCumulativeLearnerReconciliation).not.toHaveBeenCalled();
  });

  it('can request the same committed identity after an earlier request persistence failure', async () => {
    const first = createDb();
    mocks.requestCumulativeLearnerReconciliation.mockRejectedValueOnce(
      new Error('request persistence unavailable'),
    );

    await expect(requestRealtimeSimulationTaskReconciliation(first.db, {
      userId: 'student-1',
      reason: 'virtual-simulation-task-evidence',
    })).rejects.toThrow('request persistence unavailable');

    const retry = createDb();
    await expect(requestRealtimeSimulationTaskReconciliation(retry.db, {
      userId: 'student-1',
      reason: 'simulation-task-catalog-refresh',
    })).resolves.toBe(7);
    expect(mocks.requestCumulativeLearnerReconciliation).toHaveBeenCalledTimes(2);
  });
});
