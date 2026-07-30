/**
 * Row-level write fence for stopped Legacy learning paths (#1115).
 *
 * Closes the read-then-write race against cutover stop by taking a path row
 * lock (or Serializable transaction) and re-checking mutability before any
 * create/update commits. Compatible with future #1117 cutover transactions.
 */

import { Prisma } from '@prisma/client';

import {
  LEGACY_STOPPED_PATH_STATUS,
  UNFINISHED_LEGACY_PATH_STATUSES,
} from './contracts';
import {
  LearningPathMutationBlockedError,
  assertLearningPathWritable,
  throwIfLearningPathNotWritable,
  type LearningPathMutationTarget,
} from './mutation-guard';

export type LearningPathFenceClient = {
  learningPath: {
    findFirst: (args: any) => Promise<any | null>;
    update?: (args: any) => Promise<any>;
    updateMany?: (args: any) => Promise<{ count: number }>;
    upsert?: (args: any) => Promise<any>;
  };
  learningPathExecution?: {
    findFirst: (args: any) => Promise<any | null>;
    create: (args: any) => Promise<any>;
  };
  learningPathDeviation?: {
    findFirst: (args: any) => Promise<any | null>;
    create: (args: any) => Promise<any>;
  };
  learningPathIntervention?: {
    findFirst: (args: any) => Promise<any | null>;
    create: (args: any) => Promise<any>;
  };
  evidenceOutbox?: {
    createMany: (args: { data: any[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
  };
  learningFact?: {
    createMany: (args: { data: any[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
  };
  $queryRaw?: (query: TemplateStringsArray | Prisma.Sql, ...values: any[]) => Promise<any>;
  $executeRaw?: (query: TemplateStringsArray | Prisma.Sql, ...values: any[]) => Promise<any>;
  $transaction?: (
    fn: (tx: LearningPathFenceClient) => Promise<any>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel | string },
  ) => Promise<any>;
};

const PATH_FENCE_SELECT = {
  id: true,
  pathStatus: true,
  pathPayload: true,
  goalId: true,
  userId: true,
} as const;

/**
 * Run work under a path write fence.
 * - Prefer Serializable transaction + FOR UPDATE lock when available.
 * - Always re-check path mutability inside the fence before work mutates.
 * - Idempotent reads of existing append-only rows may run without requiring
 *   the path to still be writable (handled by callers).
 */
export async function runWithLearningPathWriteFence<T>(
  db: LearningPathFenceClient,
  pathId: string,
  work: (tx: LearningPathFenceClient, path: LearningPathMutationTarget | null) => Promise<T>,
  options: { requireWritable?: boolean } = {},
): Promise<T> {
  const requireWritable = options.requireWritable !== false;
  const run = async (client: LearningPathFenceClient): Promise<T> => {
    const path = await lockLearningPathRow(client, pathId);
    if (requireWritable && path) {
      throwIfLearningPathNotWritable(path);
    }
    return work(client, path);
  };

  if (typeof db.$transaction === 'function') {
    return db.$transaction(
      (tx) => run(tx),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  return run(db);
}

/**
 * Conditional stop of a single path row. Returns true only when this call
 * transitioned the row into legacy-stopped (count === 1).
 *
 * Uses updateMany with unfinished-status predicate so concurrent writers that
 * race after stop cannot observe an intermediate active state without a fence,
 * and stop itself is atomic w.r.t. pathStatus.
 */
export async function conditionalStopLegacyPathRow(
  client: LearningPathFenceClient,
  input: {
    pathId: string;
    pathPayload: Record<string, unknown>;
  },
): Promise<boolean> {
  const data = {
    pathStatus: LEGACY_STOPPED_PATH_STATUS,
    pathPayload: input.pathPayload,
  };

  if (typeof client.learningPath.updateMany === 'function') {
    const result = await client.learningPath.updateMany({
      where: {
        id: input.pathId,
        OR: [
          { pathStatus: { in: [...UNFINISHED_LEGACY_PATH_STATUSES] } },
          { pathStatus: null },
        ],
      },
      data,
    });
    return (result?.count ?? 0) > 0;
  }

  if (typeof client.learningPath.update === 'function') {
    // Fallback for test doubles without updateMany: lock + check + update.
    const path = await lockLearningPathRow(client, input.pathId);
    if (!path) return false;
    const status = path.pathStatus ?? null;
    const unfinished = status == null
      || (typeof status === 'string'
        && (UNFINISHED_LEGACY_PATH_STATUSES as readonly string[]).includes(status));
    if (!unfinished) return false;
    if (status === LEGACY_STOPPED_PATH_STATUS) return false;
    await client.learningPath.update({
      where: { id: input.pathId },
      data,
    });
    return true;
  }

  throw new Error('LearningPath stop requires update or updateMany');
}

/**
 * Conditional path update that fails closed if the path is already stopped.
 * Returns null when the path is no longer writable.
 */
export async function updateLearningPathIfWritable(
  client: LearningPathFenceClient,
  pathId: string,
  data: Record<string, unknown>,
): Promise<{ updated: true; path: any } | { updated: false; blocked: LearningPathMutationBlockedError }> {
  if (typeof client.learningPath.updateMany === 'function') {
    const result = await client.learningPath.updateMany({
      where: {
        id: pathId,
        pathStatus: { not: LEGACY_STOPPED_PATH_STATUS },
      },
      data,
    });
    if ((result?.count ?? 0) === 0) {
      const path = await client.learningPath.findFirst({
        where: { id: pathId },
        select: PATH_FENCE_SELECT,
      });
      const block = assertLearningPathWritable(path ?? {
        id: pathId,
        pathStatus: LEGACY_STOPPED_PATH_STATUS,
      });
      return {
        updated: false,
        blocked: new LearningPathMutationBlockedError(block ?? {
          blocked: true,
          code: 'LEGACY_PATH_STOPPED',
          reason: 'legacy-stopped-immutable',
          pathStatus: LEGACY_STOPPED_PATH_STATUS,
          pathId,
        }),
      };
    }
    return { updated: true, path: { id: pathId, ...data } };
  }

  if (typeof client.learningPath.update !== 'function') {
    throw new Error('LearningPath update requires update or updateMany');
  }

  const path = await lockLearningPathRow(client, pathId);
  throwIfLearningPathNotWritable(path ?? { id: pathId, pathStatus: LEGACY_STOPPED_PATH_STATUS });
  const updated = await client.learningPath.update({
    where: { id: pathId },
    data,
  });
  return { updated: true, path: updated };
}

export async function lockLearningPathRow(
  client: LearningPathFenceClient,
  pathId: string,
): Promise<LearningPathMutationTarget | null> {
  // When $queryRaw is present (production Prisma / real SQL clients), use FOR UPDATE
  // and propagate any database error. A failed SQL statement aborts the transaction;
  // swallowing it and falling back to ORM would both hide the root cause and be unsafe.
  if (typeof client.$queryRaw === 'function') {
    const rows = await client.$queryRaw(
      Prisma.sql`
        SELECT id, "pathStatus", "pathPayload", "goalId", "userId"
        FROM "LearningPath"
        WHERE id = ${pathId}
        FOR UPDATE
      `,
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];
    if (!row || typeof row !== 'object') return null;
    return {
      id: String((row as any).id ?? pathId),
      pathStatus: (row as any).pathStatus ?? null,
      pathPayload: (row as any).pathPayload ?? null,
      ...(typeof (row as any).goalId === 'string' || (row as any).goalId === null
        ? { goalId: (row as any).goalId }
        : {}),
      ...(typeof (row as any).userId === 'string'
        ? { userId: (row as any).userId }
        : {}),
    } as LearningPathMutationTarget;
  }

  // ORM fallback is only for test doubles that omit $queryRaw.
  return client.learningPath.findFirst({
    where: { id: pathId },
    select: PATH_FENCE_SELECT,
  });
}

/**
 * Run stop/cutover work in a Serializable transaction when available so it
 * composes with write fences for #1117.
 */
export async function runInLearningPathCutoverTransaction<T>(
  db: LearningPathFenceClient,
  work: (tx: LearningPathFenceClient) => Promise<T>,
): Promise<T> {
  if (typeof db.$transaction === 'function') {
    return db.$transaction(
      (tx) => work(tx),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  return work(db);
}
