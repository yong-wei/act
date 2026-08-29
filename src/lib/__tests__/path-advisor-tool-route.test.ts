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
  readAdaptivePathCandidateBatch: vi.fn(),
  isRegisteredAdaptiveLearningPathGoal: vi.fn(),
  resolveKonlingTeachingAssistantServerModeContext: vi.fn(),
  resolveKonlingTeachingAssistantSignedGraphNodeId: vi.fn(),
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

vi.mock('@/features/personalization/path-planning/public-api', () => ({
  isRegisteredAdaptiveLearningPathGoal: mocks.isRegisteredAdaptiveLearningPathGoal,
}));

vi.mock('@/lib/adaptive-path-candidate-batches', () => ({
  readAdaptivePathCandidateBatch: mocks.readAdaptivePathCandidateBatch,
}));

vi.mock('@/lib/adaptive-path-goal-options', () => ({
  getAdaptivePracticeGoalOption: () => ({ title: '控制校正' }),
}));

vi.mock('@/lib/adaptive-path-candidate-batches', () => ({
  readAdaptivePathCandidateBatch: mocks.readAdaptivePathCandidateBatch,
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
    mocks.readAdaptivePathCandidateBatch.mockResolvedValue(null);
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

  it('binds path adjustment to an authorized persisted candidate and progress version', async () => {
    const activeProgressVersion = '2026-08-18T02:00:00.000Z';
    const sourceCandidateFingerprint = 'a'.repeat(64);
    mocks.readAdaptivePathCandidateBatch.mockResolvedValue({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      classId: 'class-1',
      generationRequestId: 'source-request-1',
      sourcePathId: 'source-path-1',
      plannerVersion: 'stage-1-rules-graph',
      status: 'succeeded',
      createdAt: '2026-08-17T00:00:00.000Z',
      metadata: {},
      candidates: [{
        id: 'candidate-1',
        fingerprint: sourceCandidateFingerprint,
        ordinal: 0,
        styleId: 'simulation-driven',
        policyFamily: 'simulation-driven',
        label: '仿真路径',
        snapshot: { optionId: 'path-option-1', nodeIds: ['node-1'] },
      }],
    });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: { executionStatus: { completedNodeIds: [] } },
      lastExecutionMetadata: {},
      updatedAt: new Date(activeProgressVersion),
    });
    const reviseLearningPathOptions = vi.fn().mockResolvedValue({
      generationStatus: 'persisted',
      candidateBatch: { id: 'derived-batch-1' },
    });
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath: vi.fn(),
      reviseLearningPathOptions,
    });

    const response = await post({
      operation: 'revise',
      pathId: 'path-1',
      sourceBatchId: 'batch-1',
      sourceCandidateId: 'candidate-1',
      sourceCandidateFingerprint,
      activeProgressVersion,
      idempotencyKey: 'path-adjustment-request:adjustment-1',
      selectedOptionId: 'path-option-client-order-must-not-authorize',
    });

    expect(response.status).toBe(200);
    expect(reviseLearningPathOptions).toHaveBeenCalledWith(expect.objectContaining({
      sourceBatchId: 'batch-1',
      sourceCandidateId: 'candidate-1',
      sourceCandidateFingerprint,
      activeProgressVersion,
      selectedStyleId: 'simulation-driven',
      preferredStyleId: 'simulation-driven',
    }));
  });

  it('keeps stale adjustment conflicts retryable without replacing readiness with a permission block', async () => {
    const activeProgressVersion = '2026-08-18T02:00:00.000Z';
    const sourceCandidateFingerprint = 'a'.repeat(64);
    mocks.readAdaptivePathCandidateBatch.mockResolvedValue({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      classId: 'class-1',
      generationRequestId: 'source-request-1',
      sourcePathId: 'source-path-1',
      plannerVersion: 'stage-1-rules-graph',
      status: 'succeeded',
      createdAt: '2026-08-17T00:00:00.000Z',
      metadata: {},
      candidates: [{
        id: 'candidate-1',
        fingerprint: sourceCandidateFingerprint,
        ordinal: 0,
        styleId: 'simulation-driven',
        policyFamily: 'simulation-driven',
        label: '仿真路径',
        snapshot: { optionId: 'path-option-1', nodeIds: ['node-1'] },
      }],
    });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      currentNodeId: 'node-1',
      nodeIds: ['node-1'],
      pathPayload: { executionStatus: { completedNodeIds: [] } },
      lastExecutionMetadata: {},
      updatedAt: new Date(activeProgressVersion),
    });
    mocks.buildKonlingToolRuntime.mockReturnValueOnce({
      explainLearningPathTradeoff: vi.fn(),
      generateLearningPath: vi.fn(),
      reviseLearningPathOptions: vi.fn().mockRejectedValue(
        new KonlingRuntimeScopeError(409, '学习路径进度已更新，请基于最新进度重新调整。'),
      ),
    });

    const response = await post({
      operation: 'revise',
      pathId: 'path-1',
      sourceBatchId: 'batch-1',
      sourceCandidateId: 'candidate-1',
      sourceCandidateFingerprint,
      activeProgressVersion,
      idempotencyKey: 'path-adjustment-request:stale-adjustment',
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      error: '学习路径进度已更新，请基于最新进度重新调整。',
    });
    expect(payload).not.toHaveProperty('readiness');
  });

  it('rejects path adjustment without a stable candidate source', async () => {
    const response = await post({
      operation: 'revise',
      pathId: 'path-1',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: '候选路径调整缺少稳定的来源或进度版本。',
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
      createdAt: '2026-08-16T10:00:01.000Z',
      candidates: [
        { styleId: 'style-a', snapshot: { optionId: 'path-option-a' } },
        { styleId: 'style-b', snapshot: { optionId: 'path-option-b' } },
      ],
    });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      updatedAt: new Date('2026-08-16T10:00:00.000Z'),
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
      comparisonKey: 'batch-1|2026-08-16T10:00:00.000Z|path-option-a:path-option-b',
    });

    expect(response.status).toBe(200);
    expect(explainLearningPathTradeoff).toHaveBeenCalledWith(expect.objectContaining({
      pathId: 'path-1',
      selectedStyleId: 'style-a',
      compareWithStyleId: 'style-b',
      candidateBatchId: 'batch-1',
      comparisonKey: 'batch-1|2026-08-16T10:00:00.000Z|path-option-a:path-option-b',
    }));
  });

  it('rejects a candidate comparison after the saved path version changes', async () => {
    mocks.readAdaptivePathCandidateBatch.mockResolvedValueOnce({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      sourcePathId: 'path-1',
      createdAt: '2026-08-16T10:00:01.000Z',
      candidates: [
        { styleId: 'style-a', snapshot: { optionId: 'path-option-a' } },
        { styleId: 'style-b', snapshot: { optionId: 'path-option-b' } },
      ],
    });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      updatedAt: new Date('2026-08-16T10:00:02.000Z'),
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
      comparisonKey: 'batch-1|2026-08-16T10:00:02.000Z|path-option-a:path-option-b',
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: '当前学习路径已更新，请重新生成候选方案后再比较',
    });
  });

  it('rejects a forged candidate comparison key', async () => {
    mocks.readAdaptivePathCandidateBatch.mockResolvedValueOnce({
      id: 'batch-1',
      userId: 'student-1',
      goalId: 'control-correction',
      sourcePathId: 'path-1',
      createdAt: '2026-08-16T10:00:01.000Z',
      candidates: [
        { styleId: 'style-a', snapshot: { optionId: 'path-option-a' } },
        { styleId: 'style-b', snapshot: { optionId: 'path-option-b' } },
      ],
    });
    mocks.learningPathFindFirst.mockResolvedValue({
      id: 'path-1',
      updatedAt: new Date('2026-08-16T10:00:00.000Z'),
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
      comparisonKey: 'forged-key',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: '候选比较身份已失效，请重新选择比较对象',
    });
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
