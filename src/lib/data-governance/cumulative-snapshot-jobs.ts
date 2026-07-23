import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
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
  $queryRaw?: <T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ) => PromiseLike<T>;
  learningMaterializationRebuildRequest: {
    findUnique(args: any): PromiseLike<any>;
    findMany?(args: any): PromiseLike<any[]>;
    create(args: any): PromiseLike<any>;
    updateMany(args: any): PromiseLike<{ count: number }>;
  };
  learningMaterializationGeneration?: {
    upsert(args: any): PromiseLike<{ generation: number }>;
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
  const requestedClassIds = normalizedClassIds(input.classIds);
  if (typeof db.$queryRaw === 'function') {
    const requestedClassIdsJson = Prisma.sql`${JSON.stringify(requestedClassIds)}::jsonb`;
    const mergedClassIds = Prisma.sql`(
      SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
      FROM (
        SELECT DISTINCT value
        FROM jsonb_array_elements_text(
          COALESCE("LearningMaterializationRebuildRequest"."classIds", '[]'::jsonb)
          || EXCLUDED."classIds"
        ) AS merged(value)
      ) AS unique_values
    )`;
    const digestFor = (
      classIds: Prisma.Sql,
      generation: Prisma.Sql,
    ) => Prisma.sql`(
      SELECT encode(
        digest(
          string_agg(
            convert_to(value, 'UTF8'),
            decode('00', 'hex')
            ORDER BY ordinal
          ),
          'sha256'
        ),
        'hex'
      )
      FROM jsonb_array_elements_text(
        jsonb_build_array(${input.userId}::text, ${input.reason}::text)
        || ${classIds}
        || jsonb_build_array(
          ${fence.calculationVersion}::text,
          ${fence.learnerGeneration.toString()}::text,
          ${fence.queueGeneration.toString()}::text,
          ${fence.fence.toString()}::text,
          ${fence.activeMigrationRunId}::text,
          ${generation}
        )
      ) WITH ORDINALITY AS digest_input(value, ordinal)
    )`;
    const rows = await db.$queryRaw<Array<{ generation: number }>>(Prisma.sql`
      WITH request_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${
          'learning-materialization:' + input.userId
        }))
      ), request_generation AS (
        SELECT COALESCE((
          SELECT "generation"
          FROM "LearningMaterializationRebuildRequest"
          WHERE "userId" = ${input.userId}
        ), 0) AS "generation"
        FROM request_lock
      ), next_generation AS (
        INSERT INTO "LearningMaterializationGeneration"
          ("userId", "generation", "updatedAt")
        SELECT
          ${input.userId},
          CASE
            WHEN request_generation."generation" > 0
              THEN request_generation."generation" + 1
            ELSE 1
          END,
          ${now}
        FROM request_generation
        ON CONFLICT ("userId") DO UPDATE SET
          "generation" = GREATEST(
            "LearningMaterializationGeneration"."generation",
            (SELECT "generation" FROM request_generation)
          ) + 1,
          "updatedAt" = EXCLUDED."updatedAt"
        RETURNING "generation"
      )
      INSERT INTO "LearningMaterializationRebuildRequest"
        (
          "userId", "classIds", "reason", "kind", "migrationRunId",
          "calculationVersion", "learnerGeneration", "queueGeneration",
          "cutoverFence", "inputDigest", "status", "generation",
          "claimedGeneration", "claimToken", "claimExpiresAt", "attemptCount",
          "lastErrorCode", "completedAt", "createdAt", "updatedAt"
        )
      SELECT
        ${input.userId},
        ${requestedClassIdsJson},
        ${input.reason},
        ${CUMULATIVE_LEARNER_RECONCILIATION_KIND},
        ${fence.activeMigrationRunId},
        ${fence.calculationVersion},
        ${fence.learnerGeneration},
        ${fence.queueGeneration},
        ${fence.fence},
        ${digestFor(requestedClassIdsJson, Prisma.sql`next_generation."generation"`)},
        'PENDING',
        next_generation."generation",
        NULL,
        NULL,
        NULL,
        0,
        NULL,
        NULL,
        ${now},
        ${now}
      FROM next_generation
      ON CONFLICT ("userId") DO UPDATE SET
        "classIds" = ${mergedClassIds},
        "reason" = EXCLUDED."reason",
        "kind" = EXCLUDED."kind",
        "migrationRunId" = EXCLUDED."migrationRunId",
        "calculationVersion" = EXCLUDED."calculationVersion",
        "learnerGeneration" = EXCLUDED."learnerGeneration",
        "queueGeneration" = EXCLUDED."queueGeneration",
        "cutoverFence" = EXCLUDED."cutoverFence",
        "inputDigest" = ${digestFor(
          mergedClassIds,
          Prisma.sql`EXCLUDED."generation"`,
        )},
        "status" = 'PENDING',
        "generation" = EXCLUDED."generation",
        "claimedGeneration" = NULL,
        "claimToken" = NULL,
        "claimExpiresAt" = NULL,
        "attemptCount" = 0,
        "lastErrorCode" = NULL,
        "completedAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING "generation"
    `);
    const generation = rows[0]?.generation;
    if (!Number.isInteger(generation)) {
      throw new Error('Cumulative learner reconciliation request did not return a generation.');
    }
    return generation;
  }
  const current = await db.learningMaterializationRebuildRequest.findUnique({
    where: { userId: input.userId },
  });
  const generationRow = await db.learningMaterializationGeneration?.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      generation: Math.max((current?.generation ?? 0) + 1, 1),
      updatedAt: now,
    },
    update: { generation: { increment: 1 }, updatedAt: now },
  });
  const classIds = normalizedClassIds([
    ...normalizedClassIds(current?.classIds),
    ...requestedClassIds,
  ]);
  const generation = Math.max(
    generationRow?.generation ?? 0,
    (current?.generation ?? 0) + 1,
    1,
  );
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
