import { describe, expect, it, vi } from 'vitest';

import {
  abandonOfficialArenaSubmissionReservation,
  attachOfficialArenaSubmissionReservation,
  hasEarlierOfficialSubmitSuccessor,
  officialArenaSubmitScopeKey,
  reserveOfficialArenaSubmissionOrder,
  type OfficialSubmitGateDb,
} from '../student/official-submit-gate';

describe('official Arena submit gate', () => {
  it('builds a stable scope key that treats missing class as empty', () => {
    expect(officialArenaSubmitScopeKey({
      userId: 'student-1',
      taskId: 'task-1',
    })).toBe('arena-official-submit:student-1:task-1:');
  });

  it('falls back to a local timestamp when the database cannot reserve order', async () => {
    const reservation = await reserveOfficialArenaSubmissionOrder({
      db: {},
      userId: 'student-1',
      taskId: 'task-1',
    });

    expect(reservation.id).toEqual(expect.any(String));
    expect(Number.isFinite(Date.parse(reservation.submittedAt))).toBe(true);
  });

  it('assigns official order inside the user-task advisory lock', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const queryRaw = vi.fn().mockResolvedValue([{ submitted_at: new Date('2026-08-17T00:00:01.000Z') }]);
    const db: OfficialSubmitGateDb = {
      $transaction: async (fn) => fn(db),
      $executeRaw: executeRaw,
      $queryRaw: queryRaw,
    };

    const reservation = await reserveOfficialArenaSubmissionOrder({
      db,
      userId: 'student-1',
      taskId: 'task-1',
      classId: 'class-a',
    });

    expect(reservation.submittedAt).toBe('2026-08-17T00:00:01.000Z');
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('attaches and abandons reservations only through raw SQL', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);

    await attachOfficialArenaSubmissionReservation({
      db: { $executeRaw: executeRaw },
      reservationId: 'res-1',
      submissionId: 'sub-1',
    });
    await abandonOfficialArenaSubmissionReservation({
      db: { $executeRaw: executeRaw },
      reservationId: 'res-1',
    });

    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it('treats an earlier pending reservation as the next official successor', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'res-earlier' }]);

    await expect(hasEarlierOfficialSubmitSuccessor({
      db: { $queryRaw: queryRaw },
      userId: 'student-1',
      taskId: 'task-1',
      baselineAt: '2026-08-17T00:00:00.000Z',
      submittedAt: '2026-08-17T00:00:02.000Z',
    })).resolves.toBe(true);
  });
});
