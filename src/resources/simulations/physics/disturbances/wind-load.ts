/**
 * 风载荷扰动模型
 *
 * 用于模拟集装箱船在不同装载状态下受到的风力干扰
 *
 * 特点:
 * - 受风面积随装载率变化 (满载时约为空载的 3 倍)
 * - 侧风产生横向力和转艏力矩
 * - 支持阵风模拟
 *
 * 物理模型:
 *   F_wind = 0.5 * ρ * V² * A_eff * C_y * sin(α)
 *   N_wind = F_wind * L_arm
 *
 * 其中:
 *   ρ: 空气密度 (kg/m³)
 *   V: 风速 (m/s)
 *   A_eff: 有效受风面积 (m²)
 *   C_y: 横向风力系数
 *   α: 风向与船艏夹角 (rad)
 *   L_arm: 力臂 (m)
 */

import type { WindLoadState } from '../../core/types';
import {
  clamp,
  lerp,
  toDegrees,
  toRadians,
  CONTAINER_MSC_PARAMS,
} from '../../core/constants';

// ============ 类型定义 ============

export type { WindLoadState };

/** 风环境参数 */
export interface WindEnvironment {
  speed: number;           // 风速 (m/s)
  direction: number;       // 绝对风向 (rad), 北为0, 顺时针增加
  gustEnabled: boolean;    // 是否启用阵风
  gustAmplitude: number;   // 阵风幅值 (m/s)
  gustPeriod: number;      // 阵风周期 (s)
}

/** 风载荷参数 */
export interface WindLoadParams {
  airDensity: number;      // 空气密度 (kg/m³)
  hullArea: number;        // 船体受风面积 (m²)
  cargoArea: number;       // 货物受风面积 (m²)
  windCoeff: number;       // 风力系数
  armRatio: number;        // 力臂比例 (占船长)
  shipLength: number;      // 船长 (m)
}

// ============ 默认参数 ============

/** 默认风环境 */
export const DEFAULT_WIND_ENVIRONMENT: WindEnvironment = {
  speed: 10,               // 10 m/s (约5级风)
  direction: Math.PI / 2,  // 东风 (正横风)
  gustEnabled: false,
  gustAmplitude: 3,        // 阵风变化 ±3 m/s
  gustPeriod: 15,          // 阵风周期 15s
};

/** 默认风载荷参数 */
export const DEFAULT_WIND_PARAMS: WindLoadParams = {
  airDensity: 1.225,       // 标准大气密度
  hullArea: CONTAINER_MSC_PARAMS.WIND_AREA_HULL,
  cargoArea: CONTAINER_MSC_PARAMS.WIND_AREA_CARGO,
  windCoeff: CONTAINER_MSC_PARAMS.WIND_COEFF,
  armRatio: CONTAINER_MSC_PARAMS.WIND_ARM_RATIO,
  shipLength: CONTAINER_MSC_PARAMS.LENGTH,
};

// ============ 状态初始化 ============

/**
 * 创建初始风载荷状态
 */
export function createWindLoadState(): WindLoadState {
  return {
    force: 0,
    moment: 0,
    relativeDirection: 0,
  };
}

/**
 * 创建风环境
 */
export function createWindEnvironment(
  speedMps: number = 10,
  directionDeg: number = 90,
  gustEnabled: boolean = false
): WindEnvironment {
  return {
    speed: clamp(speedMps, 0, 40),  // 限制最大风速 40 m/s
    direction: toRadians(directionDeg),
    gustEnabled,
    gustAmplitude: 3,
    gustPeriod: 15,
  };
}

// ============ 核心物理计算 ============

/**
 * 计算有效受风面积
 *
 * 满载时集装箱堆叠，受风面积显著增加
 *
 * @param loadRatio 装载率 [0, 1]
 * @param params 风载荷参数
 */
export function computeEffectiveWindArea(
  loadRatio: number,
  params: WindLoadParams = DEFAULT_WIND_PARAMS
): number {
  const t = clamp(loadRatio, 0, 1);

  // 货物面积随装载率非线性增加 (堆叠效应)
  // 空载时几乎没有货物风阻，满载时约为 3 倍船体面积
  const cargoMultiplier = t * t * 3.0;  // 二次增长模拟堆叠

  return params.hullArea + params.cargoArea * cargoMultiplier;
}

/**
 * 计算相对风向
 *
 * @param absoluteWindDir 绝对风向 (rad)
 * @param shipHeading 船艏向 (rad)
 * @returns 相对风向 (rad), 正值表示右舷来风
 */
export function computeRelativeWindDirection(
  absoluteWindDir: number,
  shipHeading: number
): number {
  // 相对风向 = 绝对风向 - 船艏向
  let relative = absoluteWindDir - shipHeading;

  // 归一化到 [-π, π]
  while (relative > Math.PI) relative -= 2 * Math.PI;
  while (relative < -Math.PI) relative += 2 * Math.PI;

  return relative;
}

