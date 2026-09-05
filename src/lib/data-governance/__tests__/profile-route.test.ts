import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerAuthSession = vi.fn();
  const generateRecommendations = vi.fn();
  const getAbilityReport = vi.fn();
  const getDiagnostic = vi.fn();
  const requestCumulativeLearnerReconciliation = vi.fn();
  const prismaArenaSubmissionStore = {
    listSubmissions: vi.fn(),
  };

  return {
    getServerAuthSession,
    generateRecommendations,
    getAbilityReport,
    getDiagnostic,
    requestCumulativeLearnerReconciliation,
    prismaArenaSubmissionStore,
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      studentProfile: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn(),
      },
      studentPortraitV2Snapshot: {
        findFirst: vi.fn(),
      },
      studentProfileSummary: {
        findUnique: vi.fn(),
      },
      cumulativePortraitCutoverFence: {
        findUnique: vi.fn(),
      },
      cumulativePortraitMigrationRun: {
        findUnique: vi.fn(),
      },
      learnerPortraitCurrentState: {
        findUnique: vi.fn(),
      },
      simulationRun: {
        findMany: vi.fn(),
      },
      simulationLog: {
        findMany: vi.fn(),
      },
      ethicalLog: {
        findMany: vi.fn(),
      },
      userProgress: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
      mission: {
        findFirst: vi.fn(),
        count: vi.fn(),
      },
      interactionLog: {
        findMany: vi.fn(),
      },
      learningFact: {
        findMany: vi.fn(),
      },
      arenaVirtualSimulationRun: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      studentEvidenceFeatureCache: {
        findUnique: vi.fn(),
      },
      studentState: {
        findMany: vi.fn(),
      },
      classSession: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/data-governance/cumulative-snapshot-jobs', () => ({
  requestCumulativeLearnerReconciliation: mocks.requestCumulativeLearnerReconciliation,
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

vi.mock('@/features/personalization/recommendations/public-api', () => ({
  generateRecommendations: mocks.generateRecommendations,
}));

vi.mock('@/features/assessment/adaptive-engine', () => ({
  getAbilityReport: mocks.getAbilityReport,
  getDiagnostic: mocks.getDiagnostic,
}));

vi.mock('@/features/assessment/adaptive-persistence', () => ({
  getAbilityReportDurably: mocks.getAbilityReport,
  getDiagnosticDurably: mocks.getDiagnostic,
}));

vi.mock('@/features/arena/submissions/prisma-store', () => ({
  prismaArenaSubmissionStore: mocks.prismaArenaSubmissionStore,
}));

import { GET, PATCH } from '@/app/api/user/profile/route';
import { PORTRAIT_V2_DIMENSIONS } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  createPortraitV2Payload,
  PORTRAIT_V2_CALCULATION_VERSION,
} from '@/lib/data-governance/portrait-v2-model';

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

function arenaTrainingRun(overrides: Record<string, unknown> = {}) {
  const id = typeof overrides.id === 'string' ? overrides.id : 'arena-training-1';
  return {
    id,
    userId: 'student-1',
    taskId: 'task-cruise-roll-blackbox-identification',
    scenarioId: 'cruise-roll-controller-preview',
    simulationRunId: 'canonical-run-1',
    payload: {
      summary: {
        trackingError: 0.2,
        maxDeviation: 0.3,
        controlEnergy: 0.4,
        safetyViolations: 0,
        smoothness: 0.8,
      },
      metadata: {
        evaluationVisibility: 'preview',
        officialEligible: false,
      },
    },
    createdAt: new Date('2026-05-16T08:40:00.000Z'),
    ...overrides,
  };
}

function damagedArenaTrainingRun(overrides: Record<string, unknown> = {}) {
  return arenaTrainingRun({
    payload: {
      summary: {
        trackingError: Number.NaN,
      },
      metadata: {
        evaluationVisibility: 'preview',
        officialEligible: false,
      },
    },
    ...overrides,
  });
}

