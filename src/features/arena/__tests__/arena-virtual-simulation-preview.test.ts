import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildArenaVirtualSimulationPreview,
  createArenaVirtualSimulationPreviewRun,
} from '../blackbox/controller-preview';
import { buildBlackBoxControlArtifactFromParams } from '../submissions/blackbox-artifact-builder';
import type { StoredArenaBlackBoxExperiment } from '../blackbox/experiment-service';

const datasetHash = 'arena-blackbox-dataset-preview123456';
const artifact = buildBlackBoxControlArtifactFromParams({
  taskId: 'task-cruise-roll-blackbox-identification',
  values: {
    identificationQuality: '0.82',
    experimentCount: '6',
    controllerGain: '1.6',
    dampingCompensation: '0.72',
    energyBudget: '12',
  },
  experimentDatasetHash: datasetHash,
  identificationModelId: 'arena-identification-preview12345',
  now: '2026-05-11T11:30:00.000Z',
});
const registeredArtifact = buildBlackBoxControlArtifactFromParams({
  taskId: 'task-cruise-roll-blackbox-identification',
  values: {
    identificationQuality: '0.82',
    experimentCount: '6',
    controllerGain: '1.6',
    dampingCompensation: '0.72',
    energyBudget: '12',
  },
  experimentDatasetHash: datasetHash,
  identificationModelId: 'registered-identification-model-preview',
  now: '2026-05-11T11:30:00.000Z',
});

const experiment: StoredArenaBlackBoxExperiment = {
  id: 'experiment-preview-row',
  userId: 'student-preview',
  taskId: 'task-cruise-roll-blackbox-identification',
  datasetHash,
  signalType: 'step',
  dataset: {
    taskId: 'task-cruise-roll-blackbox-identification',
    objectId: 'plant-cruise-roll-blackbox',
    datasetHash,
    scenarioId: 'cruise-roll-public-identification',
    signalType: 'step',
    sampleTime: 0.2,
    duration: 8,
    budgetCost: 1,
    samples: [{ t: 0, input: 0, output: 0.2 }],
    summary: {
      peakOutput: 0.4,
      finalOutput: 0.2,
      meanAbsOutput: 0.18,
      inputEnergy: 1.2,
      dataQuality: 0.82,
    },
    createdAt: '2026-05-11T11:20:00.000Z',
  },
  budgetCost: 1,
  createdAt: '2026-05-11T11:20:00.000Z',
};

