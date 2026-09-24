import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { resolveMarineVisualPose } from '@/resources/simulations/scene/frame/marine-frame';
import {
  FLEET_CONSUMER_IDS,
  commitGoldenUpdate,
  farFieldIsHorizontal,
  judgeFleetObservations,
  judgeMarineObservation,
  measurePositionSpans,
  shipHeadingChannel,
  type MarineSceneObservation,
} from '@/resources/simulations/scene/quality/visual-acceptance';

function spansOf(geometry: THREE.BufferGeometry) {
  return measurePositionSpans(geometry.getAttribute('position').array);
}

function observation(overrides: Partial<MarineSceneObservation> = {}): MarineSceneObservation {
  const horizontal = new THREE.PlaneGeometry(4000, 4000);
  horizontal.rotateX(-Math.PI / 2);
  return {
    drawingBufferWidth: 1280,
    drawingBufferHeight: 720,
    farField: spansOf(horizontal),
    planarReflectionStrength: null,
    foamFieldPresent: false,
    waveHeights: [0.2, 1.1],
    normalSlope: 0.04,
    pixelMean: 0.31,
    reflectionPixelMean: null,
    reportedPitch: 0.02,
    contactPitch: 0.02,
    ...overrides,
  };
}

describe('marine visual acceptance (#2136)', () => {
  it('reads a rotated far-field geometry as horizontal and a raw plane as vertical', () => {
    const horizontal = new THREE.PlaneGeometry(4000, 4000);
    horizontal.rotateX(-Math.PI / 2);
    const vertical = new THREE.PlaneGeometry(4000, 4000);
    expect(farFieldIsHorizontal(spansOf(horizontal))).toBe(true);
    expect(farFieldIsHorizontal(spansOf(vertical))).toBe(false);
    const live = judgeMarineObservation(observation(), {
      reflectionRequired: false,
      foamRequired: false,
    });
    expect(live.passed, JSON.stringify(live.defects)).toBe(true);
    expect(live.beautyScore).toBeNull();
    expect(live.goldenRewritten).toBe(false);
    expect(live.crossAlgorithmPixelScore).toBeNull();
    expect(live.stillnessRewarded).toBe(false);
    expect(live.metrics.pixelMean).toBeGreaterThan(0.02);
    const blank = judgeMarineObservation(observation({ pixelMean: 0 }), {
      reflectionRequired: false,
      foamRequired: false,
    });
    expect(blank.defects.map((defect) => defect.code)).toContain('canvas-blank');
    const darkReflection = judgeMarineObservation(observation({
      planarReflectionStrength: 0.85,
      reflectionPixelMean: 0,
    }), {
      reflectionRequired: true,
      foamRequired: false,
    });
    expect(darkReflection.defects.map((defect) => defect.code)).toContain('reflection-missing');
  });

  it('rejects a nonblank canvas when the measured scene lost reflection, motion, foam or slope', () => {
    const bad = judgeMarineObservation(observation({
      farField: spansOf(new THREE.PlaneGeometry(4000, 4000)),
      planarReflectionStrength: null,
      foamFieldPresent: false,
      waveHeights: [0.4, 0.4],
      normalSlope: 0,
      pixelMean: 0.22,
    }), {
      reflectionRequired: true,
      foamRequired: true,
    });
    expect(bad.passed).toBe(false);
    expect(bad.images[0]?.mean).toBeGreaterThan(0);
    const codes = bad.defects.map((defect) => defect.code);
    expect(codes).toContain('vertical-far-field');
    expect(codes).toContain('reflection-missing');
    expect(codes).toContain('foam-disabled');
    expect(codes).toContain('frozen-surface');
    expect(codes).not.toContain('normal-disabled');
    expect(bad.defects.every((defect) => defect.location.length > 0)).toBe(true);
    expect(bad.goldenRewritten).toBe(false);
  });

  it('requires drawing-buffer evidence from all seven consumers', () => {
    const cruisePose = resolveMarineVisualPose({
      ownership: { heave: 'visual-water', pitch: 'fixed', roll: 'telemetry' },
      visualWater: { heave: 0.4, pitch: 0.2, roll: 0.8 },
      telemetry: { roll: 0.21 },
    });
    const observations = FLEET_CONSUMER_IDS.map((consumerId) => ({
      consumerId,
      drawingBufferWidth: 960,
      drawingBufferHeight: 540,
      pixelMean: 0.4,
      waveDelta: 0.016,
      shipRadius: 40,
      shipX: 0,
      shipY: 0,
      shipZ: 0,
      shipYaw: 0.2,
      horizontalDelta: 0.05,
      yawDelta: 0,
      rollDelta: consumerId === 'cruise' ? 0.02 : 0,
      propulsionDelta: 0,
      resolvedRoll: consumerId === 'cruise' ? cruisePose.roll : null,
      telemetryRoll: consumerId === 'cruise' ? 0.21 : null,
    }));
    expect(judgeFleetObservations(observations).passed, JSON.stringify(judgeFleetObservations(observations).defects)).toBe(true);
    const black = observations.map((item) => (
      item.consumerId === 'destroyer' ? { ...item, pixelMean: 0, shipRadius: 0, shipX: null, shipYaw: null } : item
    ));
    const blackReport = judgeFleetObservations(black);
    expect(blackReport.passed).toBe(false);
    expect(blackReport.defects.map((defect) => defect.location)).toContain('fleet.destroyer.canvas');
    expect(blackReport.defects.map((defect) => defect.location)).toContain('fleet.destroyer.hull');
    expect(judgeFleetObservations(observations.slice(1)).defects.some((defect) => defect.location === 'fleet.destroyer')).toBe(true);
    const drifted = observations.map((item) => (
      item.consumerId === 'cruise' ? { ...item, resolvedRoll: 0.8 } : item
    ));
    expect(judgeFleetObservations(drifted).defects.some((defect) => defect.location === 'fleet.cruise.roll')).toBe(true);
    const stationKeeping = observations.map((item) => (
      item.consumerId === 'dredger'
        ? { ...item, horizontalDelta: 0, yawDelta: 0, propulsionDelta: 0.4 }
        : item
    ));
    expect(judgeFleetObservations(stationKeeping).passed, JSON.stringify(judgeFleetObservations(stationKeeping).defects)).toBe(true);
    const frozen = observations.map((item) => ({ ...item, horizontalDelta: 0, yawDelta: 0, propulsionDelta: 0 }));
    expect(judgeFleetObservations(frozen).defects.some((defect) => defect.code === 'frozen-surface' && defect.location === 'fleet.destroyer.hull')).toBe(true);
    const skippedRoll = observations.map((item) => (
      item.consumerId === 'cruise' ? { ...item, resolvedRoll: null, telemetryRoll: null } : item
    ));
    expect(judgeFleetObservations(skippedRoll).defects.some((defect) => defect.location === 'fleet.cruise.roll')).toBe(true);
    const stillRoll = observations.map((item) => (
      item.consumerId === 'cruise' ? { ...item, rollDelta: 0 } : item
    ));
    expect(judgeFleetObservations(stillRoll).defects.some((defect) => defect.code === 'frozen-surface' && defect.location === 'fleet.cruise.roll')).toBe(true);
  });

  it('reads heading from the XYZ yaw channel so roll cannot impersonate it', () => {
    const hull = new THREE.Group();
    hull.rotation.set(0, 0.4, 0);
    hull.rotation.z = 0.55;
    const quaternion = hull.quaternion;
    const coupledYaw = Math.atan2(
      2 * (quaternion.w * quaternion.y + quaternion.x * quaternion.z),
      1 - 2 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z),
    );
    expect(shipHeadingChannel(hull.rotation.y)).toBeCloseTo(0.4);
    expect(Math.abs(coupledYaw - hull.rotation.y)).toBeGreaterThan(1e-3);
  });

  it('does not rewrite a golden image unless review explicitly allows it', () => {
    expect(commitGoldenUpdate({ updateGolden: false, reviewed: false }).goldenRewritten).toBe(false);
    expect(() => commitGoldenUpdate({ updateGolden: true, reviewed: false })).toThrow(/explicit review/);
    expect(commitGoldenUpdate({ updateGolden: true, reviewed: true }).goldenRewritten).toBe(true);
  });
});
