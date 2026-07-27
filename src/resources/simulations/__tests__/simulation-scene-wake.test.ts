import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { SceneShipVisualProfile } from '../scene/types';
import * as wakePublic from '../scene/wake';
import {
  createWakeTrailBuffer,
  hash01,
  hashSigned,
  type WakeAnchorSnapshot,
  type WakeTrailBuffer,
} from '../scene/wake/wake-buffer';
import {
  computeWakeEnvelope,
  createWakeTrailGeometry,
  resolveWakeParticleVisual,
  updateWakeTrailGeometry,
} from '../scene/wake/wake-geometry';
import {
  computeWakeFamilyBudget,
  computeWakeSpeedActivity,
  knotsToMetersPerSecond,
  type WakeSpeedActivity,
} from '../scene/wake/wake-physics';

const PROFILE: SceneShipVisualProfile = {
  shipLengthMeters: 180,
  designSpeedKnots: 30,
  modelUrl: '/assets/simulation-scene/models/test-ship.glb',
  waterlineY: 0,
  wakeAnchors: {
    stern: [0, 0, -90],
    portShoulder: [12, 0, 30],
    starboardShoulder: [-12, 0, 30],
  },
};

const DESIGN_MPS = knotsToMetersPerSecond(PROFILE.designSpeedKnots);

const activityAtRatio = (ratio: number): WakeSpeedActivity =>
  computeWakeSpeedActivity({
    worldSpeed: ratio * DESIGN_MPS,
    worldShipLength: PROFILE.shipLengthMeters,
    profile: PROFILE,
  });

const FULL_ACTIVITY = activityAtRatio(1);

const SNAPSHOT: WakeAnchorSnapshot = {
  stern: [0, 0, -90],
  portShoulder: [12, 0, 30],
  starboardShoulder: [-12, 0, 30],
  forwardX: 0,
  forwardZ: 1,
  waterY: 0,
  worldShipLength: PROFILE.shipLengthMeters,
  pathLength: 0,
};

const emitBatch = (
  buffer: WakeTrailBuffer,
  now: number,
  activity: WakeSpeedActivity = FULL_ACTIVITY,
  includeKelvin = true
) =>
  buffer.emit({
    now,
    activity,
    anchors: { ...SNAPSHOT, pathLength: now * DESIGN_MPS },
    includeKelvin,
  });

