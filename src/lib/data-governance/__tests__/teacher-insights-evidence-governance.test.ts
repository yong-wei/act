import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_DAY_MS = 24 * 60 * 60 * 1000;

const mocks = vi.hoisted(() => {
  const getServerAuthSession = vi.fn();
  const generateRecommendations = vi.fn();
  const prismaArenaSubmissionStore = {
    listSubmissions: vi.fn(),
  };

  return {
    getServerAuthSession,
    generateRecommendations,
    prismaArenaSubmissionStore,
    prisma: {
      $queryRaw: vi.fn(),
      diagnosisReportSnapshot: {
        findMany: vi.fn(),
      },
      class: {
        findUnique: vi.fn(),
      },
      studentCompetencySnapshot: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      classCompetencySnapshot: {
        findFirst: vi.fn(),
      },
      studentProfileSummary: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      studentRiskFlag: {
        findMany: vi.fn(),
      },
      growthRecord: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      learningRecommendation: {
        groupBy: vi.fn(),
      },
      learningFact: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
      },
      studentEvidenceFeatureCache: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      studentPortraitV2Snapshot: {
        findFirst: vi.fn(),
      },
      classSessionReport: {
        findMany: vi.fn(),
      },
      classSession: {
        findMany: vi.fn(),
      },
      studentProfile: {
        findFirst: vi.fn(),
      },
      studentStepResponse: {
        findMany: vi.fn(),
      },
      studentSessionReport: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/features/arena/submissions/prisma-store', () => ({
  prismaArenaSubmissionStore: mocks.prismaArenaSubmissionStore,
}));

vi.mock('@/lib/data-governance/recommendation-engine', () => ({
  generateRecommendations: mocks.generateRecommendations,
}));

import { GET as getClassInsights } from '@/app/api/teacher/classes/[classId]/insights/route';
import { GET as getStudentInsights } from '@/app/api/teacher/classes/[classId]/students/[studentId]/insights/route';
import {
  buildTeacherScopedLearningFactScopeFilters,
  buildTeacherScopedSimulationArenaFeatureMap,
  summarizeTeacherEvidenceCoverage,
  type TeacherStudentEvidenceStatus,
} from '../teacher-evidence-governance';
import {
  STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
  type StudentSimulationArenaFeatureSummary,
} from '../student-evidence-feature-cache';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
} from '../portrait-v2-model';

function enrolledStudent(userId: string, name: string) {
  return {
    id: `profile-${userId}`,
    userId,
    studentNumber: userId.toUpperCase(),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    user: {
      id: userId,
      name,
      email: `${userId}@example.test`,
    },
  };
}

function evidenceCache(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    userId,
    payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    refreshedAt: new Date(vi.getRealSystemTime() - TEST_DAY_MS),
    lastSourceFactAt: new Date('2026-05-20T08:00:00.000Z'),
    sourceFactCount: 12,
    evidenceWindow: {
      firstStartedAt: '2026-05-02T00:00:00.000Z',
      lastStartedAt: '2026-05-20T08:00:00.000Z',
      daysCovered: 18,
    },
    sourceCounts: {
      LearningFact: 12,
      StudentCompetencySnapshot: 1,
      StudentProfileSummary: 1,
      byFactType: { question: 8, 'course-evidence': 4 },
    },
    sourceCoverage: {
      LearningFact: 'available',
      StudentCompetencySnapshot: 'available',
      StudentProfileSummary: 'available',
    },
    confidenceMarkers: {
      level: 'high',
      score: 0.91,
      evidenceCount: 12,
      sourceCompleteness: 1,
    },
    statusMarkers: [],
    ...overrides,
  };
}

function simulationArenaFeature(overrides: Partial<StudentSimulationArenaFeatureSummary> = {}): StudentSimulationArenaFeatureSummary {
  return {
    recent30d: {
      window: {
        firstStartedAt: '2026-05-20T08:00:00.000Z',
        lastStartedAt: '2026-05-20T08:00:00.000Z',
        daysCovered: 0,
      },
      evidenceCount: 2,
      completedCount: 1,
      officialCount: 1,
      previewCount: 0,
      agentAssistedCount: 0,
      courseLaunchedCount: 2,
      standaloneCount: 0,
      traceReferenceCount: 2,
      sourceCoverage: {
        simulation: 'available',
        arena: 'available',
        traceReferences: 'available',
        replayConfidence: 'available',
      },
      replayConfidence: {
        average: 0.86,
        highConfidenceCount: 2,
        lowConfidenceCount: 0,
        missingCount: 0,
      },
      interventionOutcome: {
        reviewedCount: 0,
        improvedCount: 0,
        lowConfidenceCount: 0,
      },
      weakMetrics: [
        { metricId: 'trackingError', affectedFactCount: 2, lowestValue: 0.42 },
      ],
      qualityMarkers: [],
      traceReferences: [
        {
          source: 'arena',
          traceReference: 'ArenaEvaluationRun:official-run-1',
          factId: 'fact-arena-1',
          sourceEventId: 'fact-arena-1:event',
          sourceLogId: 'fact-arena-1:log',
          startedAt: '2026-05-20T08:00:00.000Z',
          protocolVersion: 'arena-eval-v1',
          checksum: 'checksum-safe',
        },
      ],
    },
    allTime: {
      window: {
        firstStartedAt: '2026-05-20T08:00:00.000Z',
        lastStartedAt: '2026-05-20T08:00:00.000Z',
        daysCovered: 0,
      },
      evidenceCount: 2,
      completedCount: 1,
      officialCount: 1,
      previewCount: 0,
      agentAssistedCount: 0,
      courseLaunchedCount: 2,
      standaloneCount: 0,
      traceReferenceCount: 2,
      sourceCoverage: {
        simulation: 'available',
        arena: 'available',
        traceReferences: 'available',
        replayConfidence: 'available',
      },
      replayConfidence: {
        average: 0.86,
        highConfidenceCount: 2,
        lowConfidenceCount: 0,
        missingCount: 0,
      },
      interventionOutcome: {
        reviewedCount: 0,
        improvedCount: 0,
        lowConfidenceCount: 0,
      },
      weakMetrics: [
        { metricId: 'trackingError', affectedFactCount: 2, lowestValue: 0.42 },
      ],
      qualityMarkers: [],
      traceReferences: [
        {
          source: 'arena',
          traceReference: 'ArenaEvaluationRun:official-run-1',
          factId: 'fact-arena-1',
          sourceEventId: 'fact-arena-1:event',
          sourceLogId: 'fact-arena-1:log',
          startedAt: '2026-05-20T08:00:00.000Z',
          protocolVersion: 'arena-eval-v1',
          checksum: 'checksum-safe',
        },
      ],
    },
    ...overrides,
  };
}

