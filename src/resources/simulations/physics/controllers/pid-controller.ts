/**
 * 航向 PID 控制器
 * 用于单通道航向控制 (驱逐舰等)
 */

import type { PIDGains } from '../../core/types';
import { clamp } from '../../core/constants';

// ============ 类型定义 ============

/** PID 控制器状态 */
export interface PIDControllerState {
  integral: number;
  prevError: number;
  prevDerivative?: number;  // 用于微分滤波
}

/** PID 控制输出 */
export interface PIDControlOutput {
  rudderDeg: number;
  error: number;
  derivative: number;
}

/** PID 控制器配置 */
export interface PIDControllerConfig {
  gains: PIDGains;
  maxRudderDeg: number;
  maxIntegral?: number;
  derivativeFilter?: number;  // 微分滤波系数 (0-1)
  rateLimit?: number;         // 输出变化率限制 (°/s)
}

// ============ 状态初始化 ============

/** 创建初始 PID 状态 */
export function createPIDControllerState(): PIDControllerState {
  return {
    integral: 0,
    prevError: 0,
    prevDerivative: 0,
  };
}

// ============ 增益调整工具 ============

/**
 * Ziegler-Nichols 方法计算 PID 增益
 * 基于临界增益和临界周期
 */
export function zieglerNicholsTuning(
  Ku: number,   // 临界增益
  Tu: number,   // 临界周期 (s)
  type: 'P' | 'PI' | 'PID' = 'PID'
): PIDGains {
  switch (type) {
    case 'P':
      return { kp: 0.5 * Ku, ki: 0, kd: 0 };
    case 'PI':
      return { kp: 0.45 * Ku, ki: 0.54 * Ku / Tu, kd: 0 };
    case 'PID':
      return { kp: 0.6 * Ku, ki: 1.2 * Ku / Tu, kd: 0.075 * Ku * Tu };
  }
}

/**
 * 基于时间常数的增益计算
 * 适用于已知系统模型参数
 */
export function modelBasedTuning(
  K: number,    // 系统增益
  T: number,    // 系统时间常数 (s)
  settlingTime: number = 60,  // 期望调节时间 (s)
  overshootMax: number = 0.1  // 最大超调 (10%)
): PIDGains {
  // 期望闭环带宽
  const omega = 4 / settlingTime;

  // 阻尼比
  const zeta = -Math.log(overshootMax) / Math.sqrt(Math.PI * Math.PI + Math.log(overshootMax) ** 2);

  // PID 增益 (基于极点配置)
  const kp = (2 * zeta * omega * T - 1) / K;
  const ki = omega * omega * T / K;
  const kd = (omega * omega * T * T - 1) / (K * omega);

  return {
    kp: Math.max(0, kp),
    ki: Math.max(0, ki),
    kd: Math.max(0, kd),
  };
}

/**
 * 增益缩放
 * 按比例调整所有增益
 */
export function scaleGains(gains: PIDGains, scale: number): PIDGains {
  return {
    kp: gains.kp * scale,
    ki: gains.ki * scale,
    kd: gains.kd * scale,
  };
}

/**
 * 增益插值
 * 用于增益调度
 */
export function interpolateGains(
  gains1: PIDGains,
  gains2: PIDGains,
  t: number  // 插值因子 [0, 1]
): PIDGains {
  t = clamp(t, 0, 1);
  return {
    kp: gains1.kp + (gains2.kp - gains1.kp) * t,
    ki: gains1.ki + (gains2.ki - gains1.ki) * t,
    kd: gains1.kd + (gains2.kd - gains1.kd) * t,
  };
}