describe('尾迹物理：Froude 三路活跃度', () => {
  it('低于各自截止速比时活跃度为 0', () => {
    expect(activityAtRatio(0.05).wakeActivity).toBe(0);
    expect(activityAtRatio(0.3).foamActivity).toBe(0);
    expect(activityAtRatio(0.36).kelvinActivity).toBe(0);
  });

  it('活跃度随速比单调不减', () => {
    const ratios = [0.06, 0.12, 0.2, 0.3, 0.45, 0.6, 0.8, 1];
    const wake = ratios.map((r) => activityAtRatio(r).wakeActivity);
    const foam = ratios.map((r) => activityAtRatio(r).foamActivity);
    const kelvin = ratios.map((r) => activityAtRatio(r).kelvinActivity);
    for (let i = 1; i < ratios.length; i += 1) {
      expect(wake[i]).toBeGreaterThanOrEqual(wake[i - 1]);
      expect(foam[i]).toBeGreaterThanOrEqual(foam[i - 1]);
      expect(kelvin[i]).toBeGreaterThanOrEqual(kelvin[i - 1]);
    }
    expect(wake[ratios.length - 1]).toBeCloseTo(1, 6);
    expect(foam[ratios.length - 1]).toBeCloseTo(1, 6);
    expect(kelvin[ratios.length - 1]).toBeCloseTo(1, 6);
  });

  it('kelvin 门限独立于 foam：foam 已激活而 kelvin 仍为 0 的区间存在', () => {
    const activity = activityAtRatio(0.35);
    expect(activity.foamActivity).toBeGreaterThan(0);
    expect(activity.kelvinActivity).toBe(0);
    const wakeOnly = activityAtRatio(0.2);
    expect(wakeOnly.wakeActivity).toBeGreaterThan(0);
    expect(wakeOnly.foamActivity).toBe(0);
  });

  it('按船长/设计航速参数化 Froude 语义，世界尺度映射保持源公式', () => {
    const full = activityAtRatio(1);
    expect(full.realSpeedMps).toBeCloseTo(DESIGN_MPS, 6);
    expect(full.realFroude).toBeCloseTo(
      DESIGN_MPS / Math.sqrt(9.81 * PROFILE.shipLengthMeters),
      6
    );
    // 2:1 世界尺度：世界船长减半时，同一世界速度对应两倍真实航速
    const scaled = computeWakeSpeedActivity({
      worldSpeed: DESIGN_MPS / 2,
      worldShipLength: PROFILE.shipLengthMeters / 2,
      profile: PROFILE,
    });
    expect(scaled.realSpeedRatio).toBeCloseTo(1, 6);
    // 超出设计航速后速比截断为 1
    expect(activityAtRatio(2).realSpeedRatio).toBe(1);
  });

  it('lifetimeScale 随 wakeActivity 在 [minLifetimeScale, 1] 间插值', () => {
    expect(activityAtRatio(0).lifetimeScale).toBeCloseTo(0.28, 6);
    expect(activityAtRatio(1).lifetimeScale).toBeCloseTo(1, 6);
  });

  it('四族预算：近尾 core 主导，中远龄 foam/farFoam 出现，kelvin 受门控放大', () => {
    const style = wakePublic.resolveWakeTrailStyle();
    const young = computeWakeFamilyBudget({
      age01: 0,
      activity: FULL_ACTIVITY,
      style,
      includeKelvin: true,
    });
    expect(young.core).toBeGreaterThan(young.foam);
    expect(young.farFoam).toBe(0);
    const aged = computeWakeFamilyBudget({
      age01: 0.5,
      activity: FULL_ACTIVITY,
      style,
      includeKelvin: true,
    });
    expect(aged.farFoam).toBeGreaterThan(0);
    const kelvinOn = computeWakeFamilyBudget({
      age01: 0.3,
      activity: FULL_ACTIVITY,
      style,
      includeKelvin: true,
    });
    const kelvinOff = computeWakeFamilyBudget({
      age01: 0.3,
      activity: FULL_ACTIVITY,
      style,
      includeKelvin: false,
    });
    expect(kelvinOn.kelvin).toBeGreaterThan(kelvinOff.kelvin);
    expect(kelvinOff.kelvin).toBeGreaterThan(0);
  });
});

describe('确定性噪声', () => {
  it('hash01/hashSigned 同参数同结果且值域稳定', () => {
    for (const args of [[17, 3, 5, 0, 313], [7, 11, 2, 0, 317]] as const) {
      const [seed, a, b, c, stream] = args;
      expect(hash01(seed, a, b, c, stream)).toBe(hash01(seed, a, b, c, stream));
      expect(hashSigned(seed, a, b, c, stream)).toBe(hashSigned(seed, a, b, c, stream));
      const u = hash01(seed, a, b, c, stream);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      const s = hashSigned(seed, a, b, c, stream);
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThan(1);
    }
  });

  it('同种子同发射序列产出同粒子；异种子序列不同', () => {
    const run = (seed: number) => {
      const buffer = createWakeTrailBuffer({ capacity: 256, style: { seed } });
      emitBatch(buffer, 0);
      emitBatch(buffer, 0.1);
      return buffer.slots
        .filter((slot) => slot.active)
        .map((slot) => resolveWakeParticleVisual(slot, buffer.style, 0.2));
    };
    expect(run(17)).toEqual(run(17));
    const a = run(17);
    const b = run(99);
    expect(a.length).toBe(b.length);
    const anyDifferent = a.some(
      (visual, index) => JSON.stringify(visual) !== JSON.stringify(b[index])
    );
    expect(anyDifferent).toBe(true);
  });
});

