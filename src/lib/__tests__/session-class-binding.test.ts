import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  createClassBoundSession,
  SessionClassBindingError,
} from '../session-class-binding';

function database(classData: { id: string; teacherId: string; isActive: boolean } | null) {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    class: { findUnique: vi.fn().mockResolvedValue(classData) },
  };
  return {
    $transaction: vi.fn(async (operation) => operation(tx)),
    tx,
  };
}

describe('class-bound session creation', () => {
  it('validates an owned active class in the same serializable transaction as creation', async () => {
    const db = database({ id: 'class-1', teacherId: 'teacher-1', isActive: true });
    const create = vi.fn().mockResolvedValue({ id: 'session-1' });

    await expect(createClassBoundSession(db as never, {
      actorId: 'teacher-1',
      actorRole: UserRole.TEACHER,
      classId: 'class-1',
      create,
    })).resolves.toEqual({ id: 'session-1' });
    expect(db.tx.class.findUnique).toHaveBeenCalledWith({
      where: { id: 'class-1' },
      select: { id: true, teacherId: true, isActive: true },
    });
    expect(create).toHaveBeenCalledWith(db.tx);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('rejects a foreign teacher class before attempting creation', async () => {
    const db = database({ id: 'class-1', teacherId: 'teacher-2', isActive: true });
    const create = vi.fn();

    await expect(createClassBoundSession(db as never, {
      actorId: 'teacher-1',
      actorRole: UserRole.TEACHER,
      classId: 'class-1',
      create,
    })).rejects.toThrowError(new SessionClassBindingError('class-not-owned'));
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an inactive class for both teachers and administrators', async () => {
    const db = database({ id: 'class-1', teacherId: 'teacher-2', isActive: false });
    const create = vi.fn();

    await expect(createClassBoundSession(db as never, {
      actorId: 'admin-1',
      actorRole: UserRole.ADMIN,
      classId: 'class-1',
      create,
    })).rejects.toThrowError(new SessionClassBindingError('class-not-active'));
    expect(create).not.toHaveBeenCalled();
  });

  it('retries a serializable race before creating a class-bound session', async () => {
    const retryable = Object.assign(new Error('serialization failure'), { code: 'P2034' });
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      class: { findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1', isActive: true }) },
    };
    const db = {
      $transaction: vi.fn()
        .mockRejectedValueOnce(retryable)
        .mockImplementationOnce(async (operation) => operation(tx)),
    };
    const create = vi.fn().mockResolvedValue({ id: 'session-1' });

    await expect(createClassBoundSession(db as never, {
      actorId: 'teacher-1',
      actorRole: UserRole.TEACHER,
      classId: 'class-1',
      create,
    })).resolves.toEqual({ id: 'session-1' });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });
});