function profileEvidenceCache(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'student-1',
    payloadVersion: 'student-evidence-features.v3',
    refreshedAt: new Date('2026-05-19T00:00:00.000Z'),
    evidenceWindow: {
      firstStartedAt: '2026-05-01T00:00:00.000Z',
      lastStartedAt: '2026-05-18T00:00:00.000Z',
      daysCovered: 17,
    },
    sourceCounts: {
      LearningFact: 7,
      StudentCompetencySnapshot: 1,
      StudentProfileSummary: 1,
      byFactType: { question: 4, design: 3 },
    },
    sourceCoverage: {
      LearningFact: 'available',
      StudentCompetencySnapshot: 'available',
      StudentProfileSummary: 'available',
    },
    confidenceMarkers: {
      level: 'medium',
      score: 0.66,
      evidenceCount: 7,
      sourceCompleteness: 0.86,
    },
    statusMarkers: [],
    features: {
      simulationArena: {
        recent30d: emptySimulationArenaWindow(),
        allTime: emptySimulationArenaWindow(),
      },
      adaptiveLearnerState: {
        payloadVersion: 'adaptive-learner-state.v1',
        sourceWindows: {
          learnerStateRecent30d: {
            firstStartedAt: '2026-05-01T00:00:00.000Z',
            lastStartedAt: '2026-05-18T00:00:00.000Z',
            daysCovered: 17,
          },
          learnerStateAllTime: {
            firstStartedAt: '2026-05-01T00:00:00.000Z',
            lastStartedAt: '2026-05-18T00:00:00.000Z',
            daysCovered: 17,
          },
        },
        sourceCounts: {
          LearningFact: 7,
          AdaptiveMasteryEvidence: 0,
        },
        sourceCoverage: {
          primaryCompetencies: 'available',
          knowledgeMastery: 'missing',
          resourcePreference: 'partial',
          mediaAbsorption: 'missing',
          pathContext: 'missing',
          simulationArena: 'missing',
        },
        confidence: {
          level: 'medium',
          score: 0.66,
          evidenceCount: 7,
          sourceCompleteness: 0.86,
          markers: [],
        },
      },
    },
    ...overrides,
  };
}

function emptySimulationArenaWindow() {
  return {
    window: {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    },
    evidenceCount: 0,
    completedCount: 0,
    officialCount: 0,
    previewCount: 0,
    courseLaunchedCount: 0,
    standaloneCount: 0,
    traceReferenceCount: 0,
    sourceCoverage: {
      simulation: 'missing',
      arena: 'missing',
      traceReferences: 'missing',
      replayConfidence: 'missing',
    },
    replayConfidence: {
      average: null,
      highConfidenceCount: 0,
      lowConfidenceCount: 0,
      missingCount: 0,
    },
    weakMetrics: [],
    qualityMarkers: [],
    traceReferences: [],
  };
}

function learningFact(overrides: Record<string, unknown> = {}) {
  const id = typeof overrides.id === 'string' ? overrides.id : 'fact-1';
  return {
    id,
    factType: overrides.factType ?? 'question',
    moduleId: overrides.moduleId ?? 'adaptive-practice',
    sessionId: overrides.sessionId ?? null,
    startedAt: overrides.startedAt ?? new Date('2026-03-19T10:30:00.000Z'),
    outcome: overrides.outcome ?? 'success',
    score: overrides.score ?? 0.86,
    timeSpent: overrides.timeSpent ?? 420,
    contextJson: overrides.contextJson ?? null,
  };
}

