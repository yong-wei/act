import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readAdaptiveLearnerState: vi.fn(),
}));

vi.mock('@/lib/data-governance/adaptive-learner-state-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data-governance/adaptive-learner-state-service')>(
    '@/lib/data-governance/adaptive-learner-state-service',
  );
  return {
    ...actual,
    readAdaptiveLearnerState: mocks.readAdaptiveLearnerState,
  };
});

import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  buildKonlingRuntimeContext,
  buildKonlingToolRuntime,
  createGovernedKonlingIntervention,
  persistKonlingSessionMemories,
  recordKonlingInterventionFeedback,
  verifyKonlingRuntimeScope,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { updateSimulationState } from '@/lib/ai-tools';

function createScope(overrides: Partial<KonlingRuntimeScope> = {}): KonlingRuntimeScope {
  return {
    authenticatedUserId: 'student-1',
    targetUserId: 'student-1',
    role: 'student',
    classId: 'class-1',
    courseId: 'unit-4-5',
    pageId: 'step-03',
    resourceId: 'resource-1',
    pathNodeId: 'node-1',
    privacyScopes: ['student-visible'],
    ...overrides,
  };
}

function createStudentState() {
  return {
    currentTask: 'PID 参数调整',
    currentAttempt: 3,
    attemptHistory: [
      {
        attemptNumber: 1,
        params: { kp: 1 },
        result: { overshoot: 42, settlingTime: 80 },
        isSuccessful: false,
      },
      {
        attemptNumber: 2,
        params: { kp: 1.2 },
        result: { overshoot: 44, settlingTime: 78 },
        isSuccessful: false,
      },
    ],
  };
}

