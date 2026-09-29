import { expect, test, type Page } from '@playwright/test';
import type { ComparisonOceanProbe } from '../src/app/simulations/fft-ocean-comparison/comparison-water';

declare global { interface Window { __comparisonOcean?: ComparisonOceanProbe; } }

async function settle(page: Page) {
  await page.waitForFunction(() => window.__marineComparisonLab?.ready(), null, { timeout: 120_000 });
}
async function seek(page: Page, time: number) {
  await page.evaluate(t => window.__marineComparisonLab!.seek(t), time);
  await settle(page);
}
async function reset(page: Page, vessel: boolean, natural: boolean) {
  await page.evaluate(({ vessel, natural }) => {
    window.__marineComparisonLab!.setRunMode('visual');
    window.__comparisonOcean!.setSources(vessel, natural);
    window.__marineComparisonLab!.reset();
  }, { vessel, natural });
  await settle(page);
}

// Independent continuous-time Duhamel quadrature, not the GPU recurrence.
function pressureMode(x: number, z: number, time: number) {
  const kx = x * 2 * Math.PI / 2048, kz = z * 2 * Math.PI / 2048;
  const k = Math.hypot(kx, kz), omega = Math.sqrt(9.81 * k), damping = 0.018 + 0.12 * k * k;
  let re = 0, im = 0;
  const samples = 20000, dt = time / samples;
  for (let i = 0; i < samples; i++) {
    const t = (i + 0.5) * dt, angle = t * 12 / 300;
    const px = 300 * (Math.cos(angle) - 1), pz = 300 * Math.sin(angle);
    const along = -kx * Math.sin(angle) + kz * Math.cos(angle);
    const across = kx * Math.cos(angle) + kz * Math.sin(angle);
    const force = -9.81 * k * 1.2 * (2 * Math.PI * 36 * 9 * 256 * 256 / (2048 * 2048))
      * Math.exp(-0.5 * ((along * 36) ** 2 + (across * 9) ** 2));
    const weight = Math.exp(-damping * (time - t)) * Math.sin(omega * (time - t)) / omega * dt;
    const phase = -(kx * px + kz * pz);
    re += force * Math.cos(phase) * weight; im += force * Math.sin(phase) * weight;
  }
  return { re, im, omega, damping };
}

for (const api of ['webgl', 'webgpu']) {
  test.describe(`${api} persistent surface`, () => {
    test.setTimeout(180_000);
    test('foam survives source removal, drifts, spreads, decays and pauses', async ({ page }) => {
      await page.goto(`/simulations/fft-ocean-comparison?api=${api}&backend=fft&scene=feature-parity`);
      await settle(page);
      await reset(page, false, false);
      const zero = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(zero.energy).toBe(0); expect(zero.foamMass).toBe(0);
      await page.evaluate(() => window.__comparisonOcean!.injectFoam(120, -180, 16));
      await seek(page, 4 / 60);
      const first = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(first.foamMass).toBeGreaterThan(10);
      await seek(page, 10 + 4 / 60);
      const later = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(later.foamMass / first.foamMass).toBeCloseTo(2 ** (-10 / 26), 2);
      expect(later.foamCentroid[0] - first.foamCentroid[0]).toBeCloseTo(6.5, 1);
      expect(later.foamCentroid[1] - first.foamCentroid[1]).toBeCloseTo(2.2, 1);
      expect(later.foamVariance).toBeGreaterThan(first.foamVariance);
      expect(later.energy).toBe(0);
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => window.__comparisonOcean!.readHistory())).toEqual(later);
      await reset(page, false, false);
      expect((await page.evaluate(() => window.__comparisonOcean!.readHistory())).foamMass).toBe(0);
      await reset(page, false, true);
      await seek(page, 4);
      const natural = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(natural.energy).toBe(0);
      expect(natural.foamMass).toBeGreaterThan(1);
    });
    test('moving pressure produces dispersive geometry and a repeatable circular wake', async ({ page }, info) => {
      const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(`/simulations/fft-ocean-comparison?api=${api}&backend=fft&scene=feature-parity`);
      await settle(page);
      await expect(page.getByRole('button', { name: '战术视角' })).toHaveAttribute('aria-pressed', 'true');
      await reset(page, true, false);
      await seek(page, 20);
      const field = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(field.energy).toBeGreaterThan(1e-5);
      expect(field.maxHeight).toBeGreaterThan(0.05);
      expect(field.minHeight).toBeLessThan(-0.1);
      for (const mode of field.modes) {
        const expected = pressureMode(mode.x, mode.z, field.time);
        expect(Math.abs(mode.heightRe - expected.re)).toBeLessThan(0.08);
        expect(Math.abs(mode.heightIm - expected.im)).toBeLessThan(0.08);
      }
      expect(field.foamMass).toBeGreaterThan(10);
      const motion = await page.evaluate(() => window.__marineComparisonLab!.motion());
      expect(Math.hypot(motion.x + 300, motion.z)).toBeCloseTo(300, 5);
      expect(motion.headingRad).toBeCloseTo(-0.8, 5);
      expect(motion.projectedCenter[0]).toBeCloseTo(0, 2);
      expect(motion.projectedCenter[1]).toBeCloseTo(0, 2);
      expect(motion.camera[1]).toBeCloseTo(180 * 2 * Math.sin(Math.PI / 4), 2);
      await page.screenshot({ path: info.outputPath(`${api}-circle-20.png`) });
      await page.evaluate(() => window.__comparisonOcean!.setSources(false, false));
      await seek(page, 30);
      const free = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(free.foamMass).toBeLessThan(field.foamMass);
      free.modes.forEach((mode, i) => {
        const before = field.modes[i];
        const { omega, damping } = pressureMode(mode.x, mode.z, 20);
        const energy = (m: typeof mode) => m.heightRe ** 2 + m.heightIm ** 2
          + (m.velocityRe ** 2 + m.velocityIm ** 2) / (omega * omega);
        expect(energy(mode) / energy(before)).toBeCloseTo(Math.exp(-2 * damping * 10), 2);
      });
      await reset(page, true, false);
      await seek(page, 10); await seek(page, 20);
      const replay = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(replay.energy).toBeCloseTo(field.energy, 7);
      expect(replay.foamMass).toBeCloseTo(field.foamMass, 3);
      await seek(page, 5); // Backward seek rebuilds rather than retaining future wake.
      const reversed = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      await reset(page, true, false); await seek(page, 5);
      const fresh = await page.evaluate(() => window.__comparisonOcean!.readHistory());
      expect(reversed.energy).toBeCloseTo(fresh.energy, 7);
      expect(reversed.foamMass).toBeCloseTo(fresh.foamMass, 3);
      expect(errors).toEqual([]);
    });
  });
}
