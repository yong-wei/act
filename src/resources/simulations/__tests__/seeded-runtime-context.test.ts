import { describe, expect, it } from 'vitest';

import {
  createSimulationRng,
  createSimulationRunContext,
  createSeededRng,
} from '../core/seeded-rng';
import { randomInRange } from '../core/constants';

describe('seeded simulation runtime context', () => {
  it('creates deterministic scoped RNG streams from a run context', () => {
    const context = createSimulationRunContext({
      runId: 'run-001',
      sceneId: 'sim/dredger',
      scenarioId: 'dredging-rock-impact',
      seed: 20260525,
      runtimeVersion: 'runtime-test',
      modelVersion: 'model-test',
    });

    const first = createSimulationRng(context, 'disturbance/current');
    const second = createSimulationRng(context, 'disturbance/current');
    const otherStream = createSimulationRng(context, 'optimizer');

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
    expect(otherStream.next()).not.toBe(createSimulationRng(context, 'disturbance/current').next());
  });

  it('supports deterministic range sampling without changing existing call shape', () => {
    const rng = createSeededRng(1234, 'range');
    const same = createSeededRng(1234, 'range');

    expect(randomInRange(2, 6, rng.next)).toBe(randomInRange(2, 6, same.next));
    expect(randomInRange(2, 6)).toBeGreaterThanOrEqual(2);
    expect(randomInRange(2, 6)).toBeLessThan(6);
  });
});
