import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  compensatedWaterRoughness,
  directionalFootprintMeters,
  foamIlluminationFactor,
  ggxWaterSpecular,
  litFoamColor,
  LOW_TIER_ROUGHNESS_FLOOR,
  microNormalSlope,
  microOctaveFootprintWeight,
  microOctaveWavelength,
  MICRO_COMPENSATED_ROUGHNESS_CAP,
  MICRO_NORMAL_OCTAVES_BY_TIER,
  waterFresnelSchlick,
} from '@/resources/simulations/scene/water/micro-optics';

const ROOT = process.cwd();

describe('micro normal octaves (#2100 / #2116 修订)', () => {
  it('scales optical detail by tier: high 8 / medium 3 / low 0', () => {
    expect(MICRO_NORMAL_OCTAVES_BY_TIER.high).toHaveLength(8);
    expect(MICRO_NORMAL_OCTAVES_BY_TIER.medium).toHaveLength(3);
    expect(MICRO_NORMAL_OCTAVES_BY_TIER.low).toHaveLength(0);
  });

  it('keeps every octave wind-aligned with unit direction and finite slope', () => {
    for (const octaves of Object.values(MICRO_NORMAL_OCTAVES_BY_TIER)) {
      for (const octave of octaves) {
        const length = Math.hypot(octave.direction[0], octave.direction[1]);
        expect(length).toBeCloseTo(1, 2);
        expect(Number.isFinite(octave.waveNumber)).toBe(true);
        expect(octave.slopeAmplitude).toBeGreaterThan(0);
        // 方向在风向 ±90° 扇区内（不出现逆风分量）。
        expect(octave.direction[0]).toBeGreaterThan(0.02);
      }
    }
  });

  it('is non-coherent: no collinear directions, no integer-multiple wavenumbers, fixed phase offsets', () => {
    const octaves = MICRO_NORMAL_OCTAVES_BY_TIER.high;
    const angles = new Set(octaves.map((o) => Math.atan2(o.direction[1], o.direction[0]).toFixed(6)));
    const wavenumbers = new Set(octaves.map((o) => o.waveNumber.toFixed(6)));
    expect(angles.size).toBe(octaves.length);
    expect(wavenumbers.size).toBe(octaves.length);
    // 固定相位偏移不全为 0（打乱同相叠加——刚性条纹来源）。
    const nonzeroPhases = octaves.filter((o) => o.phaseOffset !== 0);
    expect(nonzeroPhases.length).toBeGreaterThanOrEqual(octaves.length - 1);
    // 波长两两非整倍频（比值不为整数）。
    for (let i = 0; i < octaves.length; i += 1) {
      for (let j = i + 1; j < octaves.length; j += 1) {
        const ratio = Math.max(octaves[i].waveNumber, octaves[j].waveNumber)
          / Math.min(octaves[i].waveNumber, octaves[j].waveNumber);
        expect(Math.abs(ratio - Math.round(ratio))).toBeGreaterThan(0.08);
      }
    }
  });

  it('is deterministic in world coordinates and time (replayable optics)', () => {
    const octaves = MICRO_NORMAL_OCTAVES_BY_TIER.high;
    const first = microNormalSlope(octaves, 123.4, -555.6, 7.25);
    const replay = microNormalSlope(octaves, 123.4, -555.6, 7.25);
    expect(replay.dx).toBe(first.dx);
    expect(replay.dz).toBe(first.dz);
    // 不同世界点/时间产生不同斜率（非退化常量）。
    const other = microNormalSlope(octaves, 130, -550, 8);
    expect(other.dx).not.toBe(first.dx);
    expect(other.dz).not.toBe(first.dz);
  });

  it('degrades to zero slope at low tier (optical-only graceful degradation)', () => {
    const result = microNormalSlope(MICRO_NORMAL_OCTAVES_BY_TIER.low, 10, 20, 3);
    expect(result.dx).toBe(0);
    expect(result.dz).toBe(0);
    expect(result.lostSlopeFraction).toBe(0);
  });
});

