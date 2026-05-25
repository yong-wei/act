import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  createSimulationRunContext,
  normalizeSeed,
  type SimulationReplayMetadata,
} from '@/resources/simulations/core/seeded-rng';
import {
  buildSimulationReplayMetadata,
  computeReplayChecksum,
} from '@/resources/simulations/lib/replay-checksum';

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
  createdAt: string;
}

export interface ArenaVirtualSimulationReplaySource {
  version: 'arena-virtual-preview-v1';
  artifact: ControllerArtifact;
  experiment: StoredArenaBlackBoxExperiment;
}

export interface StoredArenaVirtualSimulationRun {
  id: string;
  userId: string;
  taskId: string;
  datasetHash: string;
  controllerHash: string;
  scenarioId: string;
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
  const sampleTime = 0.2;
  const trace: ArenaVirtualSimulationTracePoint[] = [];
  let roll = experiment.dataset.summary.finalOutput || 0.2;
  let rollRate = 0;
  let previousControl = 0;
  let controlEnergy = 0;
  let controlDelta = 0;
  let safetyViolations = 0;

  for (let index = 0; index <= 60; index += 1) {
    const t = round(index * sampleTime);
    const reference = 0;
    const wave = 0.06 * Math.sin(0.8 * t + 0.5) + 0.025 * Math.sin(2.3 * t);
    const rawControl = -controllerGain * (roll - reference) - dampingCompensation * rollRate;
    const limit = Math.max(0.5, Math.min(energyBudget / 3, 6));
    const control = Math.max(-limit, Math.min(limit, rawControl));
    const acceleration = -0.72 * rollRate - 1.18 * roll + 0.68 * control + wave;
    rollRate += acceleration * sampleTime;
    roll += rollRate * sampleTime;
    controlEnergy += control * control * sampleTime;
    controlDelta += Math.abs(control - previousControl);
    previousControl = control;
    if (Math.abs(roll) > 0.75) safetyViolations += 1;

    trace.push({
      t,
      reference,
      output: round(roll),
      control: round(control),
    });
  }

  const trackingError = trace.reduce((sum, point) => sum + Math.abs(point.output - point.reference), 0) / trace.length;
  const maxDeviation = Math.max(...trace.map((point) => Math.abs(point.output - point.reference)));
  const smoothness = Math.max(0, 1 - controlDelta / Math.max(1, trace.length * 2));

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

  return {
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
}): Promise<ArenaVirtualSimulationPreviewRun & { id: string }> {
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

  return {
    ...stored.preview,
    id: stored.id,
  };
}

export const prismaArenaVirtualSimulationRunStore: ArenaVirtualSimulationRunStore = {
  async createRun(input) {
    const row = await prisma.arenaVirtualSimulationRun.create({
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

    return {
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      datasetHash: row.datasetHash,
      controllerHash: row.controllerHash,
      scenarioId: row.scenarioId,
      preview: row.payload as unknown as ArenaVirtualSimulationPreviewRun,
      createdAt: row.createdAt.toISOString(),
    };
  },
};
