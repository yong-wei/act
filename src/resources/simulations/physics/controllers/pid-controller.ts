/**
 * 航向 PID 控制器
 * 用于单通道航向控制 (驱逐舰等)
 */

import type { PIDGains, ControlMode } from '../../core/types';
import {
  clamp,
  toRadians,
  toDegrees,
  angleDelta,
  DEFAULT_PID_GAINS,
} from '../../core/constants';

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

// ============ 核心控制计算 ============

/**
 * 标准 PID 控制计算
 */
export function pidControl(
  targetHeading: number,
  currentHeading: number,
  state: PIDControllerState,
  config: PIDControllerConfig,
  controlMode: ControlMode,
  dt: number
): { output: PIDControlOutput; newState: PIDControllerState } {
  // 手动或其他特殊模式不计算
  if (controlMode === 'manual' || controlMode === 'dp' || controlMode === 'autopilot') {
    return {
      output: { rudderDeg: 0, error: 0, derivative: 0 },
      newState: state,
    };
  }

  const { gains, maxRudderDeg, maxIntegral, derivativeFilter = 0.1, rateLimit } = config;

  // 计算误差（考虑角度环绕）
  const errorDeg = angleDelta(targetHeading, currentHeading);
  const errorRad = toRadians(errorDeg);

  // 微分项
  let derivative = (errorRad - state.prevError) / dt;

  // 微分滤波 (低通滤波减少噪声)
  if (state.prevDerivative !== undefined) {
    derivative = derivativeFilter * derivative + (1 - derivativeFilter) * state.prevDerivative;
  }

  // 积分项
  let newIntegral = state.integral + errorRad * dt;

  // 积分限幅 (抗饱和)
  const integralLimit = maxIntegral ?? toRadians(maxRudderDeg) / (gains.ki || 0.001);
  newIntegral = clamp(newIntegral, -integralLimit, integralLimit);

  // 根据控制模式选择增益
  let kp = gains.kp;
  let ki = gains.ki;
  let kd = gains.kd;

  if (controlMode === 'p') {
    ki = 0;
    kd = 0;
  } else if (controlMode === 'pd') {
    ki = 0;
  }

  // 计算控制输出
  const outputRad = kp * errorRad + ki * newIntegral + kd * derivative;
  let rudderDeg = clamp(toDegrees(outputRad), -maxRudderDeg, maxRudderDeg);

  // 变化率限制
  if (rateLimit !== undefined && state.prevError !== undefined) {
    const prevRudder = toDegrees(
      kp * state.prevError +
      ki * (state.integral) +
      kd * (state.prevDerivative || 0)
    );
    const maxChange = rateLimit * dt;
    rudderDeg = clamp(rudderDeg, prevRudder - maxChange, prevRudder + maxChange);
  }

  return {
    output: {
      rudderDeg,
      error: errorDeg,
      derivative: toDegrees(derivative),
    },
    newState: {
      integral: newIntegral,
      prevError: errorRad,
      prevDerivative: derivative,
    },
  };
}

// ============ PID 控制器类 ============

/**
 * PID 控制器类
 * 封装状态管理
 */
export class PIDController {
  private state: PIDControllerState;
  private config: PIDControllerConfig;
  private mode: ControlMode;

  constructor(
    config?: Partial<PIDControllerConfig>,
    initialMode: ControlMode = 'pid'
  ) {
    this.config = {
      gains: config?.gains ?? DEFAULT_PID_GAINS,
      maxRudderDeg: config?.maxRudderDeg ?? 35,
      maxIntegral: config?.maxIntegral,
      derivativeFilter: config?.derivativeFilter ?? 0.1,
      rateLimit: config?.rateLimit,
    };
    this.mode = initialMode;
    this.state = createPIDControllerState();
  }

  /** 设置控制模式 */
  setMode(mode: ControlMode): void {
    this.mode = mode;
    // 模式切换时重置积分项，避免突变
    if (mode !== 'pid' && mode !== 'pd' && mode !== 'p') {
      this.state.integral = 0;
    }
  }

  /** 更新增益 */
  setGains(gains: Partial<PIDGains>): void {
    this.config.gains = { ...this.config.gains, ...gains };
  }

  /** 更新配置 */
  updateConfig(config: Partial<PIDControllerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.gains) {
      this.config.gains = { ...this.config.gains, ...config.gains };
    }
  }

  /** 重置状态 */
  reset(): void {
    this.state = createPIDControllerState();
  }

  /** 计算控制输出 */
  compute(
    targetHeading: number,
    currentHeading: number,
    dt: number
  ): PIDControlOutput {
    const result = pidControl(
      targetHeading,
      currentHeading,
      this.state,
      this.config,
      this.mode,
      dt
    );
    this.state = result.newState;
    return result.output;
  }

  /** 获取当前状态 */
  getState(): PIDControllerState {
    return { ...this.state };
  }

  /** 获取当前模式 */
  getMode(): ControlMode {
    return this.mode;
  }

  /** 获取当前增益 */
  getGains(): PIDGains {
    return { ...this.config.gains };
  }
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
