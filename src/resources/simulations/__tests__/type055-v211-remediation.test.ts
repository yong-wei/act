import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GERSTNER_SEA_STATE,
  gerstnerAmplitudeScale,
  GERSTNER_WAVE_SETS,
  GERSTNER_WATER_BASE_Y,
  sampleVisibleWaterHeight,
  computeGerstnerDisplacement,
} from '../scene/water';
import { resolveEmitterAnchors } from '../scene/wake/wake-trail';
import {
  TYPE055_NANCHANG_101_V2_1_0,
  isType055VersionedAssetUrl,
  shipLodUrlForQualityTier,
} from '../model-packages/type055-nanchang-101-v2';
import { validateReceivedModelPackage, type ModelPackageFileIo } from '../model-packages/model-package-validation';
import { advanceAttainment, createAttainmentState } from '../simulations/destroyer-simulation';
import { destroyer055SceneVisual } from '../profiles/destroyer-055-scene';

/**
 * #1996 Codex review 整改回归：
 * F1 共享波面坐标/振幅基准；F2 达标门（机动段才评估）；F3 双桨逐帧节点绑定；
 * F4 v2.1.0 运行时有序回退。
 */

describe('F1: visible water sampling shares the mesh-local coordinate basis', () => {
  const waves = GERSTNER_WAVE_SETS.high;
  const scale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);

  it('samples at mesh-local coordinates with the shared amplitude scale', () => {
    const originX = -6000;
    const originZ = 120;
    const t = 37.5;
    const sampled = sampleVisibleWaterHeight(waves, scale, originX, originZ, originX + 50, originZ - 20, t);
    const expected = GERSTNER_WATER_BASE_Y + scale * computeGerstnerDisplacement(waves, 50, -20, t).y;
    expect(sampled).toBeCloseTo(expected, 9);
  });

  it('differs from naive world-coordinate sampling at a non-origin ship position', () => {
    const originX = -6000;
    const t = 12.3;
    const shipLocal = sampleVisibleWaterHeight(waves, scale, originX, 0, originX, 0, t);
    const naiveWorld = GERSTNER_WATER_BASE_Y + computeGerstnerDisplacement(waves, originX, 0, t).y;
    // 非原点舰位：同一世界点的网格局部坐标是 (0,0)，朴素世界采样是另一波相
    expect(Math.abs(shipLocal - naiveWorld)).toBeGreaterThan(0.01);
  });

  it('matches the shader amplitude scale for the scene default sea state', () => {
    expect(gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE)).toBeCloseTo(0.3 + (3 - 1) * 0.34, 9);
  });
});

describe('F2: attainment requires entering a maneuver leg', () => {
  it('does not fire during the initial straight leg even with zero heading error', () => {
    const state = createAttainmentState(0);
    for (let i = 0; i < 100; i += 1) {
      expect(advanceAttainment(state, 0, 0, 5, 0.1)).toBe(false);
    }
    expect(state.dwell).toBe(0);
    expect(state.maneuverActive).toBe(false);
  });

  it('fires once after the target steps and the error settles within maxError for 3s', () => {
    const state = createAttainmentState(0);
    // 60s 目标阶跃 0° → 90°，误差先大后收敛
    expect(advanceAttainment(state, 90, 60, 5, 0.1)).toBe(false);
    expect(state.maneuverActive).toBe(true);
    let fired = 0;
    for (let i = 0; i < 29; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1)) fired += 1;
    }
    expect(fired).toBe(0);
    expect(advanceAttainment(state, 90, 1, 5, 0.1)).toBe(true);
    // 已触发后不重复记数，直到误差超过 2×maxError 重新武装
    expect(advanceAttainment(state, 90, 1, 5, 0.1)).toBe(false);
    expect(advanceAttainment(state, 90, 20, 5, 0.1)).toBe(false);
    let refired = 0;
    for (let i = 0; i < 30; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1)) refired += 1;
    }
    expect(refired).toBe(1);
  });

  it('recognizes a slowly ramping target (interpolation), not only per-step jumps', () => {
    const state = createAttainmentState(0);
    // headingPoints 线性插值使阶跃变成 18s 斜坡：逐子步目标增量远小于任何瞬时阈值
    let maneuverAt = -1;
    for (let i = 0; i < 300; i += 1) {
      const rampedTarget = Math.min(90, i * 0.5);
      advanceAttainment(state, rampedTarget, 0, 5, 0.1);
      if (maneuverAt < 0 && state.maneuverActive) maneuverAt = i;
    }
    expect(maneuverAt).toBeGreaterThan(0);
    expect(maneuverAt).toBeLessThan(20);
  });

  it('can fire while tracking a continuous ramp within tolerance (circle task semantics)', () => {
    const state = createAttainmentState(0);
    let fired = 0;
    // 定常回转：目标持续变化、跟踪误差始终在 maxError 内
    for (let i = 0; i < 600; i += 1) {
      if (advanceAttainment(state, i * 0.06, 10, 15, 1 / 60)) fired += 1;
    }
    expect(fired).toBeGreaterThanOrEqual(1);
  });
});

