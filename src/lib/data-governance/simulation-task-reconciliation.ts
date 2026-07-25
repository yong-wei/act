import { Prisma } from '@prisma/client';

import { requestCumulativeLearnerReconciliation } from './cumulative-snapshot-jobs';
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
