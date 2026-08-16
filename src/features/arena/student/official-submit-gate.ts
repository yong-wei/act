import { randomUUID } from 'node:crypto';

export const PENDING_OFFICIAL_SUBMIT_RESERVATION_INTERVAL = '2 minutes';

export interface OfficialSubmitGateDb {
  $executeRaw?(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  $queryRaw?<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $transaction?<T>(fn: (tx: OfficialSubmitGateDb) => Promise<T>): Promise<T>;
}

export interface OfficialSubmitReservation {
  id: string;
  submittedAt: string;
}

export function officialArenaSubmitScopeKey(input: {
  userId: string;
  taskId: string;
  classId?: string | null;
}): string {
  return `arena-official-submit:${input.userId}:${input.taskId}:${normalizeOfficialSubmitClassId(input.classId)}`;
}

export function normalizeOfficialSubmitClassId(classId?: string | null): string {
  return classId ?? '';
}

export async function reserveOfficialArenaSubmissionOrder(input: {
  db: OfficialSubmitGateDb;
  userId: string;
  taskId: string;
  classId?: string | null;
}): Promise<OfficialSubmitReservation> {
  const reservation = { id: randomUUID(), submittedAt: new Date().toISOString() };
  if (typeof input.db.$transaction !== 'function') return reservation;

  return input.db.$transaction(async (tx) => {
    if (typeof tx.$executeRaw !== 'function' || typeof tx.$queryRaw !== 'function') {
      return reservation;
    }
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${officialArenaSubmitScopeKey(input)}, 0))
    `;
    const stamped = await tx.$queryRaw<Array<{ submitted_at: Date | string }>>`
      SELECT clock_timestamp() AS submitted_at
    `;
    const submittedAt = toIsoTimestamp(stamped[0]?.submitted_at);
    await tx.$executeRaw`
      INSERT INTO "ArenaOfficialSubmitReservation" ("id", "userId", "taskId", "classId", "submittedAt")
      VALUES (
        ${reservation.id},
        ${input.userId},
        ${input.taskId},
        ${normalizeOfficialSubmitClassId(input.classId)},
        ${new Date(submittedAt)}
      )
    `;
    return { id: reservation.id, submittedAt };
  });
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

export async function hasEarlierOfficialSubmitSuccessor(input: {
  db: OfficialSubmitGateDb;
  userId: string;
  taskId: string;
  classId?: string | null;
  baselineAt: Date | string | number;
  submittedAt: Date | string;
}): Promise<boolean> {
  if (typeof input.db.$queryRaw !== 'function') return false;
  const rows = await input.db.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "ArenaOfficialSubmitReservation"
    WHERE "userId" = ${input.userId}
      AND "taskId" = ${input.taskId}
      AND "classId" = ${normalizeOfficialSubmitClassId(input.classId)}
      AND "submittedAt" > ${toDate(input.baselineAt)}
      AND "submittedAt" < ${toDate(input.submittedAt)}
      AND (
        "submissionId" IS NOT NULL
        OR "createdAt" > NOW() - (${PENDING_OFFICIAL_SUBMIT_RESERVATION_INTERVAL}::interval)
      )
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
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
