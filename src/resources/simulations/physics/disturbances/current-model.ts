/**
 * 海流扰动模型
 * 用于半潜式钻井平台和其他DP船舶的环境力计算
 *
 * 特点:
 * - 稳态海流力计算
 * - 随机漂移 (Random Walk) 模拟流速变化
 * - 支持流向变化
 *
 * 参考: DNV GL RP-C205 Environmental Conditions and Environmental Loads
 */

import {
  HYSY981_PLATFORM_PARAMS,
  CURRENT_FORCE_COEFFICIENTS,
  WIND_FORCE_COEFFICIENTS,
  SEA_WATER_DENSITY,
  AIR_DENSITY,
  DEG_TO_RAD,
} from '../../core/constants';
import type { RandomNumberGenerator } from '../../core/seeded-rng';

const P = HYSY981_PLATFORM_PARAMS;
const C_current = CURRENT_FORCE_COEFFICIENTS;
const C_wind = WIND_FORCE_COEFFICIENTS;

// ============ 类型定义 ============

/** 海流环境状态 */
export interface CurrentEnvironment {
  speed: number;          // 流速 (m/s)
  direction: number;      // 流向 (rad, 0=北, 正值顺时针)
  meanSpeed: number;      // 平均流速 (用于随机漂移)
  meanDirection: number;  // 平均流向 (用于随机漂移)
  variability: number;    // 变化性 (0-1, 0=稳定, 1=剧烈)
}

/** 风环境状态 */
export interface WindEnvironment {
  speed: number;          // 风速 (m/s)
  direction: number;      // 风向 (rad, 0=北, 正值顺时针)
  gustFactor: number;     // 阵风系数 (1.0-1.5)
}

/** 环境力输出 */
export interface EnvironmentalForces {
  forceX: number;         // 纵向力 (N)
  forceY: number;         // 横向力 (N)
  momentN: number;        // 艏摇力矩 (N·m)
}

// ============ 海流环境 ============

/**
 * 创建海流环境
 * @param speed 流速 (m/s)
 * @param directionDeg 流向 (deg, 0=北)
 * @param variability 变化性 (0-1)
 */
export function createCurrentEnvironment(
  speed = 0.5,
  directionDeg = 0,
  variability = 0.1
): CurrentEnvironment {
  const direction = directionDeg * DEG_TO_RAD;
  return {
    speed,
    direction,
    meanSpeed: speed,
    meanDirection: direction,
    variability,
  };
}

/**
 * 更新海流环境 (随机漂移)
 * @param env 当前环境
 * @param dt 时间步长 (s)
 */
export function updateCurrentEnvironment(
  env: CurrentEnvironment,
  dt: number,
  rng: RandomNumberGenerator = Math.random
): CurrentEnvironment {
  // 随机漂移时间常数 (较慢变化)
  const tau = 300; // 5分钟时间常数
  const alpha = 1 - Math.exp(-dt / tau);

  // Ornstein-Uhlenbeck 过程
  const speedNoise = (rng() - 0.5) * env.variability * 0.5;
  const dirNoise = (rng() - 0.5) * env.variability * 0.2;

  // 趋向均值 + 随机扰动
  const newSpeed = Math.max(
    0,
    env.speed + alpha * (env.meanSpeed - env.speed) + speedNoise * Math.sqrt(dt)
  );
  let newDirection =
    env.direction +
    alpha * normalizeAngle(env.meanDirection - env.direction) +
    dirNoise * Math.sqrt(dt);
  newDirection = normalizeAngle(newDirection);

  return {
    ...env,
    speed: newSpeed,
    direction: newDirection,
  };
}

/**
 * 计算海流力
 * @param env 海流环境
 * @param psi 平台航向 (rad)
 * @param customParams 可选的自定义参数 (用于其他船型)
 */
export function computeCurrentForces(
  env: CurrentEnvironment,
  psi: number,
  customParams?: {
    areaSurge?: number;
    areaSway?: number;
    length?: number;
  }
): EnvironmentalForces {
  const Ax = customParams?.areaSurge ?? P.AREA_SURGE;
  const Ay = customParams?.areaSway ?? P.AREA_SWAY;
  const L = customParams?.length ?? P.LENGTH;

  // 相对流向 (流向相对于平台首向)
  const relativeAngle = env.direction - psi;
  const cosRel = Math.cos(relativeAngle);
  const sinRel = Math.sin(relativeAngle);

  // 动压 q = 0.5 * ρ * V²
  const q = 0.5 * SEA_WATER_DENSITY * env.speed ** 2;

  // 海流力计算 (体坐标系)
  // 注意: 正的流速从某方向来，对平台产生反向力
  const forceX = -q * Ax * C_current.CX * cosRel;
  const forceY = -q * Ay * C_current.CY * sinRel;
  const momentN = -q * Ay * L * C_current.CN * Math.sin(2 * relativeAngle);

  return { forceX, forceY, momentN };
}

// ============ 风环境 ============

/**
 * 创建风环境
 * @param speed 风速 (m/s)
 * @param directionDeg 风向 (deg, 0=北)
 * @param gustFactor 阵风系数
 */
export function createWindEnvironment(
  speed = 10,
  directionDeg = 0,
  gustFactor = 1.2
): WindEnvironment {
  return {
    speed,
    direction: directionDeg * DEG_TO_RAD,
    gustFactor,
  };
}

/**
 * 更新风环境 (模拟阵风)
 * @param env 当前环境
 * @param dt 时间步长 (s)
 * @param meanSpeed 平均风速 (m/s)
 */
