import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  readCurrentCumulativePortrait: vi.fn(),
  readCurrentCumulativeClassPortrait: vi.fn(),
  materializeRoleBasedLearningDiagnosis: vi.fn(),
  prisma: {
    class: { findUnique: vi.fn() },
    studentProfile: { findFirst: vi.fn() },
    learningFact: { findMany: vi.fn() },
    studentStepResponse: { findMany: vi.fn() },
    studentSessionReport: { findMany: vi.fn() },
    growthRecord: { findMany: vi.fn() },
    diagnosisReportSnapshot: {},
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/data-governance/cumulative-portrait-read-model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../cumulative-portrait-read-model')>();
  return {
    ...actual,
    readCurrentCumulativePortrait: mocks.readCurrentCumulativePortrait,
    readCurrentCumulativeClassPortrait: mocks.readCurrentCumulativeClassPortrait,
  };
});

vi.mock('@/lib/data-governance/control-correction-diagnosis-profile', () => ({
  createPrismaDiagnosisReportSnapshotStore: vi.fn(),
  hasDiagnosisReportSnapshotPersistenceTable: vi.fn().mockResolvedValue(false),
  readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence: vi.fn(),
}));

vi.mock('@/lib/data-governance/role-based-learning-diagnosis', () => ({
  materializeRoleBasedLearningDiagnosis: mocks.materializeRoleBasedLearningDiagnosis,
}));

import { GET } from '@/app/api/teacher/classes/[classId]/students/[studentId]/insights/route';
import { PORTRAIT_V2_DIMENSIONS } from '../kaq-objective-taxonomy';

const OLD_EVIDENCE_AT = '2025-12-01T08:00:00.000Z';

function cumulativePortrait() {
  return {
    stateKind: 'SNAPSHOT',
    payload: {
      userId: 'student-1',
      payloadVersion: 'portrait-v2.1',
      migrationVersion: 'portrait-v2.migration.1',
      generatedAt: OLD_EVIDENCE_AT,
      derivation: { kind: 'native', limitations: [] },
      dimensions: PORTRAIT_V2_DIMENSIONS.map(({ id, label }, index) => ({
        id,
        label,
        score: index === 1 ? 55 : 80 + index,
        confidence: 0.8,
        trend: 'stable',
        freshness: {
          state: 'current',
          asOf: OLD_EVIDENCE_AT,
          evidenceAgeDays: 200,
        },
        evidenceSummary: {
          totalCount: 2,
          sourceFamilyCounts: { LearningFact: 2 },
        },
        lastPositiveEvidenceAt: OLD_EVIDENCE_AT,
        lastNegativeEvidenceAt: null,
        rationale: 'Governed evidence supports the current score.',
        limitations: [],
        sourceLineage: [{
          kind: 'hashed',
          ref: `sar:evidence:sha256:${String(index).padStart(64, '0')}`,
          privacyScope: 'teacher-scoped',
        }],
        calculationVersion: 'portrait-v2.cumulative.2',
        ...(id === 'simulationValidationEvidence'
          ? {
              taskAttainment: {
                state: 'EVIDENCE',
                score: 50,
                completedTaskCount: 2,
                relatedTaskCount: 4,
                groupedTaskSummary: [{
                  source: 'arena',
                  displayGroup: 'Arena',
                  completedTaskCount: 1,
                  relatedTaskCount: 1,
                  tasks: [{ taskKey: 'arena-1', displayName: 'Arena 任务', completed: true }],
                }, {
                  source: 'simulation',
                  displayGroup: '虚拟仿真',
                  completedTaskCount: 1,
                  relatedTaskCount: 3,
                  tasks: [
                    { taskKey: 'sim-1', displayName: '仿真一', completed: true },
                    { taskKey: 'sim-2', displayName: '仿真二', completed: false },
                    { taskKey: 'sim-3', displayName: '仿真三', completed: false },
                  ],
                }],
                evidenceAsOf: OLD_EVIDENCE_AT,
                sourceLineage: [],
                calculationVersion: 'simulation-task-attainment-portrait.v1',
                catalogDigest: 'a'.repeat(64),
                limitations: ['simulation-task-partial-progress-does-not-contribute'],
                hasGovernedTaskEvidence: true,
              },
            }
          : {}),
      })),
    },
    overallScore: 77,
    dimensionCoverage: {
      evidencedDimensionIds: PORTRAIT_V2_DIMENSIONS.map(({ id }) => id),
      missingDimensionIds: [],
    },
    evidenceAsOf: OLD_EVIDENCE_AT,
    confidence: 0.8,
    lastTrend: 'stable',
    lastRisk: [{
      type: 'constraint',
      severity: 'medium',
      occurredAt: OLD_EVIDENCE_AT,
    }],
    availabilityReason: 'available',
    generatedAt: '2026-07-23T08:00:00.000Z',
    publication: {
      calculationVersion: 'portrait-v2-cumulative.v3',
      generation: '4',
      queueGeneration: '9',
      cutoverFence: '7',
      stateWatermark: '12',
      processingWatermark: '9',
      captureRevision: 'state-1',
      inputDigest: 'task-input-1',
    },
  };
}

