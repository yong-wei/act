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
  normalizeSignedHeading,
} from '../../core/constants';
import type { PIDGains } from '../../core/types';

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
