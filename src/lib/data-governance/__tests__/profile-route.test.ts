import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerAuthSession = vi.fn();
  const generateRecommendations = vi.fn();
  const getAbilityReport = vi.fn();
  const getDiagnostic = vi.fn();

  return {
    getServerAuthSession,
    generateRecommendations,
    getAbilityReport,
    getDiagnostic,
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      studentProfile: {
        findUnique: vi.fn(),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn(),
      },
      studentProfileSummary: {
        findUnique: vi.fn(),
      },
      simulationLog: {
        findMany: vi.fn(),
      },
      ethicalLog: {
        findMany: vi.fn(),
      },
      userProgress: {
        findMany: vi.fn(),
      },
      mission: {
        count: vi.fn(),
      },
      interactionLog: {
        findMany: vi.fn(),
      },
      learningFact: {
        findMany: vi.fn(),
      },
      studentState: {
        findMany: vi.fn(),
      },
      classSession: {
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

vi.mock('@/lib/extracurricular-analytics', () => ({
  getUserExtracurricularSnapshot: vi.fn().mockResolvedValue({
    pre: {
      computational: 45,
      crossDomain: 52,
      designTradeoff: 48,
      poleTimeMapping: 44,
      frequencyStability: 50,
    },
    post: {
      computational: 61,
      crossDomain: 68,
      designTradeoff: 64,
      poleTimeMapping: 60,
      frequencyStability: 66,
    },
    delta: {
      computational: 16,
      crossDomain: 16,
      designTradeoff: 16,
      poleTimeMapping: 16,
      frequencyStability: 16,
    },
    preWeakTag: 'computational',
    postWeakTag: 'pole-time-mapping',
    weakTagLabel: '极点-时域映射',
    promptStructuringScore: 78,
    designEffectScore: 81,
    reinforcementPaths: [],
    recommendedQuestions: [],
  }),
}));

vi.mock('@/lib/competency', () => ({
  computeCompetencyFromSimulations: vi.fn().mockReturnValue({
    steadyStateAccuracy: 76,
    dynamicResponse: 72,
    robustness: 68,
    safety: 91,
    energyEfficiency: 74,
  }),
}));

vi.mock('@/lib/data-governance/recommendation-engine', () => ({
  generateRecommendations: mocks.generateRecommendations,
}));

vi.mock('@/features/assessment/adaptive-engine', () => ({
  getAbilityReport: mocks.getAbilityReport,
  getDiagnostic: mocks.getDiagnostic,
}));

import { GET } from '@/app/api/user/profile/route';

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      name: '张同学',
      email: 'student@example.com',
      role: 'STUDENT',
    });

    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      classId: 'class-1',
      className: '自动化 231',
      studentNumber: '2023001001',
      techScore: 88,
      ethicsScore: 96,
    });

    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue({
      competencyVector: {
        controlModeling: { score: 82, trend: 'up', confidence: 0.8, evidenceCount: 6, lastUpdated: '2026-03-19T09:00:00.000Z' },
        parameterDesign: { score: 74, trend: 'stable', confidence: 0.75, evidenceCount: 5, lastUpdated: '2026-03-19T09:00:00.000Z' },
        crossDomainTransfer: { score: 58, trend: 'up', confidence: 0.72, evidenceCount: 5, lastUpdated: '2026-03-19T09:00:00.000Z' },
        engineeringDecision: { score: 69, trend: 'stable', confidence: 0.7, evidenceCount: 4, lastUpdated: '2026-03-19T09:00:00.000Z' },
        inquiryReflection: { score: 64, trend: 'up', confidence: 0.67, evidenceCount: 4, lastUpdated: '2026-03-19T09:00:00.000Z' },
        selfDirectedLearning: { score: 61, trend: 'up', confidence: 0.65, evidenceCount: 3, lastUpdated: '2026-03-19T09:00:00.000Z' },
      },
      snapshotAt: new Date('2026-03-19T09:00:00.000Z'),
      factCount: 18,
    });

    mocks.prisma.studentProfileSummary.findUnique.mockResolvedValue({
      overallLevel: '良好',
      overallScore: 68,
      strengthsJson: ['控制建模与分析'],
      weaknessesJson: ['跨域迁移与联动'],
      recentTrend: '近两周稳步提升',
    });

    mocks.prisma.simulationLog.findMany.mockResolvedValue([
      {
        id: 'sim-1',
        controlMode: 'pid',
        createdAt: new Date('2026-03-18T09:30:00.000Z'),
        score: 89,
        duration: 1200,
      },
    ]);

    mocks.prisma.ethicalLog.findMany.mockResolvedValue([]);

    mocks.prisma.userProgress.findMany.mockResolvedValue([
      { status: 'COMPLETED', mission: { id: 'mission-1', title: '任务 1' } },
      { status: 'UNLOCKED', mission: { id: 'mission-2', title: '任务 2' } },
    ]);

    mocks.prisma.mission.count.mockResolvedValue(5);

    mocks.prisma.interactionLog.findMany.mockResolvedValue([
      {
        id: 'evt-1',
        eventType: 'knowledge_card_open',
        resourceKey: 'knowledge-card-bode',
        sessionId: null,
        lessonKey: 'lesson-12',
        createdAt: new Date('2026-03-19T10:00:00.000Z'),
        eventData: { title: '知识卡片：Bode 图' },
      },
      {
        id: 'evt-2',
        eventType: 'lesson_step_view',
        resourceKey: 'l2d-three-domain-linkage',
        sessionId: 'session-1',
        lessonKey: 'l2d',
        createdAt: new Date('2026-03-19T08:00:00.000Z'),
        eventData: { title: '跨域探索：三域联动' },
      },
    ]);

    mocks.prisma.learningFact.findMany.mockResolvedValue([
      {
        id: 'fact-1',
        factType: 'question',
        moduleId: 'adaptive-practice',
        sessionId: null,
        startedAt: new Date('2026-03-19T10:30:00.000Z'),
        outcome: 'success',
        score: 0.86,
        timeSpent: 420,
        competencyContribution: { crossDomainTransfer: 0.5 },
      },
    ]);

    mocks.prisma.studentState.findMany.mockResolvedValue([
      {
        sessionId: 'session-1',
        userId: 'student-1',
        submittedAt: new Date('2026-03-19T07:55:00.000Z'),
      },
    ]);

    mocks.prisma.classSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        joinCode: '123456',
        plan: { title: '三域联动精品课堂' },
        class: { name: '自动化 231' },
      },
    ]);

    mocks.generateRecommendations.mockResolvedValue([
      {
        id: 'rec-1',
        type: 'immediate',
        title: '补强跨域迁移',
        description: '建议先完成三域联动模块，再进行 2 道自适应题。',
        reason: '跨域迁移偏弱',
        actionUrl: '/interactive-learning/courses/l2d-three-domain-linkage-practice',
        actionLabel: '进入三域联动',
        priority: 88,
        estimatedTime: '25分钟',
        tags: ['跨域迁移', '互动模块'],
      },
      {
        id: 'rec-2',
        type: 'weekly',
        title: '复习频域稳定卡片',
        description: '补看稳定裕度知识卡片，巩固频域判读。',
        reason: '频域稳定相关题目波动较大',
        actionUrl: '/interactive-learning/lesson-14',
        actionLabel: '打开知识卡片',
        priority: 72,
        estimatedTime: '12分钟',
        tags: ['知识卡片', '频域稳定'],
      },
    ]);

    mocks.getDiagnostic.mockReturnValue({
      knowledgeDimensions: {
        computational: 62,
        crossDomain: 49,
        design: 57,
      },
      weakAreas: ['phase-margin', 'controller-tuning'],
      recommendedFocus: ['优先练习“相位裕度-超调量”映射题', '加强 PID 参数因果调节训练'],
    });

    mocks.getAbilityReport.mockReturnValue({
      userId: 'student-1',
      estimatedAbility: 0.64,
      confidenceInterval: [0.22, 1.04],
      timeline: [
        { timestamp: 1710800000000, theta: 0.18, accuracy: 0.5 },
        { timestamp: 1710803600000, theta: 0.64, accuracy: 0.67 },
      ],
      dimensions: {
        computationalTheta: 0.48,
        crossDomainTheta: -0.12,
        designTheta: 0.26,
      },
    });
  });

  it('returns six-dimension competency, preview activities, and adaptive reinforcement summary', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile.studentNumber).toBe('2023001001');
    expect(body.competency.dimensions).toHaveLength(6);
    expect(body.competency.dimensions.map((item: { key: string }) => item.key)).toEqual([
      'controlModeling',
      'parameterDesign',
      'crossDomainTransfer',
      'engineeringDecision',
      'inquiryReflection',
      'selfDirectedLearning',
    ]);
    expect(body.recentActivity.preview).toHaveLength(3);
    expect(body.recentActivity.grouped.map((group: { category: string }) => group.category)).toEqual(
      expect.arrayContaining(['classroom', 'interactive', 'simulation', 'assessment'])
    );
    expect(body.personalizedReinforcement.resources).toHaveLength(2);
    expect(body.personalizedReinforcement.adaptivePractice).toMatchObject({
      estimatedAbility: 0.64,
      weakAreas: ['phase-margin', 'controller-tuning'],
      recommendedFocus: ['优先练习“相位裕度-超调量”映射题', '加强 PID 参数因果调节训练'],
      actionUrl: '/assessment/adaptive-practice',
    });
  });
});
