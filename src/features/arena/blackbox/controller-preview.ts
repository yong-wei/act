import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { persistSimulationAgentEvidenceMaterialization } from '@/lib/data-governance/simulation-agent-evidence-materialization';
import { buildSimulationTaskSpec } from '@/resources/simulations/core/run-contract';
import {
  createSimulationRunContext,
  normalizeSeed,
  type SimulationReplayMetadata,
} from '@/resources/simulations/core/seeded-rng';
import {
  buildSimulationReplayMetadata,
  computeReplayChecksum,
} from '@/resources/simulations/lib/replay-checksum';

import {
  ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
  ARENA_PREVIEW_TEACHING_SEMANTICS,
} from '@/lib/control-engine';
import { computeArenaVirtualPreviewResult } from '@/lib/control-engine/server';
import { projectArenaPreviewIdentity } from '@/lib/practice-lab-run-contract';

import type { ControllerArtifact } from '../types';
import { hashControllerArtifact } from '../submissions/artifact-hash';
import type {
  ArenaIdentificationModelStore,
  ArenaBlackBoxExperimentStore,
  StoredArenaBlackBoxExperiment,
} from './experiment-service';

export interface ArenaVirtualSimulationTracePoint {
  t: number;
  reference: number;
  output: number;
  control: number;
}

export interface ArenaVirtualSimulationPreviewRun {
  taskId: string;
  datasetHash: string;
  controllerHash: string;
  scenarioId: string;
  trace: ArenaVirtualSimulationTracePoint[];
  summary: {
    trackingError: number;
    maxDeviation: number;
    controlEnergy: number;
    safetyViolations: number;
    smoothness: number;
  };
  replay?: SimulationReplayMetadata;
  replaySource?: ArenaVirtualSimulationReplaySource;
  metadata?: ArenaPreviewBoundaryMetadata;
  createdAt: string;
}

export interface ArenaVirtualSimulationReplaySource {
  version: 'arena-virtual-preview-v1';
  artifact: ControllerArtifact;
  experiment: StoredArenaBlackBoxExperiment;
}

export interface ArenaPreviewBoundaryMetadata {
  evaluationVisibility: 'preview';
  officialEligible: false;
  modelRelation?: string;
  teachingSemantics?: string;
  prohibitsMixedClaims?: true;
  executor?: 'server';
  authoritySource?: 'control-engine-server-facade';
  datasetHash: string;
  controllerHash: string;
  identificationModelId?: string;
  sourceExperimentId?: string;
  runContract?: ReturnType<typeof projectArenaPreviewIdentity>;
}

export interface StoredArenaVirtualSimulationRun {
  id: string;
  userId: string;
  taskId: string;
  datasetHash: string;
  controllerHash: string;
  scenarioId: string;
  simulationRunId?: string | null;
  preview: ArenaVirtualSimulationPreviewRun;
  createdAt: string;
}

export interface ArenaVirtualSimulationRunStore {
  createRun(input: Omit<StoredArenaVirtualSimulationRun, 'id'>): Promise<StoredArenaVirtualSimulationRun>;
}

export class ArenaVirtualSimulationRunInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArenaVirtualSimulationRunInputError';
  }
}

function round(value: number, scale = 1000): number {
  return Math.round(value * scale) / scale;
}

function numberParam(artifact: ControllerArtifact, key: string): number {
  const value = artifact.params[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ArenaVirtualSimulationRunInputError(`${key} must be a finite number.`);
  }
  return value;
}

