import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildKonlingRuntimeContext: vi.fn(),
  buildKonlingRuntimeGraphContext: vi.fn(),
  buildKonlingTeachingAssistantRuntimeContract: vi.fn(),
  buildKonlingToolRuntime: vi.fn(),
  getOrCreateKonlingAgentSession: vi.fn(),
  getServerAuthSession: vi.fn(),
  classFindUnique: vi.fn(),
  learningPathFindFirst: vi.fn(),
  isRegisteredAdaptiveLearningPathGoal: vi.fn(),
  resolveKonlingTeachingAssistantServerModeContext: vi.fn(),
  resolveKonlingTeachingAssistantSignedGraphNodeId: vi.fn(),
  readAdaptivePathCandidateBatch: vi.fn(),
  verifyKonlingRuntimeScope: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    class: {
      findUnique: mocks.classFindUnique,
    },
    learningPath: {
      findFirst: mocks.learningPathFindFirst,
    },
  },
}));

vi.mock('@/lib/adaptive-learning-path-planner', () => ({
  isRegisteredAdaptiveLearningPathGoal: mocks.isRegisteredAdaptiveLearningPathGoal,
}));

vi.mock('@/lib/adaptive-path-candidate-batches', () => ({
  readAdaptivePathCandidateBatch: mocks.readAdaptivePathCandidateBatch,
}));

vi.mock('@/lib/adaptive-path-goal-options', () => ({
  getAdaptivePracticeGoalOption: () => ({ title: '控制校正' }),
}));

vi.mock('@/lib/konling-teaching-assistant-server-context', () => ({
  resolveKonlingTeachingAssistantServerModeContext: mocks.resolveKonlingTeachingAssistantServerModeContext,
  resolveKonlingTeachingAssistantSignedGraphNodeId: mocks.resolveKonlingTeachingAssistantSignedGraphNodeId,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

vi.mock('@/lib/konling-agent-runtime', () => ({
  buildKonlingRuntimeContext: mocks.buildKonlingRuntimeContext,
  buildKonlingRuntimeGraphContext: mocks.buildKonlingRuntimeGraphContext,
  buildKonlingTeachingAssistantRuntimeContract: mocks.buildKonlingTeachingAssistantRuntimeContract,
  buildKonlingToolRuntime: mocks.buildKonlingToolRuntime,
  getOrCreateKonlingAgentSession: mocks.getOrCreateKonlingAgentSession,
  KonlingRuntimeScopeError: class MockKonlingRuntimeScopeError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
  verifyKonlingRuntimeScope: mocks.verifyKonlingRuntimeScope,
}));

import { POST } from '@/app/api/adaptive/path-advisor-tool/route';
import { KonlingRuntimeScopeError } from '@/lib/konling-agent-runtime';

function post(body: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/adaptive/path-advisor-tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goalId: 'control-correction',
      modeContextToken: 'mode-token',
      generationRequestId: 'generation-request-1',
      ...body,
    }),
  }));
}