function portraitV2Snapshot(confidence = 0.8, hasEvidence = true) {
  const generatedAt = '2026-05-20T00:00:00.000Z';
  const portrait = createPortraitV2Payload({
    userId: 'student-1',
    generatedAt,
    now: generatedAt,
    dimensions: PORTRAIT_V2_DIMENSIONS.map(({ id }) => ({
      id,
      score: hasEvidence ? 80 : 0,
      confidence: hasEvidence ? confidence : 0,
      trend: 'stable' as const,
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
    id: 'portrait-v2-current-at-generation',
    userId: 'student-1',
    snapshotAt: new Date(generatedAt),
    payloadVersion: portrait.payloadVersion,
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    migrationVersion: portrait.migrationVersion,
    derivationKind: portrait.derivation.kind,
    payload: portrait,
  };
}

function cumulativePortraitFixture(options: {
  snapshot?: ReturnType<typeof portraitV2Snapshot> | null;
  queueGeneration?: bigint;
  stateKind?: 'SNAPSHOT' | 'NO_EVIDENCE';
  availabilityReason?: string;
} = {}) {
  const snapshot = options.snapshot === undefined ? portraitV2Snapshot() : options.snapshot;
  const queueGeneration = options.queueGeneration ?? BigInt(9);
  const stateKind = options.stateKind ?? 'SNAPSHOT';
  return {
    userId: 'student-1',
    stateVersionId: 'learner-state-1',
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    generation: BigInt(4),
    queueGeneration,
    stateWatermark: BigInt(12),
    cutoverFence: BigInt(7),
    stateVersion: {
      id: 'learner-state-1',
      userId: 'student-1',
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      generation: BigInt(4),
      queueGeneration,
      stateWatermark: BigInt(12),
      stateKind,
      snapshotId: stateKind === 'SNAPSHOT' ? snapshot?.id ?? null : null,
      overallScore: stateKind === 'SNAPSHOT' ? 80 : null,
      dimensionCoverage: stateKind === 'SNAPSHOT'
        ? {
            evidencedDimensionIds: PORTRAIT_V2_DIMENSIONS.map(({ id }) => id),
            missingDimensionIds: [],
          }
        : {
            evidencedDimensionIds: [],
            missingDimensionIds: PORTRAIT_V2_DIMENSIONS.map(({ id }) => id),
          },
      evidenceAsOf: stateKind === 'SNAPSHOT' ? new Date('2026-05-20T00:00:00.000Z') : null,
      confidence: stateKind === 'SNAPSHOT' ? 0.8 : null,
      lastTrend: stateKind === 'SNAPSHOT' ? 'stable' : null,
      lastRisk: stateKind === 'SNAPSHOT'
        ? [{ type: 'constraint', severity: 'medium', occurredAt: '2026-05-20T00:00:00.000Z' }]
        : [],
      availabilityReason: options.availabilityReason ?? (stateKind === 'SNAPSHOT'
        ? 'available'
        : 'no-eligible-evidence'),
      generatedAt: new Date('2026-05-20T00:05:00.000Z'),
      cutoverFence: BigInt(7),
      migrationRunId: 'migration-989',
      snapshot: stateKind === 'SNAPSHOT' ? snapshot : null,
    },
  };
}

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T00:00:00.000Z'));
    vi.clearAllMocks();
    delete process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED;

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
    mocks.prisma.studentProfile.upsert.mockResolvedValue({
      userId: 'student-1',
      techScore: 0,
      ethicsScore: 100,
    });
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.requestCumulativeLearnerReconciliation.mockResolvedValue(1);

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
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.cumulativePortraitCutoverFence.findUnique.mockResolvedValue({
      fence: BigInt(7),
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      learnerGeneration: BigInt(4),
      queueGeneration: BigInt(9),
      activeMigrationRunId: 'migration-989',
    });
    mocks.prisma.cumulativePortraitMigrationRun.findUnique.mockResolvedValue({
      id: 'migration-989',
      mode: 'APPLY',
      status: 'COMPLETED',
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      learnerGeneration: BigInt(4),
      queueGeneration: BigInt(9),
      cutoverFence: BigInt(7),
    });
    mocks.prisma.learnerPortraitCurrentState.findUnique.mockResolvedValue(cumulativePortraitFixture());

    mocks.prisma.studentProfileSummary.findUnique.mockResolvedValue({
      overallLevel: '良好',
      overallScore: 68,
      strengthsJson: ['控制建模与分析'],
      weaknessesJson: ['跨域迁移与联动'],
      recentTrend: '近两周稳步提升',
    });

    mocks.prisma.simulationRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        ownerUserId: 'student-1',
        runKind: 'scene_simulation',
        sourceDomain: 'simulation_scene',
        sourceRefId: 'control-workbench:hash-1',
        resourceId: null,
        status: 'completed',
        summary: {
          metrics: { overshoot: 8.2, settlingTime: 12, valid: true },
          evaluation: { passed: true, meetsQualityTarget: true },
          qualityTargetMet: true,
          runContract: { evaluationVisibility: 'preview', officialEligible: false },
        },
        completedAt: new Date('2026-03-20T10:00:00.000Z'),
        createdAt: new Date('2026-03-20T10:00:00.000Z'),
      },
    ]);
    mocks.prisma.simulationLog.findMany.mockResolvedValue([
      {
        id: 'sim-1',
        userId: 'student-1',
        controlMode: 'pid',
        inputParams: { kp: 1.2 },
        createdAt: new Date('2026-03-18T09:30:00.000Z'),
        score: 89,
        duration: 1200,
        isEthicalViolation: false,
        odysseyRunId: null,
        odysseyCompletedAt: null,
      },
    ]);

    mocks.prisma.ethicalLog.findMany.mockResolvedValue([]);

    mocks.prisma.userProgress.findMany.mockResolvedValue([
      { status: 'COMPLETED', mission: { id: 'mission-1', title: '任务 1' } },
      { status: 'UNLOCKED', mission: { id: 'mission-2', title: '任务 2' } },
    ]);
    mocks.prisma.userProgress.findUnique.mockResolvedValue({
      userId: 'student-1',
      missionId: 'mission-1',
      status: 'UNLOCKED',
    });
    mocks.prisma.userProgress.upsert.mockResolvedValue({
      userId: 'student-1',
      missionId: 'mission-1',
      status: 'UNLOCKED',
    });
    mocks.prisma.userProgress.create.mockResolvedValue({
      userId: 'student-1',
      missionId: 'mission-1',
      status: 'UNLOCKED',
    });
    mocks.prisma.mission.findFirst.mockResolvedValue({
      id: 'mission-1',
      order: 1,
      isActive: true,
    });

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
      learningFact({
        id: 'fact-1',
        factType: 'question',
        moduleId: 'adaptive-practice',
        startedAt: new Date('2026-03-19T10:30:00.000Z'),
        contextJson: { competencyContribution: { crossDomainTransfer: 0.5 } },
      }),
      learningFact({
        id: 'fact-arena-1',
        factType: 'design',
        moduleId: 'task-integrator-low-frequency-balance',
        startedAt: new Date('2026-05-16T08:30:00.000Z'),
        timeSpent: 300,
        contextJson: { arena: { taskId: 'task-integrator-low-frequency-balance', valid: true } },
      }),
      learningFact({
        id: 'fact-unit-5-2-rich-evidence',
        factType: 'course-evidence',
        moduleId: 'unit-5-2-nonlinear-analysis-entry',
        sessionId: 'session-unit-5-2',
        startedAt: new Date('2026-05-18T09:00:00.000Z'),
        outcome: 'partial',
        score: null,
        timeSpent: 240,
        contextJson: {
          courseEvidence: {
            lessonId: '5-2',
            source: 'student-interactive-submission',
            evidenceKind: 'rich-evidence',
          },
        },
      }),
    ]);

    mocks.prisma.arenaVirtualSimulationRun.findMany.mockResolvedValue([arenaTrainingRun()]);
    mocks.prisma.arenaVirtualSimulationRun.count.mockResolvedValue(1);

    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(profileEvidenceCache());

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
        actionUrl: '/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment',
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the fenced cumulative portrait, latest activity, and adaptive practice summary', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      update: {},
      create: {
        userId: 'student-1',
        techScore: 0,
        ethicsScore: 100,
      },
    });
    expect(mocks.prisma.userProgress.upsert).toHaveBeenCalledWith({
      where: {
        userId_missionId: {
          userId: 'student-1',
          missionId: 'mission-1',
        },
      },
      update: {},
      create: {
        userId: 'student-1',
        missionId: 'mission-1',
        status: 'UNLOCKED',
      },
    });
    expect(body.profile.studentNumber).toBe('2023001001');
    expect(body.statistics).toMatchObject({
      // 统一投影口径（Issue #1991）：canonical run 与 legacy log 合并计数；
      // canonical 无 duration、无 score 时只贡献计数，不伪造时长或得分。
      totalSimulations: 2,
      totalSimulationTime: 1200,
      averageScore: 89,
      simulationEvidenceState: 'available',
    });
    expect(
      body.latestActivity.preview.some(
        (item: { title: string }) => item.title === '控制工作台分析',
      ),
    ).toBe(true);
    expect(body.competency.dimensions).toHaveLength(7);
    expect(body.competency.dimensions.map((item: { key: string }) => item.key)).toEqual([
      'controlModelingRepresentation',
      'systemAnalysisInterpretation',
      'controllerDesignSynthesis',
      'simulationValidationEvidence',
      'engineeringConstraintSafety',
      'transferIntegratedApplication',
      'reflectionImprovementAiCollab',
    ]);
    expect(body.competency).toMatchObject({
      model: 'portrait-v2-cumulative',
      availability: { state: 'SNAPSHOT', reason: 'available' },
      overallScore: 80,
      level: '良好',
      lastTrend: 'stable',
      lastRisk: [{ type: 'constraint', severity: 'medium' }],
      evidenceAsOf: '2026-05-20T00:00:00.000Z',
      generatedAt: '2026-05-20T00:05:00.000Z',
    });
    expect(body.latestActivity.preview).toHaveLength(3);
    expect(body.latestActivity.grouped.map((group: { category: string }) => group.category)).toEqual(
      expect.arrayContaining(['classroom', 'interactive', 'simulation', 'assessment'])
    );
    expect(body.latestActivity.preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '完成资源学习：完整课程视频',
          description: '完成了一项课堂外资源学习',
          href: '/interactive-learning/courses/unit-2-1-modeling-language',
          badge: '资源完成',
        }),
        expect.objectContaining({
          title: '完成自适应练习',
          href: '/assessment/adaptive-practice?intent=practice',
          badge: '评测',
        }),
      ])
    );
    expect(body.personalizedReinforcement.resources).toEqual([]);
    expect(body.personalizedReinforcement.adaptivePractice).toMatchObject({
      estimatedAbility: 0.64,
      weakAreas: ['phase-margin', 'controller-tuning'],
      recommendedFocus: ['优先练习“相位裕度-超调量”映射题', '加强 PID 参数因果调节训练'],
      actionUrl: '/assessment/adaptive-practice?intent=practice',
    });
    expect(body.arenaPortfolio.submissionSummary.total).toBe(2);
    expect(mocks.prisma.arenaVirtualSimulationRun.count).not.toHaveBeenCalled();
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'student-1',
        taskId: { not: '' },
        scenarioId: { not: '' },
        AND: [
          {
            OR: [
              { simulationRun: null },
              {
                simulationRun: {
                  is: {
                    status: { in: ['completed', 'succeeded', 'success'] },
                  },
                },
              },
            ],
          },
          {
            OR: [
              { simulationRun: { is: { summary: { path: ['arenaTraining', 'evaluationVisibility'], equals: 'preview' } } } },
              { simulationRun: { is: { summary: { path: ['previewBoundary', 'evaluationVisibility'], equals: 'preview' } } } },
              { payload: { path: ['summary', 'arenaTraining', 'evaluationVisibility'], equals: 'preview' } },
              { payload: { path: ['metadata', 'evaluationVisibility'], equals: 'preview' } },
              { payload: { path: ['previewBoundary', 'evaluationVisibility'], equals: 'preview' } },
            ],
          },
          {
            OR: [
              { simulationRun: { is: { summary: { path: ['arenaTraining', 'officialEligible'], equals: false } } } },
              { simulationRun: { is: { summary: { path: ['previewBoundary', 'officialEligible'], equals: false } } } },
              { payload: { path: ['summary', 'arenaTraining', 'officialEligible'], equals: false } },
              { payload: { path: ['metadata', 'officialEligible'], equals: false } },
              { payload: { path: ['previewBoundary', 'officialEligible'], equals: false } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true,
        userId: true,
        taskId: true,
        scenarioId: true,
        simulationRunId: true,
        payload: true,
        createdAt: true,
        simulationRun: {
          select: {
            status: true,
            completedAt: true,
            summary: true,
          },
        },
      },
    });
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).toHaveBeenCalledTimes(1);
    expect(body.arenaPortfolio.trainingSummary).toMatchObject({
      total: 1,
      previewCount: 1,
      evidenceConfidence: 'low',
      recentRuns: [expect.objectContaining({
        taskId: 'task-cruise-roll-blackbox-identification',
        qualityMetrics: {
          trackingError: 0.2,
          maxDeviation: 0.3,
          controlEnergy: 0.4,
          safetyViolations: 0,
          smoothness: 0.8,
        },
        preview: true,
        officialEligible: false,
        confidence: 'low',
      })],
    });
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
    expect(body).not.toHaveProperty('adaptiveLearnerState');
    expect(body).not.toHaveProperty('evidenceStatus');
    expect(mocks.prisma.studentCompetencySnapshot.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.studentProfileSummary.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.studentEvidenceFeatureCache.findUnique).not.toHaveBeenCalled();
    expect(mocks.generateRecommendations).not.toHaveBeenCalled();
  });

  it('reads Arena training count and bounded runs from one RepeatableRead transaction snapshot', async () => {
    const transactionClient = {
      arenaVirtualSimulationRun: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 17 }, (_, index) => arenaTrainingRun({ id: `arena-training-${index + 1}` })),
        ),
      },
    };
    mocks.prisma.$transaction.mockImplementationOnce(async (callback, options) => {
      expect(options).toEqual({ isolationLevel: 'RepeatableRead' });
      return callback(transactionClient);
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.arenaPortfolio.trainingSummary).toMatchObject({
      total: 17,
      previewCount: 17,
      recentRuns: expect.arrayContaining([expect.objectContaining({ id: 'arena-training-1' })]),
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'RepeatableRead' },
    );
    expect(transactionClient.arenaVirtualSimulationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'student-1' }),
        take: 100,
      }),
    );
    expect(mocks.prisma.arenaVirtualSimulationRun.count).not.toHaveBeenCalled();
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).not.toHaveBeenCalled();
  });

  it('paginates beyond the first one hundred candidates so totals use the same evidence filter', async () => {
    const firstHundred = Array.from({ length: 100 }, (_, index) => damagedArenaTrainingRun({
      id: `training-damaged-${index + 1}`,
      createdAt: new Date('2026-05-16T08:40:00.000Z'),
    }));
    const oneHundredFirst = arenaTrainingRun({
      id: 'training-complete-101',
      createdAt: new Date('2026-05-16T08:40:00.000Z'),
    });
    mocks.prisma.arenaVirtualSimulationRun.findMany
      .mockResolvedValueOnce(firstHundred)
      .mockResolvedValueOnce([oneHundredFirst]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.arenaPortfolio.trainingSummary).toMatchObject({
      total: 1,
      previewCount: 1,
      recentRuns: [expect.objectContaining({ id: 'training-complete-101' })],
    });
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany.mock.calls[0]?.[0]).toMatchObject({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany.mock.calls[1]?.[0]).toMatchObject({
      cursor: { id: 'training-damaged-100' },
      skip: 1,
    });
  });

  it('returns at most five complete displayable training rows from the bounded window', async () => {
    const page = [
      ...Array.from({ length: 95 }, (_, index) => damagedArenaTrainingRun({
        id: `training-damaged-${index + 1}`,
      })),
      ...Array.from({ length: 5 }, (_, index) => arenaTrainingRun({
        id: `training-complete-${index + 1}`,
      })),
    ];
    mocks.prisma.arenaVirtualSimulationRun.count.mockResolvedValue(100);
    mocks.prisma.arenaVirtualSimulationRun.findMany
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.arenaPortfolio.trainingSummary.recentRuns).toHaveLength(5);
    expect(body.arenaPortfolio.trainingSummary.recentRuns.every(
      (run: { confidence: string }) => run.confidence === 'low',
    )).toBe(true);
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).toHaveBeenCalledTimes(2);
  });

  it('accepts dispersed canonical and historical preview boundary paths', async () => {
    const runs = [
      arenaTrainingRun({
        id: 'training-canonical-arena',
        payload: {
          summary: {
            trackingError: 0.2,
            maxDeviation: 0.3,
            controlEnergy: 0.4,
            safetyViolations: 0,
            smoothness: 0.8,
          },
          metadata: {
            officialEligible: false,
          },
        },
        simulationRun: {
          status: 'completed',
          completedAt: new Date('2026-05-16T08:40:00.000Z'),
          summary: {
            arenaTraining: {
              evaluationVisibility: 'preview',
            },
          },
        },
      }),
      arenaTrainingRun({
        id: 'training-canonical-boundary',
        payload: {
          summary: {
            trackingError: 0.2,
            maxDeviation: 0.3,
            controlEnergy: 0.4,
            safetyViolations: 0,
            smoothness: 0.8,
          },
          metadata: {},
        },
        simulationRun: {
          status: 'completed',
          completedAt: new Date('2026-05-16T08:40:00.000Z'),
          summary: {
            previewBoundary: {
              evaluationVisibility: 'preview',
              officialEligible: false,
            },
          },
        },
      }),
      arenaTrainingRun({
        id: 'training-payload-summary',
        simulationRunId: null,
        simulationRun: null,
        payload: {
          summary: {
            trackingError: 0.2,
            maxDeviation: 0.3,
            controlEnergy: 0.4,
            safetyViolations: 0,
            smoothness: 0.8,
            arenaTraining: {
              evaluationVisibility: 'preview',
              officialEligible: false,
            },
          },
        },
      }),
      arenaTrainingRun({
        id: 'training-payload-metadata',
        simulationRunId: null,
        simulationRun: null,
        payload: {
          summary: {
            trackingError: 0.2,
            maxDeviation: 0.3,
            controlEnergy: 0.4,
            safetyViolations: 0,
            smoothness: 0.8,
          },
          metadata: {
            evaluationVisibility: 'preview',
            officialEligible: false,
          },
        },
      }),
      arenaTrainingRun({
        id: 'training-payload-boundary',
        simulationRunId: null,
        simulationRun: null,
        payload: {
          summary: {
            trackingError: 0.2,
            maxDeviation: 0.3,
            controlEnergy: 0.4,
            safetyViolations: 0,
            smoothness: 0.8,
          },
          previewBoundary: {
            evaluationVisibility: 'preview',
            officialEligible: false,
          },
        },
      }),
    ];
    mocks.prisma.arenaVirtualSimulationRun.count.mockResolvedValue(runs.length);
    mocks.prisma.arenaVirtualSimulationRun.findMany.mockResolvedValueOnce(runs);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.arenaPortfolio.trainingSummary.recentRuns).toHaveLength(5);
    expect(body.arenaPortfolio.trainingSummary.recentRuns.map((run: { id: string }) => run.id)).toEqual(
      expect.arrayContaining(runs.map((run) => run.id)),
    );
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).toHaveBeenCalledTimes(1);
  });

  it('rejects canonical boundary conflicts even when historical payload is preview-eligible', async () => {
    const conflictingRun = arenaTrainingRun({
      id: 'training-canonical-conflict',
      payload: {
        summary: {
          trackingError: 0.2,
          maxDeviation: 0.3,
          controlEnergy: 0.4,
          safetyViolations: 0,
          smoothness: 0.8,
        },
        metadata: {
          evaluationVisibility: 'preview',
          officialEligible: false,
        },
      },
      simulationRun: {
        status: 'completed',
        completedAt: new Date('2026-05-16T08:40:00.000Z'),
        summary: {
          arenaTraining: {
            evaluationVisibility: 'preview',
            officialEligible: true,
          },
        },
      },
    });
    mocks.prisma.arenaVirtualSimulationRun.count.mockResolvedValue(1);
    mocks.prisma.arenaVirtualSimulationRun.findMany.mockResolvedValueOnce([conflictingRun]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.arenaPortfolio.trainingSummary.recentRuns).toEqual([]);
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps simulationRun-null historical payload evidence when its boundary is explicit', async () => {
    const historicalRun = arenaTrainingRun({
      id: 'training-historical-null',
      simulationRunId: null,
      simulationRun: null,
      payload: {
        summary: {
          trackingError: 0.2,
          maxDeviation: 0.3,
          controlEnergy: 0.4,
          safetyViolations: 0,
          smoothness: 0.8,
        },
        metadata: {
          evaluationVisibility: 'preview',
          officialEligible: false,
        },
      },
    });
    mocks.prisma.arenaVirtualSimulationRun.count.mockResolvedValue(1);
    mocks.prisma.arenaVirtualSimulationRun.findMany.mockResolvedValueOnce([historicalRun]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.arenaPortfolio.trainingSummary.recentRuns).toEqual([
      expect.objectContaining({ id: 'training-historical-null', confidence: 'low' }),
    ]);
    expect(mocks.prisma.arenaVirtualSimulationRun.findMany).toHaveBeenCalledTimes(1);
  });

  it('keeps a historical cumulative portrait visible after more than 30 days without new facts', async () => {
    vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'));
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.competency).toMatchObject({
      availability: { state: 'SNAPSHOT', reason: 'available' },
      overallScore: 80,
      evidenceAsOf: '2026-05-20T00:00:00.000Z',
    });
  });

  it('fails closed on a fence mismatch without consulting legacy portrait sources', async () => {
    mocks.prisma.learnerPortraitCurrentState.findUnique.mockResolvedValue(
      cumulativePortraitFixture({ queueGeneration: BigInt(8) }),
    );
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.competency).toMatchObject({
      availability: {
        state: 'UNAVAILABLE',
        reason: 'current-state-version-mismatch',
      },
      overallScore: null,
      level: null,
      dimensions: [],
    });
    expect(mocks.prisma.studentCompetencySnapshot.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.studentProfileSummary.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.studentPortraitV2Snapshot.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.studentEvidenceFeatureCache.findUnique).not.toHaveBeenCalled();
  });

  it('returns an explicit no-evidence state and does not fabricate zero scores', async () => {
    mocks.prisma.learnerPortraitCurrentState.findUnique.mockResolvedValue(
      cumulativePortraitFixture({
        snapshot: null,
        stateKind: 'NO_EVIDENCE',
        availabilityReason: 'no-evidence-after-revocation',
      }),
    );
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.competency).toMatchObject({
      availability: {
        state: 'NO_EVIDENCE',
        reason: 'no-evidence-after-revocation',
      },
      overallScore: null,
      level: null,
      dimensions: [],
    });
    expect(body.latestActivity.total).toBeGreaterThan(0);
  });

  it('does not initialize profile data for a stale student session when the database user is no longer a student', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      name: 'Teacher Now',
      email: 'teacher@example.com',
      role: 'TEACHER',
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentProfile.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.userProgress.upsert).not.toHaveBeenCalled();
  });

  it('returns not found before initializing when the session user no longer exists in the database', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: '用户不存在' });
    expect(mocks.prisma.studentProfile.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.userProgress.upsert).not.toHaveBeenCalled();
  });

  it('keeps latest activity separate from portrait availability', async () => {
    mocks.prisma.learnerPortraitCurrentState.findUnique.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.competency).toMatchObject({
      availability: { state: 'UNAVAILABLE', reason: 'current-state-unavailable' },
      overallScore: null,
    });
    expect(body.latestActivity.preview).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: '完成资源学习：完整课程视频' }),
    ]));
    expect(JSON.stringify(body.latestActivity)).not.toContain('risk');
  });

  it('reconciles the old and new classes after a profile class change', async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValueOnce({
      classId: 'class-old',
    });
    mocks.prisma.studentProfile.upsert.mockResolvedValueOnce({
      userId: 'student-1',
      classId: 'class-new',
      updatedAt: new Date('2026-07-23T09:30:00.000Z'),
    });

    const response = await PATCH(new Request('http://localhost/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: 'class-new' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.requestCumulativeLearnerReconciliation).toHaveBeenCalledWith(
      mocks.prisma,
      {
        userId: 'student-1',
        classIds: ['class-old', 'class-new'],
        reason: 'class-membership:profile-update',
      },
    );
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('fails a profile class change when its durable reconciliation request cannot be written', async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValueOnce({
      classId: 'class-old',
    });
    mocks.prisma.studentProfile.upsert.mockResolvedValueOnce({
      userId: 'student-1',
      classId: 'class-new',
      updatedAt: new Date('2026-07-23T09:35:00.000Z'),
    });
    mocks.requestCumulativeLearnerReconciliation.mockRejectedValueOnce(
      new Error('durable request unavailable'),
    );

    const response = await PATCH(new Request('http://localhost/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: 'class-new' }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: '服务器错误' });
  });
});
