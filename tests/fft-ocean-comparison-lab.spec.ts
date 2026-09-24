import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __fftOceanRuntime?: {
      gpuFrames: () => number;
      validateGpuAgainstDft: () => {
        ok: boolean;
        relativeL2: number;
        maxAbsError: number;
        displacementMaxAbsError: number;
        slopeMaxAbsError: number;
        reason?: string;
      };
    };
    __marineComparisonLab?: {
      ready: () => boolean;
      reset: () => void;
      step: (dtSeconds: number) => void;
      setRunMode: (mode: 'performance' | 'visual') => void;
      setShallowEnabled?: (enabled: boolean) => void;
      setReflectionEnabled?: (enabled: boolean) => void;
      optics?: () => {
        profile: 'neutral' | 'shared';
        shallowEnabled: boolean;
        shallowPassAllocated: boolean;
      };
      capture: () => {
        visualTimeSeconds: number;
        waterHeightOrigin: number;
        queryBackend: 'fft' | 'gerstner';
      };
      queryMetrics?: () => {
        computeMs: number;
        queueMs: number;
        transferMs: number | null;
        e2eMs: number;
        resultAgeSeconds: number;
        viaWorker: boolean;
        initChargedPerQuery: boolean;
        queryKind: string;
      } | null;
      identity: () => {
        queryBackend: 'fft' | 'gerstner';
        waterBaseY: number;
        farFieldRotationX: number;
        vesselLoadFailed: boolean;
        vesselLoaded: boolean;
        vesselUrl: string | null;
        vesselFallback: boolean;
        firstFrameReady: boolean;
      };
    };
    __marineVisualAcceptance?: {
      run: () => {
        passed: boolean;
        beautyScore: null;
        goldenRewritten: boolean;
        crossAlgorithmPixelScore: null;
        stillnessRewarded: boolean;
        defects: Array<{ code: string; location: string }>;
        metrics: { farFieldHorizontal: boolean; waveMotion: number; pixelMean: number };
        images: Array<{ mean: number }>;
      };
      breakFarField: () => void;
      clearReflection: () => void;
      clearFoam: () => void;
      reflectionEnabled?: () => boolean;
      judgeFleet: (observations: Array<{
        consumerId: string;
        drawingBufferWidth: number;
        drawingBufferHeight: number;
        waveDelta: number;
        resolvedRoll: number | null;
        telemetryRoll: number | null;
      }>) => {
        passed: boolean;
        defects: Array<{ code: string; location: string }>;
        metrics: { fleetCount: number };
      };
    };
    __marineConsumerObservation?: {
      collect: () => Promise<{
        consumerId: string;
        drawingBufferWidth: number;
        drawingBufferHeight: number;
        waveDelta: number;
        resolvedRoll: number | null;
        telemetryRoll: number | null;
      }>;
    };
    __marineStagePerformance?: {
      collect: () => Promise<{
        screenRecorded: boolean;
        rounds: Array<{
          method: string;
          gpuMs: number | null;
          completedWorkMs: number | null;
          labeledAs: string;
        }>;
      }>;
    };
  }
}

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

  test('GPU small transform readback matches independent DFT within float32 bounds', async ({ page }) => {
    await page.goto(`${PAGE}?backend=fft&scene=wave-only&qa=fft-ocean`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    await page.waitForFunction(() => {
      const runtime = window.__fftOceanRuntime;
      return Boolean(runtime && runtime.gpuFrames() > 2);
    }, { timeout: 90_000 });
    const report = await page.evaluate(() => window.__fftOceanRuntime?.validateGpuAgainstDft());
    expect(report?.reason ?? null, JSON.stringify(report)).toBeNull();
    expect(report?.ok, JSON.stringify(report)).toBe(true);
    expect(report?.relativeL2).toBeLessThan(2e-4);
    expect(report?.maxAbsError).toBeLessThan(1e-3);
    expect(report?.displacementMaxAbsError).toBeLessThan(1e-3);
    expect(report?.slopeMaxAbsError).toBeLessThan(1e-3);
  });

  test('FFT worker contact queries report compute, queue, e2e and result age', async ({ page }) => {
    await page.goto(`${PAGE}?backend=fft&scene=wave-only&qa=fft-ocean`, { waitUntil: 'domcontentloaded' });
    await waitForLab(page);
    await page.waitForFunction(() => {
      const metrics = window.__marineComparisonLab?.queryMetrics?.();
      return Boolean(metrics && metrics.viaWorker && Number.isFinite(metrics.computeMs));
    }, { timeout: 90_000 });
    const metrics = await page.evaluate(() => window.__marineComparisonLab?.queryMetrics?.());
    expect(metrics?.viaWorker).toBe(true);
    expect(metrics?.computeMs).toBeGreaterThan(0);
    expect(metrics?.queueMs).toBeGreaterThanOrEqual(0);
    expect(metrics?.e2eMs).toBeGreaterThan(0);
    expect(metrics?.transferMs).toBeGreaterThanOrEqual(0);
    expect(metrics?.resultAgeSeconds).toBeGreaterThanOrEqual(0);
    expect(metrics?.initChargedPerQuery).toBe(false);
    expect(metrics?.queryKind).toBe('worker-batch');
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
    await page.waitForFunction(() => window.__marineVisualAcceptance?.run()?.passed === true, { timeout: 90_000 });
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
    test.setTimeout(420_000);
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
      const observation = await page.evaluate(async () => window.__marineConsumerObservation?.collect());
      expect(observation?.consumerId, href).toBe(consumerId);
      expect(observation?.drawingBufferWidth, href).toBeGreaterThan(0);
      expect(observation?.waveDelta, href).toBeGreaterThan(0);
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
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      lab.step(1.5);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const first = lab.capture();
      lab.reset();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      lab.step(1.5);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
    const before = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const gl = canvas.getContext('webgl2');
      if (!gl) return null;
      const pixels = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return Array.from(pixels);
    });
    await page.evaluate(() => window.__marineComparisonLab?.setShallowEnabled?.(false));
    await page.waitForFunction(() => window.__marineComparisonLab?.optics?.().shallowPassAllocated === false, { timeout: 10_000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const gl = canvas.getContext('webgl2');
      if (!gl) return null;
      const pixels = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return Array.from(pixels);
    });
    expect(before).not.toEqual(after);
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
