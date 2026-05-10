import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  createArenaVirtualSimulationPreviewRun: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/arena/blackbox/experiment-service', () => ({
  prismaArenaBlackBoxExperimentStore: { marker: 'blackbox-store' },
}));

vi.mock('@/features/arena/blackbox/controller-preview', () => ({
  createArenaVirtualSimulationPreviewRun: mocks.createArenaVirtualSimulationPreviewRun,
  prismaArenaVirtualSimulationRunStore: { marker: 'preview-store' },
  ArenaVirtualSimulationRunInputError: class ArenaVirtualSimulationRunInputError extends Error {},
}));

import { POST } from '../route';
import type { ControllerArtifact } from '@/features/arena/types';

const artifact: ControllerArtifact = {
  id: 'artifact-preview',
  taskId: 'task-cruise-roll-blackbox-identification',
  method: 'black-box-control',
  params: {
    representation: 'identified-model-controller',
    experimentDatasetHash: 'arena-blackbox-dataset-preview123456',
    identificationModelId: 'arena-identification-preview12345',
    identificationQuality: 0.82,
    experimentCount: 6,
    controllerGain: 1.6,
    dampingCompensation: 0.72,
    energyBudget: 12,
  },
  createdAt: '2026-05-11T11:30:00.000Z',
};

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/arena/virtual-simulation-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/arena/virtual-simulation-runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createArenaVirtualSimulationPreviewRun.mockResolvedValue({
      id: 'preview-row-1',
      taskId: artifact.taskId,
      datasetHash: artifact.params.experimentDatasetHash,
      controllerHash: 'controller-hash',
      scenarioId: 'cruise-roll-controller-preview',
      trace: [{ t: 0, reference: 0, output: 0.1, control: -0.2 }],
      summary: {
        trackingError: 0.1,
        maxDeviation: 0.1,
        controlEnergy: 0.2,
        safetyViolations: 0,
        smoothness: 0.9,
      },
      createdAt: '2026-05-11T11:31:00.000Z',
    });
  });

  it('requires an authenticated user', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await postJson({ taskId: artifact.taskId, artifact });

    expect(response.status).toBe(401);
  });

  it('rejects non-student preview runs before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await postJson({ taskId: artifact.taskId, artifact });

    expect(response.status).toBe(403);
    expect(mocks.createArenaVirtualSimulationPreviewRun).not.toHaveBeenCalled();
  });

  it('creates a preview run for the session student and does not trust request user identity', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    const response = await postJson({
      taskId: artifact.taskId,
      artifact,
      userId: 'forged-user',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preview.id).toBe('preview-row-1');
    expect(mocks.createArenaVirtualSimulationPreviewRun).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      taskId: artifact.taskId,
      artifact,
      blackBoxExperimentStore: { marker: 'blackbox-store' },
      runStore: { marker: 'preview-store' },
    }));
  });

  it('maps invalid preview requests to 400', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const { ArenaVirtualSimulationRunInputError } = await import('@/features/arena/blackbox/controller-preview');
    mocks.createArenaVirtualSimulationPreviewRun.mockRejectedValueOnce(new ArenaVirtualSimulationRunInputError('Black-box experiment dataset does not belong to the current student.'));

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('does not belong');
  });
});
