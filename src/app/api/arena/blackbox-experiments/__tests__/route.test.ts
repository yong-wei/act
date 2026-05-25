import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  getArenaPlantAdapterForPublicExperimentTaskId: vi.fn(),
  runPublicExperiment: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/arena/blackbox/experiment-service', () => ({
  prismaArenaBlackBoxExperimentStore: { marker: 'blackbox-store' },
  ArenaBlackBoxExperimentInputError: class ArenaBlackBoxExperimentInputError extends Error {},
}));

vi.mock('@/features/arena/adapters/registry', () => ({
  getArenaPlantAdapterForPublicExperimentTaskId: mocks.getArenaPlantAdapterForPublicExperimentTaskId,
  ArenaPlantAdapterSelectionError: class ArenaPlantAdapterSelectionError extends Error {},
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
    mocks.getArenaPlantAdapterForPublicExperimentTaskId.mockReturnValue({
      id: 'cruise-roll-blackbox-production',
      runPublicExperiment: mocks.runPublicExperiment,
    });
    mocks.runPublicExperiment.mockResolvedValue({
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
        registeredModel: {
          id: 'registered-identification-model-route',
          userId: 'student-1',
          taskId: 'task-cruise-roll-blackbox-identification',
          datasetHash: 'arena-blackbox-dataset-route',
          sourceExperimentId: 'experiment-row-1',
          modelType: 'second-order-fit',
          validationSummary: {
            validationFit: 0.7,
            dataQuality: 0.7,
            sampleCount: 1,
            signalType: 'step',
          },
          protocolVersion: 'arena-identification-model-v1',
          createdAt: '2026-05-11T10:20:00.000Z',
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
    expect(mocks.runPublicExperiment).not.toHaveBeenCalled();
  });

  it('creates a student-owned black-box experiment dataset through the production registry adapter', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    const response = await postJson({
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
      userId: 'forged-user',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.dataset.datasetHash).toBe('arena-blackbox-dataset-route');
    expect(payload.dataset.registeredModel.id).toBe('registered-identification-model-route');
    expect(payload.budget.remaining).toBe(19);
    expect(mocks.getArenaPlantAdapterForPublicExperimentTaskId).toHaveBeenCalledWith('task-cruise-roll-blackbox-identification');
    expect(mocks.runPublicExperiment).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
      userId: 'student-1',
      store: { marker: 'blackbox-store' },
      identificationModelStore: { marker: 'blackbox-store' },
    }));
  });

  it('maps invalid black-box experiment requests to 400', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const { ArenaBlackBoxExperimentInputError } = await import('@/features/arena/blackbox/experiment-service');
    mocks.runPublicExperiment.mockRejectedValueOnce(new ArenaBlackBoxExperimentInputError('Daily black-box experiment budget exceeded.'));

    const response = await postJson({
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('budget exceeded');
  });

  it('maps unsupported adapter selection to 400 without falling back to mock data', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const { ArenaPlantAdapterSelectionError } = await import('@/features/arena/adapters/registry');
    mocks.getArenaPlantAdapterForPublicExperimentTaskId.mockImplementationOnce(() => {
      throw new ArenaPlantAdapterSelectionError('No production Arena plant adapter supports task missing-task.');
    });

    const response = await postJson({
      taskId: 'missing-task',
      experimentInput,
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('No production Arena plant adapter');
    expect(mocks.runPublicExperiment).not.toHaveBeenCalled();
  });
});
