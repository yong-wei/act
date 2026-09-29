import { expect, test, type Page } from '@playwright/test';

import type {} from '../src/app/simulations/fft-ocean-comparison/comparison-client';

const PAGE = '/simulations/fft-ocean-comparison';

async function waitForLab(page: Page, timeoutMs = 90_000) {
  await page.waitForSelector('[data-fft-comparison-page="true"]', { timeout: timeoutMs });
  await page.waitForFunction(() => Boolean(window.__marineComparisonLab?.ready()), { timeout: timeoutMs });
}

test.describe('FFT ocean comparison lab (#2130)', () => {
  test.setTimeout(120_000);
  test('loads the high-precision vessel on a horizontal far-field with shared water datum', async ({ page }) => {
    await page.goto(`${PAGE}?backend=fft&scene=wave-only&qa=fft-ocean`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    const identity = await page.evaluate(() => window.__marineComparisonLab?.identity());
    expect(identity?.queryBackend).toBe('fft');
    expect(identity?.waterBaseY).toBe(-1);
    expect(identity?.farFieldRotationX).toBeCloseTo(-Math.PI / 2);
    expect(identity?.vesselLoadFailed).toBe(false);
    expect(identity?.vesselLoaded).toBe(true);
    expect(identity?.vesselUrl).toBeTruthy();
    expect(identity?.vesselFallback).toBe(false);
  });

  for (const dpr of [1, 2]) {
    test.describe('GPU readback at DPR=' + dpr, () => {
      test.use({ deviceScaleFactor: dpr });
      test('GPU small transform readback matches independent DFT within float32 bounds', async ({ page }) => {
        await page.goto(`${PAGE}?backend=fft&scene=feature-parity&qa=fft-ocean`, { waitUntil: 'domcontentloaded' });
        await waitForLab(page);
        await page.waitForFunction(() => {
          const runtime = window.__comparisonOcean;
          return Boolean(runtime && runtime.identity().frames > 2);
        }, { timeout: 90_000 });
        const report = await page.evaluate(() => window.__comparisonOcean?.validate());
        expect(report?.ok, JSON.stringify(report)).toBe(true);
        expect(report?.relativeL2).toBeLessThan(2e-4);
        expect(report?.maxAbsError).toBeLessThan(1e-3);
        expect(report?.displacementMaxAbsError).toBeLessThan(1e-3);
      });
    });
  }

  test('combined GPU contact queries report readback latency and result age', async ({ page }) => {
    await page.goto(`${PAGE}?backend=fft&scene=wave-only&qa=fft-ocean`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    await page.waitForFunction(() => {
      const metrics = window.__marineComparisonLab?.queryMetrics?.();
      return Boolean(metrics && metrics.queryKind === 'gpu-surface' && Number.isFinite(metrics.e2eMs));
    }, { timeout: 90_000 });
    const metrics = await page.evaluate(() => window.__marineComparisonLab?.queryMetrics?.());
    expect(metrics?.viaWorker).toBe(false);
    expect(metrics?.computeMs).toBeNull();
    expect(metrics?.queueMs).toBeNull();
    expect(metrics?.e2eMs).toBeGreaterThan(0);
    expect(metrics?.transferMs).toBeNull();
    expect(metrics?.resultAgeSeconds).toBeGreaterThanOrEqual(0);
    expect(metrics?.initChargedPerQuery).toBe(false);
    expect(metrics?.queryKind).toBe('gpu-surface');
    const stage = await page.evaluate(async () => window.__marineStagePerformance?.collect());
    expect(stage?.screenRecorded).toBe(false);
    expect(stage?.rounds).toHaveLength(3);
    for (const round of stage?.rounds ?? []) {
      expect(round.method === 'gpu-elapsed' || round.method === 'completed-work').toBe(true);
      expect(round.labeledAs === 'frame-intervals').toBe(false);
      if (round.method === 'completed-work') expect(round.gpuMs).toBeNull();
      if (round.method === 'gpu-elapsed') expect(round.gpuMs).toBeGreaterThan(0);
    }
  });

  test('visual acceptance reads the live far field and rejects a broken mesh', async ({ page }) => {
    await page.goto(`${PAGE}?backend=gerstner&scene=wave-only`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    const live = await page.evaluate(() => window.__marineVisualAcceptance?.run());
    expect(live?.passed, JSON.stringify(live?.defects)).toBe(true);
    expect(live?.beautyScore).toBeNull();
    expect(live?.goldenRewritten).toBe(false);
    expect(live?.crossAlgorithmPixelScore).toBeNull();
    expect(live?.stillnessRewarded).toBe(false);
    expect(live?.metrics.farFieldHorizontal).toBe(true);
    expect(live?.metrics.waveMotion).toBeGreaterThan(0);
    expect(live?.metrics.pixelMean).toBeGreaterThan(0.02);
    await page.evaluate(() => window.__marineVisualAcceptance?.breakFarField());
    const broken = await page.evaluate(() => window.__marineVisualAcceptance?.run());
    expect(broken?.passed).toBe(false);
    expect(broken?.defects.map((defect) => defect.code)).toContain('vertical-far-field');
    expect(broken?.defects.some((defect) => defect.location === 'far-field.position')).toBe(true);
    expect(broken?.goldenRewritten).toBe(false);
  });

  test('feature-parity acceptance fails when the running reflection is removed', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`${PAGE}?backend=gerstner&scene=feature-parity`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    await page.waitForFunction(async () => (await window.__marineVisualAcceptance?.run())?.passed === true, { timeout: 90_000 });
    await page.evaluate(() => {
      window.__marineComparisonLab?.setReflectionEnabled?.(false);
      window.__marineVisualAcceptance?.clearFoam();
    });
    await page.waitForFunction(() => window.__marineVisualAcceptance?.reflectionEnabled?.() === false);
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
    }));
    const broken = await page.evaluate(() => window.__marineVisualAcceptance?.run());
    expect(broken?.passed, JSON.stringify(broken)).toBe(false);
    const codes = (broken?.defects ?? []).map((defect) => defect.code);
    expect(codes, JSON.stringify(broken)).toContain('reflection-missing');
    expect(codes).toContain('foam-disabled');
    expect((broken?.images ?? []).some((image) => image.mean > 0.02)).toBe(true);
  });

  test('seven production routes report live canvases to the fleet judgment', async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const routes = [
      ['/simulations/destroyer', 'destroyer'],
      ['/simulations/lng', 'lng'],
      ['/simulations/container', 'container'],
      ['/simulations/icebreaker', 'icebreaker'],
      ['/simulations/cruise', 'cruise'],
      ['/simulations/drilling', 'drilling'],
      ['/simulations/dredger', 'dredger'],
    ] as const;
    const observations = [];
    for (const [href, consumerId] of routes) {
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForFunction(() => typeof window.__marineConsumerObservation?.collect === 'function', { timeout: 90_000 });
      const restore = page.locator('[data-simulation-panel-restore-handle="right"]');
      if (await restore.count()) await restore.click();
      const start = page.locator('[data-sound-start]');
      await expect(start.first()).toBeVisible({ timeout: 30_000 });
      await start.first().click();
      const observation = await page.evaluate(async () => window.__marineConsumerObservation?.collect());
      if (!observation) throw new Error(`Missing fleet observation: ${href}`);
      expect(observation?.consumerId, href).toBe(consumerId);
      expect(observation?.drawingBufferWidth, href).toBeGreaterThan(0);
      expect(observation?.pixelMean, href).toBeGreaterThan(0.02);
      expect(observation?.waveDelta, href).toBeGreaterThan(0);
      expect(observation?.shipRadius, href).toBeGreaterThan(1);
      expect(observation?.shipYaw, href).not.toBeNull();
      const shipDynamicsMoved = (observation?.horizontalDelta ?? 0) > 1e-4
        || (observation?.yawDelta ?? 0) > 1e-4
        || (observation?.propulsionDelta ?? 0) > 1e-4;
      expect(shipDynamicsMoved, `${href} ${JSON.stringify(observation)}`).toBe(true);
      if (consumerId === 'cruise') {
        expect(observation?.telemetryRoll, href).not.toBeNull();
        expect(observation?.resolvedRoll, href).toBeCloseTo(observation?.telemetryRoll ?? 0, 3);
        expect(observation?.rollDelta, href).toBeGreaterThan(1e-4);
      }
      observations.push(observation);
    }
    await page.goto(`${PAGE}?backend=gerstner&scene=wave-only`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    const report = await page.evaluate(async (items) => window.__marineVisualAcceptance?.judgeFleet(items), observations);
    expect(report?.passed, JSON.stringify(report?.defects)).toBe(true);
    expect(report?.metrics.fleetCount).toBe(7);
  });

  test('replays the same visual time after reset and step', async ({ page }) => {
    await page.goto(`${PAGE}?backend=gerstner&scene=wave-only`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    const pair = await page.evaluate(async () => {
      const lab = window.__marineComparisonLab;
      if (!lab) throw new Error('lab missing');
      lab.setRunMode('visual');
      lab.reset();
      await new Promise<void>(resolve => {
        const wait = () => lab.ready() ? resolve() : requestAnimationFrame(wait);
        requestAnimationFrame(wait);
      });
      lab.step(1.5);
      await new Promise<void>(resolve => {
        const wait = () => lab.ready() ? resolve() : requestAnimationFrame(wait);
        requestAnimationFrame(wait);
      });
      const first = lab.capture();
      lab.reset();
      await new Promise<void>(resolve => {
        const wait = () => lab.ready() ? resolve() : requestAnimationFrame(wait);
        requestAnimationFrame(wait);
      });
      lab.step(1.5);
      await new Promise<void>(resolve => {
        const wait = () => lab.ready() ? resolve() : requestAnimationFrame(wait);
        requestAnimationFrame(wait);
      });
      const second = lab.capture();
      return { first, second };
    });
    expect(pair.first.queryBackend).toBe('gerstner');
    expect(pair.second.visualTimeSeconds).toBeCloseTo(pair.first.visualTimeSeconds, 5);
    expect(pair.second.waterHeightOrigin).toBeCloseTo(pair.first.waterHeightOrigin, 5);
  });

  test('feature-parity shallow refraction changes the visible water color', async ({ page }) => {
    await page.goto(`${PAGE}?backend=fft&scene=feature-parity`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    await page.waitForFunction(() => window.__marineComparisonLab?.optics?.().profile === 'shared', { timeout: 30_000 });
    await page.evaluate(() => {
      window.__marineComparisonLab!.setRunMode('visual');
      window.__marineComparisonLab!.reset();
      window.__marineComparisonLab!.step(3);
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const before = await page.screenshot();
    await page.evaluate(() => window.__marineComparisonLab?.setShallowEnabled?.(false));
    await page.waitForFunction(() => window.__marineComparisonLab?.optics?.().shallowPassAllocated === false);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await page.screenshot();
    expect(before.equals(after)).toBe(false);
  });

  test('failed vessel load is reported and does not fall back to a success box', async ({ page }) => {
    await page.goto(`${PAGE}?backend=fft&vessel=missing`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-fft-comparison-page="true"]', { timeout: 60_000 });
    await page.waitForFunction(() => {
      const identity = window.__marineComparisonLab?.identity();
      return Boolean(identity?.firstFrameReady && identity.vesselLoadFailed);
    }, { timeout: 90_000 });
    const identity = await page.evaluate(() => window.__marineComparisonLab?.identity());
    expect(identity?.vesselLoaded).toBe(false);
    expect(identity?.vesselLoadFailed).toBe(true);
    expect(identity?.vesselUrl).toBeNull();
    const boxCount = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? 1 : 0;
    });
    expect(boxCount).toBe(1);
  });
});
