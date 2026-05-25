import { describe, expect, it } from 'vitest';

import {
  createSimulationRng,
  createSimulationRunContext,
} from '../core/seeded-rng';
import {
  updateCurrentEnvironment,
  createCurrentEnvironment,
  createWindEnvironment,
} from '../physics/disturbances/current-model';
import {
  createDredgingImpactState,
  computeDredgingDisturbance,
  DredgingImpactModel,
} from '../physics/disturbances/dredging-impact';
import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_TARGET,
  optimizePIDParams,
  type SimpleSimConfig,
} from '../lib/monte-carlo-optimizer';
import { createSimulationEngine } from '../physics/engine-factory';
import { drillingHYSY981Profile } from '../profiles/drilling-hysy981';

const context = createSimulationRunContext({
  runId: 'determinism-run',
  sceneId: 'sim/replay-test',
  scenarioId: 'same-seed',
  seed: 90210,
  runtimeVersion: 'runtime-test',
  modelVersion: 'model-test',
});

describe('simulation replay determinism', () => {
  it('replays environmental disturbance updates with the same seed and input', () => {
    const env = createCurrentEnvironment(0.5, 30, 0.25);
    const first = updateCurrentEnvironment(
      env,
      0.5,
      createSimulationRng(context, 'current').next,
    );
    const second = updateCurrentEnvironment(
      env,
      0.5,
      createSimulationRng(context, 'current').next,
    );

    expect(first).toEqual(second);
  });

  it('changes stochastic disturbance output when the seed changes', () => {
    const baseState = createDredgingImpactState(createSimulationRng(context, 'dredging').next);
    const first = computeDredgingDisturbance(
      baseState.nextInterval,
      baseState,
      undefined,
      createSimulationRng(context, 'dredging-step').next,
    );
    const changedSeedContext = { ...context, seed: context.seed + 1 };
    const second = computeDredgingDisturbance(
      baseState.nextInterval,
      baseState,
      undefined,
      createSimulationRng(changedSeedContext, 'dredging-step').next,
    );

    expect(first.newState).not.toEqual(second.newState);
  });

  it('resets seeded disturbance models to the same initial replay state', () => {
    const first = new DredgingImpactModel(
      {},
      () => createSimulationRng(context, 'dredging-model').next,
    );
    const fresh = new DredgingImpactModel(
      {},
      () => createSimulationRng(context, 'dredging-model').next,
    );

    const firstInitial = first.getState();
    expect(firstInitial.nextInterval).toBeGreaterThan(0);
    first.compute(firstInitial.nextInterval);
    first.reset();

    expect(first.getState()).toEqual(fresh.getState());
  });

  it('resets drilling platform environment state before seeded replay', () => {
    const first = createSimulationEngine(drillingHYSY981Profile, { runContext: context }) as ReturnType<typeof createSimulationEngine> & {
      getEnvironmentState: () => unknown;
      setSeaState: (level: number, waveDirection?: number) => void;
    };
    const fresh = createSimulationEngine(drillingHYSY981Profile, { runContext: context }) as typeof first;

    first.setSeaState(4, 20);
    fresh.setSeaState(4, 20);
    const mutatedFirst = first as typeof first & {
      currentEnv: ReturnType<typeof createCurrentEnvironment>;
      windEnv: ReturnType<typeof createWindEnvironment>;
    };
    mutatedFirst.currentEnv = createCurrentEnvironment(1.5, 90, 0.5);
    mutatedFirst.windEnv = createWindEnvironment(12, 90, 1.5);
    first.initialize(0, 0, 0);

    expect(first.getEnvironmentState()).toEqual(fresh.getEnvironmentState());
  });

  it('produces the same optimizer replay checksum for the same seeded run context', () => {
    const config: SimpleSimConfig = {
      nomotoK: 0.08,
      nomotoT: 55,
      shipSpeed: 15,
    };
    const constraints = {
      kpRange: DEFAULT_CONSTRAINTS.kpRange,
      kiRange: DEFAULT_CONSTRAINTS.kiRange,
      kdRange: DEFAULT_CONSTRAINTS.kdRange,
    };

    const first = optimizePIDParams(config, DEFAULT_TARGET, constraints, 8, 20, { runContext: context });
    const second = optimizePIDParams(config, DEFAULT_TARGET, constraints, 8, 20, { runContext: context });

    expect(first.bestParams).toEqual(second.bestParams);
    expect(first.convergenceHistory).toEqual(second.convergenceHistory);
    expect(first.replay?.checksum).toBe(second.replay?.checksum);
  });
});
