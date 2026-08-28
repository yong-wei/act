import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import type { RustSimulationRequest, RustSimulationResult } from '@/resources/interactive-learning/control-odyssey/engine/rust-runtime-adapter';

import {
  assertFiniteTree,
  canonicalRequestHash,
  ControlEngineFailure,
  identifiedClaimWithoutParameters,
  mapFailure,
  newRequestId,
  okEnvelope,
  rejectClientResultFields,
} from './envelope';
import { readGeneratedPackageIdentity } from './identity';
import {
  ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
  ARENA_PREVIEW_TEACHING_SEMANTICS,
  type ArenaCruiseRollPreviewRequest,
  type ArenaCruiseRollPreviewResult,
  type ControlEngineEnvelope,
  type ControlEngineModelRelation,
} from './types';
import { getControlEngineWasmPath, invokeServerWasm, preloadServerControlEngine } from './wasm-server';

export { getControlEngineWasmPath, preloadServerControlEngine, readGeneratedPackageIdentity };
export { rejectClientResultFields };

function parseWasmJson<TResult>(exportName: Parameters<typeof invokeServerWasm>[0], request: unknown, label: string): TResult {
  readGeneratedPackageIdentity();
  const payload = JSON.parse(invokeServerWasm(exportName, JSON.stringify(request))) as TResult;
  assertFiniteTree(payload, label);
  return payload;
}

export async function computeAnalysisServer(
  request: ControlAnalysisRequest | { runtimeMode?: string },
): Promise<ControlEngineEnvelope<ControlAnalysisResult>> {
  try {
    const runtimeMode = 'runtimeMode' in request ? request.runtimeMode : 'analysis';
    const exportName = runtimeMode === 'nonlinear_analysis' ? 'compute_nonlinear_analysis' : 'compute_analysis';
    const capability = runtimeMode === 'nonlinear_analysis' ? 'computeNonlinearAnalysis' : 'computeAnalysis';
    const result = parseWasmJson<ControlAnalysisResult>(exportName, request, capability);
    return okEnvelope({
      capability,
      executor: 'server',
      requestId: newRequestId(),
      canonicalRequestHash: await canonicalRequestHash(request),
      result,
      persisted: false,
    });
  } catch (error) {
    throw mapFailure(error, 'unavailable');
  }
}

export function computeControlAnalysisServer(
  request: ControlAnalysisRequest | { runtimeMode?: string },
): ControlAnalysisResult {
  const runtimeMode = 'runtimeMode' in request ? request.runtimeMode : 'analysis';
  const exportName = runtimeMode === 'nonlinear_analysis' ? 'compute_nonlinear_analysis' : 'compute_analysis';
  return parseWasmJson<ControlAnalysisResult>(exportName, request, 'computeAnalysis');
}

export function computeControlOdysseyServerStep(request: RustSimulationRequest): RustSimulationResult {
  return parseWasmJson<RustSimulationResult>('compute_simulation_step', request, 'computeSimulationStep');
}

export function computeVirtualSimulationServerStep<TResult>(request: unknown): TResult {
  return parseWasmJson<TResult>('compute_virtual_simulation_step', request, 'computeVirtualSimulationStep');
}

export function computeRlTrainingServer<TResult>(request: unknown): TResult {
  return parseWasmJson<TResult>('compute_rl_training', request, 'computeRlTraining');
}

export function computeArenaVirtualPreviewResult(
  request: ArenaCruiseRollPreviewRequest,
): ArenaCruiseRollPreviewResult {
  if (identifiedClaimWithoutParameters(request.modelRelation, request.authorizedModelParameters)) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'identified-without-authorized-parameters',
      message: 'Identified control-engine capabilities require authorized model parameters consumed by Rust.',
      retryable: false,
    });
  }
  const result = parseWasmJson<ArenaCruiseRollPreviewResult>(
    'compute_virtual_simulation_step',
    request,
    'computeArenaVirtualPreview',
  );
  if (result.identity.taskId !== request.taskId
    || result.identity.datasetHash !== request.datasetHash
    || result.identity.identificationModelId !== request.identificationModelId
    || result.identity.controllerHash !== request.controllerHash) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'identity-not-consumed',
      message: 'Arena preview identity was not consumed by the Rust capability.',
      retryable: false,
    });
  }
  return result;
}

export async function computeArenaVirtualPreview(
  request: ArenaCruiseRollPreviewRequest,
): Promise<ControlEngineEnvelope<ArenaCruiseRollPreviewResult>> {
  try {
    const result = computeArenaVirtualPreviewResult(request);
    if (result.identity.taskId !== request.taskId
      || result.identity.datasetHash !== request.datasetHash
      || result.identity.identificationModelId !== request.identificationModelId
      || result.identity.controllerHash !== request.controllerHash) {
      throw new ControlEngineFailure({
        state: 'unavailable',
        category: 'identity-not-consumed',
        message: 'Arena preview identity was not consumed by the Rust capability.',
        retryable: false,
      });
    }
    const modelRelation: ControlEngineModelRelation = result.modelRelation === 'identified' ? 'identified' : 'surrogate';
    return okEnvelope({
      capability: 'computeArenaVirtualPreview',
      executor: 'server',
      requestId: newRequestId(),
      canonicalRequestHash: await canonicalRequestHash({
        modelId: ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID,
        taskId: request.taskId,
        datasetHash: request.datasetHash,
        identificationModelId: request.identificationModelId,
        controllerHash: request.controllerHash,
        controllerGain: request.controllerGain,
        dampingCompensation: request.dampingCompensation,
        energyBudget: request.energyBudget,
        initialRoll: request.initialRoll,
        modelRelation,
      }),
      result,
      persisted: false,
      modelRelation,
      teachingSemantics: ARENA_PREVIEW_TEACHING_SEMANTICS,
    });
  } catch (error) {
    throw mapFailure(error, 'unavailable');
  }
}
