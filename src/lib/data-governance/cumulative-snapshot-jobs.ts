import { createHash, randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';

import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';

export interface ActiveCumulativePublicationFence {
  calculationVersion: string;
  learnerGeneration: bigint;
  classGeneration: bigint;
  queueGeneration: bigint;
  fence: bigint;
  activeMigrationRunId: string;
}

export interface CumulativeClassSnapshotJob {
  classId: string;
  scope: 'cumulative';
  calculationVersion: string;
  learnerGeneration: string;
  classGeneration: string;
  queueGeneration: string;
  cutoverFence: string;
  migrationRunId: string;
}

export const CUMULATIVE_LEARNER_RECONCILIATION_KIND =
  'CUMULATIVE_RECONCILIATION';

export interface CumulativeLearnerReconciliationClaim {
  userId: string;
  classIds: string[];
  generation: number;
  claimToken: string;
  fence: ActiveCumulativePublicationFence;
}

interface FenceReader {
  cumulativePortraitCutoverFence: {
    findUnique(args: {
      where: { id: 'global' };
      select: {
        calculationVersion: true;
        learnerGeneration: true;
        classGeneration: true;
        queueGeneration: true;
        fence: true;
        activeMigrationRunId: true;
      };
    }): Promise<{
      calculationVersion: string;
      learnerGeneration: bigint;
      classGeneration: bigint;
      queueGeneration: bigint;
      fence: bigint;
      activeMigrationRunId: string | null;
    } | null>;
  };
}

interface LearnerReconciliationDb extends FenceReader {
  learningMaterializationRebuildRequest: {
    findUnique(args: any): PromiseLike<any>;
    findMany?(args: any): PromiseLike<any[]>;
    create(args: any): PromiseLike<any>;
    updateMany(args: any): PromiseLike<{ count: number }>;
  };
}

interface ClassSnapshotQueue {
  add(
    name: string,
    data: CumulativeClassSnapshotJob,
    options: {
      attempts: number;
      backoff: { type: 'exponential'; delay: number };
      jobId: string;
      removeOnComplete: { count: number };
      removeOnFail: { count: number };
    },
  ): Promise<unknown>;
}

const JOB_HISTORY_OPTIONS = {
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 200 },
} as const;

export async function readActiveCumulativePublicationFence(
  db: FenceReader = prisma,
): Promise<ActiveCumulativePublicationFence | null> {
  const fence = await db.cumulativePortraitCutoverFence.findUnique({
    where: { id: 'global' },
    select: {
      calculationVersion: true,
      learnerGeneration: true,
      classGeneration: true,
      queueGeneration: true,
      fence: true,
      activeMigrationRunId: true,
    },
  });
  if (!fence?.activeMigrationRunId) {
    return null;
  }
  return {
    ...fence,
    activeMigrationRunId: fence.activeMigrationRunId,
  };
}

function normalizedClassIds(classIds: unknown): string[] {
  if (!Array.isArray(classIds)) return [];
  return [...new Set(classIds.filter(
    (classId): classId is string => typeof classId === 'string' && classId.length > 0,
  ))].sort();
}

function reconciliationFenceData(fence: ActiveCumulativePublicationFence) {
  return {
    kind: CUMULATIVE_LEARNER_RECONCILIATION_KIND,
    migrationRunId: fence.activeMigrationRunId,
    calculationVersion: fence.calculationVersion,
    learnerGeneration: fence.learnerGeneration,
    queueGeneration: fence.queueGeneration,
    cutoverFence: fence.fence,
  };
}

