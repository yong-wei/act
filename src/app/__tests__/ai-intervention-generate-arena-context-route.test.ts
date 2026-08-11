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
    expect(mocks.createGovernedKonlingIntervention).not.toHaveBeenCalled();
  });

  it('re-resolves registered Arena context on the server before generating guidance', async () => {
    const response = await postJson({
      studentState,
      arenaTaskId: 'task-ship-roll-mpc-hidden-scenarios',
      method: 'mpc',
    });

    expect(response.status).toBe(200);
    expect(mocks.createGovernedKonlingIntervention).toHaveBeenCalledWith(
      { marker: 'prisma' },
      expect.objectContaining({
        arenaContext: expect.objectContaining({
          taskId: 'task-ship-roll-mpc-hidden-scenarios',
          method: 'mpc',
          metrics: expect.arrayContaining([
            expect.objectContaining({ id: 'hiddenScenarioWorst', unacceptableValue: 2.4 }),
          ]),
        }),
      }),
    );
  });
});
