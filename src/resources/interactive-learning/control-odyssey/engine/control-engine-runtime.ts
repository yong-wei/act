import {
  computeSimulationStepBrowserSync,
  isBrowserControlEngineReady,
  preloadBrowserControlEngine,
} from '@/lib/control-engine/client';

import type { RustSimulationRequest, RustSimulationResult } from './rust-runtime-adapter';

export const preloadControlOdysseyRuntime = () => preloadBrowserControlEngine();

export const isControlOdysseyRuntimeReady = () => isBrowserControlEngineReady();

export const computeRustSimulationStep = (request: RustSimulationRequest): RustSimulationResult => {
  return computeSimulationStepBrowserSync(request);
};