/**
 * 计算阵风修正后的风速
 *
 * @param baseSpeed 基础风速 (m/s)
 * @param time 当前时间 (s)
 * @param env 风环境参数
 */
export function computeGustSpeed(
  baseSpeed: number,
  time: number,
  env: WindEnvironment
): number {
  if (!env.gustEnabled) {
    return baseSpeed;
  }

  // 阵风模型: 正弦变化 + 随机分量
  const gustPhase = (2 * Math.PI * time) / env.gustPeriod;
  const gustFactor = Math.sin(gustPhase) * 0.7 + Math.sin(gustPhase * 2.3) * 0.3;

  return baseSpeed + env.gustAmplitude * gustFactor;
}

/**
 * 计算风载荷
 *
 * @param shipHeading 船艏向 (rad)
 * @param loadRatio 装载率 [0, 1]
 * @param env 风环境
 * @param params 风载荷参数
 * @param time 当前时间 (s), 用于阵风计算
 */
export function computeWindLoad(
  shipHeading: number,
  loadRatio: number,
  env: WindEnvironment = DEFAULT_WIND_ENVIRONMENT,
  params: WindLoadParams = DEFAULT_WIND_PARAMS,
  time: number = 0
): WindLoadState {
  // 计算实际风速 (考虑阵风)
  const effectiveSpeed = computeGustSpeed(env.speed, time, env);

  // 计算相对风向
  const relativeDir = computeRelativeWindDirection(env.direction, shipHeading);

  // 计算有效受风面积
  const effectiveArea = computeEffectiveWindArea(loadRatio, params);

  // 计算横向风力
  // F = 0.5 * ρ * V² * A * C_y * sin(α)
  const dynamicPressure = 0.5 * params.airDensity * effectiveSpeed * effectiveSpeed;
  const force = dynamicPressure * effectiveArea * params.windCoeff * Math.sin(relativeDir);

  // 计算风致转艏力矩
  // 力臂 = 船长 * 力臂比例
  const arm = params.shipLength * params.armRatio;
  const moment = force * arm;

  return {
    force,
    moment,
    relativeDirection: relativeDir,
  };
}

/**
 * 风载荷步进更新
 *
 * 用于在仿真循环中持续更新风载荷
 */
export function windLoadStep(
  shipHeading: number,
  loadRatio: number,
  env: WindEnvironment,
  time: number,
  params: WindLoadParams = DEFAULT_WIND_PARAMS
): WindLoadState {
  return computeWindLoad(shipHeading, loadRatio, env, params, time);
}

// ============ 指标计算 ============

/**
 * 获取风载荷指标
 */
export function getWindLoadMetrics(
  state: WindLoadState,
  env: WindEnvironment
): {
  forceKN: number;            // 横向力 (kN)
  momentKNm: number;          // 转艏力矩 (kN·m)
  relativeDirectionDeg: number; // 相对风向 (度)
  windSpeedMps: number;       // 风速 (m/s)
  windSpeedKnots: number;     // 风速 (节)
  beaufortScale: number;      // 蒲福风级
  isGaleForce: boolean;       // 是否大风
  isStormForce: boolean;      // 是否风暴
} {
  const forceKN = state.force / 1000;
  const momentKNm = state.moment / 1000;
  const relativeDirectionDeg = toDegrees(state.relativeDirection);
  const windSpeedKnots = env.speed * 1.94384;  // m/s to knots
  const beaufortScale = getBeaufortScale(env.speed);

  return {
    forceKN,
    momentKNm,
    relativeDirectionDeg,
    windSpeedMps: env.speed,
    windSpeedKnots,
    beaufortScale,
    isGaleForce: env.speed >= 17.2,   // 8级风 (17.2 m/s)
    isStormForce: env.speed >= 24.5,  // 10级风 (24.5 m/s)
  };
}

/**
 * 根据风速获取蒲福风级
 */
export function getBeaufortScale(windSpeedMps: number): number {
  const thresholds = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];

  for (let i = 0; i < thresholds.length; i++) {
    if (windSpeedMps < thresholds[i]) {
      return i;
    }
  }
  return 12; // 飓风
}

/**
 * 获取风级描述
 */
export function getBeaufortDescription(scale: number): string {
  const descriptions = [
    '无风',      // 0
    '软风',      // 1
    '轻风',      // 2
    '微风',      // 3
    '和风',      // 4
    '清风',      // 5
    '强风',      // 6
    '疾风',      // 7
    '大风',      // 8
    '烈风',      // 9
    '狂风',      // 10
    '暴风',      // 11
    '飓风',      // 12
  ];

  return descriptions[clamp(scale, 0, 12)];
}

/**
 * 判断风速是否超限
 */
export function isWindSpeedExcessive(
  windSpeedMps: number,
  maxSpeedMps: number = CONTAINER_MSC_PARAMS.MAX_WIND_SPEED
): boolean {
  return windSpeedMps > maxSpeedMps;
}

// ============ 警报判断 ============

/**
 * 判断是否需要触发风载荷警报
 */