function scopedSimulationArenaFact(
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  const id = typeof overrides.id === 'string' ? overrides.id : `sim-fact-${userId}`;
  return {
    id,
    userId,
    factType: overrides.factType ?? 'simulation',
    moduleId: overrides.moduleId ?? 'unit-5-2-nonlinear-analysis-entry',
    sessionId: overrides.sessionId ?? 'session-current',
    startedAt: overrides.startedAt ?? new Date('2026-05-20T08:00:00.000Z'),
    finishedAt: overrides.finishedAt ?? new Date('2026-05-20T08:10:00.000Z'),
    outcome: overrides.outcome ?? 'partial',
    score: overrides.score ?? 62,
    timeSpent: overrides.timeSpent ?? 600,
    competencyContribution: overrides.competencyContribution ?? {},
    sourceEventId: overrides.sourceEventId ?? `${id}:event`,
    sourceLogId: overrides.sourceLogId ?? `${id}:log`,
    courseId: overrides.courseId ?? 'course-1',
    lessonId: overrides.lessonId ?? 'unit-5-2-nonlinear-analysis-entry',
    contextJson: overrides.contextJson ?? {
      arena: {
        classId: 'class-1',
        taskId: 'task-cruise-roll',
        official: true,
        valid: false,
        traceReference: `ArenaEvaluationRun:${id}`,
        replayConfidence: 0.86,
        satisfaction: {
          trackingError: 0.42,
        },
      },
      evidenceGovernance: {
        policyReason: 'official_arena_evaluation',
      },
    },
    createdAt: overrides.createdAt ?? new Date('2026-05-20T08:10:00.000Z'),
  };
}

function teacherStatusWithSimulationArena(
  simulationArena: ReturnType<typeof simulationArenaFeature>,
): TeacherStudentEvidenceStatus {
  return {
    state: 'ready',
    refreshedAt: '2026-05-20T00:00:00.000Z',
    lastEvidenceAt: '2026-05-20T08:00:00.000Z',
    evidenceWindow: {
      firstStartedAt: '2026-05-20T08:00:00.000Z',
      lastStartedAt: '2026-05-20T08:00:00.000Z',
      daysCovered: 0,
    },
    sourceCounts: {
      LearningFact: 1,
      StudentCompetencySnapshot: 0,
      StudentProfileSummary: 0,
      byFactType: { simulation: 1 },
    },
    sourceCoverage: {
      LearningFact: 'available',
      StudentCompetencySnapshot: 'missing',
      StudentProfileSummary: 'missing',
    },
    confidence: {
      level: 'high',
      score: 0.9,
      evidenceCount: 1,
      sourceCompleteness: 1,
    },
    statusMarkers: [],
    simulationArena: simulationArena as TeacherStudentEvidenceStatus['simulationArena'],
  };
}

function evidenceFactGroup(
  userId: string,
  factType: string,
  count: number,
  firstStartedAt: string,
  lastStartedAt: string,
) {
  return {
    userId,
    factType,
    _count: { _all: count },
    _min: { startedAt: new Date(firstStartedAt) },
    _max: { startedAt: new Date(lastStartedAt) },
  };
}

function competencyVector(score: number) {
  return {
    controlModeling: { score, trend: 'stable', confidence: 0.8, evidenceCount: 2, lastUpdated: '2026-05-20T00:00:00.000Z' },
    parameterDesign: { score, trend: 'stable', confidence: 0.8, evidenceCount: 2, lastUpdated: '2026-05-20T00:00:00.000Z' },
    crossDomainTransfer: { score, trend: 'stable', confidence: 0.8, evidenceCount: 2, lastUpdated: '2026-05-20T00:00:00.000Z' },
    engineeringDecision: { score, trend: 'stable', confidence: 0.8, evidenceCount: 2, lastUpdated: '2026-05-20T00:00:00.000Z' },
    inquiryReflection: { score, trend: 'stable', confidence: 0.8, evidenceCount: 2, lastUpdated: '2026-05-20T00:00:00.000Z' },
    selfDirectedLearning: { score, trend: 'stable', confidence: 0.8, evidenceCount: 2, lastUpdated: '2026-05-20T00:00:00.000Z' },
  };
}

