export type RandomNumberGenerator = () => number;

export interface SimulationRunContext {
  runId: string;
  sceneId: string;
  scenarioId: string;
  seed: number;
  protocolVersion: '1.0';
  runtimeVersion: string;
  modelVersion: string;
}

export interface SimulationReplayMetadata extends SimulationRunContext {
  checksum: string;
}

export interface SeededRng {
  readonly seed: number;
  readonly stream: string;
  next: RandomNumberGenerator;
  range: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
  fork: (stream: string) => SeededRng;
}

export const SIMULATION_PROTOCOL_VERSION = '1.0' as const;
export const DEFAULT_SIMULATION_RUNTIME_VERSION = 'simulation-runtime-v1';
export const DEFAULT_SIMULATION_MODEL_VERSION = 'simulation-model-v1';

function hashStringToUint32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizeSeed(seed: number | string | undefined, fallback: string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  if (typeof seed === 'string' && seed.trim()) {
    return hashStringToUint32(seed.trim());
  }
  return hashStringToUint32(fallback);
}

export function createSeededRng(seed: number | string, stream = 'default'): SeededRng {
  const normalizedSeed = normalizeSeed(seed, stream);
  let state = hashStringToUint32(`${normalizedSeed}:${stream}`);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed: normalizedSeed,
    stream,
    next,
    range(min, max) {
      return next() * (max - min) + min;
    },
    chance(probability) {
      return next() < probability;
    },
    fork(childStream) {
      return createSeededRng(normalizedSeed, `${stream}/${childStream}`);
    },
  };
}

export function createSimulationRunContext(input: {
  runId: string;
  sceneId: string;
  scenarioId: string;
  seed?: number | string;
  protocolVersion?: '1.0';
  runtimeVersion?: string;
  modelVersion?: string;
}): SimulationRunContext {
  return {
    runId: input.runId,
    sceneId: input.sceneId,
    scenarioId: input.scenarioId,
    seed: normalizeSeed(input.seed, `${input.sceneId}:${input.scenarioId}:${input.runId}`),
    protocolVersion: input.protocolVersion ?? SIMULATION_PROTOCOL_VERSION,
    runtimeVersion: input.runtimeVersion ?? DEFAULT_SIMULATION_RUNTIME_VERSION,
    modelVersion: input.modelVersion ?? DEFAULT_SIMULATION_MODEL_VERSION,
  };
}

export function createSimulationRng(
  context: SimulationRunContext,
  stream: string,
): SeededRng {
  return createSeededRng(context.seed, `${context.sceneId}/${context.scenarioId}/${stream}`);
}