export async function requestCumulativeLearnerReconciliation(
  db: LearnerReconciliationDb,
  input: {
    userId: string;
    classIds?: string[];
    reason: string;
    now?: Date;
  },
): Promise<number> {
  const now = input.now ?? new Date();
  const fence = await readActiveCumulativePublicationFence(db);
  if (!fence) {
    throw new Error('No active cumulative portrait publication fence is available.');
  }
  const current = await db.learningMaterializationRebuildRequest.findUnique({
    where: { userId: input.userId },
  });
  const classIds = normalizedClassIds([
    ...normalizedClassIds(current?.classIds),
    ...normalizedClassIds(input.classIds),
  ]);
  const generation = (current?.generation ?? 0) + 1;
  const inputDigest = createHash('sha256').update([
    input.userId,
    input.reason,
    ...classIds,
    fence.calculationVersion,
    fence.learnerGeneration.toString(),
    fence.queueGeneration.toString(),
    fence.fence.toString(),
    fence.activeMigrationRunId,
    generation.toString(),
  ].join('\0')).digest('hex');
  const data = {
    userId: input.userId,
    classIds,
    reason: input.reason,
    ...reconciliationFenceData(fence),
    inputDigest,
    status: 'PENDING',
    generation,
    claimedGeneration: null,
    claimToken: null,
    claimExpiresAt: null,
    attemptCount: 0,
    lastErrorCode: null,
    completedAt: null,
    updatedAt: now,
  };
  if (!current) {
    await db.learningMaterializationRebuildRequest.create({
      data: { ...data, createdAt: now },
    });
    return generation;
  }
  const updated = await db.learningMaterializationRebuildRequest.updateMany({
    where: { userId: input.userId, generation: current.generation },
    data,
  });
  if (updated.count !== 1) {
    throw new Error('Cumulative learner reconciliation request generation advanced.');
  }
  return generation;
}

