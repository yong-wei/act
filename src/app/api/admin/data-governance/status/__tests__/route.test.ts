import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION } from '@/lib/data-governance/student-evidence-feature-cache';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redis: {
    keys: vi.fn(),
    llen: vi.fn(),
  },
  redisClient: {
    getClient: vi.fn(),
  },
  prisma: {
    studentCompetencySnapshot: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    classCompetencySnapshot: {
      count: vi.fn(),
    },
    learningFact: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    interactionLog: {
      findMany: vi.fn(),
    },
    studentStepResponse: {
      findMany: vi.fn(),
    },
    simulationSession: {
      findMany: vi.fn(),
    },
    simulationLog: {
      findMany: vi.fn(),
    },
    userAnswer: {
      findMany: vi.fn(),
    },
    abilityAssessment: {
      findMany: vi.fn(),
    },
    promptAssessment: {
      findMany: vi.fn(),
    },
    designSession: {
      findMany: vi.fn(),
    },
    arenaBlackBoxExperiment: {
      findMany: vi.fn(),
    },
    arenaVirtualSimulationRun: {
      findMany: vi.fn(),
    },
    arenaSubmission: {
      findMany: vi.fn(),
    },
    arenaEvaluationRun: {
      findMany: vi.fn(),
    },
    studentEvidenceFeatureCache: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    classSessionReport: {
      findMany: vi.fn(),
    },
    lessonPlan: {
      findUnique: vi.fn(),
    },
    studentRiskFlag: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    adminOperationLedger: {
      upsert: vi.fn(),
    },
  },
  rethrowIfNextDynamicError: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/redis-client', () => ({
  redisClient: mocks.redisClient,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: mocks.rethrowIfNextDynamicError,
}));

import { GET } from '../route';

function createRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/data-governance/status${query}`);
}

describe('GET /api/admin/data-governance/status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00.000Z'));
    vi.resetAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    mocks.redisClient.getClient.mockReturnValue(mocks.redis);
    mocks.redis.keys.mockResolvedValue([]);
    mocks.redis.llen.mockResolvedValue(3);
    mocks.prisma.studentCompetencySnapshot.count.mockResolvedValue(2);
    mocks.prisma.classCompetencySnapshot.count.mockResolvedValue(1);
    mocks.prisma.learningFact.count.mockResolvedValue(4);
    mocks.prisma.studentRiskFlag.count.mockResolvedValue(0);
    mocks.prisma.studentCompetencySnapshot.findMany
      .mockResolvedValueOnce([
        {
          userId: 'student-1',
          snapshotAt: new Date('2026-05-19T08:00:00.000Z'),
          factCount: 12,
        },
      ])
      .mockResolvedValueOnce([
        {
          userId: 'student-1',
          snapshotAt: new Date('2026-05-19T08:00:00.000Z'),
          factCount: 12,
        },
      ]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValue(null);
    mocks.prisma.learningFact.findMany
      .mockResolvedValueOnce([
        { factType: 'question' },
        { factType: 'simulation' },
      ])
      .mockResolvedValueOnce([]);
    mocks.prisma.interactionLog.findMany.mockResolvedValue([
      {
        id: 'log-demo-5-2',
        userId: 'student-demo',
        eventType: 'lesson_submit',
        eventData: { eventType: 'lesson_submit', source: 'demo' },
        clientEventAt: new Date('2026-05-20T08:00:00.000Z'),
        createdAt: new Date('2026-05-20T08:01:00.000Z'),
      },
      {
        id: 'log-page-view',
        userId: 'student-1',
        eventType: 'page_view',
        eventData: { eventType: 'page_view', source: 'real' },
        clientEventAt: new Date('2026-05-20T08:02:00.000Z'),
        createdAt: new Date('2026-05-20T08:02:30.000Z'),
      },
      {
        id: 'log-5-2-submit',
        userId: 'student-1',
        eventType: 'lesson_submit',
        eventData: { eventType: 'lesson_submit', lessonKey: 'unit-5-2-nonlinear-analysis-entry' },
        clientEventAt: new Date('2026-05-20T08:10:00.000Z'),
        createdAt: new Date('2026-05-20T08:10:10.000Z'),
      },
    ]);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([]);
    mocks.prisma.simulationSession.findMany.mockResolvedValue([
      {
        id: 'simulation-session-real',
        userId: 'student-1',
        module: 'unit-5-2',
        simType: 'workspace',
        inputParams: { source: 'real-simulation' },
        artifacts: { traceReference: 'trace-sim-session-real' },
        createdAt: new Date('2026-05-20T08:11:00.000Z'),
      },
    ]);
    mocks.prisma.simulationLog.findMany.mockResolvedValue([]);
    mocks.prisma.userAnswer.findMany.mockResolvedValue([]);
    mocks.prisma.abilityAssessment.findMany.mockResolvedValue([]);
    mocks.prisma.promptAssessment.findMany.mockResolvedValue([]);
    mocks.prisma.designSession.findMany.mockResolvedValue([]);
    mocks.prisma.arenaBlackBoxExperiment.findMany.mockResolvedValue([
      {
        id: 'arena-blackbox-real',
        userId: 'student-1',
        taskId: 'unit-5-2-regression-fixture',
        signalType: 'step',
        payload: { source: 'real-arena-experiment' },
        createdAt: new Date('2026-05-20T08:12:00.000Z'),
      },
    ]);
    mocks.prisma.arenaVirtualSimulationRun.findMany.mockResolvedValue([
      {
        id: 'arena-preview-real',
        userId: 'student-1',
        taskId: 'unit-5-2-regression-fixture',
        datasetHash: 'dataset-hash',
        controllerHash: 'controller-hash',
        scenarioId: 'scenario-a',
        simulationRunId: 'canonical-run-1',
        payload: {
          source: 'real-arena-preview',
          summary: { trackingError: 0.2, maxDeviation: 0.4 },
          replay: { checksum: 'sha256:abc' },
          metadata: {
            evaluationVisibility: 'preview',
            officialEligible: false,
            modelRelation: 'identified-model-controller',
            datasetHash: 'dataset-hash',
            controllerHash: 'controller-hash',
            identificationModelId: 'model-1',
            sourceExperimentId: 'experiment-1',
          },
        },
        createdAt: new Date('2026-05-20T08:13:00.000Z'),
      },
    ]);
    mocks.prisma.arenaSubmission.findMany.mockResolvedValue([]);
    mocks.prisma.arenaEvaluationRun.findMany.mockResolvedValue([
      {
        id: 'arena-eval-support-only',
        taskId: 'unit-5-2-regression-fixture',
        metadata: { source: 'real' },
        completedAt: new Date('2026-05-20T08:20:00.000Z'),
      },
    ]);
    mocks.prisma.studentEvidenceFeatureCache.count.mockResolvedValue(2);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([
      {
        refreshedAt: new Date('2026-05-19T08:10:00.000Z'),
        statusMarkers: [],
        sourceCoverage: {
          LearningFact: 'available',
          StudentCompetencySnapshot: 'missing',
          StudentProfileSummary: 'missing',
        },
        sourceFactCount: 4,
        rebuildCount: 1,
      },
    ]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([
      {
        sessionId: 'session-green',
        lessonKey: 'unit-5-2-nonlinear-analysis-entry',
        status: 'READY',
        summary: '5-2 富证据课堂',
        updatedAt: new Date('2026-05-20T09:00:00.000Z'),
        reportData: {
          sessionGovernanceSummary: {
            qualityStatus: { status: 'green', reasons: ['healthy_quality_gate'] },
          },
        },
      },
      {
        sessionId: 'session-yellow',
        lessonKey: 'unit-5-1-linear-backbone-boundaries',
        status: 'READY',
        summary: '5-1 部分旧证据课堂',
        updatedAt: new Date('2026-05-20T10:00:00.000Z'),
        reportData: {
          sessionGovernanceSummary: {
            qualityStatus: { status: 'yellow', reasons: ['missing_post_assessment'] },
          },
        },
      },
      {
        sessionId: 'session-red',
        lessonKey: 'unit-5-3-mass-coordination-chain',
        status: 'READY',
        summary: '5-3 缺证据课堂',
        updatedAt: new Date('2026-05-20T11:00:00.000Z'),
        reportData: {
          sessionGovernanceSummary: {
            qualityStatus: { status: 'red', reasons: ['low_fact_coverage'] },
          },
        },
      },
    ]);
    mocks.prisma.user.findMany.mockResolvedValue([
      { id: 'student-1', name: '张三', email: 'student@example.test' },
    ]);
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the evidence source catalog for admins', async () => {
    const response = await GET(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sourceCatalog).toMatchObject({
      totalSources: 13,
      coverageCommand: 'npm run db:evidence-source-coverage -- --text',
    });
    expect(payload.sourceCatalog.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'InteractionLog',
          learningScope: 'mixed',
          eligibility: 'eligible',
          materializationReadiness: 'partial',
          totalRows: 3,
          eligibleRows: 1,
          excludedRows: 2,
          unsupportedRows: 0,
          exclusionReasons: expect.arrayContaining(['low_value_activity_context', 'non_real_provenance']),
        }),
        expect.objectContaining({
          id: 'SimulationSession',
          learningScope: 'mixed',
          eligibility: 'eligible',
          materializationReadiness: 'partial',
          totalRows: 1,
          eligibleRows: 1,
        }),
        expect.objectContaining({
          id: 'ArenaBlackBoxExperiment',
          learningScope: 'standalone',
          eligibility: 'eligible',
          materializationReadiness: 'ready',
          totalRows: 1,
          eligibleRows: 1,
        }),
        expect.objectContaining({
          id: 'ArenaVirtualSimulationRun',
          learningScope: 'standalone',
          eligibility: 'eligible',
          materializationReadiness: 'ready',
          totalRows: 1,
          eligibleRows: 1,
          readinessGapCounts: {},
        }),
        expect.objectContaining({
          id: 'ArenaEvaluationRun',
          eligibility: 'unsupported',
          totalRows: 1,
          unsupportedRows: 1,
          exclusionReasons: ['source_not_profile_ready'],
        }),
      ])
    );
    expect(payload.sourceCoverage).toMatchObject({
      totals: {
        totalRows: 7,
        eligibleRows: 4,
        excludedRows: 2,
        unsupportedRows: 1,
      },
      exclusions: expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'InteractionLog',
          reason: 'non_real_provenance',
          rowCount: 1,
          sampleSourceReference: 'InteractionLog:log-demo-5-2',
        }),
        expect.objectContaining({
          sourceId: 'InteractionLog',
          reason: 'low_value_activity_context',
          rowCount: 1,
        }),
        expect.objectContaining({
          sourceId: 'ArenaEvaluationRun',
          reason: 'source_not_profile_ready',
          rowCount: 1,
        }),
      ]),
    });
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        simulationRunId: true,
      }),
    }));
    expect(payload.recentSnapshots[0]).toMatchObject({
      userId: 'student-1',
      userName: '张三',
      factCount: 12,
    });
    expect(payload.featureCache).toMatchObject({
      totalEntries: 2,
      staleEntries: 0,
      latestRefreshAt: '2026-05-19T08:10:00.000Z',
      totalSourceFacts: 4,
      payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    });
    expect(payload.sessionQuality).toEqual({
      recentSessions: 3,
      green: 1,
      yellow: 1,
      red: 1,
      unknown: 0,
      latestReports: [
        expect.objectContaining({
          sessionId: 'session-green',
          lessonKey: 'unit-5-2-nonlinear-analysis-entry',
          qualityStatus: 'green',
          qualityReasons: ['healthy_quality_gate'],
        }),
        expect.objectContaining({
          sessionId: 'session-yellow',
          qualityStatus: 'yellow',
          qualityReasons: ['missing_post_assessment'],
        }),
        expect.objectContaining({
          sessionId: 'session-red',
          qualityStatus: 'red',
          qualityReasons: ['low_fact_coverage'],
        }),
      ],
    });
  });

  it('returns a requested risk outside the recent risk window for deep links', async () => {
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValue({
      id: 'risk-older',
      userId: 'student-1',
      flagType: 'participation',
      severity: 'high',
      description: '较早待处理风险',
      triggeredAt: new Date('2026-05-18T08:00:00.000Z'),
      isResolved: false,
      user: { name: '张三', email: 'student@example.test' },
    });

    const response = await GET(createRequest('?riskId=risk-older'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentRiskFlag.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'risk-older', isResolved: false },
    }));
    expect(payload.targetRiskFlag).toMatchObject({
      id: 'risk-older',
      userId: 'student-1',
      userName: '张三',
      isResolved: false,
    });
  });

  it('echoes authoring report context for lesson-plan quality deep links', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({ id: 'plan-1' });

    const response = await GET(createRequest('?surface=authoring&tab=reports&lessonPlanId=plan-1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.authoringContext).toEqual({
      surface: 'authoring',
      lessonPlanId: 'plan-1',
      lessonPlanMissing: false,
      requestedTab: 'reports',
      reportHref: '/admin/data-governance?surface=authoring&tab=reports&lessonPlanId=plan-1',
      recoveryHref: '/admin/lesson-plans/plan-1/edit?returnTo=%2Fadmin%2Fdata-governance',
    });
  });

  it('records an admin operation ledger entry for manual refresh requests', async () => {
    const response = await GET(createRequest('?recordOperation=refresh&riskId=risk-1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.operationLedger).toMatchObject({
      kind: 'admin-governance-refresh',
      actorId: 'admin-1',
      outcome: 'completed',
      idempotencyKey: expect.stringMatching(/^admin-op:/),
    });
    expect(response.headers.get('x-admin-operation-id')).toMatch(/^admin-governance-refresh:/);
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        kind: 'admin-governance-refresh',
        scope: 'admin-data-governance-status',
      }),
    }));
  });

  it('does not record an admin operation ledger entry for automatic status reads', async () => {
    const response = await GET(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.operationLedger).toBeUndefined();
    expect(response.headers.get('x-admin-operation-id')).toBeNull();
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
  });

  it('marks missing lesson plans in authoring report context', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue(null);

    const response = await GET(createRequest('?surface=authoring&tab=reports&lessonPlanId=missing'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.lessonPlan.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing' },
      select: { id: true },
    });
    expect(payload.authoringContext).toMatchObject({
      lessonPlanId: 'missing',
      lessonPlanMissing: true,
      recoveryHref: '/admin/lesson-plans/missing/edit?returnTo=%2Fadmin%2Fdata-governance',
    });
  });

  it('rejects non-admin users before reading governance data', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });

    const response = await GET(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
    expect(mocks.prisma.studentCompetencySnapshot.count).not.toHaveBeenCalled();
    expect(mocks.prisma.classSessionReport.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.interactionLog.findMany).not.toHaveBeenCalled();
    expect(mocks.redisClient.getClient).not.toHaveBeenCalled();
  });
});
