import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_DAY_MS = 24 * 60 * 60 * 1000;

const mocks = vi.hoisted(() => {
  const getServerSession = vi.fn();
  const getServerAuthSession = vi.fn();
  const generateRecommendations = vi.fn();
  const prismaArenaSubmissionStore = {
    listSubmissions: vi.fn(),
  };

  return {
    getServerSession,
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
      studentProfileSummary: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      growthRecord: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      learningRecommendation: {
        groupBy: vi.fn(),
      },
      learningFact: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
      },
      studentEvidenceFeatureCache: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      studentPortraitV2Snapshot: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      classSessionReport: {
        findMany: vi.fn(),
      },
      studentProfile: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
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

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
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
import { GET as getClassHeatmap } from '@/app/api/teacher/classes/[classId]/heatmap/route';
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
  const overrideContext = overrides.contextJson && typeof overrides.contextJson === 'object' && !Array.isArray(overrides.contextJson)
    ? overrides.contextJson as Record<string, unknown>
    : {};
  const overrideGovernance = overrideContext.evidenceGovernance && typeof overrideContext.evidenceGovernance === 'object'
    && !Array.isArray(overrideContext.evidenceGovernance)
    ? overrideContext.evidenceGovernance as Record<string, unknown>
    : {};
  const { contextJson: _ignoredContextJson, ...rest } = overrides;
  return {
    id,
    userId,
    factType: rest.factType ?? 'simulation',
    moduleId: rest.moduleId ?? 'unit-5-2-nonlinear-analysis-entry',
    sessionId: rest.sessionId ?? 'session-current',
    startedAt: rest.startedAt ?? new Date('2026-05-20T08:00:00.000Z'),
    finishedAt: rest.finishedAt ?? new Date('2026-05-20T08:10:00.000Z'),
    outcome: rest.outcome ?? 'partial',
    score: rest.score ?? 62,
    timeSpent: rest.timeSpent ?? 600,
    competencyContribution: rest.competencyContribution ?? {},
    sourceEventId: rest.sourceEventId ?? `${id}:event`,
    sourceLogId: rest.sourceLogId ?? `${id}:log`,
    courseId: rest.courseId ?? 'course-1',
    lessonId: rest.lessonId ?? 'unit-5-2-nonlinear-analysis-entry',
    contextJson: {
      ...(Object.keys(overrideContext).length > 0 ? {} : {
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
      }),
      ...overrideContext,
      evidenceGovernance: {
        profileWeight: 1,
        skipProfileContribution: false,
        policyReason: 'official_arena_evaluation',
        ...overrideGovernance,
      },
    },
    createdAt: rest.createdAt ?? new Date('2026-05-20T08:10:00.000Z'),
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
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prismaArenaSubmissionStore.listSubmissions.mockResolvedValue([]);
    mocks.generateRecommendations.mockResolvedValue([]);
    mocks.prisma.$queryRaw.mockResolvedValue([{ exists: false }]);
    mocks.prisma.diagnosisReportSnapshot.findMany.mockResolvedValue([]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([]);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentPortraitV2Snapshot.findMany.mockResolvedValue([]);
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

  it('wires teacher pages to cumulative portrait fields', () => {
    const classPage = readFileSync(
      join(process.cwd(), 'src/app/teacher/classes/[classId]/page.tsx'),
      'utf8',
    );
    const studentPage = readFileSync(
      join(process.cwd(), 'src/app/teacher/classes/[classId]/students/[studentId]/page.tsx'),
      'utf8',
    );
    const analyticsPage = readFileSync(
      join(process.cwd(), 'src/app/teacher/classes/[classId]/analytics-v2/page.tsx'),
      'utf8',
    );

    expect(classPage).toContain('累计能力达成指数');
    expect(classPage).toContain('累计证据状态');
    expect(classPage).toContain('最后累计趋势');
    expect(classPage).toContain('formatTeacherEvidenceState');
    expect(classPage).toContain("insights.overview.overallIndex ?? '不可用'");
    expect(classPage).toContain("insight.overallScore ?? '不可用'");
    expect(studentPage).toContain('累计能力达成');
    expect(studentPage).toContain('最后证据状态');
    expect(studentPage).toContain('七维累计能力与班级对比');
    expect(studentPage).toContain('缺失证据不计为零');
    expect(studentPage).toContain('活动按发生时间倒序展示');
    expect(studentPage).toContain('专项诊断是累计七维能力达成的从属入口');
    expect(studentPage).toContain('持久提交');
    expect(analyticsPage).toContain("student.overallScore ?? '不可用'");
  });
});
