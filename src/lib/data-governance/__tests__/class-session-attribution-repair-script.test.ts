import { describe, expect, it, vi } from 'vitest';

import {
  parseClassSessionAttributionRepairArgs,
  runClassSessionAttributionRepair,
} from '../../../../scripts/db/backfill-class-session-attribution';

type RepairDatabase = Parameters<typeof runClassSessionAttributionRepair>[0];

function createDatabaseFixture(overrides: {
  session?: {
    id: string;
    teacherId: string;
    classId: string | null;
    status: string;
  } | null;
  targetClass?: {
    id: string;
    teacherId: string;
  } | null;
  updatedCount?: number;
} = {}) {
  const transaction = {
    classSession: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.session === undefined
          ? {
              id: 'session-sensitive-id',
              teacherId: 'teacher-sensitive-id',
              classId: null,
              status: 'FINISHED',
            }
          : overrides.session,
      ),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.updatedCount ?? 1 }),
    },
    class: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.targetClass === undefined
          ? {
              id: 'class-sensitive-id',
              teacherId: 'teacher-sensitive-id',
            }
          : overrides.targetClass,
      ),
    },
  };
  async function transactionRunner<T>(
    operation: (currentTransaction: typeof transaction) => Promise<T>,
  ): Promise<T> {
    return operation(transaction);
  }
  const database: RepairDatabase = {
    $transaction: vi.fn(transactionRunner) as unknown as RepairDatabase['$transaction'],
  };
  return { database, transaction };
}

function expectRepairError(operation: () => unknown, code: string) {
  expect(operation).toThrowError(code);
}

describe('class session attribution repair script', () => {
  it('requires one explicit session and class mapping and defaults to dry-run', () => {
    expect(
      parseClassSessionAttributionRepairArgs([
        '--session-id',
        'session-1',
        '--class-id=class-1',
        '--teacher-id',
        'teacher-1',
      ]),
    ).toEqual({
      sessionId: 'session-1',
      classId: 'class-1',
      teacherId: 'teacher-1',
      apply: false,
    });

    expectRepairError(
      () => parseClassSessionAttributionRepairArgs(['--session-id', 'session-1']),
      'class-session-repair-requires-session-id-and-class-id',
    );
    expectRepairError(
      () => parseClassSessionAttributionRepairArgs([
        '--session-id',
        'session-1',
        '--session-id',
        'session-2',
        '--class-id',
        'class-1',
      ]),
      'duplicate-class-session-repair-argument',
    );
    expectRepairError(
      () => parseClassSessionAttributionRepairArgs([
        '--session-id',
        'session-1',
        '--class-id',
        'class-1',
        '--threshold',
        '0.6',
      ]),
      'unsupported-class-session-repair-argument',
    );
  });

  it('performs a read-only dry-run without exposing raw identifiers', async () => {
    const { database, transaction } = createDatabaseFixture();

    const report = await runClassSessionAttributionRepair(database, {
      sessionId: 'session-sensitive-id',
      classId: 'class-sensitive-id',
      teacherId: null,
      apply: false,
    });

    expect(report).toEqual({
      mode: 'dry-run',
      eligible: 1,
      updated: 0,
      sessionRef: expect.stringMatching(/^[a-f0-9]{12}$/),
      classRef: expect.stringMatching(/^[a-f0-9]{12}$/),
      teacherRef: expect.stringMatching(/^[a-f0-9]{12}$/),
    });
    expect(JSON.stringify(report)).not.toContain('sensitive-id');
    expect(transaction.classSession.updateMany).not.toHaveBeenCalled();
    expect(transaction.classSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-sensitive-id' },
      select: {
        id: true,
        teacherId: true,
        classId: true,
        status: true,
      },
    });
  });

  it('applies one guarded explicit mapping', async () => {
    const { database, transaction } = createDatabaseFixture();

    const report = await runClassSessionAttributionRepair(database, {
      sessionId: 'session-sensitive-id',
      classId: 'class-sensitive-id',
      teacherId: 'teacher-sensitive-id',
      apply: true,
    });

    expect(report.updated).toBe(1);
    expect(transaction.classSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-sensitive-id',
        teacherId: 'teacher-sensitive-id',
        status: 'FINISHED',
        classId: null,
      },
      data: {
        classId: 'class-sensitive-id',
      },
    });
    expect(database.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it.each([
    {
      name: 'missing session',
      overrides: { session: null },
      code: 'class-session-not-found',
    },
    {
      name: 'non-finished session',
      overrides: {
        session: {
          id: 'session-sensitive-id',
          teacherId: 'teacher-sensitive-id',
          classId: null,
          status: 'ACTIVE',
        },
      },
      code: 'class-session-repair-requires-finished-session',
    },
    {
      name: 'already attributed session',
      overrides: {
        session: {
          id: 'session-sensitive-id',
          teacherId: 'teacher-sensitive-id',
          classId: 'existing-class-id',
          status: 'FINISHED',
        },
      },
      code: 'class-session-already-attributed',
    },
    {
      name: 'missing class',
      overrides: { targetClass: null },
      code: 'class-session-repair-class-not-found',
    },
    {
      name: 'cross-teacher class',
      overrides: {
        targetClass: {
          id: 'class-sensitive-id',
          teacherId: 'other-teacher-id',
        },
      },
      code: 'class-session-repair-cross-teacher-rejected',
    },
  ])('rejects $name', async ({ overrides, code }) => {
    const { database, transaction } = createDatabaseFixture(overrides);

    await expect(runClassSessionAttributionRepair(database, {
      sessionId: 'session-sensitive-id',
      classId: 'class-sensitive-id',
      teacherId: null,
      apply: true,
    })).rejects.toMatchObject({ code });
    expect(transaction.classSession.updateMany).not.toHaveBeenCalled();
  });

  it('uses the optional teacher id as a consistency filter', async () => {
    const { database, transaction } = createDatabaseFixture();

    await expect(runClassSessionAttributionRepair(database, {
      sessionId: 'session-sensitive-id',
      classId: 'class-sensitive-id',
      teacherId: 'other-teacher-id',
      apply: true,
    })).rejects.toMatchObject({
      code: 'class-session-teacher-filter-mismatch',
    });
    expect(transaction.class.findUnique).not.toHaveBeenCalled();
    expect(transaction.classSession.updateMany).not.toHaveBeenCalled();
  });

  it('fails closed if the guarded update loses a race', async () => {
    const { database } = createDatabaseFixture({ updatedCount: 0 });

    await expect(runClassSessionAttributionRepair(database, {
      sessionId: 'session-sensitive-id',
      classId: 'class-sensitive-id',
      teacherId: null,
      apply: true,
    })).rejects.toMatchObject({
      code: 'class-session-repair-write-conflict',
    });
  });
});
