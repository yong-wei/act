import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createTeacherDefaultClassService } from '../teacher-default-class-service';

const teacher = { id: 'teacher-1' };
const activeClass = {
  id: 'class-1',
  teacherId: teacher.id,
  name: '控制 1 班',
  code: 'ABC123',
  description: null,
  year: null,
  semester: null,
  isActive: true,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T00:00:00Z'),
};

describe('teacher default class persistence', () => {
  it('adds the preference without data rewrites or changes to ClassSession attribution', () => {
    const migration = readFileSync(join(
      process.cwd(),
      'prisma/migrations/20260724090000_add_teacher_default_class/migration.sql',
    ), 'utf8');
    expect(migration).toContain('ADD COLUMN "defaultTeachingClassId" TEXT');
    expect(migration).toContain('CREATE UNIQUE INDEX "User_defaultTeachingClassId_key"');
    expect(migration).toContain('ON DELETE SET NULL ON UPDATE CASCADE');
    expect(migration).not.toContain('"ClassSession"');
    expect(migration).not.toMatch(/^\s*(UPDATE|DELETE FROM)\b/im);
  });
});

describe('teacher default class service', () => {
  it('uses Serializable and makes the first created class the default', async () => {
    const tx = transaction({
      user: {
        findFirst: vi.fn().mockResolvedValue(teacher),
        findUnique: vi.fn().mockResolvedValue({ defaultTeachingClassId: null }),
        update: vi.fn().mockResolvedValue(teacher),
      },
      class: {
        create: vi.fn().mockResolvedValue(activeClass),
        findFirst: vi.fn(),
      },
    });
    const db = database(tx);

    const result = await createTeacherDefaultClassService(db as never).createClass({
      teacherId: teacher.id,
      name: activeClass.name,
      code: activeClass.code,
    });

    expect(result).toEqual(activeClass);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: teacher.id },
      data: { defaultTeachingClassId: activeClass.id },
    });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('preserves an existing valid default when another class is created or reactivated', async () => {
    const existingDefault = { ...activeClass, id: 'class-default' };
    const candidate = { ...activeClass, id: 'class-new', code: 'NEW123' };
    const tx = transaction({
      user: {
        findFirst: vi.fn().mockResolvedValue(teacher),
        findUnique: vi.fn().mockResolvedValue({ defaultTeachingClassId: existingDefault.id }),
        update: vi.fn(),
      },
      class: {
        create: vi.fn().mockResolvedValue(candidate),
        findFirst: vi.fn().mockResolvedValue(existingDefault),
        update: vi.fn().mockResolvedValue(candidate),
      },
    });
    const service = createTeacherDefaultClassService(database(tx) as never);

    await service.createClass({
      teacherId: teacher.id,
      name: candidate.name,
      code: candidate.code,
    });
    await service.activateClass(teacher.id, candidate.id);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects inactive explicit defaults without changing the preference', async () => {
    const tx = transaction({
      user: {
        findFirst: vi.fn().mockResolvedValue(teacher),
        update: vi.fn(),
      },
      class: {
        findFirst: vi.fn().mockResolvedValue({ ...activeClass, isActive: false }),
      },
    });

    await expect(
      createTeacherDefaultClassService(database(tx) as never)
        .setDefaultClass(teacher.id, activeClass.id),
    ).rejects.toMatchObject({ code: 'class-not-active' });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('replaces a deactivated default by newest createdAt then id', async () => {
    const replacement = { id: 'class-z' };
    const findFirst = vi.fn()
      .mockResolvedValueOnce(activeClass)
      .mockResolvedValueOnce(replacement);
    const tx = transaction({
      user: {
        findFirst: vi.fn().mockResolvedValue(teacher),
        findUnique: vi.fn().mockResolvedValue({ defaultTeachingClassId: activeClass.id }),
        update: vi.fn().mockResolvedValue(teacher),
      },
      class: {
        findFirst,
        update: vi.fn().mockResolvedValue({ ...activeClass, isActive: false }),
      },
    });

    await createTeacherDefaultClassService(database(tx) as never)
      .deactivateClass(teacher.id, activeClass.id);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenLastCalledWith({
      where: { teacherId: teacher.id, isActive: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: teacher.id },
      data: { defaultTeachingClassId: replacement.id },
    });
  });

  it('deletes student membership and replaces a deleted default in one transaction', async () => {
    const replacement = { id: 'class-2' };
    const tx = transaction({
      user: {
        findFirst: vi.fn().mockResolvedValue(teacher),
        findUnique: vi.fn()
          .mockResolvedValueOnce({ defaultTeachingClassId: activeClass.id })
          .mockResolvedValueOnce({ defaultTeachingClassId: null }),
        update: vi.fn().mockResolvedValue(teacher),
      },
      class: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(activeClass)
          .mockResolvedValueOnce(replacement),
        delete: vi.fn().mockResolvedValue(activeClass),
      },
      classSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfile: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    });

    await createTeacherDefaultClassService(database(tx) as never)
      .deleteClass(teacher.id, activeClass.id);

    expect(tx.studentProfile.updateMany).toHaveBeenCalledWith({
      where: { classId: activeClass.id },
      data: { classId: null },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: teacher.id },
      data: { defaultTeachingClassId: replacement.id },
    });
  });

  it('rejects deletion when any session references the class without changing membership or default', async () => {
    const userUpdate = vi.fn();
    const studentUpdate = vi.fn();
    const classDelete = vi.fn();
    const tx = transaction({
      user: {
        findFirst: vi.fn().mockResolvedValue(teacher),
        findUnique: vi.fn(),
        update: userUpdate,
      },
      class: {
        findFirst: vi.fn().mockResolvedValue(activeClass),
        delete: classDelete,
      },
      classSession: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-1' }),
      },
      studentProfile: {
        updateMany: studentUpdate,
      },
    });

    await expect(
      createTeacherDefaultClassService(database(tx) as never)
        .deleteClass(teacher.id, activeClass.id),
    ).rejects.toMatchObject({ code: 'class-has-sessions' });

    expect(studentUpdate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(classDelete).not.toHaveBeenCalled();
  });

  it('maps a foreign-key delete conflict to the stable deletion error', async () => {
    const foreignKeyConflict = Object.assign(new Error('foreign key'), { code: 'P2003' });
    const tx = transaction({
      user: {
        findFirst: vi.fn().mockResolvedValue(teacher),
        findUnique: vi.fn().mockResolvedValue({ defaultTeachingClassId: null }),
        update: vi.fn(),
      },
      class: {
        findFirst: vi.fn().mockResolvedValue(activeClass),
        delete: vi.fn().mockRejectedValue(foreignKeyConflict),
      },
      classSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfile: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(
      createTeacherDefaultClassService(database(tx) as never)
        .deleteClass(teacher.id, activeClass.id),
    ).rejects.toMatchObject({ code: 'class-has-sessions' });
  });

  it('retries P2034 conflicts within the configured bound and surfaces a stable error', async () => {
    const tx = transaction({
      user: {
        findFirst: vi.fn().mockResolvedValue(teacher),
        update: vi.fn().mockResolvedValue(teacher),
      },
      class: { findFirst: vi.fn().mockResolvedValue(activeClass) },
    });
    const db = {
      $transaction: vi.fn().mockRejectedValue(Object.assign(new Error('conflict'), { code: 'P2034' })),
    };

    await expect(
      createTeacherDefaultClassService(db as never, 3)
        .setDefaultClass(teacher.id, activeClass.id),
    ).rejects.toMatchObject({ code: 'transaction-conflict-retryable' });
    expect(db.$transaction).toHaveBeenCalledTimes(3);

    const eventualDb = {
      $transaction: vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 'P2034' }))
        .mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    await expect(
      createTeacherDefaultClassService(eventualDb as never, 3)
        .setDefaultClass(teacher.id, activeClass.id),
    ).resolves.toEqual(activeClass);
    expect(eventualDb.$transaction).toHaveBeenCalledTimes(2);
  });
});

function transaction(overrides: Record<string, unknown>) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(0),
    user: {},
    class: {},
    classSession: {},
    studentProfile: {},
    ...overrides,
  } as any;
}

function database(tx: ReturnType<typeof transaction>) {
  return {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
}
