/**
 * Nomoto 二阶模型 (带纯时滞)
 * 用于 LNG 船等大型船舶的航向动力学建模
 *
 * 传递函数: G(s) = K * e^(-τs) / ((1 + T1*s)(1 + T2*s))
 *
 * 状态空间形式:
 *   ṙ = (K*δ_delayed - r - (T1+T2)*ṙ) / (T1*T2)
 *   ψ̇ = r
 *
 * 其中 δ_delayed = δ(t - τ) 为经过时滞后的舵角
 */

import type {
  Nomoto2ndOrderParams,
  Nomoto2ndOrderDelayState,
  PIDState,
  PIDGains,
} from '../../core/types';
import { clamp, toRadians, toDegrees, DEG_TO_RAD } from '../../core/constants';

// ============ 类型导出 ============

export type { Nomoto2ndOrderParams, Nomoto2ndOrderDelayState };

// ============ 默认参数 ============

/** LNG 船默认 Nomoto 二阶参数 */
export const DEFAULT_NOMOTO_2ND_ORDER_PARAMS: Nomoto2ndOrderParams = {
  K: 0.03,              // 转向增益
  T1: 80,               // 主时间常数 (s)
  T2: 20,               // 次时间常数 (s)
  timeDelay: 25,        // 纯滞后 (s)
  maxRudderDeg: 35,     // 最大舵角 (°)
  speedMps: 9.8,        // 参考航速 (m/s)
};

// ============ 时滞缓冲区 ============

/**
 * 环形缓冲区 - 实现纯时滞
 */
export class DelayBuffer {
  private buffer: number[];
  private index: number = 0;
  private size: number;

  constructor(delaySeconds: number, dt: number, initialValue: number = 0) {
    this.size = Math.max(1, Math.ceil(delaySeconds / dt));
    this.buffer = new Array(this.size).fill(initialValue);
  }

  /**
   * 推入新值，返回经过时滞后的值
   */
  push(value: number): number {
    const delayed = this.buffer[this.index];
    this.buffer[this.index] = value;
    this.index = (this.index + 1) % this.size;
    return delayed;
  }

  /**
   * 获取当前缓冲区内容
   */
  getBuffer(): number[] {
    return [...this.buffer];
  }

  /**
   * 获取当前索引
   */
  getIndex(): number {
    return this.index;
  }

  /**
   * 重置缓冲区
   */
  reset(value: number = 0): void {
    this.buffer.fill(value);
    this.index = 0;
  }
}

// ============ 状态初始化 ============

/**
 * 创建初始状态
 */
export function createNomoto2ndOrderDelayState(
  params: Nomoto2ndOrderParams,
  dt: number,
  startX: number = 0,
  startZ: number = 0,
  startHeadingDeg: number = 0
): Nomoto2ndOrderDelayState {
  const bufferSize = Math.ceil(params.timeDelay / dt);

  return {
    headingRad: toRadians(startHeadingDeg),
    yawRateRad: 0,
    yawRateDerivative: 0,
    rudderDeg: 0,
    positionX: startX,
    positionZ: startZ,
    speedMps: params.speedMps,
    rudderHistory: new Array(bufferSize).fill(0),
    historyIndex: 0,
  };
}

// ============ 核心物理步进 ============

/**
 * 获取经过时滞的舵角
 */
function getDelayedRudder(state: Nomoto2ndOrderDelayState, currentRudder: number): {
  delayedRudder: number;
  newHistory: number[];
  newIndex: number;
} {
  const bufferSize = state.rudderHistory.length;
  const delayedRudder = state.rudderHistory[state.historyIndex];

  // 更新缓冲区
  const newHistory = [...state.rudderHistory];
  newHistory[state.historyIndex] = currentRudder;
  const newIndex = (state.historyIndex + 1) % bufferSize;

  return { delayedRudder, newHistory, newIndex };
}

/**
 * Nomoto 二阶模型微分方程
 *
 * 状态方程:
 *   ṙ = (K*δ - r) / T1 - r' * (T2/T1)  (简化形式)
 *
 * 更精确的二阶形式:
 *   T1*T2*r'' + (T1+T2)*r' + r = K*δ
 *
 * 令 x1 = r, x2 = r':
 *   x1' = x2
 *   x2' = (K*δ - x1 - (T1+T2)*x2) / (T1*T2)
 */
function nomoto2ndOrderDerivatives(
  yawRate: number,
  yawRateDerivative: number,
  delayedRudderRad: number,
  params: Nomoto2ndOrderParams
): { dYawRate: number; dYawRateDerivative: number } {
  const { K, T1, T2 } = params;

  // dr/dt = r' (当前的角加速度)
  const dYawRate = yawRateDerivative;

  // dr'/dt = (K*δ - r - (T1+T2)*r') / (T1*T2)
  const dYawRateDerivative =
    (K * delayedRudderRad - yawRate - (T1 + T2) * yawRateDerivative) / (T1 * T2);

  return { dYawRate, dYawRateDerivative };
}

/**
 * Nomoto 二阶模型步进 (RK4 积分)
 */
