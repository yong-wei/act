import { expect, test } from '@playwright/test';
import type {} from '../src/resources/simulations/simulations/destroyer-simulation';

for (const api of ['webgl', 'webgpu']) {
  test(`${api}: paused propeller phase survives a prepared LOD replacement`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(`/simulations/destroyer?graphics=${api}`);
    await page.getByRole('button', { name: '画质档位', exact: true }).click();
    await page.locator('[data-quality-tier="low"]').click();
    await page.waitForFunction(() => window.__destroyerModelVisual?.url.endsWith('ship-lod2.glb'));
    const initial = await page.evaluate(() => window.__destroyerModelVisual!.propPortQuat!);
    const restore = page.locator('[data-simulation-panel-restore-handle="right"]');
    if (await restore.count()) await restore.click();
    await page.locator('[data-sound-start]').first().click();
    await page.waitForFunction(initial => {
      const current = window.__destroyerModelVisual;
      return current?.advancing && current.propPortQuat && Math.hypot(...current.propPortQuat.map((v, i) => v - initial[i])) > 0.1;
    }, initial);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.waitForFunction(() => window.__destroyerModelVisual?.advancing === false);
    const settledPhase = () => page.evaluate(async () => {
      const samples: number[][] = [];
      for (let i = 0; i < 4; i++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        samples.push(window.__destroyerModelVisual!.propPortQuat!);
      }
      return samples;
    });
    const paused = await settledPhase();
    const before = paused[3];
    const alignment = (a: number[], b: number[]) => Math.abs(a.reduce((sum, value, i) => sum + value * b[i], 0))
      / (Math.hypot(...a) * Math.hypot(...b));
    expect(alignment(before, paused[2])).toBeCloseTo(1, 5);
    await page.getByRole('button', { name: '画质档位', exact: true }).click();
    await page.locator('[data-quality-tier="medium"]').click();
    await page.waitForFunction(() => window.__destroyerModelVisual?.url.endsWith('ship-lod1.glb'));
    const after = (await settledPhase())[3];
    expect(alignment(after, before)).toBeCloseTo(1, 5);
  });
}
