/**
 * 液货晃荡动力学模型
 *
 * 用于模拟 LNG 船液货舱内液体的晃荡现象
 * 建模为受船舶运动激励的二阶振荡系统
 *
 * 动力学方程:
 *   J_s * θ̈_s + B_s * θ̇_s + K_s * θ_s = M_coupling
 *
 * 其中:
 *   θ_s: 晃荡角度 (rad)
 *   J_s: 液货惯量 (kg·m²)
 *   B_s: 阻尼系数 (N·m·s/rad)
 *   K_s: 恢复力矩系数 (N·m/rad)
 *   M_coupling: 船舶运动激励力矩
 *
 * 晃荡力矩反作用于船体:
 *   N_sloshing = -k_coupling * θ_s
 */

import type { SloshingState, SloshingParams } from '../../core/types';
import { LNG_SLOSHING_PARAMS, toDegrees } from '../../core/constants';

// ============ 类型导出 ============

export type { SloshingState, SloshingParams };

// ============ 默认参数 ============

/** 默认液货晃荡参数 */
export const DEFAULT_SLOSHING_PARAMS: SloshingParams = {
  naturalFreq: LNG_SLOSHING_PARAMS.NATURAL_FREQ,
  damping: LNG_SLOSHING_PARAMS.DAMPING,
  coupling: LNG_SLOSHING_PARAMS.COUPLING,
  inertia: LNG_SLOSHING_PARAMS.INERTIA,
  basePressure: LNG_SLOSHING_PARAMS.BASE_PRESSURE,
  pressureSensitivity: LNG_SLOSHING_PARAMS.PRESSURE_SENSITIVITY,
};

// ============ 状态初始化 ============

/**
 * 创建初始晃荡状态
 */
export function createSloshingState(basePressure: number = 100): SloshingState {
  return {
    angle: 0,
    rate: 0,
    tankPressure: basePressure,
  };
}

// ============ 核心物理计算 ============

/**
 * 计算晃荡系统的刚度和阻尼系数
 */
function computeSloshingCoefficients(params: SloshingParams): {
  stiffness: number;  // K_s (N·m/rad)
  damping: number;    // B_s (N·m·s/rad)
} {
  const { naturalFreq, damping, inertia } = params;

  // K_s = J_s * ω_n²
  const stiffness = inertia * naturalFreq * naturalFreq;

  // B_s = 2 * ζ * √(J_s * K_s) = 2 * ζ * ω_n * J_s
  const dampingCoeff = 2 * damping * naturalFreq * inertia;

  return { stiffness, damping: dampingCoeff };
}

/**
 * 晃荡方程右端函数
 *
 * 状态: x = [θ, θ̇]
 * 输入: 船舶转艏角速度 r
 *
 * dθ/dt = θ̇
 * dθ̇/dt = (M_coupling - B_s * θ̇ - K_s * θ) / J_s
 */
function sloshingDerivatives(
  angle: number,
  rate: number,
  shipYawRateRad: number,
  params: SloshingParams
): { dAngle: number; dRate: number } {
  const { coupling, inertia } = params;
  const { stiffness, damping } = computeSloshingCoefficients(params);

  // 耦合激励力矩: 船舶转向 → 液货受横向加速度
  const excitationMoment = coupling * shipYawRateRad;

  // 晃荡角度导数
  const dAngle = rate;

  // 晃荡角速度导数 (二阶振荡方程)
  const dRate = (excitationMoment - damping * rate - stiffness * angle) / inertia;

  return { dAngle, dRate };
}

// ============ 耦合力矩计算 ============

// ============ 指标计算 ============

/**
 * 获取晃荡指标
 */
export function getSloshingMetrics(state: SloshingState): {
  angleDeg: number;         // 晃荡角度 (度)
  rateDegPerSec: number;    // 晃荡角速度 (度/秒)
  pressure: number;         // 货舱压力 (kPa)
  isExcessive: boolean;     // 是否超限
  isCritical: boolean;      // 是否危险
} {
  const angleDeg = toDegrees(Math.abs(state.angle));
  const rateDegPerSec = toDegrees(Math.abs(state.rate));

  return {
    angleDeg,
    rateDegPerSec,
    pressure: state.tankPressure,
    isExcessive: angleDeg > 5,      // 超过5度为过度晃荡
    isCritical: angleDeg > 10,      // 超过10度为危险
  };
}

/**
 * 判断是否需要触发晃荡警报
 */
export function shouldTriggerSloshingAlarm(
  state: SloshingState,
  maxAngleDeg: number = 10,
  maxPressure: number = 200
): {
  angleAlarm: boolean;
  pressureAlarm: boolean;
  message: string | null;
} {
  const angleDeg = toDegrees(Math.abs(state.angle));
  const angleAlarm = angleDeg > maxAngleDeg;
  const pressureAlarm = state.tankPressure > maxPressure;

  let message: string | null = null;

  if (angleAlarm && pressureAlarm) {
    message = `警告: 液货晃荡 ${angleDeg.toFixed(1)}° 和压力 ${state.tankPressure.toFixed(0)} kPa 均超限！`;
  } else if (angleAlarm) {
    message = `警告: 液货晃荡角度 ${angleDeg.toFixed(1)}° 超过限值 ${maxAngleDeg}°`;
  } else if (pressureAlarm) {
    message = `警告: 货舱压力 ${state.tankPressure.toFixed(0)} kPa 超过限值 ${maxPressure} kPa`;
  }

  return { angleAlarm, pressureAlarm, message };
}

// ============ 晃荡特性分析 ============

/**
 * 计算晃荡系统的特征参数
 */
export function getSloshingCharacteristics(params: SloshingParams = DEFAULT_SLOSHING_PARAMS): {
  naturalPeriod: number;    // 固有周期 (s)
  dampedPeriod: number;     // 阻尼周期 (s)
  settlingTime: number;     // 调节时间 (s)
  peakAmplification: number; // 共振峰放大倍数
} {
  const { naturalFreq, damping } = params;

  // 固有周期 T_n = 2π/ω_n
  const naturalPeriod = (2 * Math.PI) / naturalFreq;

  // 阻尼周期 T_d = 2π/ω_d, ω_d = ω_n * √(1-ζ²)
  const dampedFreq = naturalFreq * Math.sqrt(1 - damping * damping);
  const dampedPeriod = (2 * Math.PI) / dampedFreq;

  // 调节时间 (2%准则) t_s ≈ 4/(ζ*ω_n)
  const settlingTime = 4 / (damping * naturalFreq);

  // 共振峰放大倍数 M_p = 1/(2ζ√(1-ζ²))
  const peakAmplification = 1 / (2 * damping * Math.sqrt(1 - damping * damping));

  return {
    naturalPeriod,
    dampedPeriod,
    settlingTime,
    peakAmplification,
  };
}
