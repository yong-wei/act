/**
 * 微尺度水体光学（#2100 建立 / #2115 后续 / #2116 修订）：
 * 高频微法线、泡沫光照参数与**投影像素脚印逐频带过滤**。
 *
 * 纯模块。微法线只改变着色法线（光学），不进入几何位移与姿态采样——
 * 光学质量降档时船体姿态与基础波场不变。
 *
 * #2116 修订：
 * - 相干三分量（规则条纹来源）→ 风向锚定的**非共线/非整倍频**有限八分量组
 *   （确定性构造，固定相位偏移与幅度抖动，温和时间变化）。
 * - 距离衰减（315–900m）→ **投影像素脚印**逐频带过滤（dFdx/dFdy 世界足迹）：
 *   分辨率/FOV/掠射角变化都会改变过滤，而不只随距离。
 * - 被滤除的斜率能量以有界粗糙度补偿保留高光能量与远海质感（900m 处
 *   不再硬变镜面）；低档/远场保持合理远海粗糙度（非零光学结构）。
 */

import type { GerstnerWaterTier } from './gerstner-water';

export interface MicroNormalOctave {
  /** 风向对齐的传播方向（XY 单位化）。 */
  readonly direction: readonly [number, number];
  /** 空间角频率（弧度/米）。 */
  readonly waveNumber: number;
  /** 斜率振幅（无量纲，叠加在着色法线上）。 */
  readonly slopeAmplitude: number;
  /** 相对主波场的时间频率倍率。 */
  readonly speedScale: number;
  /** 固定相位偏移（弧度）：打乱同相叠加，消除刚性条纹。 */
  readonly phaseOffset: number;
}

/**
 * 风向基（主波向 [1, 0.1] 归一）：所有八分量在此 ±90° 扇区内散布。
 */
const WIND_BASE_DIRECTION: readonly [number, number] = [0.99503719, 0.09950372];

/** 确定性构造常量（固定种子语义：不用任何运行时随机源）。 */
const MICRO_ANGLE_OFFSETS_DEG: readonly number[] = [0, 14, -23, 41, -58, 77, -89, 63];
const MICRO_WAVENUMBERS: readonly number[] = [1.35, 2.17, 3.41, 4.87, 5.93, 7.11, 8.23, 9.05];
const MICRO_AMPLITUDE_JITTER: readonly number[] = [1.0, 1.14, 0.88, 1.09, 0.83, 1.18, 0.91, 1.06];
const MICRO_PHASE_OFFSETS: readonly number[] = [
  0.0, 2.399, 4.106, 1.027, 5.312, 3.301, 0.733, 4.918,
];
/** 各档分量数：high 8 / medium 3 / low 0（细节只影响光学，随档优雅退化）。 */
const MICRO_OCTAVE_COUNT_BY_TIER: Record<GerstnerWaterTier, number> = {
  high: 8,
  medium: 3,
  low: 0,
};

const HIGH_TIER_SLOPE_AMPLITUDE = 0.055;

