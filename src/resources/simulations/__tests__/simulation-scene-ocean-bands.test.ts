import { describe, expect, it } from 'vitest';

import {
  bandCellSize,
  bandLimitWaves,
  FAR_FIELD_BAND_SPECS,
  INTERVALS_PER_SHORTEST_WAVELENGTH,
  minResolvableWavelength,
  nearFieldEnvelope,
  NEAR_FIELD_FADE_BAND_METERS,
} from '@/resources/simulations/scene/water/ocean-bands';
import {
  farFieldVisibleWavesForTier,
  GERSTNER_WATER_BASE_Y,
  gerstnerAmplitudeScale,
  NEAR_FIELD_APPROXIMATION_TOLERANCE_METERS,
  NEAR_FIELD_INTERVALS_PER_WAVELENGTH,
  NEAR_FIELD_MESH_SPEC,
  NEAR_FIELD_VISIBLE_WAVES,
  createNearFieldSurfaceQuery,
} from '@/resources/simulations/scene/water/gerstner-water';
import { GERSTNER_WAVE_SETS } from '@/resources/simulations/scene/water/gerstner-waves';

describe('band limiting (#2098)', () => {
  it('derives the resolvable wavelength from cell size and interval count', () => {
    expect(minResolvableWavelength(8, 4)).toBe(32);
    expect(minResolvableWavelength(234.375, INTERVALS_PER_SHORTEST_WAVELENGTH)).toBeCloseTo(
      234.375 * INTERVALS_PER_SHORTEST_WAVELENGTH,
      6,
    );
  });

  it('keeps only resolvable frequencies per mesh spacing', () => {
    const cell = 16;
    const kept = bandLimitWaves(GERSTNER_WAVE_SETS.high, cell, 8);
    expect(kept.every((wave) => wave.wavelength >= 8 * cell)).toBe(true);
    // 被裁频带不得进入几何。
    expect(bandLimitWaves(GERSTNER_WAVE_SETS.high, cell, 8).map((w) => w.wavelength))
      .toEqual([300, 210, 150]);
  });

  it('fixes the near-field band independent of quality tier', () => {
    expect(bandCellSize(NEAR_FIELD_MESH_SPEC)).toBe(8);
    expect(NEAR_FIELD_INTERVALS_PER_WAVELENGTH).toBe(4);
    expect(NEAR_FIELD_VISIBLE_WAVES.map((wave) => wave.wavelength))
      .toEqual([300, 210, 150, 110, 85, 64, 48, 36]);
    // 声明容差覆盖被裁频带（27/20/14/9 m）的振幅和 × 最大海况（6）倍率。
    const cutAmplitude = GERSTNER_WAVE_SETS.high
      .filter((wave) => wave.wavelength < 32)
      .reduce((sum, wave) => sum + wave.amplitude, 0);
    expect(cutAmplitude * gerstnerAmplitudeScale(6)).toBeLessThanOrEqual(
      NEAR_FIELD_APPROXIMATION_TOLERANCE_METERS,
    );
  });

  it('renders no geometric waves on the far field at any tier (no distant aliasing)', () => {
    for (const tier of ['high', 'medium', 'low'] as const) {
      expect(farFieldVisibleWavesForTier(tier)).toEqual([]);
      // 远场网格分辨率仍按画质档缩放（表现成本随档变化）。
      expect(FAR_FIELD_BAND_SPECS[tier].resolution).toBeGreaterThan(0);
    }
  });
});

describe('near-field amplitude envelope (#2098)', () => {
  const size = NEAR_FIELD_MESH_SPEC.size;

  it('is 1 across the core and 0 at the edge', () => {
    expect(nearFieldEnvelope(0, 0, size)).toBe(1);
    // fadeStart = 1024 - 384 = 640：核心半径内恒为 1。
    expect(nearFieldEnvelope(600, -600, size)).toBe(1);
    expect(nearFieldEnvelope(size / 2, 0, size)).toBe(0);
    expect(nearFieldEnvelope(0, -size / 2, size)).toBe(0);
  });

  it('is C1-continuous across the fade band boundaries', () => {
    const fadeStart = size / 2 - NEAR_FIELD_FADE_BAND_METERS;
    const h = 0.01;
    const slope = (x: number) => (nearFieldEnvelope(x + h, 0, size) - nearFieldEnvelope(x - h, 0, size)) / (2 * h);
    // fadeStart 与外缘处一阶导平滑（无折痕）。
    expect(Math.abs(slope(fadeStart))).toBeLessThan(1e-6);
    expect(Math.abs(slope(size / 2))).toBeLessThan(1e-6);
    // 包络单调不增。
    for (let x = fadeStart; x < size / 2; x += NEAR_FIELD_FADE_BAND_METERS / 8) {
      expect(nearFieldEnvelope(x + 0.5, 0, size)).toBeLessThanOrEqual(nearFieldEnvelope(x, 0, size) + 1e-12);
    }
  });
});