describe('环形缓冲', () => {
  it('超容量时覆盖最旧批次，总数不超容量', () => {
    const buffer = createWakeTrailBuffer({ capacity: 64, style: { seed: 7 } });
    const emitted: number[] = [];
    for (let batch = 0; batch < 6; batch += 1) {
      emitted.push(emitBatch(buffer, batch * 0.1));
    }
    const totalEmitted = emitted.reduce((sum, n) => sum + n, 0);
    expect(totalEmitted).toBeGreaterThan(64);
    expect(buffer.liveCount()).toBe(64);
    const countOf = (ordinal: number) =>
      buffer.slots.filter((slot) => slot.active && slot.emitOrdinal === ordinal).length;
    expect(countOf(5)).toBe(emitted[5]);
    expect(countOf(0)).toBeLessThan(emitted[0]);
  });

  it('按 lifetime 淘汰：寿命内保留，超过 lifetimeScale×lifetimeSeconds 退休', () => {
    const buffer = createWakeTrailBuffer({ capacity: 256 });
    const activity = activityAtRatio(0.2);
    expect(activity.lifetimeScale).toBeGreaterThan(0.28);
    expect(activity.lifetimeScale).toBeLessThan(1);
    const written = emitBatch(buffer, 0, activity);
    expect(written).toBeGreaterThan(0);
    const lifetime = activity.lifetimeScale * buffer.style.lifetimeSeconds;
    buffer.update(lifetime * 0.5, 0);
    expect(buffer.liveCount()).toBe(written);
    buffer.update(lifetime + 0.01, 0);
    expect(buffer.liveCount()).toBe(0);
  });

  it('按累计航程淘汰：出生点落后超过 maxTrailLength 退休', () => {
    const buffer = createWakeTrailBuffer({ capacity: 256 });
    emitBatch(buffer, 0);
    const slot = buffer.slots.find((s) => s.active);
    expect(slot).toBeDefined();
    buffer.update(0.5, slot!.maxTrailLength * 0.5);
    expect(buffer.liveCount()).toBeGreaterThan(0);
    buffer.update(1, slot!.maxTrailLength + 0.01);
    expect(buffer.liveCount()).toBe(0);
  });

  it('活跃度为零时不发射粒子', () => {
    const buffer = createWakeTrailBuffer({ capacity: 64 });
    expect(emitBatch(buffer, 0, activityAtRatio(0))).toBe(0);
    expect(buffer.liveCount()).toBe(0);
  });
});

