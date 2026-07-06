import { describe, expect, it, vi } from 'vitest';

import {
  applyYangFanDiagnosticFixture,
  buildYangFanDiagnosticFixturePlan,
  resetYangFanDiagnosticFixture,
  YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX,
  YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
  type YangFanDiagnosticFixtureDb,
} from '../yangfan-diagnostic-fixture';

function passedReadinessSummary() {
  return {
    status: 'passed',
    findings: [],
    resourceCoverage: {
      yangFanFixtureBlockers: { blocked: false, blockerCount: 0 },
    },
  };
}

function blockedReadinessSummary() {
  return {
    status: 'failed',
    findings: [{ id: 'yang-fan-fixture-blockers', severity: 'blocking' }],
    resourceCoverage: {
      yangFanFixtureBlockers: { blocked: true, blockerCount: 2 },
    },
  };
}

function createDb(overrides: Partial<YangFanDiagnosticFixtureDb> = {}): YangFanDiagnosticFixtureDb {
  const canonical = {
    id: 'user-canonical',
    name: 'Yang Fan',
    email: 'yangfan@example.test',
    profile: { studentNumber: '20230010102605' },
  };
  const duplicate = {
    id: 'user-duplicate',
    name: 'Yang Fan',
    email: null,
    profile: null,
  };
  const db: YangFanDiagnosticFixtureDb = {
    user: {
      findMany: vi.fn(async () => [canonical, duplicate]),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    learningFact: {
      findMany: vi.fn(async (args: Record<string, any>) => (
        args?.where?.userId === 'user-duplicate' ? [] : []
      )),
      createMany: vi.fn(async () => ({ count: 4 })),
      deleteMany: vi.fn(async () => ({ count: 4 })),
    },
    knowledgeNode: {
      findMany: vi.fn(async () => [{ id: 'kn-1' }, { id: 'kn-2' }, { id: 'kn-3' }]),
    },
    knowledgeProgress: {
      createMany: vi.fn(async () => ({ count: 3 })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => []),
    },
    learningPath: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => []),
    },
    learningPathExecution: {
      createMany: vi.fn(async () => ({ count: 2 })),
      deleteMany: vi.fn(async () => ({ count: 2 })),
      findMany: vi.fn(async () => []),
    },
    learningPathDeviation: {
      createMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => []),
    },
    learningPathIntervention: {
      createMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => []),
    },
    studentCompetencySnapshot: {
      create: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    studentProfileSummary: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    studentEvidenceFeatureCache: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    adaptiveAssessmentAlgorithmVersion: { upsert: vi.fn(async () => ({})) },
    adaptiveAssessmentSession: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    adaptiveAssessmentItemRef: { upsert: vi.fn(async () => ({})) },
    adaptiveAssessmentAnswer: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    adaptiveAssessmentAbilityEstimate: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    adaptiveMasteryUpdate: {
      createMany: vi.fn(async () => ({ count: 1 })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    $transaction: vi.fn(async (fn) => fn(db)),
    ...overrides,
  };
  return db;
}

function createDbWithoutDuplicate(overrides: Partial<YangFanDiagnosticFixtureDb> = {}): YangFanDiagnosticFixtureDb {
  const db = createDb(overrides);
  db.user.findMany = vi.fn(async () => [{
    id: 'user-canonical',
    name: 'Yang Fan',
    email: 'yangfan@example.test',
    profile: { studentNumber: '20230010102605' },
  }]);
  return db;
}

describe('Yang Fan diagnostic fixture', () => {
  it('defaults to dry-run and blocks when readiness summary still has blockers', async () => {
    const db = createDb();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      readinessSummary: blockedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.mode).toBe('dry-run');
    expect(plan.canApply).toBe(false);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      'yang-fan-fixture-blockers',
      'readiness-summary-not-passed',
    ]));
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('requires explicit apply confirmation and a fixture-safe database', async () => {
    const db = createDb();
    const productionPlan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      nodeEnv: 'production',
      databaseUrl: 'postgres://prod.example/act',
    });

    expect(productionPlan.canApply).toBe(false);
    expect(productionPlan.blockers).toEqual(expect.arrayContaining([
      'production-like-environment',
      'fixture-database-not-allowlisted',
    ]));

    const missingConfirmation = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });
    expect(missingConfirmation.blockers).toContain('explicit-apply-confirmation-missing');
  });

  it('redacts direct identifiers in plan output', async () => {
    const db = createDb();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });
    const rendered = JSON.stringify(plan);

    expect(rendered).not.toContain('user-canonical');
    expect(rendered).not.toContain('user-duplicate');
    expect(rendered).not.toContain('Yang Fan');
    expect(rendered).not.toContain('yangfan@example.test');
    expect(rendered).not.toContain('20230010102605');
    expect(plan.canonical?.maskedUserId).toMatch(/^sha256:/);
    expect(plan.privacy.rawIdentifiersIncluded).toBe(false);
  });

  it('queries the canonical profile with Prisma one-to-one relation filters', async () => {
    const db = createDb();
    await buildYangFanDiagnosticFixturePlan(db, {
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { profile: { is: { studentNumber: '20230010102605' } } },
        ]),
      }),
    }));
  });

  it('blocks unsafe duplicate accounts before apply', async () => {
    const db = createDb({
      learningFact: {
        findMany: vi.fn(async (args: Record<string, any>) => (
          args?.where?.userId === 'user-duplicate'
            ? [{ sourceEventId: 'real-event' }]
            : []
        )),
        createMany: vi.fn(async () => ({ count: 0 })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    });
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.canApply).toBe(false);
    expect(plan.duplicateDisposition).toBe('blocked-unsafe');
    expect(plan.blockers).toContain('duplicate-yangfan-account-has-unsafe-records');
  });

  it('blocks duplicate deletion when no-email account has real user-scoped rows', async () => {
    const db = createDb({
      userAnswer: {
        findMany: vi.fn(async () => [{ id: 'answer-1' }]),
      },
    });
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.canApply).toBe(false);
    expect(plan.duplicateDisposition).toBe('blocked-unsafe');
    expect(plan.blockers).toContain('duplicate-yangfan-account-has-unsafe-records');
    expect(db.user.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks duplicate deletion when no-email account has a student profile', async () => {
    const db = createDb({
      user: {
        findMany: vi.fn(async () => [
          {
            id: 'user-canonical',
            name: 'Yang Fan',
            email: 'yangfan@example.test',
            profile: { studentNumber: '20230010102605' },
          },
          {
            id: 'user-duplicate',
            name: 'Yang Fan',
            email: null,
            profile: { studentNumber: null },
          },
        ]),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
    });
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.canApply).toBe(false);
    expect(plan.duplicateDisposition).toBe('blocked-unsafe');
    expect(plan.blockers).toContain('duplicate-yangfan-account-has-unsafe-records');
    expect(db.user.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks canonical KnowledgeProgress even when values match fixture defaults', async () => {
    const db = createDbWithoutDuplicate({
      knowledgeProgress: {
        createMany: vi.fn(async () => ({ count: 0 })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => [{
          id: 'real-progress-same-values',
          status: 'IN_PROGRESS',
          progress: 68,
          timeSpent: 1800,
        }]),
      },
    });
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.canApply).toBe(false);
    expect(plan.blockers).toContain('canonical-knowledge-progress-already-exists');
    expect(db.knowledgeProgress?.createMany).not.toHaveBeenCalled();
  });

  it('applies fixture records through governed tables without writing ArenaSubmission', async () => {
    const db = createDbWithoutDuplicate();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
      now: new Date('2026-07-06T08:00:00.000Z'),
    });

    const result = await applyYangFanDiagnosticFixture(db, plan, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
      now: new Date('2026-07-06T08:00:00.000Z'),
    });

    expect(result.arenaBoundary.officialArenaWrites).toBe(0);
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          sourceEventId: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:arena-preview`,
          contextJson: expect.objectContaining({
            fixture: expect.objectContaining({
              scope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION,
              ordinaryMetricsExcluded: true,
            }),
            arena: expect.objectContaining({
              official: false,
              preview: true,
              scoreAuthority: 'fixture-auxiliary-learning-context',
            }),
          }),
        }),
      ]),
    }));
    expect(db.knowledgeProgress?.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^yangfan-diagnostic-fixture:knowledge-progress:/),
        }),
      ]),
    }));
    expect(db.learningPathExecution?.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          evidenceRefs: expect.arrayContaining([
            expect.objectContaining({ fixtureScope: YANGFAN_DIAGNOSTIC_FIXTURE_VERSION }),
          ]),
        }),
      ]),
    }));
    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalled();
    expect((db as any).arenaSubmission).toBeUndefined();
  });

  it('resets only fixture-scoped rows without deleting duplicate accounts', async () => {
    const db = createDbWithoutDuplicate();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'reset',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    await resetYangFanDiagnosticFixture(db, plan, {
      mode: 'reset',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(db.learningFact.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ sourceEventId: { startsWith: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:` } }),
        ]),
      }),
    }));
    expect(db.user.deleteMany).not.toHaveBeenCalled();
  });

  it('allows reset when canonical KnowledgeProgress rows exist', async () => {
    const db = createDbWithoutDuplicate({
      knowledgeProgress: {
        createMany: vi.fn(async () => ({ count: 0 })),
        deleteMany: vi.fn(async () => ({ count: 3 })),
        findMany: vi.fn(async () => [{
          id: 'fixture-progress',
          status: 'IN_PROGRESS',
          progress: 68,
          timeSpent: 1800,
        }]),
      },
    });
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'reset',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.blockers).not.toContain('canonical-knowledge-progress-already-exists');

    await resetYangFanDiagnosticFixture(db, plan, {
      mode: 'reset',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(db.knowledgeProgress?.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-canonical',
        id: { startsWith: 'yangfan-diagnostic-fixture:knowledge-progress:' },
      },
    });
  });

  it('requires explicit confirmation before reset writes', async () => {
    const db = createDb();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'reset',
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    await expect(resetYangFanDiagnosticFixture(db, plan, {
      mode: 'reset',
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    })).rejects.toThrow('Cannot reset Yang Fan diagnostic fixture');
    expect(db.learningFact.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects dry-run plans passed to reset', async () => {
    const db = createDbWithoutDuplicate();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    await expect(resetYangFanDiagnosticFixture(db, plan, {
      mode: 'reset',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    })).rejects.toThrow('with a dry-run plan');
    expect(db.learningFact.deleteMany).not.toHaveBeenCalled();
  });
});
