import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __marineWebGpuBackend?: string;
    __marineWebGpu?: {
      ready: () => boolean;
      validation: () => {
        heightL2: number;
        slopeL2: number;
        displacementL2: number;
        nativeBackend: boolean;
        route: string;
      } | null;
      features: () => {
        optics: string;
        foam: boolean;
        shallow: boolean;
        fallbackToWebGL: boolean;
      };
      identity: () => { status: string; fallbackToWebGL: boolean } | null;
    };
  }
}

async function openRoute(page: Page, query: string) {
  await page.goto(`/simulations/fft-ocean-comparison?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-webgpu-comparison-page="true"]', { timeout: 90_000 });
}

test.describe('WebGPU marine parity (#2134)', () => {
  test.setTimeout(180_000);

  test('runs native fft and gerstner controls without a webgl fallback', async ({ page }) => {
    await openRoute(page, 'api=webgpu&backend=fft&scene=wave-only');
    const unavailable = await page.locator('[data-webgpu-status="unavailable"], [data-webgpu-status="failed"]').count();
    test.skip(unavailable > 0, '这台浏览器没有可用的 WebGPU 设备');
    let fft: { heightL2: number; slopeL2: number; displacementL2: number; nativeBackend: boolean; route: string } | null = null;
    const deadline = Date.now() + 70_000;
    let lastState = 'pending';
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => ({
        ready: window.__marineWebGpu?.ready() === true,
        error: document.querySelector('[data-webgpu-error]')?.getAttribute('data-webgpu-error') ?? null,
        backend: window.__marineWebGpuBackend ?? null,
        validation: window.__marineWebGpu?.validation() ?? null,
      }));
      lastState = JSON.stringify(state);
      if (state.error) throw new Error(lastState);
      if (state.ready && state.validation) {
        fft = state.validation;
        break;
      }
      await page.waitForTimeout(1000);
    }
    if (!fft) throw new Error(`compute did not finish: ${lastState}`);
    if (fft.heightL2 > 0.02) throw new Error(JSON.stringify(fft));
    expect(fft?.nativeBackend).toBe(true);
    expect(fft?.route).toBe('webgpu-fft');
    expect(fft?.heightL2).toBeLessThan(2e-2);
    expect(fft?.slopeL2).toBeLessThan(2e-2);
    expect(fft?.displacementL2).toBeLessThan(2e-2);
    const features = await page.evaluate(() => window.__marineWebGpu?.features());
    expect(features?.fallbackToWebGL).toBe(false);
    expect(features?.optics).toBe('neutral');

    await openRoute(page, 'api=webgpu&backend=gerstner&scene=feature-parity');
    let gerstner: { heightL2: number; displacementL2: number; nativeBackend: boolean; route: string } | null = null;
    const gerstnerDeadline = Date.now() + 70_000;
    let gerstnerState = 'pending';
    while (Date.now() < gerstnerDeadline) {
      const state = await page.evaluate(() => ({
        error: document.querySelector('[data-webgpu-error]')?.getAttribute('data-webgpu-error') ?? null,
        validation: window.__marineWebGpu?.validation() ?? null,
      }));
      gerstnerState = JSON.stringify(state);
      if (state.error) throw new Error(gerstnerState);
      if (state.validation?.route === 'webgpu-gerstner') {
        gerstner = state.validation;
        break;
      }
      await page.waitForTimeout(1000);
    }
    if (!gerstner) throw new Error(`gerstner did not finish: ${gerstnerState}`);
    const gerstnerFeatures = await page.evaluate(() => window.__marineWebGpu?.features());
    expect(gerstner?.nativeBackend).toBe(true);
    expect(gerstner?.heightL2).toBeLessThan(2e-2);
    expect(gerstner?.displacementL2).toBeLessThan(2e-2);
    expect(gerstnerFeatures?.optics).toBe('shared');
    expect(gerstnerFeatures?.shallow).toBe(true);
    expect(gerstnerFeatures?.foam).toBe(true);
    expect(gerstnerFeatures?.fallbackToWebGL).toBe(false);
  });
});