describe('near-field visible surface vs independent reference (#2098)', () => {
  // 独立参照：测试内直接求和 Gerstner 分量，不复用生产 computeGerstnerDisplacement。
  const referenceDisplacement = (
    waves: { direction: readonly [number, number]; amplitude: number; wavelength: number; speed: number; steepness: number }[],
    scale: number,
    worldX: number,
    worldZ: number,
    time: number,
  ): { y: number; offsetX: number; offsetZ: number } => {
    let y = 0;
    let offsetX = 0;
    let offsetZ = 0;
    for (const w of waves) {
      const len = Math.hypot(w.direction[0], w.direction[1]) || 1;
      const dx = w.direction[0] / len;
      const dz = w.direction[1] / len;
      const k = (2 * Math.PI) / w.wavelength;
      const c = w.speed * Math.sqrt(9.8 / k);
      const phase = k * (dx * worldX + dz * worldZ) - c * k * time;
      y += (w.amplitude * scale) * Math.sin(phase);
      offsetX += w.steepness * (w.amplitude * scale) * dx * Math.cos(phase);
      offsetZ += w.steepness * (w.amplitude * scale) * dz * Math.cos(phase);
    }
    return { y, offsetX, offsetZ };
  };
  const referenceHeight = (
    waves: { direction: readonly [number, number]; amplitude: number; wavelength: number; speed: number; steepness: number }[],
    scale: number,
    worldX: number,
    worldZ: number,
    time: number,
  ): number => {
    let y = 0;
    for (const w of waves) {
      const len = Math.hypot(w.direction[0], w.direction[1]) || 1;
      const dx = w.direction[0] / len;
      const dz = w.direction[1] / len;
      const k = (2 * Math.PI) / w.wavelength;
      const c = w.speed * Math.sqrt(9.8 / k);
      y += (w.amplitude * scale) * Math.sin(k * (dx * worldX + dz * worldZ) - c * k * time);
    }
    return y;
  };

  it('meets the declared tolerance against the inverted base surface at the worst sea state (scan)', () => {
    // 四轮复审：容差须覆盖频带裁剪 + 网格插值。独立参照反解水平 Gerstner 位移
    // （求参数点使其位移后落在查询点），得到真实基础曲面高度。
    const invertReference = (
      waves: typeof GERSTNER_WAVE_SETS.high,
      scale: number,
      worldX: number,
      worldZ: number,
      time: number,
    ): number => {
      let ux = worldX;
      let uz = worldZ;
      for (let iter = 0; iter < 4; iter += 1) {
        // referenceDisplacement 的 offsetX/Z 已含 scale，反解不得再乘一次（五轮复审）。
        const d = referenceDisplacement(waves, scale, ux, uz, time);
        ux = worldX - d.offsetX;
        uz = worldZ - d.offsetZ;
      }
      return referenceDisplacement(waves, scale, ux, uz, time).y;
    };
    const seaState = 6;
    const scale = gerstnerAmplitudeScale(seaState);
    const origin = { x: 123.4, z: -555.6 };
    const time = 14.91;
    const query = createNearFieldSurfaceQuery(scale, origin.x, origin.z, time);
    let maxError = 0;
    // 确定性扫描：包络=1 核心区的非顶点点位（含评审实测的 -587.538,-595.602）。
    const probes: Array<[number, number]> = [[-587.538, -595.602]];
    for (let i = 0; i < 24; i += 1) {
      probes.push([(i * 137.11) % 620 - 310, ((i * 91.7) % 640) - 320]);
    }
    for (const [localX, localZ] of probes) {
      const sampled = query.heightAt(origin.x + localX, origin.z + localZ);
      const reference = GERSTNER_WATER_BASE_Y
        + invertReference(GERSTNER_WAVE_SETS.high, scale, origin.x + localX, origin.z + localZ, time);
      maxError = Math.max(maxError, Math.abs(sampled - reference));
    }
    expect(maxError).toBeLessThanOrEqual(NEAR_FIELD_APPROXIMATION_TOLERANCE_METERS);
    // 扫描确实覆盖到接近容差的误差区间（防退化成空测）。
    expect(maxError).toBeGreaterThan(0.3);
  });

  it('agrees with the analytic band field at non-vertex points across sea states', () => {
    const origin = { x: 512.5, z: -300.25 };
    const time = 19.75;
    for (const seaState of [1, 2, 3, 4, 5, 6]) {
      const scale = gerstnerAmplitudeScale(seaState);
      const query = createNearFieldSurfaceQuery(scale, origin.x, origin.z, time);
      for (const [localX, localZ] of [[13.7, -91.3], [203.1, 77.7], [-444.9, 512.2], [65.4, 3.3]]) {
        const sampled = query.heightAt(origin.x + localX, origin.z + localZ);
        const reference = GERSTNER_WATER_BASE_Y
          + referenceHeight(NEAR_FIELD_VISIBLE_WAVES as typeof GERSTNER_WAVE_SETS.high, scale, origin.x + localX, origin.z + localZ, time);
        // 非顶点点位：网格插值 vs 解析带内场，声明容差内一致（CPU/GPU 同网格同参数）。
        expect(Math.abs(sampled - reference)).toBeLessThanOrEqual(NEAR_FIELD_APPROXIMATION_TOLERANCE_METERS);
      }
    }
  });

  it('fades geometry to the base plane at the near-field edge (continuous seam with the far plane)', () => {
    const scale = gerstnerAmplitudeScale(3);
    const time = 33.3;
    const origin = { x: 0, z: 0 };
    const query = createNearFieldSurfaceQuery(scale, origin.x, origin.z, time);
    // 边缘点（包络=0）：高度即基准平面，与远场平基面同值 → 无接缝裂缝。
    const edge = NEAR_FIELD_MESH_SPEC.size / 2 - 0.5;
    // 边缘角点包络≈0（角点 1016m 处包络 ~0.0015）：接缝残差远小于声明容差。
    expect(Math.abs(query.heightAt(edge, 0) - GERSTNER_WATER_BASE_Y)).toBeLessThan(0.05);
    expect(Math.abs(query.heightAt(0, -edge) - GERSTNER_WATER_BASE_Y)).toBeLessThan(0.05);
    // 核心点仍有几何起伏（包络=1，非退化）。
    const core = query.heightAt(40.2, 61.8);
    const analyticCore = GERSTNER_WATER_BASE_Y
      + referenceHeight(NEAR_FIELD_VISIBLE_WAVES as typeof GERSTNER_WAVE_SETS.high, scale, 40.2, 61.8, time);
    expect(Math.abs(core - GERSTNER_WATER_BASE_Y)).toBeGreaterThan(0);
    expect(Math.abs(core - analyticCore)).toBeLessThanOrEqual(NEAR_FIELD_APPROXIMATION_TOLERANCE_METERS);
  });

  it('keeps batch queries world-anchored: same world point, any mesh origin', () => {
    const scale = gerstnerAmplitudeScale(4);
    const time = 5.5;
    const worldPoint = { x: 321.4, z: -123.9 };
    const heights = [
      { x: 0, z: 0 },
      { x: 300, z: -100 },
      { x: -60, z: 40 },
    ].map((origin) =>
      createNearFieldSurfaceQuery(scale, origin.x, origin.z, time).heightAt(worldPoint.x, worldPoint.z)
    );
    // 插值近似容差内原点不变（解析带场在世界坐标上严格原点无关）。
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(
      NEAR_FIELD_APPROXIMATION_TOLERANCE_METERS,
    );
  });
});

