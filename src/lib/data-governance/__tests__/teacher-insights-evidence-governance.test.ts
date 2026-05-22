import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    refreshedAt: new Date('2026-05-20T00:00:00.000Z'),
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

describe('teacher evidence governance insights', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T00:00:00.000Z'));
    vi.clearAllMocks();

    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prismaArenaSubmissionStore.listSubmissions.mockResolvedValue([]);
    mocks.generateRecommendations.mockResolvedValue([]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([
      evidenceCache('student-ready'),
      evidenceCache('student-stale'),
      evidenceCache('student-low'),
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
        refreshedAt: true,
        statusMarkers: true,
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
        sessionId: { in: ['session-current'] },
      },
    }));
    expect(body.governance.evidenceCoverage).toMatchObject({
      totalStudents: 4,
      readyStudents: 2,
      staleStudents: 1,
      missingStudents: 1,
      lowConfidenceStudents: 1,
      cacheCoverageRatio: 0.75,
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
    });
    expect(body.students.find((student: { id: string }) => student.id === 'student-missing').evidenceStatus).toMatchObject({
      state: 'missing',
      confidence: { level: 'none', evidenceCount: 0 },
      lastEvidenceAt: null,
    });
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
    }));
    mocks.prisma.classSession.findMany.mockResolvedValue([
      { id: 'session-5-2' },
    ]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([
      {
        id: 'fact-5-2',
        factType: 'course-evidence',
        moduleId: 'unit-5-2-nonlinear-analysis-entry',
        lessonId: 'unit-5-2-nonlinear-analysis-entry',
        sessionId: 'session-5-2',
        startedAt: new Date('2026-05-20T08:10:00.000Z'),
        finishedAt: new Date('2026-05-20T08:16:00.000Z'),
        outcome: 'partial',
        score: null,
        timeSpent: 360,
      },
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
    expect(mocks.prisma.classSession.findMany).toHaveBeenCalledWith({
      where: { classId },
      select: { id: true },
    });
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'student-1',
        sessionId: { in: ['session-5-2'] },
      },
      take: 8,
      select: expect.not.objectContaining({ contextJson: true }),
    }));
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
      confidence: {
        level: 'medium',
        score: 0.64,
        evidenceCount: 9,
      },
    });
    expect(body.evidenceDrawer.recentFacts).toEqual([
      expect.objectContaining({
        id: 'fact-5-2',
        lessonId: 'unit-5-2-nonlinear-analysis-entry',
      }),
    ]);
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
    expect(body.evidenceSummary[3].items[0].questionSummaries[0].studentAnswer.length).toBeLessThanOrEqual(120);
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
