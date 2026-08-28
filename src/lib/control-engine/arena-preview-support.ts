import { ControlEngineFailure } from './envelope';
import {
  ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
  type ArenaCruiseRollPreviewRequest,
  type ArenaCruiseRollPreviewResult,
  type ControlEngineCapability,
  type ControlEngineExecutor,
  type ControlEngineModelRelation,
} from './types';

export const ARENA_PREVIEW_PROTOCOL_VERSION = 'arena-preview-control-engine/v1' as const;
export const ARENA_CRUISE_ROLL_PREVIEW_SAMPLE_TIME = 0.2 as const;
export const ARENA_CRUISE_ROLL_PREVIEW_STEPS = 61 as const;

export const ARENA_CRUISE_ROLL_SURROGATE_PLANT = {
  plantDamping: 0.72,
  plantStiffness: 1.18,
  plantInputGain: 0.68,
} as const;

export const ARENA_CRUISE_ROLL_IDENTIFIED_PARAMETER_KEYS = [
  'plantDamping',
  'plantStiffness',
  'plantInputGain',
] as const;

export const ARENA_PREVIEW_TOLERANCE = {
  absolute: 1e-6,
  relative: 1e-3,
} as const;

export type ArenaPreviewMethod =
  | 'black-box-control'
  | 'pid'
  | 'serial-compensator'
  | 'composite-compensation'
  | 'optimized-pid'
  | 'mpc'
  | 'code-controller';

export interface ArenaPreviewPlantParameters {
  readonly plantDamping: number;
  readonly plantStiffness: number;
  readonly plantInputGain: number;
}

export interface ArenaPreviewCapability {
  readonly method: ArenaPreviewMethod;
  readonly supportedByControlEngine: boolean;
  readonly modelId: string | null;
  readonly capability: ControlEngineCapability | null;
  readonly executor: ControlEngineExecutor | 'none';
  readonly reason?: string;
}

export const ARENA_PREVIEW_CAPABILITY_MATRIX: readonly ArenaPreviewCapability[] = [
  {
    method: 'black-box-control',
    supportedByControlEngine: true,
    modelId: ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
    capability: 'computeArenaVirtualPreview',
    executor: 'server',
  },
  {
    method: 'pid',
    supportedByControlEngine: true,
    modelId: 'control_analysis',
    capability: 'computeAnalysis',
    executor: 'browser',
  },
  {
    method: 'serial-compensator',
    supportedByControlEngine: true,
    modelId: 'control_analysis',
    capability: 'computeAnalysis',
    executor: 'browser',
  },
  {
    method: 'composite-compensation',
    supportedByControlEngine: false,
    modelId: null,
    capability: null,
    executor: 'none',
    reason: 'No registered Rust preview capability; official template-whitebox-v1 is not a preview substitute.',
  },
  {
    method: 'optimized-pid',
    supportedByControlEngine: false,
    modelId: null,
    capability: null,
    executor: 'none',
    reason: 'No registered Rust preview capability; official template-whitebox-v1 is not a preview substitute.',
  },
  {
    method: 'mpc',
    supportedByControlEngine: false,
    modelId: null,
    capability: null,
    executor: 'none',
    reason: 'No registered Rust preview capability; official template-whitebox-v1 is not a preview substitute.',
  },
  {
    method: 'code-controller',
    supportedByControlEngine: false,
    modelId: null,
    capability: null,
    executor: 'none',
    reason: 'Code-controller preview is not a Control Engine numeric capability.',
  },
] as const;

export function getArenaPreviewCapability(method: string): ArenaPreviewCapability | undefined {
  return ARENA_PREVIEW_CAPABILITY_MATRIX.find((entry) => entry.method === method);
}

export function isSupportedArenaPreviewMethod(method: string): boolean {
  return getArenaPreviewCapability(method)?.supportedByControlEngine === true;
}

export function assertSupportedArenaPreviewMethod(method: string): ArenaPreviewCapability {
  const capability = getArenaPreviewCapability(method);
  if (!capability?.supportedByControlEngine || !capability.capability) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'unsupported-preview-method',
      message: capability?.reason
        ?? '当前方法没有受支持的 Control Engine 预览能力，工作台不会使用模板数值替代。',
      retryable: false,
    });
  }
  return capability;
}

function requiredFiniteParameter(
  parameters: Record<string, number> | null | undefined,
  key: (typeof ARENA_CRUISE_ROLL_IDENTIFIED_PARAMETER_KEYS)[number],
): number {
  const value = parameters?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'identified-without-authorized-parameters',
      message: `Identified control-engine capabilities require authorized ${key} consumed by Rust.`,
      retryable: false,
    });
  }
  return value;
}

export function resolveArenaCruiseRollPlantParameters(
  request: Pick<ArenaCruiseRollPreviewRequest, 'modelRelation' | 'authorizedModelParameters'>,
): ArenaPreviewPlantParameters {
  if (request.modelRelation !== 'identified') {
    return ARENA_CRUISE_ROLL_SURROGATE_PLANT;
  }
  return {
    plantDamping: requiredFiniteParameter(request.authorizedModelParameters, 'plantDamping'),
    plantStiffness: requiredFiniteParameter(request.authorizedModelParameters, 'plantStiffness'),
    plantInputGain: requiredFiniteParameter(request.authorizedModelParameters, 'plantInputGain'),
  };
}

export function arenaPreviewCanonicalRequest(request: ArenaCruiseRollPreviewRequest) {
  const plant = resolveArenaCruiseRollPlantParameters(request);
  return {
    modelId: request.modelId,
    taskId: request.taskId,
    datasetHash: request.datasetHash,
    identificationModelId: request.identificationModelId,
    controllerHash: request.controllerHash,
    controllerGain: request.controllerGain,
    dampingCompensation: request.dampingCompensation,
    energyBudget: request.energyBudget,
    initialRoll: request.initialRoll,
    sampleTime: request.sampleTime,
    steps: request.steps,
    modelRelation: request.modelRelation,
    ...plant,
  };
}

export function assertArenaPreviewIdentityConsumed(
  request: ArenaCruiseRollPreviewRequest,
  result: ArenaCruiseRollPreviewResult,
): void {
  const plant = resolveArenaCruiseRollPlantParameters(request);
  const expectedRelation: ControlEngineModelRelation = request.modelRelation === 'identified' ? 'identified' : 'surrogate';
  if (
    result.identity.taskId !== request.taskId
    || result.identity.datasetHash !== request.datasetHash
    || result.identity.identificationModelId !== request.identificationModelId
    || result.identity.controllerHash !== request.controllerHash
    || result.identity.plantDamping !== plant.plantDamping
    || result.identity.plantStiffness !== plant.plantStiffness
    || result.identity.plantInputGain !== plant.plantInputGain
    || result.modelRelation !== expectedRelation
  ) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'identity-not-consumed',
      message: 'Arena preview identity was not consumed by the Rust capability.',
      retryable: false,
    });
  }
}
