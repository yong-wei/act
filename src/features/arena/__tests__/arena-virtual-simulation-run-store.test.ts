import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
    },
    simulationTaskSpec: {
      upsert: vi.fn(),
    },
    arenaVirtualSimulationRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
    simulationRun: {
      create: vi.fn(),
    },
    simulationTrace: {
      create: vi.fn(),
    },
    learningFact: {
      createMany: vi.fn(),
    },
    learningEvidenceDraft: {
      createMany: vi.fn(),
    },
    evidenceOutbox: {
      createMany: vi.fn(),
    },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import {
  buildArenaVirtualSimulationPreview,
  prismaArenaVirtualSimulationRunStore,
} from '../blackbox/controller-preview';
import { buildBlackBoxControlArtifactFromParams } from '../submissions/blackbox-artifact-builder';
import type { StoredArenaBlackBoxExperiment } from '../blackbox/experiment-service';

const datasetHash = 'arena-blackbox-dataset-store123456';
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
  identificationModelId: 'arena-identification-store12345',
  now: '2026-05-11T11:30:00.000Z',
});

const experiment: StoredArenaBlackBoxExperiment = {
  id: 'experiment-store-row',
  userId: 'student-store',
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

describe('prismaArenaVirtualSimulationRunStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.user.findUnique.mockResolvedValue({
      profile: { classId: 'class-store' },
    });
    mocks.tx.simulationTaskSpec.upsert.mockResolvedValue({
      id: 'task-spec-1',
      specHash: 'sha256:task-spec',
    });
    mocks.tx.arenaVirtualSimulationRun.create.mockResolvedValue({
      id: 'preview-row-1',
      userId: 'student-store',
      taskId: preview.taskId,
      datasetHash: preview.datasetHash,
      controllerHash: preview.controllerHash,
      scenarioId: preview.scenarioId,
      payload: preview,
      createdAt: new Date(preview.createdAt),
    });
    mocks.tx.simulationRun.create.mockResolvedValue({
      id: 'canonical-run-1',
    });
    mocks.tx.simulationTrace.create.mockResolvedValue({
      id: 'trace-1',
    });
    mocks.tx.learningFact.createMany.mockResolvedValue({ count: 1 });
    mocks.tx.learningEvidenceDraft.createMany.mockResolvedValue({ count: 1 });
    mocks.tx.evidenceOutbox.createMany.mockResolvedValue({ count: 1 });
    mocks.tx.arenaVirtualSimulationRun.update.mockResolvedValue({
      id: 'preview-row-1',
      userId: 'student-store',
      taskId: preview.taskId,
      datasetHash: preview.datasetHash,
      controllerHash: preview.controllerHash,
      scenarioId: preview.scenarioId,
      payload: preview,
      simulationRunId: 'canonical-run-1',
      createdAt: new Date(preview.createdAt),
    });
  });

  it('creates canonical SimulationRun and SimulationTrace before linking the Arena preview detail row', async () => {
    const stored = await prismaArenaVirtualSimulationRunStore.createRun({
      userId: 'student-store',
      taskId: preview.taskId,
      datasetHash: preview.datasetHash,
      controllerHash: preview.controllerHash,
      scenarioId: preview.scenarioId,
      preview,
      createdAt: preview.createdAt,
    });

    expect(stored.simulationRunId).toBe('canonical-run-1');
    expect(mocks.tx.simulationTaskSpec.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { specHash: expect.stringMatching(/^sha256:/) },
      create: expect.objectContaining({
        schemaVersion: 'simulation-task-spec-v1',
        sceneId: previewReplay.sceneId,
        scenarioId: previewReplay.scenarioId,
      }),
    }));
    expect(mocks.tx.simulationRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ownerUserId: 'student-store',
        classId: 'class-store',
        runKind: 'arena_preview',
        sourceDomain: 'arena_virtual_preview',
        sourceRefId: 'preview-row-1',
        taskSpecId: 'task-spec-1',
        status: 'completed',
        seed: previewReplay.seed,
        protocolVersion: '1.0',
        runtimeVersion: previewReplay.runtimeVersion,
        modelVersion: previewReplay.modelVersion,
        summary: expect.objectContaining({
          trackingError: preview.summary.trackingError,
          arenaTraining: {
            taskId: preview.taskId,
            scenarioId: preview.scenarioId,
            evaluationVisibility: 'preview',
            officialEligible: false,
          },
          previewBoundary: expect.objectContaining({
            evaluationVisibility: 'preview',
            officialEligible: false,
            modelRelation: 'surrogate',
            teachingSemantics: 'cruise-roll-virtual-preview-surrogate',
            prohibitsMixedClaims: true,
            executor: 'server',
            authoritySource: 'control-engine-server-facade',
            datasetHash: preview.datasetHash,
            controllerHash: preview.controllerHash,
            identificationModelId: 'arena-identification-store12345',
            sourceExperimentId: 'experiment-store-row',
          }),
        }),
      }),
    }));
    expect(mocks.tx.simulationTrace.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        runId: 'canonical-run-1',
        checksum: previewReplay.checksum,
        sampleCount: preview.trace.length,
      }),
    }));
    expect(mocks.tx.arenaVirtualSimulationRun.update).toHaveBeenCalledWith({
      where: { id: 'preview-row-1' },
      data: expect.objectContaining({
        simulationRunId: 'canonical-run-1',
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            runContract: expect.objectContaining({
              identity: expect.objectContaining({
                sourceKind: 'arena-preview',
                officialEligible: false,
                executor: 'server',
              }),
            }),
          }),
        }),
      }),
    });
    expect(mocks.tx.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          userId: 'student-store',
          factType: 'simulation',
          sourceEventId: 'simulation-agent-evidence:simulation_run:canonical-run-1:1.0',
          sourceLogId: 'SimulationRun:canonical-run-1',
        }),
      ],
    }));
    expect(mocks.tx.learningEvidenceDraft.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceType: 'simulation_run',
          dedupeKey: 'simulation_run:canonical-run-1:1.0',
        }),
      ],
    }));
    expect(mocks.tx.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          eventType: 'simulation_agent_evidence.draft_created',
          causationId: 'SimulationRun:canonical-run-1',
        }),
      ],
    }));
  });
});
