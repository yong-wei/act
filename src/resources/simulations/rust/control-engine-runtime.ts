import initControlEngine, { compute_virtual_simulation_step } from '@/resources/control-system/wasm/control_engine/index.js';

import type { DestroyerHifiStepRequest, DestroyerHifiStepResult } from './destroyer-hifi-adapter';

let initPromise: Promise<void> | null = null;
let ready = false;

export const preloadVirtualSimulationRuntime = () => {
  if (!initPromise) {
    initPromise = initControlEngine().then(() => {
      ready = true;
    });
  }
  return initPromise;
};

export const isVirtualSimulationRuntimeReady = () => ready;

export const computeVirtualSimulationStep = <TResult>(request: unknown): TResult => {
  if (!ready) {
    throw new Error('虚拟仿真数值内核尚未加载完成。');
  }
  return JSON.parse(compute_virtual_simulation_step(JSON.stringify(request))) as TResult;
};

export const computeDestroyerHifiStep = (request: DestroyerHifiStepRequest): DestroyerHifiStepResult => {
  return computeVirtualSimulationStep<DestroyerHifiStepResult>(request);
};
