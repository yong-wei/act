import { describe, expect, it } from 'vitest';

import { GERSTNER_WATER_BASE_Y, GERSTNER_WATER_SIZE, NEAR_FIELD_MESH_SPEC } from '@/resources/simulations/scene/water';

import {
  COMPARISON_FEATURE_MATRIX,
  COMPARISON_ROUTES,
  comparisonFarFieldRing,
  comparisonRouteKey,
  composeWaterDatum,
  isHorizontalFarField,
  labIsReady,
  parseComparisonBackend,
  parseComparisonGraphicsApi,
  parseComparisonScene,
  vesselPitchFromSamples,
  type ComparisonLabIdentity,
} from '../comparison-lab';
import { shallowPathAbsorption } from '@/resources/simulations/scene/water/shared-water-optics';
import { createFftOceanCompressionSampler, fftOceanStaticSpectrum } from '@/resources/simulations/scene/water/fft-ocean';

function identity(overrides: Partial<ComparisonLabIdentity> = {}): ComparisonLabIdentity {
  const farField = comparisonFarFieldRing();
  return {
    backend: 'fft',
    scene: 'wave-only',
    runMode: 'performance',
    queryBackend: 'fft',
    waterBaseY: farField.baseY,
    farFieldRotationX: farField.rotationX,
    farFieldInnerHalfExtent: farField.innerHalfExtent,
    farFieldOuterHalfExtent: farField.outerHalfExtent,
    vesselPackageId: 'type055-nanchang-101',
    vesselUrl: '/assets/model-releases/type055-nanchang-101/v2.2.1/models/type055-nanchang-101-ship-lod2.glb',
    vesselFallback: false,
    vesselLoaded: true,
    vesselLoadFailed: false,
    firstFrameReady: true,
    ...overrides,
  };
}

describe('comparison lab helpers (#2130)', () => {
  it('parses backend and scene without inventing extra routes', () => {
    expect(parseComparisonBackend(undefined)).toBe('fft');
    expect(parseComparisonBackend('gerstner')).toBe('gerstner');
    expect(parseComparisonBackend('webgpu')).toBe('fft');
    expect(parseComparisonGraphicsApi('webgpu')).toBe('webgpu');
    expect(parseComparisonGraphicsApi('webgl')).toBe('webgl');
    expect(parseComparisonGraphicsApi(undefined)).toBe('webgl');
    expect(COMPARISON_ROUTES.map((route) => comparisonRouteKey(route.api, route.backend))).toEqual([
      'webgl-fft',
      'webgl-gerstner',
      'webgpu-fft',
      'webgpu-gerstner',
    ]);
    expect(parseComparisonScene(undefined)).toBe('wave-only');
    expect(parseComparisonScene('feature-parity')).toBe('feature-parity');
  });

  it('places the far-field ring on XZ at the shared Gerstner water datum', () => {
    const ring = comparisonFarFieldRing();
    expect(ring.baseY).toBe(GERSTNER_WATER_BASE_Y);
    expect(ring.innerHalfExtent).toBe(NEAR_FIELD_MESH_SPEC.size / 2);
    expect(ring.outerHalfExtent).toBe(GERSTNER_WATER_SIZE / 2);
    expect(isHorizontalFarField(ring.rotationX)).toBe(true);
    expect(isHorizontalFarField(0)).toBe(false);
  });

  it('adds displacement onto the shared datum instead of a second origin', () => {
    expect(composeWaterDatum(GERSTNER_WATER_BASE_Y, 0.4)).toBeCloseTo(GERSTNER_WATER_BASE_Y + 0.4);
  });

  it('derives pitch from bow/stern samples of the selected surface', () => {
    expect(vesselPitchFromSamples(2, 0, 170)).toBeCloseTo(Math.atan2(2, 170));
  });

  it('keeps feature-parity optics on both routes and leaves wave-only neutral', () => {
    expect(COMPARISON_FEATURE_MATRIX['feature-parity'].optics).toBe('shared');
    expect(COMPARISON_FEATURE_MATRIX['feature-parity'].shallow).toBe(true);
    expect(COMPARISON_FEATURE_MATRIX['feature-parity'].ibl).toBe(true);
    expect(COMPARISON_FEATURE_MATRIX['wave-only'].optics).toBe('neutral');
    expect(COMPARISON_FEATURE_MATRIX['wave-only'].shallow).toBe(false);
    const shallow = shallowPathAbsorption(4);
    const deep = shallowPathAbsorption(18);
    expect(shallow).toBeGreaterThan(deep);
    expect(shallow).toBeCloseTo(Math.exp(-4 * 0.55), 6);
    expect(deep).toBeCloseTo(Math.exp(-18 * 0.55), 6);
    const spectrum = fftOceanStaticSpectrum({
      resolution: 32,
      domainMeters: 256,
      windSpeedMps: 12,
      windDirectionRad: 0.2,
      seaState: 4,
      seed: 17,
    });
    const compressionAt = createFftOceanCompressionSampler(spectrum, 256);
    const crest = compressionAt(12, -8, 1.5);
    const again = compressionAt(12, -8, 1.5);
    expect(crest).toBe(again);
    expect(crest).toBeGreaterThanOrEqual(0);
    expect(crest).toBeLessThanOrEqual(1);
    expect(Number.isFinite(compressionAt(40, 20, 2.2))).toBe(true);
  });

  it('treats a failed vessel load as ready-failed, never as a box success', () => {
    expect(labIsReady(identity({ firstFrameReady: false }))).toBe(false);
    expect(labIsReady(identity({ vesselLoaded: false, vesselLoadFailed: true }))).toBe(true);
    expect(labIsReady(identity({ vesselLoaded: false, vesselLoadFailed: false }))).toBe(false);
  });
});