function cumulativeClassPortrait() {
  const dimensions = Object.fromEntries(PORTRAIT_V2_DIMENSIONS.map(({ id, label }, index) => [
    id,
    {
      label,
      mean: index === 1 ? null : 75,
      meanConfidence: index === 1 ? null : 0.78,
      includedCount: index === 1 ? 0 : 12,
      missingCount: index === 1 ? 20 : 8,
    },
  ]));
  return {
    stateKind: 'SNAPSHOT',
    availabilityReason: 'available',
    materializationVersion: 'class-competency.cumulative.v2',
    aggregate: {
      overall: {
        mean: 75,
        meanConfidence: 0.78,
        includedCount: 12,
        missingCount: 8,
      },
      dimensions,
      taskAttainment: {
        meanRatio: 0.5,
        meanScore: 50,
        usableMemberCount: 12,
        rosterTotal: 20,
        missingMemberCount: 8,
        relatedTaskCount: 4,
        calculationVersion: 'simulation-task-attainment-portrait.v1',
        limitations: ['missing-member-task-attainment-is-not-zero'],
      },
    },
    dimensionCoverage: null,
    trendDistribution: null,
    riskDistribution: null,
    diagnosis: null,
    evidenceAsOf: OLD_EVIDENCE_AT,
    generatedAt: '2026-07-23T08:00:00.000Z',
    activeStudentCount: 12,
    totalStudentCount: 20,
  };
}

function request() {
  return GET(
    new Request('http://localhost/api/teacher/classes/class-1/students/student-1/insights'),
    { params: Promise.resolve({ classId: 'class-1', studentId: 'student-1' }) },
  );
}

