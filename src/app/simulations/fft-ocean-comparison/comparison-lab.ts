/**
 * 对照实验入口的纯数据与测量口径（#2130）。
 * 页面组件只消费这些函数；不在这里创建第二套渲染框架。
 * 水位/尺度常量与 Gerstner 近远场规格保持同值，本文件不进口客户端水面模块。
 */

export const COMPARISON_WATER_BASE_Y = -1;
export const COMPARISON_FAR_FIELD_SIZE_METERS = 60000;
export const COMPARISON_NEAR_FIELD_SIZE_METERS = 2048;

export const COMPARISON_SPECTRUM_INPUT = {
  resolution: 256,
  domainMeters: 2048,
  windSpeedMps: 12,
  windDirectionRad: 0.2,
  seaState: 4,
  seed: 17,
} as const;

export const COMPARISON_VESSEL_LENGTH_METERS = 180;
export const COMPARISON_BOW_OFFSET_METERS = 85;
export const COMPARISON_QUERY_SPAN_METERS = 170;
export const COMPARISON_VESSEL_QUERY_HZ = 4;
export const COMPARISON_MISSING_VESSEL_URL = '/assets/__comparison-missing-vessel.glb';

export type ComparisonBackend = 'fft' | 'gerstner';
export type ComparisonSceneId = 'wave-only' | 'feature-parity';

/** 两条 WebGL 路线共用的功能矩阵。wave-only 用中性材质，feature-parity 用完整光学。 */
export const COMPARISON_FEATURE_MATRIX = {
  'wave-only': {
    optics: 'neutral',
    ibl: false,
    planar: false,
    foam: false,
    shallow: false,
  },
  'feature-parity': {
    optics: 'shared',
    ibl: true,
    planar: true,
    foam: true,
    shallow: true,
  },
} as const;

export const COMPARISON_SHORE_SEGMENT = {
  id: 'comparison-shore',
  from: [-900, 180] as const,
  to: [900, 180] as const,
  shoreDepthMeters: 4,
};
export type ComparisonRunMode = 'performance' | 'visual';

export interface ComparisonFarFieldRing {
  readonly innerHalfExtent: number;
  readonly outerHalfExtent: number;
  readonly rotationX: number;
  readonly baseY: number;
}

export interface ComparisonLabIdentity {
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly runMode: ComparisonRunMode;
  readonly queryBackend: ComparisonBackend;
  readonly waterBaseY: number;
  readonly farFieldRotationX: number;
  readonly farFieldInnerHalfExtent: number;
  readonly farFieldOuterHalfExtent: number;
  readonly vesselPackageId: string | null;
  readonly vesselUrl: string | null;
  readonly vesselFallback: boolean;
  readonly vesselLoaded: boolean;
  readonly vesselLoadFailed: boolean;
  readonly firstFrameReady: boolean;
}

export interface ComparisonLabCapture {
  readonly visualTimeSeconds: number;
  readonly waterHeightOrigin: number;
  readonly bowHeight: number;
  readonly sternHeight: number;
  readonly backend: ComparisonBackend;
  readonly scene: ComparisonSceneId;
  readonly queryBackend: ComparisonBackend;
  readonly vesselUrl: string | null;
  readonly vesselLoaded: boolean;
  readonly vesselLoadFailed: boolean;
}

export interface ComparisonQueryMetrics {
  readonly computeMs: number;
  readonly queueMs: number;
  readonly e2eMs: number;
  readonly resultAgeSeconds: number;
  readonly viaWorker: boolean;
}

export interface ComparisonLabApi {
  readonly ready: () => boolean;
  readonly reset: () => void;
  readonly seek: (timeSeconds: number) => void;
  readonly step: (dtSeconds: number) => void;
  readonly setRunMode: (mode: ComparisonRunMode) => void;
  readonly capture: () => ComparisonLabCapture;
  readonly identity: () => ComparisonLabIdentity;
  readonly queryMetrics: () => ComparisonQueryMetrics | null;
  readonly setShallowEnabled: (enabled: boolean) => void;
  readonly optics: () => ComparisonOpticsState;
}

export interface ComparisonOpticsState {
  readonly profile: 'neutral' | 'shared';
  readonly shallowEnabled: boolean;
  readonly shallowPassAllocated: boolean;
  readonly sunX: number;
  readonly sunY: number;
  readonly sunZ: number;
}

export function parseComparisonBackend(value: string | undefined): ComparisonBackend {
  return value === 'gerstner' ? 'gerstner' : 'fft';
}

export function parseComparisonScene(value: string | undefined): ComparisonSceneId {
  return value === 'feature-parity' ? 'feature-parity' : 'wave-only';
}

export function comparisonFarFieldRing(
  nearFieldSizeMeters = COMPARISON_NEAR_FIELD_SIZE_METERS,
  farFieldSizeMeters = COMPARISON_FAR_FIELD_SIZE_METERS,
  baseY = COMPARISON_WATER_BASE_Y,
): ComparisonFarFieldRing {
  return {
    innerHalfExtent: nearFieldSizeMeters / 2,
    outerHalfExtent: farFieldSizeMeters / 2,
    rotationX: -Math.PI / 2,
    baseY,
  };
}

export function composeWaterDatum(baseY: number, displacementY: number): number {
  return baseY + displacementY;
}

export function vesselPitchFromSamples(bowHeight: number, sternHeight: number, spanMeters: number): number {
  return Math.atan2(bowHeight - sternHeight, spanMeters);
}

export function isHorizontalFarField(rotationX: number): boolean {
  return Math.abs(rotationX + Math.PI / 2) < 1e-6;
}

export function labIsReady(identity: ComparisonLabIdentity): boolean {
  if (!identity.firstFrameReady) return false;
  if (identity.vesselLoadFailed) return true;
  return identity.vesselLoaded;
}
