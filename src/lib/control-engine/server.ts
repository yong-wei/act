import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import type { RustSimulationRequest, RustSimulationResult } from '@/resources/interactive-learning/control-odyssey/engine/rust-runtime-adapter';

import {
  assertFiniteTree,
  canonicalRequestHash,
  mapFailure,
  newRequestId,
  okEnvelope,
  rejectClientResultFields,
} from './envelope';
import { readGeneratedPackageIdentity } from './identity';
import {
  arenaPreviewCanonicalRequest,
  assertArenaPreviewIdentityConsumed,
  assertArenaPreviewSummaryWithinBaseline,
  resolveArenaCruiseRollPlantParameters,
} from './arena-preview-support';
import {
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
  resolveArenaCruiseRollPlantParameters(request);
  const result = parseWasmJson<ArenaCruiseRollPreviewResult>(
    'compute_virtual_simulation_step',
    request,
    'computeArenaVirtualPreview',
  );
  assertArenaPreviewIdentityConsumed(request, result);
  assertArenaPreviewSummaryWithinBaseline(request, result.summary);
  return result;
}

export async function computeArenaVirtualPreview(
  request: ArenaCruiseRollPreviewRequest,
): Promise<ControlEngineEnvelope<ArenaCruiseRollPreviewResult>> {
  try {
    const result = computeArenaVirtualPreviewResult(request);
    assertArenaPreviewIdentityConsumed(request, result);
    const modelRelation: ControlEngineModelRelation = result.modelRelation === 'identified' ? 'identified' : 'surrogate';
    return okEnvelope({
      capability: 'computeArenaVirtualPreview',
      executor: 'server',
      requestId: newRequestId(),
      canonicalRequestHash: await canonicalRequestHash(arenaPreviewCanonicalRequest(request)),
      result,
      persisted: false,
      modelRelation,
      teachingSemantics: ARENA_PREVIEW_TEACHING_SEMANTICS,
    });
  } catch (error) {
    throw mapFailure(error, 'unavailable');
  }
}
