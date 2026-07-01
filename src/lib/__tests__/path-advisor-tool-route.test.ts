import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildKonlingRuntimeContext: vi.fn(),
  buildKonlingRuntimeGraphContext: vi.fn(),
  buildKonlingTeachingAssistantRuntimeContract: vi.fn(),
  buildKonlingToolRuntime: vi.fn(),
  getOrCreateKonlingAgentSession: vi.fn(),
  getServerAuthSession: vi.fn(),
  isRegisteredAdaptiveLearningPathGoal: vi.fn(),
  resolveKonlingTeachingAssistantServerModeContext: vi.fn(),
  resolveKonlingTeachingAssistantSignedGraphNodeId: vi.fn(),
  verifyKonlingRuntimeScope: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/adaptive-learning-path-planner', () => ({
  isRegisteredAdaptiveLearningPathGoal: mocks.isRegisteredAdaptiveLearningPathGoal,
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

function post(body: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/adaptive/path-advisor-tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goalId: 'control-correction',
      modeContextToken: 'mode-token',
      ...body,
    }),
  }));
}

describe('path advisor tool route readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        role: 'STUDENT',
        profile: { classId: 'class-1' },
      },
    });
    mocks.isRegisteredAdaptiveLearningPathGoal.mockReturnValue(true);
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
    });
  });

  it('returns ready readiness after successful path generation', async () => {
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
      result: { pathId: 'path-1' },
    });
  });
});
