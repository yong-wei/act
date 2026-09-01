import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  verifyKonlingRuntimeScope: vi.fn(),
  createGovernedKonlingIntervention: vi.fn(),
  buildKonlingInterventionClientFields: vi.fn(),
  rethrowIfNextDynamicError: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({ prisma: { marker: 'prisma' } }));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: mocks.rethrowIfNextDynamicError,
}));

vi.mock('@/lib/konling-agent-runtime', () => ({
  verifyKonlingRuntimeScope: mocks.verifyKonlingRuntimeScope,
  createGovernedKonlingIntervention: mocks.createGovernedKonlingIntervention,
}));

vi.mock('@/lib/konling-intervention-client-payload', () => ({
  buildKonlingInterventionClientFields: mocks.buildKonlingInterventionClientFields,
}));

import { POST } from '../api/ai/intervention/generate/route';

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/ai/intervention/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

const studentState = {
  currentTask: '控制练习',
  currentAttempt: 2,
  attemptHistory: [],
};

describe('POST /api/ai/intervention/generate Arena context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.verifyKonlingRuntimeScope.mockResolvedValue({
      ok: true,
      scope: {
        targetUserId: 'student-1',
        classId: null,
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      },
    });
    mocks.createGovernedKonlingIntervention.mockResolvedValue({
      id: 'intv-1',
      shouldIntervene: false,
      reason: 'none',
      interventionType: 'none',
    });
    mocks.buildKonlingInterventionClientFields.mockReturnValue({
      interventionId: 'intv-1',
      canSubmitFeedback: false,
      intervention: {},
    });
  });

  it('rejects a method that is not allowed by the registered Arena task before creating a record', async () => {
    const response = await postJson({
      studentState,
      arenaTaskId: 'task-ship-roll-mpc-hidden-scenarios',
      method: 'pid',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: '竞技场受治理陪伴只能由正式评测提交创建',
    });
    expect(mocks.createGovernedKonlingIntervention).not.toHaveBeenCalled();
    expect(mocks.verifyKonlingRuntimeScope).not.toHaveBeenCalled();
  });

  it('rejects client-authored Arena studentState even when the method is registered', async () => {
    const response = await postJson({
      studentState,
      arenaTaskId: 'task-ship-roll-mpc-hidden-scenarios',
      method: 'mpc',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: '竞技场受治理陪伴只能由正式评测提交创建',
    });
    expect(mocks.createGovernedKonlingIntervention).not.toHaveBeenCalled();
    expect(mocks.verifyKonlingRuntimeScope).not.toHaveBeenCalled();
  });

  it('rejects retired companion identities even when arenaTaskId and method are omitted', async () => {
    const response = await postJson({
      studentState,
      courseId: 'simulation-companion',
      pageId: 'arena-companion:task-third-order-block-diagram',
      resourceId: 'arena-companion:task-third-order-block-diagram',
      pathNodeId: 'ai-companion:arena-companion:task-third-order-block-diagram',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: '竞技场受治理陪伴只能由正式评测提交创建',
    });
    expect(mocks.createGovernedKonlingIntervention).not.toHaveBeenCalled();
    expect(mocks.verifyKonlingRuntimeScope).not.toHaveBeenCalled();
  });

  it('still generates interventions outside Arena companion identity', async () => {
    const response = await postJson({
      studentState,
      courseId: 'unit-4-5',
      pageId: 'step-03',
      resourceId: 'resource-1',
      pathNodeId: 'node-1',
    });

    expect(response.status).toBe(200);
    expect(mocks.verifyKonlingRuntimeScope).toHaveBeenCalled();
    expect(mocks.createGovernedKonlingIntervention).toHaveBeenCalled();
  });
});
