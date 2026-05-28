import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  buildScopedKonlingAiTools,
  buildKonlingRuntimeContext,
  buildKonlingToolRuntime,
  createKonlingAgentSession,
  createGovernedKonlingIntervention,
  createScopedKonlingMemory,
  completeKonlingToolRun,
  failKonlingToolRun,
  getOrCreateKonlingAgentSession,
  KONLING_TOOL_REGISTRY,
  persistKonlingSessionMemories,
  recordKonlingInterventionFeedback,
  resumeKonlingAgentSession,
  startKonlingToolRun,
  verifyKonlingRuntimeScope,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { clearPendingChanges, getPendingChanges, updateSimulationState } from '@/lib/ai-tools';

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
    clearPendingChanges();
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

  it('keeps scoped simulation parameter and analysis tools without writing legacy pending changes', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const runtime = buildKonlingToolRuntime({
      db: {},
      scope,
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'simulation',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'S',
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
        permittedTools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
      scopedSimulationState: {
        isRunning: true,
        pidGains: { kp: 1.4, ki: 0.02, kd: 0.7 },
      },
    });
    const scopedTools = buildScopedKonlingAiTools(runtime);

    expect(scopedTools).toHaveProperty('set_simulation_params');
    expect(scopedTools).toHaveProperty('analyze_result');

    const change = await runtime.setSimulationParams({ kp: 1.8, ki: 0.04 }) as {
      success: boolean;
      pendingRequest: { params: { kp: number; ki: number }; scope: { courseId: string; pageId: string } };
    };
    expect(change.success).toBe(true);
    expect(change.pendingRequest.params).toMatchObject({ kp: 1.8, ki: 0.04 });
    expect(change.pendingRequest.scope).toMatchObject({ courseId: 'simulation', pageId: 'pid-default' });
    expect(getPendingChanges()).toBeNull();

    const analysis = await runtime.analyzeResult({
      avgError: 42,
      maxRudderRate: 2,
      duration: 120,
      controlMode: 'pid',
      kp: 1.8,
      ki: 0.04,
      kd: 0.7,
    }) as { performance: { grade: string } };
    expect(analysis.performance.grade).toContain('优秀');
  });

  it('audits scoped runtime tool calls and gates write tools when an agent session is attached', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['get_page_context', 'record_intervention_result'],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (!where?.id) return null;
          return {
            id: where.id,
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            agentSessionId: 'agent-session-1',
            toolName: 'get_page_context',
            permissionTier: 'read',
            approvalState: 'not_required',
            status: 'running',
            inputSummary: {},
            outputSummary: null,
            errorSummary: null,
            idempotencyKey: null,
            correlationId: 'corr-1',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: null,
            latencyMs: null,
          };
        }),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: `tool-run-${data.toolName}`,
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-1',
          userId: 'student-1',
          classId: 'class-1',
          resourceId: null,
          pathNodeId: null,
        }),
        updateMany: vi.fn(),
      },
      konlingMemory: {
        create: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'simulation',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'S',
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
        permittedTools: ['get_page_context', 'record_intervention_result'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    await runtime.getPageContext();
    const writeResult = await runtime.recordInterventionResult({
      interventionId: 'intv-1',
      feedback: 'accepted',
      studentResponse: 'ok',
    }) as { approvalRequired: boolean; toolRunId: string };

    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        agentSessionId: 'agent-session-1',
        toolName: 'get_page_context',
        approvalState: 'not_required',
      }),
    }));
    expect(db.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'succeeded' }),
    }));
    expect(writeResult).toMatchObject({
      approvalRequired: true,
      toolRunId: 'tool-run-record_intervention_result',
    });
    expect(db.agentSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'awaiting_approval',
        pendingApproval: expect.objectContaining({
          toolRunId: 'tool-run-record_intervention_result',
          toolName: 'record_intervention_result',
          status: 'awaiting_approval',
        }),
      }),
    }));
    expect(db.aIIntervention.updateMany).not.toHaveBeenCalled();
    expect(db.konlingMemory.create).not.toHaveBeenCalled();
  });

  it('rejects simulation write approvals outside simulation scope before creating tool runs', async () => {
    const scope = createScope({ courseId: 'unit-4-5', pageId: 'step-03' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
        updateMany: vi.fn(),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'unit-4-5',
          courseTitle: '参数优化',
          pageType: 'lesson',
          stepId: 'step-03',
          topic: '约束翻译',
          learningObjectives: [],
          knowledgeType: 'S',
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
        permittedTools: ['set_simulation_params'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    await expect(runtime.setSimulationParams({ kp: 1.8 })).rejects.toMatchObject({ status: 403 });
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).not.toHaveBeenCalled();
  });

  it('returns simulation parameter request previews with approval-required tool runs', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-set-params',
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'simulation',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'S',
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
        permittedTools: ['set_simulation_params'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    const result = await runtime.setSimulationParams({ kp: 1.8, ki: 0.04 }) as {
      approvalRequired: boolean;
      pendingRequest: { params: { kp: number; ki: number } };
      pendingChanges: string;
    };

    expect(result).toMatchObject({
      approvalRequired: true,
      success: true,
      toolRunId: 'tool-run-set-params',
      pendingRequest: {
        params: { kp: 1.8, ki: 0.04 },
      },
    });
    expect(result.pendingChanges).toContain('Kp: 1.8');
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pendingApproval: expect.objectContaining({
          toolRunId: 'tool-run-set-params',
          preview: expect.objectContaining({
            pendingRequest: expect.objectContaining({
              params: { kp: 1.8, ki: 0.04 },
            }),
          }),
        }),
      }),
    }));
  });

  it('rejects foreign intervention approvals before creating tool runs', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['record_intervention_result'],
        }),
        updateMany: vi.fn(),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'simulation',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'S',
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
        permittedTools: ['record_intervention_result'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    await expect(runtime.recordInterventionResult({
      interventionId: 'foreign-intv',
      feedback: 'accepted',
    })).rejects.toMatchObject({ status: 404 });
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).not.toHaveBeenCalled();
  });

  it('exposes idempotency keys in approval-required write tool schemas', () => {
    const tools = buildScopedKonlingAiTools({} as ReturnType<typeof buildKonlingToolRuntime>);

    expect((tools.set_simulation_params.parameters as any).shape).toHaveProperty('idempotencyKey');
    expect((tools.record_intervention_result.parameters as any).shape).toHaveProperty('idempotencyKey');
  });

  it('filters exposed AI tool schemas to the current agent session permissions', () => {
    const tools = buildScopedKonlingAiTools({
      permittedTools: ['get_page_context'],
      getPageContext: vi.fn(),
      getLearnerState: vi.fn(),
      getPlanContext: vi.fn(),
      searchLearningMemory: vi.fn(),
      searchKnowledgeGraph: vi.fn(),
      recommendNextAction: vi.fn(),
      getSimulationStatus: vi.fn(),
      setSimulationParams: vi.fn(),
      analyzeResult: vi.fn(),
      recordInterventionResult: vi.fn(),
      analyzeAttempt: vi.fn(),
    } as unknown as ReturnType<typeof buildKonlingToolRuntime>);

    expect(tools).toHaveProperty('get_page_context');
    expect(tools).not.toHaveProperty('set_simulation_params');
    expect(tools).not.toHaveProperty('record_intervention_result');
  });

  it('reuses completed idempotent tool runs without repeating side effects', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const outputSummary = {
      success: true,
      outcome: {
        feedback: 'accepted',
        helpful: true,
      },
    };
    const completedRun = {
      id: 'tool-run-existing',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'record_intervention_result',
      permissionTier: 'write',
      approvalState: 'approved',
      status: 'succeeded',
      inputSummary: { interventionId: 'intv-1' },
      outputSummary,
      errorSummary: null,
      idempotencyKey: 'same-key',
      correlationId: 'corr-existing',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: new Date('2026-05-28T00:00:01Z'),
      latencyMs: 1000,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['record_intervention_result'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(completedRun),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-1',
          userId: 'student-1',
          classId: 'class-1',
          resourceId: 'resource-1',
          pathNodeId: 'node-1',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'simulation',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'S',
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
        permittedTools: ['record_intervention_result'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    const result = await runtime.recordInterventionResult({
      interventionId: 'intv-1',
      feedback: 'accepted',
      helpful: true,
      studentResponse: 'ok',
      idempotencyKey: 'same-key',
    } as Parameters<typeof runtime.recordInterventionResult>[0] & { idempotencyKey: string });

    expect(result).toMatchObject(outputSummary);
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.aIIntervention.updateMany).not.toHaveBeenCalled();
    expect(db.konlingMemory.create).not.toHaveBeenCalled();
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

  it('creates and resumes user-owned task agent sessions without reusing Konling chat history', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'agent-session-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          phase: 'draft-plan',
          status: 'paused',
          stateJson: { step: 2 },
          permittedTools: ['get_page_context'],
          pendingApproval: null,
          expiresAt: new Date('2026-06-04T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        }),
      },
      konlingSession: {
        findFirst: vi.fn(),
      },
    };

    const created = await createKonlingAgentSession(db, {
      scope,
      phase: 'draft-plan',
      status: 'draft',
      state: { step: 1 },
      permittedTools: ['get_page_context'],
    });
    const resumed = await resumeKonlingAgentSession(db, {
      scope,
      agentSessionId: 'agent-session-1',
    });

    expect(created).toMatchObject({
      id: 'agent-session-1',
      ownerUserId: 'student-1',
      status: 'draft',
    });
    expect(resumed).toMatchObject({
      id: 'agent-session-1',
      ownerUserId: 'student-1',
      status: 'paused',
      state: { step: 2 },
    });
    expect(db.agentSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'agent-session-1',
        ownerUserId: 'student-1',
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
      }),
    }));
    expect(db.konlingSession.findFirst).not.toHaveBeenCalled();
  });

  it('reuses the latest scoped awaiting approval agent session before creating a new runtime session', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-awaiting',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          phase: 'ai-chat-tool-runtime',
          status: 'awaiting_approval',
          stateJson: { route: '/api/ai/chat' },
          permittedTools: ['set_simulation_params'],
          pendingApproval: { toolRunId: 'tool-run-pending' },
          expiresAt: null,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:05:00Z'),
        }),
        create: vi.fn(),
      },
    };

    const resolved = await getOrCreateKonlingAgentSession(db, {
      scope,
      phase: 'ai-chat-tool-runtime',
      status: 'running',
      state: { route: '/api/ai/chat' },
      permittedTools: ['get_page_context'],
    });

    expect(resolved).toMatchObject({
      id: 'agent-session-awaiting',
      status: 'awaiting_approval',
      pendingApproval: { toolRunId: 'tool-run-pending' },
    });
    expect(db.agentSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ownerUserId: 'student-1',
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        phase: 'ai-chat-tool-runtime',
        status: 'awaiting_approval',
      }),
      orderBy: { updatedAt: 'desc' },
    }));
    expect(db.agentSession.create).not.toHaveBeenCalled();
  });

  it('declares durable AgentSession and AgentToolRun persistence contracts in Prisma', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('model AgentSession');
    expect(schema).toMatch(/ownerUserId\s+String/);
    expect(schema).toMatch(/stateJson\s+Json/);
    expect(schema).toMatch(/permittedTools\s+String\[\]/);
    expect(schema).toContain('model AgentToolRun');
    expect(schema).toMatch(/agentSessionId\s+String/);
    expect(schema).toMatch(/approvalState\s+String/);
    expect(schema).toMatch(/correlationId\s+String/);
    expect(schema).toContain('@@unique([ownerUserId, toolName, idempotencyKey])');
  });

  it('registers tool tiers and routes write tools into approval-required tool runs', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
    };

    expect(KONLING_TOOL_REGISTRY.set_simulation_params).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'required',
    });
    expect(KONLING_TOOL_REGISTRY.analyze_result).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
    });

    const toolRun = await startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'set_simulation_params',
      input: {
        kp: 1.8,
        rawDialogue: 'do not store',
        hiddenEvaluation: { score: 99 },
      },
      idempotencyKey: 'set-pid-1',
      correlationId: 'corr-1',
    });

    expect(toolRun).toMatchObject({
      id: 'tool-run-1',
      ownerUserId: 'student-1',
      toolName: 'set_simulation_params',
      permissionTier: 'write',
      approvalState: 'required',
      status: 'awaiting_approval',
      idempotencyKey: 'set-pid-1',
      correlationId: 'corr-1',
    });
    expect(JSON.stringify(db.agentToolRun.create.mock.calls)).not.toContain('rawDialogue');
    expect(JSON.stringify(db.agentToolRun.create.mock.calls)).not.toContain('hiddenEvaluation');
  });

  it('enforces owner-scoped idempotency before creating another state-changing tool run', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tool-run-existing',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          targetUserId: 'student-1',
          agentSessionId: 'agent-session-1',
          toolName: 'set_simulation_params',
          permissionTier: 'write',
          approvalState: 'required',
          status: 'awaiting_approval',
          inputSummary: { kp: 1.8 },
          outputSummary: null,
          errorSummary: null,
          idempotencyKey: 'same-key',
          correlationId: 'corr-existing',
          startedAt: new Date('2026-05-28T00:00:00Z'),
          completedAt: null,
          latencyMs: null,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        }),
        create: vi.fn(),
      },
    };

    const toolRun = await startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'set_simulation_params',
      input: { kp: 2.0 },
      idempotencyKey: 'same-key',
      correlationId: 'corr-new',
    });

    expect(toolRun).toMatchObject({
      id: 'tool-run-existing',
      idempotencyKey: 'same-key',
    });
    expect(db.agentToolRun.findFirst).toHaveBeenCalledWith({
      where: {
        ownerUserId: 'student-1',
        toolName: 'set_simulation_params',
        idempotencyKey: 'same-key',
      },
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('rejects foreign agent sessions before creating tool-run side effects', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };

    await expect(startKonlingToolRun(db, {
      scope,
      agentSessionId: 'foreign-agent-session',
      toolName: 'set_simulation_params',
      input: { kp: 2 },
      idempotencyKey: 'foreign-run',
    })).rejects.toMatchObject({ status: 404 });
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('treats an empty agent-session permittedTools list as no tool permission', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: [],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };

    await expect(startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'get_page_context',
      input: {},
    })).rejects.toMatchObject({ status: 403 });
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('blocks write tool completion until approval and redacts output and error summaries', async () => {
    const scope = createScope();
    const startedAt = new Date('2026-05-28T00:00:00Z');
    const completedAt = new Date('2026-05-28T00:00:01Z');
    const approvedRun = {
      id: 'tool-run-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'set_simulation_params',
      permissionTier: 'write',
      approvalState: 'approved',
      status: 'running',
      inputSummary: { kp: 1.8 },
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'set-pid-1',
      correlationId: 'corr-1',
      startedAt,
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            ...approvedRun,
            approvalState: 'required',
            status: 'awaiting_approval',
          })
          .mockResolvedValueOnce(approvedRun)
          .mockResolvedValueOnce(approvedRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await expect(completeKonlingToolRun(db, {
      scope,
      toolRunId: 'tool-run-1',
      output: { accepted: true, promptContent: 'secret' },
      now: completedAt,
    })).rejects.toMatchObject({ status: 403 });
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();

    await expect(completeKonlingToolRun(db, {
      scope,
      toolRunId: 'tool-run-1',
      output: { accepted: true, promptContent: 'secret' },
      now: completedAt,
    })).resolves.toEqual({ success: true, status: 'succeeded' });
    await expect(failKonlingToolRun(db, {
      scope,
      toolRunId: 'tool-run-1',
      error: { message: 'failed', rawDialogue: 'secret' },
      now: completedAt,
    })).resolves.toEqual({ success: true, status: 'failed' });

    const updatePayloads = JSON.stringify(db.agentToolRun.updateMany.mock.calls);
    expect(updatePayloads).toContain('"latencyMs":1000');
    expect(updatePayloads).not.toContain('promptContent');
    expect(updatePayloads).not.toContain('rawDialogue');
  });

  it('requires scoped owner writes for long-term Konling memory', async () => {
    const scope = createScope();
    const db = {
      konlingMemory: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'scoped-memory-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
    };

    await expect(createScopedKonlingMemory(db, {
      scope: createScope({ targetUserId: 'student-2' }),
      memoryType: 'episodic',
      summary: 'foreign memory',
      evidenceRefs: [{ kind: 'test', ref: 'foreign' }],
    })).rejects.toMatchObject({ status: 403 });

    const memory = await createScopedKonlingMemory(db, {
      scope,
      memoryType: 'episodic',
      summary: 'student scoped memory with promptContent removed',
      evidenceRefs: [{ kind: 'test', ref: 'owned', promptContent: 'secret' }],
    });

    expect(memory).toMatchObject({
      id: 'scoped-memory-1',
      memoryType: 'episodic',
      privacyScope: 'student-visible',
    });
    expect(db.konlingMemory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'student-1',
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      }),
    }));
    expect(JSON.stringify(db.konlingMemory.create.mock.calls)).not.toContain('promptContent');
  });
});
