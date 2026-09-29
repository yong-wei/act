import { expect, test } from '@playwright/test';
import type {} from '../src/resources/simulations/scene/water/shared-ocean-surface';

const routes = ['destroyer', 'lng', 'container', 'icebreaker', 'cruise', 'drilling', 'dredger'] as const;
for (const graphics of ['webgl', 'auto'] as const) for (const route of routes) {
  test(`${route}: shared FFT with ${graphics}`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/simulations/${route}${graphics === 'webgl' ? '?graphics=webgl' : ''}`);
    await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 5);
    const identity = await page.evaluate(() => window.__comparisonOcean!.identity());
    expect(identity.backend).toBe('fft');
    expect(identity.api).toBe(graphics === 'webgl' ? 'WebGLBackend' : 'WebGPUBackend');
    const restore = page.locator('[data-simulation-panel-restore-handle="right"]');
    if (await restore.count()) await restore.click();
    await page.locator('[data-sound-start]').first().click();
    await page.waitForFunction(time => window.__comparisonOcean!.identity().time > time + 1, identity.time);
    expect(await page.evaluate(() => window.__comparisonOcean!.identity().readbacks)).toBe(0);
    expect(await page.evaluate(() => window.__comparisonOcean!.history()?.steps)).toBeGreaterThan(30);
    expect(errors).toEqual([]);
  });
}

for (const failure of ['missing', 'adapter', 'device'] as const) {
  test(`automatic WebGL fallback: ${failure}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.addInitScript(failure => {
      Object.defineProperty(navigator, 'gpu', { configurable: true, value: failure === 'missing' ? undefined : {
        requestAdapter: async () => {
          if (failure === 'adapter') throw new Error('test adapter unavailable');
          return { info: {}, features: [], limits: { maxTextureDimension2D: 8192, maxColorAttachments: 8 },
            requestDevice: async () => { throw new Error('test device unavailable'); } };
        },
      } });
    }, failure);
    await page.goto('/simulations/destroyer');
    await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 5);
    expect(await page.evaluate(() => window.__comparisonOcean!.identity().api)).toBe('WebGLBackend');
    await expect(page.locator('[data-marine-fallback]')).toHaveAttribute('data-marine-fallback', 'true');
    expect(await page.evaluate(() => window.__comparisonOcean!.features().foam)).toBe(true);
  });
}

for (const graphics of ['webgl', 'webgpu'] as const) {
  test(`quality changes preserve surface history: ${graphics}`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/simulations/destroyer?graphics=${graphics}`);
    await page.waitForFunction(() => (window.__comparisonOcean?.identity().time ?? 0) > 2);
    const before = await page.evaluate(() => window.__comparisonOcean!.identity());
    const histories = await page.evaluate(async () => Promise.all([
      window.__comparisonOcean!.readHistory(), window.__comparisonOcean!.readHistory(),
    ]));
    expect(histories).toHaveLength(2);
    for (const tier of ['low', 'medium', 'high']) {
      await page.getByRole('button', { name: '画质档位', exact: true }).click();
      await page.locator(`[data-quality-tier="${tier}"]`).click();
      await page.waitForFunction(({ time, generation }) => {
        const current = window.__comparisonOcean?.identity();
        return current && current.time > time && current.resourceGeneration === generation;
      }, { time: before.time, generation: before.resourceGeneration });
    }
    expect(await page.evaluate(() => window.__comparisonOcean!.identity().resourceGeneration)).toBe(before.resourceGeneration);
    expect(errors).toEqual([]);
  });
}
