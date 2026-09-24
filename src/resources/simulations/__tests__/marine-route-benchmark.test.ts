import { describe, expect, it } from 'vitest';

import {
  REQUIRED_M5_ROUTES,
  REQUIRED_M5_SCENES,
  assertProductionDefaultUnchanged,
  frameIntervalIsVsyncLocked,
  judgeMarineRouteBenchmark,
  type RouteObservation,
} from '@/resources/simulations/scene/quality/marine-route-benchmark';

function observation(overrides: Partial<RouteObservation> = {}): RouteObservation {
  return {
    route: 'webgl-gerstner',
    scene: 'wave-only',
    implemented: true,
    coreFeaturesPresent: true,
    hardwareContext: 'Apple M5',
    renderer: 'Apple M5',
    softwareFallback: false,
    frameP95Ms: 16.7,
    frameMedianMs: 16.7,
    gpuMs: 4,
    completedWorkMs: null,
    qualityScore: 0.8,
    pixelMean: 0.4,
    imagePath: 'images/webgl-gerstner-wave-only.png',
    evidenceKind: 'actual',
    hostUnavailable: false,
    ...overrides,
  };
}

function completeSet(overrides: Partial<RouteObservation> = {}): RouteObservation[] {
  return REQUIRED_M5_ROUTES.flatMap((route, routeIndex) => REQUIRED_M5_SCENES.map((scene, sceneIndex) => observation({
    route,
    scene,
    gpuMs: 4 + routeIndex + sceneIndex,
    qualityScore: 0.9 - routeIndex * 0.05,
    ...overrides,
  })));
}

describe('marine route benchmark (#2137)', () => {
  it('fails a stub route instead of calling the run a successful keep-current decision', () => {
    const observations = completeSet();
    observations[1] = observation({
      route: 'webgl-gerstner',
      scene: 'feature-parity',
      implemented: false,
      coreFeaturesPresent: false,
      gpuMs: null,
      qualityScore: null,
    });
    const report = judgeMarineRouteBenchmark({ observations });
    expect(report.passed).toBe(false);
    expect(report.adoption).toBe('not-adopted');
    expect(report.productionDefaultChanged).toBe(false);
    expect(report.failedRoutes).toContainEqual({
      route: 'webgl-gerstner',
      scene: 'feature-parity',
      reason: 'stub',
    });
    expect(report.rankedByMethod['gpu-elapsed'].some((point) => point.route === 'webgl-fft')).toBe(true);
  });

  it('does not rank vsync-locked frame time as gpu cost and ignores empty hardware', () => {
    expect(frameIntervalIsVsyncLocked(16.7)).toBe(true);
    expect(frameIntervalIsVsyncLocked(22)).toBe(false);
    const observations = completeSet({
      gpuMs: null,
      completedWorkMs: null,
      frameMedianMs: 16.7,
      frameP95Ms: 16.8,
    });
    observations[0] = observation({ hardwareContext: '   ', gpuMs: null, completedWorkMs: null });
    const report = judgeMarineRouteBenchmark({ observations });
    expect(report.passed).toBe(false);
    expect(report.failedRoutes[0]?.reason).toBe('missing-hardware');
    expect(report.rankedByMethod['frame-interval']).toHaveLength(0);
    expect(report.significantWinner).toBeNull();
  });

  it('keeps an unavailable webgpu host from voiding measured webgl routes', () => {
    const observations = completeSet();
    for (const item of observations) {
      if (item.route.startsWith('webgpu')) {
        Object.assign(item, {
          hostUnavailable: true,
          coreFeaturesPresent: false,
          gpuMs: null,
          qualityScore: null,
        });
      }
    }
    const report = judgeMarineRouteBenchmark({ observations });
    expect(report.passed).toBe(true);
    expect(report.unavailableRoutes.map((item) => item.route)).toEqual([
      'webgpu-gerstner',
      'webgpu-gerstner',
      'webgpu-fft',
      'webgpu-fft',
    ]);
    expect(report.significantWinner).toBe('webgl-gerstner');
  });

  it('refuses to change the production backend', () => {
    expect(() => assertProductionDefaultUnchanged(true)).toThrow(/production marine backend/);
  });
});
