import { createHash } from 'node:crypto';

import {
  createSeededRng,
  createSimulationRunContext,
  normalizeSeed,
  type RandomNumberGenerator,
  type SimulationReplayMetadata,
} from '@/resources/simulations/core/seeded-rng';
import { buildSimulationReplayMetadata } from '@/resources/simulations/lib/replay-checksum';
import {
  getArenaChallengeObject,
  getArenaChallengeTask,
} from '../data/seed-challenges';

export type ArenaBlackBoxSignalType = 'step' | 'impulse' | 'prbs' | 'sine';

export interface ArenaBlackBoxExperimentInput {
  signalType: ArenaBlackBoxSignalType;
  amplitude: number;
  duration: number;
  sampleTime: number;
  initialRoll?: number;
  disturbanceLevel?: number;
  scenarioId?: string;
  seed?: number | string;
}

export interface ArenaBlackBoxExperimentSample {
  t: number;
  input: number;
  output: number;
}

export interface ArenaBlackBoxExperimentDataset {
  taskId: string;
  objectId: string;
  datasetHash: string;
  scenarioId: string;
  signalType: ArenaBlackBoxSignalType;
  sampleTime: number;
  duration: number;
  budgetCost: number;
  samples: ArenaBlackBoxExperimentSample[];
  replay?: SimulationReplayMetadata;
  summary: {
    peakOutput: number;
    finalOutput: number;
    meanAbsOutput: number;
    inputEnergy: number;
    dataQuality: number;
  };
  createdAt: string;
}

export interface ArenaIdentificationArtifactReference {
  modelId: string;
  taskId: string;
  datasetHash: string;
  modelType: 'second-order-fit';
  validationFit: number;
  createdAt: string;
}

const allowedSignalTypes = new Set<ArenaBlackBoxSignalType>(['step', 'impulse', 'prbs', 'sine']);

