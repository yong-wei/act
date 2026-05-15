import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { evaluateArenaSubmission, getArenaEvaluationProtocolVersion } from '../evaluation/evaluator';
import { buildBlackBoxControlArtifactFromParams } from '../submissions/blackbox-artifact-builder';
import { createPersistedArenaSubmission } from '../submissions/persistence';

const experimentDatasetHash = 'arena-blackbox-dataset-test1234567890';
const identificationModelId = 'arena-identification-test12345678';

describe('arena black-box identification evaluation', () => {
  it('builds black-box control artifacts from identification workspace parameters', () => {
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: '0.82',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash,
      identificationModelId,
      now: '2026-05-11T09:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: 'task-cruise-roll-blackbox-identification',
      method: 'black-box-control',
      params: {
        representation: 'identified-model-controller',
        experimentDatasetHash,
        identificationModelId,
        identificationQuality: 0.82,
        experimentCount: 6,
        controllerGain: 1.6,
        dampingCompensation: 0.72,
        energyBudget: 12,
      },
      createdAt: '2026-05-11T09:00:00.000Z',
    });
  });

  it('rejects malformed black-box artifacts before official evaluation', () => {
    expect(() => buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: 'bad',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash,
      identificationModelId,
      now: '2026-05-11T09:00:00.000Z',
    })).toThrow('identificationQuality 必须是有限数字');
  });

  it('evaluates valid black-box control artifacts without exposing a transfer function', () => {
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: '0.82',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash,
      identificationModelId,
      now: '2026-05-11T09:00:00.000Z',
    });

    const result = evaluateArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact,
    });

    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics.trackingError).toBeGreaterThan(0);
    expect(result.metrics.identificationFit).toBeGreaterThan(0);
    expect(result.metrics.identificationFit).not.toBe(0.82);
    expect(result.explanation.join(' ')).not.toContain('G(s)');
  });

  it('does not trust client-claimed identification quality for official metrics', () => {
    const lowClaim = evaluateArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact: {
        id: 'artifact-blackbox-low-claim',
        taskId: 'task-cruise-roll-blackbox-identification',
        method: 'black-box-control',
        params: {
          representation: 'identified-model-controller',
          experimentDatasetHash,
          identificationModelId,
          identificationQuality: 0.1,
          experimentCount: 6,
          controllerGain: 1.6,
          dampingCompensation: 0.72,
          energyBudget: 12,
        },
        createdAt: '2026-05-11T09:00:00.000Z',
      },
    });
    const highClaim = evaluateArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact: {
        id: 'artifact-blackbox-high-claim',
        taskId: 'task-cruise-roll-blackbox-identification',
        method: 'black-box-control',
        params: {
          representation: 'identified-model-controller',
          experimentDatasetHash,
          identificationModelId,
          identificationQuality: 1,
          experimentCount: 6,
          controllerGain: 1.6,
          dampingCompensation: 0.72,
          energyBudget: 12,
        },
        createdAt: '2026-05-11T09:00:00.000Z',
      },
    });

    expect(highClaim.metrics.identificationFit).toBe(lowClaim.metrics.identificationFit);
    expect(highClaim.score).toBe(lowClaim.score);
  });

  it('rejects out-of-range black-box artifacts before ranking', () => {
    const result = evaluateArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact: {
        id: 'artifact-blackbox-adversarial',
        taskId: 'task-cruise-roll-blackbox-identification',
        method: 'black-box-control',
        params: {
          representation: 'identified-model-controller',
          experimentDatasetHash,
          identificationModelId,
          identificationQuality: 1,
          experimentCount: 99,
          controllerGain: 30,
          dampingCompensation: 0.2,
          energyBudget: 4,
        },
        createdAt: '2026-05-11T09:00:00.000Z',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.score).toBe(0);
    expect(result.explanation.join(' ')).toContain('experimentCount 不能超过 20');
    expect(result.explanation.join(' ')).toContain('controllerGain 不能超过 8');
  });

  it('keeps white-box and black-box protocols separate, partitioned by method family', () => {
    expect(getArenaEvaluationProtocolVersion({ taskId: 'task-second-order-lead-pid', method: 'pid' })).toBe('template-whitebox-v1');
    expect(getArenaEvaluationProtocolVersion({ taskId: 'task-second-order-lead-pid', method: 'serial-compensator' })).toBe('template-whitebox-v1');
    expect(getArenaEvaluationProtocolVersion({ taskId: 'task-cruise-roll-blackbox-identification', method: 'black-box-control' })).toBe('blackbox-v1');
    expect(getArenaEvaluationProtocolVersion({ taskId: 'task-second-order-lead-pid' })).toBe('template-whitebox-v1');
    expect(getArenaEvaluationProtocolVersion({ taskId: 'task-second-order-lead-pid', method: 'code-controller' })).toBe('code-sandbox-disabled-v1');
  });

  it('persists black-box official evaluations with the black-box protocol version', async () => {
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: '0.82',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash,
      identificationModelId,
      now: '2026-05-11T09:00:00.000Z',
    });
    const store = {
      findEvaluationByHash: vi.fn().mockResolvedValue(null),
      createEvaluation: vi.fn(async (evaluation) => ({ ...evaluation, id: 'blackbox-eval-row' })),
      upsertArtifact: vi.fn(async (storedArtifact) => ({ ...storedArtifact, id: 'blackbox-artifact-row' })),
      createSubmission: vi.fn(async (submission) => ({ ...submission, id: 'blackbox-submission-row' })),
    };
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn().mockResolvedValue({
        id: 'blackbox-experiment-row',
        userId: 'student-blackbox',
        taskId: 'task-cruise-roll-blackbox-identification',
        datasetHash: experimentDatasetHash,
        signalType: 'step',
        dataset: { datasetHash: experimentDatasetHash },
        budgetCost: 1,
        createdAt: '2026-05-11T09:00:00.000Z',
      }),
      createExperimentWithinBudget: vi.fn(),
    };

    const submission = await createPersistedArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact,
      userId: 'student-blackbox',
      studentLabel: '黑箱学生',
      submittedAt: '2026-05-11T09:01:00.000Z',
      store,
      blackBoxExperimentStore,
    });

    expect(submission.evaluation.valid).toBe(true);
    expect(store.findEvaluationByHash).toHaveBeenCalledWith(
      'task-cruise-roll-blackbox-identification',
      submission.artifactHash,
      'blackbox-v1',
    );
    expect(store.createEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      protocolVersion: 'blackbox-v1',
    }));
    expect(blackBoxExperimentStore.findOwnedExperiment).toHaveBeenCalledWith({
      userId: 'student-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      datasetHash: experimentDatasetHash,
    });
  });

  it('rejects forged or cross-user black-box experiment dataset references before official evaluation', async () => {
    const artifact = buildBlackBoxControlArtifactFromParams({
      taskId: 'task-cruise-roll-blackbox-identification',
      values: {
        identificationQuality: '0.82',
        experimentCount: '6',
        controllerGain: '1.6',
        dampingCompensation: '0.72',
        energyBudget: '12',
      },
      experimentDatasetHash: 'arena-blackbox-dataset-forged-not-persisted',
      identificationModelId: 'arena-identification-forged-not-p',
      now: '2026-05-11T09:00:00.000Z',
    });
    const store = {
      findEvaluationByHash: vi.fn(),
      createEvaluation: vi.fn(),
      upsertArtifact: vi.fn(),
      createSubmission: vi.fn(),
    };
    const blackBoxExperimentStore = {
      findOwnedExperiment: vi.fn().mockResolvedValue(null),
      createExperimentWithinBudget: vi.fn(),
    };

    await expect(createPersistedArenaSubmission({
      taskId: 'task-cruise-roll-blackbox-identification',
      artifact,
      userId: 'student-blackbox',
      studentLabel: '黑箱学生',
      submittedAt: '2026-05-11T09:01:00.000Z',
      store,
      blackBoxExperimentStore,
    })).rejects.toThrow('Black-box experiment dataset does not belong to the current student');
    expect(store.findEvaluationByHash).not.toHaveBeenCalled();
  });

  it('keeps black-box submission UI available while challenge detail stays read-only', () => {
    const detailSource = readFileSync(
      join(process.cwd(), 'src/features/arena/challenge-detail.tsx'),
      'utf8',
    );
    const cruiseSimulationPageSource = readFileSync(
      join(process.cwd(), 'src/app/simulations/cruise/page.tsx'),
      'utf8',
    );
    const panelSource = readFileSync(
      join(process.cwd(), 'src/features/arena/submissions/arena-blackbox-submission-panel.tsx'),
      'utf8',
    );

    expect(detailSource).not.toContain('<ArenaBlackBoxSubmissionPanel');
    expect(detailSource).toContain('仿真调试与方案提交均在工作台内完成');
    expect(cruiseSimulationPageSource).toContain('searchParams');
    expect(cruiseSimulationPageSource).toContain('resolveArenaWorkbenchContext');
    expect(cruiseSimulationPageSource).toContain('<ArenaBlackBoxSubmissionPanel');
    expect(cruiseSimulationPageSource).toContain("workspaceMode === 'black-box-identification'");
    expect(panelSource).toContain('buildBlackBoxControlArtifactFromParams');
    expect(panelSource).toContain('experimentDatasetHash: latestDataset.datasetHash');
    expect(panelSource).toContain('identificationModelId: identificationModel.modelId');
    expect(panelSource).toContain("'arena_identification_model_save'");
    expect(panelSource).toContain("'arena_controller_save'");
    expect(panelSource).toContain("'arena_submit'");
    expect(panelSource).toContain("'arena_evaluation_complete'");
    expect(panelSource).toContain('JSON.stringify({ taskId: task.id, artifact })');
  });

  it('does not gate challenge detail submission surfaces by virtual-simulation adapter type', () => {
    const detailSource = readFileSync(
      join(process.cwd(), 'src/features/arena/challenge-detail.tsx'),
      'utf8',
    );

    expect(detailSource).not.toContain("object.adapterType === 'virtual-simulation'");
    expect(detailSource).not.toContain('ArenaBlackBoxSubmissionPanel');
  });

  it('lists persisted submissions through the current protocol for each task type', () => {
    const storeSource = readFileSync(
      join(process.cwd(), 'src/features/arena/submissions/prisma-store.ts'),
      'utf8',
    );

    expect(storeSource).toContain('getArenaEvaluationProtocolVersion({ taskId: String(row.taskId), method');
    expect(storeSource).not.toContain('protocolVersion: ARENA_EVALUATION_PROTOCOL_VERSION');
  });
});
