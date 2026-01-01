/**
 * Azipod 航向保持控制器
 * 使用双吊舱推进器实现航向控制
 *
 * 控制策略:
 * 1. PID 计算期望艏摇力矩
 * 2. 推力分配: 将力矩需求映射到两个 Azipod 的角度和推力
 * 3. Azipod 角度差异产生转向力矩
 *
 * 特点:
 * - 无传统舵角，通过 Azipod 回转实现转向
 * - 回转速率限制 (12°/s) 是关键约束
 * - 冰区模式下使用更保守的增益
 */

import {
  XUELONG_DEFAULT_GAINS,
  XUELONG_AZIPOD_PARAMS,
  DEG_TO_RAD,
  RAD_TO_DEG,
  clamp,
  normalizeSignedHeading,
  angleDelta,
} from '../../core/constants';
import type { PIDGains, ControlMode } from '../../core/types';

// ============ 类型定义 ============

/** Azipod 控制器状态 */
export interface AzipodCourseKeeperState {
  // PID 状态
  integral: number;
  prevError: number;
  prevTime: number;

  // 输出
  azimuth1Cmd: number;     // Azipod 1 命令角度 (rad)
  azimuth2Cmd: number;     // Azipod 2 命令角度 (rad)
  thrust1Cmd: number;      // Azipod 1 命令推力 (N)
  thrust2Cmd: number;      // Azipod 2 命令推力 (N)

  // 诊断
  yawMomentDemand: number; // 艏摇力矩需求 (N·m)
  thrustDemand: number;    // 总推力需求 (N)
}

/** Azipod 控制器配置 */
export interface AzipodCourseKeeperConfig {
  // PID 增益
  gains: PIDGains;

  // 增益修正因子 (用于冰区模式)
  gainFactor: number;

  // 约束
  maxAzimuthDeg: number;       // 最大角度偏转 (°)
  maxThrustN: number;          // 最大单吊舱推力 (N)
  baseThrust: number;          // 基础推力 (用于前进, N)

  // Azipod 布局
  leverArm: number;            // 力臂 (m) - Azipod 到船体中心的横向距离

  // 积分抗饱和
  integralLimit: number;       // 积分限幅
  antiWindup: boolean;         // 是否启用抗饱和
}

// ============ 默认配置 ============

/** 默认航向控制器配置 */
export const DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG: AzipodCourseKeeperConfig = {
  gains: XUELONG_DEFAULT_GAINS.heading,
  gainFactor: 1.0,
  maxAzimuthDeg: 45,
  maxThrustN: XUELONG_AZIPOD_PARAMS.MAX_SINGLE_THRUST * 1000,  // kN → N
  baseThrust: 3000000,  // 3000 kN 基础推力 (约 40% 最大推力)
  leverArm: 5.0,        // 假设 Azipod 横向偏置 5m
  integralLimit: 50,
  antiWindup: true,
};

/** 冰区模式配置 */
export const ICE_MODE_CONFIG: Partial<AzipodCourseKeeperConfig> = {
  gains: XUELONG_DEFAULT_GAINS.ice,
  gainFactor: 0.7,       // 冰区模式下增益降低 30%
  integralLimit: 30,     // 更严格的积分限幅
};

// ============ 状态创建 ============

/** 创建控制器初始状态 */
export function createAzipodCourseKeeperState(): AzipodCourseKeeperState {
  return {
    integral: 0,
    prevError: 0,
    prevTime: 0,
    azimuth1Cmd: 0,
    azimuth2Cmd: 0,
    thrust1Cmd: 0,
    thrust2Cmd: 0,
    yawMomentDemand: 0,
    thrustDemand: 0,
  };
}

// ============ 控制算法 ============

/**
 * Azipod 航向控制 - 计算 Azipod 命令
 *
 * @param state 控制器状态
 * @param currentHeading 当前航向 (°)
 * @param targetHeading 目标航向 (°)
 * @param yawRate 当前艏摇角速度 (°/s)
 * @param speedMps 当前航速 (m/s)
 * @param mode 控制模式
 * @param config 控制器配置
 * @param perturbedK K 摄动因子 (冰区影响)
 * @param dt 时间步长 (s)
 * @param time 当前时间 (s)
 * @returns 更新后的控制器状态
 */
