import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerAuthSession = vi.fn();
  const generateRecommendations = vi.fn();
  const getAbilityReport = vi.fn();
  const getDiagnostic = vi.fn();
  const prismaArenaSubmissionStore = {
    listSubmissions: vi.fn(),
  };

  return {
    getServerAuthSession,
    generateRecommendations,
    getAbilityReport,
    getDiagnostic,
    prismaArenaSubmissionStore,
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

vi.mock('@/features/arena/submissions/prisma-store', () => ({
  prismaArenaSubmissionStore: mocks.prismaArenaSubmissionStore,
}));

import { GET } from '@/app/api/user/profile/route';

function arenaSubmission(overrides: Record<string, unknown> = {}) {
  const taskId = typeof overrides.taskId === 'string' ? overrides.taskId : 'task-integrator-low-frequency-balance';
  const artifact = {
    id: `artifact-${overrides.id ?? 'arena-1'}`,
    taskId,
    method: overrides.method ?? 'pid',
    params: { kp: 2.4, ki: 0.8, kd: 0.35 },
    createdAt: '2026-05-16T08:00:00.000Z',
  };
  return {
    id: overrides.id ?? 'arena-1',
    taskId,
    userId: overrides.userId ?? 'student-1',
    classId: 'class-1',
    publicationId: 'publication-1',
    studentLabel: '张同学',
    artifactHash: `hash-${overrides.id ?? 'arena-1'}`,
    artifact,
    evaluation: {
      taskId,
      artifact,
      valid: overrides.valid ?? true,
      score: overrides.score ?? 86,
      metrics: { settlingTime: 3.2, overshoot: 8, steadyStateError: 0.02, controlEnergy: 5 },
      satisfaction: overrides.satisfaction ?? {
        settlingTime: 0.7,
        overshoot: 0.8,
        steadyStateError: 0.9,
        controlEnergy: 0.65,
      },
      hardConstraintResults: [{ id: 'closed_loop_stable', label: '闭环稳定', passed: overrides.valid ?? true }],
      penalties: [],
      explanation: [],
    },
    submittedAt: overrides.submittedAt ?? '2026-05-16T08:20:00.000Z',
    reusedEvaluation: false,
  };
}

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
        id: 'evt-0',
        eventType: 'resource_complete',
        resourceKey: 'lesson-entry:unit-2-1-modeling-language:course-video',
        sessionId: null,
        lessonKey: 'unit-2-1-modeling-language',
        createdAt: new Date('2026-03-19T10:05:00.000Z'),
        eventData: {
          targetLabel: '完整课程视频',
          originPath: '/interactive-learning/courses/unit-2-1-modeling-language',
        },
      },
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
      {
        id: 'fact-arena-1',
        factType: 'design',
        moduleId: 'task-integrator-low-frequency-balance',
        sessionId: null,
        startedAt: new Date('2026-05-16T08:30:00.000Z'),
        outcome: 'success',
        score: 0.86,
        timeSpent: 300,
        contextJson: { arena: { taskId: 'task-integrator-low-frequency-balance', valid: true } },
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

    mocks.prismaArenaSubmissionStore.listSubmissions.mockImplementation(async (options: { userId?: string; taskIds?: string[] }) => {
      if (options.userId === 'student-1') {
        return [
          arenaSubmission({
            id: 'arena-early',
            score: 52,
            valid: false,
            submittedAt: '2026-05-16T08:00:00.000Z',
            satisfaction: { settlingTime: 0.35, overshoot: 0.6, steadyStateError: 0.4, controlEnergy: 0.45 },
          }),
          arenaSubmission({
            id: 'arena-best',
            score: 86,
            valid: true,
            submittedAt: '2026-05-16T08:20:00.000Z',
            satisfaction: { settlingTime: 0.82, overshoot: 0.78, steadyStateError: 0.91, controlEnergy: 0.68 },
          }),
        ];
      }
      if (Array.isArray(options.taskIds)) {
        return [
          arenaSubmission({
            id: 'arena-early',
            score: 52,
            valid: false,
            submittedAt: '2026-05-16T08:00:00.000Z',
            satisfaction: { settlingTime: 0.35, overshoot: 0.6, steadyStateError: 0.4, controlEnergy: 0.45 },
          }),
          arenaSubmission({
            id: 'arena-best',
            score: 86,
            valid: true,
            submittedAt: '2026-05-16T08:20:00.000Z',
            satisfaction: { settlingTime: 0.82, overshoot: 0.78, steadyStateError: 0.91, controlEnergy: 0.68 },
          }),
        ];
      }
      return [];
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
    expect(body.recentActivity.preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '完成资源学习：完整课程视频',
          description: '完成了一项课堂外资源学习',
          href: '/interactive-learning/courses/unit-2-1-modeling-language',
          badge: '资源完成',
        }),
      ])
    );
    expect(body.personalizedReinforcement.resources).toHaveLength(2);
    expect(body.personalizedReinforcement.adaptivePractice).toMatchObject({
      estimatedAbility: 0.64,
      weakAreas: ['phase-margin', 'controller-tuning'],
      recommendedFocus: ['优先练习“相位裕度-超调量”映射题', '加强 PID 参数因果调节训练'],
      actionUrl: '/assessment/adaptive-practice',
    });
    expect(body.arenaPortfolio.submissionSummary.total).toBe(2);
    expect(body.arenaPortfolio.growth).toMatchObject({
      evidenceAvailable: true,
      capabilityCoverage: {
        covered: expect.any(Number),
        total: expect.any(Number),
      },
    });
    expect(body.arenaPortfolio.growth.improvingCapabilities).toEqual(expect.arrayContaining([
      '稳态精度',
    ]));
    expect(body.arenaPortfolio.growth.nextChallenges.length).toBeGreaterThan(0);
    expect(body.arenaPortfolio.growth.nextChallenges[0].reason).toMatch(/薄弱|指标|阶段|补齐/);
    expect(body.arenaSummary).toMatchObject({
      submissionCount: 2,
      bestScore: 86,
      validSubmissionRate: 0.5,
      methodPreference: 'pid',
      improvementCount: 1,
      learningFactContextCount: 1,
    });
  });
});
