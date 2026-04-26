/**
 * DP 解耦控制器
 * 用于半潜式钻井平台的3DOF动力定位
 *
 * 特点:
 * - 三通道 PID 控制
 * - 可选解耦补偿 (教学重点)
 * - 积分抗饱和
 * - 位置/航向误差计算
 *
 * 教学映射: Ch6 解耦控制、现代控制理论
 */

import type {
  PIDGains,
  DPGains,
  DPState,
  SemiSubmersible3DOFState,
} from '../../core/types';

// 重新导出类型供外部使用
export type { DPState } from '../../core/types';
import {
  DRILLING_DEFAULT_DP,
  DEG_TO_RAD,
  RAD_TO_DEG,
  clamp,
} from '../../core/constants';
import {
  getDecouplingMatrix,
  applyDecoupling,
} from '../model-state-helpers';

// ============ 类型定义 ============

/** DP 控制器配置 */
export interface DPControllerConfig {
  gains: DPGains;
  integralLimit: {
    surge: number;    // 纵荡积分限幅 (kN·s)
    sway: number;     // 横荡积分限幅 (kN·s)
    yaw: number;      // 艏摇积分限幅 (kN·m·s)
  };
  decouplingEnabled: boolean;
  deadband: {
    position: number;  // 位置死区 (m)
    heading: number;   // 航向死区 (deg)
  };
}

/** DP 控制输出 */
export interface DPControlOutput {
  tauX: number;       // 纵向力命令 (kN)
  tauY: number;       // 横向力命令 (kN)
  tauN: number;       // 艏摇力矩命令 (kN·m)
  errorX: number;     // 纵向误差 (m)
  errorY: number;     // 横向误差 (m)
  errorPsi: number;   // 航向误差 (deg)
  decoupledTauX: number;  // 解耦后纵向力 (kN)
  decoupledTauY: number;  // 解耦后横向力 (kN)
  decoupledTauN: number;  // 解耦后艏摇力矩 (kN·m)
}

// ============ 默认配置 ============

/** 创建默认控制器配置 */
export function createDPControllerConfig(
  customGains?: Partial<DPGains>,
  decouplingEnabled = true
): DPControllerConfig {
  return {
    gains: {
      surge: { ...DRILLING_DEFAULT_DP.surge, ...customGains?.surge },
      sway: { ...DRILLING_DEFAULT_DP.sway, ...customGains?.sway },
      yaw: { ...DRILLING_DEFAULT_DP.yaw, ...customGains?.yaw },
    },
    integralLimit: {
      surge: 5000,    // kN·s
      sway: 8000,     // kN·s
      yaw: 1e9,       // kN·m·s
    },
    decouplingEnabled,
    deadband: {
      position: 0.1,  // 10cm
      heading: 0.5,   // 0.5°
    },
  };
}

/** 创建控制器状态 */
export function createDPState(): DPState {
  return {
    surge: { integral: 0, prevError: 0 },
    sway: { integral: 0, prevError: 0 },
    yaw: { integral: 0, prevError: 0 },
  };
}

// ============ 误差计算 ============

/**
 * 计算位置误差 (地固坐标系)
 * @param current 当前位置 [x, y] (m)
 * @param target 目标位置 [x, y] (m)
 * @returns [ex, ey] 位置误差 (m)
 */
export function computePositionError(
  current: [number, number],
  target: [number, number]
): [number, number] {
  return [target[0] - current[0], target[1] - current[1]];
}

/**
 * 计算体坐标系下的位置误差
 * @param errorEarth 地固系误差 [ex, ey] (m)
 * @param psi 当前航向 (rad)
 * @returns [ex_body, ey_body] 体系误差 (m)
 */
export function transformErrorToBody(
  errorEarth: [number, number],
  psi: number
): [number, number] {
  const cosPsi = Math.cos(psi);
  const sinPsi = Math.sin(psi);
  const ex_body = errorEarth[0] * cosPsi + errorEarth[1] * sinPsi;
  const ey_body = -errorEarth[0] * sinPsi + errorEarth[1] * cosPsi;
  return [ex_body, ey_body];
}

/**
 * 计算航向误差
 * @param current 当前航向 (rad)
 * @param target 目标航向 (rad)
 * @returns 航向误差 (rad), 归一化到 [-π, π]
 */
export function computeHeadingError(current: number, target: number): number {
  let error = target - current;
  while (error > Math.PI) error -= 2 * Math.PI;
  while (error < -Math.PI) error += 2 * Math.PI;
  return error;
}

// ============ PID 计算 ============

/**
 * 单通道 PID 计算
 * @param error 当前误差
 * @param state 积分器状态
 * @param gains PID 增益
 * @param dt 时间步长 (s)
 * @param integralLimit 积分限幅
 * @param deadband 死区
 * @returns [output, newState]
 */
