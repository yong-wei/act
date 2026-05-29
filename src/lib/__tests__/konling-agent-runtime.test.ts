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
  type KonlingRuntimeContext,
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

function createRuntimeContext(overrides: Partial<KonlingRuntimeContext> = {}): KonlingRuntimeContext {
  return {
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
    permittedTools: [
      'get_simulation_context',
      'run_virtual_simulation',
      'analyze_simulation_trace',
      'compare_simulation_runs',
      'propose_controller_patch',
      'apply_controller_patch',
    ],
    missingContext: [],
    featureFlags: {
      learnerState: false,
      semanticMemory: false,
      strategyMemory: false,
    },
    ...overrides,
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

    const foreignClassDb = {
      class: {
        findUnique: vi.fn().mockResolvedValue({ id: 'class-2', teacherId: 'teacher-2' }),
      },
      studentProfile: {
        findFirst: vi.fn(),
      },
    };
    await expect(verifyKonlingRuntimeScope(foreignClassDb, {
      authenticatedUserId: 'teacher-1',
      role: 'TEACHER',
      targetUserId: 'teacher-1',
      classId: 'class-2',
      courseId: 'unit-4-5',
      pageId: 'step-03',
    })).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
    expect(foreignClassDb.studentProfile.findFirst).not.toHaveBeenCalled();
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

  it('registers persisted simulation tool schemas, tiers, and idempotency boundaries', () => {
    expect(KONLING_TOOL_REGISTRY.get_simulation_context).toMatchObject({
      permissionTier: 'read',
      approvalPolicy: 'none',
      idempotencyPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.run_virtual_simulation).toMatchObject({
      permissionTier: 'run',
      approvalPolicy: 'none',
      idempotencyPolicy: 'reuse',
    });
    expect(KONLING_TOOL_REGISTRY.analyze_simulation_trace).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
      idempotencyPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.compare_simulation_runs).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
      idempotencyPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.propose_controller_patch).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
      idempotencyPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.apply_controller_patch).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'required',
      idempotencyPolicy: 'reuse',
    });

    const tools = buildScopedKonlingAiTools({} as ReturnType<typeof buildKonlingToolRuntime>);
    expect(tools).toHaveProperty('get_simulation_context');
    expect(tools).toHaveProperty('run_virtual_simulation');
    expect(tools).toHaveProperty('analyze_simulation_trace');
    expect(tools).toHaveProperty('compare_simulation_runs');
    expect(tools).toHaveProperty('propose_controller_patch');
    expect(tools).toHaveProperty('apply_controller_patch');
    expect((tools.run_virtual_simulation.parameters as any).shape).toHaveProperty('idempotencyKey');
    expect((tools.apply_controller_patch.parameters as any).shape).toHaveProperty('idempotencyKey');
  });

  it('resolves simulation context from persisted runs with student owner isolation and no global state dependency', async () => {
    updateSimulationState({
      isRunning: true,
      pidGains: { kp: 9, ki: 9, kd: 9 },
    });
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-1',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: 'simulation',
          pageId: 'pid-default',
          resourceId: 'resource-1',
          runKind: 'scene_simulation',
          sourceDomain: 'simulation_scene',
          sourceRefId: 'scene-run-1',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
          },
          controllerSnapshotRef: 'controller:pid:hash-1',
          status: 'completed',
          summary: {
            metrics: { settlingTime: 4.2 },
            controller: { kp: 1.6 },
            lowEvidence: false,
          },
          replayToken: 'replay-token-1',
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          sceneSpecVersion: 'scene-spec-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          startedAt: new Date('2026-05-28T00:00:01Z'),
          completedAt: new Date('2026-05-28T00:00:08Z'),
          traces: [
            {
              id: 'trace-1',
              checksum: 'sha256:trace-1',
              summaryMetrics: { settlingTime: 4.2 },
              sampleCount: 160,
              sampleCadence: 0.05,
              sampleStorageUri: 's3://traces/run-1.json',
              createdAt: new Date('2026-05-28T00:00:08Z'),
            },
          ],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const context = await runtime.getSimulationContext({ simulationRunId: 'run-1' }) as Record<string, any>;

    expect(db.simulationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'run-1',
        ownerUserId: 'student-1',
        OR: expect.arrayContaining([
          expect.objectContaining({ courseId: 'simulation', resourceId: 'resource-1' }),
          expect.objectContaining({ sourceDomain: 'arena_virtual_preview', courseId: null, resourceId: null }),
        ]),
      }),
    }));
    expect(context).toMatchObject({
      simulationRunId: 'run-1',
      accessScope: 'owner',
      provenance: {
        runKind: 'scene_simulation',
        sourceDomain: 'simulation_scene',
        evaluationVisibility: 'preview',
        officialEligible: false,
      },
      traceRef: {
        traceId: 'trace-1',
        sampleCount: 160,
      },
    });
    expect(JSON.stringify(context)).not.toContain('"kp":9');
  });

  it('resolves legacy Arena preview runs without run-level course scope through task spec launch context', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: 'resource-1' });
    const arenaRun = {
      id: 'arena-run-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: null,
      resourceId: null,
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
        launchContext: {
          classId: 'class-1',
          resourceId: 'resource-1',
        },
      },
      status: 'completed',
      summary: { overshoot: 0.18, settlingTime: 4.2 },
      replayToken: 'arena-replay-token',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [],
    };
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockImplementation(async (args) => (
          args.where?.OR ? arenaRun : null
        )),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const context = await runtime.getSimulationContext({ simulationRunId: 'arena-run-1' }) as Record<string, any>;

    expect(db.simulationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'arena-run-1',
        ownerUserId: 'student-1',
        OR: expect.arrayContaining([
          expect.objectContaining({ courseId: 'simulation', resourceId: 'resource-1' }),
          expect.objectContaining({ sourceDomain: 'arena_virtual_preview', courseId: null, resourceId: null }),
        ]),
      }),
    }));
    expect(context).toMatchObject({
      simulationRunId: 'arena-run-1',
      provenance: {
        runKind: 'arena_preview',
        sourceDomain: 'arena_virtual_preview',
        resourceId: null,
      },
      task: {
        launchContext: expect.objectContaining({
          resourceId: 'resource-1',
        }),
      },
    });
  });

  it('rejects legacy Arena preview fallback when task spec launch resource differs from runtime scope', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: 'resource-1' });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'arena-run-foreign',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: null,
          resourceId: null,
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: 'arena-preview-foreign',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            launchContext: {
              resourceId: 'resource-foreign',
            },
          },
          status: 'completed',
          summary: {},
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ simulationRunId: 'arena-run-foreign' })).rejects.toMatchObject({
      status: 403,
      message: '无权访问该 SimulationRun。',
    });
  });

  it('rejects legacy Arena preview fallback when runtime scope lacks the declared launch resource', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: null });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'arena-run-resource-only',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: null,
          resourceId: null,
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: 'arena-preview-resource-only',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            launchContext: {
              resourceId: 'resource-1',
            },
          },
          status: 'completed',
          summary: {},
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ simulationRunId: 'arena-run-resource-only' })).rejects.toMatchObject({
      status: 403,
      message: '无权访问该 SimulationRun。',
    });
  });

  it('rejects simulation runs when run-level and task-spec launch resources conflict', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: 'resource-1' });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-conflicting-resource',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: 'simulation',
          resourceId: 'resource-1',
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: 'arena-preview-conflicting-resource',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            launchContext: {
              courseId: 'simulation',
              resourceId: 'resource-foreign',
            },
          },
          status: 'completed',
          summary: {},
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ simulationRunId: 'run-conflicting-resource' })).rejects.toMatchObject({
      status: 403,
      message: '无权访问该 SimulationRun。',
    });
  });

  it('resolves simulation context directly from a task spec before any run exists', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-spec-1',
          payload: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            objectives: ['settling_time'],
            constraints: ['overshoot'],
            disturbancePolicy: { source: 'konling_plan' },
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            allowedControllers: ['pid'],
            launchContext: {
              courseId: 'simulation',
              classId: 'class-1',
              resourceId: 'resource-1',
              pageId: 'pid-default',
            },
            specHash: 'sha256:task-spec-1',
          },
          launchContext: {
            courseId: 'simulation',
            classId: 'class-1',
            resourceId: 'resource-1',
            pageId: 'pid-default',
          },
        }),
      },
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const context = await runtime.getSimulationContext({ taskSpecId: 'task-spec-1' }) as Record<string, any>;

    expect(db.simulationTaskSpec.findFirst).toHaveBeenCalledWith({
      where: { id: 'task-spec-1' },
    });
    expect(db.simulationRun.findFirst).not.toHaveBeenCalled();
    expect(context).toMatchObject({
      taskSpecId: 'task-spec-1',
      simulationRunId: null,
      accessScope: 'owner',
      task: {
        taskSpecHash: 'sha256:task-spec-1',
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      controllerSnapshotRef: null,
      status: 'task_spec_ready',
      replay: {
        replayToken: null,
        replayState: 'not_run',
      },
      evidenceStatus: {
        lowEvidence: true,
        traceAvailable: false,
        replayAvailable: false,
      },
      traceRef: null,
      rawTraceIncluded: false,
    });
  });

  it('rejects task spec context when declared resource scope is absent from the runtime scope', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: null });
    const db = {
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-spec-foreign-resource',
          payload: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            objectives: ['settling_time'],
            constraints: ['overshoot'],
            disturbancePolicy: {},
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            allowedControllers: ['pid'],
            launchContext: {
              courseId: 'simulation',
              resourceId: 'resource-foreign',
              pageId: 'pid-default',
            },
            specHash: 'sha256:task-spec-foreign-resource',
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ taskSpecId: 'task-spec-foreign-resource' })).rejects.toMatchObject({
      status: 403,
      message: '无权访问该 SimulationTaskSpec。',
    });
  });

  it('rejects publication-only task specs until publication scope is part of the Konling runtime scope', async () => {
    const scope = createScope({
      courseId: 'simulation',
      classId: null,
      resourceId: null,
      pageId: 'pid-default',
    });
    const db = {
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-spec-publication-only',
          payload: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            objectives: ['settling_time'],
            constraints: ['overshoot'],
            disturbancePolicy: {},
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            allowedControllers: ['pid'],
            launchContext: {
              publicationId: 'publication-1',
            },
            specHash: 'sha256:task-spec-publication-only',
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ taskSpecId: 'task-spec-publication-only' })).rejects.toMatchObject({
      status: 403,
      message: 'SimulationTaskSpec 缺少可验证的 Konling 仿真作用域。',
    });
  });

  it('rejects agent-session-only task specs because agentSessionId is not a runtime scope anchor', async () => {
    const scope = createScope({
      courseId: 'simulation',
      classId: null,
      resourceId: null,
      pageId: 'pid-default',
    });
    const db = {
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-spec-agent-session-only',
          payload: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            objectives: ['settling_time'],
            constraints: ['overshoot'],
            disturbancePolicy: {},
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            allowedControllers: ['pid'],
            launchContext: {
              agentSessionId: 'agent-session-1',
            },
            specHash: 'sha256:task-spec-agent-session-only',
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ taskSpecId: 'task-spec-agent-session-only' })).rejects.toMatchObject({
      status: 403,
      message: 'SimulationTaskSpec 缺少可验证的 Konling 仿真作用域。',
    });
  });

  it('allows teacher class-scoped simulation reads without student impersonation or raw trace exposure', async () => {
    const scope = createScope({
      authenticatedUserId: 'teacher-1',
      targetUserId: 'teacher-1',
      role: 'teacher',
      classId: 'class-1',
      courseId: 'simulation',
      resourceId: null,
      privacyScopes: ['student-visible', 'teacher-scoped'],
    });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-1',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: 'simulation',
          pageId: 'pid-default',
          runKind: 'scene_simulation',
          sourceDomain: 'simulation_scene',
          sourceRefId: 'scene-run-1',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
          },
          status: 'completed',
          summary: { metrics: { settlingTime: 4.2 } },
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [
            {
              id: 'trace-1',
              checksum: 'sha256:trace-1',
              summaryMetrics: { settlingTime: 4.2 },
              sampleCount: 160,
              sampleCadence: 0.05,
              sampleStorageUri: 's3://traces/run-1.json',
              createdAt: new Date('2026-05-28T00:00:08Z'),
            },
          ],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const context = await runtime.getSimulationContext({ simulationRunId: 'run-1', includeTrace: true }) as Record<string, any>;

    expect(db.simulationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'run-1',
        classId: 'class-1',
      }),
    }));
    expect(JSON.stringify(db.simulationRun.findFirst.mock.calls)).not.toContain('"ownerUserId":"teacher-1"');
    expect(context).toMatchObject({
      accessScope: 'class-summary',
      rawTraceIncluded: false,
      traceRef: {
        traceId: 'trace-1',
      },
    });
    expect(context.traceRef.sampleStorageUri).toBeNull();
  });

  it('analyzes traces, compares runs, and proposes patches from canonical simulation references', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const runRow = {
      id: 'run-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      pageId: 'pid-default',
      resourceId: 'resource-1',
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      status: 'completed',
      summary: { metrics: { overshoot: 0.28, settlingTime: 6.5 }, lowEvidence: false },
      replayToken: 'preview-replay-token',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-1',
          checksum: 'sha256:trace-1',
          summaryMetrics: { overshoot: 0.28, settlingTime: 6.5 },
          sampleCount: 160,
          sampleCadence: 0.05,
          sampleStorageUri: 's3://traces/run-1.json',
          createdAt: new Date('2026-05-28T00:00:08Z'),
        },
      ],
    };
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(runRow),
        findMany: vi.fn().mockResolvedValue([
          runRow,
          {
            ...runRow,
            id: 'run-2',
            sourceRefId: 'arena-preview-2',
            summary: { metrics: { overshoot: 0.12, settlingTime: 4.2 }, lowEvidence: false },
          },
        ]),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const analysis = await runtime.analyzeSimulationTrace({ simulationRunId: 'run-1' }) as Record<string, any>;
    expect(analysis).toMatchObject({
      simulationRunId: 'run-1',
      traceId: 'trace-1',
      analyzer: {
        summaryMetrics: { overshoot: 0.28, settlingTime: 6.5 },
        sampleCount: 160,
      },
      rawTraceIncluded: false,
    });

    const comparison = await runtime.compareSimulationRuns({ simulationRunIds: ['run-1', 'run-2'] }) as Record<string, any>;
    expect(comparison).toMatchObject({
      comparedRunIds: ['run-1', 'run-2'],
      runs: [
        {
          simulationRunId: 'run-1',
          provenance: {
            runKind: 'arena_preview',
            sourceDomain: 'arena_virtual_preview',
            evaluationVisibility: 'preview',
            officialEligible: false,
          },
        },
        { simulationRunId: 'run-2' },
      ],
      rawTraceIncluded: false,
    });

    const proposal = await runtime.proposeControllerPatch({
      simulationRunId: 'run-1',
      objective: '降低超调并缩短调节时间',
      targetMetrics: { 'controller.ki': 0.05 },
      constraints: ['rudder_rate'],
    }) as Record<string, any>;

    expect(proposal).toMatchObject({
      simulationRunId: 'run-1',
      candidatePatch: expect.objectContaining({ kp: 0.9, ki: 0.05 }),
      affectedControllerFields: expect.arrayContaining(['kp', 'ki']),
      mutatesControllerDraft: false,
      evidenceReferences: expect.arrayContaining([
        { kind: 'SimulationRun', id: 'run-1' },
        { kind: 'SimulationTrace', id: 'trace-1' },
      ]),
    });
  });

  it('rejects duplicate simulation run ids before comparing runs', async () => {
    const db = {
      simulationRun: {
        findMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ courseId: 'simulation', pageId: 'pid-default' }),
      context: createRuntimeContext(),
    });

    await expect(runtime.compareSimulationRuns({
      simulationRunIds: ['run-1', 'run-1'],
    })).rejects.toMatchObject({ status: 400 });
    expect(db.simulationRun.findMany).not.toHaveBeenCalled();
  });

  it('rejects explicit trace ids that do not belong to the simulation run', async () => {
    const runRow = {
      id: 'run-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      pageId: 'pid-default',
      resourceId: 'resource-1',
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      status: 'completed',
      summary: { metrics: { overshoot: 0.28, settlingTime: 6.5 }, lowEvidence: false },
      replayToken: 'preview-replay-token',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-1',
          checksum: 'sha256:trace-1',
          summaryMetrics: { overshoot: 0.28, settlingTime: 6.5 },
          sampleCount: 160,
          sampleCadence: 0.05,
          sampleStorageUri: 's3://traces/run-1.json',
          createdAt: new Date('2026-05-28T00:00:08Z'),
        },
      ],
    };
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(runRow),
      },
      simulationTrace: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ courseId: 'simulation', pageId: 'pid-default' }),
      context: createRuntimeContext(),
    });

    await expect(runtime.analyzeSimulationTrace({
      simulationRunId: 'run-1',
      traceId: 'missing-trace',
    })).rejects.toMatchObject({ status: 404 });
    expect(db.simulationTrace.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'missing-trace',
        runId: 'run-1',
      },
    });
  });

  it('proposes controller patches from top-level Arena preview summary metrics', async () => {
    const runRow = {
      id: 'arena-preview-run-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      pageId: 'pid-default',
      resourceId: 'resource-1',
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      status: 'completed',
      summary: { overshoot: 0.28, settlingTime: 6.5, lowEvidence: false },
      replayToken: 'preview-replay-token',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-1',
          checksum: 'sha256:trace-1',
          summaryMetrics: { overshoot: 0.28, settlingTime: 6.5 },
          sampleCount: 160,
          sampleCadence: 0.05,
          sampleStorageUri: 's3://traces/run-1.json',
          createdAt: new Date('2026-05-28T00:00:08Z'),
        },
      ],
    };
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(runRow),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ courseId: 'simulation', pageId: 'pid-default' }),
      context: createRuntimeContext(),
    });

    const proposal = await runtime.proposeControllerPatch({
      simulationRunId: 'arena-preview-run-1',
      objective: '降低超调并缩短调节时间',
    }) as Record<string, any>;

    expect(proposal).toMatchObject({
      simulationRunId: 'arena-preview-run-1',
      candidatePatch: {
        kp: 0.9,
        ki: 0.05,
      },
      mutatesControllerDraft: false,
    });
  });

  it('creates idempotent virtual simulation runs through AgentToolRun and SimulationRun records', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['run_virtual_simulation'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (!where?.id) return null;
          return {
            id: where.id,
            agentSessionId: 'agent-session-1',
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            toolName: 'run_virtual_simulation',
            permissionTier: 'run',
            approvalState: 'not_required',
            status: 'running',
            inputSummary: { idempotencyKey: 'run-key-1' },
            outputSummary: null,
            errorSummary: null,
            idempotencyKey: 'run-key-1',
            correlationId: 'corr-1',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: null,
            latencyMs: null,
          };
        }),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-sim-1',
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'task-spec-1', ...data })),
      },
      simulationRun: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'run-agent-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
      simulationTrace: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'trace-agent-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:01Z'),
        })),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningEvidenceDraft: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    await expect(runtime.runVirtualSimulation({
      idempotencyKey: 'run-key-1',
      taskSpec: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        disturbancePolicy: { family: 'none' },
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      controllerSnapshotRef: 'controller:pid:draft-1',
      seed: 7,
    })).resolves.toMatchObject({
      simulationRunId: 'run-agent-1',
      traceId: 'trace-agent-1',
      provenance: {
        runKind: 'agent_experiment',
        sourceDomain: 'konling_agent',
        evaluationVisibility: 'preview',
      },
    });
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        toolName: 'run_virtual_simulation',
        ownerUserId: 'student-1',
        idempotencyKey: 'run-key-1',
      }),
    }));
    expect(db.simulationRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ownerUserId: 'student-1',
        classId: 'class-1',
        runKind: 'agent_experiment',
        sourceDomain: 'konling_agent',
        summary: expect.objectContaining({
          agentSessionId: 'agent-session-1',
          agentToolRunId: 'tool-run-sim-1',
        }),
      }),
    }));
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          userId: 'student-1',
          factType: 'simulation',
          sourceEventId: 'simulation-agent-evidence:simulation_run:run-agent-1:1.0',
          sourceLogId: 'SimulationRun:run-agent-1',
          contextJson: expect.objectContaining({
            simulation: expect.objectContaining({
              runId: 'run-agent-1',
              traceReference: 'SimulationTrace:trace-agent-1',
              agentAssisted: true,
              governanceContext: expect.objectContaining({
                classId: 'class-1',
              }),
            }),
          }),
        }),
      ],
    }));
    expect(db.learningEvidenceDraft.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceType: 'simulation_run',
          dedupeKey: 'simulation_run:run-agent-1:1.0',
        }),
      ],
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          causationId: 'SimulationRun:run-agent-1',
          dedupeKey: 'simulation_run:run-agent-1:1.0',
        }),
      ],
    }));
  });

  it('reuses idempotent virtual simulation run output without creating duplicate runs', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['run_virtual_simulation'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tool-run-sim-existing',
          agentSessionId: 'agent-session-1',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          targetUserId: 'student-1',
          toolName: 'run_virtual_simulation',
          permissionTier: 'run',
          approvalState: 'not_required',
          status: 'succeeded',
          inputSummary: { idempotencyKey: 'run-key-1' },
          outputSummary: { simulationRunId: 'run-agent-existing', traceId: 'trace-agent-existing' },
          errorSummary: null,
          idempotencyKey: 'run-key-1',
          correlationId: 'corr-existing',
          startedAt: new Date('2026-05-28T00:00:00Z'),
          completedAt: new Date('2026-05-28T00:00:01Z'),
          latencyMs: 1000,
        }),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      simulationRun: {
        create: vi.fn(),
      },
      simulationTrace: {
        create: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      learningEvidenceDraft: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    await expect(runtime.runVirtualSimulation({
      idempotencyKey: 'run-key-1',
      taskSpec: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        disturbancePolicy: { family: 'none' },
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
    })).resolves.toMatchObject({
      simulationRunId: 'run-agent-existing',
      traceId: 'trace-agent-existing',
    });
    expect(db.simulationRun.create).not.toHaveBeenCalled();
    expect(db.simulationTrace.create).not.toHaveBeenCalled();
  });

  it('reuses idempotent virtual simulation runs across agent sessions by stable owner key', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const existingRun = {
      id: 'run-agent-existing',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      resourceId: 'resource-1',
      sessionId: 'agent-session-previous',
      runKind: 'agent_experiment',
      sourceDomain: 'konling_agent',
      sourceRefId: 'konling:student-1:course:simulation:resource:resource-1:page:pid-default:run_virtual_simulation:run-key-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
        launchContext: {
          courseId: 'simulation',
          classId: 'class-1',
          resourceId: 'resource-1',
          pageId: 'pid-default',
        },
      },
      status: 'completed',
      summary: {
        metrics: { settlingTime: 4.2 },
        lowEvidence: false,
        agentSessionId: 'agent-session-previous',
        agentToolRunId: 'tool-run-previous',
      },
      replayToken: 'konling-replay:existing',
      protocolVersion: '1.0',
      runtimeVersion: 'konling-simulation-tool-v1',
      modelVersion: 'step-response',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-agent-existing',
          checksum: 'sha256:trace-existing',
          summaryMetrics: { settlingTime: 4.2 },
          sampleCount: 120,
          sampleCadence: 0.05,
          createdAt: new Date('2026-05-28T00:00:01Z'),
        },
      ],
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-2',
          ownerUserId: 'student-1',
          permittedTools: ['run_virtual_simulation'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (!where?.id) return null;
          return {
            id: where.id,
            agentSessionId: 'agent-session-2',
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            toolName: 'run_virtual_simulation',
            permissionTier: 'run',
            approvalState: 'not_required',
            status: 'running',
            inputSummary: { idempotencyKey: 'run-key-1' },
            outputSummary: null,
            errorSummary: null,
            idempotencyKey: 'run-key-1',
            correlationId: 'corr-2',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: null,
            latencyMs: null,
          };
        }),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-sim-2',
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({ id: 'task-spec-1' }),
        create: vi.fn(),
      },
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(existingRun),
        create: vi.fn(),
      },
      simulationTrace: {
        create: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      learningEvidenceDraft: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-2',
      context: createRuntimeContext(),
    });

    await expect(runtime.runVirtualSimulation({
      idempotencyKey: 'run-key-1',
      taskSpec: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        disturbancePolicy: { family: 'none' },
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
    })).resolves.toMatchObject({
      simulationRunId: 'run-agent-existing',
      traceId: 'trace-agent-existing',
      status: 'completed',
    });
    expect(db.simulationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sourceDomain: 'konling_agent',
        sourceRefId: 'konling:student-1:course:simulation:resource:resource-1:page:pid-default:run_virtual_simulation:run-key-1',
      }),
    }));
    expect(db.simulationRun.create).not.toHaveBeenCalled();
    expect(db.simulationTrace.create).not.toHaveBeenCalled();
    expect(db.simulationTaskSpec.create).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceEventId: 'simulation-agent-evidence:simulation_run:run-agent-existing:1.0',
        }),
      ],
    }));
    expect(db.learningEvidenceDraft.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceType: 'simulation_run',
          dedupeKey: 'simulation_run:run-agent-existing:1.0',
          sourceRefs: expect.objectContaining({
            agentSessionId: 'agent-session-previous',
            agentToolRunId: 'tool-run-previous',
            simulationRunId: 'run-agent-existing',
          }),
        }),
      ],
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          eventType: 'simulation_agent_evidence.draft_created',
          dedupeKey: 'simulation_run:run-agent-existing:1.0',
          payload: expect.objectContaining({
            source: expect.objectContaining({
              agentSessionId: 'agent-session-previous',
              agentToolRunId: 'tool-run-previous',
              simulationRunId: 'run-agent-existing',
            }),
          }),
        }),
      ],
    }));
  });

  it('retries failed idempotent virtual simulation materialization by reusing the existing run', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const existingRun = {
      id: 'run-agent-existing',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      resourceId: 'resource-1',
      sessionId: 'agent-session-1',
      runKind: 'agent_experiment',
      sourceDomain: 'konling_agent',
      sourceRefId: 'konling:student-1:course:simulation:resource:resource-1:page:pid-default:run_virtual_simulation:run-key-1',
      status: 'completed',
      summary: { metrics: { settlingTime: 4.2 }, lowEvidence: false },
      protocolVersion: '1.0',
      runtimeVersion: 'konling-simulation-tool-v1',
      modelVersion: 'step-response',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-agent-existing',
          checksum: 'sha256:trace-existing',
          summaryMetrics: { settlingTime: 4.2 },
          sampleCount: 120,
          sampleCadence: 0.05,
          createdAt: new Date('2026-05-28T00:00:01Z'),
        },
      ],
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['run_virtual_simulation'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (!where?.id) {
            return {
              id: 'tool-run-failed',
              agentSessionId: 'agent-session-1',
              ownerUserId: 'student-1',
              actorUserId: 'student-1',
              targetUserId: 'student-1',
              toolName: 'run_virtual_simulation',
              permissionTier: 'run',
              approvalState: 'not_required',
              status: 'failed',
              inputSummary: { idempotencyKey: 'run-key-1' },
              outputSummary: null,
              errorSummary: { message: 'materialization failed after run creation' },
              idempotencyKey: 'run-key-1',
              correlationId: 'corr-failed',
              startedAt: new Date('2026-05-28T00:00:00Z'),
              completedAt: new Date('2026-05-28T00:00:01Z'),
              latencyMs: 1000,
            };
          }
          return {
            id: where.id,
            agentSessionId: 'agent-session-1',
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            toolName: 'run_virtual_simulation',
            permissionTier: 'run',
            approvalState: 'not_required',
            status: 'failed',
            inputSummary: { idempotencyKey: 'run-key-1' },
            outputSummary: null,
            errorSummary: { message: 'materialization failed after run creation' },
            idempotencyKey: 'run-key-1',
            correlationId: 'corr-failed',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: new Date('2026-05-28T00:00:01Z'),
            latencyMs: 1000,
          };
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(existingRun),
        create: vi.fn(),
      },
      simulationTrace: {
        create: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningEvidenceDraft: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    await expect(runtime.runVirtualSimulation({
      idempotencyKey: 'run-key-1',
      taskSpec: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        disturbancePolicy: { family: 'none' },
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
    })).resolves.toMatchObject({
      simulationRunId: 'run-agent-existing',
      traceId: 'trace-agent-existing',
    });
    expect(db.simulationRun.create).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'succeeded',
      }),
    }));
  });

  it('requires approval before applying controller patches and applies approved patches to the scoped session draft', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockImplementation(async ({ select }) => {
          if (select?.stateJson) {
            return {
              id: 'agent-session-1',
              stateJson: {
                route: 'ai-chat',
                workflow: { phase: 'drafting-controller' },
              },
            };
          }
          return {
            id: 'agent-session-1',
            ownerUserId: 'student-1',
            permittedTools: ['apply_controller_patch'],
          };
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'tool-run-apply-patch',
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            agentSessionId: 'agent-session-1',
            toolName: 'apply_controller_patch',
            permissionTier: 'write',
            approvalState: 'approved',
            status: 'running',
            inputSummary: {
              simulationRunId: 'run-1',
              patch: { kp: 1.9, ki: 0.04 },
              rationale: '降低超调并保持调节时间',
            },
            outputSummary: null,
            errorSummary: null,
            idempotencyKey: 'patch-key-1',
            correlationId: 'corr-1',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: null,
            latencyMs: null,
          }),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-apply-patch',
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-1',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: 'simulation',
          pageId: 'pid-default',
          resourceId: 'resource-1',
          runKind: 'scene_simulation',
          sourceDomain: 'simulation_scene',
          sourceRefId: 'scene-run-1',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
          },
          status: 'completed',
          summary: { metrics: { settlingTime: 4.2 } },
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    const approval = await runtime.applyControllerPatch({
      idempotencyKey: 'patch-key-1',
      simulationRunId: 'run-1',
      patch: { kp: 1.9, ki: 0.04 },
      rationale: '降低超调并保持调节时间',
    }) as { approvalRequired: boolean; toolRunId: string };

    expect(approval).toMatchObject({
      approvalRequired: true,
      toolRunId: 'tool-run-apply-patch',
      pendingControllerPatch: {
        simulationRunId: 'run-1',
        patch: { kp: 1.9, ki: 0.04 },
      },
    });
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'awaiting_approval',
        pendingApproval: expect.objectContaining({
          toolName: 'apply_controller_patch',
          preview: expect.objectContaining({
            pendingControllerPatch: expect.objectContaining({
              simulationRunId: 'run-1',
            }),
          }),
        }),
      }),
    }));

    await expect(completeKonlingToolRun(db, {
      scope,
      toolRunId: 'tool-run-apply-patch',
      output: { approvedBy: 'student-1' },
      now: new Date('2026-05-28T00:00:01Z'),
    })).resolves.toEqual({ success: true, status: 'succeeded' });

    const draftUpdateOrder = db.agentSession.updateMany.mock.invocationCallOrder[1];
    const toolRunSuccessOrder = db.agentToolRun.updateMany.mock.invocationCallOrder[0];
    expect(draftUpdateOrder).toBeLessThan(toolRunSuccessOrder);
    expect(db.agentSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'agent-session-1',
        ownerUserId: 'student-1',
      }),
      data: expect.objectContaining({
        stateJson: expect.objectContaining({
          route: 'ai-chat',
          workflow: { phase: 'drafting-controller' },
          controllerDraft: expect.objectContaining({
            simulationRunId: 'run-1',
            patch: { kp: 1.9, ki: 0.04 },
            sourceToolRunId: 'tool-run-apply-patch',
          }),
        }),
      }),
    }));
  });

  it('rejects teacher controller patch writes before creating tool-run side effects', async () => {
    const scope = createScope({
      authenticatedUserId: 'teacher-1',
      targetUserId: 'teacher-1',
      role: 'teacher',
      classId: 'class-1',
      privacyScopes: ['student-visible', 'teacher-scoped'],
    });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'teacher-1',
          permittedTools: ['apply_controller_patch'],
        }),
        updateMany: vi.fn(),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      simulationRun: {
        findFirst: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    await expect(runtime.applyControllerPatch({
      idempotencyKey: 'teacher-patch-key',
      simulationRunId: 'student-run-1',
      patch: { kp: 1.5 },
    })).rejects.toMatchObject({ status: 403 });
    expect(db.simulationRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).not.toHaveBeenCalled();
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

  it('audits scoped runtime tool calls and gates intervention feedback behind approval', async () => {
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
      phase: 'draft-plan',
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
        phase: 'draft-plan',
      }),
    }));
    expect(db.konlingSession.findFirst).not.toHaveBeenCalled();
  });

  it('scopes explicit agent session resume by phase', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(getOrCreateKonlingAgentSession(db, {
      scope,
      agentSessionId: 'agent-session-from-other-phase',
      phase: 'konling-chat-tool-runtime',
      status: 'running',
    })).rejects.toMatchObject({ status: 404 });

    expect(db.agentSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'agent-session-from-other-phase',
        ownerUserId: 'student-1',
        phase: 'konling-chat-tool-runtime',
      }),
    }));
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
    expect(schema).toContain('@@unique([agentSessionId, toolName, idempotencyKey])');
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
    expect(KONLING_TOOL_REGISTRY.record_intervention_result).toMatchObject({
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

  it('enforces scope-scoped idempotency before creating another state-changing tool run', async () => {
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
        agentSessionId: 'agent-session-1',
        ownerUserId: 'student-1',
        toolName: 'set_simulation_params',
        idempotencyKey: 'same-key',
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      },
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('reuses a scoped idempotent tool run after concurrent create conflicts', async () => {
    const scope = createScope();
    const existingRun = {
      id: 'tool-run-concurrent',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      classId: 'class-1',
      courseId: 'unit-4-5',
      pageId: 'step-03',
      resourceId: 'resource-1',
      pathNodeId: 'node-1',
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
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingRun),
        create: vi.fn().mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })),
      },
    };

    await expect(startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'set_simulation_params',
      input: { kp: 2.0 },
      idempotencyKey: 'same-key',
      correlationId: 'corr-new',
    })).resolves.toMatchObject({
      id: 'tool-run-concurrent',
      idempotencyKey: 'same-key',
    });
    expect(db.agentToolRun.findFirst).toHaveBeenCalledTimes(2);
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
