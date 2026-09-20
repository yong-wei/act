import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  displayDriftVelocity,
  FoamHistoryField,
  FOAM_HISTORY_BY_TIER,
  foamDecayFactor,
  naturalCompression,
  naturalFoamSeaStateGate,
  naturalFoamSourceStrength,
} from '../scene/water/foam-history';
import { FOAM_DOMAIN_METERS, readMarineFoamFieldFromScene } from '../scene/water/foam-history-layer';
import { GERSTNER_WAVE_SETS, type GerstnerWave } from '../scene/water/gerstner-waves';
import { gerstnerAmplitudeScale } from '../scene/water/gerstner-water';
import { allocateWakeCapacities, WAKE_SCENE_MAX_PARTICLES } from '../scene/wake/wake-physics';
import { updateWakeSprayGeometry, createWakeTrailGeometry } from '../scene/wake/wake-geometry';
import { createWakeTrailBuffer, type WakeAnchorSnapshot } from '../scene/wake/wake-buffer';
import { computeWakeSpeedActivity } from '../scene/wake/wake-physics';
import type { SceneShipVisualProfile } from '../scene/types';

const readSource = (relative: string) =>
  readFileSync(path.join(process.cwd(), 'src/resources/simulations', relative), 'utf8');

const createField = (options?: { domainMeters?: number; drift?: readonly [number, number] }) =>
  new FoamHistoryField({
    spec: { resolution: 64, updateHz: 25, naturalStride: 2 },
    domainMeters: options?.domainMeters ?? 256,
    driftMetersPerSecond: options?.drift ?? [0, 0],
  });

const NO_SOURCES = null;

describe('foam decay and dissipation (#2115)', () => {
  it('halves density per half-life without any source', () => {
    const field = createField();
    // texel 对齐冲点：峰值幅度完整落在网格中心。
    const cx = field.localToWorldI(16);
    const cz = field.localToWorldJ(16);
    field.deposit(cx, cz, 4, 0.8);
    const initial = field.densityAt(cx, cz);
    expect(initial).toBeGreaterThan(0.7);
    field.step(26, NO_SOURCES);
    const afterOne = field.densityAt(cx, cz);
    expect(Math.abs(afterOne - initial / 2)).toBeLessThan(0.02);
    field.step(26, NO_SOURCES);
    expect(field.densityAt(cx, cz)).toBeLessThan(initial / 4 + 0.02);
  });

  it('foam persists and dissipates after the crest/source passes (not tied to crest mask)', () => {
    const field = createField();
    const cx = field.localToWorldI(20);
    const cz = field.localToWorldJ(12);
    // 源只在 t=0 注入一次；之后无源推进——泡沫持续存在且单调消散。
    field.deposit(cx, cz, 5, 0.9);
    const atBirth = field.densityAt(cx, cz);
    for (let i = 0; i < 8; i += 1) field.step(1, NO_SOURCES);
    const at8s = field.densityAt(cx, cz);
    expect(at8s).toBeGreaterThan(atBirth * 0.75);
    expect(at8s).toBeLessThan(atBirth);
    // 98s ≈ 3.77 个半衰期（2^-3.77 ≈ 0.073）：远低于出生值并持续衰减。
    for (let i = 0; i < 90; i += 1) field.step(1, NO_SOURCES);
    expect(field.densityAt(cx, cz)).toBeLessThan(0.08);
    for (let i = 0; i < 60; i += 1) field.step(1, NO_SOURCES);
    expect(field.densityAt(cx, cz)).toBeLessThan(0.02);
  });

  it('decay factor is time-integrated (independent of step split)', () => {
    expect(foamDecayFactor(26, 2)).toBeCloseTo(foamDecayFactor(26, 1) ** 2, 9);
    expect(foamDecayFactor(26, 0.5) ** 4).toBeCloseTo(foamDecayFactor(26, 2), 9);
  });
});

