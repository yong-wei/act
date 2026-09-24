import { describe, expect, it } from 'vitest';

import { isHorizontalFarField } from '@/app/simulations/fft-ocean-comparison/comparison-lab';
import {
  commitGoldenUpdate,
  healthyWaveOnlyScene,
  reflectionDiagnostic,
  runMarineVisualAcceptance,
} from '@/resources/simulations/scene/quality/visual-acceptance';

const HORIZONTAL = -Math.PI / 2;

describe('marine visual acceptance (#2136)', () => {
  it('passes the horizontal wave-only scene without a beauty score or golden rewrite', () => {
    const report = runMarineVisualAcceptance(healthyWaveOnlyScene(HORIZONTAL));
    expect(report.passed, JSON.stringify(report.defects)).toBe(true);
    expect(report.beautyScore).toBeNull();
    expect(report.goldenRewritten).toBe(false);
    expect(report.crossAlgorithmPixelScore).toBeNull();
    expect(report.stillnessRewarded).toBe(false);
    expect(report.metrics.waveMotionMeters).toBeGreaterThan(0.05);
    expect(report.metrics.observedFrameDelta).toBeGreaterThan(0);
    expect(report.fleet).toHaveLength(7);
    expect(report.fleet.map((ship) => ship.caseId).sort()).toEqual(
      ['container', 'cruise', 'destroyer', 'ice', 'lng', 'platform', 'shallow-water'].sort(),
    );
    const cruise = report.fleet.find((ship) => ship.caseId === 'cruise');
    expect(cruise?.resolvedRoll).toBe(0.21);
    expect(report.images.some((image) => image.mean !== 0 || image.width > 1)).toBe(true);
  });

  it('matches the comparison far-field horizontal contract', () => {
    for (const rotation of [0, Math.PI / 2, -Math.PI / 2, -1]) {
      const report = runMarineVisualAcceptance({
        ...healthyWaveOnlyScene(rotation),
      });
      const vertical = report.defects.some((defect) => defect.code === 'vertical-far-field');
      expect(vertical).toBe(!isHorizontalFarField(rotation));
      if (vertical) {
        expect(report.defects.find((defect) => defect.code === 'vertical-far-field')?.location).toBe('far-field.rotationX');
      }
    }
  });

  it('rejects a nonblank image when reflection, normals, foam, motion or sharpness are wrong', () => {
    const disabled = reflectionDiagnostic(false);
    expect(disabled.water.every((value) => value > 0)).toBe(true);
    const bad = runMarineVisualAcceptance({
      ...healthyWaveOnlyScene(0),
      reflectionRequired: true,
      reflectionEnabled: false,
      foamRequired: true,
      foamEnabled: false,
      normalsEnabled: false,
      frozen: true,
      blurred: true,
      nonblank: true,
      waterlinePitchOverride: 0,
    });
    expect(bad.passed).toBe(false);
    expect(bad.beautyScore).toBeNull();
    expect(bad.stillnessRewarded).toBe(false);
    expect(bad.goldenRewritten).toBe(false);
    const codes = bad.defects.map((defect) => defect.code);
    expect(codes).toContain('vertical-far-field');
    expect(codes).toContain('reflection-missing');
    expect(codes).toContain('frozen-surface');
    expect(codes).toContain('excess-blur');
    expect(codes).toContain('foam-disabled');
    expect(codes).toContain('normal-disabled');
    expect(codes).toContain('waterline-pitch');
    expect(bad.images.some((image) => image.id === 'reflection-water' && image.mean > 0)).toBe(true);
    expect(bad.metrics.blurRatio).toBeLessThan(0.45);
    expect(bad.metrics.foamCoverage).toBe(0);
  });

  it('does not rewrite a golden image unless review explicitly allows it', () => {
    const failed = runMarineVisualAcceptance({
      ...healthyWaveOnlyScene(0),
      reflectionRequired: true,
      reflectionEnabled: false,
    });
    expect(commitGoldenUpdate(failed, { updateGolden: false, reviewed: false }).goldenRewritten).toBe(false);
    expect(() => commitGoldenUpdate(failed, { updateGolden: true, reviewed: false })).toThrow(/explicit review/);
    expect(commitGoldenUpdate(failed, { updateGolden: true, reviewed: true }).goldenRewritten).toBe(true);
  });
});
