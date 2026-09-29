import { describe, expect, it } from 'vitest';
import { createMarineSurfaceSampling } from '../scene/water/marine-surface-sampling';
import type { ComparisonOceanProbe } from '../scene/water/shared-ocean-surface';

describe('shared asynchronous surface contact', () => {
  it('uses sampled surface heights and slopes, then refreshes expired observations', async () => {
    const cache = createMarineSurfaceSampling();
    let time = 0;
    const probe = { identity: () => ({ time }), sampleSurface: async (points: readonly (readonly [number, number])[]) =>
      points.map(([x, z]) => ({ x, z, height: 2 + x * 0.1, slopeX: 0.1, slopeZ: 0 })) } as ComparisonOceanProbe;
    expect(cache.heightAt(0, 0)).toBe(-1);
    await cache.update(probe, 0, 0);
    expect(cache.heightAt(0, 0)).toBe(2);
    expect(cache.heightAt(1, 0)).toBeCloseTo(2.1);
    time = 2;
    await cache.update(probe, 0, 0);
    expect(cache.diagnostics().samples.some(sample => sample.time === 2)).toBe(true);
    cache.reset();
    expect(cache.heightAt(0, 0)).toBe(-1);
  });

  it('does not apply readbacks from a previous reset epoch', async () => {
    const cache = createMarineSurfaceSampling();
    let resolve!: (value: { x: number; z: number; height: number; slopeX: number; slopeZ: number }[]) => void;
    const probe = { identity: () => ({ time: 0 }), sampleSurface: () => new Promise(value => { resolve = value; }) } as unknown as ComparisonOceanProbe;
    cache.heightAt(0, 0);
    const pending = cache.update(probe, 0, 0);
    cache.reset();
    resolve([{ x: 0, z: 0, height: 99, slopeX: 0, slopeZ: 0 }]);
    await pending;
    expect(cache.diagnostics().samples).toHaveLength(0);
    expect(cache.heightAt(0, 0)).toBe(-1);
  });
  it('keeps vessel contact requests when a long annotation trail fills the queue', async () => {
    const cache = createMarineSurfaceSampling();
    let sampled: readonly (readonly [number, number])[] = [];
    const probe = { identity: () => ({ time: 0 }), sampleSurface: async (points: readonly (readonly [number, number])[]) => {
      sampled = points;
      return points.map(([x, z]) => ({ x, z, height: 2, slopeX: 0, slopeZ: 0 }));
    } } as ComparisonOceanProbe;
    cache.heightAt(0, 0);
    for (let x = 100; x < 400; x++) cache.heightAt(x, 0);
    await cache.update(probe, 0, 0);
    expect(sampled.some(([x, z]) => x === 0 && z === 0)).toBe(true);
    expect(cache.heightAt(0, 0)).toBe(2);
  });

});
