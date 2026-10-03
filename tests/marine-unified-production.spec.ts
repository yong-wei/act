import { expect, test } from '@playwright/test';
import type {} from '../src/resources/simulations/scene/water/shared-ocean-surface';

const routes = ['destroyer', 'lng', 'container', 'icebreaker', 'cruise', 'drilling', 'dredger'] as const;
const foamCalibration = { destroyer: [24, 90, 6144], lng: [28, 100, 6144], container: [30, 120, 6144],
  icebreaker: [22, 80, 4096], cruise: [30, 110, 6144], drilling: [16, 60, 3072], dredger: [18, 65, 4096] };
for (const graphics of ['webgl', 'auto'] as const) for (const route of routes) {
  test(`${route}: shared FFT with ${graphics}`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/simulations/${route}${graphics === 'webgl' ? '?graphics=webgl' : ''}`);
    await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 5);
    const identity = await page.evaluate(() => window.__comparisonOcean!.identity());
    expect(identity.backend).toBe('fft');
    expect(identity.api).toBe(graphics === 'webgl' ? 'WebGLBackend' : 'WebGPUBackend');
    const history = await page.evaluate(() => window.__comparisonOcean!.history());
    expect([history?.foamHalfLifeSeconds, history?.bubbleHalfLifeSeconds, history?.trailDomainMeters]).toEqual(foamCalibration[route]);
    const restore = page.locator('[data-simulation-panel-restore-handle="right"]');
    if (await restore.count()) await restore.click();
    await page.locator('[data-sound-start]').first().click();
    await page.waitForFunction(time => window.__comparisonOcean!.identity().time > time + 1, identity.time);
    expect(await page.evaluate(() => window.__comparisonOcean!.identity().readbacks)).toBe(0);
    expect(await page.evaluate(() => window.__comparisonOcean!.history()?.steps)).toBeGreaterThan(30);
    for (const name of ['收起状态监控', '收起控制与探究']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.count()) await button.click();
    }
    await page.getByRole('button', { name: '视图', exact: true }).click();
    await page.getByText('战术', { exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath(`${route}-${graphics}.png`) });
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

test('native WebGPU retains one scene and its histories during a sustained run', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const errors: string[] = []; let crashed = false;
  page.on('pageerror', error => errors.push(error.message)); page.on('crash', () => { crashed = true; });
  await page.goto('/simulations/destroyer?graphics=webgpu');
  await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 5);
  const restore = page.locator('[data-simulation-panel-restore-handle="right"]');
  if (await restore.count()) await restore.click();
  await page.locator('[data-sound-start]').first().click();
  const before = await page.evaluate(() => window.__comparisonOcean!.identity());
  await page.waitForTimeout(120000);
  const after = await page.evaluate(() => window.__comparisonOcean!.identity());
  expect(crashed).toBe(false); expect(errors).toEqual([]);
  expect(after.api).toBe('WebGPUBackend'); expect(after.frames).toBeGreaterThan(before.frames + 100);
  expect(after.time).toBeGreaterThan(before.time + 30);
  expect(after.resourceGeneration).toBe(before.resourceGeneration); expect(after.readbacks).toBe(0);
  const field = await page.evaluate(() => window.__comparisonOcean!.readHistory());
  expect(field!.trailFoamArea).toBeGreaterThan(0); expect(field!.bubbleArea).toBeGreaterThan(0);
  expect(field!.hullFoamArea).toBeGreaterThan(0);
  await testInfo.attach('sustained-scene-readback', { body: JSON.stringify({ before, after, field }), contentType: 'application/json' });
});
