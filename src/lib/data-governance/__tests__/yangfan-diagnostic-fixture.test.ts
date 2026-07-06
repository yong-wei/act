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

function globallyBlockedButFixtureReadySummary() {
  return {
    status: 'failed',
    findings: [{ id: 'unrelated-global-resource-blocker', severity: 'blocking' }],
    resourceCoverage: {
      yangFanFixtureBlockers: { blocked: false, blockerCount: 0 },
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
      findMany: vi.fn(async () => [
        { id: '性能指标_1_1' },
        { id: '根轨迹_1_1' },
        { id: '传统设计四联图校正_4_47004' },
      ]),
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
    ]));
    expect(plan.blockers).not.toContain('readiness-summary-not-passed');
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('does not block scoped fixture writes on unrelated global readiness failures', async () => {
    const db = createDbWithoutDuplicate();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      readinessSummary: globallyBlockedButFixtureReadySummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.blockers).not.toContain('readiness-summary-not-passed');
    expect(plan.blockers).not.toContain('unrelated-global-resource-blocker');
    expect(plan.blockers).not.toContain('yang-fan-fixture-blockers');
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

  it('does not treat production-like database name substrings as fixture-safe', async () => {
    const db = createDbWithoutDuplicate();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://staging-db/latest',
    });

    expect(plan.canApply).toBe(false);
    expect(plan.safety.databaseAllowed).toBe(false);
    expect(plan.blockers).toContain('fixture-database-not-allowlisted');
  });

  it('rechecks apply safety gates before writing with a reused plan', async () => {
    const db = createDbWithoutDuplicate();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.canApply).toBe(true);
    await expect(applyYangFanDiagnosticFixture(db, plan, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://staging-db/latest',
    })).rejects.toThrow('fixture-database-not-allowlisted');
    expect(db.learningFact.deleteMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('rechecks readiness gates before writing with a reused plan', async () => {
    const db = createDbWithoutDuplicate();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.canApply).toBe(true);
    await expect(applyYangFanDiagnosticFixture(db, plan, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: blockedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    })).rejects.toThrow('yang-fan-fixture-blockers');
    expect(db.learningFact.deleteMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
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

  it('selects only scoped control-correction fixture knowledge nodes', async () => {
    const db = createDbWithoutDuplicate();
    await buildYangFanDiagnosticFixturePlan(db, {
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(db.knowledgeNode?.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: {
          in: [
            '性能指标_1_1',
            '根轨迹_1_1',
            '传统设计四联图校正_4_47004',
          ],
        },
        isActive: true,
      },
    }));
  });

  it('blocks apply when required fixture knowledge nodes are missing', async () => {
    const db = createDbWithoutDuplicate({
      knowledgeNode: {
        findMany: vi.fn(async () => [{ id: '性能指标_1_1' }]),
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
    expect(plan.blockers).toContain('fixture-knowledge-nodes-missing');
    expect(plan.plannedCounts.KnowledgeProgress).toBe(1);
    await expect(applyYangFanDiagnosticFixture(db, plan, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    })).rejects.toThrow('fixture-knowledge-nodes-missing');
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
    expect(db.knowledgeProgress?.createMany).not.toHaveBeenCalled();
  });

  it('rechecks fixture knowledge nodes before applying a reused plan', async () => {
    let knowledgeNodeReadCount = 0;
    const db = createDbWithoutDuplicate({
      knowledgeNode: {
        findMany: vi.fn(async () => {
          knowledgeNodeReadCount += 1;
          return knowledgeNodeReadCount === 1
            ? [
                { id: '性能指标_1_1' },
                { id: '根轨迹_1_1' },
                { id: '传统设计四联图校正_4_47004' },
              ]
            : [];
        }),
      },
    });
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.canApply).toBe(true);
    await expect(applyYangFanDiagnosticFixture(db, plan, {
      mode: 'apply',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    })).rejects.toThrow('fixture-knowledge-nodes-missing');
    expect(db.learningFact.deleteMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
    expect(db.knowledgeProgress?.deleteMany).not.toHaveBeenCalled();
    expect(db.knowledgeProgress?.createMany).not.toHaveBeenCalled();
    expect(db.learningPath?.upsert).not.toHaveBeenCalled();
    expect(db.learningPath?.deleteMany).not.toHaveBeenCalled();
    expect(db.learningPathExecution?.deleteMany).not.toHaveBeenCalled();
    expect(db.learningPathExecution?.createMany).not.toHaveBeenCalled();
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

  it('allows repeated apply when existing KnowledgeProgress rows are fixture-scoped', async () => {
    const db = createDbWithoutDuplicate({
      knowledgeProgress: {
        createMany: vi.fn(async () => ({ count: 3 })),
        deleteMany: vi.fn(async () => ({ count: 3 })),
        findMany: vi.fn(async () => [{
          id: `${YANGFAN_DIAGNOSTIC_FIXTURE_PREFIX}:knowledge-progress:already-seeded`,
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

    expect(plan.canApply).toBe(true);
    expect(plan.blockers).not.toContain('canonical-knowledge-progress-already-exists');
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
          nodeId: '性能指标_1_1',
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

  it('allows reset planning when fixture knowledge nodes are missing', async () => {
    const db = createDbWithoutDuplicate({
      knowledgeNode: {
        findMany: vi.fn(async () => []),
      },
    });
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'reset',
      apply: true,
      confirmApply: true,
      readinessSummary: passedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.blockers).not.toContain('fixture-knowledge-nodes-missing');
  });

  it('allows reset cleanup when readiness summary still has blockers', async () => {
    const db = createDbWithoutDuplicate();
    const plan = await buildYangFanDiagnosticFixturePlan(db, {
      mode: 'reset',
      apply: true,
      confirmApply: true,
      readinessSummary: blockedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(plan.blockers).not.toContain('yang-fan-fixture-blockers');
    expect(plan.blockers).not.toContain('readiness-summary-not-passed');

    await resetYangFanDiagnosticFixture(db, plan, {
      mode: 'reset',
      apply: true,
      confirmApply: true,
      readinessSummary: blockedReadinessSummary(),
      databaseUrl: 'postgres://localhost/act_test',
    });

    expect(db.learningFact.deleteMany).toHaveBeenCalled();
  });

  it('deletes evidence feature cache on reset when no non-fixture sources remain', async () => {
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

    expect(db.studentEvidenceFeatureCache.upsert).not.toHaveBeenCalled();
    expect(db.studentEvidenceFeatureCache.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-canonical' },
    });
  });

  it('refreshes evidence feature cache on reset when non-fixture sources remain', async () => {
    const realFact = {
      id: 'real-learning-fact',
      userId: 'user-canonical',
      factType: 'question',
      moduleId: 'module-real',
      sessionId: 'session-real',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
      finishedAt: new Date('2026-07-01T00:02:00.000Z'),
      outcome: 'success',
      score: 1,
      timeSpent: 120,
      competencyContribution: {},
      sourceEventId: 'real-event',
      sourceLogId: 'real-log',
      courseId: 'control',
      lessonId: 'lesson-real',
      contextJson: {},
    };
    const db = createDbWithoutDuplicate({
      learningFact: {
        findMany: vi.fn(async (args: Record<string, any>) => (
          args?.where?.userId === 'user-canonical' ? [realFact] : []
        )),
        createMany: vi.fn(async () => ({ count: 4 })),
        deleteMany: vi.fn(async () => ({ count: 4 })),
      },
    });
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

    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalled();
    expect(db.studentEvidenceFeatureCache.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes evidence feature cache on reset when only unregistered path rows remain', async () => {
    const db = createDbWithoutDuplicate({
      learningPathExecution: {
        createMany: vi.fn(async () => ({ count: 2 })),
        deleteMany: vi.fn(async () => ({ count: 2 })),
        findMany: vi.fn(async (args: Record<string, any>) => (
          args?.where?.path?.goalId?.in ? [] : [{
            id: 'legacy-execution',
            userId: 'user-canonical',
            path: { goalId: 'legacy-goal' },
          }]
        )),
      },
    });
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

    expect(db.studentEvidenceFeatureCache.upsert).not.toHaveBeenCalled();
    expect(db.studentEvidenceFeatureCache.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-canonical' },
    });
  });

  it('refreshes evidence feature cache on reset when registered path rows remain', async () => {
    const registeredPathExecution = {
      id: 'registered-execution',
      pathId: 'registered-path',
      userId: 'user-canonical',
      nodeId: 'node-1',
      resourceType: 'knowledge_card',
      status: 'completed',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
      completedAt: new Date('2026-07-01T00:02:00.000Z'),
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      path: { goalId: 'control-correction' },
    };
    const db = createDbWithoutDuplicate({
      learningPathExecution: {
        createMany: vi.fn(async () => ({ count: 2 })),
        deleteMany: vi.fn(async () => ({ count: 2 })),
        findMany: vi.fn(async (args: Record<string, any>) => (
          args?.where?.path?.goalId?.in ? [registeredPathExecution] : []
        )),
      },
    });
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

    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalled();
    expect(db.studentEvidenceFeatureCache.deleteMany).not.toHaveBeenCalled();
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