function assertFiniteInRange(name: string, value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be finite and between ${min} and ${max}.`);
  }
  return value;
}

function round(value: number, scale = 1000): number {
  return Math.round(value * scale) / scale;
}

function inputValue(
  signalType: ArenaBlackBoxSignalType,
  amplitude: number,
  t: number,
  sampleTime: number,
  rng: RandomNumberGenerator,
): number {
  if (signalType === 'step') return t >= sampleTime ? amplitude : 0;
  if (signalType === 'impulse') return t < sampleTime ? amplitude / sampleTime : 0;
  if (signalType === 'sine') return amplitude * Math.sin(2 * Math.PI * 0.25 * t);

  return rng() >= 0.5 ? amplitude : -amplitude;
}

function hashDataset(payload: Omit<ArenaBlackBoxExperimentDataset, 'datasetHash' | 'createdAt'>): string {
  const digest = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 24);
  return `arena-blackbox-dataset-${digest}`;
}

export function runArenaBlackBoxExperiment({
  taskId,
  input,
  now = new Date().toISOString(),
}: {
  taskId: string;
  input: ArenaBlackBoxExperimentInput;
  now?: string;
}): ArenaBlackBoxExperimentDataset {
  const task = getArenaChallengeTask(taskId);
  if (!task) {
    throw new Error(`Unknown arena task: ${taskId}`);
  }

  const object = getArenaChallengeObject(task.objectId);
  if (!object || object.visibility !== 'black-box' || object.adapterType !== 'virtual-simulation') {
    throw new Error(`Arena task ${task.id} is not a black-box virtual simulation task.`);
  }

  if (!allowedSignalTypes.has(input.signalType)) {
    throw new Error(`Unsupported black-box experiment signal: ${input.signalType}`);
  }

  const amplitude = assertFiniteInRange('amplitude', input.amplitude, 0.05, 2);
  const duration = assertFiniteInRange('duration', input.duration, 3, 30);
  const sampleTime = assertFiniteInRange('sampleTime', input.sampleTime, 0.1, 1);
  const initialRoll = assertFiniteInRange('initialRoll', input.initialRoll ?? 0, -0.8, 0.8);
  const disturbanceLevel = assertFiniteInRange('disturbanceLevel', input.disturbanceLevel ?? 0.2, 0, 1);
  const sampleCount = Math.floor(duration / sampleTime) + 1;
  const scenarioId = input.scenarioId ?? 'cruise-roll-public-identification';
  const seed = normalizeSeed(
    input.seed,
    `${task.id}:${scenarioId}:${input.signalType}:${amplitude}:${duration}:${sampleTime}:${initialRoll}:${disturbanceLevel}`
  );
  const rng = createSeededRng(seed, `arena-blackbox/${task.id}/${scenarioId}/${input.signalType}`);

  if (sampleCount > 260) {
    throw new Error('Black-box experiment sample count exceeds 260.');
  }

  const samples: ArenaBlackBoxExperimentSample[] = [];
  let roll = initialRoll;
  let rollRate = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const t = round(index * sampleTime);
    const u = inputValue(input.signalType, amplitude, t, sampleTime, rng.next);
    const wave = disturbanceLevel * 0.08 * Math.sin(0.7 * t + 0.4) +
      disturbanceLevel * 0.035 * Math.sin(1.9 * t);
    const acceleration = -0.62 * rollRate - 1.32 * roll + 0.74 * u + wave;
    rollRate += acceleration * sampleTime;
    roll += rollRate * sampleTime;

    samples.push({
      t,
      input: round(u),
      output: round(roll),
    });
  }

  const outputs = samples.map((sample) => sample.output);
  const inputs = samples.map((sample) => sample.input);
  const peakOutput = Math.max(...outputs.map((value) => Math.abs(value)));
  const finalOutput = outputs[outputs.length - 1] ?? 0;
  const meanAbsOutput = outputs.reduce((sum, value) => sum + Math.abs(value), 0) / outputs.length;
  const inputEnergy = inputs.reduce((sum, value) => sum + (value * value * sampleTime), 0);
  const dataQuality = Math.max(0.1, Math.min(1, 0.45 + duration / 40 + amplitude / 6 - disturbanceLevel / 8));
  const budgetCost = Math.max(1, Math.ceil(duration / 10));

  const payloadWithoutReplay = {
    taskId: task.id,
    objectId: object.id,
    scenarioId,
    signalType: input.signalType,
    sampleTime,
    duration,
    budgetCost,
    samples,
    summary: {
      peakOutput: round(peakOutput),
      finalOutput: round(finalOutput),
      meanAbsOutput: round(meanAbsOutput),
      inputEnergy: round(inputEnergy),
      dataQuality: round(dataQuality),
    },
  };
  const runContext = createSimulationRunContext({
    runId: `arena-blackbox-${task.id}-${scenarioId}`,
    sceneId: `arena/${task.id}/public-experiment`,
    scenarioId,
    seed,
    runtimeVersion: 'arena-blackbox-runtime-v1',
    modelVersion: 'cruise-roll-blackbox-public-v1',
  });
  const replay = buildSimulationReplayMetadata(runContext, payloadWithoutReplay);
  const payload = {
    ...payloadWithoutReplay,
    replay,
  };

  return {
    ...payload,
    datasetHash: hashDataset(payload),
    createdAt: now,
  };
}

export function buildIdentificationArtifactFromExperiment(
  dataset: ArenaBlackBoxExperimentDataset,
  now = new Date().toISOString(),
): ArenaIdentificationArtifactReference {
  return {
    modelId: `arena-identification-${dataset.datasetHash.replace('arena-blackbox-dataset-', '').slice(0, 12)}`,
    taskId: dataset.taskId,
    datasetHash: dataset.datasetHash,
    modelType: 'second-order-fit',
    validationFit: dataset.summary.dataQuality,
    createdAt: now,
  };
}