describe('几何构建', () => {
  it('包络：0.68 前满幅，寿命末端精确归零，整体单调不增', () => {
    // 源语义为 smoothstep(0,0.08,freshness) × tailFade²：出生端包络为 1（无出生淡入），
    // 两端透明由 Canvas alphaMap 的纵向渐变承担；寿命末端两条曲线共同归零。
    expect(computeWakeEnvelope(0)).toBeCloseTo(1, 6);
    expect(computeWakeEnvelope(0.5)).toBeCloseTo(1, 6);
    const fading = computeWakeEnvelope(0.84);
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    expect(computeWakeEnvelope(1)).toBe(0);
    let previous = 1;
    for (let age = 0; age <= 1; age += 0.04) {
      const value = computeWakeEnvelope(age);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
  });

  it('粒子数不超预算，几何对象与属性数组原地复用', () => {
    const buffer = createWakeTrailBuffer({ capacity: 48, style: { seed: 7 } });
    emitBatch(buffer, 0);
    emitBatch(buffer, 0.1);
    emitBatch(buffer, 0.2);
    const handle = createWakeTrailGeometry(48);
    const visible = updateWakeTrailGeometry(handle, buffer, 0.3);
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThanOrEqual(48);

    const positionAttribute = handle.geometry.getAttribute('position') as THREE.BufferAttribute;
    const versionBefore = positionAttribute.version;
    const arrayRef = positionAttribute.array;
    const snapshot = Float32Array.from(positionAttribute.array as Float32Array);
    const visibleLater = updateWakeTrailGeometry(handle, buffer, 2.3);
    expect(visibleLater).toBeGreaterThan(0);
    const afterAttribute = handle.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(afterAttribute.array).toBe(arrayRef);
    expect(afterAttribute.version).toBeGreaterThan(versionBefore);
    const after = afterAttribute.array as Float32Array;
    expect(after.some((value, index) => value !== snapshot[index])).toBe(true);
  });

  it('quad 沿航向拉长且保持水平，拉伸比与族因子一致', () => {
    const buffer = createWakeTrailBuffer({ capacity: 256 });
    emitBatch(buffer, 0);
    const handle = createWakeTrailGeometry(256);
    const now = 0.05;
    updateWakeTrailGeometry(handle, buffer, now);
    const positions = handle.geometry.getAttribute('position').array as Float32Array;
    const slotIndex = buffer.slots.findIndex(
      (slot) => slot.active && resolveWakeParticleVisual(slot, buffer.style, now) !== null
    );
    expect(slotIndex).toBeGreaterThanOrEqual(0);
    const slot = buffer.slots[slotIndex];
    const visual = resolveWakeParticleVisual(slot, buffer.style, now)!;
    const vertex = (i: number) =>
      [positions[(slotIndex * 4 + i) * 3], positions[(slotIndex * 4 + i) * 3 + 1], positions[(slotIndex * 4 + i) * 3 + 2]] as const;
    const a = vertex(0);
    const b = vertex(1);
    const c = vertex(2);
    const edge = (p: readonly number[], q: readonly number[]) =>
      Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const width = edge(a, b);
    const length = edge(a, c);
    expect(length / width).toBeCloseTo(visual.length / visual.width, 4);
    expect(length / width).toBeGreaterThan(1.2);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(a[1]).toBeCloseTo(c[1], 6);
  });

  it('开尔文臂粒子锚定在左右肩部一侧', () => {
    const buffer = createWakeTrailBuffer({ capacity: 512, style: { seed: 17 } });
    emitBatch(buffer, 0, FULL_ACTIVITY, true);
    const now = 6; // lifetimeScale=1 → age01 ≈ 0.3，kelvinWeight 满幅
    const kelvinVisuals = buffer.slots
      .filter((slot) => slot.active)
      .map((slot) => ({ slot, visual: resolveWakeParticleVisual(slot, buffer.style, now) }))
      .filter((entry) => entry.visual?.family === 'kelvin');
    expect(kelvinVisuals.length).toBeGreaterThan(0);
    const distanceXZ = (from: readonly number[], to: readonly number[]) =>
      Math.hypot(from[0] - to[0], from[2] - to[2]);
    for (const { slot, visual } of kelvinVisuals) {
      const sideSign = hash01(buffer.style.seed, slot.emitOrdinal, slot.planIndex, 0, 313) < 0.5 ? -1 : 1;
      const shoulder = sideSign < 0 ? SNAPSHOT.portShoulder : SNAPSHOT.starboardShoulder;
      expect(distanceXZ(visual!.center, shoulder)).toBeLessThan(
        distanceXZ(visual!.center, SNAPSHOT.stern)
      );
    }
  });
});

describe('wake 模块源断言', () => {
  const WAKE_DIR = path.join(process.cwd(), 'src/resources/simulations/scene/wake');
  const EXPERIMENT_IDS = ['destroyer', 'lng', 'container', 'cruise', 'drilling', 'icebreaker', 'dredger'];

  const walkSources = (dir: string): string[] => {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...walkSources(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
    return files;
  };

  it('无离线渲染框架残留、无实验 id、无 Math.random', () => {
    const files = walkSources(WAKE_DIR);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const lowered = source.toLowerCase();
      expect(lowered, `${file} 残留离线渲染框架引用`).not.toContain('remotion');
      expect(source, `${file} 使用了 Math.random`).not.toContain('Math.random');
      for (const id of EXPERIMENT_IDS) {
        expect(source, `${file} 硬编码实验 id "${id}"`).not.toContain(id);
      }
    }
  });

  it('index.ts 暴露公开接口', () => {
    expect(wakePublic.computeWakeSpeedActivity).toBeDefined();
    expect(wakePublic.computeWakeFamilyBudget).toBeDefined();
    expect(wakePublic.createWakeTrailBuffer).toBeDefined();
    expect(wakePublic.createWakeTrailGeometry).toBeDefined();
    expect(wakePublic.updateWakeTrailGeometry).toBeDefined();
    expect(wakePublic.resolveWakeParticleVisual).toBeDefined();
    expect(wakePublic.WakeTrail).toBeDefined();
  });
});