describe('arena virtual simulation controller preview', () => {
  it('builds a closed-loop preview trace without creating leaderboard data', () => {
    const preview = buildArenaVirtualSimulationPreview({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact,
      experiment,
      now: '2026-05-11T11:31:00.000Z',
    });

    expect(preview.datasetHash).toBe(datasetHash);
    expect(preview.controllerHash).toMatch(/^artifact-[a-f0-9]{64}$/);
    expect(preview.trace.length).toBeGreaterThan(20);
    expect(preview.summary.trackingError).toBeGreaterThanOrEqual(0);
    expect(preview.summary.controlEnergy).toBeGreaterThan(0);
    expect(preview.replay).toEqual(expect.objectContaining({
      sceneId: 'arena/task-cruise-roll-blackbox-identification/virtual-preview',
      scenarioId: 'cruise-roll-controller-preview',
      seed: expect.any(Number),
      checksum: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(preview)).not.toContain('ArenaSubmission');
  });

  it('requires the preview artifact to reference the current student owned experiment dataset', async () => {
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn().mockResolvedValue(experiment),
      createExperimentWithinBudget: vi.fn(),
    };
    const identificationModelStore = {
      findOwnedIdentificationModel: vi.fn().mockResolvedValue({
        id: 'registered-identification-model-preview',
        userId: 'student-preview',
        taskId: 'task-cruise-roll-blackbox-identification',
        datasetHash,
        sourceExperimentId: 'experiment-preview-row',
        modelType: 'second-order-fit',
        validationSummary: {
          validationFit: 0.82,
          dataQuality: 0.82,
          sampleCount: 1,
          signalType: 'step',
        },
        protocolVersion: 'arena-identification-model-v1',
        createdAt: '2026-05-11T11:22:00.000Z',
      }),
      createOrResolveIdentificationModel: vi.fn(),
    };
    const runStore = {
      createRun: vi.fn(async (input) => ({ ...input, id: 'preview-row-1', simulationRunId: 'canonical-run-preview-1' })),
    };

    const preview = await createArenaVirtualSimulationPreviewRun({
      userId: 'student-preview',
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact: registeredArtifact,
      now: '2026-05-11T11:31:00.000Z',
      blackBoxExperimentStore,
      identificationModelStore,
      runStore,
    } as any);

    expect(preview.id).toBe('preview-row-1');
    expect((preview as any).simulationRunId).toBe('canonical-run-preview-1');
    expect(preview.metadata).toEqual(expect.objectContaining({
      evaluationVisibility: 'preview',
      officialEligible: false,
      modelRelation: 'identified-model-controller',
      datasetHash,
      controllerHash: preview.controllerHash,
      identificationModelId: 'registered-identification-model-preview',
      sourceExperimentId: 'experiment-preview-row',
    }));
    expect(identificationModelStore.findOwnedIdentificationModel).toHaveBeenCalledWith({
      userId: 'student-preview',
      taskId: 'task-cruise-roll-blackbox-identification',
      modelId: 'registered-identification-model-preview',
    });
    expect(blackBoxExperimentStore.findOwnedExperiment).toHaveBeenCalledWith({
      userId: 'student-preview',
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash,
      experimentId: 'experiment-preview-row',
    });
    expect(runStore.createRun).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-preview',
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash,
    }));
  });

  it('rejects forged or cross-user datasets before creating a preview run', async () => {
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn().mockResolvedValue(null),
      createExperimentWithinBudget: vi.fn(),
    };
    const identificationModelStore = {
      findOwnedIdentificationModel: vi.fn().mockResolvedValue({
        id: 'arena-identification-preview12345',
        userId: 'student-preview',
        taskId: 'task-cruise-roll-blackbox-identification',
        datasetHash,
        sourceExperimentId: 'experiment-preview-row',
        modelType: 'second-order-fit',
        validationSummary: {
          validationFit: 0.82,
          dataQuality: 0.82,
          sampleCount: 1,
          signalType: 'step',
        },
        protocolVersion: 'arena-identification-model-v1',
        createdAt: '2026-05-11T11:22:00.000Z',
      }),
      createOrResolveIdentificationModel: vi.fn(),
    };
    const runStore = {
      createRun: vi.fn(),
    };

    await expect(createArenaVirtualSimulationPreviewRun({
      userId: 'student-preview',
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact,
      blackBoxExperimentStore,
      identificationModelStore,
      runStore,
    } as any)).rejects.toThrow('does not belong to the current student');
    expect(runStore.createRun).not.toHaveBeenCalled();
  });

  it('rejects unregistered preview model ids before loading an experiment or creating a preview run', async () => {
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn(),
      createExperimentWithinBudget: vi.fn(),
    };
    const identificationModelStore = {
      findOwnedIdentificationModel: vi.fn().mockResolvedValue(null),
      createOrResolveIdentificationModel: vi.fn(),
    };
    const runStore = {
      createRun: vi.fn(),
    };

    await expect(createArenaVirtualSimulationPreviewRun({
      userId: 'student-preview',
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact: registeredArtifact,
      blackBoxExperimentStore,
      identificationModelStore,
      runStore,
    } as any)).rejects.toThrow('server registered identification model');
    expect(blackBoxExperimentStore.findOwnedExperiment).not.toHaveBeenCalled();
    expect(runStore.createRun).not.toHaveBeenCalled();
  });

  it('rejects registered models that do not match the artifact dataset before creating a preview run', async () => {
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn().mockResolvedValue(experiment),
      createExperimentWithinBudget: vi.fn(),
    };
    const identificationModelStore = {
      findOwnedIdentificationModel: vi.fn().mockResolvedValue({
        id: 'arena-identification-preview12345',
        userId: 'student-preview',
        taskId: 'task-cruise-roll-blackbox-identification',
        datasetHash: 'arena-blackbox-dataset-other',
        sourceExperimentId: 'experiment-other',
        modelType: 'second-order-fit',
        validationSummary: {
          validationFit: 0.81,
          dataQuality: 0.81,
          sampleCount: 1,
          signalType: 'step',
        },
        protocolVersion: 'arena-identification-model-v1',
        createdAt: '2026-05-11T11:22:00.000Z',
      }),
      createOrResolveIdentificationModel: vi.fn(),
    };
    const runStore = {
      createRun: vi.fn(),
    };

    await expect(createArenaVirtualSimulationPreviewRun({
      userId: 'student-preview',
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact,
      blackBoxExperimentStore,
      identificationModelStore,
      runStore,
    } as any)).rejects.toThrow('does not match the experiment dataset');
    expect(blackBoxExperimentStore.findOwnedExperiment).not.toHaveBeenCalled();
    expect(runStore.createRun).not.toHaveBeenCalled();
  });

  it('wires the black-box panel to run experiment, save identification, preview, and submit', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/control-workbench/presets/blackbox-identification-preset.tsx'),
      'utf8',
    );

    expect(source).toContain('/api/arena/blackbox-experiments');
    expect(source).toContain('/api/arena/virtual-simulation-runs');
    expect(source).toContain('applyControllerPreview');
    expect(source).toContain("'arena_simulation_run'");
    expect(source).toContain("'arena_submit'");
  });
});
