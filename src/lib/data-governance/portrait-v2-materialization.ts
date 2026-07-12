import { Prisma } from '@prisma/client';

import {
  mapLearningFactsToPortraitEvidence,
  updatePortraitV2Incrementally,
  type PortraitLearningFactDelta,
} from './portrait-v2-incremental-update';
import {
  readLatestPortraitV2SnapshotForUpdate,
  writePortraitV2Snapshot,
  type PortraitV2SnapshotReadDb,
  type PortraitV2SnapshotWriteDb,
} from './portrait-v2-model';

interface PortraitV2MaterializationDb {
  studentPortraitV2Snapshot?: NonNullable<PortraitV2SnapshotReadDb['studentPortraitV2Snapshot']> &
    NonNullable<PortraitV2SnapshotWriteDb['studentPortraitV2Snapshot']>;
  learningFact: {
    findMany: (args: Record<string, unknown>) => Promise<PortraitLearningFactDelta[]>;
  };
  $transaction?: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  $executeRaw?: (...args: unknown[]) => Promise<unknown>;
}

export async function materializeIncrementalPortraitV2(
  db: PortraitV2MaterializationDb,
  userId: string,
  options: { now?: Date } = {},
): Promise<{
  written: boolean;
  snapshotId?: string;
  evidenceCount: number;
  affectedDimensions: string[];
  mappingIssues: string[];
}> {
  const materialize = async (transactionDb: PortraitV2MaterializationDb) => {
    const now = options.now ?? new Date();
    const previous = await readLatestPortraitV2SnapshotForUpdate(transactionDb, userId, { now });
    const cursor = previous?.updateCursor;
    const facts = await transactionDb.learningFact.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              createdAt: { lte: now },
              OR: [
                { createdAt: { gt: new Date(cursor.lastFactCreatedAt) } },
                { createdAt: new Date(cursor.lastFactCreatedAt), id: { gt: cursor.lastFactId } },
              ],
            }
          : previous
            ? { createdAt: { gt: new Date(previous.generatedAt), lte: now } }
            : { createdAt: { lte: now } }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        startedAt: true,
        outcome: true,
        score: true,
        competencyContribution: true,
        contextJson: true,
        createdAt: true,
      },
    });
    const mapped = mapLearningFactsToPortraitEvidence(facts);
    const lastFact = facts[facts.length - 1];
    const updateCursor = lastFact ? {
      lastFactCreatedAt: lastFact.createdAt.toISOString(),
      lastFactId: lastFact.id,
    } : previous?.updateCursor;
    const profileEvidence = mapped.evidence.filter((item) =>
      item.outcome !== 'context-only' && Object.values(item.contributions).some((value) => value !== 0),
    );
    const updated = updatePortraitV2Incrementally({
      userId,
      previous,
      evidence: profileEvidence,
      generatedAt: now,
      updateCursor,
    });
    const persisted = await writePortraitV2Snapshot(transactionDb, updated.payload, { now });
    return {
      written: true,
      snapshotId: persisted.id,
      evidenceCount: profileEvidence.length,
      affectedDimensions: updated.affectedDimensions,
      mappingIssues: [...mapped.mappingIssues, ...updated.mappingIssues],
    };
  };

  if (!db.$transaction) return materialize(db);
  return db.$transaction(async (tx) => {
    const transactionDb = tx as PortraitV2MaterializationDb;
    await transactionDb.$executeRaw?.(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    return materialize(transactionDb);
  }) as Promise<{
    written: boolean;
    snapshotId?: string;
    evidenceCount: number;
    affectedDimensions: string[];
    mappingIssues: string[];
  }>;
}
