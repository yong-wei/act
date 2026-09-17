import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  foamIlluminationFactor,
  litFoamColor,
  microNormalFootprintAttenuation,
  microNormalSlope,
  MICRO_NORMAL_FADE_DISTANCE_METERS,
  MICRO_NORMAL_OCTAVES_BY_TIER,
} from '@/resources/simulations/scene/water/micro-optics';

const ROOT = process.cwd();

describe('micro normal octaves (#2100)', () => {
  it('scales optical detail by tier: high 3 / medium 2 / low 0', () => {
    expect(MICRO_NORMAL_OCTAVES_BY_TIER.high).toHaveLength(3);
    expect(MICRO_NORMAL_OCTAVES_BY_TIER.medium).toHaveLength(2);
    expect(MICRO_NORMAL_OCTAVES_BY_TIER.low).toHaveLength(0);
  });

  it('keeps every octave wind-aligned with unit direction and finite slope', () => {
    for (const octaves of Object.values(MICRO_NORMAL_OCTAVES_BY_TIER)) {
      for (const octave of octaves) {
        const length = Math.hypot(octave.direction[0], octave.direction[1]);
        expect(length).toBeCloseTo(1, 2);
        expect(Number.isFinite(octave.waveNumber)).toBe(true);
        expect(octave.slopeAmplitude).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic in world coordinates and time (replayable optics)', () => {
    const octaves = MICRO_NORMAL_OCTAVES_BY_TIER.high;
    const first = microNormalSlope(octaves, 123.4, -555.6, 7.25);
    const replay = microNormalSlope(octaves, 123.4, -555.6, 7.25);
    expect(replay).toEqual(first);
    // 不同世界点/时间产生不同斜率（非退化常量）。
    const other = microNormalSlope(octaves, 130, -550, 8);
    expect(other).not.toEqual(first);
  });

  it('degrades to zero slope at low tier (optical-only graceful degradation)', () => {
    expect(microNormalSlope(MICRO_NORMAL_OCTAVES_BY_TIER.low, 10, 20, 3))
      .toEqual({ dx: 0, dz: 0 });
  });
});

describe('pixel footprint attenuation (#2100)', () => {
  const start = MICRO_NORMAL_FADE_DISTANCE_METERS * 0.35;
  const end = MICRO_NORMAL_FADE_DISTANCE_METERS;

  it('is 1 near the camera and 0 beyond the fade end (no distant shimmer)', () => {
    expect(microNormalFootprintAttenuation(10, start, end)).toBe(1);
    expect(microNormalFootprintAttenuation(start, start, end)).toBe(1);
    expect(microNormalFootprintAttenuation(end, start, end)).toBe(0);
    expect(microNormalFootprintAttenuation(end + 5000, start, end)).toBe(0);
  });

  it('decreases monotonically and is C1 at the band boundaries', () => {
    const h = 0.01;
    const slope = (d: number) =>
      (microNormalFootprintAttenuation(d + h, start, end) - microNormalFootprintAttenuation(d - h, start, end)) / (2 * h);
    expect(Math.abs(slope(start))).toBeLessThan(1e-6);
    expect(Math.abs(slope(end))).toBeLessThan(1e-6);
    for (let d = start; d < end; d += (end - start) / 8) {
      expect(microNormalFootprintAttenuation(d + 1, start, end))
        .toBeLessThanOrEqual(microNormalFootprintAttenuation(d, start, end) + 1e-12);
    }
  });
});

describe('lit foam (#2100)', () => {
  it('darkens coherently under lower sun illumination instead of additive emission', () => {
    const foam = { r: 0.95, g: 0.97, b: 0.98 };
    // 开阔海（强度 2.0 → 辐照 1.0）vs 阴云（0.9 → 0.45）：同入射角下泡沫整体变暗。
    const sunny = litFoamColor(foam, foamIlluminationFactor(0.8, 1.0));
    const overcast = litFoamColor(foam, foamIlluminationFactor(0.8, 0.45));
    expect(sunny.r).toBeCloseTo(0.95 * (0.8 * 0.65 + 0.35), 9);
    expect(overcast.r).toBeCloseTo(0.95 * (0.8 * 0.45 * 0.65 + 0.35 * 0.45), 9);
    expect(overcast.r).toBeLessThan(sunny.r);
    // 各通道同因子缩放：暗预设下泡沫整体变暗，不改变色相。
    expect(overcast.g / overcast.r).toBeCloseTo(foam.g / foam.r, 9);
    // 辐照为 0（夜间级）时泡沫仍有环境底光，不为纯 additive 恒亮。
    expect(foamIlluminationFactor(0.5, 0)).toBeCloseTo(0, 9);
  });
});

describe('optics do not touch motion or optional passes (#2100 contracts)', () => {
  it('keeps micro normals in the fragment stage only (no geometry/pose coupling)', () => {
    const source = readFileSync(
      path.join(ROOT, 'src/resources/simulations/scene/water/gerstner-water-material.ts'),
      'utf-8',
    );
    // 微法线只扰动着色法线；位移/姿态公式不引用微法线 uniform。
    // 顶点/片元着色器字符串分别截取：微法线只允许出现在片元。
    const vertexStart = source.indexOf('vertexShader:');
    const fragmentStart = source.indexOf('fragmentShader:');
    expect(vertexStart).toBeGreaterThan(-1);
    expect(fragmentStart).toBeGreaterThan(vertexStart);
    const fragment = source.slice(fragmentStart);
    expect(fragment).toContain('normal = normalize(normal + vec3(slopeX, 0.0, slopeZ) * footprint);');
    expect(source.slice(vertexStart, fragmentStart)).not.toContain('uMicroOctaves');
    // 受光泡沫：照明因子乘泡沫色（非恒亮 additive）。
    expect(fragment).toContain('vec3 foamLit = uFoamColor * (light * 0.65 + 0.35 * uSunIllumination);');
  });

  it('allocates no reflection/refraction render passes by default (deep water opaque)', () => {
    const files = [
      'src/resources/simulations/scene/water/gerstner-water.tsx',
      'src/resources/simulations/scene/water/gerstner-water-material.ts',
      'src/resources/simulations/scene/water/micro-optics.ts',
    ];
    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), 'utf-8');
      expect(source).not.toContain('WebGLRenderTarget');
      expect(source).not.toContain('Reflector');
      expect(source).not.toContain('refraction');
    }
  });
});