export async function claimCumulativeLearnerReconciliations(
  db: LearnerReconciliationDb,
  fence: ActiveCumulativePublicationFence,
  input: { now?: Date; limit?: number } = {},
): Promise<CumulativeLearnerReconciliationClaim[]> {
  if (!db.learningMaterializationRebuildRequest.findMany) return [];
  const now = input.now ?? new Date();
  const rows = await db.learningMaterializationRebuildRequest.findMany({
    where: {
      ...reconciliationFenceData(fence),
      OR: [
        { status: 'PENDING' },
        { status: 'CLAIMED', claimExpiresAt: { lte: now } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    take: input.limit ?? 100,
  });
  const claims: CumulativeLearnerReconciliationClaim[] = [];
  for (const row of rows) {
    const claimToken = randomUUID();
    const claimed = await db.learningMaterializationRebuildRequest.updateMany({
      where: {
        userId: row.userId,
        generation: row.generation,
        ...reconciliationFenceData(fence),
        status: row.status,
        ...(row.status === 'CLAIMED' ? { claimExpiresAt: { lte: now } } : {}),
      },
      data: {
        status: 'CLAIMED',
        claimedGeneration: row.generation,
        claimToken,
        claimExpiresAt: new Date(now.getTime() + 10 * 60_000),
        attemptCount: { increment: 1 },
        lastErrorCode: null,
        updatedAt: now,
      },
    });
    if (claimed.count === 1) {
      claims.push({
        userId: row.userId,
        classIds: normalizedClassIds(row.classIds),
        generation: row.generation,
        claimToken,
        fence,
      });
    }
  }
  return claims;
}

function reconciliationClaimWhere(claim: CumulativeLearnerReconciliationClaim) {
  return {
    userId: claim.userId,
    generation: claim.generation,
    claimedGeneration: claim.generation,
    claimToken: claim.claimToken,
    status: 'CLAIMED',
    ...reconciliationFenceData(claim.fence),
  };
}

export async function renewCumulativeLearnerReconciliation(
  db: LearnerReconciliationDb,
  claim: CumulativeLearnerReconciliationClaim,
  now = new Date(),
): Promise<boolean> {
  const renewed = await db.learningMaterializationRebuildRequest.updateMany({
    where: reconciliationClaimWhere(claim),
    data: {
      claimExpiresAt: new Date(now.getTime() + 10 * 60_000),
      updatedAt: now,
    },
  });
  return renewed.count === 1;
}

export async function completeCumulativeLearnerReconciliation(
  db: LearnerReconciliationDb,
  claim: CumulativeLearnerReconciliationClaim,
  now = new Date(),
): Promise<boolean> {
  const completed = await db.learningMaterializationRebuildRequest.updateMany({
    where: reconciliationClaimWhere(claim),
    data: {
      status: 'COMPLETED',
      claimToken: null,
      claimExpiresAt: null,
      completedAt: now,
      lastErrorCode: null,
      updatedAt: now,
    },
  });
  return completed.count === 1;
}

export async function failCumulativeLearnerReconciliation(
  db: LearnerReconciliationDb,
  claim: CumulativeLearnerReconciliationClaim,
  errorCode: string,
  now = new Date(),
): Promise<boolean> {
  const failed = await db.learningMaterializationRebuildRequest.updateMany({
    where: reconciliationClaimWhere(claim),
    data: {
      status: 'PENDING',
      claimedGeneration: null,
      claimToken: null,
      claimExpiresAt: null,
      completedAt: null,
      lastErrorCode: errorCode,
      updatedAt: now,
    },
  });
  return failed.count === 1;
}

export function buildCumulativeClassSnapshotJob(
  classId: string,
  fence: ActiveCumulativePublicationFence,
): CumulativeClassSnapshotJob {
  return {
    classId,
    scope: 'cumulative',
    calculationVersion: fence.calculationVersion,
    learnerGeneration: fence.learnerGeneration.toString(),
    classGeneration: fence.classGeneration.toString(),
    queueGeneration: fence.queueGeneration.toString(),
    cutoverFence: fence.fence.toString(),
    migrationRunId: fence.activeMigrationRunId,
  };
}

function buildClassReconciliationJobId(
  classId: string,
  mutationIdentity: string,
  fence: ActiveCumulativePublicationFence,
): string {
  return `class-reconcile-${createHash('sha256')
    .update([
      classId,
      mutationIdentity,
      fence.calculationVersion,
      fence.learnerGeneration.toString(),
      fence.classGeneration.toString(),
      fence.queueGeneration.toString(),
      fence.fence.toString(),
      fence.activeMigrationRunId,
    ].join('\0'))
    .digest('hex')}`;
}

export async function enqueueCumulativeClassReconciliation(input: {
  classIds: Array<string | null | undefined>;
  mutationIdentity: string;
  db?: FenceReader;
  queue?: ClassSnapshotQueue;
  fence?: ActiveCumulativePublicationFence;
}): Promise<{
  scheduled: number;
  skipped: boolean;
  reason?: 'no-classes' | 'no-active-fence' | 'redis-unavailable';
}> {
  const classIds = Array.from(new Set(input.classIds.filter(
    (classId): classId is string => typeof classId === 'string' && classId.length > 0,
  )));
  if (classIds.length === 0) {
    return { scheduled: 0, skipped: true, reason: 'no-classes' };
  }

  const fence = input.fence
    ?? await readActiveCumulativePublicationFence(input.db ?? prisma);
  if (!fence) {
    return { scheduled: 0, skipped: true, reason: 'no-active-fence' };
  }

  let queue = input.queue;
  let ownedQueue: Queue<CumulativeClassSnapshotJob> | null = null;
  if (!queue) {
    if (!redisClient.isReady()) {
      return { scheduled: 0, skipped: true, reason: 'redis-unavailable' };
    }
    const connection = redisClient.getClient();
    if (!connection) {
      return { scheduled: 0, skipped: true, reason: 'redis-unavailable' };
    }
    ownedQueue = new Queue<CumulativeClassSnapshotJob>('snapshot-class', { connection });
    queue = ownedQueue;
  }

  try {
    for (const classId of classIds) {
      await queue.add(
        `class-snapshot-${classId}`,
        buildCumulativeClassSnapshotJob(classId, fence),
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 15000 },
          jobId: buildClassReconciliationJobId(classId, input.mutationIdentity, fence),
          ...JOB_HISTORY_OPTIONS,
        },
      );
    }
  } finally {
    await ownedQueue?.close();
  }

  return { scheduled: classIds.length, skipped: false };
}
