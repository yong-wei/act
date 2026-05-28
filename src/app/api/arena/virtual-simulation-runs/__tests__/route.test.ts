import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  getArenaPlantAdapterForVirtualPreviewTaskId: vi.fn(),
  runVirtualPreview: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/arena/blackbox/experiment-service', () => ({
  prismaArenaBlackBoxExperimentStore: { marker: 'blackbox-store' },
}));

vi.mock('@/features/arena/blackbox/controller-preview', () => ({
  prismaArenaVirtualSimulationRunStore: { marker: 'preview-store' },
  ArenaVirtualSimulationRunInputError: class ArenaVirtualSimulationRunInputError extends Error {},
}));

vi.mock('@/features/arena/adapters/registry', () => ({
  getArenaPlantAdapterForVirtualPreviewTaskId: mocks.getArenaPlantAdapterForVirtualPreviewTaskId,
  ArenaPlantAdapterSelectionError: class ArenaPlantAdapterSelectionError extends Error {},
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
    mocks.getArenaPlantAdapterForVirtualPreviewTaskId.mockReturnValue({
      id: 'cruise-roll-blackbox-production',
      runVirtualPreview: mocks.runVirtualPreview,
    });
    mocks.runVirtualPreview.mockResolvedValue({
      id: 'preview-row-1',
      simulationRunId: 'canonical-run-preview-1',
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
      metadata: {
        evaluationVisibility: 'preview',
        officialEligible: false,
        modelRelation: 'identified-model-controller',
        datasetHash: artifact.params.experimentDatasetHash,
        controllerHash: 'controller-hash',
        identificationModelId: artifact.params.identificationModelId,
        sourceExperimentId: 'experiment-preview-row',
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
    expect(mocks.runVirtualPreview).not.toHaveBeenCalled();
  });

  it('creates a preview run through the production registry adapter for the session student', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    const response = await postJson({
      taskId: artifact.taskId,
      artifact,
      userId: 'forged-user',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preview.id).toBe('preview-row-1');
    expect(payload.preview.simulationRunId).toBe('canonical-run-preview-1');
    expect(payload.preview.metadata).toEqual(expect.objectContaining({
      evaluationVisibility: 'preview',
      officialEligible: false,
      modelRelation: 'identified-model-controller',
    }));
    expect(mocks.getArenaPlantAdapterForVirtualPreviewTaskId).toHaveBeenCalledWith(artifact.taskId);
    expect(mocks.runVirtualPreview).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      taskId: artifact.taskId,
      artifact,
      blackBoxExperimentStore: { marker: 'blackbox-store' },
      identificationModelStore: { marker: 'blackbox-store' },
      runStore: { marker: 'preview-store' },
    }));
  });

  it('maps invalid preview requests to 400', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const { ArenaVirtualSimulationRunInputError } = await import('@/features/arena/blackbox/controller-preview');
    mocks.runVirtualPreview.mockRejectedValueOnce(new ArenaVirtualSimulationRunInputError('Black-box experiment dataset does not belong to the current student.'));

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('does not belong');
  });

  it('reports pending Arena model registry migrations as a specific Chinese error', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const migrationError = Object.assign(
      new Error('The column `ArenaIdentificationModel.validationSummary` does not exist in the current database.'),
      { code: 'P2022', meta: { modelName: 'ArenaIdentificationModel', column: 'ArenaIdentificationModel.validationSummary' } },
    );
    mocks.runVirtualPreview.mockRejectedValueOnce(migrationError);

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe('竞技场评测数据表尚未完成迁移，请先完成数据库迁移后重试。');
  });

  it('reports pending Arena table migrations from Prisma P2021 table metadata', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const migrationError = Object.assign(
      new Error('The table `ArenaIdentificationModel` does not exist in the current database.'),
      { code: 'P2021', meta: { table: '`ArenaIdentificationModel`' } },
    );
    mocks.runVirtualPreview.mockRejectedValueOnce(migrationError);

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe('竞技场评测数据表尚未完成迁移，请先完成数据库迁移后重试。');
  });

  it('maps unsupported adapter selection to 400 without storing a preview run', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const { ArenaPlantAdapterSelectionError } = await import('@/features/arena/adapters/registry');
    mocks.getArenaPlantAdapterForVirtualPreviewTaskId.mockImplementationOnce(() => {
      throw new ArenaPlantAdapterSelectionError('No production Arena plant adapter supports task missing-task.');
    });

    const response = await postJson({ taskId: 'missing-task', artifact });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('No production Arena plant adapter');
    expect(mocks.runVirtualPreview).not.toHaveBeenCalled();
  });
});
