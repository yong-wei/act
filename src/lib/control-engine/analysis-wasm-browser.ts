import init, {
  compute_analysis,
  compute_nonlinear_analysis,
} from '@/resources/control-system/wasm/control_analysis/index.js';
import { CONTROL_ENGINE_BUILD_HASH, CONTROL_ENGINE_EXPORTS } from './analysis-identity.generated';
import { ControlEngineFailure, runtimeIdentity } from './envelope';

let initialization: Promise<unknown> | undefined;
let ready = false;

export function isBrowserAnalysisReady() {
  return ready;
}

export async function ensureBrowserAnalysis() {
  initialization ??= init().then(() => {
    ready = true;
  }).catch((error: unknown) => {
    initialization = undefined;
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-init',
      message: error instanceof Error ? error.message : 'Control analysis could not initialize.',
      retryable: true,
    });
  });
  await initialization;
}

export function computeBrowserAnalysis(nonlinear: boolean, request: string) {
  return nonlinear ? compute_nonlinear_analysis(request) : compute_analysis(request);
}

export function browserAnalysisIdentity() {
  return {
    ...runtimeIdentity(),
    packageDir: 'src/resources/control-system/wasm/control_analysis' as const,
    buildHash: CONTROL_ENGINE_BUILD_HASH,
    exports: CONTROL_ENGINE_EXPORTS,
  };
}
