import { test, expect } from '@playwright/test';
import type {} from '../src/resources/simulations/scene/water/shared-ocean-surface';

for (const api of ['webgl', 'webgpu'] as const) {
  test(`${api}: contact readback does not hold ocean updates while waiting`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(`/simulations/destroyer?graphics=${api}`);
    await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 10);
    const result = await page.evaluate(async () => {
      const surface = window.__comparisonOcean!, before = surface.identity();
      const read = surface.sampleSurface(Array.from({ length: 8 }, (_, i) => [-6000 + i * 3, 0] as const));
      for (let i = 0; i < 6; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const during = surface.identity();
      return { samples: await read, advanced: during.frames - before.frames, time: during.time };
    });
    expect(result.advanced).toBeGreaterThan(2);
    expect(result.samples).toHaveLength(8);
    expect(new Set(result.samples.map(sample => sample.time)).size).toBe(1);
    expect(result.samples.every(sample => Number.isFinite(sample.height) && sample.time! <= result.time)).toBe(true);
  });
  test(`${api}: positioning thrust uses all eight mounted anchors at near-zero translation`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/simulations/drilling?graphics=${api}`);
    await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 5);
    const restore = page.locator('[data-simulation-panel-restore-handle="right"]');
    if (await restore.count()) await restore.click();
    await page.locator('[data-sound-start]').first().click();
    await page.getByRole('slider').first().press('End');
    const time = await page.evaluate(() => window.__comparisonOcean!.identity().time);
    await page.waitForFunction(time => window.__comparisonOcean!.identity().time > time + 3, time);
    const history = await page.evaluate(() => window.__comparisonOcean!.readHistory());
    expect(history.emitters).toHaveLength(8);
    expect(new Set(history.emitters.map(source => source.id)).size).toBe(8);
    expect(history.emitters.every(source => source.activity > 0 && source.diameterMeters! > 2 && source.depthMeters! > 15)).toBe(true);
    expect(history.washFoamArea).toBeGreaterThan(10);
    expect(history.energy).toBeLessThan(1e-6);
    expect(errors).toEqual([]);
  });
}