export function azipodCourseKeeperControl(
  state: AzipodCourseKeeperState,
  currentHeading: number,
  targetHeading: number,
  yawRate: number,
  speedMps: number,
  mode: ControlMode,
  config: AzipodCourseKeeperConfig,
  perturbedK: number = 1.0,
  dt: number,
  time: number
): AzipodCourseKeeperState {
  // 手动模式: 返回当前状态，不进行控制
  if (mode === 'manual') {
    return {
      ...state,
      integral: 0,
      prevError: 0,
      prevTime: time,
    };
  }

  // 计算航向误差 (考虑角度环绕)
  const error = angleDelta(targetHeading, currentHeading);

  // 获取增益 (考虑摄动)
  const effectiveGains = {
    kp: config.gains.kp * config.gainFactor * perturbedK,
    ki: config.gains.ki * config.gainFactor,
    kd: config.gains.kd * config.gainFactor,
  };

  // PID 计算
  let integral = state.integral;
  let derivative = 0;

  // 积分项
  if (mode === 'pid') {
    integral += error * dt;

    // 积分抗饱和
    if (config.antiWindup) {
      integral = clamp(integral, -config.integralLimit, config.integralLimit);
    }
  }

  // 微分项
  if (mode === 'pd' || mode === 'pid') {
    if (dt > 0) {
      derivative = (error - state.prevError) / dt;
    }
    // 也可以使用艏摇角速度作为微分反馈 (更平滑)
    // derivative = -yawRate;
  }

  // 计算控制输出
  let output = 0;
  switch (mode) {
    case 'p':
      output = effectiveGains.kp * error;
      break;
    case 'pd':
      output = effectiveGains.kp * error + effectiveGains.kd * derivative;
      break;
    case 'pid':
      output = effectiveGains.kp * error + effectiveGains.ki * integral + effectiveGains.kd * derivative;
      break;
  }

  // 将 PID 输出映射到 Azipod 命令
  // output > 0 表示需要向右转 (顺时针)
  // output < 0 表示需要向左转 (逆时针)

  // 策略: 差异角度产生转向力矩
  // 两个 Azipod 角度相反，产生纯力矩
  const azimuthDelta = clamp(
    output * 2,  // 放大因子
    -config.maxAzimuthDeg * DEG_TO_RAD,
    config.maxAzimuthDeg * DEG_TO_RAD
  );

  // Azipod 1 (左侧) 和 Azipod 2 (右侧) 产生差异角
  // 向右转: 左侧向右偏，右侧向左偏
  const azimuth1Cmd = azimuthDelta / 2;
  const azimuth2Cmd = -azimuthDelta / 2;

  // 推力分配
  // 基础推力用于前进，额外推力用于转向
  const baseThrust = speedMps > 0.5 ? config.baseThrust : config.baseThrust * 0.5;
  const thrust1Cmd = baseThrust;
  const thrust2Cmd = baseThrust;

  // 计算艏摇力矩需求 (用于诊断)
  const yawMomentDemand = output * 1e8;  // 缩放到合理范围

  return {
    integral,
    prevError: error,
    prevTime: time,
    azimuth1Cmd,
    azimuth2Cmd,
    thrust1Cmd,
    thrust2Cmd,
    yawMomentDemand,
    thrustDemand: thrust1Cmd + thrust2Cmd,
  };
}

/**
 * 冰区模式航向控制 (更保守的增益)
 */
export function azipodCourseKeeperControlIceMode(
  state: AzipodCourseKeeperState,
  currentHeading: number,
  targetHeading: number,
  yawRate: number,
  speedMps: number,
  mode: ControlMode,
  perturbedK: number,
  dt: number,
  time: number
): AzipodCourseKeeperState {
  const iceConfig: AzipodCourseKeeperConfig = {
    ...DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
    ...ICE_MODE_CONFIG,
  };

  return azipodCourseKeeperControl(
    state,
    currentHeading,
    targetHeading,
    yawRate,
    speedMps,
    mode,
    iceConfig,
    perturbedK,
    dt,
    time
  );
}

// ============ 工具函数 ============

/**
 * 重置控制器状态
 */
export function resetAzipodCourseKeeper(
  state: AzipodCourseKeeperState
): AzipodCourseKeeperState {
  return createAzipodCourseKeeperState();
}

/**
 * 设置手动 Azipod 命令
 */
export function setManualAzipodCommands(
  state: AzipodCourseKeeperState,
  azimuth1Deg: number,
  azimuth2Deg: number,
  thrust1KN: number,
  thrust2KN: number
): AzipodCourseKeeperState {
  return {
    ...state,
    azimuth1Cmd: azimuth1Deg * DEG_TO_RAD,
    azimuth2Cmd: azimuth2Deg * DEG_TO_RAD,
    thrust1Cmd: thrust1KN * 1000,
    thrust2Cmd: thrust2KN * 1000,
  };
}

/**
 * 获取控制器诊断信息
 */
export function getAzipodControllerDiagnostics(
  state: AzipodCourseKeeperState
): {
  azimuth1CmdDeg: number;
  azimuth2CmdDeg: number;
  thrust1CmdKN: number;
  thrust2CmdKN: number;
  integral: number;
  yawMomentDemandKNm: number;
} {
  return {
    azimuth1CmdDeg: state.azimuth1Cmd * RAD_TO_DEG,
    azimuth2CmdDeg: state.azimuth2Cmd * RAD_TO_DEG,
    thrust1CmdKN: state.thrust1Cmd / 1000,
    thrust2CmdKN: state.thrust2Cmd / 1000,
    integral: state.integral,
    yawMomentDemandKNm: state.yawMomentDemand / 1000,
  };
}

/**
 * 检查 Azipod 回转速率是否接近限制
 */
export function checkSlewRateWarning(
  currentAzimuthDeg: number,
  commandAzimuthDeg: number,
  dt: number,
  warningThresholdDegPerSec: number = 10
): boolean {
  const requiredRate = Math.abs(commandAzimuthDeg - currentAzimuthDeg) / dt;
  return requiredRate > warningThresholdDegPerSec;
}

/**
 * 计算航向误差 (带环绕处理)
 */
export function computeHeadingError(
  current: number,
  target: number
): number {
  return normalizeSignedHeading(target - current);
}