export function nomoto2ndOrderDelayStep(
  state: Nomoto2ndOrderDelayState,
  rudderDeg: number,
  dt: number,
  params: Nomoto2ndOrderParams
): Nomoto2ndOrderDelayState {
  // 限制舵角
  const clampedRudder = clamp(rudderDeg, -params.maxRudderDeg, params.maxRudderDeg);

  // 获取经过时滞的舵角
  const { delayedRudder, newHistory, newIndex } = getDelayedRudder(state, clampedRudder);
  const delayedRudderRad = toRadians(delayedRudder);

  // RK4 积分
  const { yawRateRad, yawRateDerivative } = state;

  // k1
  const k1 = nomoto2ndOrderDerivatives(yawRateRad, yawRateDerivative, delayedRudderRad, params);

  // k2
  const k2 = nomoto2ndOrderDerivatives(
    yawRateRad + 0.5 * dt * k1.dYawRate,
    yawRateDerivative + 0.5 * dt * k1.dYawRateDerivative,
    delayedRudderRad,
    params
  );

  // k3
  const k3 = nomoto2ndOrderDerivatives(
    yawRateRad + 0.5 * dt * k2.dYawRate,
    yawRateDerivative + 0.5 * dt * k2.dYawRateDerivative,
    delayedRudderRad,
    params
  );

  // k4
  const k4 = nomoto2ndOrderDerivatives(
    yawRateRad + dt * k3.dYawRate,
    yawRateDerivative + dt * k3.dYawRateDerivative,
    delayedRudderRad,
    params
  );

  // 更新状态
  const newYawRate =
    yawRateRad +
    (dt / 6) * (k1.dYawRate + 2 * k2.dYawRate + 2 * k3.dYawRate + k4.dYawRate);

  const newYawRateDerivative =
    yawRateDerivative +
    (dt / 6) *
      (k1.dYawRateDerivative +
        2 * k2.dYawRateDerivative +
        2 * k3.dYawRateDerivative +
        k4.dYawRateDerivative);

  // 更新航向
  const newHeading = state.headingRad + newYawRate * dt;

  // 更新位置
  const speed = state.speedMps;
  const newX = state.positionX + speed * Math.cos(newHeading) * dt;
  const newZ = state.positionZ + speed * Math.sin(newHeading) * dt;

  return {
    headingRad: newHeading,
    yawRateRad: newYawRate,
    yawRateDerivative: newYawRateDerivative,
    rudderDeg: clampedRudder,
    positionX: newX,
    positionZ: newZ,
    speedMps: speed,
    rudderHistory: newHistory,
    historyIndex: newIndex,
  };
}

// ============ 稳态特性 ============

/**
 * 计算稳态特性
 */
export function getSteadyStateCharacteristics2ndOrder(
  rudderDeg: number,
  params: Nomoto2ndOrderParams
): {
  steadyYawRate: number;        // 稳态转艏角速度 (°/s)
  turningRadius: number;        // 回旋半径 (m)
  timeToSteadyState: number;    // 到达稳态的近似时间 (s)
  effectiveDelay: number;       // 含时滞的有效延迟 (s)
} {
  const rudderRad = toRadians(rudderDeg);

  // 稳态转艏角速度 (r_ss = K * δ)
  const steadyYawRateRad = params.K * rudderRad;
  const steadyYawRate = toDegrees(steadyYawRateRad);

  // 回旋半径 (R = V / r_ss)
  const turningRadius =
    Math.abs(steadyYawRateRad) > 1e-6
      ? params.speedMps / Math.abs(steadyYawRateRad)
      : Infinity;

  // 二阶系统的调节时间近似 (约 4 * max(T1, T2))
  const timeToSteadyState = 4 * Math.max(params.T1, params.T2);

  // 有效延迟 = 纯滞后 + 动态延迟
  const effectiveDelay = params.timeDelay + (params.T1 + params.T2) / 2;

  return {
    steadyYawRate,
    turningRadius,
    timeToSteadyState,
    effectiveDelay,
  };
}

// ============ PID 控制器 ============

/**
 * 创建初始 PID 状态
 */
export function createPIDState(): PIDState {
  return { integral: 0, prevError: 0 };
}

/**
 * PID 航向控制 (带时滞系统优化)
 */
export function pidControl2ndOrder(
  targetHeadingDeg: number,
  currentHeadingDeg: number,
  currentYawRateDeg: number,
  pidState: PIDState,
  gains: PIDGains,
  mode: 'manual' | 'p' | 'pd' | 'pid',
  dt: number,
  maxRudderDeg: number = 35,
  integralLimit: number = 30
): { rudderDeg: number; newState: PIDState } {
  if (mode === 'manual') {
    return { rudderDeg: 0, newState: pidState };
  }

  // 计算航向误差 (考虑角度环绕)
  let error = targetHeadingDeg - currentHeadingDeg;
  while (error > 180) error -= 360;
  while (error < -180) error += 360;

  // P 控制
  let rudder = gains.kp * error;

  // D 控制 (使用角速度反馈，减少噪声)
  if (mode === 'pd' || mode === 'pid') {
    // 对于大时滞系统，增加微分预测作用
    rudder -= gains.kd * currentYawRateDeg;
  }

  // I 控制 (带积分限幅)
  let newIntegral = pidState.integral;
  if (mode === 'pid') {
    newIntegral += error * dt;
    newIntegral = clamp(newIntegral, -integralLimit, integralLimit);
    rudder += gains.ki * newIntegral;
  }

  // 舵角限幅
  rudder = clamp(rudder, -maxRudderDeg, maxRudderDeg);

  return {
    rudderDeg: rudder,
    newState: {
      integral: newIntegral,
      prevError: error,
    },
  };
}
