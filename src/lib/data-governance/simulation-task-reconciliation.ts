import { Prisma } from '@prisma/client';

import {
  readActiveCumulativePublicationFence,
  requestCumulativeLearnerReconciliation,
} from './cumulative-snapshot-jobs';
import {
  buildSimulationTaskInputIdentityFromFactJournal,
  computeSimulationTaskCatalogDigest,
  findSimulationTaskProjectionCandidateUserIds,
  type SimulationTaskInputIdentity,
} from './simulation-task-portrait-projection';

interface SimulationTaskSchedulingDb {
  learningFact: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      id: string;
      userId: string;
      contextJson?: unknown;
    }>>;
  };
  learnerFactTransition: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      factId: string;
      sequence: bigint;
      operation?: 'UPSERT' | 'CORRECT' | 'REVOKE';
      transitionPayload?: unknown;
    }>>;
  };
}

interface SimulationTaskCatalogRefreshDb extends SimulationTaskSchedulingDb {
  learnerPortraitCurrentState?: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      userId: string;
      stateVersion?: { snapshot?: { payload?: unknown } | null } | null;
    }>>;
  };
  $transaction<T>(
    operation: (tx: SimulationTaskCatalogRefreshDb) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
  $executeRaw?(query: Prisma.Sql): Promise<unknown>;
}

interface RealtimeSimulationTaskReconciliationTx extends SimulationTaskSchedulingDb {
  cumulativePortraitCutoverFence: {
    findUnique(args: Record<string, unknown>): PromiseLike<any>;
  };
  learningMaterializationRebuildRequest: {
    findUnique(args: Record<string, unknown>): PromiseLike<any>;
  };
  learnerPortraitCurrentState: {
    findUnique(args: Record<string, unknown>): PromiseLike<any>;
  };
  $executeRaw?(query: Prisma.Sql): Promise<unknown>;
}

interface RealtimeSimulationTaskReconciliationDb {
  $transaction<T>(
    operation: (tx: RealtimeSimulationTaskReconciliationTx) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
}

export async function readSimulationTaskInputIdentityForScheduling(
  db: SimulationTaskSchedulingDb,
  input: {
    userId: string;
  },
): Promise<SimulationTaskInputIdentity> {
  const [facts, transitions] = await Promise.all([
    db.learningFact.findMany({
      where: { userId: input.userId },
      select: { id: true, contextJson: true },
    }),
    db.learnerFactTransition.findMany({
      where: { userId: input.userId },
      select: {
        factId: true,
        sequence: true,
        operation: true,
        transitionPayload: true,
      },
    }),
  ]);
  return buildSimulationTaskInputIdentityFromFactJournal({
    facts,
    transitions,
    catalogDigest: computeSimulationTaskCatalogDigest(),
  });
}

export async function requestRealtimeSimulationTaskReconciliation(
  database: unknown,
  input: {
    userId: string;
    classIds?: string[];
    reason: string;
  },
): Promise<number | null> {
  const db = database as RealtimeSimulationTaskReconciliationDb;
  return db.$transaction(async (tx) => {
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'portrait-v2:' + input.userId}))`,
      );
    }
    const simulationTaskInput = await readSimulationTaskInputIdentityForScheduling(tx, {
      userId: input.userId,
    });
    const [fence, request, current] = await Promise.all([
      readActiveCumulativePublicationFence(tx as never),
      tx.learningMaterializationRebuildRequest.findUnique({
        where: { userId: input.userId },
        select: {
          status: true,
          migrationRunId: true,
          calculationVersion: true,
          learnerGeneration: true,
          queueGeneration: true,
          cutoverFence: true,
          simulationTaskInput: true,
        },
      }),
      tx.learnerPortraitCurrentState.findUnique({
        where: { userId: input.userId },
        select: {
          calculationVersion: true,
          generation: true,
          queueGeneration: true,
          taskInputDigest: true,
          cutoverFence: true,
        },
      }),
    ]);
    const requestInput = request?.simulationTaskInput;
    const requestInputDigest = (
      requestInput
      && typeof requestInput === 'object'
      && !Array.isArray(requestInput)
      && typeof requestInput.inputDigest === 'string'
    )
      ? requestInput.inputDigest
      : null;
    const requestCoversInput = (
      fence
      && requestInputDigest === simulationTaskInput.inputDigest
      && (request.status === 'PENDING' || request.status === 'CLAIMED')
      && request.migrationRunId === fence.activeMigrationRunId
      && request.calculationVersion === fence.calculationVersion
      && request.learnerGeneration === fence.learnerGeneration
      && request.queueGeneration === fence.queueGeneration
      && request.cutoverFence === fence.fence
    );
    const currentCoversInput = Boolean(
      fence
      && current?.calculationVersion === fence.calculationVersion
      && current?.generation === fence.learnerGeneration
      && current?.queueGeneration === fence.queueGeneration
      && current?.cutoverFence === fence.fence
      && current?.taskInputDigest === simulationTaskInput.inputDigest
    );
    if (
      requestCoversInput
      || currentCoversInput
    ) {
      return null;
    }
    return requestCumulativeLearnerReconciliation(tx as never, {
      userId: input.userId,
      classIds: input.classIds,
      reason: input.reason,
      simulationTaskInput,
    });
  }, { timeout: 120_000 });
}

export async function scheduleSimulationTaskCatalogRefresh(
  db: SimulationTaskCatalogRefreshDb,
  input: {
    reason?: string;
    now?: Date;
  } = {},
): Promise<{
  catalogDigest: string;
  candidateLearners: number;
  scheduledLearners: number;
  targetGenerations: Array<{ userId: string; generation: number }>;
}> {
  const userIds = await findSimulationTaskProjectionCandidateUserIds(db);
  const targetGenerations: Array<{ userId: string; generation: number }> = [];
  for (const userId of userIds) {
    const generation = await db.$transaction(async (tx) => {
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'portrait-v2:' + userId}))`,
        );
      }
      const simulationTaskInput = await readSimulationTaskInputIdentityForScheduling(tx, {
        userId,
      });
      return requestCumulativeLearnerReconciliation(tx as never, {
        userId,
        reason: input.reason ?? 'simulation-task-catalog-refresh',
        now: input.now,
        simulationTaskInput,
      });
    }, { timeout: 120_000 });
    targetGenerations.push({ userId, generation });
  }
  return {
    catalogDigest: computeSimulationTaskCatalogDigest(),
    candidateLearners: userIds.length,
    scheduledLearners: targetGenerations.length,
    targetGenerations,
  };
}
