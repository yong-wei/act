import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION } from '@/lib/data-governance/student-evidence-feature-cache';
import { createSarPersistenceRepository } from '@/lib/data-governance/sar-persistence';

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
    simulationRun: {
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

function seedSarPersistenceQueryTrace(filePath: string) {
  const now = '2026-05-20T11:50:00.000Z';
  const result = {
    id: 'sar:result:persisted-live-eval',
    trace: {
      id: 'sar:trace:persisted-live-eval',
      seedEntityIds: ['sar:entity:persisted-goal'],
      expansionHops: [{
        fromEntityId: 'sar:entity:persisted-goal',
        toEntityId: 'sar:entity:persisted-arena',
        viaEventId: 'sar:event:persisted-citation',
        relationRole: 'supports' as const,
        confidence: 0.92,
      }, {
        fromEntityId: 'sar:entity:persisted-arena',
        toEntityId: 'sar:entity:persisted-citation-target',
        viaEventId: 'sar:event:persisted-citation',
        relationRole: 'about' as const,
        confidence: 0.91,
      }],
      selectedRefs: [
        'chunk:source-pack:persisted-baseline',
        'sar:event:persisted-citation',
        'citation:persisted-arena-official',
        'sar:event:persisted-sar-candidate',
      ],
      rejectedRefs: [{ ref: 'sar:event:persisted-rejected', reason: 'privacy scope unavailable' }],
      limitations: ['persisted-trace-limited-sample'],
      versionRefs: ['sar-persistence.v1'],
    },
    events: [{
      id: 'sar:event:persisted-source-pack-baseline',
      eventType: 'resource-node' as const,
      title: 'Persisted Source Pack baseline',
      safeSummary: 'Persisted ordinary retrieval baseline selected a source pack resource.',
      privacyScope: 'teacher-scoped' as const,
      sourceRef: {
        id: 'chunk:source-pack:persisted-baseline',
        owner: 'ResourceNode',
        authorityLevel: 'teacher-approved' as const,
        freshness: now,
      },
      metadata: {},
    }, {
      id: 'sar:event:persisted-sar-candidate',
      eventType: 'corpus-chunk-summary' as const,
      title: 'Persisted SAR candidate',
      safeSummary: 'Persisted SAR trace selected a candidate chunk.',
      privacyScope: 'teacher-scoped' as const,
      sourceRef: {
        id: 'chunk:persisted-sar-candidate',
        owner: 'LearningEvidenceCorpus',
        authorityLevel: 'metadata-projected' as const,
        freshness: now,
      },
      metadata: {},
    }, {
      id: 'sar:event:persisted-citation',
      eventType: 'arena-summary' as const,
      title: 'Persisted Arena citation',
      safeSummary: 'Persisted SAR trace selected an official Arena citation target.',
      privacyScope: 'teacher-scoped' as const,
      sourceRef: {
        id: 'citation:persisted-arena-official',
        owner: 'ArenaEvaluationRun',
        authorityLevel: 'platform-verified' as const,
        freshness: now,
      },
      metadata: {},
    }],
    entities: [{
      id: 'sar:entity:persisted-goal',
      entityType: 'learning-goal' as const,
      canonicalRef: 'goal:persisted-control-correction',
      label: 'Persisted control correction goal',
      aliases: [],
      privacyScope: 'teacher-scoped' as const,
      extraction: 'platform-stable-id' as const,
    }, {
      id: 'sar:entity:persisted-arena',
      entityType: 'planning-unit' as const,
      canonicalRef: 'arena:persisted-official',
      label: 'Persisted Arena official validation',
      aliases: [],
      privacyScope: 'teacher-scoped' as const,
      extraction: 'platform-stable-id' as const,
    }, {
      id: 'sar:entity:persisted-citation-target',
      entityType: 'citation-target' as const,
      canonicalRef: 'citation:persisted-arena-official',
      label: 'Persisted Arena citation target',
      aliases: [],
      privacyScope: 'teacher-scoped' as const,
      extraction: 'platform-stable-id' as const,
    }],
    relations: [{
      eventId: 'sar:event:persisted-source-pack-baseline',
      entityId: 'sar:entity:persisted-goal',
      role: 'supports' as const,
      confidence: 0.9,
      provenance: 'metadata-projection' as const,
      source: 'persisted-trace-test',
    }, {
      eventId: 'sar:event:persisted-citation',
      entityId: 'sar:entity:persisted-arena',
      role: 'supports' as const,
      confidence: 0.92,
      provenance: 'metadata-projection' as const,
      source: 'persisted-trace-test',
    }, {
      eventId: 'sar:event:persisted-citation',
      entityId: 'sar:entity:persisted-citation-target',
      role: 'about' as const,
      confidence: 0.91,
      provenance: 'metadata-projection' as const,
      source: 'persisted-trace-test',
    }],
    citationTargetRefs: ['citation:persisted-arena-official'],
    retrievalChunkRefs: ['chunk:source-pack:persisted-baseline'],
    limitations: ['persisted-trace-limited-sample'],
  };
  const repository = createSarPersistenceRepository({ filePath, now: () => now });
  const write = repository.upsertQueryTrace({
    result,
    queryRole: 'teacher-diagnostics',
    useCase: 'sar-live-evaluation',
    queryIdentity: {
      prompt: 'Which persisted SAR trace supports control correction?',
      filters: ['control-correction'],
    },
    scope: {
      scope: 'teacher',
      teacherIdHash: `sar:teacher:sha256:${'a'.repeat(64)}`,
    },
    retention: {
      storedAt: now,
      retainUntil: '2026-07-20T00:00:00.000Z',
      minimizationPolicy: 'aggregate-after-retention',
    },
    exportEligibility: 'teacher-export',
    handoffStatus: 'ready',
    now,
  });
  expect(write.persisted).toBe(true);
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
    mocks.prisma.simulationRun.findMany.mockResolvedValue([
      {
        id: 'simulation-run-real',
        ownerUserId: 'student-1',
        resourceId: 'sim-pid-v1',
        taskSpecId: 'task-spec-1',
        taskSpecSnapshot: { sceneId: 'sim/cruise' },
        sourceDomain: 'interactive',
        sourceRefId: 'simulation-run-source-1',
        summary: { metrics: { settlingTime: 3.2 } },
        completedAt: new Date('2026-05-20T08:11:30.000Z'),
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
    mocks.prisma.arenaSubmission.findMany.mockResolvedValue([
      {
        id: 'arena-submission-official',
        userId: 'student-1',
        taskId: 'unit-5-2-regression-fixture',
        classId: 'class-1',
        seasonId: 'season-1',
        publicationId: 'publication-1',
        score: 86,
        valid: true,
        submissionAttemptKey: 'attempt-official-1',
        submittedAt: new Date('2026-05-20T08:18:00.000Z'),
        evaluationRunId: 'arena-eval-support-only',
      },
    ]);
    mocks.prisma.arenaEvaluationRun.findMany.mockResolvedValue([
      {
        id: 'arena-eval-support-only',
        taskId: 'unit-5-2-regression-fixture',
        metadata: { source: 'real' },
        metrics: { settlingTime: 1.2 },
        protocolVersion: 'arena-protocol.v1',
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
      totalSources: 14,
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
          id: 'ArenaSubmission',
          eligibility: 'eligible',
          totalRows: 1,
          eligibleRows: 1,
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
        totalRows: 9,
        eligibleRows: 6,
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
    expect(payload.sarDiagnostics).toMatchObject({
      totals: {
        eventCount: 5,
        entityCount: 6,
        relationCount: 10,
        queryCount: 1,
        privacyRejectionCount: 1,
        verifiedCitationRate: 0.5,
      },
      eventTypeCounts: expect.objectContaining({
        'learning-fact-summary': 1,
        'simulation-summary': 1,
        'arena-summary': 1,
      }),
      demoFixtureStatus: expect.objectContaining({
        id: 'control-correction-demo',
        deterministic: true,
        sourcePackHandoff: true,
      }),
    });
    expect(JSON.stringify(payload.sarDiagnostics)).not.toContain('private raw answer');
    expect(JSON.stringify(payload.sarDiagnostics)).not.toContain('hiddenArenaEvaluationInternalsPayload');
    expect(payload.sarDiagnostics.liveEvaluation).toMatchObject({
      metrics: {
        queryCount: 0,
        feedbackRecordCount: 2,
        ordinaryRetrievalBaselineRefCount: 0,
        sarCandidateRefCount: 0,
        citationTargetRefCount: 0,
        verifiedCitationRefCount: 0,
        verifiedCitationRate: 0,
        verifiedCitationEvidenceStatus: 'unavailable',
      },
      privacyBoundary: {
        restrictedRawContentExcluded: true,
        candidateRefsAreVerifiedCitations: false,
      },
      arenaOfficialAuthority: {
        status: 'available',
        officialMetricSources: {
          score: 'ArenaSubmission',
          validity: 'ArenaSubmission',
          ranking: 'ArenaSubmission',
          attemptPolicy: 'ArenaSubmission',
          evaluationMetrics: 'ArenaEvaluationRun',
        },
        officialRecordSummary: {
          submissionCount: 1,
          evaluationRunCount: 1,
        },
      },
    });
    expect(payload.sarDiagnostics.liveEvaluation.evaluationRecords).toHaveLength(2);
    expect(payload.sarDiagnostics.liveEvaluation.limitations).toContain('sar-live-evaluation-persisted-traces-missing');
    expect(payload.sarDiagnostics.liveEvaluation.limitations).toContain('verified-citation-evidence-unavailable');
    expect(payload.sarRefreshHealth).toMatchObject({
      status: 'degraded',
      totals: {
        sourceFamilyCount: 8,
        projectedEventCount: 8,
        projectedEntityCount: 8,
        projectedRelationCount: 8,
        staleSourceCount: 3,
        failureCount: 0,
      },
      sources: expect.arrayContaining([
        expect.objectContaining({
          family: 'arena-official',
          status: 'degraded',
          retryState: 'not-needed',
          arenaAuthority: expect.objectContaining({
            officialSources: ['ArenaEvaluationRun', 'ArenaSubmission'],
            auxiliarySources: ['KAQWriteback', 'LearningFact', 'SARTrace'],
            officialRecordSummary: {
              submissionCount: 1,
              evaluationRunCount: 1,
              latestSubmissionAt: '2026-05-20T08:18:00.000Z',
              latestEvaluationCompletedAt: '2026-05-20T08:20:00.000Z',
            },
          }),
        }),
        expect.objectContaining({
          family: 'path-summary',
          projectedEventCount: 1,
          projectedEntityCount: 1,
          projectedRelationCount: 1,
        }),
      ]),
      limitations: [
        'arena-auxiliary-evidence-context-only',
        'source-materialization-future',
        'source-rows-excluded',
      ],
    });
    expect(JSON.stringify(payload.sarRefreshHealth)).not.toContain('private raw answer');
    expect(JSON.stringify(payload.sarRefreshHealth)).not.toContain('hiddenArenaEvaluationInternalsPayload');
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

  it('builds SAR live evaluation from persisted query traces when persistence is configured', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-live-eval-'));
    const previous = process.env.SAR_PERSISTENCE_FILE_PATH;
    const filePath = join(directory, 'sar.json');
    seedSarPersistenceQueryTrace(filePath);
    process.env.SAR_PERSISTENCE_FILE_PATH = filePath;
    try {
      const response = await GET(createRequest());
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.sarDiagnostics.liveEvaluation).toMatchObject({
        metrics: {
          queryCount: 1,
          feedbackRecordCount: 2,
          ordinaryRetrievalBaselineRefCount: 1,
          sarCandidateRefCount: 2,
          sarOnlyCandidateRefCount: 2,
          citationTargetRefCount: 1,
          verifiedCitationRefCount: 0,
          verifiedCitationRate: 0,
          sourcePackHandoffRefCount: 2,
        },
        arenaOfficialAuthority: {
          status: 'available',
        },
      });
      expect(payload.sarDiagnostics.liveEvaluation.querySet[0].query).toContain('teacher-diagnostics · sar-live-evaluation');
      expect(payload.sarDiagnostics.liveEvaluation.querySet[0].query).toContain('sha256:');
      expect(JSON.stringify(payload.sarDiagnostics.liveEvaluation)).not.toContain('Which persisted SAR trace supports control correction?');
      expect(JSON.stringify(payload.sarDiagnostics.liveEvaluation)).not.toContain('control-correction-demo');
    } finally {
      if (previous === undefined) {
        delete process.env.SAR_PERSISTENCE_FILE_PATH;
      } else {
        process.env.SAR_PERSISTENCE_FILE_PATH = previous;
      }
      rmSync(directory, { recursive: true, force: true });
    }
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
      resolvedAt: null,
      resolutionNote: null,
      evidenceJson: {
        adminGovernance: {
          currentAssignee: 'admin-1',
          auditLog: [
            {
              actorId: 'admin-1',
              action: 'assign',
              riskId: 'risk-older',
              assignee: 'admin-1',
              outcome: 'assigned',
              undoAvailable: false,
              recordedAt: '2026-05-18T09:00:00.000Z',
            },
          ],
        },
      },
      user: { name: '张三', email: 'student@example.test' },
    });

    const response = await GET(createRequest('?riskId=risk-older'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentRiskFlag.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'risk-older' },
    }));
    expect(payload.targetRiskFlag).toMatchObject({
      id: 'risk-older',
      userId: 'student-1',
      userName: '张三',
      isResolved: false,
      safeLabel: '张三 · participation · high',
      affectedObjectLabel: 'student:student-1',
      evidenceHref: '/admin/data-governance?tab=risks&riskId=risk-older&action=evidence',
      currentAssignee: 'admin-1',
      dispositionStatus: 'open',
      undoAvailable: false,
      auditTrail: [
        expect.objectContaining({ action: 'assign', outcome: 'assigned' }),
      ],
    });
  });

  it('uses lastDisposition as the safe governance state source for legacy audit payloads', async () => {
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValue({
      id: 'risk-legacy-ignored',
      userId: 'student-1234567890',
      flagType: 'participation',
      severity: 'medium',
      description: '旧格式忽略风险',
      triggeredAt: new Date('2026-05-18T08:00:00.000Z'),
      isResolved: true,
      resolvedAt: new Date('2026-05-18T10:00:00.000Z'),
      resolutionNote: null,
      evidenceJson: {
        adminGovernance: {
          lastDisposition: 'ignored',
        },
      },
      user: { name: null, email: 'student@example.test' },
    });

    const response = await GET(createRequest('?tab=risks&riskId=risk-legacy-ignored'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.targetRiskFlag).toMatchObject({
      id: 'risk-legacy-ignored',
      userName: '学生 student-1234',
      safeLabel: '学生 student-1234 · participation · medium',
      affectedObjectLabel: 'student:student-1234',
      dispositionStatus: 'ignored',
      auditTrail: [],
    });
    expect(payload.targetRiskFlag.safeLabel).not.toContain('@');
  });

  it('falls back to resolutionNote when legacy ignored risks lack governance disposition metadata', async () => {
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValue({
      id: 'risk-note-ignored',
      userId: 'student-1234567890',
      flagType: 'participation',
      severity: 'medium',
      description: '旧备注忽略风险',
      triggeredAt: new Date('2026-05-18T08:00:00.000Z'),
      isResolved: true,
      resolvedAt: new Date('2026-05-18T10:00:00.000Z'),
      resolutionNote: '管理员从数据治理工作台忽略该风险',
      evidenceJson: {},
      user: { name: null, email: 'student@example.test' },
    });

    const response = await GET(createRequest('?tab=risks&riskId=risk-note-ignored'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.targetRiskFlag).toMatchObject({
      id: 'risk-note-ignored',
      dispositionStatus: 'ignored',
      auditTrail: [],
    });
  });

  it('returns resolved target risks so URL intents can show already-handled recovery', async () => {
    mocks.prisma.studentRiskFlag.findUnique.mockResolvedValue({
      id: 'risk-resolved',
      userId: 'student-1',
      flagType: 'participation',
      severity: 'medium',
      description: '已处理风险',
      triggeredAt: new Date('2026-05-18T08:00:00.000Z'),
      isResolved: true,
      resolvedAt: new Date('2026-05-18T10:00:00.000Z'),
      resolutionNote: '管理员从数据治理工作台忽略该风险',
      evidenceJson: {
        adminGovernance: {
          auditLog: [
            {
              actorId: 'admin-1',
              action: 'ignore',
              riskId: 'risk-resolved',
              assignee: null,
              outcome: 'ignored',
              undoAvailable: true,
              recordedAt: '2026-05-18T10:00:00.000Z',
            },
          ],
        },
      },
      user: { name: '张三', email: 'student@example.test' },
    });

    const response = await GET(createRequest('?tab=risks&action=resolve&riskId=risk-resolved'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.targetRiskFlag).toMatchObject({
      id: 'risk-resolved',
      isResolved: true,
      dispositionStatus: 'ignored',
      resolvedAt: '2026-05-18T10:00:00.000Z',
      resolutionNote: '管理员从数据治理工作台忽略该风险',
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

  it('blocks audited manual SAR refresh when persistence path is missing', async () => {
    const previous = process.env.SAR_PERSISTENCE_FILE_PATH;
    delete process.env.SAR_PERSISTENCE_FILE_PATH;
    try {
      const response = await GET(createRequest('?recordOperation=refresh&riskId=risk-1'));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.operationLedger).toMatchObject({
        kind: 'admin-governance-refresh',
        actorId: 'admin-1',
        outcome: 'blocked',
        idempotencyKey: expect.stringMatching(/^admin-op:/),
        auditSummary: expect.stringContaining('数据治理状态刷新被阻止'),
        recoveryState: expect.objectContaining({
          status: 'retry',
          action: '配置 SAR_PERSISTENCE_FILE_PATH 后重试刷新',
        }),
      });
      expect(payload.sarRefreshHealth.status).toBe('failed');
      expect(payload.sarRefreshHealth.limitations).toContain('sar-persistence-file-path-required');
      expect(payload.sarRefreshHealth.operationEvidence).toMatchObject({
        operationId: payload.operationLedger.operationId,
        idempotencyKey: payload.operationLedger.idempotencyKey,
      });
      expect(response.headers.get('x-admin-operation-outcome')).toBe('blocked');
      expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({
          kind: 'admin-governance-refresh',
          scope: 'admin-data-governance-status',
          outcome: 'blocked',
        }),
      }));
    } finally {
      if (previous === undefined) {
        delete process.env.SAR_PERSISTENCE_FILE_PATH;
      } else {
        process.env.SAR_PERSISTENCE_FILE_PATH = previous;
      }
    }
  });

  it('does not write SAR persistence during automatic status reads', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-status-'));
    const previous = process.env.SAR_PERSISTENCE_FILE_PATH;
    const filePath = join(directory, 'sar.json');
    process.env.SAR_PERSISTENCE_FILE_PATH = filePath;
    try {
      const response = await GET(createRequest());
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.sarRefreshHealth.status).toBe('degraded');
      expect(existsSync(filePath)).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.SAR_PERSISTENCE_FILE_PATH;
      } else {
        process.env.SAR_PERSISTENCE_FILE_PATH = previous;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('writes SAR persistence only for audited manual refresh requests', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-status-'));
    const previous = process.env.SAR_PERSISTENCE_FILE_PATH;
    const filePath = join(directory, 'sar.json');
    process.env.SAR_PERSISTENCE_FILE_PATH = filePath;
    try {
      const response = await GET(createRequest('?recordOperation=refresh'));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.operationLedger).toBeDefined();
      expect(existsSync(filePath)).toBe(true);
      const snapshot = JSON.parse(readFileSync(filePath, 'utf8'));
      expect(snapshot.events).toHaveProperty('sar:event:path-summary:sar-refresh:path-summary');
      expect(snapshot.events).not.toHaveProperty('sar:event:arena-validation');
    } finally {
      if (previous === undefined) {
        delete process.env.SAR_PERSISTENCE_FILE_PATH;
      } else {
        process.env.SAR_PERSISTENCE_FILE_PATH = previous;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('records failed outcome when audited SAR refresh health fails', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-status-'));
    const previous = process.env.SAR_PERSISTENCE_FILE_PATH;
    const filePath = join(directory, 'sar.json');
    process.env.SAR_PERSISTENCE_FILE_PATH = filePath;
    mocks.prisma.arenaSubmission.findMany.mockResolvedValue([]);
    mocks.prisma.arenaEvaluationRun.findMany.mockResolvedValue([]);
    try {
      const response = await GET(createRequest('?recordOperation=refresh'));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.sarRefreshHealth.status).toBe('failed');
      expect(payload.sarRefreshHealth.totals.failureCount).toBeGreaterThan(0);
      expect(payload.operationLedger).toMatchObject({
        outcome: 'failed',
        auditSummary: expect.stringContaining('数据治理状态刷新失败'),
        recoveryState: expect.objectContaining({
          status: 'retry',
          action: '修复 SAR 刷新失败源后重试刷新',
        }),
      });
      expect(response.headers.get('x-admin-operation-outcome')).toBe('failed');
      expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({
          outcome: 'failed',
        }),
      }));
    } finally {
      if (previous === undefined) {
        delete process.env.SAR_PERSISTENCE_FILE_PATH;
      } else {
        process.env.SAR_PERSISTENCE_FILE_PATH = previous;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reuses recorded SAR persistence during automatic status reads', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-status-'));
    const previous = process.env.SAR_PERSISTENCE_FILE_PATH;
    const filePath = join(directory, 'sar.json');
    process.env.SAR_PERSISTENCE_FILE_PATH = filePath;
    try {
      const refreshResponse = await GET(createRequest('?recordOperation=refresh'));
      const refreshPayload = await refreshResponse.json();
      const recordedSnapshot = JSON.parse(readFileSync(filePath, 'utf8'));

      expect(refreshResponse.status).toBe(200);
      expect(refreshPayload.operationLedger).toBeDefined();

      mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([
        {
          userId: 'student-1',
          snapshotAt: new Date('2026-05-19T08:00:00.000Z'),
          factCount: 12,
        },
      ]);
      mocks.prisma.learningFact.findMany.mockResolvedValue([
        { factType: 'question' },
        { factType: 'simulation' },
      ]);

      const readResponse = await GET(createRequest());
      const readPayload = await readResponse.json();

      expect(readResponse.status).toBe(200);
      expect(readPayload.operationLedger).toBeUndefined();
      expect(readPayload.sarRefreshHealth.lastSuccessfulAt).toBe(recordedSnapshot.generatedAt);
      expect(readPayload.sarRefreshHealth.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({
          family: 'kaq-graph',
          lastSuccessfulAt: recordedSnapshot.generatedAt,
        }),
      ]));
      expect(JSON.parse(readFileSync(filePath, 'utf8')).generatedAt).toBe(recordedSnapshot.generatedAt);
    } finally {
      if (previous === undefined) {
        delete process.env.SAR_PERSISTENCE_FILE_PATH;
      } else {
        process.env.SAR_PERSISTENCE_FILE_PATH = previous;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('uses submission-linked Arena evaluation runs for official SAR authority', async () => {
    mocks.prisma.arenaSubmission.findMany.mockResolvedValue([
      {
        id: 'arena-submission-with-reused-run',
        userId: 'student-1',
        taskId: 'unit-5-2-regression-fixture',
        classId: 'class-1',
        seasonId: 'season-1',
        publicationId: 'publication-1',
        score: 91,
        valid: true,
        submissionAttemptKey: 'attempt-reused-1',
        submittedAt: new Date('2026-05-20T08:18:00.000Z'),
        evaluationRunId: 'arena-eval-reused-old',
      },
    ]);
    mocks.prisma.arenaEvaluationRun.findMany
      .mockResolvedValueOnce([
        {
          id: 'arena-eval-latest-unrelated',
          taskId: 'other-task',
          metadata: { source: 'real' },
          completedAt: new Date('2026-05-20T09:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'arena-eval-reused-old',
          taskId: 'unit-5-2-regression-fixture',
          metrics: { settlingTime: 1.5 },
          protocolVersion: 'arena-protocol.v1',
          completedAt: new Date('2026-05-18T08:20:00.000Z'),
        },
      ]);

    const response = await GET(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.arenaEvaluationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['arena-eval-reused-old'] } },
    }));
    expect(payload.sarRefreshHealth.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: 'arena-official',
        arenaAuthority: expect.objectContaining({
          officialRecordSummary: {
            submissionCount: 1,
            evaluationRunCount: 1,
            latestSubmissionAt: '2026-05-20T08:18:00.000Z',
            latestEvaluationCompletedAt: '2026-05-18T08:20:00.000Z',
          },
        }),
      }),
    ]));
    expect(payload.sarRefreshHealth.totals.failureCount).toBe(0);
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
