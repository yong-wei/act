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

    const result = await createArenaBlackBoxExperiment({
      userId: 'student-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      experimentInput,
      now: '2026-05-11T10:20:00.000Z',
      store,
    });

    expect(result.dataset.id).toBe('experiment-row-1');
    expect(result.budget.remaining).toBe(0);
    expect(store.createExperimentWithinBudget).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash: result.dataset.datasetHash,
      budgetCost: 1,
      dailyBudget: ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET,
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
});