describe('path advisor tool route readiness', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        role: 'STUDENT',
        profile: { classId: 'class-1' },
      },
    });
    mocks.isRegisteredAdaptiveLearningPathGoal.mockReturnValue(true);
    mocks.classFindUnique.mockResolvedValue({ teacherId: 'teacher-1' });
    mocks.learningPathFindFirst.mockResolvedValue(null);
    mocks.verifyKonlingRuntimeScope.mockResolvedValue({
      ok: true,
      scope: {
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        classId: 'class-1',
        role: 'STUDENT',
      },
    });
    mocks.resolveKonlingTeachingAssistantSignedGraphNodeId.mockReturnValue(null);
    mocks.readAdaptivePathCandidateBatch.mockResolvedValue(null);
    mocks.buildKonlingRuntimeContext.mockResolvedValue({ citationContext: undefined });
    mocks.buildKonlingRuntimeGraphContext.mockReturnValue({});
    mocks.resolveKonlingTeachingAssistantServerModeContext.mockResolvedValue({});
    mocks.buildKonlingTeachingAssistantRuntimeContract.mockReturnValue({
      status: 'available',
      mode: { id: 'path-advisor' },
      permittedTools: ['generateLearningPath'],
    });
    mocks.getOrCreateKonlingAgentSession.mockResolvedValue({ id: 'agent-session-1' });
    mocks.buildKonlingToolRuntime.mockReturnValue({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath: vi.fn().mockResolvedValue({ pathId: 'path-1' }),
      reviseLearningPathOptions: vi.fn(),
    });
  });

  it('returns advisor-forbidden readiness when scope verification fails', async () => {
    mocks.verifyKonlingRuntimeScope.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'scope denied',
    });

    const response = await post({});

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      readiness: {
        status: 'blocked',
        reason: 'advisor-forbidden',
        studentAction: 'request-teacher-binding',
        staffAction: 'review-permission',
      },
    });
  });

  it('blocks generation when the class is missing a teacher binding', async () => {
    mocks.classFindUnique.mockResolvedValueOnce({ teacherId: null });

    const response = await post({});

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      readiness: {
        status: 'blocked',
        reason: 'missing-teacher-binding',
        studentAction: 'request-teacher-binding',
        staffAction: 'bind-class',
      },
    });
    expect(mocks.verifyKonlingRuntimeScope).not.toHaveBeenCalled();
    expect(mocks.buildKonlingToolRuntime).not.toHaveBeenCalled();
  });

  it('returns service-unavailable readiness when the path advisor mode is unavailable', async () => {
    mocks.buildKonlingTeachingAssistantRuntimeContract.mockReturnValueOnce({
      status: 'unavailable',
      unavailableReasons: ['missing-service'],
      clientHintsRejected: [],
      mode: { id: 'path-advisor' },
      permittedTools: [],
    });

    const response = await post({});

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      readiness: {
        status: 'retryable',
        reason: 'service-unavailable',
        studentAction: 'retry',
        staffAction: 'check-service',
      },
    });
  });

  it('returns retryable readiness for unexpected generation failures', async () => {
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath: vi.fn().mockRejectedValue(new Error('upstream failed')),
      reviseLearningPathOptions: vi.fn(),
    });

    const response = await post({});

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      readiness: {
        status: 'retryable',
        reason: 'retryable',
        studentAction: 'retry',
        staffAction: 'check-service',
      },
      generationRequest: {
        id: 'generation-request-1',
        status: 'running',
      },
    });
  });

  it('marks a persisted runtime conflict as a definitive generation failure', async () => {
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath: vi.fn().mockRejectedValue(
        new KonlingRuntimeScopeError(409, '幂等 Konling 工具请求此前已失败，不能重复执行。'),
      ),
      reviseLearningPathOptions: vi.fn(),
    });

    const response = await post({});

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      generationRequest: {
        id: 'generation-request-1',
        status: 'failed',
      },
    });
  });

  it('returns ready readiness after successful path generation', async () => {
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath: vi.fn().mockResolvedValue({
        pathId: 'path-1',
        generationStatus: 'persisted',
        candidateBatch: {
          id: 'batch-1',
          generationRequestId: 'path-generation-request:generation-request-1',
          candidateIds: ['candidate-1'],
        },
      }),
      reviseLearningPathOptions: vi.fn(),
    });
    const response = await post({});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      agentSessionId: 'agent-session-1',
      operation: 'generate',
      readiness: {
        status: 'ready',
        reason: 'ready',
        studentAction: 'continue-practice',
        staffAction: 'none',
      },
      result: {
        pathId: 'path-1',
        candidateBatch: {
          id: 'batch-1',
          candidateIds: ['candidate-1'],
        },
      },
      generationRequest: {
        id: 'generation-request-1',
        status: 'succeeded',
      },
    });
  });

  it('rejects an invalid generation request id', async () => {
    const response = await post({ generationRequestId: '../request' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: '学习路径生成请求 ID 无效',
    });
  });

  it('uses the generation request id as the stable runtime idempotency key', async () => {
    const generateLearningPath = vi.fn().mockResolvedValue({
      pathId: 'path-1',
      generationStatus: 'running',
    });
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath,
      reviseLearningPathOptions: vi.fn(),
    });

    const response = await post({
      generationRequestId: 'stable-request-1',
      idempotencyKey: 'client-value-must-not-win',
    });

    expect(response.status).toBe(200);
    expect(generateLearningPath).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'path-generation-request:stable-request-1',
    }));
    await expect(response.json()).resolves.toMatchObject({
      generationRequest: {
        id: 'stable-request-1',
        status: 'running',
      },
    });
  });

  it('keeps a reused running tool request active', async () => {
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath: vi.fn().mockResolvedValue({
        toolRunReused: true,
        status: 'running',
      }),
      reviseLearningPathOptions: vi.fn(),
    });

    const response = await post({ generationRequestId: 'stable-request-1' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      generationRequest: {
        id: 'stable-request-1',
        status: 'running',
      },
    });
  });

  it('keeps an awaiting-approval tool request active without candidate identity', async () => {
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath: vi.fn().mockResolvedValue({
        status: 'awaiting_approval',
        candidateBatch: null,
      }),
      reviseLearningPathOptions: vi.fn(),
    });

    const response = await post({ generationRequestId: 'stable-request-1' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: { candidateBatch: null },
      generationRequest: { id: 'stable-request-1', status: 'running' },
    });
  });

  it('resolves selected fallback pathOptions before path advisor explain calls', async () => {
    const explainLearningPathTradeoff = vi.fn().mockResolvedValue({ explanation: 'ok' });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        pathOptions: [{
          optionId: 'path-option-1',
          styleId: 'recommended',
          nodeIds: ['node-1'],
        }],
        executionStatus: {
          completedNodeIds: [],
        },
      },
      lastExecutionMetadata: {},
    });
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff,
      generateLearningPath: vi.fn(),
      reviseLearningPathOptions: vi.fn(),
    });

    const response = await post({
      operation: 'explain',
      pathId: 'path-1',
      selectedOptionId: 'path-option-1',
    });

    expect(response.status).toBe(200);
    expect(explainLearningPathTradeoff).toHaveBeenCalledWith(expect.objectContaining({
      pathId: 'path-1',
      selectedStyleId: 'recommended',
      styleId: 'recommended',
    }));
  });

  it('rejects a candidate comparison outside the authorized batch', async () => {
    mocks.readAdaptivePathCandidateBatch.mockResolvedValueOnce({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      sourcePathId: 'path-1',
      candidates: [{ styleId: 'style-a' }],
    });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        pathOptions: [
          { optionId: 'path-option-a', styleId: 'style-a', nodeIds: ['node-1'] },
          { optionId: 'path-option-b', styleId: 'style-b', nodeIds: ['node-1'] },
        ],
      },
      lastExecutionMetadata: {},
    });

    const response = await post({
      operation: 'explain',
      pathId: 'path-1',
      selectedOptionId: 'path-option-a',
      compareWithOptionId: 'path-option-b',
      candidateBatchId: 'batch-1',
      comparisonKey: 'batch-1|version-1|path-option-a:path-option-b',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: '候选比较对象不属于当前学习路径批次',
    });
  });

  it('forwards an authorized candidate pair and comparison identity to the runtime', async () => {
    const explainLearningPathTradeoff = vi.fn().mockResolvedValue({
      comparison: { status: 'no-material-difference' },
    });
    mocks.readAdaptivePathCandidateBatch.mockResolvedValueOnce({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      sourcePathId: 'path-1',
      candidates: [{ styleId: 'style-a' }, { styleId: 'style-b' }],
    });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: {
        pathOptions: [
          { optionId: 'path-option-a', styleId: 'style-a', nodeIds: ['node-1'] },
          { optionId: 'path-option-b', styleId: 'style-b', nodeIds: ['node-1'] },
        ],
      },
      lastExecutionMetadata: {},
    });
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff,
      generateLearningPath: vi.fn(),
      reviseLearningPathOptions: vi.fn(),
    });

    const response = await post({
      operation: 'explain',
      pathId: 'path-1',
      selectedOptionId: 'path-option-a',
      compareWithOptionId: 'path-option-b',
      candidateBatchId: 'batch-1',
      comparisonKey: 'batch-1|version-1|path-option-a:path-option-b',
    });

    expect(response.status).toBe(200);
    expect(explainLearningPathTradeoff).toHaveBeenCalledWith(expect.objectContaining({
      pathId: 'path-1',
      selectedStyleId: 'style-a',
      compareWithStyleId: 'style-b',
      candidateBatchId: 'batch-1',
      comparisonKey: 'batch-1|version-1|path-option-a:path-option-b',
    }));
  });

  it('allows empty-node path options to reach the runtime insufficient-data result', async () => {
    const explainLearningPathTradeoff = vi.fn().mockResolvedValue({
      comparison: { status: 'insufficient-data' },
    });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      currentNodeId: null,
      nodeIds: [],
      pathPayload: {
        pathOptions: [{
          optionId: 'path-option-1',
          styleId: 'recommended',
          nodeIds: [],
        }],
        executionStatus: {
          completedNodeIds: [],
        },
      },
      lastExecutionMetadata: {},
    });
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff,
      generateLearningPath: vi.fn(),
      reviseLearningPathOptions: vi.fn(),
    });

    const response = await post({
      operation: 'explain',
      pathId: 'path-1',
      selectedOptionId: 'path-option-1',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        comparison: { status: 'insufficient-data' },
      },
    });
    expect(explainLearningPathTradeoff).toHaveBeenCalledWith(expect.objectContaining({
      pathId: 'path-1',
      selectedStyleId: 'recommended',
      styleId: 'recommended',
    }));
  });
});
