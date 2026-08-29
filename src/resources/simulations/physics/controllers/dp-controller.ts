/**
 * 动力定位 (Dynamic Positioning, DP) 控制器
 * 三自由度位置保持控制 (X, Y, Heading)
 *
 * 控制结构:
 * 目标位置 [x*, y*, psi*]
 *     ↓
 * 位置误差计算 (地固→体固变换)
 *     ↓
 * 3通道独立 PID
 *     ↓
 * 推力分配
 *     ↓
 * 舵角 + 推进器命令
 */

import type { DPGains, DPState } from '../../core/types';

// 重新导出类型
export type { DPState, DPGains } from '../../core/types';

// ============ 类型定义 ============

/** DP 目标 */
export interface DPTarget {
  x: number;        // 目标 X 位置 (m)
  y: number;        // 目标 Y 位置 (m)
  psi: number;      // 目标航向 (rad)
}

/** DP 当前状态 */
export interface DPCurrentState {
  x: number;        // 当前 X 位置 (m)
  y: number;        // 当前 Y 位置 (m)
  psi: number;      // 当前航向 (rad)
  u: number;        // 纵向速度 (m/s)
  v: number;        // 横向速度 (m/s)
  r: number;        // 转艏角速度 (rad/s)
}

/** DP 控制输出 */
export interface DPControlOutput {
  rudderCommand: number;    // 舵令 (rad)
  surgeThrust: number;      // 纵向推力 (N)
  swayThrust: number;       // 横向推力 (N)
  yawMoment: number;        // 艏摇力矩 (N·m)
}

/** DP 误差指标 */
export interface DPErrorMetrics {
  positionError: number;    // 位置误差 (m)
  headingError: number;     // 航向误差 (°)
  surgeError: number;       // 纵向误差 (m)
  swayError: number;        // 横向误差 (m)
}

// ============ 默认参数 ============

/** 挖泥船 DP 默认增益 */
export const DEFAULT_DP_GAINS: DPGains = {
  surge: { kp: 50000, ki: 2000, kd: 30000 },   // 纵向控制
  sway: { kp: 80000, ki: 3000, kd: 40000 },    // 横向控制 (更大增益因为横向阻力大)
  yaw: { kp: 5e8, ki: 1e7, kd: 2e8 },          // 艏摇控制
};

/** 高精度 DP 增益 (用于 <0.1m 精度要求) */
export const HIGH_PRECISION_DP_GAINS: DPGains = {
  surge: { kp: 100000, ki: 5000, kd: 50000 },
  sway: { kp: 150000, ki: 8000, kd: 70000 },
  yaw: { kp: 1e9, ki: 3e7, kd: 4e8 },
};

/** DP 控制限制 */
export const DP_LIMITS = {
  maxSurgeThrust: 2000000,    // 最大纵向推力 2MN
  maxSwayThrust: 1500000,     // 最大横向推力 1.5MN
  maxYawMoment: 5e8,          // 最大艏摇力矩
  maxRudderAngle: 35,         // 最大舵角 (°)
  integralLimit: {
    surge: 50,                // 纵向积分限幅 (m·s)
    sway: 50,                 // 横向积分限幅 (m·s)
    yaw: 1.0,                 // 艏摇积分限幅 (rad·s)
  },
};

// ============ 状态初始化 ============

/** 创建初始 DP 控制器状态 */
export function createDPState(): DPState {
  return {
    surge: { integral: 0, prevError: 0 },
    sway: { integral: 0, prevError: 0 },
    yaw: { integral: 0, prevError: 0 },
  };
}

// ============ 误差计算 ============

/**
 * 计算位置和航向误差 (转换到船体坐标系)
 */
export function computeDPError(
  current: DPCurrentState,
  target: DPTarget
): { surge: number; sway: number; yaw: number } {
  // 地固坐标误差
  const dxE = target.x - current.x;
  const dyE = target.y - current.y;

  // 转换到船体坐标系
  const cosPsi = Math.cos(current.psi);
  const sinPsi = Math.sin(current.psi);

  // 船体坐标下的位置误差
  const surgeError = cosPsi * dxE + sinPsi * dyE;   // 纵向误差 (正=前方)
  const swayError = -sinPsi * dxE + cosPsi * dyE;   // 横向误差 (正=左舷)

  // 航向误差 (处理角度环绕)
  let yawError = target.psi - current.psi;
  while (yawError > Math.PI) yawError -= 2 * Math.PI;
  while (yawError < -Math.PI) yawError += 2 * Math.PI;

  return { surge: surgeError, sway: swayError, yaw: yawError };
}

// ============ 增益自整定 ============

/**
 * 根据船舶参数自动计算 DP 增益
 * 基于极点配置方法
 */
export function autoTuneDPGains(
  shipMass: number,           // 船舶质量 (kg)
  addedMassX: number,         // 附加质量 X 系数
  addedMassY: number,         // 附加质量 Y 系数
  momentOfInertia: number,    // 转动惯量 (kg·m²)
  addedInertiaZ: number,      // 附加转动惯量系数
  settlingTime: number = 30,  // 期望调节时间 (s)
  overshootMax: number = 0.05 // 最大超调 (5%)
): DPGains {
  // 期望带宽
  const omega = 4 / settlingTime;  // 近似带宽

  // 阻尼比 (根据超调量)
  const zeta = -Math.log(overshootMax) / Math.sqrt(Math.PI * Math.PI + Math.log(overshootMax) ** 2);

  // 纵向通道
  const mSurge = shipMass * (1 + addedMassX);
  const surgKp = mSurge * omega * omega;
  const surgKd = 2 * zeta * omega * mSurge;
  const surgKi = omega * omega * omega * mSurge / 10;

  // 横向通道
  const mSway = shipMass * (1 + addedMassY);
  const swayKp = mSway * omega * omega;
  const swayKd = 2 * zeta * omega * mSway;
  const swayKi = omega * omega * omega * mSway / 10;

  // 艏摇通道
  const Iz = momentOfInertia * (1 + addedInertiaZ);
  const yawKp = Iz * omega * omega;
  const yawKd = 2 * zeta * omega * Iz;
  const yawKi = omega * omega * omega * Iz / 10;

  return {
    surge: { kp: surgKp, ki: surgKi, kd: surgKd },
    sway: { kp: swayKp, ki: swayKi, kd: swayKd },
    yaw: { kp: yawKp, ki: yawKi, kd: yawKd },
  };
}