describe('hull pose samples the visible near field (#2098)', () => {
  it('binds the destroyer frame water sampler to the band-limited near-field surface', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const destroyer = fs.readFileSync(
      'src/resources/simulations/simulations/destroyer-simulation.tsx',
      'utf-8',
    );
    // 姿态五点采样与 GPU 近场同场（三轮复审）：带限波组 + 近场网格 + 角点包络。
    expect(destroyer).toContain('waterSampler: (worldX, worldZ, timeSeconds) =>');
    expect(destroyer).toContain(
      'sampleVisibleWaterHeight(\n          NEAR_FIELD_VISIBLE_WAVES,'
        .replace('\\n', '\n'),
    );
    expect(destroyer).not.toContain('MARINE_BASE_INTERACTION_WAVES,\n          gerstnerAmplitudeScale'
      .replace('\\n', '\n'));
  });
});

describe('shader surface derivative contract (#2098)', () => {
  it('compares the full parametric normal in the material source', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const source = fs.readFileSync(
      'src/resources/simulations/scene/water/gerstner-water-material.ts',
      'utf-8',
    );
    // 完整参数曲面偏导（含水平位移 Jacobian + 包络梯度乘积法则）与 +Y 主导守卫。
    expect(source).toContain('vec3 dPdx = vec3(1.0 + dSxdx + envelopeDx * rawSx, dYdx + envelopeDx * rawY, dSzdx + envelopeDx * rawSz);');
    expect(source).toContain('vec3 dPdz = vec3(dSxdz + envelopeDz * rawSx, dYdz + envelopeDz * rawY, 1.0 + dSzdz + envelopeDz * rawSz);');
    expect(source).toContain('if (surfaceNormal.y < 0.0) surfaceNormal = -surfaceNormal;');
    // 包络梯度解析（C1：两端 6t(1-t)=0）。
    expect(source).toContain('float dEdge = -6.0 * te * (1.0 - te) / uEnvelopeFadeBand;');
    // 近场包络进顶点幅度；远场近场覆盖区片元丢弃（复审修复）。
    expect(source).toContain('float amp = ampRaw * envelope;');
    expect(source).toContain('float ampRaw = uWaves[base + 2] * uAmplitudeScale;');
    expect(source).toContain('max(abs(vLocalXZ.x), abs(vLocalXZ.y)) < uNearCutoutHalfSize) discard;');
    // 旧近似法线公式已移除。
    expect(source).not.toContain('normalize(vec3(-dYdx, 1.0, -dYdz))');
  });
});