function stringParam(artifact: ControllerArtifact | undefined, key: string): string | undefined {
  const value = artifact?.params[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function getArenaPreviewBoundaryMetadata(
  preview: ArenaVirtualSimulationPreviewRun,
): ArenaPreviewBoundaryMetadata {
  const existing = preview.metadata;
  const artifact = preview.replaySource?.artifact;

  return {
    evaluationVisibility: 'preview',
    officialEligible: false,
    modelRelation: existing?.modelRelation ?? 'surrogate',
    teachingSemantics: existing?.teachingSemantics ?? ARENA_PREVIEW_TEACHING_SEMANTICS,
    prohibitsMixedClaims: true,
    executor: 'server',
    authoritySource: 'control-engine-server-facade',
    datasetHash: existing?.datasetHash ?? preview.datasetHash,
    controllerHash: existing?.controllerHash ?? preview.controllerHash,
    identificationModelId: existing?.identificationModelId ?? stringParam(artifact, 'identificationModelId'),
    sourceExperimentId: existing?.sourceExperimentId ?? preview.replaySource?.experiment.id,
  };
}

function previewChecksumPayload(preview: ArenaVirtualSimulationPreviewRun) {
  if (!preview.replay) {
    throw new Error('Arena preview replay metadata is missing.');
  }
  return {
    taskId: preview.taskId,
    datasetHash: preview.datasetHash,
    controllerHash: preview.controllerHash,
    scenarioId: preview.scenarioId,
    trace: preview.trace,
    summary: preview.summary,
    replay: {
      sceneId: preview.replay.sceneId,
      scenarioId: preview.replay.scenarioId,
      seed: preview.replay.seed,
      protocolVersion: preview.replay.protocolVersion,
      runtimeVersion: preview.replay.runtimeVersion,
      modelVersion: preview.replay.modelVersion,
    },
  };
}

export function computeArenaVirtualSimulationPreviewChecksum(
  preview: ArenaVirtualSimulationPreviewRun,
): string {
  return computeReplayChecksum(previewChecksumPayload(preview));
}

async function getOwnedExperiment(input: {
  userId: string;
  taskId: string;
  artifact: ControllerArtifact;
  blackBoxExperimentStore: ArenaBlackBoxExperimentStore;
  identificationModelStore: ArenaIdentificationModelStore;
}): Promise<StoredArenaBlackBoxExperiment> {
  if (input.artifact.method !== 'black-box-control') {
    throw new ArenaVirtualSimulationRunInputError('Only black-box control artifacts can run virtual simulation preview.');
  }

  const datasetHash = input.artifact.params.experimentDatasetHash;
  const identificationModelId = input.artifact.params.identificationModelId;

  if (typeof datasetHash !== 'string' || !datasetHash.startsWith('arena-blackbox-dataset-')) {
    throw new ArenaVirtualSimulationRunInputError('Black-box preview requires a persisted experiment dataset.');
  }
  if (typeof identificationModelId !== 'string' || !identificationModelId.trim()) {
    throw new ArenaVirtualSimulationRunInputError('Black-box preview requires a server registered identification model.');
  }

  const registeredModel = await input.identificationModelStore.findOwnedIdentificationModel({
    userId: input.userId,
    taskId: input.taskId,
    modelId: identificationModelId,
  });

  if (!registeredModel) {
    throw new ArenaVirtualSimulationRunInputError('Black-box preview requires a server registered identification model owned by the current student.');
  }
  if (registeredModel.datasetHash !== datasetHash) {
    throw new ArenaVirtualSimulationRunInputError('Black-box preview registered model does not match the experiment dataset.');
  }

  const experiment = await input.blackBoxExperimentStore.findOwnedExperiment({
    userId: input.userId,
    taskId: input.taskId,
    datasetHash,
    experimentId: registeredModel.sourceExperimentId,
  });

  if (!experiment) {
    throw new ArenaVirtualSimulationRunInputError('Black-box experiment dataset does not belong to the current student.');
  }

  return experiment;
}

export function buildArenaVirtualSimulationPreview({
  taskId,
  artifact,
  experiment,
  now = new Date().toISOString(),
}: {
  taskId: string;
  artifact: ControllerArtifact;
  experiment: StoredArenaBlackBoxExperiment;
  now?: string;
}): ArenaVirtualSimulationPreviewRun {
  const controllerGain = numberParam(artifact, 'controllerGain');
  const dampingCompensation = numberParam(artifact, 'dampingCompensation');
  const energyBudget = numberParam(artifact, 'energyBudget');
  const controllerHash = hashControllerArtifact({ ...artifact, taskId });
  const identificationModelId = stringParam(artifact, 'identificationModelId');
  if (!identificationModelId) {
    throw new ArenaVirtualSimulationRunInputError('Black-box preview requires a server registered identification model.');
  }
  const rustResult = computeArenaVirtualPreviewResult({
    modelId: ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
    taskId,
    datasetHash: experiment.datasetHash,
    identificationModelId,
    controllerHash,
    controllerGain,
    dampingCompensation,
    energyBudget,
    initialRoll: experiment.dataset.summary.finalOutput || 0.2,
    sampleTime: 0.2,
    steps: 61,
    modelRelation: 'surrogate',
  });
  const trace = rustResult.trace;
  const trackingError = rustResult.summary.trackingError;
  const maxDeviation = rustResult.summary.maxDeviation;
  const controlEnergy = rustResult.summary.controlEnergy;
  const safetyViolations = rustResult.summary.safetyViolations;
  const smoothness = rustResult.summary.smoothness;

  const replaySource: ArenaVirtualSimulationReplaySource = {
    version: 'arena-virtual-preview-v1',
    artifact,
    experiment,
  };
  const previewWithoutReplay = {
    taskId,
    datasetHash: experiment.datasetHash,
    controllerHash,
    scenarioId: 'cruise-roll-controller-preview',
    trace,
    summary: {
      trackingError: round(trackingError),
      maxDeviation: round(maxDeviation),
      controlEnergy: round(controlEnergy),
      safetyViolations,
      smoothness: round(smoothness),
    },
    createdAt: now,
  };
  const seed = normalizeSeed(
    experiment.dataset.replay?.seed,
    `${experiment.datasetHash}:${controllerHash}:${taskId}:preview`
  );
  const runContext = createSimulationRunContext({
    runId: `arena-preview-${controllerHash.replace('artifact-', '').slice(0, 16)}`,
    sceneId: `arena/${taskId}/virtual-preview`,
    scenarioId: previewWithoutReplay.scenarioId,
    seed,
    runtimeVersion: 'arena-virtual-preview-runtime-v1',
    modelVersion: 'cruise-roll-controller-preview-v1',
  });
  const replay = buildSimulationReplayMetadata(runContext, {
    taskId: previewWithoutReplay.taskId,
    datasetHash: previewWithoutReplay.datasetHash,
    controllerHash: previewWithoutReplay.controllerHash,
    scenarioId: previewWithoutReplay.scenarioId,
    trace: previewWithoutReplay.trace,
    summary: previewWithoutReplay.summary,
  });

  const preview = {
    ...previewWithoutReplay,
    replay: {
      ...replay,
      checksum: computeReplayChecksum({
        taskId: previewWithoutReplay.taskId,
        datasetHash: previewWithoutReplay.datasetHash,
        controllerHash: previewWithoutReplay.controllerHash,
        scenarioId: previewWithoutReplay.scenarioId,
        trace: previewWithoutReplay.trace,
        summary: previewWithoutReplay.summary,
        replay: {
          sceneId: replay.sceneId,
          scenarioId: replay.scenarioId,
          seed: replay.seed,
          protocolVersion: replay.protocolVersion,
          runtimeVersion: replay.runtimeVersion,
          modelVersion: replay.modelVersion,
        },
      }),
    },
    replaySource,
  };

  return {
    ...preview,
    metadata: getArenaPreviewBoundaryMetadata(preview),
  };
}

export async function createArenaVirtualSimulationPreviewRun({
  userId,
  taskId,
  artifact,
  now = new Date().toISOString(),
  blackBoxExperimentStore,
  identificationModelStore,
  runStore,
}: {
  userId: string;
  taskId: string;
  artifact: ControllerArtifact;
  now?: string;
  blackBoxExperimentStore: ArenaBlackBoxExperimentStore;
  identificationModelStore: ArenaIdentificationModelStore;
  runStore: ArenaVirtualSimulationRunStore;
}): Promise<ArenaVirtualSimulationPreviewRun & { id: string; simulationRunId?: string | null }> {
  const experiment = await getOwnedExperiment({
    userId,
    taskId,
    artifact,
    blackBoxExperimentStore,
    identificationModelStore,
  });
  const preview = buildArenaVirtualSimulationPreview({
    taskId,
    artifact,
    experiment,
    now,
  });
  const stored = await runStore.createRun({
    userId,
    taskId,
    datasetHash: preview.datasetHash,
    controllerHash: preview.controllerHash,
    scenarioId: preview.scenarioId,
    preview,
    createdAt: now,
  });

  const storedPreview = {
    ...stored.preview,
    metadata: getArenaPreviewBoundaryMetadata(stored.preview),
  };

  return {
    ...storedPreview,
    id: stored.id,
    simulationRunId: stored.simulationRunId ?? null,
  };
}

function buildArenaPreviewTaskSpec(input: {
  taskId: string;
  preview: ArenaVirtualSimulationPreviewRun;
  classId?: string | null;
}) {
  if (!input.preview.replay) {
    throw new Error('Arena preview replay metadata is missing.');
  }

  return buildSimulationTaskSpec({
    sceneId: input.preview.replay.sceneId,
    scenarioId: input.preview.replay.scenarioId,
    objectives: ['tracking_error', 'max_deviation'],
    constraints: ['control_energy', 'safety_violations', 'smoothness'],
    disturbancePolicy: {
      source: 'arena_blackbox_experiment',
      datasetHash: input.preview.datasetHash,
    },
    evaluationSpecRef: {
      id: 'arena-virtual-preview',
      visibility: 'preview',
    },
    allowedControllers: ['black-box-control'],
    launchContext: input.classId
      ? { classId: input.classId, resourceId: input.taskId }
      : { resourceId: input.taskId },
  });
}

function inferTraceSampleCadence(trace: ArenaVirtualSimulationTracePoint[]): number {
  if (trace.length < 2) return 0;
  return round(trace[1].t - trace[0].t);
}

export const prismaArenaVirtualSimulationRunStore: ArenaVirtualSimulationRunStore = {
  async createRun(input) {
    const row = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({
        where: { id: input.userId },
        select: {
          profile: {
            select: { classId: true },
          },
        },
      });
      const previewRow = await tx.arenaVirtualSimulationRun.create({
        data: {
          userId: input.userId,
          taskId: input.taskId,
          datasetHash: input.datasetHash,
          controllerHash: input.controllerHash,
          scenarioId: input.scenarioId,
          payload: input.preview as unknown as Prisma.InputJsonValue,
          createdAt: new Date(input.createdAt),
        },
      });
      const taskSpec = buildArenaPreviewTaskSpec({
        taskId: input.taskId,
        preview: input.preview,
        classId: owner?.profile?.classId ?? null,
      });
      const taskSpecRow = await tx.simulationTaskSpec.upsert({
        where: { specHash: taskSpec.specHash },
        create: {
          schemaVersion: taskSpec.schemaVersion,
          sceneId: taskSpec.sceneId,
          scenarioId: taskSpec.scenarioId,
          specHash: taskSpec.specHash,
          payload: taskSpec as unknown as Prisma.InputJsonValue,
          launchContext: taskSpec.launchContext as Prisma.InputJsonValue,
        },
        update: {},
      });
      const previewBoundary = getArenaPreviewBoundaryMetadata(input.preview);
      const runContract = projectArenaPreviewIdentity({
        sourceId: previewRow.id,
        ownerUserId: input.userId,
        taskId: input.taskId,
        specHash: taskSpec.specHash,
        artifactHash: input.controllerHash,
        controllerSnapshotRef: input.preview.replaySource?.artifact.id
          ? `ArenaControllerArtifact:${input.preview.replaySource.artifact.id}`
          : `ArenaControllerArtifact:${input.controllerHash}`,
        protocolVersion: input.preview.replay?.protocolVersion ?? '1.0',
        runtimeVersion: input.preview.replay?.runtimeVersion ?? 'unknown',
        modelVersion: input.preview.replay?.modelVersion ?? 'unknown',
        seed: input.preview.replay?.seed ?? null,
        checksum: input.preview.replay?.checksum ?? null,
        summary: {
          trackingError: input.preview.summary.trackingError,
          maxDeviation: input.preview.summary.maxDeviation,
          controlEnergy: input.preview.summary.controlEnergy,
          safetyViolations: input.preview.summary.safetyViolations,
          smoothness: input.preview.summary.smoothness,
        },
        traceRef: `ArenaVirtualSimulationRun:${previewRow.id}#trace`,
      });
      previewBoundary.runContract = runContract;
      const arenaTraining = {
        taskId: input.taskId,
        scenarioId: input.scenarioId,
        evaluationVisibility: previewBoundary.evaluationVisibility,
        officialEligible: previewBoundary.officialEligible,
      };
      const canonicalRunData = {
          ownerUserId: input.userId,
          classId: owner?.profile?.classId ?? null,
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: previewRow.id,
          taskSpecId: taskSpecRow.id,
          taskSpecSnapshot: taskSpec as unknown as Prisma.InputJsonValue,
          controllerSnapshotRef: input.preview.replaySource?.artifact.id
            ? `ArenaControllerArtifact:${input.preview.replaySource.artifact.id}`
            : `ArenaControllerArtifact:${input.controllerHash}`,
          status: 'completed',
          summary: {
            ...input.preview.summary,
            arenaTraining,
            previewBoundary,
          } as unknown as Prisma.InputJsonValue,
          replayToken: input.preview.replay?.checksum ?? null,
          seed: input.preview.replay?.seed ?? null,
          protocolVersion: input.preview.replay?.protocolVersion ?? '1.0',
          runtimeVersion: input.preview.replay?.runtimeVersion ?? 'unknown',
          modelVersion: input.preview.replay?.modelVersion ?? 'unknown',
          sceneSpecVersion: null,
          createdAt: new Date(input.createdAt),
          startedAt: new Date(input.createdAt),
          completedAt: new Date(input.createdAt),
        };
      const canonicalRun = await tx.simulationRun.create({
        data: canonicalRunData,
      });
      const canonicalTraceData = {
          runId: canonicalRun.id,
          protocolVersion: input.preview.replay?.protocolVersion ?? '1.0',
          runtimeVersion: input.preview.replay?.runtimeVersion ?? 'unknown',
          modelVersion: input.preview.replay?.modelVersion ?? 'unknown',
          seed: input.preview.replay?.seed ?? null,
          checksum: input.preview.replay?.checksum ?? computeArenaVirtualSimulationPreviewChecksum(input.preview),
          summaryMetrics: input.preview.summary as unknown as Prisma.InputJsonValue,
          sampleCount: input.preview.trace.length,
          sampleCadence: inferTraceSampleCadence(input.preview.trace),
          sampleStorageUri: `ArenaVirtualSimulationRun:${previewRow.id}#trace`,
        };
      const canonicalTrace = await tx.simulationTrace.create({
        data: canonicalTraceData,
      });
      await persistSimulationAgentEvidenceMaterialization(
        {
          learningFact: tx.learningFact,
          learningEvidenceDraft: tx.learningEvidenceDraft,
          evidenceOutbox: tx.evidenceOutbox,
        },
        {
          simulationRuns: [
            {
              run: {
                id: canonicalRun.id,
                ...canonicalRunData,
              },
              trace: {
                id: canonicalTrace.id,
                ...canonicalTraceData,
              },
            },
          ],
        },
      );

      return tx.arenaVirtualSimulationRun.update({
        where: { id: previewRow.id },
        data: { simulationRunId: canonicalRun.id },
      });
    });

    return {
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      datasetHash: row.datasetHash,
      controllerHash: row.controllerHash,
      scenarioId: row.scenarioId,
      simulationRunId: row.simulationRunId,
      preview: row.payload as unknown as ArenaVirtualSimulationPreviewRun,
      createdAt: row.createdAt.toISOString(),
    };
  },
};
