import {
  computeVirtualSimulationStepBrowserSync,
  isBrowserControlEngineReady,
  preloadBrowserControlEngine,
} from '@/lib/control-engine/client';

import type { DestroyerHifiStepRequest, DestroyerHifiStepResult } from './destroyer-hifi-adapter';

export const preloadVirtualSimulationRuntime = () => preloadBrowserControlEngine();

export const isVirtualSimulationRuntimeReady = () => isBrowserControlEngineReady();

export const computeVirtualSimulationStep = <TResult>(request: unknown): TResult => {
  return computeVirtualSimulationStepBrowserSync<TResult>(request);
};

export const computeDestroyerHifiStep = (request: DestroyerHifiStepRequest): DestroyerHifiStepResult => {
  return computeVirtualSimulationStep<DestroyerHifiStepResult>(request);
};
