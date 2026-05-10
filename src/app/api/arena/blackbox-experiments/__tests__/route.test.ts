import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  createArenaBlackBoxExperiment: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/arena/blackbox/experiment-service', () => ({
  createArenaBlackBoxExperiment: mocks.createArenaBlackBoxExperiment,
  prismaArenaBlackBoxExperimentStore: { marker: 'blackbox-store' },
  ArenaBlackBoxExperimentInputError: class ArenaBlackBoxExperimentInputError extends Error {},
}));

import { POST } from '../route';

const experimentInput = {
  signalType: 'step',
  amplitude: 0.8,
  duration: 8,
  sampleTime: 0.2,
  initialRoll: 0.05,
  disturbanceLevel: 0.3,
};

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/arena/blackbox-experiments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/arena/blackbox-experiments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createArenaBlackBoxExperiment.mockResolvedValue({
      dataset: {
        id: 'experiment-row-1',
        taskId: 'task-cruise-roll-blackbox-identification',
        objectId: 'plant-cruise-roll-blackbox',
        datasetHash: 'arena-blackbox-dataset-route',
        scenarioId: 'cruise-roll-public-identification',
        signalType: 'step',
        sampleTime: 0.2,
        duration: 8,
        budgetCost: 1,
        samples: [{ t: 0, input: 0, output: 0.05 }],
        summary: {
          peakOutput: 0.05,
          finalOutput: 0.05,
          meanAbsOutput: 0.05,
          inputEnergy: 1,
          dataQuality: 0.7,
        },
        createdAt: '2026-05-11T10:20:00.000Z',
      },
      budget: { limit: 20, used: 1, remaining: 19 },
    });
  });

  it('requires an authenticated user', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await postJson({
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
    });

    expect(response.status).toBe(401);
  });

  it('rejects non-student experiment runs before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await postJson({
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
    });

    expect(response.status).toBe(403);
    expect(mocks.createArenaBlackBoxExperiment).not.toHaveBeenCalled();
  });

  it('creates a student-owned black-box experiment dataset through the service', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    const response = await postJson({
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
      userId: 'forged-user',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.dataset.datasetHash).toBe('arena-blackbox-dataset-route');
    expect(payload.budget.remaining).toBe(19);
    expect(mocks.createArenaBlackBoxExperiment).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
      userId: 'student-1',
      store: { marker: 'blackbox-store' },
    }));
  });

  it('maps invalid black-box experiment requests to 400', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const { ArenaBlackBoxExperimentInputError } = await import('@/features/arena/blackbox/experiment-service');
    mocks.createArenaBlackBoxExperiment.mockRejectedValueOnce(new ArenaBlackBoxExperimentInputError('Daily black-box experiment budget exceeded.'));

    const response = await postJson({
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('budget exceeded');
  });
});
