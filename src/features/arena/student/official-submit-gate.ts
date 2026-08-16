import { randomUUID } from 'node:crypto';

import pg from 'pg';

export interface OfficialSubmitGateDb {
  $executeRaw?(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  $queryRaw?<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $transaction?<T>(fn: (tx: OfficialSubmitGateDb) => Promise<T>): Promise<T>;
}

export interface OfficialSubmitReservationLease {
  release(): Promise<void>;
}

export interface OfficialSubmitReservation {
  id: string;
  submittedAt: string;
  lease?: OfficialSubmitReservationLease;
}

export function officialArenaSubmitScopeKey(input: {
  userId: string;
  taskId: string;
  classId?: string | null;
}): string {
  return `arena-official-submit:${input.userId}:${input.taskId}:${normalizeOfficialSubmitClassId(input.classId)}`;
}

export function officialArenaSubmitLeaseKey(reservationId: string): string {
  return `arena-official-lease:${reservationId}`;
}

export function normalizeOfficialSubmitClassId(classId?: string | null): string {
  return classId ?? '';
}

export async function reserveOfficialArenaSubmissionOrder(input: {
  db: OfficialSubmitGateDb;
  userId: string;
  taskId: string;
  classId?: string | null;
  acquireLease?: boolean;
}): Promise<OfficialSubmitReservation> {
  const reservation = { id: randomUUID(), submittedAt: new Date().toISOString() };
  if (typeof input.db.$transaction !== 'function') return reservation;

  const lease = input.acquireLease === false
    ? undefined
    : await acquireOfficialSubmitReservationLease(reservation.id);
  try {
    const reserved = await input.db.$transaction(async (tx) => {
      if (typeof tx.$executeRaw !== 'function' || typeof tx.$queryRaw !== 'function') {
        return reservation;
      }
      const classId = normalizeOfficialSubmitClassId(input.classId);
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${officialArenaSubmitScopeKey(input)}, 0))
      `;
      const stamped = await tx.$queryRaw<Array<{ submitted_at: Date | string }>>`
        SELECT GREATEST(
          date_trunc('milliseconds', clock_timestamp())::timestamp,
          COALESCE(
            (
              SELECT MAX("submittedAt") + INTERVAL '1 millisecond'
              FROM "ArenaOfficialSubmitReservation"
              WHERE "userId" = ${input.userId}
                AND "taskId" = ${input.taskId}
                AND "classId" = ${classId}
            ),
            '-infinity'::timestamp
          )
        ) AS submitted_at
      `;
      const submittedAt = toIsoTimestamp(stamped[0]?.submitted_at);
      await tx.$executeRaw`
        INSERT INTO "ArenaOfficialSubmitReservation" ("id", "userId", "taskId", "classId", "submittedAt")
        VALUES (
          ${reservation.id},
          ${input.userId},
          ${input.taskId},
          ${classId},
          ${new Date(submittedAt)}
        )
      `;
      return { id: reservation.id, submittedAt };
    });
    return { ...reserved, lease };
  } catch (error) {
    await lease?.release().catch(() => undefined);
    throw error;
  }
}

export async function attachOfficialArenaSubmissionReservation(input: {
  db: OfficialSubmitGateDb;
  reservationId: string;
  submissionId: string;
}): Promise<void> {
  if (typeof input.db.$executeRaw !== 'function') return;
  await input.db.$executeRaw`
    UPDATE "ArenaOfficialSubmitReservation"
    SET "submissionId" = ${input.submissionId}
    WHERE id = ${input.reservationId}
  `;
}

export async function abandonOfficialArenaSubmissionReservation(input: {
  db: OfficialSubmitGateDb;
  reservationId: string;
}): Promise<void> {
  if (typeof input.db.$executeRaw !== 'function') return;
  await input.db.$executeRaw`
    DELETE FROM "ArenaOfficialSubmitReservation"
    WHERE id = ${input.reservationId}
      AND "submissionId" IS NULL
  `;
}

export async function releaseOfficialSubmitReservation(reservation: OfficialSubmitReservation): Promise<void> {
  await reservation.lease?.release();
}

export async function hasEarlierOfficialSubmitSuccessor(input: {
  db: OfficialSubmitGateDb;
  userId: string;
  taskId: string;
  classId?: string | null;
  baselineAt: Date | string | number;
  submittedAt: Date | string;
}): Promise<boolean> {
  if (typeof input.db.$queryRaw !== 'function') return false;
  const rows = await input.db.$queryRaw<Array<{ id: string; submissionId: string | null }>>`
    SELECT id, "submissionId"
    FROM "ArenaOfficialSubmitReservation"
    WHERE "userId" = ${input.userId}
      AND "taskId" = ${input.taskId}
      AND "classId" = ${normalizeOfficialSubmitClassId(input.classId)}
      AND "submittedAt" > ${toDate(input.baselineAt)}
      AND "submittedAt" < ${toDate(input.submittedAt)}
    ORDER BY "submittedAt" ASC
  `;
  if (!Array.isArray(rows) || rows.length === 0) return false;

  for (const row of rows) {
    if (row.submissionId) return true;
    if (await isLiveOfficialSubmitReservation(input.db, row.id)) return true;
  }
  return false;
}

async function isLiveOfficialSubmitReservation(db: OfficialSubmitGateDb, reservationId: string): Promise<boolean> {
  if (typeof db.$queryRaw !== 'function') return true;
  const leaseKey = officialArenaSubmitLeaseKey(reservationId);
  const lock = await db.$queryRaw<Array<{ locked?: boolean | null }>>`
    SELECT pg_try_advisory_lock(hashtextextended(${leaseKey}, 0)) AS locked
  `;
  if (lock[0]?.locked !== true) return true;
  try {
    if (typeof db.$executeRaw === 'function') {
      await db.$executeRaw`
        DELETE FROM "ArenaOfficialSubmitReservation"
        WHERE id = ${reservationId}
          AND "submissionId" IS NULL
      `;
    }
  } finally {
    await db.$queryRaw`
      SELECT pg_advisory_unlock(hashtextextended(${leaseKey}, 0))
    `;
  }
  return false;
}

async function acquireOfficialSubmitReservationLease(reservationId: string): Promise<OfficialSubmitReservationLease> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to reserve an official Arena submission.');
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
      officialArenaSubmitLeaseKey(reservationId),
    ]);
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
  let released = false;
  return {
    async release() {
      if (released) return;
      released = true;
      try {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
          officialArenaSubmitLeaseKey(reservationId),
        ]);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  };
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIsoTimestamp(value: Date | string | undefined): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}
