import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import {
  DefaultClassReconciliationError,
  parseDefaultClassReconciliationArgs,
  reconcileTeacherDefaultClasses,
} from '../../../scripts/db/reconcile-teacher-default-classes';

const cleanInvariant = [{
  invalidDefaultCount: BigInt(0),
  missingDefaultCount: BigInt(0),
  defaultWithoutActiveClassCount: BigInt(0),
  duplicateDefaultCount: BigInt(0),
}];

function database({
  queryResults,
  updateCount = 0,
}: {
  queryResults: unknown[];
  updateCount?: number;
}) {
  const tx = {
    $executeRaw: vi.fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValue(updateCount),
    $queryRaw: vi.fn()
      .mockImplementation(async () => queryResults.shift()),
    platformSetting: { upsert: vi.fn().mockResolvedValue({}) },
  };
  return {
    $transaction: vi.fn(async (operation) => operation(tx)),
    tx,
  };
}

describe('teacher default class reconciliation', () => {
  it('defaults to dry-run and requires an explicit drained-writer acknowledgement to apply', () => {
    expect(parseDefaultClassReconciliationArgs([])).toEqual({
      mode: 'dry-run',
      writerDrained: false,
      enableTeacherClassBinding: false,
      producerInventoryVerified: false,
    });
    expect(() => parseDefaultClassReconciliationArgs(['--apply'])).toThrowError(
      new DefaultClassReconciliationError('apply-requires-writer-drained'),
    );
    expect(parseDefaultClassReconciliationArgs(['--apply', '--writer-drained'])).toEqual({
      mode: 'apply',
      writerDrained: true,
      enableTeacherClassBinding: false,
      producerInventoryVerified: false,
    });
    expect(() => parseDefaultClassReconciliationArgs(['--dry-run', '--verify'])).toThrowError(
      new DefaultClassReconciliationError('reconciliation-mode-must-be-exclusive'),
    );
  });

  it('plans only changed defaults without writing in dry-run mode', async () => {
    const db = database({
      queryResults: [
        cleanInvariant,
        [
          { userId: 'teacher-1', currentDefaultClassId: null, desiredDefaultClassId: 'class-newest' },
          { userId: 'teacher-2', currentDefaultClassId: 'class-current', desiredDefaultClassId: 'class-current' },
          { userId: 'admin-1', currentDefaultClassId: 'class-old', desiredDefaultClassId: null },
        ],
      ],
    });

    await expect(reconcileTeacherDefaultClasses(db as never, {
      mode: 'dry-run',
      writerDrained: false,
    })).resolves.toEqual({
      mode: 'dry-run',
      changedDefaultCount: 2,
      assignedDefaultCount: 1,
      clearedDefaultCount: 1,
      invariant: {
        invalidDefaultCount: 0,
        missingDefaultCount: 0,
        defaultWithoutActiveClassCount: 0,
        duplicateDefaultCount: 0,
      },
      teacherClassBindingEnabled: false,
    });
    expect(db.tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('accepts safe non-negative Prisma Decimal invariant counts', async () => {
    const db = database({
      queryResults: [
        [{
          invalidDefaultCount: new Prisma.Decimal(0),
          missingDefaultCount: new Prisma.Decimal(0),
          defaultWithoutActiveClassCount: new Prisma.Decimal(0),
          duplicateDefaultCount: new Prisma.Decimal(0),
        }],
        [],
      ],
    });

    await expect(reconcileTeacherDefaultClasses(db as never, {
      mode: 'dry-run',
      writerDrained: false,
    })).resolves.toMatchObject({
      invariant: {
        invalidDefaultCount: 0,
        missingDefaultCount: 0,
        defaultWithoutActiveClassCount: 0,
        duplicateDefaultCount: 0,
      },
    });
  });

  it.each([
    new Prisma.Decimal('-1'),
    new Prisma.Decimal('0.5'),
    new Prisma.Decimal('9007199254740992'),
  ])('rejects unsafe Prisma Decimal invariant count %s', async (invalidCount) => {
    const db = database({
      queryResults: [[{
        ...cleanInvariant[0],
        duplicateDefaultCount: invalidCount,
      }]],
    });

    await expect(reconcileTeacherDefaultClasses(db as never, {
      mode: 'verify',
      writerDrained: false,
    })).rejects.toThrowError(new DefaultClassReconciliationError('invalid-invariant-count'));
  });

  it('applies the idempotent plan and verifies the zero-violation gate in one transaction', async () => {
    const db = database({
      updateCount: 2,
      queryResults: [
        [{ ...cleanInvariant[0], missingDefaultCount: BigInt(1) }],
        [
          { userId: 'teacher-1', currentDefaultClassId: null, desiredDefaultClassId: 'class-newest' },
          { userId: 'teacher-2', currentDefaultClassId: 'class-inactive', desiredDefaultClassId: 'class-replacement' },
        ],
        cleanInvariant,
      ],
    });

    await expect(reconcileTeacherDefaultClasses(db as never, {
      mode: 'apply',
      writerDrained: true,
    })).resolves.toMatchObject({
      mode: 'apply',
      changedDefaultCount: 2,
      assignedDefaultCount: 2,
      clearedDefaultCount: 0,
      invariant: {
        invalidDefaultCount: 0,
        missingDefaultCount: 0,
        defaultWithoutActiveClassCount: 0,
        duplicateDefaultCount: 0,
      },
    });
    expect(db.tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('fails the invariant gate without attempting a write', async () => {
    const db = database({
      queryResults: [[{ ...cleanInvariant[0], invalidDefaultCount: BigInt(1) }]],
    });

    await expect(reconcileTeacherDefaultClasses(db as never, {
      mode: 'verify',
      writerDrained: false,
    })).rejects.toThrowError(new DefaultClassReconciliationError('default-class-invariant-violation'));
    expect(db.tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('retries a serializable write conflict before evaluating the reconciliation plan', async () => {
    const retryable = Object.assign(new Error('serialization failure'), { code: 'P2034' });
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn()
        .mockResolvedValueOnce(cleanInvariant)
        .mockResolvedValueOnce([]),
    };
    const db = {
      $transaction: vi.fn()
        .mockRejectedValueOnce(retryable)
        .mockImplementationOnce(async (operation) => operation(tx)),
    };

    await expect(reconcileTeacherDefaultClasses(db as never, {
      mode: 'dry-run',
      writerDrained: false,
    })).resolves.toMatchObject({
      changedDefaultCount: 0,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it('records both gate receipts before enabling mandatory teacher class binding', async () => {
    const db = database({
      updateCount: 0,
      queryResults: [cleanInvariant, [], cleanInvariant],
    });
    await expect(reconcileTeacherDefaultClasses(db as never, {
      mode: 'apply',
      writerDrained: true,
      enableTeacherClassBinding: true,
      producerInventoryVerified: true,
    }, 3, () => new Date('2026-07-24T00:00:00.000Z'))).resolves.toMatchObject({
      teacherClassBindingEnabled: true,
    });
    expect(db.tx.platformSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'teacher_class_binding_enforcement' },
      create: expect.objectContaining({
        value: {
          version: 1,
          enabled: true,
          invariantVerifiedAt: '2026-07-24T00:00:00.000Z',
          producerInventoryVerifiedAt: '2026-07-24T00:00:00.000Z',
        },
      }),
    }));
  });
});