function computePID(
  error: number,
  state: { integral: number; prevError: number },
  gains: PIDGains,
  dt: number,
  integralLimit: number,
  deadband: number
): [number, { integral: number; prevError: number }] {
  // 死区处理
  const effectiveError = Math.abs(error) < deadband ? 0 : error;

  // 比例项
  const P = gains.kp * effectiveError;

  // 积分项 (带抗饱和)
  let newIntegral = state.integral + effectiveError * dt;
  newIntegral = clamp(newIntegral, -integralLimit, integralLimit);
  const I = gains.ki * newIntegral;

  // 微分项
  const errorDerivative = (effectiveError - state.prevError) / dt;
  const D = gains.kd * errorDerivative;

  // 输出
  const output = P + I + D;

  return [
    output,
    {
      integral: newIntegral,
      prevError: effectiveError,
    },
  ];
}

// ============ 主控制器 ============

/**
 * DP 解耦控制器主函数
 * @param platformState 平台当前状态
 * @param controllerState 控制器状态
 * @param config 控制器配置
 * @param dt 时间步长 (s)
 * @returns [控制输出, 新控制器状态]
 */
export function dpDecoupledControl(
  platformState: SemiSubmersible3DOFState,
  controllerState: DPState,
  config: DPControllerConfig,
  dt: number
): [DPControlOutput, DPState] {
  const { x, y, psi, targetX, targetY, targetPsi } = platformState;
  const { gains, integralLimit, decouplingEnabled, deadband } = config;

  // Step 1: 计算地固系位置误差
  const errorEarth = computePositionError([x, y], [targetX, targetY]);

  // Step 2: 转换到体坐标系
  const [errorSurge, errorSway] = transformErrorToBody(errorEarth, psi);

  // Step 3: 计算航向误差
  const errorYawRad = computeHeadingError(psi, targetPsi);
  const errorYawDeg = errorYawRad * RAD_TO_DEG;

  // Step 4: 各通道 PID 计算
  const [tauX, newSurgeState] = computePID(
    errorSurge,
    controllerState.surge,
    gains.surge,
    dt,
    integralLimit.surge,
    deadband.position
  );

  const [tauY, newSwayState] = computePID(
    errorSway,
    controllerState.sway,
    gains.sway,
    dt,
    integralLimit.sway,
    deadband.position
  );

  const [tauN, newYawState] = computePID(
    errorYawRad,
    controllerState.yaw,
    gains.yaw,
    dt,
    integralLimit.yaw,
    deadband.heading * DEG_TO_RAD
  );

  // Step 5: 应用解耦 (如果启用)
  const tauCmd: [number, number, number] = [tauX, tauY, tauN];
  const decoupledCmd = applyDecoupling(tauCmd, decouplingEnabled);

  // 构建输出
  const output: DPControlOutput = {
    tauX,
    tauY,
    tauN,
    errorX: errorSurge,
    errorY: errorSway,
    errorPsi: errorYawDeg,
    decoupledTauX: decoupledCmd[0],
    decoupledTauY: decoupledCmd[1],
    decoupledTauN: decoupledCmd[2],
  };

  const newState: DPState = {
    surge: newSurgeState,
    sway: newSwayState,
    yaw: newYawState,
  };

  return [output, newState];
}

/**
 * 标准 DP 控制 (无解耦，用于对比)
 */
export function dpStandardControl(
  platformState: SemiSubmersible3DOFState,
  controllerState: DPState,
  config: DPControllerConfig,
  dt: number
): [DPControlOutput, DPState] {
  // 强制禁用解耦
  const noDecouplingConfig = { ...config, decouplingEnabled: false };
  return dpDecoupledControl(platformState, controllerState, noDecouplingConfig, dt);
}

// ============ 性能评估 ============

/** DP 性能指标 */
export interface DPPerformanceMetrics {
  positionRMS: number;      // 位置误差 RMS (m)
  headingRMS: number;       // 航向误差 RMS (deg)
  maxPositionError: number; // 最大位置误差 (m)
  maxHeadingError: number;  // 最大航向误差 (deg)
  powerConsumption: number; // 平均功率消耗 (kW)
  settlingTime: number | null; // 调节时间 (s), null表示未达到稳态
}

/**
 * 创建性能统计器
 */
export function createPerformanceTracker(): {
  positionErrors: number[];
  headingErrors: number[];
  powers: number[];
  startTime: number;
  settlingTime: number | null;
  settledAt: number | null;
} {
  return {
    positionErrors: [],
    headingErrors: [],
    powers: [],
    startTime: 0,
    settlingTime: null,
    settledAt: null,
  };
}

/**
 * 更新性能统计
 */
