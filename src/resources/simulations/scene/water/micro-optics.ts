/**
 * 微尺度水体光学（#2100）：高频微法线与泡沫光照的档位参数与脚印过滤。
 *
 * 纯模块。微法线只改变着色法线（光学），不进入几何位移与姿态采样——
 * 光学质量降档时船体姿态与基础波场不变（spec：optical quality changes）。
 * 纹理/斜率细节按像素脚印（相机距离）衰减：远海细节平滑退化为基础法线，
 * 不产生远距离高频闪烁。
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
}

/** 各档位微法线八分量：high 3 / medium 2 / low 0（细节只影响光学，随档优雅退化）。 */
export const MICRO_NORMAL_OCTAVES_BY_TIER: Record<GerstnerWaterTier, readonly MicroNormalOctave[]> = {
  high: [
    { direction: [0.92, 0.39], waveNumber: 1.35, slopeAmplitude: 0.055, speedScale: 1.0 },
    { direction: [0.39, -0.92], waveNumber: 2.6, slopeAmplitude: 0.032, speedScale: 1.15 },
    { direction: [-0.71, -0.71], waveNumber: 4.9, slopeAmplitude: 0.018, speedScale: 1.3 },
  ],
  medium: [
    { direction: [0.92, 0.39], waveNumber: 1.35, slopeAmplitude: 0.055, speedScale: 1.0 },
    { direction: [0.39, -0.92], waveNumber: 2.6, slopeAmplitude: 0.032, speedScale: 1.15 },
  ],
  low: [],
};

/** 微法线全衰减距离（米）：超过后细节为零（远海平滑，避免高频闪烁与混叠）。 */
export const MICRO_NORMAL_FADE_DISTANCE_METERS = 900;

/**
 * 像素脚印衰减：相机到水面点的距离驱动的平滑阶跃——近处 1，超过 fadeStart
 * 后 smoothstep 衰减到 fadeEnd 为 0。C1 连续（两端导数为零）。
 */
export function microNormalFootprintAttenuation(
  cameraDistanceMeters: number,
  fadeStartMeters: number,
  fadeEndMeters: number,
): number {
  if (cameraDistanceMeters <= fadeStartMeters) return 1;
  if (cameraDistanceMeters >= fadeEndMeters) return 0;
  const t = (cameraDistanceMeters - fadeStartMeters) / (fadeEndMeters - fadeStartMeters);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * 微法线斜率（纯函数，供测试与 CPU 参照）：对世界坐标 (x,z) 与时间求
 * 风向对齐正弦斜率对 (dSx, dSz)。与 GPU 片元实现同一公式。
 */
export function microNormalSlope(
  octaves: readonly MicroNormalOctave[],
  worldX: number,
  worldZ: number,
  timeSeconds: number,
): { dx: number; dz: number } {
  let dx = 0;
  let dz = 0;
  for (const octave of octaves) {
    const phase = octave.waveNumber * (octave.direction[0] * worldX + octave.direction[1] * worldZ)
      - octave.waveNumber * octave.speedScale * 1.2 * timeSeconds;
    const slope = octave.slopeAmplitude * Math.cos(phase) * octave.waveNumber;
    dx += slope * octave.direction[0];
    dz += slope * octave.direction[1];
  }
  return { dx, dz };
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