export function shouldTriggerWindAlarm(
  env: WindEnvironment,
  state: WindLoadState,
  thresholds: {
    maxSpeed?: number;      // 最大允许风速 (m/s)
    maxForce?: number;      // 最大允许横向力 (N)
    maxMoment?: number;     // 最大允许力矩 (N·m)
  } = {}
): {
  speedAlarm: boolean;
  forceAlarm: boolean;
  momentAlarm: boolean;
  message: string | null;
} {
  const maxSpeed = thresholds.maxSpeed ?? 20;        // 默认 20 m/s
  const maxForce = thresholds.maxForce ?? 500000;    // 默认 500 kN
  const maxMoment = thresholds.maxMoment ?? 5000000; // 默认 5000 kN·m

  const speedAlarm = env.speed > maxSpeed;
  const forceAlarm = Math.abs(state.force) > maxForce;
  const momentAlarm = Math.abs(state.moment) > maxMoment;

  let message: string | null = null;

  if (speedAlarm) {
    const beaufort = getBeaufortScale(env.speed);
    message = `危险: 风速 ${env.speed.toFixed(1)} m/s (${beaufort}级${getBeaufortDescription(beaufort)}) 超过操纵安全限值!`;
  } else if (forceAlarm || momentAlarm) {
    message = `警告: 风载荷过大，横向力 ${(state.force / 1000).toFixed(0)} kN，建议调整航向`;
  }

  return { speedAlarm, forceAlarm, momentAlarm, message };
}

// ============ 风向分析 ============

/**
 * 获取相对风向描述
 */
export function getRelativeWindDescription(relativeDirectionRad: number): string {
  const deg = toDegrees(relativeDirectionRad);
  const absDeg = Math.abs(deg);

  if (absDeg < 22.5) {
    return '顶风';
  } else if (absDeg < 67.5) {
    return deg > 0 ? '右前侧风' : '左前侧风';
  } else if (absDeg < 112.5) {
    return deg > 0 ? '右正横风' : '左正横风';
  } else if (absDeg < 157.5) {
    return deg > 0 ? '右后侧风' : '左后侧风';
  } else {
    return '顺风';
  }
}

/**
 * 计算最优避风航向
 *
 * 返回使风载荷最小的航向调整建议
 */
export function computeOptimalHeadingChange(
  currentHeading: number,
  windDirection: number
): {
  turnToPort: number;    // 向左转的角度 (正值)
  turnToStarboard: number; // 向右转的角度 (正值)
  recommendation: 'port' | 'starboard' | 'maintain';
  reason: string;
} {
  const relativeWind = computeRelativeWindDirection(windDirection, currentHeading);
  const relativeDeg = toDegrees(relativeWind);

  // 最优航向是顺风或顶风 (sin(α) ≈ 0)
  // 计算转向到顶风/顺风需要的角度

  // 转到顶风
  const toHeadwind = -relativeDeg;
  // 转到顺风
  const toTailwind = relativeDeg > 0 ? 180 - relativeDeg : -180 - relativeDeg;

  // 选择较小的转向角
  const absToHead = Math.abs(toHeadwind);
  const absToTail = Math.abs(toTailwind);

  let recommendation: 'port' | 'starboard' | 'maintain';
  let reason: string;

  if (absToHead < 15 || absToTail < 15) {
    recommendation = 'maintain';
    reason = '当前航向风载荷已接近最小';
  } else if (absToHead <= absToTail) {
    // 转向顶风
    recommendation = toHeadwind > 0 ? 'starboard' : 'port';
    reason = `建议向${recommendation === 'port' ? '左' : '右'}转 ${absToHead.toFixed(0)}° 迎风航行`;
  } else {
    // 转向顺风
    recommendation = toTailwind > 0 ? 'starboard' : 'port';
    reason = `建议向${recommendation === 'port' ? '左' : '右'}转 ${absToTail.toFixed(0)}° 顺风航行`;
  }

  return {
    turnToPort: Math.max(0, -toHeadwind),
    turnToStarboard: Math.max(0, toHeadwind),
    recommendation,
    reason,
  };
}

// ============ 风载荷估算 ============

/**
 * 估算不同装载率下的最大风载荷
 *
 * 用于任务规划和风险评估
 */
export function estimateMaxWindLoad(
  windSpeedMps: number,
  loadRatio: number,
  params: WindLoadParams = DEFAULT_WIND_PARAMS
): {
  maxForceN: number;      // 最大横向力 (N)
  maxMomentNm: number;    // 最大力矩 (N·m)
  effectiveArea: number;  // 有效受风面积 (m²)
} {
  const effectiveArea = computeEffectiveWindArea(loadRatio, params);
  const dynamicPressure = 0.5 * params.airDensity * windSpeedMps * windSpeedMps;

  // 最大力发生在正横风时 (sin(90°) = 1)
  const maxForceN = dynamicPressure * effectiveArea * params.windCoeff;
  const maxMomentNm = maxForceN * params.shipLength * params.armRatio;

  return {
    maxForceN,
    maxMomentNm,
    effectiveArea,
  };
}