export function updatePerformanceTracker(
  tracker: ReturnType<typeof createPerformanceTracker>,
  posError: number,
  headError: number,
  power: number,
  time: number,
  posThreshold = 1.0,
  headThreshold = 2.0
): void {
  if (tracker.positionErrors.length === 0) {
    tracker.startTime = time;
  }

  tracker.positionErrors.push(posError);
  tracker.headingErrors.push(headError);
  tracker.powers.push(power);

  // 检测是否达到稳态
  if (tracker.settlingTime === null) {
    const isSettled = posError < posThreshold && headError < headThreshold;
    if (isSettled) {
      if (tracker.settledAt === null) {
        tracker.settledAt = time;
      } else if (time - tracker.settledAt > 10) {
        // 持续10秒认为已稳态
        tracker.settlingTime = tracker.settledAt - tracker.startTime;
      }
    } else {
      tracker.settledAt = null;
    }
  }
}

/**
 * 计算性能指标
 */
export function computePerformanceMetrics(
  tracker: ReturnType<typeof createPerformanceTracker>
): DPPerformanceMetrics {
  const n = tracker.positionErrors.length;
  if (n === 0) {
    return {
      positionRMS: 0,
      headingRMS: 0,
      maxPositionError: 0,
      maxHeadingError: 0,
      powerConsumption: 0,
      settlingTime: null,
    };
  }

  // RMS 计算
  const positionRMS = Math.sqrt(
    tracker.positionErrors.reduce((sum, e) => sum + e * e, 0) / n
  );
  const headingRMS = Math.sqrt(
    tracker.headingErrors.reduce((sum, e) => sum + e * e, 0) / n
  );

  // 最大值
  const maxPositionError = Math.max(...tracker.positionErrors);
  const maxHeadingError = Math.max(...tracker.headingErrors);

  // 平均功率
  const powerConsumption = tracker.powers.reduce((sum, p) => sum + p, 0) / n;

  return {
    positionRMS,
    headingRMS,
    maxPositionError,
    maxHeadingError,
    powerConsumption,
    settlingTime: tracker.settlingTime,
  };
}

// ============ 解耦效果评估 ============

/**
 * 评估解耦控制效果
 * 对比解耦前后的性能差异
 */
export interface DecouplingComparison {
  withDecoupling: DPPerformanceMetrics;
  withoutDecoupling: DPPerformanceMetrics;
  improvement: {
    positionRMS: number;     // 位置 RMS 改善百分比
    headingRMS: number;      // 航向 RMS 改善百分比
    settlingTime: number;    // 调节时间改善百分比
  };
}

/**
 * 计算解耦改善百分比
 */
export function computeDecouplingImprovement(
  withDecoupling: DPPerformanceMetrics,
  withoutDecoupling: DPPerformanceMetrics
): DecouplingComparison['improvement'] {
  const posImprovement =
    withoutDecoupling.positionRMS > 0
      ? ((withoutDecoupling.positionRMS - withDecoupling.positionRMS) /
          withoutDecoupling.positionRMS) *
        100
      : 0;

  const headImprovement =
    withoutDecoupling.headingRMS > 0
      ? ((withoutDecoupling.headingRMS - withDecoupling.headingRMS) /
          withoutDecoupling.headingRMS) *
        100
      : 0;

  let settlingImprovement = 0;
  if (
    withoutDecoupling.settlingTime !== null &&
    withDecoupling.settlingTime !== null
  ) {
    settlingImprovement =
      ((withoutDecoupling.settlingTime - withDecoupling.settlingTime) /
        withoutDecoupling.settlingTime) *
      100;
  }

  return {
    positionRMS: posImprovement,
    headingRMS: headImprovement,
    settlingTime: settlingImprovement,
  };
}

// ============ 工具函数 ============

/**
 * 重置控制器状态
 */
export function resetDPState(state: DPState): DPState {
  return {
    surge: { integral: 0, prevError: 0 },
    sway: { integral: 0, prevError: 0 },
    yaw: { integral: 0, prevError: 0 },
  };
}

/**
 * 格式化控制输出
 */
export function formatDPControlOutput(output: DPControlOutput): string {
  const { tauX, tauY, tauN, errorX, errorY, errorPsi } = output;
  return [
    `位置误差: X=${errorX.toFixed(2)}m, Y=${errorY.toFixed(2)}m`,
    `航向误差: ${errorPsi.toFixed(1)}°`,
    `控制力: Fx=${tauX.toFixed(0)}kN, Fy=${tauY.toFixed(0)}kN, Mz=${tauN.toFixed(0)}kN·m`,
  ].join('\n');
}

/**
 * 获取解耦矩阵描述 (用于教学展示)
 */
export function getDecouplingMatrixDescription(): string {
  const D = getDecouplingMatrix();
  return [
    '解耦矩阵 D⁻¹:',
    `[${D[0].map((v) => v.toFixed(3)).join(', ')}]`,
    `[${D[1].map((v) => v.toFixed(3)).join(', ')}]`,
    `[${D[2].map((v) => v.toFixed(3)).join(', ')}]`,
    '',
    '作用: τ_decoupled = D⁻¹ × τ_pid',
    '通过补偿 sway-yaw 耦合，减少交叉干扰',
  ].join('\n');
}