describe('projected pixel footprint filtering (#2116)', () => {
  it('follows sampling density, not camera distance: smaller footprint keeps high frequencies', () => {
    const wavelength = 4.6;
    // 同一波长：DPR 提高/FOV 收窄（每像素足迹变小）→ 分量保留；
    // 掠射/降分辨率（足迹变大）→ 分量被滤除。
    expect(microOctaveFootprintWeight(wavelength, 1.0)).toBeCloseTo(1, 6);
    expect(microOctaveFootprintWeight(wavelength, 4.0)).toBeCloseTo(0, 6);
    // 交界带单调。
    let previous = 1.01;
    for (let footprint = 0.5; footprint <= 5.0; footprint += 0.25) {
      const weight = microOctaveFootprintWeight(wavelength, footprint);
      // 足迹增大 → 权重非递增（滤除更多高频）。
      expect(weight).toBeLessThanOrEqual(previous + 1e-12);
      previous = weight;
    }
  });

  it('filters per band: long waves survive a footprint that kills short waves', () => {
    const footprint = 2.2;
    const longWave = microOctaveFootprintWeight(14.0, footprint);
    const shortWave = microOctaveFootprintWeight(1.9, footprint);
    expect(longWave).toBeGreaterThan(0.9);
    expect(shortWave).toBeCloseTo(0, 6);
  });

  it('slope honors per-octave weights and reports lost energy for compensation', () => {
    const octaves = MICRO_NORMAL_OCTAVES_BY_TIER.high;
    const unfiltered = microNormalSlope(octaves, 20, -30, 5.5);
    // 大足迹：短波被滤除，斜率幅度下降、lostSlopeFraction 上升。
    const coarse = microNormalSlope(octaves, 20, -30, 5.5, 6.0);
    expect(Math.hypot(coarse.dx, coarse.dz)).toBeLessThanOrEqual(Math.hypot(unfiltered.dx, unfiltered.dz) + 1e-12);
    expect(coarse.lostSlopeFraction).toBeGreaterThan(0);
    // 小足迹：几乎无滤除。
    const fine = microNormalSlope(octaves, 20, -30, 5.5, 0.2);
    expect(fine.lostSlopeFraction).toBeLessThan(0.05);
  });

  it('uses directional footprints: waves along the short axis survive anisotropic glancing views', () => {
    const octaves = MICRO_NORMAL_OCTAVES_BY_TIER.high;
    // 掠射足迹：x 轴每像素 4m（长轴），z 轴 0.2m（短轴）。
    const glancing = { stepX: [4.0, 0] as const, stepY: [0, 0.2] as const };
    // 最贴短轴（z）传播的分量：各向同口径会误删，方向口径按自身方向保留。
    const mostZAligned = [...octaves].sort(
      (a, b) => Math.abs(b.direction[1]) - Math.abs(a.direction[1]),
    )[0];
    const wavelength = microOctaveWavelength(mostZAligned);
    const directional = directionalFootprintMeters(mostZAligned, glancing);
    const wDir = microOctaveFootprintWeight(wavelength, Math.max(directional, 1e-4));
    const wIso = microOctaveFootprintWeight(wavelength, 4.0);
    expect(wDir).toBeGreaterThan(wIso);
    expect(wDir).toBeGreaterThan(0.1);
    // 全场方向足迹的斜率能量损失严格低于各向同口径（不过度抹平定向波光）。
    const slopeDir = microNormalSlope(octaves, 5, -8, 2.5, undefined, glancing);
    const slopeIso = microNormalSlope(octaves, 5, -8, 2.5, 4.0);
    expect(slopeDir.lostSlopeFraction).toBeLessThan(slopeIso.lostSlopeFraction);
  });

  it('compensates filtered energy into bounded roughness instead of a mirror-flat far sea', () => {
    expect(compensatedWaterRoughness(0.06, 0)).toBeCloseTo(0.06, 9);
    expect(compensatedWaterRoughness(0.06, 1)).toBeCloseTo(MICRO_COMPENSATED_ROUGHNESS_CAP, 9);
    expect(MICRO_COMPENSATED_ROUGHNESS_CAP).toBeLessThan(0.4);
    // 单调。
    expect(compensatedWaterRoughness(0.06, 0.5)).toBeGreaterThan(compensatedWaterRoughness(0.06, 0.2));
    // 低档粗糙度下限：无细节成本下仍非镜面。
    expect(LOW_TIER_ROUGHNESS_FLOOR).toBeGreaterThan(0.15);
    expect(LOW_TIER_ROUGHNESS_FLOOR).toBeLessThan(0.3);
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

describe('water medium optics (#2100: Fresnel-Schlick + GGX)', () => {
  it('Fresnel-Schlick approaches F0 head-on and 1 at grazing angles', () => {
    expect(waterFresnelSchlick(1.0)).toBeCloseTo(0.02, 9);
    expect(waterFresnelSchlick(0.0)).toBeCloseTo(1.0, 9);
    // 单调：掠射角反射增强。
    const mid = waterFresnelSchlick(0.5);
    expect(mid).toBeGreaterThan(0.02);
    expect(mid).toBeLessThan(1);
  });

  it('GGX specular peaks near the mirror direction and smooths with roughness', () => {
    const sharp = ggxWaterSpecular(1.0, 0.9, 0.9, 0.06, 1.0);
    const offPeak = ggxWaterSpecular(0.8, 0.9, 0.9, 0.06, 0.95);
    expect(sharp).toBeGreaterThan(offPeak);
    // 泡沫粗糙度提升：镜向峰值降低、能量更分散。
    const roughPeak = ggxWaterSpecular(1.0, 0.9, 0.9, 0.6, 1.0);
    expect(roughPeak).toBeLessThan(sharp);
    // 永不为负。
    expect(ggxWaterSpecular(0.2, 0.5, 0.4, 0.3, 0.7)).toBeGreaterThanOrEqual(0);
  });

  it('uses the same formulas in the fragment source (world-space lighting)', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const source = fs.readFileSync(
      'src/resources/simulations/scene/water/gerstner-water-material.ts',
      'utf-8',
    );
    // 世界空间统一：视线从相机世界坐标求，法线用世界几何法线。
    expect(source).toContain('vec3 viewDirection = normalize(cameraPosition - vWorldPos);');
    expect(source).toContain('vec3 normal = normalize(vWorldNormal);');
    // Fresnel-Schlick 与 GGX（含泡沫粗糙度混合）。
    expect(source).toContain('0.02 + 0.98 * pow(1.0 - nDotV, 5.0)');
    expect(source).toContain('float baseRoughness = max(uMicroRoughnessFloor, mix(0.06, 0.6, foam));');
    expect(source).toContain('float roughness = max(baseRoughness, compensatedRoughness);');
    expect(source).toContain('float distribution = a2 / (3.14159265 * dTerm * dTerm);');
    expect(source).toContain('float vDotH = max(dot(viewDirection, halfVector), 0.0);');
    // 旧固定指数高光已移除。
    expect(source).not.toContain('pow(max(dot(reflect(-uSunDirection');
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
    expect(fragment).toContain('normal = normalize(normal + vec3(slopeX, 0.0, slopeZ));');
    // #2116：片元以 dFdx/dFdy 世界足迹做逐频带过滤（非仅距离衰减）。
    expect(fragment).toContain('dFdx(vWorldPos.xz)');
    // 各频带按传播方向投影像素步（掠射各向异性足迹不过度抹平定向波光）。
    expect(fragment).toContain('directionalStep');
    expect(fragment).toContain('wavelength / max(directionalStep, 1e-4)');
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
