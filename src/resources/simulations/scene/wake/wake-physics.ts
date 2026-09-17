import type { SceneShipVisualProfile } from '../types';

/**
 * 尾迹物理：Froude 数三路活跃度与四族粒子预算。
 *
 * 语义移植自源视频项目的 wakePhysics 与粒子预算段：
 * 世界速度先按"世界船长 → 真实船长"换算为真实航速（节底座为船舶档案的设计航速），
 * 再经三路 smoothstep 门限得到 wake/foam/kelvin 活跃度；
 * 四族预算在活跃度基础上按粒子年龄权重分配 core/foam/farFoam/kelvin。
 */

const METERS_PER_SECOND_PER_KNOT = 0.514444;
const STANDARD_GRAVITY = 9.81;

/** 三路活跃度门限（源实现常数）：wake 低门限、foam 中门限、kelvin 独立高门限。 */
const WAKE_CUTOFF = 0.06;
const WAKE_RAMP = 0.49;
const FOAM_CUTOFF = 0.32;
const FOAM_RAMP = 0.68;
const FOAM_EXPONENT = 1.15;
const KELVIN_CUTOFF = 0.38;
const KELVIN_RAMP = 0.62;
const KELVIN_EXPONENT = 1.05;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const clamp01 = (value: number) => clamp(value, 0, 1);

