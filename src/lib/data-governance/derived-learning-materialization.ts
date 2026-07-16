import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createEmptyCompetencyVector } from './competency-model';

type MaterializationDb = Record<string, any>;

export interface LearningMaterializationRebuildClaim {
  userId: string;
  classIds: string[];
  generation: number;
  claimToken: string;
}

const REBUILD_LEASE_MS = 10 * 60_000;
export const LEARNING_MATERIALIZATION_FENCED = 'learning-materialization-rebuild-fenced';
export const LEARNING_MATERIALIZATION_GENERATION_ADVANCED = 'learning-materialization-generation-advanced';
export type LearningMaterializationErrorCode = 'student-materialization-failed' | 'class-enqueue-failed';

async function lockRequest(db: MaterializationDb, userId: string) {
  if (typeof db.$executeRaw === 'function') {
    await db.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${'learning-materialization:' + userId}))`);
  }
}

export function resolveCompatibilityNoFactsAction(input: {
  fullRebuild: boolean;
  hasAnyRemainingFact: boolean;
}): 'preserve' | 'rebuild-empty-window' | 'revoke' {
  if (!input.fullRebuild) return 'preserve';
  return input.hasAnyRemainingFact ? 'rebuild-empty-window' : 'revoke';
}

export async function findAgingStudentSnapshotCandidates(
  db: MaterializationDb,
  now: Date,
  limit = 500,
): Promise<string[]> {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
  const pageSize = Math.min(Math.max(limit, 1), 500);
  const candidates: string[] = [];
  let cursor: string | undefined;
  while (candidates.length < limit) {
    const rows = await db.studentCompetencySnapshot.findMany({
      where: {},
      orderBy: [{ userId: 'asc' }, { snapshotAt: 'desc' }, { id: 'desc' }],
      distinct: ['userId'],
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, userId: true, factCount: true, snapshotAt: true, evidenceSummary: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    const pageCandidates = rows.filter((row: any) => {
      const state = row.evidenceSummary?._derivation?.state;
      return row.factCount > 0 && state !== 'no-recent-evidence' && state !== 'no-evidence-after-revocation';
    }).map((row: any) => row.userId);
    if (pageCandidates.length > 0) {
      const recent = await db.learningFact.findMany({
        where: { userId: { in: pageCandidates }, startedAt: { gte: cutoff } },
        select: { userId: true },
        distinct: ['userId'],
      });
      const active = new Set(recent.map((row: any) => row.userId));
      candidates.push(...pageCandidates.filter((userId: string) => !active.has(userId)));
    }
    if (rows.length < pageSize) break;
  }
  return [...new Set(candidates)].slice(0, limit);
}

function normalizedClassIds(classIds: unknown): string[] {
  if (!Array.isArray(classIds)) return [];
  return [...new Set(classIds.filter((value): value is string => typeof value === 'string' && value.length > 0))].sort();
}

export async function requestLearningMaterializationRebuild(
  db: MaterializationDb,
  input: { userId: string; classIds?: string[]; reason: string; now?: Date },
): Promise<void> {
  const classIds = normalizedClassIds(input.classIds);
  const now = input.now ?? new Date();
  if (typeof db.$executeRaw === 'function') {
    await db.$executeRaw(Prisma.sql`
      WITH request_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${'learning-materialization:' + input.userId}))
      ), next_generation AS (
        INSERT INTO "LearningMaterializationGeneration" ("userId", "generation", "updatedAt")
        SELECT ${input.userId}, 1, ${now} FROM request_lock
        ON CONFLICT ("userId") DO UPDATE SET
          "generation" = "LearningMaterializationGeneration"."generation" + 1,
          "updatedAt" = EXCLUDED."updatedAt"
        RETURNING "generation"
      )
      INSERT INTO "LearningMaterializationRebuildRequest"
        ("userId", "classIds", "reason", "status", "generation", "attemptCount", "createdAt", "updatedAt")
      SELECT
        ${input.userId}, ${JSON.stringify(classIds)}::jsonb, ${input.reason}, 'PENDING', next_generation."generation", 0, ${now}, ${now}
      FROM next_generation
      ON CONFLICT ("userId") DO UPDATE SET
        "classIds" = (
          SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
          FROM (
            SELECT DISTINCT value
            FROM jsonb_array_elements_text(
              COALESCE("LearningMaterializationRebuildRequest"."classIds", '[]'::jsonb)
              || EXCLUDED."classIds"
            ) AS merged(value)
          ) AS unique_values
        ),
        "reason" = EXCLUDED."reason",
        "status" = 'PENDING',
        "generation" = EXCLUDED."generation",
        "claimToken" = NULL,
        "claimExpiresAt" = NULL,
        "claimedGeneration" = NULL,
        "completedAt" = NULL,
        "lastErrorCode" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `);
    return;
  }

  const delegate = db.learningMaterializationRebuildRequest;
  const generationRow = await db.learningMaterializationGeneration?.upsert?.({
    where: { userId: input.userId },
    create: { userId: input.userId, generation: 1, updatedAt: now },
    update: { generation: { increment: 1 }, updatedAt: now },
  });
  const current = await delegate?.findUnique?.({ where: { userId: input.userId } });
  const nextGeneration = generationRow?.generation ?? ((current?.generation ?? 0) + 1);
  if (!current) {
    if (delegate?.create) {
      await delegate.create({ data: { userId: input.userId, classIds, reason: input.reason, status: 'PENDING', generation: nextGeneration, attemptCount: 0, createdAt: now, updatedAt: now } });
      return;
    }
    await delegate?.upsert?.({
      where: { userId: input.userId },
      create: { userId: input.userId, classIds, reason: input.reason, status: 'PENDING', generation: nextGeneration },
      update: { classIds, reason: input.reason, status: 'PENDING', generation: { increment: 1 }, claimToken: null, claimExpiresAt: null, claimedGeneration: null, completedAt: null, lastErrorCode: null },
    });
    return;
  }
  await delegate.updateMany({
    where: { userId: input.userId, generation: current.generation },
    data: {
      classIds: normalizedClassIds([...normalizedClassIds(current.classIds), ...classIds]),
      reason: input.reason,
      status: 'PENDING',
      generation: nextGeneration,
      claimToken: null,
      claimExpiresAt: null,
      claimedGeneration: null,
      completedAt: null,
      lastErrorCode: null,
      updatedAt: now,
    },
  });
}

export async function claimLearningMaterializationRebuild(
  db: MaterializationDb,
  input: { userId: string; expectedGeneration: number; claimToken?: string; now?: Date },
): Promise<LearningMaterializationRebuildClaim | null> {
  const now = input.now ?? new Date();
  const current = await db.learningMaterializationRebuildRequest.findUnique({ where: { userId: input.userId } });
  if (!current || current.generation !== input.expectedGeneration) return null;
  const expired = current.status === 'CLAIMED' && current.claimExpiresAt && new Date(current.claimExpiresAt) <= now;
  if (current.status !== 'PENDING' && !expired) return null;
  const claimToken = input.claimToken ?? randomUUID();
  const claimed = await db.learningMaterializationRebuildRequest.updateMany({
    where: {
      userId: input.userId,
      generation: input.expectedGeneration,
      status: current.status,
      ...(expired ? { claimExpiresAt: { lte: now } } : {}),
    },
    data: {
      status: 'CLAIMED',
      claimToken,
      claimedGeneration: input.expectedGeneration,
      claimExpiresAt: new Date(now.getTime() + REBUILD_LEASE_MS),
      attemptCount: (current.attemptCount ?? 0) + 1,
      lastErrorCode: null,
      updatedAt: now,
    },
  });
  return claimed.count === 1 ? {
    userId: input.userId,
    classIds: normalizedClassIds(current.classIds),
    generation: input.expectedGeneration,
    claimToken,
  } : null;
}

export async function completeLearningMaterializationRebuild(
  db: MaterializationDb,
  claim: LearningMaterializationRebuildClaim | null,
  now = new Date(),
): Promise<boolean> {
  if (!claim) return false;
  const completed = await db.learningMaterializationRebuildRequest.deleteMany({
    where: { userId: claim.userId, generation: claim.generation, claimedGeneration: claim.generation, claimToken: claim.claimToken, status: 'CLAIMED' },
  });
  return completed.count === 1;
}

export async function readLearningMaterializationGeneration(db: MaterializationDb, userId: string): Promise<number> {
  const row = await db.learningMaterializationGeneration?.findUnique?.({ where: { userId }, select: { generation: true } })
    ?? await db.learningMaterializationRebuildRequest?.findUnique?.({ where: { userId }, select: { generation: true } });
  return Number.isInteger(row?.generation) ? row.generation : 0;
}

export async function runLearningMaterializationBarrierStage<T>(
  db: MaterializationDb,
  input: { userId: string; observedGeneration: number },
  action: (tx: MaterializationDb) => Promise<T>,
): Promise<T> {
  const run = async (tx: MaterializationDb) => {
    await lockRequest(tx, input.userId);
    const currentGeneration = await readLearningMaterializationGeneration(tx, input.userId);
    if (currentGeneration !== input.observedGeneration) throw new Error(LEARNING_MATERIALIZATION_GENERATION_ADVANCED);
    return action(tx);
  };
  return typeof db.$transaction === 'function' ? db.$transaction(run) : run(db);
}

export async function appendEmptyStudentCompatibilitySnapshot(db: MaterializationDb, userId: string, now = new Date()) {
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: this empty vector is a lifecycle compatibility tombstone.
  const competencyVector = createEmptyCompetencyVector();
  for (const value of Object.values(competencyVector)) value.lastUpdated = now.toISOString();
  return db.studentCompetencySnapshot.create({
    data: {
      userId,
      snapshotAt: now,
      // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative lifecycle tombstone.
      competencyVector,
      evidenceSummary: { _derivation: { state: 'no-evidence-after-revocation', reason: 'governed-facts-revoked' } },
      riskFlags: [],
      factCount: 0,
    },
  });
}

export async function appendNoRecentEvidenceCompatibilitySnapshot(
  db: MaterializationDb,
  userId: string,
  historicalVector: unknown,
  now = new Date(),
) {
  const latest = await db.studentCompetencySnapshot.findFirst?.({ where: { userId }, orderBy: { snapshotAt: 'desc' } });
  if (latest?.factCount === 0 && latest?.evidenceSummary?._derivation?.state === 'no-recent-evidence') return latest;
  return db.studentCompetencySnapshot.create({ data: {
    userId,
    snapshotAt: now,
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: historical vector is non-authoritative lifecycle metadata.
    competencyVector: historicalVector,
    evidenceSummary: { _derivation: { state: 'no-recent-evidence', reason: 'no-governed-facts-in-30-day-window' } },
    riskFlags: [],
    factCount: 0,
  } });
}

export function selectCurrentClassCompetencySnapshots<T extends { factCount: number } | null>(snapshots: T[]): Exclude<T, null>[] {
  return snapshots.filter((snapshot): snapshot is Exclude<T, null> => Boolean(snapshot) && snapshot!.factCount > 0);
}

export function isSameClassPopulationSignature(current: unknown, previous: unknown): boolean {
  return JSON.stringify(current) === JSON.stringify(previous);
}

const CLASS_OUTBOX_TTL_MS = 7 * 24 * 60 * 60_000;
const CLASS_OUTBOX_LEASE_MS = 5 * 60_000;

export async function stageClassSnapshotOutbox(
  db: MaterializationDb,
  input: { userId: string; classId: string; generation: number; snapshotId?: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const dedupeKey = [input.userId, input.generation, input.classId, input.snapshotId].filter(Boolean).join(':');
  return db.learningMaterializationOutbox.upsert({
    where: { dedupeKey },
    create: {
      id: `learning-materialization-outbox:${dedupeKey}`,
      dedupeKey,
      userId: input.userId,
      classId: input.classId,
      generation: input.generation,
      kind: 'CLASS_SNAPSHOT',
      snapshotId: input.snapshotId ?? null,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: now,
      expiresAt: new Date(now.getTime() + CLASS_OUTBOX_TTL_MS),
      createdAt: now,
      updatedAt: now,
    },
    update: {},
  });
}

export async function stageGrowthRecomputeOutbox(
  db: MaterializationDb,
  input: { userId: string; generation: number; snapshotId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const dedupeKey = `growth:${input.userId}:${input.generation}:${input.snapshotId}`;
  return db.learningMaterializationOutbox.upsert({
    where: { dedupeKey },
    create: {
      id: `learning-materialization-outbox:${dedupeKey}`,
      dedupeKey,
      kind: 'GROWTH_RECOMPUTE',
      userId: input.userId,
      classId: null,
      generation: input.generation,
      snapshotId: input.snapshotId,
      status: 'PENDING', attemptCount: 0, availableAt: now,
      expiresAt: new Date(now.getTime() + CLASS_OUTBOX_TTL_MS), createdAt: now, updatedAt: now,
    },
    update: {},
  });
}

export async function dispatchClassSnapshotOutbox(
  db: MaterializationDb,
  enqueue: (classId: string, jobId: string) => Promise<unknown>,
  now = new Date(),
): Promise<{ delivered: number; failed: number }> {
  await db.learningMaterializationOutbox.deleteMany?.({ where: { status: 'DELIVERED', expiresAt: { lte: now } } });
  const rows = await db.learningMaterializationOutbox.findMany({
    where: { kind: 'CLASS_SNAPSHOT', availableAt: { lte: now }, OR: [{ status: 'PENDING' }, { status: 'CLAIMED', claimExpiresAt: { lte: now } }] },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  let delivered = 0;
  let failed = 0;
  for (const row of rows) {
    const claimToken = randomUUID();
    const claimed = await db.learningMaterializationOutbox.updateMany({
      where: { id: row.id, status: row.status, ...(row.status === 'CLAIMED' ? { claimExpiresAt: { lte: now } } : {}) },
      data: { status: 'CLAIMED', claimToken, claimExpiresAt: new Date(now.getTime() + CLASS_OUTBOX_LEASE_MS), attemptCount: { increment: 1 }, lastErrorCode: null, updatedAt: now },
    });
    if (claimed.count !== 1) continue;
    try {
      await enqueue(row.classId, `class-snapshot-outbox-${row.dedupeKey}`);
      const completed = await db.learningMaterializationOutbox.updateMany({ where: { id: row.id, status: 'CLAIMED', claimToken }, data: { status: 'DELIVERED', deliveredAt: now, claimToken: null, claimExpiresAt: null, updatedAt: now } });
      if (completed.count === 1) delivered += 1;
    } catch {
      failed += 1;
      await db.learningMaterializationOutbox.updateMany({ where: { id: row.id, status: 'CLAIMED', claimToken }, data: { status: 'PENDING', availableAt: new Date(now.getTime() + 60_000), claimToken: null, claimExpiresAt: null, lastErrorCode: 'class-queue-unavailable', updatedAt: now } });
    }
  }
  return { delivered, failed };
}

export async function dispatchGrowthRecomputeOutbox(
  db: MaterializationDb,
  enqueue: (userId: string, snapshotId: string, jobId: string) => Promise<unknown>,
  now = new Date(),
): Promise<{ delivered: number; failed: number }> {
  await db.learningMaterializationOutbox.deleteMany?.({ where: { status: 'DELIVERED', expiresAt: { lte: now } } });
  const rows = await db.learningMaterializationOutbox.findMany({
    where: { kind: 'GROWTH_RECOMPUTE', availableAt: { lte: now }, OR: [{ status: 'PENDING' }, { status: 'CLAIMED', claimExpiresAt: { lte: now } }] },
    orderBy: { createdAt: 'asc' }, take: 100,
  });
  let delivered = 0; let failed = 0;
  for (const row of rows) {
    if (!row.snapshotId) continue;
    const claimToken = randomUUID();
    const claimed = await db.learningMaterializationOutbox.updateMany({ where: { id: row.id, status: row.status, ...(row.status === 'CLAIMED' ? { claimExpiresAt: { lte: now } } : {}) }, data: { status: 'CLAIMED', claimToken, claimExpiresAt: new Date(now.getTime() + CLASS_OUTBOX_LEASE_MS), attemptCount: { increment: 1 }, lastErrorCode: null, updatedAt: now } });
    if (claimed.count !== 1) continue;
    try {
      await enqueue(row.userId, row.snapshotId, `growth-recompute-outbox-${row.dedupeKey}`);
      const completed = await db.learningMaterializationOutbox.updateMany({ where: { id: row.id, status: 'CLAIMED', claimToken }, data: { status: 'DELIVERED', deliveredAt: now, claimToken: null, claimExpiresAt: null, updatedAt: now } });
      if (completed.count === 1) delivered += 1;
    } catch {
      failed += 1;
      await db.learningMaterializationOutbox.updateMany({ where: { id: row.id, status: 'CLAIMED', claimToken }, data: { status: 'PENDING', availableAt: new Date(now.getTime() + 60_000), claimToken: null, claimExpiresAt: null, lastErrorCode: 'growth-queue-unavailable', updatedAt: now } });
    }
  }
  return { delivered, failed };
}

export async function failLearningMaterializationRebuild(
  db: MaterializationDb,
  claim: LearningMaterializationRebuildClaim | null,
  errorCode: LearningMaterializationErrorCode,
  now = new Date(),
): Promise<void> {
  if (!claim) return;
  await db.learningMaterializationRebuildRequest.updateMany({
    where: { userId: claim.userId, generation: claim.generation, claimedGeneration: claim.generation, claimToken: claim.claimToken, status: 'CLAIMED' },
    data: { status: 'PENDING', claimToken: null, claimExpiresAt: null, claimedGeneration: null, lastErrorCode: errorCode, updatedAt: now },
  });
}

export async function runClaimedLearningMaterializationStage<T>(
  db: MaterializationDb,
  claim: LearningMaterializationRebuildClaim,
  action: (tx: MaterializationDb) => Promise<T>,
  now = new Date(),
): Promise<T> {
  const run = async (tx: MaterializationDb) => {
    await lockRequest(tx, claim.userId);
    const renewed = await tx.learningMaterializationRebuildRequest.updateMany({
      where: {
        userId: claim.userId,
        generation: claim.generation,
        claimedGeneration: claim.generation,
        claimToken: claim.claimToken,
        status: 'CLAIMED',
        claimExpiresAt: { gt: now },
      },
      data: { claimExpiresAt: new Date(now.getTime() + REBUILD_LEASE_MS), updatedAt: now },
    });
    if (renewed.count !== 1) throw new Error(LEARNING_MATERIALIZATION_FENCED);
    return action(tx);
  };
  return typeof db.$transaction === 'function' ? db.$transaction(run) : run(db);
}

export async function settleLearningMaterializationRebuild(
  db: MaterializationDb,
  claim: LearningMaterializationRebuildClaim,
  enqueueClass: (classId: string) => Promise<unknown>,
  _snapshotAt?: Date,
): Promise<boolean> {
  const now = new Date();
  try {
    return await runClaimedLearningMaterializationStage(db, claim, async (tx) => {
      for (const classId of claim.classIds) await enqueueClass(classId);
      const completed = await completeLearningMaterializationRebuild(tx, claim, now);
      if (!completed) throw new Error(LEARNING_MATERIALIZATION_FENCED);
      return true;
    }, now);
  } catch (error) {
    if (!(error instanceof Error && error.message === LEARNING_MATERIALIZATION_FENCED)) {
      await failLearningMaterializationRebuild(db, claim, 'class-enqueue-failed', now);
    }
    throw error;
  }
}

export async function revokeDerivedLearningMaterializations(
  db: MaterializationDb,
  input: { userIds: string[]; classIds?: string[]; scheduleRebuild?: boolean },
): Promise<void> {
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  const classIds = normalizedClassIds(input.classIds);
  if (userIds.length > 0) {
    const userWhere = { userId: { in: userIds } };
    await db.studentEvidenceFeatureCache?.deleteMany?.({ where: userWhere });
    await db.studentProfileSummary?.deleteMany?.({ where: userWhere });
    await db.growthRecord?.deleteMany?.({ where: { ...userWhere, recordType: 'competency_evaluation', courseId: 'profile:growth-evaluation' } });
    await db.diagnosisReportSnapshot?.deleteMany?.({ where: { ...userWhere, subjectKind: { not: 'class' } } });
    if (input.scheduleRebuild !== false) {
      for (const userId of userIds) {
        await requestLearningMaterializationRebuild(db, { userId, classIds, reason: 'governed-fact-revoked' });
      }
    }
  }
  if (classIds.length > 0) {
    await db.diagnosisReportSnapshot?.deleteMany?.({ where: { subjectKind: 'class', classId: { in: classIds } } });
  }
}