describe('foam field determinism (#2115)', () => {
  it('reproduces identical grids for identical initial state and source history', () => {
    const run = () => {
      const field = createField({ drift: [1.2, -0.4] });
      const waves = GERSTNER_WAVE_SETS.high;
      const sources = {
        waves,
        amplitudeScale: gerstnerAmplitudeScale(4),
        seaState: 4,
        naturalEnabled: true,
      };
      for (let t = 0; t < 4; t += 0.04) {
        field.advanceTime(t, sources);
        field.deposit(20 - t * 3, 5, 4, 0.35);
      }
      return field.grid;
    };
    const a = run();
    const b = run();
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('produces the same grid for the same total time split into different advance cadences', () => {
    const sources = {
      waves: GERSTNER_WAVE_SETS.high,
      amplitudeScale: gerstnerAmplitudeScale(3),
      seaState: 3,
      naturalEnabled: true,
    };
    const coarse = createField();
    coarse.advanceTime(0, sources);
    for (let t = 0.2; t <= 2.0001; t += 0.2) coarse.advanceTime(t, sources);
    const fine = createField();
    fine.advanceTime(0, sources);
    for (let t = 0.04; t <= 2.0001; t += 0.04) fine.advanceTime(t, sources);
    expect(Array.from(coarse.grid)).toEqual(Array.from(fine.grid));
  });
});

describe('foam domain recentering (#2115)', () => {
  it('keeps foam at its world position when the domain moves, without wrapping', () => {
    const field = createField({ domainMeters: 256 });
    // 尾迹留在原世界轨迹（域向 +x 移动 48m：旧域 [-128,128] → 新域 [-80,176]，
    // 沉积点保持在新域内）。
    const cx = field.localToWorldI(30);
    const cz = field.localToWorldJ(28);
    field.deposit(cx, cz, 6, 0.9);
    const before = field.densityAt(cx, cz);
    field.recenter(48, 0);
    expect(field.densityAt(cx, cz)).toBeGreaterThan(before * 0.85);
    // 新进入区域（旧域右缘之外）从 0 开始，而不是旧历史的环回副本。
    expect(field.densityAt(150, cz)).toBeLessThan(0.05);
    // 对侧新缘（旧域左缘之外）同样为 0——无 RepeatWrapping 式环回。
    expect(field.densityAt(-90, cz)).toBeLessThan(0.05);
  });

  it('exposes domain and grid geometry consistent with texel size', () => {
    const field = createField({ domainMeters: FOAM_DOMAIN_METERS });
    expect(field.cellMeters).toBeCloseTo(FOAM_DOMAIN_METERS / field.resolution, 9);
    expect(field.localToWorldI(0)).toBeCloseTo(-FOAM_DOMAIN_METERS / 2 + field.cellMeters / 2, 9);
  });
});

describe('foam seek and reset policy (#2115)', () => {
  it('clears history and bumps epoch on a backward time jump (reset/seek)', () => {
    const field = createField();
    field.advanceTime(10, NO_SOURCES);
    const cx = field.localToWorldI(16);
    const cz = field.localToWorldJ(16);
    field.deposit(cx, cz, 4, 0.8);
    expect(field.densityAt(cx, cz)).toBeGreaterThan(0.7);
    const epoch = field.epoch;
    field.advanceTime(3, NO_SOURCES);
    expect(field.epoch).toBe(epoch + 1);
    expect(field.densityAt(cx, cz)).toBe(0);
    expect(field.timeSeconds).toBe(0);
  });

  it('clears history on a large forward jump, but steps normally for small deltas', () => {
    const field = createField();
    field.advanceTime(5, NO_SOURCES);
    field.deposit(0, 0, 4, 0.8);
    field.advanceTime(5.1, NO_SOURCES);
    expect(field.epoch).toBe(0);
    expect(field.timeSeconds).toBeGreaterThan(0);
    field.advanceTime(30, NO_SOURCES);
    expect(field.epoch).toBe(1);
    expect(field.densityAt(0, 0)).toBe(0);
  });

  it('aligns natural-source phase time to the absolute visual clock (P2)', () => {
    const field = createField();
    // 水面经 Suspense 晚挂载：首同步基线 = 当时绝对视觉时间（非 0）。
    field.advanceTime(45, NO_SOURCES);
    expect(field.naturalPhaseTimeSeconds).toBe(45);
    field.step(0.04, NO_SOURCES);
    expect(field.naturalPhaseTimeSeconds).toBeCloseTo(45.04, 9);
    // seek 清空后由下次同步重定（与水面 shader 的新绝对时间同相）。
    field.advanceTime(12, NO_SOURCES);
    expect(field.epoch).toBe(1);
    expect(field.naturalPhaseTimeSeconds).toBe(12);
  });

  it('advances decay and phase for stall time beyond the catch-up cap (P2)', () => {
    const field = createField();
    field.advanceTime(0, NO_SOURCES);
    const cx = field.localToWorldI(24);
    const cz = field.localToWorldJ(24);
    field.deposit(cx, cz, 5, 0.9);
    // 1.0s 单帧停顿（< seek 阈值 1.5s，> 补步上限 8×0.04=0.32s）：
    // 不静默丢时——剩余时间按整体衰减推进，场时间与相位对齐绝对视觉时间。
    field.advanceTime(1.0, NO_SOURCES);
    expect(field.timeSeconds).toBeCloseTo(1.0, 6);
    expect(field.naturalPhaseTimeSeconds).toBeCloseTo(1.0, 6);
    const density = field.densityAt(cx, cz);
    expect(density).toBeGreaterThan(0.2);
    expect(density).toBeLessThan(0.9);
  });

  it('fades density smoothly at the domain edge (read-time feather, P2)', () => {
    const field = createField({ domainMeters: 256 });
    const res = field.resolution;
    const cx = field.localToWorldI(Math.floor(res / 2));
    const cz = field.localToWorldJ(Math.floor(res / 2));
    const ex = field.localToWorldI(res - 2);
    field.deposit(cx, cz, 5, 0.9);
    field.deposit(ex, cz, 5, 0.9);
    const center = field.densityAt(cx, cz);
    const edge = field.densityAt(ex, cz);
    expect(center).toBeGreaterThan(0.6);
    // 域缘读数被羽化到显著低于中心（无刚性方形边界）。
    expect(edge).toBeLessThan(center * 0.5);
  });

  it('injects natural coverage continuously instead of a coarse lattice (P2)', () => {
    const field = createField({ domainMeters: 256 });
    const sources = {
      waves: GERSTNER_WAVE_SETS.high,
      amplitudeScale: gerstnerAmplitudeScale(5),
      seaState: 5,
      naturalEnabled: true,
    };
    const calm = createField({ domainMeters: 256 });
    const calmSources = {
      waves: GERSTNER_WAVE_SETS.high,
      amplitudeScale: gerstnerAmplitudeScale(1),
      seaState: 1,
      naturalEnabled: true,
    };
    for (let i = 0; i < 50; i += 1) field.step(0.04, sources);
    for (let i = 0; i < 50; i += 1) calm.step(0.04, calmSources);
    // 双线性插值注入：风暴下非零覆盖为连续区域（逐粗点冲点会留下周期空档）。
    const coverage = (f: FoamHistoryField) => {
      let covered = 0;
      for (let index = 0; index < f.grid.length; index += 1) {
        if (f.grid[index] > 0.05) covered += 1;
      }
      return covered / f.grid.length;
    };
    expect(coverage(field)).toBeGreaterThan(0.04);
    expect(coverage(field)).toBeGreaterThan(coverage(calm) * 2);
    expect(coverage(calm)).toBeLessThan(0.01);
  });
});

describe('natural breaking-wave source (#2115)', () => {
  it('normalizes compression within [-1, 1] across the wave field', () => {
    const waves = GERSTNER_WAVE_SETS.high;
    const scale = gerstnerAmplitudeScale(5);
    for (let i = 0; i < 200; i += 1) {
      const value = naturalCompression(waves, scale, i * 37.3, i * -11.7, i * 0.37);
      expect(value).toBeGreaterThanOrEqual(-1.001);
      expect(value).toBeLessThanOrEqual(1.001);
    }
  });

  it('gates natural foam by sea state: calm sea stays near zero', () => {
    expect(naturalFoamSeaStateGate(1)).toBe(0);
    expect(naturalFoamSeaStateGate(2)).toBe(0);
    expect(naturalFoamSeaStateGate(3)).toBeGreaterThan(0);
    expect(naturalFoamSeaStateGate(5)).toBeCloseTo(1, 6);
    // 压缩超阈值时强度仍受海况门限乘法约束。
    expect(naturalFoamSourceStrength(0.9, 2)).toBe(0);
    expect(naturalFoamSourceStrength(0.9, 5)).toBeGreaterThan(0.5);
  });

  it('accumulates natural foam only where compression exceeds the threshold', () => {
    const calm = createField();
    const stormy = createField();
    const calmSources = {
      waves: GERSTNER_WAVE_SETS.high,
      amplitudeScale: gerstnerAmplitudeScale(1),
      seaState: 1,
      naturalEnabled: true,
    };
    const stormySources = {
      waves: GERSTNER_WAVE_SETS.high,
      amplitudeScale: gerstnerAmplitudeScale(5),
      seaState: 5,
      naturalEnabled: true,
    };
    for (let i = 0; i < 50; i += 1) {
      calm.step(0.04, calmSources);
      stormy.step(0.04, stormySources);
    }
    const sum = (field: FoamHistoryField) =>
      field.grid.reduce((total, value) => total + value, 0);
    expect(sum(stormy)).toBeGreaterThan(0.5);
    expect(sum(calm)).toBeLessThan(sum(stormy) * 0.01);
  });

  it('derives display drift along the dominant wave direction at bounded speed', () => {
    const drift = displayDriftVelocity(GERSTNER_WAVE_SETS.high, 1.4);
    const length = Math.hypot(drift[0], drift[1]);
    expect(length).toBeCloseTo(1.4, 6);
    expect(drift[0]).toBeGreaterThan(0);
  });

  it('degrades the field by quality tier without falling back to a repeating decal', () => {
    const tiers = [FOAM_HISTORY_BY_TIER.high, FOAM_HISTORY_BY_TIER.medium, FOAM_HISTORY_BY_TIER.low];
    // 分辨率与更新频率逐档下降（低档省 CPU），但都保留历史场（非贴花回退）。
    expect(tiers[0].resolution).toBeGreaterThan(tiers[1].resolution);
    expect(tiers[1].resolution).toBeGreaterThan(tiers[2].resolution);
    expect(tiers[0].updateHz).toBeGreaterThan(tiers[2].updateHz);
    for (const tier of tiers) {
      expect(tier.resolution).toBeGreaterThanOrEqual(32);
      expect(tier.updateHz).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('hard aggregate wake budget (#2115)', () => {
  it('allocates within the scene maximum for twin propulsors', () => {
    const capacities = allocateWakeCapacities([0.5, 0.5], WAKE_SCENE_MAX_PARTICLES);
    const total = capacities.reduce((sum, value) => sum + value, 0);
    expect(total).toBeLessThanOrEqual(WAKE_SCENE_MAX_PARTICLES);
    expect(total).toBeGreaterThan(WAKE_SCENE_MAX_PARTICLES * 0.9);
  });

  it('keeps the aggregate within budget when all declared propulsors activate', () => {
    for (const count of [2, 4, 8, 9]) {
      const shares = Array.from({ length: count }, () => 1 / count);
      const capacities = allocateWakeCapacities(shares, WAKE_SCENE_MAX_PARTICLES);
      const total = capacities.reduce((sum, value) => sum + value, 0);
      expect(total).toBeLessThanOrEqual(WAKE_SCENE_MAX_PARTICLES);
      for (const capacity of capacities) expect(capacity).toBeGreaterThanOrEqual(1);
    }
  });

  it('normalizes over-subscribed shares instead of over-allocating', () => {
    const capacities = allocateWakeCapacities([1, 1, 1, 1], 2200);
    expect(capacities.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(2200);
  });
});

const PROFILE: SceneShipVisualProfile = {
  shipLengthMeters: 180,
  designSpeedKnots: 30,
  modelUrl: '/assets/simulation-scene/models/test-ship.glb',
  waterlineY: 0,
  wakeAnchors: { stern: [0, 0, -90], portShoulder: [12, 0, 30], starboardShoulder: [-12, 0, 30] },
};

const SNAPSHOT: WakeAnchorSnapshot = {
  stern: [0, 0, -90],
  portShoulder: [12, 0, 30],
  starboardShoulder: [-12, 0, 30],
  forwardX: 0,
  forwardZ: 1,
  waterY: 0,
  worldShipLength: 180,
  pathLength: 0,
};

describe('spray subset rendering (#2115)', () => {
  it('renders only a bounded young core subset as spray', () => {
    const buffer = createWakeTrailBuffer({ capacity: 64 });
    const activity = computeWakeSpeedActivity({
      worldSpeed: 15,
      worldShipLength: 180,
      profile: PROFILE,
    });
    // 单批：飞沫只取 core 族 planIndex<2（每批 ≤2 个）。
    buffer.emit({ now: 0, activity, anchors: SNAPSHOT, includeKelvin: true });
    const handle = createWakeTrailGeometry(64);
    expect(updateWakeSprayGeometry(handle, buffer, 0.5)).toBeLessThanOrEqual(2);
    expect(updateWakeSprayGeometry(handle, buffer, 0.5)).toBeGreaterThan(0);
    // 多批重叠年轻窗口：上界 = 每批 2 × 窗口内批数（0.5s 间隔 × 4.4s 窗口）。
    for (let i = 1; i < 8; i += 1) {
      buffer.emit({ now: i * 0.5, activity, anchors: SNAPSHOT, includeKelvin: true });
    }
    const fresh = updateWakeSprayGeometry(handle, buffer, 3.7);
    expect(fresh).toBeGreaterThan(0);
    expect(fresh).toBeLessThanOrEqual(2 * 9);
    // 全部老化后：无飞沫。
    expect(updateWakeSprayGeometry(handle, buffer, 60)).toBe(0);
  });
});

describe('source contracts (#2115)', () => {
  it('water material samples the foam history field with manual bilinear filtering', () => {
    const source = readSource('scene/water/gerstner-water-material.ts');
    expect(source).toContain('uFoamDensityTex');
    expect(source).toContain('sampleFoamField');
    // 去除单一 80m 平铺贴花。
    expect(source).not.toContain('vWorldPos.xz / 80.0');
    // 多尺度去相关细节（非谐波尺度 + 固定偏移）。
    expect(source).toContain('worldXZ / 23.0');
    expect(source).toContain('worldXZ / 71.0');
    expect(source).toContain('worldXZ / 149.0');
    // 无场回退路径仍是平滑波峰覆盖（不依赖重复贴花）。
    expect(source).toContain('smoothstep(0.72, 0.95, vCrest) * 0.55');
  });

  it('GerstnerWater hosts the shared foam field provider', () => {
    const source = readSource('scene/water/gerstner-water.tsx');
    expect(source).toContain('MarineFoamFieldProvider');
    expect(source).toContain('useMarineFoamField');
    expect(source).toContain('uFoamOrigin');
  });

  it('wake trail deposits vessel foam into the shared field and keeps spray lit', () => {
    const source = readSource('scene/wake/wake-trail.tsx');
    // P1 修复：尾迹与水面互为兄弟节点——经 R3F scene.userData 跨兄弟读取，
    // 而非 React Context（Context 不跨兄弟传播，会让沉积路径在真实场景不可达）。
    expect(source).toContain('readMarineFoamFieldFromScene');
    expect(source).not.toContain('useMarineFoamField()');
    expect(source).toContain('VESSEL_FOAM_RATE_PER_SECOND');
    expect(source).toContain('forEachWakeParticleVisual');
    expect(source).toContain('updateWakeSprayGeometry');
    // 飞沫受光（同源公式），不再作为唯一呈现的 unlit additive 全量尾迹。
    expect(source).toContain('createWakeSprayMaterial');
    expect(source).toContain('light * 0.65 + 0.35 * uSunIllumination');
    // 沉积按视觉时间秒积分（不随帧率翻倍）。
    expect(source).toContain('visualDelta');
    // 材质随场的出现/消失逐帧切换（水面晚挂载时从 additive 过渡到沉积模式）。
    expect(source).toContain('meshRef.current.material !== targetMaterial');
    // 归因隔离（P2 修复）：场存在但船源显式关闭时不绘制任何船源泡沫——
    // "只自然源/全关"镜头不得回退显示 legacy additive 尾迹。
    expect(source).toContain('vesselFoamSuppressed');
    expect(source).toContain('meshRef.current.visible = !vesselFoamSuppressed');
    // 沉积绑定当帧源活跃度（P2 修复）：停推/暂停后存量粒子只经场衰减消散，
    // 不再被反复补沉积。
    expect(source).toContain('vesselSourceActive');
    expect(source).toContain('visualDelta > 0 && vesselSourceActive');
    // 场模式几何始终为飞沫子集（是否沉积与几何选择分开——停推不闪现全量 quad）。
    expect(source).toContain('} else if (depositToField && foamField) {');
  });

  it('clears the foam history on experiment reset via resetToken (P2)', () => {
    const water = readSource('scene/water/gerstner-water.tsx');
    expect(water).toContain('resetToken={resetToken}');
    const layer = readSource('scene/water/foam-history-layer.tsx');
    expect(layer).toContain('internalRef.current.reset()');
    // 七个仿真都把重置令牌接入水面（无 MarineFrameProvider 的场景也复位泡沫史）。
    for (const sim of ['dredger', 'drilling']) {
      const source = readSource(`simulations/${sim}-simulation.tsx`);
      expect(source).toContain('resetToken={resetCount}');
    }
    for (const sim of ['container', 'cruise', 'icebreaker', 'lng']) {
      const source = readSource(`simulations/${sim}-simulation.tsx`);
      expect(source).toContain('resetToken={resetToken} />');
    }
    const destroyer = readSource('simulations/destroyer-simulation.tsx');
    expect(destroyer).toContain('<PresetWater simRef={simRef} resetToken={resetToken} />');
    // 飞沫受光随环境预设：七个场景的尾迹都透传 useEnvironmentWaterColors。
    for (const sim of ['container', 'cruise', 'icebreaker', 'dredger', 'lng', 'drilling', 'destroyer']) {
      const source = readSource(`simulations/${sim}-simulation.tsx`);
      expect(source).toContain('sunDirection={environmentLight.sunDirection}');
      expect(source).toContain('sunIllumination={environmentLight.sunIllumination}');
    }
  });

  it('multi-trail scenes allocate hard aggregate capacities', () => {
    const destroyer = readSource('simulations/destroyer-simulation.tsx');
    expect(destroyer).toContain('allocateWakeCapacities');
    expect(destroyer).toContain('wakeSceneCapacityForTier');
    expect(destroyer).toContain('capacity={propulsorCapacities[index]}');
    const drilling = readSource('simulations/drilling-simulation.tsx');
    expect(drilling).toContain('allocateWakeCapacities');
    // P2 修复：逐推进器取各自分配（复用单一槽位会突破场景硬上限）。
    expect(drilling).toContain('capacity={washTrailCapacityFor(thruster.id)}');
  });

  it('drilling wash allocations respect the scene hard maximum across all thrusters', () => {
    // 复算钻井平台接线：主尾迹 + 8 洗流按分配器切分，聚合不超场景总容量。
    const capacities = allocateWakeCapacities(
      [8, 1, 1, 1, 1, 1, 1, 1, 1],
      2200,
    );
    const total = capacities.reduce((sum, value) => sum + value, 0);
    expect(total).toBeLessThanOrEqual(2200);
    // 余数分配后各槽容量可以互不相同——逐槽接线必须按索引取值。
    const distinct = new Set(capacities).size;
    expect(distinct).toBeGreaterThan(1);
  });

  it('reads the shared field from the R3F scene across sibling subtrees', () => {
    const source = readSource('scene/water/foam-history-layer.tsx');
    expect(source).toContain('MARINE_FOAM_FIELD_SCENE_KEY');
    expect(source).toContain('scene.userData[MARINE_FOAM_FIELD_SCENE_KEY] = controller');
    // 形状校验：垃圾值返回 null（缺 deposit/stats/field/texture 不进入沉积模式）。
    expect(readMarineFoamFieldFromScene({ userData: {} })).toBeNull();
    expect(readMarineFoamFieldFromScene({ userData: { marineFoamField: { bogus: 1 } } })).toBeNull();
    expect(
      readMarineFoamFieldFromScene({ userData: { marineFoamField: 'nope' } }),
    ).toBeNull();
  });

  it('keeps the field stable across config changes and resamples on tier change (P2)', () => {
    const source = readSource('scene/water/foam-history-layer.tsx');
    // 海况/振幅变化经 ref 更新（不重建场、不瞬清历史）。
    expect(source).toContain('sourcesRef.current = {');
    // 档位变化按世界坐标重采样旧密度，并继承旧场原点/时间/epoch
    //（旧场已随船重定位，新场保持 (0,0) 会读到全零）。
    expect(source).toContain('previousFieldRef');
    expect(source).toContain('previous.densityAt(');
    expect(source).toContain('field.originX = previous.originX;');
    // 材质端域缘羽化（无刚性方形边界）。
    const material = readSource('scene/water/gerstner-water-material.ts');
    expect(material).toContain('uFoamEdgeFade');
    expect(material).toContain('feather');
  });

  it('foam history layer exposes QA attribution and cost probe', () => {
    const source = readSource('scene/water/foam-history-layer.tsx');
    expect(source).toContain("has('qa', 'marine-foam')");
    expect(source).toContain('qa-foam');
    expect(source).toContain('lastStepCostMs');
    expect(source).toContain('isWebGL2');
  });
});
