import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import type { RustSimulationRequest, RustSimulationResult } from '@/resources/interactive-learning/control-odyssey/engine/rust-runtime-adapter';

import {
  assertFiniteTree,
  canonicalRequestHash,
  ControlEngineFailure,
  mapFailure,
  newRequestId,
  okEnvelope,
} from './envelope';
import {
  DEFAULT_ANALYSIS_TIMEOUT_MS,
  ARENA_PREVIEW_TEACHING_SEMANTICS,
  type ArenaCruiseRollPreviewRequest,
  type ArenaCruiseRollPreviewResult,
  type ControlEngineCapability,
  type ControlEngineEnvelope,
  type ControlEngineExecutor,
} from './types';
import {
  arenaPreviewCanonicalRequest,
  assertArenaPreviewIdentityConsumed,
  resolveArenaCruiseRollPlantParameters,
} from './arena-preview-support';
import { ensureBrowserControlEngine, invokeBrowserWasm, isBrowserControlEngineReady, preloadBrowserControlEngine } from './wasm-browser';

export { isBrowserControlEngineReady, preloadBrowserControlEngine };

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new ControlEngineFailure({
            state: 'timeout',
            category: 'timeout',
            message: 'Control engine request timed out before a ready WASM result.',
            retryable: true,
          }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function invokeJson<TResult>(input: {
  exportName: 'compute_analysis' | 'compute_nonlinear_analysis' | 'compute_rl_training' | 'compute_simulation_step' | 'compute_virtual_simulation_step';
  capability: ControlEngineCapability;
  request: unknown;
  executor: ControlEngineExecutor;
  timeoutMs?: number;
  requestId?: string;
}): Promise<ControlEngineEnvelope<TResult>> {
  const requestId = input.requestId ?? newRequestId();
  const requestJson = JSON.stringify(input.request);
  try {
    const result = await withTimeout((async () => {
      await ensureBrowserControlEngine();
      const payload = JSON.parse(invokeBrowserWasm(input.exportName, requestJson)) as TResult;
      assertFiniteTree(payload, input.capability);
      return payload;
    })(), input.timeoutMs ?? DEFAULT_ANALYSIS_TIMEOUT_MS);

    return okEnvelope({
      capability: input.capability,
      executor: input.executor,
      requestId,
      canonicalRequestHash: await canonicalRequestHash(input.request),
      result,
      persisted: false,
    });
  } catch (error) {
    throw mapFailure(error);
  }
}

export async function computeAnalysisBrowser(
  request: ControlAnalysisRequest | { runtimeMode?: string },
  options?: { executor?: ControlEngineExecutor; timeoutMs?: number; requestId?: string },
): Promise<ControlEngineEnvelope<ControlAnalysisResult>> {
  const runtimeMode = 'runtimeMode' in request ? request.runtimeMode : 'analysis';
  const exportName = runtimeMode === 'nonlinear_analysis' ? 'compute_nonlinear_analysis' : 'compute_analysis';
  const capability = runtimeMode === 'nonlinear_analysis' ? 'computeNonlinearAnalysis' : 'computeAnalysis';
  return invokeJson({
    exportName,
    capability,
    request,
    executor: options?.executor ?? 'browser',
    timeoutMs: options?.timeoutMs,
    requestId: options?.requestId,
  });
}

export async function computeSimulationStepBrowser(
  request: RustSimulationRequest,
): Promise<ControlEngineEnvelope<RustSimulationResult>> {
  const envelope = await invokeJson<RustSimulationResult>({
    exportName: 'compute_simulation_step',
    capability: 'computeSimulationStep',
    request,
    executor: 'browser',
  });
  return envelope;
}

export function computeSimulationStepBrowserSync(request: RustSimulationRequest): RustSimulationResult {
  if (!isBrowserControlEngineReady()) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-not-ready',
      message: '控制奥德赛 Rust 仿真内核尚未加载完成。',
      retryable: true,
    });
  }
  const result = JSON.parse(invokeBrowserWasm('compute_simulation_step', JSON.stringify(request))) as RustSimulationResult;
  assertFiniteTree(result, 'computeSimulationStep');
  return result;
}

export function computeVirtualSimulationStepBrowserSync<TResult>(request: unknown): TResult {
  if (!isBrowserControlEngineReady()) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-not-ready',
      message: '虚拟仿真数值内核尚未加载完成。',
      retryable: true,
    });
  }
  const result = JSON.parse(invokeBrowserWasm('compute_virtual_simulation_step', JSON.stringify(request))) as TResult;
  assertFiniteTree(result, 'computeVirtualSimulationStep');
  return result;
}

export async function computeRlTrainingBrowser<TResult>(
  request: unknown,
): Promise<ControlEngineEnvelope<TResult>> {
  return invokeJson({
    exportName: 'compute_rl_training',
    capability: 'computeRlTraining',
    request,
    executor: 'browser',
  });
}

export function computeArenaVirtualPreviewBrowserSync(
  request: ArenaCruiseRollPreviewRequest,
): ArenaCruiseRollPreviewResult {
  if (!isBrowserControlEngineReady()) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-not-ready',
      message: 'Arena 预览数值内核尚未加载完成。',
      retryable: true,
    });
  }
  resolveArenaCruiseRollPlantParameters(request);
  const result = JSON.parse(
    invokeBrowserWasm('compute_virtual_simulation_step', JSON.stringify(request)),
  ) as ArenaCruiseRollPreviewResult;
  assertFiniteTree(result, 'computeArenaVirtualPreview');
  assertArenaPreviewIdentityConsumed(request, result);
  return result;
}

export async function computeArenaVirtualPreviewBrowser(
  request: ArenaCruiseRollPreviewRequest,
  options?: { timeoutMs?: number; requestId?: string },
): Promise<ControlEngineEnvelope<ArenaCruiseRollPreviewResult>> {
  const requestId = options?.requestId ?? newRequestId();
  try {
    const result = await withTimeout((async () => {
      await ensureBrowserControlEngine();
      return computeArenaVirtualPreviewBrowserSync(request);
    })(), options?.timeoutMs ?? DEFAULT_ANALYSIS_TIMEOUT_MS);

    return okEnvelope({
      capability: 'computeArenaVirtualPreview',
      executor: 'browser',
      requestId,
      canonicalRequestHash: await canonicalRequestHash(arenaPreviewCanonicalRequest(request)),
      result,
      persisted: false,
      modelRelation: result.modelRelation,
      teachingSemantics: ARENA_PREVIEW_TEACHING_SEMANTICS,
    });
  } catch (error) {
    throw mapFailure(error);
  }
}
