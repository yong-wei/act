import {
  scanAllStudentRisks,
  scanStudentRisks,
  type RiskScanRule,
  type RiskScannerDb,
} from '@/lib/risk-scanner';
import { describe, expect, it, vi } from 'vitest';

function createDb(overrides: Partial<RiskScannerDb> = {}): RiskScannerDb {
  return {
    studentProfile: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    knowledgeProgress: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    studentCompetencySnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    studentRiskFlag: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function rule(
  name: RiskScanRule['name'],
  result: Awaited<ReturnType<RiskScanRule['evaluate']>>,
): RiskScanRule {
  return {
    name,
    evaluate: vi.fn().mockResolvedValue(result),
  };
}

describe('risk scanner', () => {
  it('creates, updates, resolves, and preserves deterministic current risk flags', async () => {
    const now = new Date('2026-07-30T08:00:00.000Z');
    const createDbMock = createDb();
    const next = {
      flagType: 'constraint' as const,
      severity: 'high' as const,
      description: 'constraint detected',
      evidenceJson: { evidenceCutoff: now.toISOString() },
    };

    const created = await scanStudentRisks('student-1', {
      db: createDbMock,
      now,
      rules: [rule('constraint', next)],
    });
    expect(created.flagsCreated).toBe(1);
    expect(createDbMock.studentRiskFlag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'student-1',
        flagType: 'constraint',
        triggeredAt: now,
        evidenceObservedAt: now,
      }),
    });

    const existing = {
      id: 'flag-1',
      severity: 'medium',
      description: 'old',
      evidenceJson: {},
    };
    const updateDbMock = createDb({
      studentRiskFlag: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const updated = await scanStudentRisks('student-1', {
      db: updateDbMock,
      now,
      rules: [rule('constraint', next)],
    });
    expect(updated.flagsUpdated).toBe(1);
    expect(updateDbMock.studentRiskFlag.update).toHaveBeenCalledWith({
      where: { id: 'flag-1' },
      data: expect.objectContaining({
        evidenceObservedAt: now,
      }),
    });

    const resolveDbMock = createDb({
      studentRiskFlag: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const resolved = await scanStudentRisks('student-1', {
      db: resolveDbMock,
      now,
      rules: [rule('constraint', null)],
    });
    expect(resolved.flagsResolved).toBe(1);
    expect(resolveDbMock.studentRiskFlag.update).toHaveBeenCalledWith({
      where: { id: 'flag-1' },
      data: expect.objectContaining({
        isResolved: true,
        resolvedAt: now,
        resolutionNote: 'deterministic-rule-cleared:constraint',
      }),
    });

    const unchangedDbMock = createDb({
      studentRiskFlag: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'flag-1',
          severity: next.severity,
          description: next.description,
          evidenceJson: next.evidenceJson,
        }),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const unchanged = await scanStudentRisks('student-1', {
      db: unchangedDbMock,
      now,
      rules: [rule('constraint', next)],
    });
    expect(unchanged.unchanged).toBe(1);
    expect(unchangedDbMock.studentRiskFlag.update).not.toHaveBeenCalled();
  });

  it('pages over the student population without revisiting the cursor', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ userId: 'student-1' }, { userId: 'student-2' }])
      .mockResolvedValueOnce([{ userId: 'student-3' }])
      .mockResolvedValueOnce([]);
    const db = createDb({ studentProfile: { findMany } });

    const results = await scanAllStudentRisks({
      db,
      pageSize: 2,
      rules: [rule('stagnation', null)],
    });

    expect(results.map((result) => result.studentId)).toEqual([
      'student-1',
      'student-2',
      'student-3',
    ]);
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      cursor: { userId: 'student-2' },
      skip: 1,
    }));
  });

  it('converges concurrent creates on one active risk flag', async () => {
    const now = new Date('2026-07-30T08:00:00.000Z');
    const next = {
      flagType: 'constraint' as const,
      severity: 'high' as const,
      description: 'constraint detected',
      evidenceJson: { evidenceCutoff: now.toISOString() },
    };
    let activeFlag: {
      id: string;
      severity: string;
      description: string;
      evidenceJson: unknown;
    } | null = null;
    const db = createDb({
      studentRiskFlag: {
        findFirst: vi.fn().mockImplementation(async () => activeFlag),
        create: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
          if (activeFlag) {
            throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
          }
          const data = args.data as typeof next;
          activeFlag = {
            id: 'flag-1',
            severity: data.severity,
            description: data.description,
            evidenceJson: data.evidenceJson,
          };
          return activeFlag;
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    });

    const results = await Promise.all([
      scanStudentRisks('student-1', {
        db,
        now,
        rules: [rule('constraint', next)],
      }),
      scanStudentRisks('student-1', {
        db,
        now,
        rules: [rule('constraint', next)],
      }),
    ]);

    expect(activeFlag).toEqual(expect.objectContaining({
      id: 'flag-1',
      severity: 'high',
    }));
    expect(db.studentRiskFlag.create).toHaveBeenCalledTimes(2);
    expect(results.reduce((total, result) => total + result.flagsCreated, 0)).toBe(1);
    expect(results.reduce((total, result) => total + result.unchanged, 0)).toBe(1);
    expect(results.reduce((total, result) => total + result.failures, 0)).toBe(0);
  });
});
