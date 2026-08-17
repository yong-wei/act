import { randomUUID } from 'node:crypto';

export const OFFICIAL_SUBMIT_LEASE_TTL = '30 seconds';
export const OFFICIAL_SUBMIT_LEASE_REFRESH_MS = 10_000;
export const OFFICIAL_SUBMIT_RESERVATION_WAIT_MS = 120_000;
export const OFFICIAL_SUBMIT_RESERVATION_POLL_MS = 50;

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
      INSERT INTO "ArenaOfficialSubmitReservation" (
        "id", "userId", "taskId", "classId", "submittedAt", "lockedUntil"
      )
      VALUES (
        ${reservation.id},
        ${input.userId},
        ${input.taskId},
        ${classId},
        ${new Date(submittedAt)},
        NOW() + (${OFFICIAL_SUBMIT_LEASE_TTL}::interval)
      )
    `;
    return { id: reservation.id, submittedAt };
  });

  return {
    ...reserved,
    lease: input.acquireLease === false
      ? undefined
      : startOfficialSubmitLeaseRefresh(input.db, reserved.id),
  };
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

export async function waitForEarlierOfficialSubmitReservations(input: {
  db: OfficialSubmitGateDb;
  userId: string;
  taskId: string;
  classId?: string | null;
  baselineAt: Date | string | number;
  submittedAt: Date | string;
  waitMs?: number;
  pollMs?: number;
}): Promise<void> {
  const waitMs = input.waitMs ?? (process.env.VITEST ? 0 : OFFICIAL_SUBMIT_RESERVATION_WAIT_MS);
  const pollMs = input.pollMs ?? OFFICIAL_SUBMIT_RESERVATION_POLL_MS;
  const deadline = Date.now() + Math.max(0, waitMs);
  while (await hasEarlierLivePendingOfficialReservation(input)) {
    if (Date.now() >= deadline) return;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

export async function hasEarlierLivePendingOfficialReservation(input: {
  db: OfficialSubmitGateDb;
  userId: string;
  taskId: string;
  classId?: string | null;
  baselineAt: Date | string | number;
  submittedAt: Date | string;
}): Promise<boolean> {
  return hasEarlierOfficialSubmitSuccessor({ ...input, pendingOnly: true });
}

export async function hasEarlierOfficialSubmitSuccessor(input: {
  db: OfficialSubmitGateDb;
  userId: string;
  taskId: string;
  classId?: string | null;
  baselineAt: Date | string | number;
  submittedAt: Date | string;
  pendingOnly?: boolean;
}): Promise<boolean> {
  if (typeof input.db.$queryRaw !== 'function') return false;
  const rows = await input.db.$queryRaw<Array<{
    id: string;
    submissionId: string | null;
    lockedUntil: Date | string;
  }>>`
    SELECT id, "submissionId", "lockedUntil"
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
    if (row.submissionId) {
      if (input.pendingOnly) continue;
      return true;
    }
    const lockedUntil = toDate(row.lockedUntil).getTime();
    if (!Number.isFinite(lockedUntil) || lockedUntil > Date.now()) return true;
    if (typeof input.db.$executeRaw !== 'function') return true;
    const deleted = await input.db.$executeRaw`
      DELETE FROM "ArenaOfficialSubmitReservation"
      WHERE id = ${row.id}
        AND "submissionId" IS NULL
        AND "lockedUntil" <= NOW()
    `;
    if (deleted === 1) continue;
    const remaining = await input.db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "ArenaOfficialSubmitReservation"
      WHERE id = ${row.id}
      LIMIT 1
    `;
    if (Array.isArray(remaining) && remaining.length > 0) return true;
  }
  return false;
}

function startOfficialSubmitLeaseRefresh(
  db: OfficialSubmitGateDb,
  reservationId: string,
): OfficialSubmitReservationLease {
  const refresh = async () => {
    if (typeof db.$executeRaw !== 'function') return;
    await db.$executeRaw`
      UPDATE "ArenaOfficialSubmitReservation"
      SET "lockedUntil" = NOW() + (${OFFICIAL_SUBMIT_LEASE_TTL}::interval)
      WHERE id = ${reservationId}
        AND "submissionId" IS NULL
    `;
  };
  const timer = setInterval(() => {
    void refresh().catch(() => undefined);
  }, OFFICIAL_SUBMIT_LEASE_REFRESH_MS);
  timer.unref?.();
  let released = false;
  return {
    async release() {
      if (released) return;
      released = true;
      clearInterval(timer);
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
