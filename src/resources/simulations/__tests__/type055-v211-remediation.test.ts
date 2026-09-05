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
  createGerstnerWaterGeometry,
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
 * F4 v2.1.0 运行时有序回退；F5 水面网格轴约定（复审 P1）；F6 达标门 maxSettlingTime（复审 P2）；
 * F7 L0 clip 绑定进 useEffect（用户报告：螺旋桨不转）。
 */

describe('F1: visible water sampling shares the mesh-local coordinate basis', () => {
  const waves = GERSTNER_WAVE_SETS.high;
  const scale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);

  it('inverts the Gerstner horizontal displacement before sampling the world point height', () => {
    const originX = -6000;
    const originZ = 120;
    const t = 37.5;
    const paramX = 50;
    const paramZ = -20;
    const displacement = computeGerstnerDisplacement(waves, paramX, paramZ, t);
    // GPU 顶点世界坐标 = 网格原点 + 参数点 + ampScale·水平位移；CPU 采样必须反解回参数点
    const worldX = originX + paramX + scale * displacement.offsetX;
    const worldZ = originZ + paramZ + scale * displacement.offsetZ;
    const sampled = sampleVisibleWaterHeight(waves, scale, originX, originZ, worldX, worldZ, t);
    expect(sampled).toBeCloseTo(GERSTNER_WATER_BASE_Y + scale * displacement.y, 6);
  });

  it('differs from naive world-coordinate sampling at a non-origin ship position', () => {
    const originX = -6000;
    const t = 12.3;
    const shipLocal = sampleVisibleWaterHeight(waves, scale, originX, 0, originX, 0, t);
    const naiveWorld = GERSTNER_WATER_BASE_Y + computeGerstnerDisplacement(waves, originX, 0, t).y;
    // 非原点舰位：同一世界点的网格局部坐标是 (0,0) 附近，朴素世界采样是另一波相
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

describe('F5: water geometry bakes the -90° X rotation into vertices', () => {
  it('lies in the local XZ plane with Y up, so shader phase/displacement axes match the CPU reference', () => {
    const size = 1200;
    const geometry = createGerstnerWaterGeometry(size, 8);
    const positions = geometry.getAttribute('position');
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      // shader 以 position.y 写垂向位移：几何基面必须 y 恒 0（旋转已烘焙，而非挂在 mesh 上）
      expect(positions.getY(i)).toBeCloseTo(0, 6);
      minX = Math.min(minX, positions.getX(i));
      maxX = Math.max(maxX, positions.getX(i));
      minZ = Math.min(minZ, positions.getZ(i));
      maxZ = Math.max(maxZ, positions.getZ(i));
    }
    // shader 以 position.xz 取相位：两个水平轴都必须真正展开（修复前 z 恒 0，相位退化）
    expect(maxX - minX).toBeCloseTo(size, 6);
    expect(maxZ - minZ).toBeCloseTo(size, 6);
  });

  it('GPU 顶点世界 Y（烘焙几何 + shader 水平/垂向位移）与 CPU 采样逐点一致', () => {
    const waves = GERSTNER_WAVE_SETS.high;
    const scale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);
    const geometry = createGerstnerWaterGeometry(600, 16);
    const positions = geometry.getAttribute('position');
    const originX = -6000;
    const originZ = 120;
    const t = 42.7;
    // 抽查若干顶点：GPU 世界 XZ = 参数点 + ampScale·水平位移，世界 Y = BASE_Y + ampScale·垂向位移
    for (const index of [0, 37, 101, 200, positions.count - 1]) {
      const localX = positions.getX(index);
      const localZ = positions.getZ(index);
      const displacement = computeGerstnerDisplacement(waves, localX, localZ, t);
      const gpuWorldY = GERSTNER_WATER_BASE_Y + scale * displacement.y;
      const cpuSample = sampleVisibleWaterHeight(
        waves, scale, originX, originZ,
        originX + localX + scale * displacement.offsetX,
        originZ + localZ + scale * displacement.offsetZ,
        t,
      );
      expect(cpuSample).toBeCloseTo(gpuWorldY, 6);
    }
  });
});

describe('F6: attainment honors successCriteria.maxSettlingTime', () => {
  it('does not fire when the error settles after the settling deadline', () => {
    const state = createAttainmentState(0);
    // 机动激活后先偏离 130s（maxSettlingTime=120），再收敛到阈值内保持 3s
    expect(advanceAttainment(state, 90, 60, 5, 1, 120)).toBe(false);
    expect(state.maneuverActive).toBe(true);
    for (let i = 0; i < 129; i += 1) advanceAttainment(state, 90, 60, 5, 1, 120);
    let fired = 0;
    for (let i = 0; i < 40; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1, 120)) fired += 1;
    }
    expect(fired).toBe(0);
  });

  it('fires when the error settles within the settling deadline', () => {
    const state = createAttainmentState(0);
    expect(advanceAttainment(state, 90, 60, 5, 1, 120)).toBe(false);
    let fired = 0;
    for (let i = 0; i < 40; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1, 120)) fired += 1;
    }
    expect(fired).toBe(1);
  });

  it('re-arm after an excursion opens a new settling window', () => {
    const state = createAttainmentState(0);
    advanceAttainment(state, 90, 60, 5, 1, 120);
    // 先按时达标一次
    let fired = 0;
    for (let i = 0; i < 40; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1, 120)) fired += 1;
    }
    expect(fired).toBe(1);
    // 新机动段：误差冲过 2×maxError 重新武装并清零调节时钟
    advanceAttainment(state, 45, 30, 5, 0.1, 120);
    expect(state.armed).toBe(true);
    expect(state.maneuverTime).toBeLessThan(1);
    // 新窗口内收敛仍然计数
    let refired = 0;
    for (let i = 0; i < 40; i += 1) {
      if (advanceAttainment(state, 45, 1, 5, 0.1, 120)) refired += 1;
    }
    expect(refired).toBe(1);
  });
});

describe('F7: L0 clip-loop bindings mount inside useEffect (StrictMode-safe)', () => {
  it('plays clip actions in an effect with stopAllAction cleanup, not in useMemo', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/components/semantic-bindings-rig.tsx'),
      'utf-8',
    );
    const effectMatch = source.match(/useEffect\(\(\) => \{[\s\S]*?drive !== 'clip-loop'[\s\S]*?\}, \[mixer, animations, descriptor\]\)/);
    expect(effectMatch).not.toBeNull();
    expect(effectMatch![0]).toContain('mixer.stopAllAction()');
    // useMemo 块内不得再有 clipAction/play 副作用
    const memoBlocks = source.match(/useMemo\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/g) ?? [];
    for (const block of memoBlocks) {
      expect(block).not.toContain('clipAction');
    }
  });
});