describe('konling agent runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
    delete process.env.KONLING_SEMANTIC_MEMORY_ENABLED;
    delete process.env.KONLING_STRATEGY_MEMORY_ENABLED;
    mocks.readAdaptiveLearnerState.mockResolvedValue({
      userId: 'student-1',
      authority: 'server-owned',
      primaryCompetencies: {
        vector: {
          controlModeling: { score: 88 },
          parameterDesign: { score: 72 },
          crossDomainTransfer: { score: 64 },
          engineeringDecision: { score: 50 },
          inquiryReflection: { score: 40 },
          selfDirectedLearning: { score: 66 },
        },
      },
      risks: {
        activeFlags: [],
      },
    });
  });

  it('enforces student and teacher runtime scope before tools can run', async () => {
    await expect(verifyKonlingRuntimeScope({}, {
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      targetUserId: 'student-2',
      courseId: 'unit-4-5',
      pageId: 'step-03',
    })).resolves.toMatchObject({
      ok: false,
      status: 403,
    });

    const db = {
      class: {
        findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' }),
      },
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(verifyKonlingRuntimeScope(db, {
      authenticatedUserId: 'teacher-1',
      role: 'TEACHER',
      targetUserId: 'student-1',
      classId: 'class-1',
      courseId: 'unit-4-5',
      pageId: 'step-03',
    })).resolves.toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it('builds prompt context from server learner state and not client profile defaults', async () => {
    const db = {
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'path-1', nodeIds: ['node-1', 'node-2'] },
        ]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'mem-1',
            memoryType: 'working-summary',
            privacyScope: 'student-visible',
            summary: '学生在频域裕度迁移上需要脚手架。',
            evidenceRefs: [],
            createdAt: new Date('2026-05-28T00:00:00Z'),
          },
        ]),
      },
    };

    const runtime = await buildKonlingRuntimeContext(db, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      classId: 'class-1',
      courseId: 'unit-4-5',
      pageId: 'step-03',
      resourceId: 'resource-1',
      pathNodeId: 'node-1',
      pageContextHint: {
        courseId: 'unit-4-5',
        courseTitle: '客户端标题',
        stepId: 'step-03',
        pageType: 'practice',
        topic: '客户端主题',
        learningObjectives: ['客户端目标'],
        knowledgeType: 'X',
      },
    });

    expect(runtime.learnerState).toMatchObject({ authority: 'server-owned' });
    expect(runtime.userProfile.abilityVector.computational).toBeCloseTo(0.88);
    expect(runtime.planContext.nextNodeIds).toEqual(['node-1', 'node-2']);

    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: runtime,
    });

    expect(prompt).toContain('服务端自适应上下文');
    expect(prompt).toContain('server-owned');
    expect(prompt).toContain('不得采用客户端传入的学生画像覆盖服务端学习状态');
    expect(prompt).toContain('学生在频域裕度迁移上需要脚手架');
  });

  it('retrieves scoped memory and redacts raw dialogue or answer payload fields', async () => {
    const db = {
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'mem-1',
            memoryType: 'episodic',
            privacyScope: 'student-visible',
            summary: ' repeated confusion on damping ratio ',
            evidenceRefs: [{ kind: 'konling-session', ref: 's1', rawDialogue: 'secret' }],
            createdAt: '2026-05-28T00:00:00Z',
          },
        ]),
      },
      knowledgeNode: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const scope = createScope();
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      scopedSimulationState: {
        isRunning: true,
        time: 12,
        position: { x: 1, z: 2 },
        heading: 8,
        rudder: 1,
        speed: 4,
        targetHeading: 10,
        pidGains: { kp: 2.4, ki: 0.1, kd: 0.5 },
        nomotoParams: { K: 0.08, T: 55 },
        seaState: { level: 2, waveHeight: 0.5, windSpeed: 6 },
        metrics: { avgError: 3, maxRudderRate: 0.2, currentError: 1 },
      },
      context: {
        pageContext: {
          courseId: 'unit-4-5',
          courseTitle: '约束优化',
          pageType: 'practice',
          stepId: 'step-03',
          topic: '参数优化',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['search_learning_memory'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    const memory = await runtime.searchLearningMemory({ query: 'damping' }) as Array<Record<string, unknown>>;

    expect(db.konlingMemory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        privacyScope: { in: ['student-visible'] },
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      }),
    }));
    expect(JSON.stringify(memory)).not.toContain('rawDialogue');
    expect(memory[0].summary).toBe('repeated confusion on damping ratio');

    const simulationStatus = await runtime.getSimulationStatus() as { pidGains: { Kp: number }; metrics: { avgError: string } };
    expect(simulationStatus.pidGains.Kp).toBe(2.4);
    expect(simulationStatus.metrics.avgError).toContain('米');
  });

  it('does not expose global simulation state through the scoped Konling tool', async () => {
    updateSimulationState({
      isRunning: true,
      pidGains: { kp: 9, ki: 9, kd: 9 },
    });
    const scope = createScope();
    const runtime = buildKonlingToolRuntime({
      db: {},
      scope,
      context: {
        pageContext: {
          courseId: 'unit-4-5',
          courseTitle: '约束优化',
          pageType: 'practice',
          stepId: 'step-03',
          topic: '参数优化',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['get_simulation_status'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    const status = await runtime.getSimulationStatus() as { unavailable: boolean; pidGains: { Kp: number | null } };
    expect(status.unavailable).toBe(true);
    expect(status.pidGains.Kp).toBeNull();
  });

  it('applies intervention cooldowns and persists feedback outcomes', async () => {
    const scope = createScope();
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-1',
          interventionType: 'failure-analysis',
          cooldownUntil: new Date('2026-05-28T00:30:00Z'),
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      konlingMemory: {
        create: vi.fn().mockResolvedValue({
          id: 'mem-1',
          memoryType: 'intervention-outcome',
          privacyScope: 'teacher-scoped',
          summary: '学生对干预 intv-1 的反馈：rated，helpful=true',
          evidenceRefs: [],
          createdAt: new Date('2026-05-28T00:00:00Z'),
        }),
      },
    };

    const intervention = await createGovernedKonlingIntervention(db, {
      scope,
      studentState: createStudentState(),
      now: new Date('2026-05-28T00:00:00Z'),
    });

    expect(intervention).toMatchObject({
      shouldIntervene: false,
      reason: 'cooldown-active',
      id: 'intv-1',
    });
    expect(db.aIIntervention.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        sessionId: 'konling:unit-4-5:step-03',
        classId: 'class-1',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      }),
    }));
    expect(db.aIIntervention.create).not.toHaveBeenCalled();

    await recordKonlingInterventionFeedback(db, {
      scope,
      interventionId: 'intv-1',
      feedback: 'rated',
      helpful: true,
      studentResponse: '有帮助，但不要保存 rawDialogue',
    });

    expect(db.aIIntervention.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'intv-1',
        userId: 'student-1',
        classId: 'class-1',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      },
      data: expect.objectContaining({
        wasHelpful: true,
        outcome: expect.objectContaining({
          feedback: 'rated',
          helpful: true,
        }),
      }),
    }));
    expect(JSON.stringify(db.aIIntervention.updateMany.mock.calls)).not.toContain('rawDialogue');
    expect(db.konlingMemory.create).toHaveBeenCalled();
  });

  it('does not let foreign scoped cooldown records block current interventions', async () => {
    const scope = createScope();
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (
            where.classId === 'foreign-class' &&
            where.resourceId === 'foreign-resource' &&
            where.pathNodeId === 'foreign-node'
          ) {
            return {
              id: 'foreign-intv',
              interventionType: 'failure-analysis',
              cooldownUntil: new Date('2026-05-28T00:30:00Z'),
            };
          }
          return null;
        }),
        create: vi.fn().mockResolvedValue({ id: 'intv-current' }),
      },
      konlingMemory: {
        create: vi.fn().mockResolvedValue({
          id: 'mem-1',
          memoryType: 'intervention-outcome',
          privacyScope: 'teacher-scoped',
          summary: 'current intervention',
          evidenceRefs: [],
          createdAt: new Date('2026-05-28T00:00:00Z'),
        }),
      },
    };

    const intervention = await createGovernedKonlingIntervention(db, {
      scope,
      studentState: createStudentState(),
      now: new Date('2026-05-28T00:00:00Z'),
    });

    expect(intervention).toMatchObject({
      shouldIntervene: true,
      id: 'intv-current',
    });
    expect(db.aIIntervention.create).toHaveBeenCalled();
  });

  it('does not persist no-op interventions or feedback outside the current scope', async () => {
    const scope = createScope();
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
    };

    const noOp = await createGovernedKonlingIntervention(db, {
      scope,
      studentState: {
        currentTask: '稳定探索',
        currentAttempt: 1,
        attemptHistory: [
          {
            attemptNumber: 1,
            params: { kp: 1 },
            result: { overshoot: 10, settlingTime: 30 },
            isSuccessful: true,
          },
        ],
      },
      now: new Date('2026-05-28T00:00:00Z'),
    });

    expect(noOp).toMatchObject({
      shouldIntervene: false,
      interventionType: 'none',
    });
    expect(db.aIIntervention.create).not.toHaveBeenCalled();

    await expect(recordKonlingInterventionFeedback(db, {
      scope,
      interventionId: 'foreign-intv',
      feedback: 'rated',
      helpful: false,
    })).rejects.toMatchObject({
      status: 404,
    });
    expect(db.konlingMemory.create).not.toHaveBeenCalled();
  });

  it('persists non-verbatim session memory summaries', async () => {
    const db = {
      konlingMemory: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: `${data.memoryType}-1`,
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
    };

    await persistKonlingSessionMemories(db, {
      userId: 'student-1',
      sessionId: 'session-1',
      classId: 'class-1',
      courseId: 'unit-4-5',
      pageId: 'step-03',
      resourceId: 'resource-1',
      pathNodeId: 'node-1',
      userMessage: '我不懂，答案是 Kp=3.14159，我的 rawDialogue 和 privateLearnerEvidence 是这些原文',
      assistantMessage: '逐字回答内容 answerData hiddenEvaluation 不应进入记忆',
    });

    const stored = JSON.stringify(db.konlingMemory.create.mock.calls);
    expect(stored).toContain('困惑澄清');
    expect(stored).toContain('class-1');
    expect(stored).toContain('resource-1');
    expect(stored).toContain('node-1');
    expect(stored).not.toContain('3.14159');
    expect(stored).not.toContain('rawDialogue');
    expect(stored).not.toContain('privateLearnerEvidence');
    expect(stored).not.toContain('answerData');
    expect(stored).not.toContain('hiddenEvaluation');
  });

  it('keeps semantic and strategy memory disabled unless later flags enable them', async () => {
    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      courseId: 'unit-4-5',
      pageId: 'step-03',
    });

    expect(runtime.featureFlags).toMatchObject({
      learnerState: true,
      semanticMemory: false,
      strategyMemory: false,
    });
  });
});