function buildOctaves(count: number): readonly MicroNormalOctave[] {
  const octaves: MicroNormalOctave[] = [];
  const [windX, windZ] = WIND_BASE_DIRECTION;
  for (let index = 0; index < count && index < MICRO_WAVENUMBERS.length; index += 1) {
    const angle = (MICRO_ANGLE_OFFSETS_DEG[index] * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const direction: readonly [number, number] = [
      windX * cos - windZ * sin,
      windX * sin + windZ * cos,
    ];
    const waveNumber = MICRO_WAVENUMBERS[index];
    // 高频分量幅度按 k^-0.85 递减 + 固定抖动：无单一主导周期条纹。
    const slopeAmplitude =
      (HIGH_TIER_SLOPE_AMPLITUDE * Math.pow(waveNumber / MICRO_WAVENUMBERS[0], -0.85)) *
      MICRO_AMPLITUDE_JITTER[index];
    octaves.push({
      direction,
      waveNumber,
      slopeAmplitude,
      speedScale: 1.0 + index * 0.06,
      phaseOffset: MICRO_PHASE_OFFSETS[index],
    });
  }
  return octaves;
}

/** 各档位微法线分量：非共线方向 × 非整倍频波数 × 固定相位偏移（非相干和）。 */
export const MICRO_NORMAL_OCTAVES_BY_TIER: Record<GerstnerWaterTier, readonly MicroNormalOctave[]> = {
  high: buildOctaves(MICRO_OCTAVE_COUNT_BY_TIER.high),
  medium: buildOctaves(MICRO_OCTAVE_COUNT_BY_TIER.medium),
  low: buildOctaves(MICRO_OCTAVE_COUNT_BY_TIER.low),
};

/** 单个分量的波长（米）。 */
export const microOctaveWavelength = (octave: MicroNormalOctave): number =>
  (2 * Math.PI) / octave.waveNumber;

/**
 * 逐频带投影像素脚印权重（#2116）：λ/footprint 从 2.6（充分可解析）到
 * 1.15（亚 Nyquist）smoothstep 衰减——分辨率/FOV/掠射变化改变 footprint，
 * 过滤随采样密度变化而非只随距离。与片元实现同一公式。
 */
export function microOctaveFootprintWeight(
  wavelengthMeters: number,
  footprintMetersPerPixel: number,
): number {
  if (footprintMetersPerPixel <= 0) return 1;
  const t = Math.min(
    Math.max((wavelengthMeters / footprintMetersPerPixel - 1.15) / (2.6 - 1.15), 0),
    1,
  );
  return t * t * (3 - 2 * t);
}

/** 斜率能量补偿上限：被滤除能量全部转移时有界粗糙度（远海不镜面化）。 */
export const MICRO_COMPENSATED_ROUGHNESS_CAP = 0.34;

/**
 * 粗糙度能量补偿（#2116）：被脚印过滤滤除的斜率能量按比例转成有界粗糙度，
 * 保留高光能量与远海质感；lostFraction ∈ [0,1]。
 */
export function compensatedWaterRoughness(
  baseRoughness: number,
  lostSlopeFraction: number,
): number {
  const t = Math.min(Math.max(lostSlopeFraction, 0), 1);
  return baseRoughness + (MICRO_COMPENSATED_ROUGHNESS_CAP - baseRoughness) * t;
}

/** 低档/远场粗糙度下限：无细节成本下保持合理远海粗糙度（非镜面平板）。 */
export const LOW_TIER_ROUGHNESS_FLOOR = 0.22;

/**
 * 微法线斜率（纯函数，供测试与 CPU 参照）：对世界坐标 (x,z) 与时间求
 * 风向对齐正弦斜率 (dSx, dSz)。与 GPU 片元实现同一公式；提供
 * footprintMetersPerPixel 时逐频带施加脚印权重并返回被滤除能量占比。
 */
export function microNormalSlope(
  octaves: readonly MicroNormalOctave[],
  worldX: number,
  worldZ: number,
  timeSeconds: number,
  footprintMetersPerPixel?: number,
): { dx: number; dz: number; lostSlopeFraction: number } {
  let dx = 0;
  let dz = 0;
  let energyTotal = 0;
  let energyRetained = 0;
  for (const octave of octaves) {
    const weight =
      footprintMetersPerPixel === undefined
        ? 1
        : microOctaveFootprintWeight(microOctaveWavelength(octave), footprintMetersPerPixel);
    energyTotal += octave.slopeAmplitude;
    energyRetained += octave.slopeAmplitude * weight;
    if (weight <= 0.002) continue;
    const phase =
      octave.waveNumber * (octave.direction[0] * worldX + octave.direction[1] * worldZ) -
      octave.waveNumber * octave.speedScale * 1.2 * timeSeconds +
      octave.phaseOffset;
    const slope = octave.slopeAmplitude * Math.cos(phase) * octave.waveNumber * weight;
    dx += slope * octave.direction[0];
    dz += slope * octave.direction[1];
  }
  const lostSlopeFraction = energyTotal > 0 ? Math.min(Math.max(1 - energyRetained / energyTotal, 0), 1) : 0;
  return { dx, dz, lostSlopeFraction };
}

/**
 * 泡沫照明因子（spec：illumination changes to a dark preset；#2100 复审含同源辐照）：
 * (N·L × 太阳辐照归一) × 0.65 + 0.35 × 辐照——与片元 water 光照项同一公式，
 * 暗预设下泡沫与水色整体变暗（受光表面，非恒亮 additive）。
 */
export function foamIlluminationFactor(
  sunDotNormal: number,
  sunIllumination: number,
): number {
  const light = Math.max(sunDotNormal, 0) * sunIllumination;
  return light * 0.65 + 0.35 * sunIllumination;
}

/** 受光泡沫颜色：各通道同因子缩放（不改变色相）。 */
export function litFoamColor(
  foamColor: { r: number; g: number; b: number },
  illuminationFactor: number,
): { r: number; g: number; b: number } {
  return {
    r: foamColor.r * illuminationFactor,
    g: foamColor.g * illuminationFactor,
    b: foamColor.b * illuminationFactor,
  };
}

/** 水介质基础反射率（F0，非金属）。 */
export const WATER_F0 = 0.02;

/** 基础水面粗糙度；泡沫将其提升到 ~0.6（受光且改变粗糙度）。 */
export const WATER_BASE_ROUGHNESS = 0.06;
export const FOAM_ROUGHNESS = 0.6;

/** Fresnel-Schlick：掠射角 → 1，法线入射 → F0。 */
export function waterFresnelSchlick(cosTheta: number, f0: number = WATER_F0): number {
  const c = Math.min(Math.max(cosTheta, 0), 1);
  return f0 + (1 - f0) * Math.pow(1 - c, 5);
}

/**
 * GGX 高光（D·F·G / (4 (n·v)(n·l))，Smith-Schlick G 近似）——纯函数参照，
 * 与片元实现同一公式；粗糙度随泡沫提升。
 */
export function ggxWaterSpecular(
  nDotH: number,
  nDotV: number,
  nDotL: number,
  roughness: number,
  vDotH: number,
  f0: number = WATER_F0,
): number {
  const a = Math.max(roughness * roughness, 1e-4);
  const a2 = a * a;
  const nh = Math.min(Math.max(nDotH, 0), 1);
  const d = (nh * nh) * (a2 - 1) + 1;
  const distribution = a2 / (Math.PI * d * d);
  // 微表面 Schlick 项取视线与半角向量夹角（V·H），非入射余弦（三轮复审）。
  const fresnel = waterFresnelSchlick(vDotH, f0);
  const k = a / 2;
  const gV = nDotV / (nDotV * (1 - k) + k);
  const gL = nDotL / (nDotL * (1 - k) + k);
  const denominator = Math.max(4 * nDotV * nDotL, 1e-4);
  return distribution * fresnel * gV * gL / denominator;
}
