import { describe, expect, it, vi } from 'vitest';

import {
  abandonOfficialArenaSubmissionReservation,
  attachOfficialArenaSubmissionReservation,
  hasEarlierLivePendingOfficialReservation,
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
      acquireLease: false,
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
    const queryRaw = vi.fn().mockResolvedValue([{
      id: 'res-earlier',
      submissionId: null,
      lockedUntil: new Date(Date.now() + 30_000),
    }]);

    await expect(hasEarlierOfficialSubmitSuccessor({
      db: { $queryRaw: queryRaw },
      userId: 'student-1',
      taskId: 'task-1',
      baselineAt: '2026-08-17T00:00:00.000Z',
      submittedAt: '2026-08-17T00:00:02.000Z',
    })).resolves.toBe(true);
  });

  it('expires a pending reservation whose lease is no longer locked', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{
      id: 'res-stale',
      submissionId: null,
      lockedUntil: new Date('2000-01-01T00:00:00.000Z'),
    }]);
    const executeRaw = vi.fn().mockResolvedValue(1);

    await expect(hasEarlierOfficialSubmitSuccessor({
      db: { $queryRaw: queryRaw, $executeRaw: executeRaw },
      userId: 'student-1',
      taskId: 'task-1',
      baselineAt: '2026-08-17T00:00:00.000Z',
      submittedAt: '2026-08-17T00:00:02.000Z',
    })).resolves.toBe(false);
    expect(executeRaw).toHaveBeenCalled();
  });

  it('keeps a reservation live when an overlapping heartbeat prevents cleanup', async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{
        id: 'res-renewed',
        submissionId: null,
        lockedUntil: new Date('2000-01-01T00:00:00.000Z'),
      }])
      .mockResolvedValueOnce([{ id: 'res-renewed' }]);
    const executeRaw = vi.fn().mockResolvedValue(0);

    await expect(hasEarlierOfficialSubmitSuccessor({
      db: { $queryRaw: queryRaw, $executeRaw: executeRaw },
      userId: 'student-1',
      taskId: 'task-1',
      baselineAt: '2026-08-17T00:00:00.000Z',
      submittedAt: '2026-08-17T00:00:02.000Z',
    })).resolves.toBe(true);
  });

  it('does not treat an already persisted earlier reservation as an in-flight wait', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{
      id: 'res-bound',
      submissionId: 'submission-earlier',
      lockedUntil: new Date(Date.now() + 30_000),
    }]);

    await expect(hasEarlierLivePendingOfficialReservation({
      db: { $queryRaw: queryRaw },
      userId: 'student-1',
      taskId: 'task-1',
      baselineAt: '2026-08-17T00:00:00.000Z',
      submittedAt: '2026-08-17T00:00:02.000Z',
    })).resolves.toBe(false);
    await expect(hasEarlierOfficialSubmitSuccessor({
      db: { $queryRaw: queryRaw },
      userId: 'student-1',
      taskId: 'task-1',
      baselineAt: '2026-08-17T00:00:00.000Z',
      submittedAt: '2026-08-17T00:00:02.000Z',
    })).resolves.toBe(true);
  });

  it('lets the next submission claim after a concurrent abandon removed the stale reservation', async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{
        id: 'res-abandoned',
        submissionId: null,
        lockedUntil: new Date('2000-01-01T00:00:00.000Z'),
      }])
      .mockResolvedValueOnce([]);
    const executeRaw = vi.fn().mockResolvedValue(0);

    await expect(hasEarlierOfficialSubmitSuccessor({
      db: { $queryRaw: queryRaw, $executeRaw: executeRaw },
      userId: 'student-1',
      taskId: 'task-1',
      baselineAt: '2026-08-17T00:00:00.000Z',
      submittedAt: '2026-08-17T00:00:02.000Z',
    })).resolves.toBe(false);
  });
});
