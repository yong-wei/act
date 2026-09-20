/**
 * 带限多尺度海面（#2098）：按网格间距裁剪不可解析波频带 + 近场幅度包络。
 *
 * 纯模块。频带规则：几何只承载波长 ≥ intervalsPerWavelength × 网格间距的分量
 * （约 8 间隔/最短几何波长为初始设计值，见 change design）；低于该频带的短波
 * 交给后续微法线（#2100），不得混叠成可见长波。
 * 所有档位共享同一基础波参数与海况倍率；档位只改变网格密度（即各网格解析的
 * 频带范围），不改变基础交互波场（#2097 已固定的档位无关采样基准继续有效）。
 */

import type { GerstnerWave } from './gerstner-waves';

/** 约每最短几何波长的采样间隔数（设计初始值，按误差实测裁决）。 */
export const INTERVALS_PER_SHORTEST_WAVELENGTH = 8;

/** 网格间距可解析的最短波长。 */
export function minResolvableWavelength(
  cellSize: number,
  intervalsPerWavelength: number = INTERVALS_PER_SHORTEST_WAVELENGTH,
): number {
  return intervalsPerWavelength * cellSize;
}

/** 按网格间距裁剪波组：只保留可解析频带（按波长降序输入保持次序）。 */
export function bandLimitWaves(
  waves: readonly GerstnerWave[],
  cellSize: number,
  intervalsPerWavelength: number = INTERVALS_PER_SHORTEST_WAVELENGTH,
): GerstnerWave[] {
  const minWavelength = minResolvableWavelength(cellSize, intervalsPerWavelength);
  return waves.filter((wave) => wave.wavelength >= minWavelength);
}

export interface OceanMeshBandSpec {
  /** 网格世界边长（米）。 */
  readonly size: number;
  readonly resolution: number;
}

export function bandCellSize(spec: OceanMeshBandSpec): number {
  return spec.size / spec.resolution;
}

/**
 * 近场交互网格规格（跟船）：中心 1 km 半径内承载可解析频带；
 * 外缘 fadeBand 宽度内幅度包络衰减到 0，与远场平面（该尺度下无可解析几何波）
 * 在接缝处同为基准高度，杜绝接缝裂缝与跳变。
 */
export const NEAR_FIELD_BAND_SPECS = {
  high: { size: 2048, resolution: 256 },
  medium: { size: 2048, resolution: 128 },
  low: { size: 2048, resolution: 64 },
} as const satisfies Record<string, OceanMeshBandSpec>;

export type NearFieldBandTier = keyof typeof NEAR_FIELD_BAND_SPECS;

/**
 * 远场网格沿用既有 60 km 平面；该尺度几何上无可解析波分量（远场波组为空集 →
 * 平基面）。#2117：远场无几何波，细分只服务于片元级特性（近场挖空/岸线衰减/
 * 泡沫采样），分辨率降至最小充分档——把顶点预算留给近景/船边近场网格。
 */
export const FAR_FIELD_BAND_SPECS = {
  high: { size: 60000, resolution: 32 },
  medium: { size: 60000, resolution: 16 },
  low: { size: 60000, resolution: 8 },
} as const satisfies Record<string, OceanMeshBandSpec>;

/** 近场外缘幅度衰减带宽度（米）：包络在该环内从 1 平滑过渡到 0。 */
export const NEAR_FIELD_FADE_BAND_METERS = 384;

/**
 * 近场幅度包络：网格局部坐标距中心不超过 fadeStart 时为 1，向外 smoothstep
 * 衰减到边缘为 0。远场在该尺度无几何波 → 接缝两侧同为基准高度，连续无裂缝。
 */
export function nearFieldEnvelope(
  localX: number,
  localZ: number,
  size: number,
  fadeBandMeters: number = NEAR_FIELD_FADE_BAND_METERS,
): number {
  const half = size / 2;
  const fadeStart = half - fadeBandMeters;
  const distance = Math.max(Math.abs(localX), Math.abs(localZ));
  if (distance <= fadeStart) return 1;
  const t = Math.min(Math.max((distance - fadeStart) / fadeBandMeters, 0), 1);
  // 平滑插值（3t²−2t³）：一阶导在两端为零，避免包络自身产生可见折痕。
  return 1 - (t * t * (3 - 2 * t));
}
