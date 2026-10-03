import { expect, test } from '@playwright/test';
import type {} from '../src/resources/simulations/scene/water/shared-ocean-surface';
import type {} from '../src/resources/simulations/scene/quality/quality-state';

const fleet = [
  ['destroyer', 2], ['lng', 2], ['container', 1], ['icebreaker', 2],
  ['cruise', 2], ['drilling', 8], ['dredger', 2],
] as const;
for (const api of ['webgl', 'webgpu']) for (const [vessel, propulsors] of fleet) {
  test(`${vessel}/${api}: proxy stays visible until formal LOD preparation completes`, async ({ page }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [], requested: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().endsWith('.glb')) requested.push(request.url()); });
    let releaseLow!: () => void, releaseHigh!: () => void;
    const lowGate = new Promise<void>(resolve => { releaseLow = resolve; });
    const highGate = new Promise<void>(resolve => { releaseHigh = resolve; });
    await page.route('**/*ship-lod2.glb', async route => { await lowGate; await route.continue(); });
    await page.route('**/*ship-lod0.glb', async route => { await highGate; await route.continue(); });
    try {
      await page.goto(`/simulations/${vessel}?graphics=${api}`);
      await page.waitForFunction(() => window.__marineConsumerObservation?.model()?.url.endsWith('ship-proxy.glb'));
      expect(requested[0]).toContain('ship-proxy.glb');
      await page.getByRole('button', { name: '画质档位', exact: true }).click();
      await page.locator('[data-quality-tier="high"]').click();
      await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 5);
      if (vessel === 'drilling') {
        const restore = page.locator('[data-simulation-panel-restore-handle="right"]');
        if (await restore.count()) await restore.click();
        await page.locator('[data-sound-start]').first().click();
        await page.getByRole('slider').first().press('End');
        await expect.poll(async () => (await page.evaluate(() => window.__comparisonOcean!.readHistory())).emitters.length).toBe(8);
      }
      const proxyMount = await page.evaluate(() => window.__marineConsumerObservation!.model()!);
      expect(proxyMount.url).toContain('ship-proxy.glb');
      expect(await page.locator('[data-loading-progress]').count()).toBe(0);
      const history = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(history.emitters).toHaveLength(propulsors);
      expect(history.emitters.every(source => Number.isFinite(source.x) && source.diameterMeters! > 0)).toBe(true);
      expect(requested.some(url => url.endsWith('ship-lod0.glb'))).toBe(false);
      await page.screenshot({ path: info.outputPath('proxy.png') });
      releaseLow();
      await page.waitForFunction(() => window.__marineConsumerObservation?.model()?.url.endsWith('ship-lod2.glb'));
      await expect.poll(() => requested.some(url => url.endsWith('ship-lod0.glb'))).toBe(true);
      expect(await page.locator('[data-loading-progress]').count()).toBe(0);
      releaseHigh();
      await page.waitForFunction(() => window.__marineConsumerObservation?.model()?.url.endsWith('ship-lod0.glb'));
      const formalMount = await page.evaluate(() => window.__marineConsumerObservation!.model()!);
      expect(formalMount.matrix).toEqual(proxyMount.matrix);
      expect(formalMount.scale).toBe(proxyMount.scale);
      await page.screenshot({ path: info.outputPath('formal.png') });
      expect(errors).toEqual([]);
    } finally { releaseLow(); releaseHigh(); }
  });
}
