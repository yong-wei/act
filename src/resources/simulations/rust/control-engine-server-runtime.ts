import { computeVirtualSimulationServerStep, preloadServerControlEngine } from '@/lib/control-engine/server';

export const preloadVirtualSimulationServerRuntime = () => {
  preloadServerControlEngine();
};

export const computeVirtualSimulationServerStepRuntime = <TResult>(request: unknown): TResult => {
  return computeVirtualSimulationServerStep<TResult>(request);
};

export { computeVirtualSimulationServerStep };
