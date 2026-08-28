import initControlEngine, {
  compute_analysis,
  compute_nonlinear_analysis,
  compute_rl_training,
  compute_simulation_step,
  compute_virtual_simulation_step,
} from '@/resources/control-system/wasm/control_engine/index.js';

import { ControlEngineFailure } from './envelope';

let initPromise: Promise<void> | null = null;
let ready = false;

export function isBrowserControlEngineReady(): boolean {
  return ready;
}

export function preloadBrowserControlEngine(): Promise<void> {
  if (!initPromise) {
    initPromise = initControlEngine()
      .then(() => {
        ready = true;
      })
      .catch((error) => {
        ready = false;
        initPromise = null;
        throw new ControlEngineFailure({
          state: 'unavailable',
          category: 'wasm-init',
          message: error instanceof Error ? error.message : 'Control engine WASM could not initialize.',
          retryable: true,
        });
      });
  }
  return initPromise;
}

export async function ensureBrowserControlEngine(): Promise<void> {
  await preloadBrowserControlEngine();
  if (!ready) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-not-ready',
      message: 'Control engine WASM is not ready.',
      retryable: true,
    });
  }
}

export function invokeBrowserWasm(exportName: 'compute_analysis' | 'compute_nonlinear_analysis' | 'compute_rl_training' | 'compute_simulation_step' | 'compute_virtual_simulation_step', requestJson: string): string {
  if (!ready) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'wasm-not-ready',
      message: 'Control engine WASM is not ready.',
      retryable: true,
    });
  }
  switch (exportName) {
    case 'compute_analysis':
      return compute_analysis(requestJson);
    case 'compute_nonlinear_analysis':
      return compute_nonlinear_analysis(requestJson);
    case 'compute_rl_training':
      return compute_rl_training(requestJson);
    case 'compute_simulation_step':
      return compute_simulation_step(requestJson);
    case 'compute_virtual_simulation_step':
      return compute_virtual_simulation_step(requestJson);
    default: {
      const exhaustive: never = exportName;
      throw new ControlEngineFailure({
        state: 'unavailable',
        category: 'missing-export',
        message: `Control engine export is not available: ${String(exhaustive)}`,
        retryable: false,
      });
    }
  }
}
