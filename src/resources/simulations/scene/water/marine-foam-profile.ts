/** 实拍指导的显示校准；不代表实船气泡寿命或推力测量。 */
export type MarineFoamVessel = 'destroyer' | 'cruise' | 'lng' | 'container' | 'icebreaker' | 'dredger' | 'drilling';

export interface MarineFoamProfile {
  readonly trailDomainMeters: number;
  readonly foamHalfLifeSeconds: number;
  readonly bubbleHalfLifeSeconds: number;
  readonly diffusivity: number;
  readonly washSourceScale: number;
  readonly bubbleSourceScale: number;
  readonly bubbleOpticalStrength: number;
  readonly hullSourceScale: number;
  readonly hullBandMeters: number;
  readonly bowTaperStart: number;
  readonly bowTaperPower: number;
  readonly sternWidthRatio: number;
  /** 相对总长/总宽的 [纵向中心, 横向中心, 长度, 宽度]；仅用于泡沫源。 */
  readonly hullBands: readonly (readonly [number, number, number, number])[];
}

export const MARINE_TRAIL_RESOLUTION = 512;
// 混合在精细场的边缘清除区之前完成，避免历史被局部窗口提前截断。
export const FINE_FOAM_BLEND_START_METERS = 256;
export const FINE_FOAM_BLEND_END_METERS = 336;
const singleHull = [[0, 0, 1, 1]] as const;
const columns = [[-0.29, -0.34, 0.20, 0.19], [-0.29, 0.34, 0.20, 0.19],
  [0.29, -0.34, 0.20, 0.19], [0.29, 0.34, 0.20, 0.19]] as const;
const shared = { bubbleOpticalStrength: 0.16, hullBandMeters: 2.5, bowTaperStart: 0.64,
  bowTaperPower: 0.65, sternWidthRatio: 0.55, hullBands: singleHull };

export const MARINE_FOAM_PROFILES: Readonly<Record<MarineFoamVessel, MarineFoamProfile>> = {
  destroyer: { ...shared, trailDomainMeters: 6144, foamHalfLifeSeconds: 24, bubbleHalfLifeSeconds: 90,
    diffusivity: 3, washSourceScale: 0.85, bubbleSourceScale: 0.18, hullSourceScale: 1.2 },
  cruise: { ...shared, trailDomainMeters: 6144, foamHalfLifeSeconds: 30, bubbleHalfLifeSeconds: 110,
    diffusivity: 4, washSourceScale: 0.75, bubbleSourceScale: 0.20, hullSourceScale: 0.9,
    hullBandMeters: 3, bowTaperStart: 0.71, sternWidthRatio: 0.72 },
  lng: { ...shared, trailDomainMeters: 6144, foamHalfLifeSeconds: 28, bubbleHalfLifeSeconds: 100,
    diffusivity: 3.5, washSourceScale: 0.65, bubbleSourceScale: 0.18, hullSourceScale: 0.8,
    hullBandMeters: 3, bowTaperStart: 0.74, sternWidthRatio: 0.68 },
  container: { ...shared, trailDomainMeters: 6144, foamHalfLifeSeconds: 30, bubbleHalfLifeSeconds: 120,
    diffusivity: 4.5, washSourceScale: 0.7, bubbleSourceScale: 0.22, hullSourceScale: 0.85,
    hullBandMeters: 3.5, bowTaperStart: 0.75, sternWidthRatio: 0.8 },
  icebreaker: { ...shared, trailDomainMeters: 4096, foamHalfLifeSeconds: 22, bubbleHalfLifeSeconds: 80,
    diffusivity: 3, washSourceScale: 0.95, bubbleSourceScale: 0.18, hullSourceScale: 1.05,
    bowTaperStart: 0.60, bowTaperPower: 0.45, sternWidthRatio: 0.65 },
  dredger: { ...shared, trailDomainMeters: 4096, foamHalfLifeSeconds: 18, bubbleHalfLifeSeconds: 65,
    diffusivity: 2.5, washSourceScale: 0.65, bubbleSourceScale: 0.15, hullSourceScale: 0.65,
    bowTaperStart: 0.75, sternWidthRatio: 0.8 },
  drilling: { ...shared, trailDomainMeters: 3072, foamHalfLifeSeconds: 16, bubbleHalfLifeSeconds: 60,
    diffusivity: 2, washSourceScale: 1, bubbleSourceScale: 0.15, hullSourceScale: 0.7,
    bubbleOpticalStrength: 0.12, hullBandMeters: 2, bowTaperStart: 0.68,
    bowTaperPower: 0.35, sternWidthRatio: 0.9, hullBands: columns },
};
