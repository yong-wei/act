import { computeControlOdysseyServerStep, preloadServerControlEngine } from '@/lib/control-engine/server';

import type { RustSimulationRequest, RustSimulationResult } from './rust-runtime-adapter';

export const preloadControlOdysseyServerRuntime = () => {
  preloadServerControlEngine();
};

export { computeControlOdysseyServerStep };

export const computeControlOdysseyServerStepRuntime = (
  request: RustSimulationRequest,
): RustSimulationResult => computeControlOdysseyServerStep(request);
