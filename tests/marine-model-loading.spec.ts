import { expect, test } from '@playwright/test';
import type {} from '../src/resources/simulations/scene/water/shared-ocean-surface';
import type {} from '../src/resources/simulations/simulations/destroyer-simulation';

for (const api of ['webgl', 'webgpu']) {
  test(`${api}: low model stays visible through delayed preparation and a failed replacement`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [], requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().endsWith('.glb')) requests.push(request.url()); });
    let release!: () => void, highRequested = false;
    const hold = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*ship-lod0.glb', async route => { highRequested = true; await hold; await route.continue(); });
    await page.goto(`/simulations/destroyer?graphics=${api}`);
    await page.waitForFunction(() => window.__destroyerModelVisual?.url.includes('ship-lod2.glb'));
    expect(requests[0]).toContain('ship-proxy.glb');
    expect(requests.some(url => url.endsWith('ship-lod2.glb'))).toBe(true);
    await page.getByRole('button', { name: '画质档位', exact: true }).click();
    await page.locator('[data-quality-tier="high"]').click();
    await expect.poll(() => highRequested).toBe(true);
    await page.waitForTimeout(400);
    expect(await page.locator('[data-loading-progress]').count()).toBe(0);
    const current = await page.evaluate(() => window.__marineConsumerObservation!.collect());
    expect(current.shipRadius).toBeGreaterThan(20);
    release();
    await page.waitForFunction(() => window.__destroyerModelVisual?.url.includes('ship-lod0.glb'));

    let fail = true, mediumRequests = 0;
    await page.route('**/*ship-lod1.glb', async route => {
      mediumRequests += 1;
      if (fail) await route.fulfill({ status: 503, body: 'temporary test failure' });
      else await route.continue();
    });
    await page.getByRole('button', { name: '画质档位', exact: true }).click();
    await page.locator('[data-quality-tier="medium"]').click();
    await expect.poll(() => mediumRequests).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    expect(await page.locator('[data-loading-progress]').count()).toBe(0);
    expect(await page.evaluate(() => window.__destroyerModelVisual!.url)).toContain('ship-lod0.glb');
    expect((await page.evaluate(() => window.__marineConsumerObservation!.collect())).shipRadius).toBeGreaterThan(20);
    fail = false;
    await page.getByRole('button', { name: '画质档位', exact: true }).click();
    await page.locator('[data-quality-tier="high"]').click();
    await page.getByRole('button', { name: '画质档位', exact: true }).click();
    await page.locator('[data-quality-tier="medium"]').click();
    await page.waitForFunction(() => window.__destroyerModelVisual?.url.includes('ship-lod1.glb'));
    expect(mediumRequests).toBeGreaterThan(1);
    // 仅允许本用例主动制造的503被React报告；其它页面错误仍然失败。
    expect(errors.filter(message => !(message.includes('ship-lod1.glb') && message.includes('503: Service Unavailable')))).toEqual([]);
  });
}