/** 与源实现一致的 smoothstep：edge0 === edge1 时退化为阶跃。 */
export const smoothstep = (edge0: number, edge1: number, value: number) => {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const smoothstep01 = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export const knotsToMetersPerSecond = (knots: number) => knots * METERS_PER_SECOND_PER_KNOT;

/** 尾迹粒子样式：字段与源默认样式一一对应，时间量已换算为秒（源按 30fps 帧数）。 */
export interface WakeTrailStyle {
  readonly enabled?: boolean;
  /** 粒子寿命基准（秒）：源 lifetimeFrames 600 @30fps。 */
  readonly lifetimeSeconds?: number;
  /** 尾迹长度倍率：源 lengthMultiplier 10。 */
  readonly lengthMultiplier?: number;
  /** 发射间隔（秒）：源 sampleStep 3 @30fps。 */
  readonly emitIntervalSeconds?: number;
  readonly maxParticles?: number;
  readonly coreParticlesPerSample?: number;
  readonly foamParticlesPerSample?: number;
  readonly kelvinParticlesPerSample?: number;
  readonly coreLengthRatio?: number;
  readonly midLengthRatio?: number;
  readonly coreOpacity?: number;
  readonly midOpacity?: number;
  readonly farOpacity?: number;
  readonly kelvinOpacity?: number;
  readonly coreSize?: number;
  readonly farSize?: number;
  readonly elongation?: number;
  readonly spreadRate?: number;
  readonly turbulence?: number;
  readonly wakeHalfAngleDeg?: number;
  readonly kelvinAngleDeg?: number;
  readonly kelvinSpread?: number;
  readonly surfaceBias?: number;
  readonly speedCoupling?: number;
  readonly minLifetimeScale?: number;
  /** 确定性噪声种子：源 seed 17。 */
  readonly seed?: number;
  /** 材质不透明度底座：源 wakeStyle.foamOpacity 的 semiRealistic 默认。 */
  readonly foamOpacity?: number;
}

export type ResolvedWakeTrailStyle = Required<WakeTrailStyle>;

/** 默认样式：数值与源默认粒子样式一致；船舶语义改由 SceneShipVisualProfile 注入。 */
export const DEFAULT_WAKE_TRAIL_STYLE: ResolvedWakeTrailStyle = {
  enabled: true,
  lifetimeSeconds: 20,
  lengthMultiplier: 10,
  emitIntervalSeconds: 0.1,
  maxParticles: 2200,
  coreParticlesPerSample: 8,
  foamParticlesPerSample: 5,
  kelvinParticlesPerSample: 3,
  coreLengthRatio: 0.18,
  midLengthRatio: 0.58,
  coreOpacity: 0.62,
  midOpacity: 0.26,
  farOpacity: 0.025,
  kelvinOpacity: 0.1,
  coreSize: 0.035,
  farSize: 0.24,
  elongation: 1.8,
  spreadRate: 0.045,
  turbulence: 0.65,
  wakeHalfAngleDeg: 5,
  kelvinAngleDeg: 19.47,
  kelvinSpread: 0.18,
  surfaceBias: 0.03,
  speedCoupling: 1,
  minLifetimeScale: 0.28,
  seed: 17,
  foamOpacity: 0.76,
};

export const resolveWakeTrailStyle = (style: WakeTrailStyle = {}): ResolvedWakeTrailStyle => ({
  ...DEFAULT_WAKE_TRAIL_STYLE,
  ...style,
});

/** Froude 三路活跃度结果。 */
export interface WakeSpeedActivity {
  /** 换算后的真实航速（米/秒，截断于设计航速）。 */
  readonly realSpeedMps: number;
  /** 真实速比：realSpeedMps / 设计航速，[0,1]。 */
  readonly realSpeedRatio: number;
  /** 真实 Froude 数：v / sqrt(g·L)。 */
  readonly realFroude: number;
  readonly wakeActivity: number;
  readonly foamActivity: number;
  readonly kelvinActivity: number;
  /** 寿命缩放：minLifetimeScale + (1 - minLifetimeScale) × wakeActivity。 */
  readonly lifetimeScale: number;
}

/**
 * 计算 Froude 三路活跃度。
 *
 * 源公式：hullLengthsPerSecond = worldSpeed / worldShipLength，
 * realSpeedMps = hullLengthsPerSecond × 真实船长（截断于设计航速）。
 * 世界与真实 1:1 时退化为 realSpeedMps = worldSpeed。
 */
export const computeWakeSpeedActivity = ({
  worldSpeed,
  worldShipLength,
  profile,
  speedCoupling = DEFAULT_WAKE_TRAIL_STYLE.speedCoupling,
  minLifetimeScale = DEFAULT_WAKE_TRAIL_STYLE.minLifetimeScale,
}: {
  worldSpeed: number;
  worldShipLength: number;
  profile: SceneShipVisualProfile;
  speedCoupling?: number;
  minLifetimeScale?: number;
}): WakeSpeedActivity => {
  const shipLengthMeters = Math.max(0.001, profile.shipLengthMeters);
  const maxSpeedMps = knotsToMetersPerSecond(Math.max(0.001, profile.designSpeedKnots));
  const hullLengthsPerSecond = Math.max(0, worldSpeed) / Math.max(0.001, worldShipLength);
  const unclampedRealSpeedMps = hullLengthsPerSecond * shipLengthMeters;
  const realSpeedMps = Math.min(unclampedRealSpeedMps, maxSpeedMps);
  const realSpeedRatio = clamp01(realSpeedMps / maxSpeedMps);
  const coupling = clamp(speedCoupling, 0, 2);
  const coupledRatio = clamp01(realSpeedRatio * coupling);
  const minScale = clamp(minLifetimeScale, 0.05, 1);
  const wakeActivity = smoothstep01((coupledRatio - WAKE_CUTOFF) / WAKE_RAMP);
  const foamActivity = Math.pow(smoothstep01((coupledRatio - FOAM_CUTOFF) / FOAM_RAMP), FOAM_EXPONENT);
  const kelvinActivity = Math.pow(smoothstep01((coupledRatio - KELVIN_CUTOFF) / KELVIN_RAMP), KELVIN_EXPONENT);

  return {
    realSpeedMps,
    realSpeedRatio,
    realFroude: realSpeedMps / Math.sqrt(STANDARD_GRAVITY * shipLengthMeters),
    wakeActivity,
    foamActivity,
    kelvinActivity,
    lifetimeScale: minScale + (1 - minScale) * wakeActivity,
  };
};

/** 四族粒子预算（期望值，未取整）。 */
export interface WakeFamilyBudget {
  readonly core: number;
  readonly foam: number;
  readonly farFoam: number;
  readonly kelvin: number;
}

/**
 * 四族预算：按粒子年龄权重把活跃度换算为各族期望粒子数。
 *
 * 与源实现一致：core 随年龄衰减、foam 中段隆起、farFoam 仅出现在中远龄、
 * kelvin 在 includeKelvin 时经 kelvinWeight 放大（底座 0.38 始终存在，同源语义）。
 */
export const computeWakeFamilyBudget = ({
  age01,
  activity,
  style,
  emissionRate = 1,
  includeKelvin,
}: {
  age01: number;
  activity: Pick<WakeSpeedActivity, 'wakeActivity' | 'foamActivity' | 'kelvinActivity'>;
  style: ResolvedWakeTrailStyle;
  emissionRate?: number;
  includeKelvin: boolean;
}): WakeFamilyBudget => {
  const coreEnd = clamp(style.coreLengthRatio, 0.04, 0.45);
  const midEnd = clamp(Math.max(coreEnd + 0.08, style.midLengthRatio), coreEnd + 0.08, 0.95);
  const nearWeight = 1 - smoothstep(0, coreEnd, age01);
  const midWeight =
    smoothstep(coreEnd * 0.35, coreEnd + 0.04, age01) * (1 - smoothstep(coreEnd, midEnd, age01));
  const farWeight =
    smoothstep(coreEnd, midEnd, age01) * (1 - smoothstep(midEnd, 1, age01));
  const kelvinWeight = includeKelvin
    ? smoothstep(coreEnd * 0.35, Math.min(midEnd, coreEnd + 0.12), age01) *
      (1 - smoothstep(midEnd * 0.96, 1, age01))
    : 0;
  const rate = clamp(emissionRate, 0, 2);

  return {
    core: rate * activity.wakeActivity * style.coreParticlesPerSample * (0.55 + nearWeight * 0.9),
    foam: rate * activity.foamActivity * style.foamParticlesPerSample * (0.45 + midWeight * 0.85),
    farFoam: rate * activity.foamActivity * style.foamParticlesPerSample * 0.58 * farWeight,
    kelvin:
      rate * activity.kelvinActivity * style.kelvinParticlesPerSample * (0.38 + kelvinWeight * 0.82),
  };
};

/** 推进器洗流活跃度（#2101）：平台零平移但推进器输出非零时的局部泡沫源。 */
export interface ThrusterWashActivity {
  /** 归一洗流强度 [0,1]：总推力功率 / 额定功率，按平方根压缩。 */
  readonly washActivity: number;
  /** 洗流驱动的泡沫活跃度（只抬升 core/foam，不产生 Kelvin/远场——不编造航行尾波）。 */
  readonly washFoamActivity: number;
}

/**
 * 由既有推力遥测计算局部洗流：translation≈0 且推力非零 → 局部洗流可见；
 * 不修改推力语义、不虚构海流。无推力状态（undefined）返回零（不伪造推进活动）。
 */
export const computeThrusterWashActivity = ({
  totalThrustPower,
  ratedPowerPerThruster,
  thrusterCount,
}: {
  totalThrustPower: number;
  ratedPowerPerThruster: number;
  thrusterCount: number;
}): ThrusterWashActivity => {
  const rated = Math.max(1, ratedPowerPerThruster * Math.max(0, thrusterCount));
  const powerRatio = clamp01(Math.max(0, totalThrustPower) / rated);
  const washActivity = Math.sqrt(powerRatio);
  return {
    washActivity,
    washFoamActivity: Math.pow(washActivity, 1.4),
  };
};
