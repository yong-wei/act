import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import type {} from './fixtures/marine-ship-history-probe';

let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve('tests/fixtures/marine-ship-history-probe.ts')], bundle: true,
    write: false, minify: true, format: 'esm', platform: 'browser', alias: { '@': path.resolve('src') } });
  bundle = result.outputFiles[0].text;
});
async function setup(page: Page, api: 'webgl' | 'webgpu', speed = 12, path: 'straight' | 'circle' = 'straight') {
  await page.route('**/__ship-wave-probe', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.route('**/__ship-wave-probe.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
  await page.goto('/__ship-wave-probe');
  await page.evaluate(async ({ api, speed, path }) => {
    const url = '/__ship-wave-probe.js', probeModule = await import(url);
    window.__shipHistoryFixture = await probeModule.create(api, speed, path);
    window.__shipHistoryFixture!.setSources(true, false);
  }, { api, speed, path });
}

// 独立连续时间积分，只核验首次边缘吸收前的实际压力响应；不复用 GPU 递推。
function pressureMode(x: number, z: number, time: number) {
  const kx = x * 2 * Math.PI / 768, kz = z * 2 * Math.PI / 768;
  const k = Math.hypot(kx, kz), omega = Math.sqrt(9.81 * k), damping = 0.012 + 0.04 * k * k;
  const samples = 12000, dt = time / samples;
  let re = 0, im = 0;
  for (let i = 0; i < samples; i++) {
    const t = (i + 0.5) * dt, angle = t * 12 / 300;
    const px = 300 * (Math.cos(angle) - 1), pz = 300 * Math.sin(angle);
    const along = -kx * Math.sin(angle) + kz * Math.cos(angle), across = kx * Math.cos(angle) + kz * Math.sin(angle);
    const force = -k * (12 * 12 * 0.10 / 2) * (2 * Math.PI * 6.3 * 4.6 * 512 * 512 / (768 * 768))
      * Math.exp(-0.5 * ((along * 6.3) ** 2 + (across * 4.6) ** 2));
    const phase = -(kx * (px + 384) + kz * (pz + 384));
    const weight = Math.exp(-damping * (time - t)) * Math.sin(omega * (time - t)) / omega * dt;
    re += force * (0.9 * Math.cos(phase - along * 75.6) + 0.65 * Math.cos(phase + along * 72)) * weight;
    im += force * (0.9 * Math.sin(phase - along * 75.6) + 0.65 * Math.sin(phase + along * 72)) * weight;
  }
  return { re, im };
}
for (const api of ['webgl', 'webgpu'] as const) {
  test.describe(`${api} local ship field`, () => {
    test.setTimeout(180000);
    test('persistent propulsor foam remains visible after the fresh layer fades', async ({ page }) => {
      await setup(page, api, 0);
      const result = await page.evaluate(async api => {
        const url = '/__ship-wave-probe.js', probe = await import(url);
        return probe.persistentWashVisibility(api);
      }, api);
      expect(result.visibleIncrease).toBeGreaterThan(0.025);
      expect(result.cleared).toEqual(result.background);
      expect(result.identity.api).toBe(api === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend');
    });
    test('complex roundtrip, independent pressure and visible fine geometry agree', async ({ page }) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await setup(page, api, 12, 'circle');
      const transform = await page.evaluate(() => window.__shipHistoryFixture!.transformProbe());
      expect(transform.maxError).toBeLessThan(2e-6);
      expect(transform.mode[0]).toBeCloseTo(0.4 * 16 * 16 / 2, 3);
      expect(Math.abs(transform.mode[1])).toBeLessThan(1e-4);
      await page.evaluate(() => window.__shipHistoryFixture!.advanceTo(0.5));
      const response = await page.evaluate(() => window.__shipHistoryFixture!.read());
      for (const mode of response.modes) {
        const expected = pressureMode(mode.x, mode.z, response.time);
        expect(Math.abs(mode.heightRe - expected.re)).toBeLessThan(0.018);
        expect(Math.abs(mode.heightIm - expected.im)).toBeLessThan(0.018);
      }
      await page.evaluate(() => window.__shipHistoryFixture!.advanceTo(12));
      const field = await page.evaluate(() => window.__shipHistoryFixture!.read());
      expect(field.energy).toBeGreaterThan(1e-6);
      for (const [x, z] of [[14.3, -36.7], [-10.1, 40.3], [24, 60]]) {
        const sample = await page.evaluate(([x, z]) => window.__shipHistoryFixture!.sample(x, z), [x, z]);
        expect(Math.abs(sample.visible - sample.field)).toBeLessThan(0.018);
        expect(sample.slope.every(Number.isFinite)).toBe(true);
      }
      expect(errors).toEqual([]);
    });
    test('speed remains responsive below and above the old saturated gates', async ({ page }) => {
      await setup(page, api, 4);
      const values = [];
      for (const speed of [4, 8, 16]) {
        values.push(await page.evaluate(async speed => {
          const f = window.__shipHistoryFixture!; f.setSpeed(speed); f.reset(); f.advanceTo(10); return f.read();
        }, speed));
      }
      expect(values[0].energy).toBeGreaterThan(1e-8);
      expect(values[1].energy).toBeGreaterThan(values[0].energy * 2);
      expect(values[2].energy).toBeGreaterThan(values[1].energy * 2);
      expect(values[0].minHeight).toBeLessThan(-0.005);
    });
    test('recenter preserves world history and absorbing edges prevent a wrapped bow wave', async ({ page }) => {
      await setup(page, api);
      await page.evaluate(() => window.__shipHistoryFixture!.advanceTo(6));
      const before = await page.evaluate(() => window.__shipHistoryFixture!.sample(14, -30));
      await page.evaluate(() => {
        const f = window.__shipHistoryFixture!; f.setSources(false, false);
        f.setPose({ x: 100, z: 100, headingRad: Math.PI / 2, speedMps: 0 }); f.advanceTo(6 + 4 / 60);
      });
      const after = await page.evaluate(() => window.__shipHistoryFixture!.sample(14, -30));
      expect(Math.abs(after.field - before.field)).toBeLessThan(0.075);
      const origin = await page.evaluate(() => window.__shipHistoryFixture!.stats().wakeOrigin);
      expect(origin).toEqual([96, 96]);
      expect(Math.abs(after.visible - after.field)).toBeLessThan(0.018);
      await page.evaluate(() => {
        const f = window.__shipHistoryFixture!; f.setPose(null); f.setSources(true, false); f.reset(); f.advanceTo(80);
      });
      const late = await page.evaluate(() => window.__shipHistoryFixture!.read());
      const front = await page.evaluate(() => window.__shipHistoryFixture!.sample(0, 12 * 80 + 270));
      expect(Math.abs(front.field)).toBeLessThan(Math.max(Math.abs(late.minHeight), late.maxHeight) * 0.12);
      expect(Number.isFinite(late.energy)).toBe(true);
      expect(late.energy).toBeGreaterThan(1e-6);
    });
    test('zero-speed propulsor wash has its own lifetime and pause never clears history', async ({ page }) => {
      await setup(page, api, 0);
      await page.evaluate(() => {
        const f = window.__shipHistoryFixture!;
        f.setJets([{ id: 'port', x: -5, z: -40, headingRad: 0, activity: 1, diameterMeters: 4, depthMeters: 2 },
          { id: 'starboard', x: 5, z: -40, headingRad: Math.PI / 3, activity: 0.8, diameterMeters: 4, depthMeters: 2 }]);
        f.advanceTo(5);
      });
      const initial = await page.evaluate(() => window.__shipHistoryFixture!.read());
      expect(initial.energy).toBe(0); expect(initial.naturalFoamArea).toBe(0);
      expect(initial.shipBreakingFoamArea).toBe(0); expect(initial.washFoamArea).toBeGreaterThan(20);
      expect(await page.evaluate(() => window.__shipHistoryFixture!.stats().wavePasses)).toBe(0);
      await page.evaluate(() => {
        const f = window.__shipHistoryFixture!; f.setSources(false, false); f.setJets([]); f.advanceTo(15);
      });
      const retained = await page.evaluate(() => window.__shipHistoryFixture!.read());
      expect(retained.washFoamArea).toBeGreaterThan(0);
      expect(retained.washFoamArea / initial.washFoamArea).toBeCloseTo(2 ** (-10 / 8), 2);
      expect(await page.evaluate(() => window.__shipHistoryFixture!.read())).toEqual(retained);
    });
  });
}
