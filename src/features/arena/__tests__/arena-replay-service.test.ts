import { describe, expect, it } from 'vitest';

import {
  buildArenaVirtualSimulationPreview,
  computeArenaVirtualSimulationPreviewChecksum,
  type StoredArenaVirtualSimulationRun,
} from '../blackbox/controller-preview';
import {
  ArenaReplayAccessError,
  ArenaReplayNotFoundError,
  verifyArenaVirtualSimulationReplay,
  type ArenaReplayRunStore,
} from '../blackbox/replay-service';
import { buildBlackBoxControlArtifactFromParams } from '../submissions/blackbox-artifact-builder';
import type { StoredArenaBlackBoxExperiment } from '../blackbox/experiment-service';

const datasetHash = 'arena-blackbox-dataset-replay123456';
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
  identificationModelId: 'arena-identification-replay12345',
  now: '2026-05-11T11:30:00.000Z',
});

const experiment: StoredArenaBlackBoxExperiment = {
  id: 'experiment-replay-row',
  userId: 'student-replay',
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

const preview = buildArenaVirtualSimulationPreview({
  taskId: 'task-cruise-roll-blackbox-identification',
  artifact,
  experiment,
  now: '2026-05-11T11:31:00.000Z',
});
const previewReplay = preview.replay!;

function storeFor(run: StoredArenaVirtualSimulationRun | null): ArenaReplayRunStore {
  return {
    findVirtualSimulationRunById: async () => run,
  };
}

describe('arena replay service', () => {
  it('verifies a persisted preview run checksum for the owning student', async () => {
    const result = await verifyArenaVirtualSimulationReplay({
      runId: 'preview-row-1',
      requester: { userId: 'student-replay', role: 'STUDENT' },
      store: storeFor({
        id: 'preview-row-1',
        userId: 'student-replay',
        taskId: preview.taskId,
        datasetHash: preview.datasetHash,
        controllerHash: preview.controllerHash,
        scenarioId: preview.scenarioId,
        preview,
        createdAt: preview.createdAt,
      }),
    });

    expect(result.status).toBe('match');
    expect(result.persistedChecksum).toBe(previewReplay.checksum);
  });

  it('returns mismatch without overwriting persisted evidence', async () => {
    const result = await verifyArenaVirtualSimulationReplay({
      runId: 'preview-row-1',
      requester: { userId: 'student-replay', role: 'STUDENT' },
      store: storeFor({
        id: 'preview-row-1',
        userId: 'student-replay',
        taskId: preview.taskId,
        datasetHash: preview.datasetHash,
        controllerHash: preview.controllerHash,
        scenarioId: preview.scenarioId,
        preview: {
          ...preview,
          replay: { ...previewReplay, checksum: 'sha256:bad' },
        },
        createdAt: preview.createdAt,
      }),
    });

    expect(result.status).toBe('mismatch');
    expect(result.persistedChecksum).toBe('sha256:bad');
    expect(result.recomputedChecksum).toBe(previewReplay.checksum);
  });

  it('detects tampered preview evidence even when the stored checksum is self-consistent', async () => {
    const tamperedPreview = {
      ...preview,
      summary: {
        ...preview.summary,
        trackingError: 999,
      },
      replay: {
        ...previewReplay,
        checksum: '',
      },
    };
    tamperedPreview.replay = {
      ...previewReplay,
      checksum: computeArenaVirtualSimulationPreviewChecksum(tamperedPreview),
    };

    const result = await verifyArenaVirtualSimulationReplay({
      runId: 'preview-row-1',
      requester: { userId: 'student-replay', role: 'STUDENT' },
      store: storeFor({
        id: 'preview-row-1',
        userId: 'student-replay',
        taskId: preview.taskId,
        datasetHash: preview.datasetHash,
        controllerHash: preview.controllerHash,
        scenarioId: preview.scenarioId,
        preview: tamperedPreview,
        createdAt: preview.createdAt,
      }),
    });

    expect(result.status).toBe('mismatch');
    expect(result.persistedChecksum).toBe(tamperedPreview.replay.checksum);
    expect(result.recomputedChecksum).toBe(previewReplay.checksum);
  });

  it('reports missing trace metadata', async () => {
    const result = await verifyArenaVirtualSimulationReplay({
      runId: 'preview-row-1',
      requester: { userId: 'student-replay', role: 'STUDENT' },
      store: storeFor({
        id: 'preview-row-1',
        userId: 'student-replay',
        taskId: preview.taskId,
        datasetHash: preview.datasetHash,
        controllerHash: preview.controllerHash,
        scenarioId: preview.scenarioId,
        preview: { ...preview, trace: [] },
        createdAt: preview.createdAt,
      }),
    });

    expect(result.status).toBe('missing_trace');
  });

  it('resolves canonical SimulationRun and SimulationTrace metadata before replay verification', async () => {
    const result = await verifyArenaVirtualSimulationReplay({
      runId: 'preview-row-1',
      requester: { userId: 'student-replay', role: 'STUDENT' },
      store: storeFor({
        id: 'preview-row-1',
        userId: 'student-replay',
        taskId: preview.taskId,
        datasetHash: preview.datasetHash,
        controllerHash: preview.controllerHash,
        scenarioId: preview.scenarioId,
        preview: {
          ...preview,
          replay: {
            ...previewReplay,
            runtimeVersion: 'legacy-preview-runtime',
            modelVersion: 'legacy-preview-model',
          },
        },
        simulationRun: {
          id: 'canonical-run-1',
          ownerUserId: 'student-replay',
          classId: 'class-replay',
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: 'preview-row-1',
          taskSpec: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'arena/task-cruise-roll-blackbox-identification',
            scenarioId: preview.scenarioId,
            objectives: ['tracking_error'],
            constraints: ['control_energy'],
            disturbancePolicy: {},
            evaluationSpecRef: { id: 'arena-preview', visibility: 'preview' },
            allowedControllers: ['blackbox-pid'],
            launchContext: { publicationId: 'pub-replay' },
            specHash: 'sha256:task-spec',
          },
          controllerSnapshotRef: `ArenaControllerArtifact:${artifact.id}`,
          status: 'completed',
          summary: preview.summary,
          replayToken: 'replay-token-1',
          seed: previewReplay.seed,
          protocolVersion: '1.0',
          runtimeVersion: 'canonical-runtime-v1',
          modelVersion: 'canonical-model-v1',
          sceneSpecVersion: 'arena-scene-v1',
          createdAt: preview.createdAt,
          completedAt: preview.createdAt,
        },
        simulationTrace: {
          id: 'trace-1',
          runId: 'canonical-run-1',
          protocolVersion: '1.0',
          runtimeVersion: 'canonical-runtime-v1',
          modelVersion: 'canonical-model-v1',
          seed: previewReplay.seed,
          checksum: previewReplay.checksum,
          summaryMetrics: preview.summary,
          sampleCount: preview.trace.length,
          sampleCadence: 0.2,
          sampleStorageUri: 'traces/canonical-run-1.json',
          createdAt: preview.createdAt,
        },
        createdAt: preview.createdAt,
      } as any),
    });

    expect(result.status).toBe('match');
    expect(result.runId).toBe('canonical-run-1');
    expect(result.metadata).toEqual(expect.objectContaining({
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'preview-row-1',
      evaluationVisibility: 'preview',
      officialEligible: false,
      modelRelation: 'surrogate',
      datasetHash: preview.datasetHash,
      controllerHash: preview.controllerHash,
      identificationModelId: 'arena-identification-replay12345',
      sourceExperimentId: 'experiment-replay-row',
      scenarioId: preview.scenarioId,
      runtimeVersion: 'canonical-runtime-v1',
      modelVersion: 'canonical-model-v1',
      traceChecksum: previewReplay.checksum,
      sampleCount: preview.trace.length,
    }));
  });

  it('rejects teacher canonical replay when the teacher is not authorized for the run class', async () => {
    await expect(verifyArenaVirtualSimulationReplay({
      runId: 'preview-row-1',
      requester: { userId: 'teacher-1', role: 'TEACHER', classIds: ['class-current'] } as any,
      store: storeFor({
        id: 'preview-row-1',
        userId: 'student-replay',
        taskId: preview.taskId,
        datasetHash: preview.datasetHash,
        controllerHash: preview.controllerHash,
        scenarioId: preview.scenarioId,
        preview,
        ownerClassId: 'class-current',
        ownerClassTeacherId: 'teacher-1',
        simulationRun: {
          id: 'canonical-run-1',
          ownerUserId: 'student-replay',
          classId: 'class-old',
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: 'preview-row-1',
          taskSpec: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'arena/task-cruise-roll-blackbox-identification',
            scenarioId: preview.scenarioId,
            objectives: ['tracking_error'],
            constraints: ['control_energy'],
            disturbancePolicy: {},
            evaluationSpecRef: { id: 'arena-preview', visibility: 'preview' },
            allowedControllers: ['blackbox-pid'],
            launchContext: { publicationId: 'pub-replay' },
            specHash: 'sha256:task-spec',
          },
          controllerSnapshotRef: `ArenaControllerArtifact:${artifact.id}`,
          status: 'completed',
          summary: preview.summary,
          replayToken: 'replay-token-1',
          seed: previewReplay.seed,
          protocolVersion: '1.0',
          runtimeVersion: 'canonical-runtime-v1',
          modelVersion: 'canonical-model-v1',
          sceneSpecVersion: 'arena-scene-v1',
          createdAt: preview.createdAt,
          completedAt: preview.createdAt,
        },
        simulationTrace: {
          id: 'trace-1',
          runId: 'canonical-run-1',
          protocolVersion: '1.0',
          runtimeVersion: 'canonical-runtime-v1',
          modelVersion: 'canonical-model-v1',
          seed: previewReplay.seed,
          checksum: previewReplay.checksum,
          summaryMetrics: preview.summary,
          sampleCount: preview.trace.length,
          sampleCadence: 0.2,
          sampleStorageUri: 'traces/canonical-run-1.json',
          createdAt: preview.createdAt,
        },
        createdAt: preview.createdAt,
      } as any),
    })).rejects.toThrow(ArenaReplayAccessError);
  });

  it('rejects missing and unauthorized runs before revealing replay metadata', async () => {
    await expect(verifyArenaVirtualSimulationReplay({
      runId: 'missing',
      requester: { userId: 'student-replay', role: 'STUDENT' },
      store: storeFor(null),
    })).rejects.toThrow(ArenaReplayNotFoundError);

    await expect(verifyArenaVirtualSimulationReplay({
      runId: 'preview-row-1',
      requester: { userId: 'other-student', role: 'STUDENT' },
      store: storeFor({
        id: 'preview-row-1',
        userId: 'student-replay',
        taskId: preview.taskId,
        datasetHash: preview.datasetHash,
        controllerHash: preview.controllerHash,
        scenarioId: preview.scenarioId,
        preview,
        createdAt: preview.createdAt,
      }),
    })).rejects.toThrow(ArenaReplayAccessError);
  });
});