function nativePortraitSnapshot(
  userId = 'student-v2-only',
  generatedAt = '2026-05-20T08:00:00.000Z',
  hasEvidence = true,
) {
  const payload = createPortraitV2Payload({
    userId,
    generatedAt,
    now: new Date(generatedAt),
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => ({
      id,
      score: hasEvidence ? 72 : 0,
      confidence: hasEvidence ? 0.8 : 0,
      freshness: {
        state: hasEvidence ? 'current' as const : 'missing' as const,
        asOf: hasEvidence ? generatedAt : null,
        evidenceAgeDays: hasEvidence ? 0 : null,
      },
      evidenceSummary: {
        totalCount: hasEvidence ? 1 : 0,
        sourceFamilyCounts: hasEvidence ? { LearningFact: 1 } : {} as Record<string, number>,
      },
      lastPositiveEvidenceAt: hasEvidence ? generatedAt : null,
      lastNegativeEvidenceAt: null,
      rationale: hasEvidence ? 'Governed evidence supports the current score.' : 'No safe legacy mapping exists.',
      limitations: hasEvidence ? [] : ['missing-native-portrait-v2-evidence'],
      sourceLineage: hasEvidence ? [{
        kind: 'evidence-family' as const,
        ref: 'LearningFact',
        privacyScope: 'student-visible' as const,
      }] : [],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });

  return {
    id: `portrait:${userId}`,
    userId,
    snapshotAt: new Date(generatedAt),
    payloadVersion: payload.payloadVersion,
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    migrationVersion: payload.migrationVersion,
    derivationKind: payload.derivation.kind,
    payload,
  };
}

describe('teacher evidence governance insights', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-21T00:00:00.000Z'));
    vi.clearAllMocks();

    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prismaArenaSubmissionStore.listSubmissions.mockResolvedValue([]);
    mocks.generateRecommendations.mockResolvedValue([]);
    mocks.prisma.$queryRaw.mockResolvedValue([{ exists: false }]);
    mocks.prisma.diagnosisReportSnapshot.findMany.mockResolvedValue([]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([]);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('weights class replay confidence by available replay evidence count', () => {
    const summary = summarizeTeacherEvidenceCoverage([
      teacherStatusWithSimulationArena(simulationArenaFeature({
        allTime: {
          ...simulationArenaFeature().allTime,
          evidenceCount: 1,
          replayConfidence: {
            average: 0.95,
            highConfidenceCount: 1,
            lowConfidenceCount: 0,
            missingCount: 0,
          },
        },
      })),
      teacherStatusWithSimulationArena(simulationArenaFeature({
        allTime: {
          ...simulationArenaFeature().allTime,
          evidenceCount: 9,
          replayConfidence: {
            average: 0.2,
            highConfidenceCount: 0,
            lowConfidenceCount: 9,
            missingCount: 0,
          },
        },
      })),
    ]);

    expect(summary.simulationArena.replayConfidence).toMatchObject({
      average: 0.28,
      lowConfidenceStudents: 1,
    });
  });

  it('does not linearly scan user ids while grouping scoped simulation Arena facts', () => {
    const userIds = ['student-ready', 'student-low'];
    const includesSpy = vi.spyOn(userIds, 'includes');

    const scopedFeatureMap = buildTeacherScopedSimulationArenaFeatureMap(
      userIds,
      [
        scopedSimulationArenaFact('student-ready', { id: 'ready-sim-1' }),
        scopedSimulationArenaFact('student-low', { id: 'low-sim-1' }),
      ] as any,
      {
        classId: 'class-1',
        sessionIds: ['session-current'],
        now: new Date('2026-05-21T00:00:00.000Z'),
      },
    );

    expect(includesSpy).not.toHaveBeenCalled();
    expect(scopedFeatureMap.get('student-ready')?.allTime.evidenceCount).toBe(1);
    expect(scopedFeatureMap.get('student-low')?.allTime.evidenceCount).toBe(1);
  });

  it('keeps simulationTrace and agentTool class scope in teacher evidence filters and in-memory grouping', () => {
    expect(buildTeacherScopedLearningFactScopeFilters('class-1', [])).toEqual(
      expect.arrayContaining([
        { contextJson: { path: ['simulationTrace', 'classId'], equals: 'class-1' } },
        { contextJson: { path: ['simulationTrace', 'governanceContext', 'classId'], equals: 'class-1' } },
        { contextJson: { path: ['agentTool', 'governanceContext', 'classId'], equals: 'class-1' } },
      ]),
    );

    const scopedFeatureMap = buildTeacherScopedSimulationArenaFeatureMap(
      ['student-ready'],
      [
        scopedSimulationArenaFact('student-ready', {
          id: 'trace-scoped-sim',
          sessionId: null,
          contextJson: {
            simulationTrace: {
              classId: 'class-1',
              traceReference: 'SimulationLog:trace-scoped-sim',
            },
          },
        }),
        scopedSimulationArenaFact('student-ready', {
          id: 'trace-other-class-sim',
          sessionId: null,
          contextJson: {
            simulationTrace: {
              classId: 'class-other',
              traceReference: 'SimulationLog:trace-other-class-sim',
            },
          },
        }),
        scopedSimulationArenaFact('student-ready', {
          id: 'agent-tool-scoped-sim',
          factType: 'ai_intervention',
          sessionId: null,
          contextJson: {
            agentTool: {
              agentToolRunId: 'tool-run-1',
              agentAssisted: true,
              interventionOutcome: 0.82,
              governanceContext: {
                classId: 'class-1',
              },
            },
          },
        }),
        scopedSimulationArenaFact('student-ready', {
          id: 'agent-tool-other-class-sim',
          factType: 'ai_intervention',
          sessionId: null,
          contextJson: {
            agentTool: {
              agentToolRunId: 'tool-run-2',
              agentAssisted: true,
              interventionOutcome: 0.91,
              governanceContext: {
                classId: 'class-other',
              },
            },
          },
        }),
      ] as any,
      {
        classId: 'class-1',
        sessionIds: [],
        now: new Date('2026-05-21T00:00:00.000Z'),
      },
    );

    expect(scopedFeatureMap.get('student-ready')?.allTime.evidenceCount).toBe(2);
    expect(scopedFeatureMap.get('student-ready')?.allTime.interventionOutcome).toMatchObject({
      reviewedCount: 1,
      improvedCount: 1,
      lowConfidenceCount: 0,
    });
  });

  it('returns class evidence coverage counts and per-student cache state', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'AC101',
      description: '数据治理试点班',
      semester: '春季',
      year: '2026',
      teacherId: 'teacher-1',
      students: [
        enrolledStudent('student-ready', '证据充分'),
        enrolledStudent('student-stale', '证据过期'),
        enrolledStudent('student-low', '低置信'),
        enrolledStudent('student-missing', '缺证据'),
      ],
    });
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([
      {
        userId: 'student-ready',
        snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
        competencyVector: competencyVector(82),
        factCount: 12,
      },
    ]);
    mocks.prisma.studentProfileSummary.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.learningRecommendation.groupBy.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        scopedSimulationArenaFact('student-ready', { id: 'ready-sim-1' }),
        scopedSimulationArenaFact('student-ready', { id: 'ready-sim-2' }),
        scopedSimulationArenaFact('student-low', {
          id: 'low-sim-1',
          contextJson: {
            arena: {
              classId: 'class-1',
              taskId: 'task-cruise-roll',
              official: true,
              valid: false,
              traceReference: 'ArenaEvaluationRun:low-sim-1',
              replayConfidence: 0.34,
              satisfaction: {
                trackingError: 0.42,
              },
            },
            evidenceGovernance: {
              policyReason: 'official_arena_evaluation',
            },
          },
        }),
        scopedSimulationArenaFact('student-low', {
          id: 'low-sim-2',
          contextJson: {
            arena: {
              classId: 'class-1',
              taskId: 'task-cruise-roll',
              official: true,
              valid: false,
              traceReference: 'ArenaEvaluationRun:low-sim-2',
              replayConfidence: 0.34,
              satisfaction: {
                trackingError: 0.42,
              },
            },
            evidenceGovernance: {
              policyReason: 'official_arena_evaluation',
            },
          },
        }),
      ]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([
      evidenceCache('student-ready', {
        features: { simulationArena: simulationArenaFeature() },
      }),
      evidenceCache('student-stale', {
        refreshedAt: new Date(vi.getRealSystemTime() - 30 * TEST_DAY_MS),
      }),
      evidenceCache('student-low', {
        features: {
          simulationArena: simulationArenaFeature({
            allTime: {
              ...simulationArenaFeature().allTime,
              replayConfidence: {
                average: 0.34,
                highConfidenceCount: 0,
                lowConfidenceCount: 2,
                missingCount: 0,
              },
              qualityMarkers: ['low-confidence', 'partial'],
            },
            recent30d: {
              ...simulationArenaFeature().recent30d,
              replayConfidence: {
                average: 0.34,
                highConfidenceCount: 0,
                lowConfidenceCount: 2,
                missingCount: 0,
              },
              qualityMarkers: ['low-confidence', 'partial'],
            },
          }),
        },
      }),
      evidenceCache('student-missing'),
    ]);
    mocks.prisma.classSession.findMany.mockResolvedValue([
      { id: 'session-current' },
    ]);
    mocks.prisma.learningFact.groupBy.mockResolvedValue([
      evidenceFactGroup(
        'student-ready',
        'course-evidence',
        12,
        '2026-05-02T00:00:00.000Z',
        '2026-05-20T08:00:00.000Z',
      ),
      evidenceFactGroup(
        'student-stale',
        'course-evidence',
        12,
        '2026-03-01T00:00:00.000Z',
        '2026-04-01T00:00:00.000Z',
      ),
      evidenceFactGroup(
        'student-low',
        'course-evidence',
        2,
        '2026-05-19T00:00:00.000Z',
        '2026-05-20T08:00:00.000Z',
      ),
    ]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([
      {
        id: 'report-1',
        sessionId: 'session-5-2',
        lessonKey: 'unit-5-2-nonlinear-analysis-entry',
        status: 'READY',
        summary: '5-2 富证据课堂',
        updatedAt: new Date('2026-05-20T10:00:00.000Z'),
        reportData: {
          qualityStatus: { status: 'green', reasons: ['healthy_quality_gate'] },
        },
        session: {
          id: 'session-5-2',
          startTime: new Date('2026-05-20T08:00:00.000Z'),
          endTime: new Date('2026-05-20T09:30:00.000Z'),
          plan: { title: '5-2 非线性分析入口' },
        },
      },
    ]);

    const response = await getClassInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentEvidenceFeatureCache.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['student-ready', 'student-stale', 'student-low', 'student-missing'] } },
      select: {
        userId: true,
        payloadVersion: true,
        refreshedAt: true,
        statusMarkers: true,
        features: true,
      },
    });
    expect(mocks.prisma.classSession.findMany).toHaveBeenCalledWith({
      where: { classId: 'class-1' },
      select: { id: true },
    });
    expect(mocks.prisma.learningFact.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['userId', 'factType'],
      where: {
        userId: { in: ['student-ready', 'student-stale', 'student-low', 'student-missing'] },
        OR: expect.arrayContaining([
          { sessionId: { in: ['session-current'] } },
          { contextJson: { path: ['arena', 'classId'], equals: 'class-1' } },
          { contextJson: { path: ['agentTool', 'governanceContext', 'classId'], equals: 'class-1' } },
        ]),
      },
    }));
    expect(mocks.prisma.learningFact.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        userId: { in: ['student-ready', 'student-stale', 'student-low', 'student-missing'] },
        OR: expect.arrayContaining([
          { sessionId: { in: ['session-current'] } },
          { contextJson: { path: ['arena', 'classId'], equals: 'class-1' } },
          { contextJson: { path: ['agentTool', 'governanceContext', 'classId'], equals: 'class-1' } },
        ]),
      },
      select: expect.objectContaining({
        id: true,
        userId: true,
        factType: true,
        contextJson: true,
      }),
    }));
    expect(mocks.prisma.learningFact.findMany.mock.calls[1][0].where).not.toHaveProperty('factType');
    expect(mocks.prisma.learningFact.findMany.mock.calls[1][0]).not.toHaveProperty('take');
    expect(body.governance.evidenceCoverage).toMatchObject({
      totalStudents: 4,
      readyStudents: 2,
      staleStudents: 1,
      missingStudents: 1,
      lowConfidenceStudents: 1,
      cacheCoverageRatio: 0.75,
      simulationArena: {
        totalStudents: 4,
        studentsWithEvidence: 2,
        lowConfidenceStudents: 1,
        officialStudents: 2,
        courseLaunchedStudents: 2,
        replayConfidence: {
          average: 0.6,
          lowConfidenceStudents: 1,
        },
        weakMetricDistribution: [
          { metricId: 'trackingError', affectedStudentCount: 2, affectedFactCount: 4 },
        ],
      },
    });
    expect(body.governance.recentSessionQuality).toMatchObject({
      totalReports: 1,
      green: 1,
      yellow: 0,
      red: 0,
    });
    expect(body.students.find((student: { id: string }) => student.id === 'student-ready').evidenceStatus).toMatchObject({
      state: 'ready',
      confidence: {
        level: 'high',
        score: 0.91,
        evidenceCount: 12,
      },
      sourceCoverage: {
        LearningFact: 'available',
        StudentCompetencySnapshot: 'missing',
        StudentProfileSummary: 'missing',
      },
      lastEvidenceAt: '2026-05-20T08:00:00.000Z',
      simulationArena: {
        allTime: {
          evidenceCount: 2,
          traceReferenceCount: 2,
        },
      },
    });
    expect(body.students.find((student: { id: string }) => student.id === 'student-missing').evidenceStatus).toMatchObject({
      state: 'missing',
      confidence: { level: 'none', evidenceCount: 0 },
      lastEvidenceAt: null,
    });
  });

  it('uses native portrait evidence metadata for a v2-only class student', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'AC101',
      description: '数据治理试点班',
      semester: '春季',
      year: '2026',
      teacherId: 'teacher-1',
      students: [enrolledStudent('student-v2-only', '原生画像学生')],
    });
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([]);
    mocks.prisma.studentProfileSummary.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.learningRecommendation.groupBy.mockResolvedValue([]);
    mocks.prisma.classSession.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.groupBy.mockResolvedValue([]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([]);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(nativePortraitSnapshot());

    const response = await getClassInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.students[0]).toMatchObject({
      id: 'student-v2-only',
      overallScoreSource: 'portrait-v2',
      factCount: 7,
      lastSnapshotAt: '2026-05-20T08:00:00.000Z',
    });
    expect(body.governance.latestStudentSnapshotAt).toBe('2026-05-20T08:00:00.000Z');
  });

  it('uses the newer portrait v2 timestamp when it is later than the legacy snapshot', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'AC101',
      description: '数据治理试点班',
      semester: '春季',
      year: '2026',
      teacherId: 'teacher-1',
      students: [enrolledStudent('student-v2-newer', '原生画像较新学生')],
    });
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([
      {
        userId: 'student-v2-newer',
        snapshotAt: new Date('2026-05-20T08:00:00.000Z'),
        competencyVector: competencyVector(72),
        factCount: 6,
      },
    ]);
    mocks.prisma.studentProfileSummary.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.learningRecommendation.groupBy.mockResolvedValue([]);
    mocks.prisma.classSession.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.groupBy.mockResolvedValue([]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([]);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(
      nativePortraitSnapshot('student-v2-newer', '2026-05-20T09:00:00.000Z'),
    );

    const response = await getClassInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.students[0].lastSnapshotAt).toBe('2026-05-20T09:00:00.000Z');
    expect(body.governance.latestStudentSnapshotAt).toBe('2026-05-20T09:00:00.000Z');
  });

  it('keeps legacy-backed students in class portrait summaries when the native portrait is empty', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'AC101',
      description: null,
      semester: '春季',
      year: '2026',
      teacherId: 'teacher-1',
      students: [enrolledStudent('student-legacy-backed', '兼容画像学生')],
    });
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([{
      userId: 'student-legacy-backed',
      snapshotAt: new Date('2026-05-20T08:00:00.000Z'),
      competencyVector: competencyVector(74),
      factCount: 12,
    }]);
    mocks.prisma.studentProfileSummary.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.learningRecommendation.groupBy.mockResolvedValue([]);
    mocks.prisma.classSession.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.groupBy.mockResolvedValue([]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([]);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(null);

    const response = await getClassInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.students[0].portraitV2).toMatchObject({
      derivationKind: 'compatibility-derived',
    });
    expect(body.students[0].portraitV2.dimensions.some(
      (dimension: { evidenceCount: number }) => dimension.evidenceCount > 0,
    )).toBe(true);
    expect(body.ability.dimensions.some((dimension: { mean: number }) => dimension.mean > 0)).toBe(true);
  });

  it('does not count global simulation Arena cache entries outside the current class scope', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'AC101',
      description: '数据治理试点班',
      semester: '春季',
      year: '2026',
      teacherId: 'teacher-1',
      students: [
        enrolledStudent('student-cross-class', '跨班证据'),
      ],
    });
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([]);
    mocks.prisma.studentProfileSummary.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.learningRecommendation.groupBy.mockResolvedValue([]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([
      evidenceCache('student-cross-class', {
        features: {
          simulationArena: simulationArenaFeature({
            allTime: {
              ...simulationArenaFeature().allTime,
              traceReferences: [
                {
                  source: 'arena',
                  traceReference: 'ArenaEvaluationRun:other-class-run',
                  factId: 'other-class-fact',
                  sourceEventId: 'other-class-fact:event',
                  sourceLogId: 'other-class-fact:log',
                  startedAt: '2026-05-20T08:00:00.000Z',
                },
              ],
            },
          }),
        },
      }),
    ]);
    mocks.prisma.classSession.findMany.mockResolvedValue([
      { id: 'session-current' },
    ]);
    mocks.prisma.learningFact.groupBy.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        scopedSimulationArenaFact('student-cross-class', {
          id: 'other-class-fact',
          sessionId: 'other-session',
          contextJson: {
            arena: {
              classId: 'other-class',
              taskId: 'task-cruise-roll',
              official: true,
              traceReference: 'ArenaEvaluationRun:other-class-run',
              replayConfidence: 0.91,
            },
          },
        }),
      ]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([]);

    const response = await getClassInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.governance.evidenceCoverage.simulationArena).toMatchObject({
      totalStudents: 1,
      studentsWithEvidence: 0,
      missingStudents: 1,
      officialStudents: 0,
      courseLaunchedStudents: 0,
    });
    expect(body.students[0].evidenceStatus.simulationArena.allTime).toMatchObject({
      evidenceCount: 0,
      traceReferenceCount: 0,
      traceReferences: [],
    });
    expect(JSON.stringify(body)).not.toContain('other-class-run');
  });

  it('uses cache health to avoid marking stale feature data as ready', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'AC101',
      description: '数据治理试点班',
      semester: '春季',
      year: '2026',
      teacherId: 'teacher-1',
      students: [
        enrolledStudent('student-stale-cache', '缓存过期'),
      ],
    });
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([]);
    mocks.prisma.studentProfileSummary.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.learningRecommendation.groupBy.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.classSession.findMany.mockResolvedValue([
      { id: 'session-current' },
    ]);
    mocks.prisma.learningFact.groupBy.mockResolvedValue([
      evidenceFactGroup(
        'student-stale-cache',
        'course-evidence',
        12,
        '2026-05-20T08:00:00.000Z',
        '2026-05-20T08:30:00.000Z',
      ),
    ]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([
      {
        userId: 'student-stale-cache',
        refreshedAt: new Date('2026-03-01T00:00:00.000Z'),
        statusMarkers: ['stale'],
      },
    ]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([]);

    const response = await getClassInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.students[0].evidenceStatus).toMatchObject({
      state: 'stale',
      refreshedAt: '2026-03-01T00:00:00.000Z',
      lastEvidenceAt: '2026-05-20T08:30:00.000Z',
      sourceCounts: {
        LearningFact: 12,
      },
      statusMarkers: expect.arrayContaining(['stale']),
    });
    expect(body.governance.evidenceCoverage).toMatchObject({
      readyStudents: 0,
      staleStudents: 1,
      missingStudents: 0,
    });
  });

  it('treats outdated class cache-health payloads as stale even when recently refreshed', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'AC101',
      description: '数据治理试点班',
      semester: '春季',
      year: '2026',
      teacherId: 'teacher-1',
      students: [
        enrolledStudent('student-v1-cache', '旧缓存'),
      ],
    });
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([]);
    mocks.prisma.studentProfileSummary.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.learningRecommendation.groupBy.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.classSession.findMany.mockResolvedValue([
      { id: 'session-current' },
    ]);
    mocks.prisma.learningFact.groupBy.mockResolvedValue([
      evidenceFactGroup(
        'student-v1-cache',
        'course-evidence',
        12,
        '2026-05-20T08:00:00.000Z',
        '2026-05-20T08:30:00.000Z',
      ),
    ]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([
      {
        userId: 'student-v1-cache',
        payloadVersion: 'student-evidence-features.v1',
        refreshedAt: new Date('2026-05-20T09:00:00.000Z'),
        statusMarkers: [],
      },
    ]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([]);

    const response = await getClassInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.students[0].evidenceStatus).toMatchObject({
      state: 'stale',
      statusMarkers: expect.arrayContaining(['stale']),
    });
    expect(body.governance.evidenceCoverage).toMatchObject({
      readyStudents: 0,
      staleStudents: 1,
      missingStudents: 0,
    });
  });

  it('keeps existing profile summaries when a class has no sessions yet', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      code: 'AC101',
      description: '新建班级',
      semester: '春季',
      year: '2026',
      teacherId: 'teacher-1',
      students: [
        enrolledStudent('student-onboarding', '已有画像'),
      ],
    });
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue([]);
    mocks.prisma.studentProfileSummary.findMany.mockResolvedValue([
      {
        userId: 'student-onboarding',
        overallScore: 88.4,
        overallLevel: '优秀',
        riskLevel: 'low',
        trendDirection: 'up',
        recentTrend: '近期表现稳定提升',
        strengthsJson: ['模型表达'],
        weaknessesJson: [],
        riskFlagsJson: [],
      },
    ]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.groupBy.mockResolvedValue([]);
    mocks.prisma.learningRecommendation.groupBy.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.classSession.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.groupBy.mockResolvedValue([]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([]);

    const response = await getClassInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfileSummary.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['student-onboarding'] } },
    });
    expect(body.students[0]).toMatchObject({
      id: 'student-onboarding',
      overallScore: 88.4,
      overallLevel: '优秀',
      riskLevel: 'low',
      trendDirection: 'up',
      recentTrend: '近期表现稳定提升',
    });
  });

  it('returns scoped student drawer evidence without raw answers or full logs', async () => {
    const classId = 'class-1';
    const longAnswer = '5-2 富证据主观作答。'.repeat(40);
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      id: 'profile-1',
      userId: 'student-1',
      studentNumber: 'S001',
      user: { id: 'student-1', name: '学生甲', email: 'student@example.test' },
    });
    mocks.prisma.studentCompetencySnapshot.findFirst
      .mockResolvedValueOnce({
        snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
        competencyVector: competencyVector(76),
        evidenceSummary: {
          engineeringDecision: [{
            factType: 'question',
            outcome: 'partial',
            score: 70,
            stepId: 'step-05',
            studentAnswer: longAnswer,
            privateKonlingMemory: 'private Konling memory secret',
            questionSummaries: [{
              questionId: 'q-1',
              prompt: '说明相平面边界',
              studentAnswer: longAnswer,
              referenceAnswer: longAnswer,
            }],
          }],
        },
        factCount: 9,
      })
      .mockResolvedValueOnce(null);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentProfileSummary.findUnique.mockResolvedValue(null);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.findMany.mockResolvedValue([]);
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache('student-1', {
      confidenceMarkers: {
        level: 'medium',
        score: 0.64,
        evidenceCount: 9,
        sourceCompleteness: 0.7,
      },
      features: {
        simulationArena: simulationArenaFeature({
          allTime: {
            ...simulationArenaFeature().allTime,
            traceReferences: [
              {
                source: 'arena',
                traceReference: 'ArenaEvaluationRun:official-run-1',
                factId: 'fact-arena-1',
                sourceEventId: 'fact-arena-1:event',
                sourceLogId: 'fact-arena-1:log',
                startedAt: '2026-05-20T08:00:00.000Z',
                hiddenOfficialEvaluation: 'official-secret',
                rawTracePayload: [{ t: 0, hidden: true }],
              } as unknown as StudentSimulationArenaFeatureSummary['allTime']['traceReferences'][number],
            ],
          },
        }),
      },
    }));
    mocks.prisma.classSession.findMany.mockResolvedValue([
      { id: 'session-5-2' },
    ]);
    mocks.prisma.learningFact.findMany.mockResolvedValueOnce([
        {
          id: 'fact-5-2',
          userId: 'student-1',
          factType: 'course-evidence',
          moduleId: 'unit-5-2-nonlinear-analysis-entry',
          lessonId: 'unit-5-2-nonlinear-analysis-entry',
          sessionId: 'session-5-2',
          startedAt: new Date('2026-05-20T08:10:00.000Z'),
          finishedAt: new Date('2026-05-20T08:16:00.000Z'),
          outcome: 'partial',
          score: null,
          timeSpent: 360,
          competencyContribution: {},
          sourceEventId: 'fact-5-2:event',
          sourceLogId: 'fact-5-2:log',
          courseId: 'course-1',
          contextJson: {},
          createdAt: new Date('2026-05-20T08:16:00.000Z'),
        },
        scopedSimulationArenaFact('student-1', {
          id: 'scoped-arena-fact',
          sessionId: 'session-5-2',
          contextJson: {
            arena: {
              classId: 'class-1',
              taskId: 'task-cruise-roll',
              official: true,
              valid: false,
              traceReference: 'ArenaEvaluationRun:scoped-run-1',
              replayConfidence: 0.86,
              satisfaction: {
                trackingError: 0.42,
              },
            },
            evidenceGovernance: {
              policyReason: 'official_arena_evaluation',
            },
          },
        }),
      ]);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([
      {
        id: 'response-1',
        sessionId: 'session-5-2',
        lessonKey: 'unit-5-2-nonlinear-analysis-entry',
        stepId: 'step-05',
        attemptKey: 'attempt-1',
        submittedAt: new Date('2026-05-20T08:16:00.000Z'),
        responseData: {
          schemaVersion: 'manifest-submission-v2',
          questionSummaries: [{
            questionId: 'q-1',
            studentAnswer: longAnswer,
            referenceAnswer: '参考边界',
            isCorrect: false,
          }],
          score: 70,
        },
        session: {
          id: 'session-5-2',
          plan: { title: '5-2 非线性分析入口' },
        },
      },
    ]);
    mocks.prisma.studentSessionReport.findMany.mockResolvedValue([
      {
        id: 'student-report-1',
        sessionId: 'session-5-2',
        lessonKey: 'unit-5-2-nonlinear-analysis-entry',
        status: 'READY',
        summary: '1 条互动日志，1 条学习事实。',
        updatedAt: new Date('2026-05-20T10:00:00.000Z'),
        reportData: {
          interactionLogs: 1,
          learningFacts: 1,
          durableSubmissions: 1,
        },
        session: {
          id: 'session-5-2',
          startTime: new Date('2026-05-20T08:00:00.000Z'),
          endTime: new Date('2026-05-20T09:30:00.000Z'),
          plan: { title: '5-2 非线性分析入口' },
        },
      },
    ]);
    mocks.prisma.classSessionReport.findMany.mockResolvedValue([
      {
        id: 'class-report-1',
        sessionId: 'session-5-2',
        status: 'READY',
        summary: '5-2 富证据课堂',
        updatedAt: new Date('2026-05-20T10:00:00.000Z'),
        reportData: {
          qualityStatus: {
            status: 'green',
            reasons: ['healthy_quality_gate'],
          },
        },
      },
    ]);

    const response = await getStudentInsights(
      new Request('http://localhost/api/teacher/classes/class-1/students/student-1/insights'),
      { params: Promise.resolve({ classId: 'class-1', studentId: 'student-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overview.overallScore).toBe(76);
    expect(body.overview.portraitV2).toMatchObject({
      derivationKind: 'compatibility-derived',
    });
    expect(body.snapshot.current.portrait).toEqual(body.overview.portraitV2);
    expect(body.classComparison.some((dimension: { studentScore: number }) => dimension.studentScore > 0)).toBe(true);
    expect(mocks.prisma.classSession.findMany).toHaveBeenCalledWith({
      where: { classId },
      select: { id: true },
    });
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'student-1',
        OR: expect.arrayContaining([
          { sessionId: { in: ['session-5-2'] } },
          { contextJson: { path: ['arena', 'classId'], equals: 'class-1' } },
          { contextJson: { path: ['agentTool', 'governanceContext', 'classId'], equals: 'class-1' } },
        ]),
      },
      select: expect.objectContaining({
        id: true,
        userId: true,
        factType: true,
        contextJson: true,
      }),
    }));
    expect(mocks.prisma.learningFact.findMany.mock.calls[0][0]).not.toHaveProperty('take');
    expect(mocks.prisma.studentStepResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'student-1',
        session: { classId },
      },
      take: 8,
      select: expect.objectContaining({ responseData: true }),
    }));
    expect(mocks.prisma.studentSessionReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'student-1',
        reportType: 'student-summary',
        session: { classId },
      },
    }));
    expect(body.evidenceDrawer.featureCache).toMatchObject({
      state: 'ready',
      sourceCounts: {
        LearningFact: 2,
        byFactType: {
          'course-evidence': 1,
          simulation: 1,
        },
      },
      evidenceWindow: {
        firstStartedAt: '2026-05-20T08:00:00.000Z',
        lastStartedAt: '2026-05-20T08:10:00.000Z',
      },
      confidence: {
        level: 'medium',
        evidenceCount: 2,
      },
      simulationArena: {
        allTime: {
          evidenceCount: 1,
          traceReferences: [
            {
              source: 'arena',
              traceReference: 'ArenaEvaluationRun:scoped-run-1',
              factId: 'scoped-arena-fact',
            },
          ],
        },
      },
    });
    expect(body.evidenceDrawer.recentFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'fact-5-2',
        lessonId: 'unit-5-2-nonlinear-analysis-entry',
      }),
    ]));
    expect(body.evidenceDrawer.durableSubmissions[0]).toMatchObject({
      id: 'response-1',
      lessonKey: 'unit-5-2-nonlinear-analysis-entry',
      quality: 'rich',
      scoreableObjectiveSubmissions: 1,
    });
    expect(body.evidenceDrawer.sessionQuality[0]).toMatchObject({
      sessionId: 'session-5-2',
      qualityStatus: 'green',
      studentReport: {
        durableSubmissions: 1,
        learningFacts: 1,
      },
    });
    expect(JSON.stringify(body)).not.toContain(longAnswer);
    expect(JSON.stringify(body)).not.toContain('private Konling memory secret');
    expect(JSON.stringify(body)).not.toContain('official-secret');
    expect(JSON.stringify(body)).not.toContain('official-run-1');
    expect(JSON.stringify(body)).not.toContain('rawTracePayload');
    expect(body.evidenceSummary[4].items[0].questionSummaries[0]).not.toHaveProperty('studentAnswer');
    expect(body.evidenceSummary[4].items[0].questionSummaries[0]).toEqual(expect.objectContaining({
      questionId: 'q-1',
      studentAnswerRedacted: true,
    }));
    expect(body.evidenceSummary[4].items[0].questionSummaries[0].referenceAnswer.length).toBeLessThanOrEqual(120);
    expect(body.evidenceSummary[4].items[0]).not.toHaveProperty('studentAnswer');
    expect(body.evidenceSummary[4].items[0]).not.toHaveProperty('privateKonlingMemory');
  });

  it('preserves feature-cache snapshot time and fact count for compatibility-only student insights', async () => {
    const cachedVector = competencyVector(70);
    Object.values(cachedVector).forEach((dimension) => {
      dimension.lastUpdated = '2026-05-19T09:00:00.000Z';
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      id: 'profile-1',
      userId: 'student-1',
      studentNumber: 'S001',
      user: { id: 'student-1', name: '学生甲', email: 'student@example.test' },
    });
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(
      nativePortraitSnapshot('student-1', '2026-05-20T00:00:00.000Z', false),
    );
    mocks.prisma.studentProfileSummary.findUnique.mockResolvedValue(null);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.findMany.mockResolvedValue([]);
    mocks.prisma.classCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache('student-1', {
      features: {
        approvedAggregates: {
          latestSnapshot: {
            authority: 'legacy-compatibility-only',
            snapshotAt: '2026-05-19T10:00:00.000Z',
            factCount: 9,
            competencyVector: cachedVector,
          },
        },
      },
    }));
    mocks.prisma.classSession.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([]);
    mocks.prisma.studentSessionReport.findMany.mockResolvedValue([]);

    const response = await getStudentInsights(
      new Request('http://localhost/api/teacher/classes/class-1/students/student-1/insights'),
      { params: Promise.resolve({ classId: 'class-1', studentId: 'student-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overview).toMatchObject({
      overallScore: 70,
      latestSnapshotAt: '2026-05-19T10:00:00.000Z',
      factCount: 9,
      portraitV2: { derivationKind: 'compatibility-derived' },
    });
    expect(body.snapshot.current).toMatchObject({
      snapshotAt: '2026-05-19T10:00:00.000Z',
      factCount: 9,
    });
  });

  it('denies student insights outside teacher class ownership', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '自动控制 1 班',
      teacherId: 'teacher-2',
    });

    const response = await getStudentInsights(
      new Request('http://localhost/api/teacher/classes/class-1/students/student-1/insights'),
      { params: Promise.resolve({ classId: 'class-1', studentId: 'student-1' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.studentProfile.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.learningFact.findMany).not.toHaveBeenCalled();
  });

  it('wires teacher pages to evidence governance fields', () => {
    const classPage = readFileSync(
      join(process.cwd(), 'src/app/teacher/classes/[classId]/page.tsx'),
      'utf8',
    );
    const studentPage = readFileSync(
      join(process.cwd(), 'src/app/teacher/classes/[classId]/students/[studentId]/page.tsx'),
      'utf8',
    );

    expect(classPage).toContain('evidenceCoverage');
    expect(classPage).toContain('证据状态');
    expect(classPage).toContain('formatTeacherEvidenceState');
    expect(studentPage).toContain('evidenceDrawer');
    expect(studentPage).toContain('证据治理');
    expect(studentPage).toContain('近期会话质量');
    expect(studentPage).toContain('持久提交');
  });
});
