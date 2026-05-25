import { describe, expect, it, vi } from 'vitest';

import {
  buildIdentificationArtifactFromExperiment,
  runArenaBlackBoxExperiment,
} from '../blackbox/experiment';
import {
  ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET,
  ArenaBlackBoxExperimentInputError,
  createArenaBlackBoxExperiment,
} from '../blackbox/experiment-service';
import { buildBlackBoxControlArtifactFromParams } from '../submissions/blackbox-artifact-builder';
import { evaluateArenaSubmission } from '../evaluation/evaluator';
import { createPersistedArenaSubmission } from '../submissions/persistence';

const experimentInput = {
  signalType: 'step' as const,
  amplitude: 0.8,
  duration: 8,
  sampleTime: 0.2,
  initialRoll: 0.05,
  disturbanceLevel: 0.3,
};

describe('arena black-box experiment interface', () => {
  it('returns a bounded black-box input-output dataset without exposing the hidden model', () => {
    const dataset = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: { ...experimentInput, seed: 20260525 },
      now: '2026-05-11T10:20:00.000Z',
    });

    expect(dataset.datasetHash).toMatch(/^arena-blackbox-dataset-/);
    expect(dataset.samples.length).toBeGreaterThan(10);
    expect(dataset.samples[0]).toEqual(expect.objectContaining({
      t: expect.any(Number),
      input: expect.any(Number),
      output: expect.any(Number),
    }));
    expect(dataset.summary.dataQuality).toBeGreaterThan(0);
    expect(dataset.replay).toEqual(expect.objectContaining({
      sceneId: 'arena/task-cruise-roll-blackbox-identification/public-experiment',
      scenarioId: 'cruise-roll-public-identification',
      seed: 20260525,
      protocolVersion: '1.0',
      runtimeVersion: expect.any(String),
      modelVersion: expect.any(String),
      checksum: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(dataset)).not.toContain('transferFunction');
    expect(JSON.stringify(dataset)).not.toContain('G(s)');
  });

  it('replays black-box PRBS experiments deterministically for the same seed', () => {
    const first = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: { ...experimentInput, signalType: 'prbs', seed: 77 },
      now: '2026-05-11T10:20:00.000Z',
    });
    const second = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: { ...experimentInput, signalType: 'prbs', seed: 77 },
      now: '2026-05-11T10:21:00.000Z',
    });

    expect(first.samples).toEqual(second.samples);
    expect(first.replay.checksum).toBe(second.replay.checksum);
  });

  it('rejects non-black-box Arena tasks before generating a dataset', () => {
    expect(() => runArenaBlackBoxExperiment({
      taskId: 'task-second-order-lead-pid',
      input: experimentInput,
    })).toThrow('is not a black-box virtual simulation task');
  });

  it('persists experiment datasets only when daily budget remains', async () => {
    const store = {
      findOwnedExperiment: vi.fn(),
      createExperimentWithinBudget: vi.fn(async (input) => ({
        usedBefore: ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET - 1,
        experiment: { ...input, id: 'experiment-row-1' },
      })),
    };
    const identificationModelStore = {
      createOrResolveIdentificationModel: vi.fn(async (input) => ({
        ...input,
        id: 'registered-identification-model-1',
      })),
      findOwnedIdentificationModel: vi.fn(),
    };

    const result = await createArenaBlackBoxExperiment({
      userId: 'student-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
      now: '2026-05-11T10:20:00.000Z',
      store,
      identificationModelStore,
    } as any);

    expect(result.dataset.id).toBe('experiment-row-1');
    expect(result.dataset.registeredModel).toEqual(expect.objectContaining({
      id: 'registered-identification-model-1',
      userId: 'student-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash: result.dataset.datasetHash,
      sourceExperimentId: 'experiment-row-1',
      modelType: 'second-order-fit',
      protocolVersion: 'arena-identification-model-v1',
    }));
    expect(result.budget.remaining).toBe(0);
    expect(store.createExperimentWithinBudget).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash: result.dataset.datasetHash,
      budgetCost: 1,
      dailyBudget: ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET,
    }));
    expect(identificationModelStore.createOrResolveIdentificationModel).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash: result.dataset.datasetHash,
      sourceExperimentId: 'experiment-row-1',
    }));
  });

  it('blocks experiment creation when the student daily budget is exhausted', async () => {
    const store = {
      findOwnedExperiment: vi.fn(),
      createExperimentWithinBudget: vi.fn(async () => ({
        usedBefore: ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET,
        experiment: null,
      })),
    };

    await expect(createArenaBlackBoxExperiment({
      userId: 'student-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
      now: '2026-05-11T10:20:00.000Z',
      store,
      identificationModelStore: {
        createOrResolveIdentificationModel: vi.fn(),
        findOwnedIdentificationModel: vi.fn(),
      },
    })).rejects.toThrow(ArenaBlackBoxExperimentInputError);
    expect(store.createExperimentWithinBudget).toHaveBeenCalled();
  });

  it('requires official black-box submissions to reference an experiment dataset and identification model', async () => {
    const dataset = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: experimentInput,
      now: '2026-05-11T10:20:00.000Z',
    });
    const identification = buildIdentificationArtifactFromExperiment(dataset, '2026-05-11T10:22:00.000Z');
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: dataset.taskId,
      values: {
        identificationQuality: String(identification.validationFit),
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash: dataset.datasetHash,
      identificationModelId: identification.modelId,
      now: '2026-05-11T10:24:00.000Z',
    });

    const result = await evaluateArenaSubmission({ taskId: dataset.taskId, artifact });

    expect(result.valid).toBe(true);
    expect(result.artifact.params.experimentDatasetHash).toBe(dataset.datasetHash);
    expect(result.artifact.params.identificationModelId).toBe(identification.modelId);
  });

  it('keeps official black-box evaluation independent from preview payloads and visible preview metrics', async () => {
    const dataset = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: experimentInput,
      now: '2026-05-11T10:20:00.000Z',
    });
    const baseArtifact = buildBlackBoxControlArtifactFromParams({
      taskId: dataset.taskId,
      values: {
        identificationQuality: String(dataset.summary.dataQuality),
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash: dataset.datasetHash,
      identificationModelId: 'registered-identification-model-isolation',
      now: '2026-05-11T10:24:00.000Z',
    });
    const artifactWithPreviewOnlyData = {
      ...baseArtifact,
      params: {
        ...baseArtifact.params,
        previewMetrics: {
          trackingError: 0,
          controlEnergy: 0,
        },
        previewPayload: {
          trace: [{ t: 0, output: 999, control: 999 }],
          summary: { trackingError: 0, controlEnergy: 0 },
        },
      },
    };

    const baseResult = await evaluateArenaSubmission({ taskId: dataset.taskId, artifact: baseArtifact });
    const previewPollutedResult = await evaluateArenaSubmission({
      taskId: dataset.taskId,
      artifact: artifactWithPreviewOnlyData,
    });

    expect(previewPollutedResult.metrics).toEqual(baseResult.metrics);
    expect(previewPollutedResult.score).toBe(baseResult.score);
    expect(previewPollutedResult.metadata).toEqual(expect.objectContaining({
      scenarioSetId: 'cruise-roll-hidden-official-v1',
    }));
  });

  it('strips preview-only fields from official black-box artifact identity and persistence', async () => {
    const dataset = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: experimentInput,
      now: '2026-05-11T10:20:00.000Z',
    });
    const baseArtifact = buildBlackBoxControlArtifactFromParams({
      taskId: dataset.taskId,
      values: {
        identificationQuality: '0.11',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash: dataset.datasetHash,
      identificationModelId: 'registered-identification-model-isolation',
      now: '2026-05-11T10:24:00.000Z',
    });
    const artifactWithPreviewOnlyData = {
      ...baseArtifact,
      id: 'artifact-with-preview-only-data',
      params: {
        ...baseArtifact.params,
        previewMetrics: {
          trackingError: 0,
          controlEnergy: 0,
        },
        previewPayload: {
          trace: [{ t: 0, output: 999, control: 999 }],
          summary: { trackingError: 0, controlEnergy: 0 },
        },
      },
    };
    const storedArtifacts: unknown[] = [];
    const submissionStore = {
      findEvaluationByHash: vi.fn(async () => null),
      createEvaluation: vi.fn(async (input) => ({ ...input, id: `evaluation-${storedArtifacts.length + 1}` })),
      upsertArtifact: vi.fn(async (input) => {
        storedArtifacts.push(input.artifact);
        return { ...input, id: `artifact-${storedArtifacts.length}` };
      }),
      createSubmission: vi.fn(async (input) => ({ ...input, id: `submission-${storedArtifacts.length}` })),
    };
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn(async () => ({
        id: 'experiment-row-isolation',
        userId: 'student-blackbox',
        taskId: dataset.taskId,
        datasetHash: dataset.datasetHash,
        signalType: dataset.signalType,
        dataset,
        budgetCost: dataset.budgetCost,
        createdAt: dataset.createdAt,
      })),
      countOwnedExperiments: vi.fn(async () => 6),
      createExperimentWithinBudget: vi.fn(),
    };
    const identificationModelStore = {
      findOwnedIdentificationModel: vi.fn(async () => ({
        id: 'registered-identification-model-isolation',
        userId: 'student-blackbox',
        taskId: dataset.taskId,
        datasetHash: dataset.datasetHash,
        sourceExperimentId: 'experiment-row-isolation',
        modelType: 'second-order-fit',
        validationSummary: {
          validationFit: dataset.summary.dataQuality,
          dataQuality: dataset.summary.dataQuality,
          sampleCount: dataset.samples.length,
          signalType: dataset.signalType,
        },
        protocolVersion: 'arena-identification-model-v1',
        createdAt: '2026-05-11T10:22:00.000Z',
      })),
      createOrResolveIdentificationModel: vi.fn(),
    };

    const baseSubmission = await createPersistedArenaSubmission({
      taskId: dataset.taskId,
      artifact: baseArtifact,
      userId: 'student-blackbox',
      studentLabel: '学生甲',
      submittedAt: '2026-05-11T10:25:00.000Z',
      store: submissionStore,
      blackBoxExperimentStore,
      identificationModelStore,
    } as any);
    const previewPollutedSubmission = await createPersistedArenaSubmission({
      taskId: dataset.taskId,
      artifact: artifactWithPreviewOnlyData,
      userId: 'student-blackbox',
      studentLabel: '学生甲',
      submittedAt: '2026-05-11T10:26:00.000Z',
      store: submissionStore,
      blackBoxExperimentStore,
      identificationModelStore,
    } as any);

    expect(previewPollutedSubmission.artifactHash).toBe(baseSubmission.artifactHash);
    expect(previewPollutedSubmission.artifact.params).not.toHaveProperty('previewMetrics');
    expect(previewPollutedSubmission.artifact.params).not.toHaveProperty('previewPayload');
    expect(previewPollutedSubmission.artifact.params.identificationQuality).toBe(dataset.summary.dataQuality);
    expect(storedArtifacts[1]).toEqual(expect.objectContaining({
      params: expect.not.objectContaining({
        previewMetrics: expect.anything(),
        previewPayload: expect.anything(),
      }),
    }));
  });

  it('accepts official black-box submissions only when the model id is server registered for the owned dataset', async () => {
    const dataset = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: experimentInput,
      now: '2026-05-11T10:20:00.000Z',
    });
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: dataset.taskId,
      values: {
        identificationQuality: String(dataset.summary.dataQuality),
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash: dataset.datasetHash,
      identificationModelId: 'registered-identification-model-official',
      now: '2026-05-11T10:24:00.000Z',
    });
    const submissionStore = {
      findEvaluationByHash: vi.fn(async () => null),
      createEvaluation: vi.fn(async (input) => ({ ...input, id: 'evaluation-1' })),
      upsertArtifact: vi.fn(async (input) => ({ ...input, id: 'artifact-1' })),
      createSubmission: vi.fn(async (input) => ({ ...input, id: 'submission-1' })),
    };
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn(async () => ({
        id: 'experiment-row-registered',
        userId: 'student-blackbox',
        taskId: dataset.taskId,
        datasetHash: dataset.datasetHash,
        signalType: dataset.signalType,
        dataset,
        budgetCost: dataset.budgetCost,
        createdAt: dataset.createdAt,
      })),
      countOwnedExperiments: vi.fn(async () => 6),
      createExperimentWithinBudget: vi.fn(),
    };
    const identificationModelStore = {
      findOwnedIdentificationModel: vi.fn(async () => ({
        id: 'registered-identification-model-official',
        userId: 'student-blackbox',
        taskId: dataset.taskId,
        datasetHash: dataset.datasetHash,
        sourceExperimentId: 'experiment-row-registered',
        modelType: 'second-order-fit',
        validationSummary: {
          validationFit: dataset.summary.dataQuality,
          dataQuality: dataset.summary.dataQuality,
          sampleCount: dataset.samples.length,
          signalType: dataset.signalType,
        },
        protocolVersion: 'arena-identification-model-v1',
        createdAt: '2026-05-11T10:22:00.000Z',
      })),
      createOrResolveIdentificationModel: vi.fn(),
    };

    const submission = await createPersistedArenaSubmission({
      taskId: dataset.taskId,
      artifact,
      userId: 'student-blackbox',
      studentLabel: '学生甲',
      submittedAt: '2026-05-11T10:25:00.000Z',
      store: submissionStore,
      blackBoxExperimentStore,
      identificationModelStore,
    } as any);

    expect(submission.artifact.params.identificationModelId).toBe('registered-identification-model-official');
    expect(identificationModelStore.findOwnedIdentificationModel).toHaveBeenCalledWith({
      userId: 'student-blackbox',
      taskId: dataset.taskId,
      modelId: 'registered-identification-model-official',
    });
    expect(blackBoxExperimentStore.findOwnedExperiment).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-blackbox',
      taskId: dataset.taskId,
      datasetHash: dataset.datasetHash,
      experimentId: 'experiment-row-registered',
    }));
  });

  it('rejects unregistered official black-box model ids before evaluation persistence', async () => {
    const dataset = runArenaBlackBoxExperiment({
      taskId: 'task-cruise-roll-blackbox-identification',
      input: experimentInput,
      now: '2026-05-11T10:20:00.000Z',
    });
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: dataset.taskId,
      values: {
        identificationQuality: String(dataset.summary.dataQuality),
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash: dataset.datasetHash,
      identificationModelId: 'unregistered-identification-model',
      now: '2026-05-11T10:24:00.000Z',
    });
    const submissionStore = {
      findEvaluationByHash: vi.fn(),
      createEvaluation: vi.fn(),
      upsertArtifact: vi.fn(),
      createSubmission: vi.fn(),
    };
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn(),
      countOwnedExperiments: vi.fn(),
      createExperimentWithinBudget: vi.fn(),
    };
    const identificationModelStore = {
      findOwnedIdentificationModel: vi.fn(async () => null),
      createOrResolveIdentificationModel: vi.fn(),
    };

    await expect(createPersistedArenaSubmission({
      taskId: dataset.taskId,
      artifact,
      userId: 'student-blackbox',
      studentLabel: '学生甲',
      submittedAt: '2026-05-11T10:25:00.000Z',
      store: submissionStore,
      blackBoxExperimentStore,
      identificationModelStore,
    } as any)).rejects.toThrow('server registered identification model');
    expect(blackBoxExperimentStore.findOwnedExperiment).not.toHaveBeenCalled();
    expect(submissionStore.findEvaluationByHash).not.toHaveBeenCalled();
  });
});
