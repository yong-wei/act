import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
import type {} from './fixtures/marine-ship-history-probe';
import type { MarineFoamVessel } from '../src/resources/simulations/scene/water/marine-foam-profile';

let bundle: string;
test.beforeAll(async () => {
  const result = await build({ entryPoints: [path.resolve('tests/fixtures/marine-ship-history-probe.ts')], bundle: true,
    write: false, minify: true, format: 'esm', platform: 'browser', alias: { '@': path.resolve('src') } });
  bundle = result.outputFiles[0].text;
});
async function setup(page: Page, api: 'webgl' | 'webgpu', speed = 12, path: 'straight' | 'circle' = 'straight', vessel: MarineFoamVessel = 'destroyer', ambientWaves = false) {
  await page.route('**/__ship-wave-probe', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.route('**/__ship-wave-probe.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
  await page.goto('/__ship-wave-probe');
  await page.evaluate(async ({ api, speed, path, vessel, ambientWaves }) => {
    const url = '/__ship-wave-probe.js', probeModule = await import(url);
    window.__shipHistoryFixture = await probeModule.create(api, speed, path, vessel, ambientWaves);
    window.__shipHistoryFixture!.setSources(true, false);
  }, { api, speed, path, vessel, ambientWaves });
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
    test('long bubble traces change water color with a lower contrast than white foam', async ({ page }) => {
      await setup(page, api, 0);
      const result = await page.evaluate(async api => {
        const url = '/__ship-wave-probe.js', probe = await import(url);
        return probe.persistentWashVisibility(api, 'bubble');
      }, api);
      await test.info().attach('bubble-pixel-readback', { body: JSON.stringify(result), contentType: 'application/json' });
      expect(result.wash[1] - result.background[1], JSON.stringify(result)).toBeGreaterThan(0.002);
      expect(result.visibleIncrease).toBeGreaterThan(0);
      expect(result.visibleIncrease).toBeLessThan(0.025);
      expect(result.cleared).toEqual(result.background);
      expect(result.identity.api).toBe(api === 'webgpu' ? 'WebGPUBackend' : 'WebGLBackend');
    });
    test('fine and long foam overlap blends without adding brightness', async ({ page }) => {
      await setup(page, api, 0);
      const result = await page.evaluate(async api => {
        const url = '/__ship-wave-probe.js', probe = await import(url);
        return probe.persistentWashVisibility(api, 'blend');
      }, api);
      expect(result.visibleIncrease).toBeGreaterThan(0.05);
      expect(result.visibleIncrease).toBeLessThan(0.065);
      expect(result.cleared).toEqual(result.background);
    });
    test('hull foam forms on both sides while a calm stationary hull stays clear', async ({ page }) => {
      await setup(page, api, 0);
      await page.evaluate(() => window.__shipHistoryFixture!.advanceTo(5));
      const idle = await page.evaluate(() => window.__shipHistoryFixture!.read());
      expect(idle.hullFoamArea).toBe(0); expect(idle.bubbleArea).toBe(0); expect(idle.washFoamArea).toBe(0);
      await page.evaluate(() => {
        const f = window.__shipHistoryFixture!; f.setSpeed(15); f.reset(); f.advanceTo(6);
      });
      const samples = await page.evaluate(async () => {
        const f = window.__shipHistoryFixture!;
        return { port: await f.sampleFoam(-10, 90), starboard: await f.sampleFoam(10, 90),
          ahead: await f.sampleFoam(0, 210), outside: await f.sampleFoam(70, 90), field: await f.read() };
      });
      await test.info().attach('hull-field-readback', { body: JSON.stringify(samples), contentType: 'application/json' });
      expect(samples.port.fine[0]).toBeGreaterThan(0.008);
      expect(samples.starboard.fine[0]).toBeGreaterThan(0.008);
      // 艏部历史可被随后经过的船体遮住；局部性以船外可见水面检验。
      expect(samples.port.fine[0]).toBeGreaterThan(samples.ahead.fine[0] * 5);
      expect(samples.starboard.fine[0]).toBeGreaterThan(samples.outside.fine[0] * 5);
      expect(samples.field.hullFoamArea).toBeGreaterThan(5);
    });
    for (const [vessel, speed, halfBeam] of [['cruise', 9.3, 18.6], ['lng', 9.8, 22.5],
      ['container', 10.3, 30.75], ['icebreaker', 8, 11.15], ['dredger', 6, 11.5]] as const) {
      test(`${vessel} waterline calibration places localized foam on both hull sides`, async ({ page }) => {
        await setup(page, api, speed, 'straight', vessel);
        await page.evaluate(() => window.__shipHistoryFixture!.advanceTo(4));
        const samples = await page.evaluate(async ({ speed, halfBeam }) => {
          const f = window.__shipHistoryFixture!;
          return { port: await f.sampleFoam(-halfBeam, speed * 4), starboard: await f.sampleFoam(halfBeam, speed * 4),
            outside: await f.sampleFoam(halfBeam + 50, speed * 4), field: await f.read() };
        }, { speed, halfBeam });
        expect(samples.port.fine[0]).toBeGreaterThan(0.008);
        expect(samples.starboard.fine[0]).toBeGreaterThan(0.008);
        expect(samples.starboard.fine[0]).toBeGreaterThan(samples.outside.fine[0] * 5);
        expect(samples.field.hullFoamArea).toBeGreaterThan(5);
      });
    }
    test('wave-excited platform foam stays at four columns and leaves the opening clear', async ({ page }) => {
      await setup(page, api, 0, 'straight', 'drilling', true);
      const result = await page.evaluate(async () => {
        const f = window.__shipHistoryFixture!; f.setSources(true, true); f.advanceTo(5);
        const columns = [];
        for (const x of [-38.7, 38.7]) for (const z of [-33.06, 33.06]) columns.push(await f.sampleFoam(x, z));
        return { columns, opening: await f.sampleFoam(0, 0), field: await f.read() };
      });
      expect(result.columns.every(column => column.fine[0] > 0.015), JSON.stringify(result)).toBe(true);
      expect(result.opening.fine[0]).toBeLessThan(0.005);
      expect(result.field.hullFoamArea).toBeGreaterThan(20);
      expect(result.field.energy).toBe(0); expect(result.field.shipBreakingFoamArea).toBe(0);
    });
    test('long history survives a moved and turned fine window, decays and replays', async ({ page }) => {
      await setup(page, api, 0);
      const initial = await page.evaluate(async () => {
        const f = window.__shipHistoryFixture!;
        f.setJets([{ x: 0, z: 0, headingRad: 0, activity: 1, diameterMeters: 5, depthMeters: 3 }]);
        f.advanceTo(6); return f.read();
      });
      const retained = await page.evaluate(async () => {
        const f = window.__shipHistoryFixture!; f.setSources(false, false); f.setJets([]);
        f.setPose({ x: 2000, z: 1000, headingRad: Math.PI / 2, speedMps: 0 }); f.advanceTo(66);
        return { field: await f.read(), oldLocation: await f.sampleFoam(39, -6) };
      });
      expect(retained.field.trailFoamArea / initial.trailFoamArea).toBeCloseTo(2 ** (-60 / 24), 2);
      expect(retained.field.bubbleArea / initial.bubbleArea).toBeCloseTo(2 ** (-60 / 90), 2);
      expect(retained.oldLocation.fine[0]).toBe(0);
      expect(retained.oldLocation.trail[1]).toBeGreaterThan(0.001);
      expect(retained.field.bubbleCentroid[0] - initial.bubbleCentroid[0]).toBeCloseTo(39, 0);
      expect(retained.field.bubbleCentroid[1] - initial.bubbleCentroid[1]).toBeCloseTo(13.2, 0);
      expect(await page.evaluate(() => window.__shipHistoryFixture!.read())).toEqual(retained.field);
      const reset = await page.evaluate(async () => { const f = window.__shipHistoryFixture!; f.reset(); return f.read(); });
      expect(reset.bubbleArea).toBe(0); expect(reset.trailFoamArea).toBe(0); expect(reset.hullFoamArea).toBe(0);
      const replay = await page.evaluate(async () => {
        const f = window.__shipHistoryFixture!; f.setPose(null); f.setSources(true, false);
        f.setJets([{ x: 0, z: 0, headingRad: 0, activity: 1, diameterMeters: 5, depthMeters: 3 }]);
        f.advanceTo(6); return f.read();
      });
      expect(replay.bubbleArea).toBeCloseTo(initial.bubbleArea, 5);
      expect(replay.trailFoamArea).toBeCloseTo(initial.trailFoamArea, 5);
    });
    for (const [vessel, foamHalfLife, bubbleHalfLife] of [
      ['destroyer', 24, 90], ['cruise', 30, 110], ['lng', 28, 100], ['container', 30, 120],
      ['icebreaker', 22, 80], ['dredger', 18, 65], ['drilling', 16, 60],
    ] as const) {
      test(`${vessel} calibration drives separate actual GPU foam and bubble lifetimes`, async ({ page }) => {
        await setup(page, api, 0, 'straight', vessel);
        const initial = await page.evaluate(async () => {
          const f = window.__shipHistoryFixture!;
          f.setJets([{ x: 0, z: 0, headingRad: 0, activity: 1, diameterMeters: 5, depthMeters: 3 }]);
          f.advanceTo(4); return f.read();
        });
        const stopped = await page.evaluate(async () => {
          const f = window.__shipHistoryFixture!; f.setSources(false, false); f.setJets([]); f.advanceTo(12); return f.read();
        });
        expect(initial.trailFoamArea).toBeGreaterThan(20); expect(initial.bubbleArea).toBeGreaterThan(1);
        expect(initial.hullFoamArea).toBe(0); expect(initial.energy).toBe(0);
        expect(stopped.trailFoamArea / initial.trailFoamArea).toBeCloseTo(2 ** (-8 / foamHalfLife), 2);
        expect(stopped.bubbleArea / initial.bubbleArea).toBeCloseTo(2 ** (-8 / bubbleHalfLife), 2);
      });
    }
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
      expect(retained.washFoamArea / initial.washFoamArea).toBeCloseTo(2 ** (-10 / 24), 2);
      expect(await page.evaluate(() => window.__shipHistoryFixture!.read())).toEqual(retained);
    });
  });
}
