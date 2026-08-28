import type { ResolvedSimulationModel, SimulationModelId } from './types';

const SAME_ORIGIN = {
  destroyer: { originalUrl: '/assets/destroyer.glb', optimizedUrl: '/assets/models-opt/destroyer.glb' },
  icebreaker: { originalUrl: '/assets/icebreaker.glb', optimizedUrl: '/assets/models-opt/icebreaker.glb' },
  'lng-carrier': { originalUrl: '/assets/Lng-carrier.glb', optimizedUrl: '/assets/models-opt/Lng-carrier.glb' },
  container: { originalUrl: '/assets/container.glb', optimizedUrl: '/assets/models-opt/container.glb' },
  dredger: { originalUrl: '/assets/dredger.glb', optimizedUrl: '/assets/models-opt/dredger.glb' },
  'luxury-liner': { originalUrl: '/assets/luxury-liner.glb', optimizedUrl: '/assets/models-opt/luxury-liner.glb' },
  'drilling-rig': { originalUrl: '/assets/drilling-rig.glb', optimizedUrl: '/assets/models-opt/drilling-rig.glb' },
} as const;

function entry(logicalId: SimulationModelId): ResolvedSimulationModel {
  const urls = SAME_ORIGIN[logicalId];
  const candidates = [urls.optimizedUrl, urls.originalUrl];
  return {
    logicalId,
    originalUrl: urls.originalUrl,
    optimizedUrl: urls.optimizedUrl,
    esaUrl: null,
    candidates,
    primary: candidates[0],
  };
}

export const SIMULATION_MODEL_REGISTRY: Record<SimulationModelId, ResolvedSimulationModel> = {
  destroyer: entry('destroyer'),
  icebreaker: entry('icebreaker'),
  'lng-carrier': entry('lng-carrier'),
  container: entry('container'),
  dredger: entry('dredger'),
  'luxury-liner': entry('luxury-liner'),
  'drilling-rig': entry('drilling-rig'),
};

export function resolveRegisteredSimulationModel(logicalId: SimulationModelId): ResolvedSimulationModel {
  const resolved = SIMULATION_MODEL_REGISTRY[logicalId];
  if (!resolved) throw new Error(`unknown-simulation-model:${logicalId}`);
  return resolved;
}
