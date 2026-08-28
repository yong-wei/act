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
  DEG_TO_RAD,
} from '../../core/constants';

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

// ============ 工具函数 ============

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