describe('teacher student cumulative insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
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
      user: {
        id: 'student-1',
        name: '学生甲',
        email: 'student@example.test',
      },
    });
    mocks.readCurrentCumulativePortrait.mockResolvedValue(cumulativePortrait());
    mocks.readCurrentCumulativeClassPortrait.mockResolvedValue(cumulativeClassPortrait());
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([]);
    mocks.prisma.studentSessionReport.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.findMany.mockResolvedValue([]);
    mocks.materializeRoleBasedLearningDiagnosis.mockReturnValue({
      view: 'teacher-student',
      goalId: 'control-correction',
      limitations: [],
    });
  });

  it('completes authentication and class authorization before membership lookup', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(401);
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();

    mocks.getServerAuthSession.mockResolvedValueOnce({
      user: { id: 'teacher-other', role: 'TEACHER' },
    });
    expect((await request()).status).toBe(403);
    expect(mocks.prisma.studentProfile.findFirst).not.toHaveBeenCalled();
    expect(mocks.readCurrentCumulativePortrait).not.toHaveBeenCalled();
  });

  it('denies a departed learner before any cumulative state is read', async () => {
    mocks.prisma.studentProfile.findFirst.mockResolvedValueOnce(null);

    const response = await request();

    expect(response.status).toBe(404);
    expect(mocks.readCurrentCumulativePortrait).not.toHaveBeenCalled();
    expect(mocks.readCurrentCumulativeClassPortrait).not.toHaveBeenCalled();
  });

  it('shows an old but current cumulative portrait and does not treat a missing class denominator as zero', async () => {
    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.readCurrentCumulativePortrait).toHaveBeenCalledWith(
      mocks.prisma,
      'student-1',
      'reviewer',
    );
    expect(mocks.readCurrentCumulativeClassPortrait).toHaveBeenCalledWith(
      mocks.prisma,
      'class-1',
    );
    expect(body.overview).toMatchObject({
      overallScore: 77,
      evidenceState: 'current',
      evidenceAsOf: OLD_EVIDENCE_AT,
      lastTrend: 'stable',
      lastRisk: [{
        type: 'constraint',
        severity: 'medium',
        occurredAt: OLD_EVIDENCE_AT,
      }],
    });
    expect(body.classComparison[1]).toMatchObject({
      studentScore: 55,
      classAverage: null,
      gap: null,
      includedCount: 0,
      missingCount: 20,
      availabilityReason: 'class-no-evidence',
    });
    expect(body.taskAttainment.personal).toMatchObject({
      completedTaskCount: 2,
      relatedTaskCount: 4,
      groupedTaskSummary: expect.any(Array),
      calculationVersion: 'simulation-task-attainment-portrait.v1',
    });
    expect(body.taskAttainment.personal).not.toHaveProperty('score');
    expect(body.taskAttainment.personal).not.toHaveProperty('catalogDigest');
    expect(body.taskAttainment.personal).not.toHaveProperty('sourceLineage');
    expect(body.taskAttainment.classAggregate).toMatchObject({
      meanScore: 50,
      usableMemberCount: 12,
      rosterTotal: 20,
    });
    expect(JSON.stringify(body)).not.toContain('no-recent-evidence');
  });

  it('keeps newest activity independent from portrait scope and redacts raw response content', async () => {
    const rawAnswer = 'raw-student-answer-must-not-leak';
    const hiddenEvaluation = 'hidden-official-evaluation-must-not-leak';
    mocks.prisma.learningFact.findMany.mockResolvedValue([{
      id: 'fact-1',
      factType: 'question',
      moduleId: 'unit-5-2',
      lessonId: 'unit-5-2',
      sessionId: 'historical-session',
      outcome: 'success',
      score: 88,
      startedAt: new Date('2025-10-01T08:00:00.000Z'),
      finishedAt: new Date('2025-10-01T08:02:00.000Z'),
      timeSpent: 120,
    }]);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([{
      id: 'response-1',
      sessionId: 'historical-session',
      lessonKey: 'unit-5-2',
      stepId: 'step-1',
      submittedAt: new Date('2025-10-01T08:02:00.000Z'),
      responseData: {
        schemaVersion: 'manifest-submission-v2',
        answers: [{ answer: rawAnswer }],
        hiddenEvaluation,
      },
      session: { plan: { title: '历史课堂' } },
    }]);
    mocks.prisma.studentSessionReport.findMany.mockResolvedValue([{
      sessionId: 'historical-session',
      lessonKey: 'unit-5-2',
      status: 'READY',
      summary: '已生成安全摘要',
      updatedAt: new Date('2025-10-01T09:00:00.000Z'),
      session: { plan: { title: '历史课堂' } },
    }]);

    const response = await request();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
      take: 8,
    }));
    expect(mocks.prisma.studentStepResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
      take: 8,
    }));
    expect(mocks.prisma.studentSessionReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1', reportType: 'student-summary' },
      take: 6,
    }));
    expect(body.latestActivity.facts[0].id).toBe('fact-1');
    expect(body.latestActivity.durableSubmissions[0]).toMatchObject({
      id: 'response-1',
      sessionTitle: '历史课堂',
    });
    expect(serialized).not.toContain(rawAnswer);
    expect(serialized).not.toContain(hiddenEvaluation);
    expect(serialized).not.toContain('answers');
  });

  it('reports unavailable cumulative state without falling back to a historical snapshot', async () => {
    mocks.readCurrentCumulativePortrait.mockResolvedValueOnce({
      stateKind: 'NO_EVIDENCE',
      payload: null,
      overallScore: null,
      dimensionCoverage: {
        evidencedDimensionIds: [],
        missingDimensionIds: PORTRAIT_V2_DIMENSIONS.map(({ id }) => id),
      },
      evidenceAsOf: null,
      confidence: null,
      lastTrend: null,
      lastRisk: [],
      availabilityReason: 'no-evidence-after-revocation',
      generatedAt: '2026-07-23T08:00:00.000Z',
    });

    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overview).toMatchObject({
      overallScore: null,
      evidenceState: 'no-evidence',
      availabilityReason: 'no-evidence-after-revocation',
    });
    expect(body.dimensions.every((dimension: { score: number | null }) => dimension.score === null)).toBe(true);
  });

  it('removes legacy, v1, and calendar-window portrait contracts from the route and page', () => {
    const routeSource = readFileSync(join(
      process.cwd(),
      'src/app/api/teacher/classes/[classId]/students/[studentId]/insights/route.ts',
    ), 'utf8');
    const pageSource = readFileSync(join(
      process.cwd(),
      'src/app/teacher/classes/[classId]/students/[studentId]/page.tsx',
    ), 'utf8');

    for (const source of [routeSource, pageSource]) {
      expect(source).not.toContain('StudentCompetencySnapshot');
      expect(source).not.toContain('ClassCompetencySnapshot');
      expect(source).not.toContain('currentEvidenceSince');
      expect(source).not.toContain('no-recent-evidence');
      expect(source).not.toContain('class-competency.cumulative.v1');
      expect(source).not.toMatch(/30\s*(天|day)/i);
    }
    expect(pageSource).toContain('累计能力达成');
    expect(pageSource).toContain('证据截止');
    expect(pageSource).toContain('当前风险');
    expect(pageSource).toContain('最新活动');
  });
});
