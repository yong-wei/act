import { expect, test, type Page } from '@playwright/test';
import type { ComparisonOceanProbe } from '../src/app/simulations/fft-ocean-comparison/comparison-water';

declare global {
  interface Window { __comparisonOcean?: ComparisonOceanProbe; }
}

async function openRoute(page: Page, api: string, backend: string, scene = 'feature-parity') {
  await page.goto(`/simulations/fft-ocean-comparison?api=${api}&backend=${backend}&scene=${scene}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 3, { timeout: 90_000 });
}

test.describe('shared ocean renderer parity', () => {
  test.setTimeout(120_000);
  for (const api of ['webgl', 'webgpu']) {
    for (const backend of ['fft', 'gerstner']) {
      test(`${api} ${backend} runs the shared complete scene without whole-field readback`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await openRoute(page, api, backend);
        await page.waitForFunction(() => window.__marineComparisonLab?.ready());
        const before = await page.evaluate(() => window.__comparisonOcean!.identity());
        expect(before.api).toBe(api === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend');
        expect(before.backend).toBe(backend);
        expect(before.readbacks).toBe(0);
        const updates = await page.evaluate(() => new Promise<number>(resolve => {
          const probe = window.__comparisonOcean!;
          const started = performance.now();
          let previous = probe.identity().time;
          let changed = 0;
          const sample = () => {
            const time = probe.identity().time;
            if (time !== previous) changed += 1;
            previous = time;
            if (performance.now() - started >= 400) resolve(changed);
            else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }));
        expect(updates).toBeGreaterThan(2);
        expect(await page.evaluate(() => window.__comparisonOcean!.features())).toMatchObject({
          ibl: true, planar: true, foam: true, shallow: true,
        });
        const vessel = await page.evaluate(() => window.__marineComparisonLab!.identity());
        expect(vessel.vesselLoaded).toBe(true);
        expect(vessel.queryBackend).toBe(backend);
        expect(vessel.waterBaseY).toBe(-1);
        await page.evaluate(() => {
          window.__marineComparisonLab!.setRunMode('visual');
          window.__marineComparisonLab!.reset();
          window.__marineComparisonLab!.step(5);
        });
        await page.waitForFunction(() => window.__marineComparisonLab!.ready());
        if (backend === 'fft') {
          const reference = await page.evaluate(() => window.__comparisonOcean!.reference());
          expect(reference.hs).toBeGreaterThan(1.96);
          expect(reference.hs).toBeLessThan(2.04);
        }
        const contact = await page.evaluate(async () => ({
          cpu: window.__marineComparisonLab!.capture(),
          gpu: await window.__comparisonOcean!.sampleSurface((() => {
            const p = window.__marineComparisonLab!.capture().vesselPose;
            const dx = Math.sin(p.headingRad) * 85, dz = Math.cos(p.headingRad) * 85;
            return [[p.x, p.z], [p.x + dx, p.z + dz], [p.x - dx, p.z - dz]] as [number, number][];
          })()),
        }));
        const expected = [contact.cpu.waterHeightOrigin, contact.cpu.bowHeight, contact.cpu.sternHeight];
        contact.gpu.forEach((point, i) => {
          expect(Math.abs(point.height - expected[i]), JSON.stringify(contact)).toBeLessThan(0.05);
          expect(Number.isFinite(point.slopeX) && Number.isFinite(point.slopeZ)).toBe(true);
        });
        await page.screenshot({ path: testInfo.outputPath(`${api}-${backend}.png`) });
        expect(errors).toEqual([]);
      });
    }
    for (const dpr of [1, 2]) {
      test.describe(`${api} DPR ${dpr}`, () => {
        test.use({ deviceScaleFactor: dpr });
        test('GPU fields agree with independent DFT', async ({ page }) => {
          await openRoute(page, api, 'fft');
          const report = await page.evaluate(() => window.__comparisonOcean!.validate());
          expect(report.ok, JSON.stringify(report)).toBe(true);
          expect(report.relativeL2).toBeLessThan(2e-4);
          expect(report.displacementMaxAbsError).toBeLessThan(1e-3);
        });
      });
    }
    for (const resolution of [128, 512]) {
      test(`${api} validates the live ${resolution} field without rebuilding per frame`, async ({ page }) => {
        await page.goto(`/simulations/fft-ocean-comparison?api=${api}&backend=fft&scene=wave-only&resolution=${resolution}`);
        await page.waitForFunction(() => (window.__comparisonOcean?.identity().frames ?? 0) > 3);
        const before = await page.evaluate(() => window.__comparisonOcean!.identity());
        const result = await page.evaluate(() => window.__comparisonOcean!.validateCurrentField());
        expect(result.resolution).toBe(resolution);
        expect(result.maxAbsError).toBeLessThan(1e-3);
        const after = await page.evaluate(() => window.__comparisonOcean!.identity());
        expect(after.resourceGeneration).toBe(before.resourceGeneration);
        expect(after.readbacks).toBe(before.readbacks + 1);
      });
    }
    test(`${api} optical consumers disable without changing wave time or geometry`, async ({ page }) => {
      await openRoute(page, api, 'fft');
      await page.evaluate(() => {
        window.__marineComparisonLab!.setRunMode('visual');
        window.__marineComparisonLab!.reset();
        window.__marineComparisonLab!.step(3);
      });
      await page.waitForFunction(() => window.__marineComparisonLab!.ready());
      const before = await page.screenshot();
      const contact = await page.evaluate(() => window.__marineComparisonLab!.capture());
      await page.evaluate(() => {
        window.__marineComparisonLab!.setShallowEnabled!(false);
        window.__marineComparisonLab!.setReflectionEnabled!(false);
      });
      await page.waitForFunction(() => {
        const feature = window.__comparisonOcean!.features();
        return !feature.planar && !feature.shallow;
      });
      const after = await page.screenshot();
      expect(before.equals(after)).toBe(false);
      expect(await page.evaluate(() => window.__marineComparisonLab!.capture())).toEqual(contact);
      expect(await page.evaluate(() => window.__comparisonOcean!.identity().readbacks)).toBe(0);
    });
  }
  test('unsupported WebGPU reports failure without silent fallback', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await page.goto('/simulations/fft-ocean-comparison?api=webgpu&backend=fft&scene=feature-parity');
    await expect(page.locator('[data-renderer-error="true"]')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => window.__comparisonOcean?.identity() ?? null)).toBeNull();
  });
  test('switching graphics APIs reuses the common scene contract and releases the old device', async ({ page }) => {
    await openRoute(page, 'webgl', 'fft');
    for (const api of ['webgpu', 'webgl', 'webgpu']) {
      await page.locator(`a[data-comparison-axis="api"][data-comparison-value="${api}"]`).click();
      await page.waitForFunction(expected => {
        const identity = window.__comparisonOcean?.identity();
        return identity?.api === expected && identity.frames > 3;
      }, api === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend');
      await expect(page.locator('[data-renderer-error]')).toHaveCount(0);
      expect(await page.evaluate(() => window.__comparisonOcean!.identity().readbacks)).toBe(0);
      expect(await page.evaluate(() => window.__comparisonOcean!.features())).toMatchObject({
        optics: 'shared', shallow: true, foam: true,
      });
    }
  });
});