export function updateWindEnvironment(
  env: WindEnvironment,
  dt: number,
  meanSpeed: number,
  rng: RandomNumberGenerator = Math.random
): WindEnvironment {
  // 阵风周期 ~10秒
  const gustPeriod = 10;

  // 简化的阵风模型: 随机脉冲
  if (rng() < dt / gustPeriod) {
    // 阵风事件
    const gustSpeed = meanSpeed * env.gustFactor * (0.9 + rng() * 0.2);
    const dirVariation = (rng() - 0.5) * 0.2; // ±~6°

    return {
      ...env,
      speed: gustSpeed,
      direction: env.direction + dirVariation,
    };
  } else {
    // 缓慢恢复到平均风速
    const alpha = 1 - Math.exp(-dt / 5); // 5秒恢复时间常数
    return {
      ...env,
      speed: env.speed + alpha * (meanSpeed - env.speed),
    };
  }
}

/**
 * 计算风力
 * @param env 风环境
 * @param psi 平台航向 (rad)
 * @param customParams 可选的自定义参数
 */
export function computeWindForces(
  env: WindEnvironment,
  psi: number,
  customParams?: {
    areaWindSurge?: number;
    areaWindSway?: number;
    length?: number;
  }
): EnvironmentalForces {
  const Ax = customParams?.areaWindSurge ?? P.AREA_WIND_SURGE;
  const Ay = customParams?.areaWindSway ?? P.AREA_WIND_SWAY;
  const L = customParams?.length ?? P.LENGTH;

  // 相对风向 (风向相对于平台首向)
  const relativeAngle = env.direction - psi;
  const cosRel = Math.cos(relativeAngle);
  const sinRel = Math.sin(relativeAngle);

  // 动压 q = 0.5 * ρ_air * V²
  const q = 0.5 * AIR_DENSITY * env.speed ** 2;

  // 风力计算 (体坐标系)
  const forceX = -q * Ax * C_wind.CX * cosRel;
  const forceY = -q * Ay * C_wind.CY * sinRel;
  const momentN = -q * Ay * L * C_wind.CN * Math.sin(2 * relativeAngle);

  return { forceX, forceY, momentN };
}

// ============ 波浪漂移力 ============

/**
 * 计算二阶波浪漂移力 (简化模型)
 * @param significantWaveHeight 有效波高 (m)
 * @param waveDirectionDeg 波向 (deg, 0=北)
 * @param psi 平台航向 (rad)
 */
export function computeWaveDriftForces(
  significantWaveHeight: number,
  waveDirectionDeg: number,
  psi: number
): EnvironmentalForces {
  // 漂移力系数 (简化，实际需要根据波谱和RAO计算)
  const driftCoeff = 50000; // N/m² (经验值)

  const waveDir = waveDirectionDeg * DEG_TO_RAD;
  const relativeAngle = waveDir - psi;

  // 漂移力正比于波高平方
  const Hs2 = significantWaveHeight ** 2;

  const forceX = -driftCoeff * Hs2 * Math.cos(relativeAngle);
  const forceY = -driftCoeff * Hs2 * Math.sin(relativeAngle);
  const momentN = -driftCoeff * Hs2 * 0.1 * Math.sin(2 * relativeAngle) * P.LENGTH;

  return { forceX, forceY, momentN };
}

// ============ 组合环境力 ============

/**
 * 计算总环境力
 * @param current 海流环境
 * @param wind 风环境
 * @param waveHeight 有效波高 (m)
 * @param waveDirection 波向 (deg)
 * @param psi 平台航向 (rad)
 */
export function computeTotalEnvironmentalForces(
  current: CurrentEnvironment,
  wind: WindEnvironment,
  waveHeight: number,
  waveDirection: number,
  psi: number
): EnvironmentalForces {
  const currentForces = computeCurrentForces(current, psi);
  const windForces = computeWindForces(wind, psi);
  const waveForces = computeWaveDriftForces(waveHeight, waveDirection, psi);

  return {
    forceX: currentForces.forceX + windForces.forceX + waveForces.forceX,
    forceY: currentForces.forceY + windForces.forceY + waveForces.forceY,
    momentN: currentForces.momentN + windForces.momentN + waveForces.momentN,
  };
}

// ============ 工具函数 ============

/**
 * 角度归一化到 [-π, π]
 */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * 根据海况等级获取典型环境参数
 * @param seaState 海况等级 (1-6)
 */
export function getTypicalEnvironment(seaState: number): {
  currentSpeed: number;
  windSpeed: number;
  waveHeight: number;
} {
  const params: Record<number, { currentSpeed: number; windSpeed: number; waveHeight: number }> = {
    1: { currentSpeed: 0.2, windSpeed: 3, waveHeight: 0.3 },
    2: { currentSpeed: 0.3, windSpeed: 6, waveHeight: 0.8 },
    3: { currentSpeed: 0.5, windSpeed: 10, waveHeight: 1.5 },
    4: { currentSpeed: 0.8, windSpeed: 15, waveHeight: 2.5 },
    5: { currentSpeed: 1.0, windSpeed: 20, waveHeight: 4.0 },
    6: { currentSpeed: 1.5, windSpeed: 25, waveHeight: 6.0 },
  };

  return params[Math.max(1, Math.min(6, seaState))] ?? params[3];
}

/**
 * 格式化环境力显示
 * @param forces 环境力
 */
export function formatEnvironmentalForces(forces: EnvironmentalForces): string {
  return `X: ${(forces.forceX / 1000).toFixed(1)} kN, Y: ${(forces.forceY / 1000).toFixed(1)} kN, N: ${(forces.momentN / 1000).toFixed(1)} kN·m`;
}