describe('F3: wake emitter anchors follow the propulsor node world position', () => {
  const position = [1000, 0, -2000] as const;

  it('uses the per-frame override world position when provided', () => {
    const override = [1005, 2.7, -2083] as const;
    const anchors = resolveEmitterAnchors(destroyer055SceneVisual, position, 0, override);
    expect(anchors.stern).toEqual([1005, 2.7, -2083]);
    // 肩部相对发射点按航向对称外推（heading=0：前方 = +Z）
    expect(anchors.portShoulder[0]).toBeCloseTo(1005 + 6, 6);
    expect(anchors.portShoulder[2]).toBeCloseTo(-2083 + 30, 6);
    expect(anchors.starboardShoulder[0]).toBeCloseTo(1005 - 6, 6);
  });

  it('falls back to the profile anchors when the override is null', () => {
    const anchors = resolveEmitterAnchors(destroyer055SceneVisual, position, 0, null);
    expect(anchors.stern).toEqual([1000, 0, -2090]);
    const fallback = resolveEmitterAnchors(destroyer055SceneVisual, position, 0);
    expect(fallback.stern).toEqual(anchors.stern);
  });
});

describe('F4: v2.1.0 stays in the runtime ordered fallback chain', () => {
  const PACKAGE_DIR_V210 = path.join(process.cwd(), 'public/assets/model-releases/type055-nanchang-101/v2.1.0');

  function v210Io(): ModelPackageFileIo {
    return {
      listFiles: () => readdirSync(PACKAGE_DIR_V210),
      sizeOf: (file) => statSync(path.join(PACKAGE_DIR_V210, file)).size,
      sha256: (file) => createHash('sha256').update(readFileSync(path.join(PACKAGE_DIR_V210, file))).digest('hex'),
    };
  }

  it('validates the on-disk v2.1.0 package against the fallback descriptor', () => {
    const receipt = validateReceivedModelPackage(TYPE055_NANCHANG_101_V2_1_0, v210Io());
    expect(receipt.modelVersion).toBe('2.1.0');
    expect(Object.keys(receipt.roles)).toHaveLength(7);
  });

  it('places the v2.1.0 LOD between the activated package and the legacy single-file chain', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf-8');
    const fallbackLine = source.split('\n').find((line) => line.includes('orderedFallback'));
    expect(fallbackLine).toBeDefined();
    expect(fallbackLine).toContain('shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2_1_0, tier)');
    expect(fallbackLine).toContain('MODEL.candidates');
    expect(shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2_1_0, 'high')).toContain('/v2.1.0/');
  });

  it('applies the coordinate basis to every received package asset url', () => {
    expect(isType055VersionedAssetUrl('/assets/model-releases/type055-nanchang-101/v2.1.1/type055-nanchang-101-ship-lod0.glb')).toBe(true);
    expect(isType055VersionedAssetUrl('/assets/model-releases/type055-nanchang-101/v2.1.0/type055-nanchang-101-ship-lod0.glb')).toBe(true);
    expect(isType055VersionedAssetUrl('/assets/models-opt/destroyer.glb')).toBe(false);
  });
});
