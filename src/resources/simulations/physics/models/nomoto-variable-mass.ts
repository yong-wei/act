/**
 * 变质量 Nomoto 模型
 *
 * 用于模拟集装箱船在不同装载率下的动力学变化
 *
 * 特点:
 * - 满载 (24万吨): K=0.04, T=120s (迟钝)
 * - 空载 (8万吨):  K=0.12, T=40s  (灵敏)
 * - 参数随装载率线性插值
 *
 * 传递函数:
 *   G(s) = K(m) / (1 + T(m)*s)
 *
 * 微分方程:
 *   T(m) * ṙ + r = K(m) * δ
 */

import type {
  NomotoState,
  VariableMassNomotoParams,
  ContainerShipState,
  WindLoadState,
  RollState,
} from '../../core/types';
import {
  clamp,
  toRadians,
  toDegrees,
  lerp,
  CONTAINER_MSC_PARAMS,
} from '../../core/constants';

// ============ 类型导出 ============

export type { ContainerShipState };

// ============ 参数计算 ============

/**
 * 根据装载率计算 Nomoto 参数
 *
 * @param loadRatio 装载率 [0, 1], 0=空载, 1=满载
 * @param params 变质量参数配置
 */
export function getVariableParams(
  loadRatio: number,
  params: VariableMassNomotoParams = {
    K_full: CONTAINER_MSC_PARAMS.K_FULL,
    K_empty: CONTAINER_MSC_PARAMS.K_EMPTY,
    T_full: CONTAINER_MSC_PARAMS.T_FULL,
    T_empty: CONTAINER_MSC_PARAMS.T_EMPTY,
    maxRudderDeg: CONTAINER_MSC_PARAMS.MAX_RUDDER_ANGLE,
    speedMps: CONTAINER_MSC_PARAMS.CRUISE_SPEED,
  }
): { K: number; T: number } {
  // 确保装载率在有效范围内
  const t = clamp(loadRatio, 0, 1);

  // 线性插值: 空载 (t=0) → 满载 (t=1)
  // K: 从高灵敏度 (K_empty) 到低灵敏度 (K_full)
  const K = lerp(params.K_empty, params.K_full, t);

  // T: 从快响应 (T_empty) 到慢响应 (T_full)
  const T = lerp(params.T_empty, params.T_full, t);

  return { K, T };
}

/**
 * 计算货物质量
 */
export function getCargoMass(loadRatio: number): number {
  const minMass = CONTAINER_MSC_PARAMS.DISPLACEMENT_EMPTY;
  const maxMass = CONTAINER_MSC_PARAMS.DISPLACEMENT_FULL;
  return lerp(minMass, maxMass, clamp(loadRatio, 0, 1));
}

// ============ 状态初始化 ============

/**
 * 创建初始集装箱船状态
 */
export function createContainerShipState(
  loadRatio: number = 0.5,
  initialHeadingDeg: number = 0,
  initialX: number = 0,
  initialZ: number = 0
): ContainerShipState {
  const { K, T } = getVariableParams(loadRatio);

  return {
    // 基础 Nomoto 状态
    headingRad: toRadians(initialHeadingDeg),
    yawRateRad: 0,
    rudderDeg: 0,
    positionX: initialX,
    positionZ: initialZ,
    speedMps: CONTAINER_MSC_PARAMS.CRUISE_SPEED,

    // 集装箱船特有状态
    loadRatio,
    cargoMass: getCargoMass(loadRatio),
    currentK: K,
    currentT: T,

    // 风载荷状态
    windLoad: {
      force: 0,
      moment: 0,
      relativeDirection: 0,
    },

    // 横摇状态
    roll: {
      angle: 0,
      rate: 0,
    },
  };
}

// ============ 核心动力学 ============

/**
 * Nomoto 一阶方程右端函数
 *
 * T * ṙ + r = K * δ
 * => ṙ = (K * δ - r) / T
 */
function nomotoDerivative(
  yawRateRad: number,
  rudderRad: number,
  K: number,
  T: number
): number {
  return (K * rudderRad - yawRateRad) / T;
}

/**
 * 变质量 Nomoto 模型步进 (RK4 积分)
 *
 * @param state 当前状态
 * @param rudderDeg 目标舵角 (度)
 * @param dt 时间步长 (s)
 * @param externalMoment 外部力矩 (如风载荷) (N·m)
 */
export function nomotoVariableMassStep(
  state: ContainerShipState,
  rudderDeg: number,
  dt: number,
  externalMoment: number = 0
): ContainerShipState {
  const { currentK, currentT, loadRatio } = state;

  // 舵角限幅
  const limitedRudderDeg = clamp(
    rudderDeg,
    -CONTAINER_MSC_PARAMS.MAX_RUDDER_ANGLE,
    CONTAINER_MSC_PARAMS.MAX_RUDDER_ANGLE
  );
  const rudderRad = toRadians(limitedRudderDeg);

  // 计算外部力矩对角速度的影响
  // 简化处理: 将力矩转换为等效角加速度
  const momentOfInertia = lerp(
    CONTAINER_MSC_PARAMS.MOMENT_OF_INERTIA_EMPTY,
    CONTAINER_MSC_PARAMS.MOMENT_OF_INERTIA_FULL,
    loadRatio
  );
  const externalAngularAccel = externalMoment / momentOfInertia;

  // RK4 积分转艏角速度
  const r = state.yawRateRad;
  const k1 = nomotoDerivative(r, rudderRad, currentK, currentT) + externalAngularAccel;
  const k2 = nomotoDerivative(r + 0.5 * dt * k1, rudderRad, currentK, currentT) + externalAngularAccel;
  const k3 = nomotoDerivative(r + 0.5 * dt * k2, rudderRad, currentK, currentT) + externalAngularAccel;
  const k4 = nomotoDerivative(r + dt * k3, rudderRad, currentK, currentT) + externalAngularAccel;

  const newYawRateRad = r + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

  // 积分航向
  const newHeadingRad = state.headingRad + state.yawRateRad * dt;

  // 更新位置
  const speed = state.speedMps;
  const newPositionX = state.positionX + speed * Math.cos(state.headingRad) * dt;
  const newPositionZ = state.positionZ + speed * Math.sin(state.headingRad) * dt;

  return {
    ...state,
    headingRad: newHeadingRad,
    yawRateRad: newYawRateRad,
    rudderDeg: limitedRudderDeg,
    positionX: newPositionX,
    positionZ: newPositionZ,
  };
}

/**
 * 更新装载率 (运行时改变)
 */
export function updateLoadRatio(
  state: ContainerShipState,
  newLoadRatio: number
): ContainerShipState {
  const loadRatio = clamp(newLoadRatio, 0, 1);
  const { K, T } = getVariableParams(loadRatio);

  return {
    ...state,
    loadRatio,
    cargoMass: getCargoMass(loadRatio),
    currentK: K,
    currentT: T,
  };
}

// ============ 横摇动力学 ============

/**
 * 横摇动力学步进
 *
 * 简化二阶模型:
 *   J * φ̈ + B * φ̇ + K * φ = M_wind + M_rudder
 *
 * @param roll 当前横摇状态
 * @param windMoment 风致横摇力矩 (N·m)
 * @param yawRateRad 转艏角速度 (rad/s) - 影响横摇
 * @param loadRatio 装载率
 * @param dt 时间步长
 */
export function rollStep(
  roll: RollState,
  windMoment: number,
  yawRateRad: number,
  loadRatio: number,
  dt: number
): RollState {
  const { ROLL_NATURAL_FREQ, ROLL_DAMPING } = CONTAINER_MSC_PARAMS;

  // 计算横摇刚度和阻尼
  const omega_n = ROLL_NATURAL_FREQ;
  const zeta = ROLL_DAMPING;

  // 惯量随装载率变化
  const J = lerp(
    CONTAINER_MSC_PARAMS.MOMENT_OF_INERTIA_EMPTY * 0.3,  // 横摇惯量约为艏摇的 30%
    CONTAINER_MSC_PARAMS.MOMENT_OF_INERTIA_FULL * 0.3,
    loadRatio
  );

  // 恢复力矩系数
  const K_roll = J * omega_n * omega_n;
  // 阻尼系数
  const B_roll = 2 * zeta * omega_n * J;

  // 转向引起的横摇激励 (向心力)
  const turnExcitation = yawRateRad * CONTAINER_MSC_PARAMS.CRUISE_SPEED *
                         lerp(CONTAINER_MSC_PARAMS.MASS_EMPTY, CONTAINER_MSC_PARAMS.MASS_FULL, loadRatio) *
                         0.001;  // 缩放因子

  // 总激励力矩
  const excitation = windMoment * 0.5 + turnExcitation;  // 风对横摇的影响

  // 二阶振荡方程
  const accel = (excitation - B_roll * roll.rate - K_roll * roll.angle) / J;

  // 欧拉积分
  const newRate = roll.rate + accel * dt;
  const newAngle = roll.angle + roll.rate * dt;

  return {
    angle: newAngle,
    rate: newRate,
  };
}

// ============ 指标计算 ============

/**
 * 获取集装箱船状态摘要
 */
export function getContainerShipSummary(state: ContainerShipState): {
  headingDeg: number;
  yawRateDegPerSec: number;
  loadPercent: number;
  currentK: number;
  currentT: number;
  rollAngleDeg: number;
  isRollExcessive: boolean;
  isCargoShiftRisk: boolean;
} {
  const rollAngleDeg = toDegrees(Math.abs(state.roll.angle));

  return {
    headingDeg: toDegrees(state.headingRad),
    yawRateDegPerSec: toDegrees(state.yawRateRad),
    loadPercent: state.loadRatio * 100,
    currentK: state.currentK,
    currentT: state.currentT,
    rollAngleDeg,
    isRollExcessive: rollAngleDeg > CONTAINER_MSC_PARAMS.MAX_SAFE_ROLL,
    isCargoShiftRisk: rollAngleDeg > CONTAINER_MSC_PARAMS.CARGO_SHIFT_ROLL,
  };
}

/**
 * 检查横摇警报
 */
export function shouldTriggerRollAlarm(
  state: ContainerShipState,
  maxRollDeg: number = CONTAINER_MSC_PARAMS.MAX_SAFE_ROLL,
  cargoShiftDeg: number = CONTAINER_MSC_PARAMS.CARGO_SHIFT_ROLL
): {
  rollAlarm: boolean;
  cargoShiftAlarm: boolean;
  message: string | null;
} {
  const rollAngleDeg = toDegrees(Math.abs(state.roll.angle));
  const rollAlarm = rollAngleDeg > maxRollDeg;
  const cargoShiftAlarm = rollAngleDeg > cargoShiftDeg;

  let message: string | null = null;

  if (rollAlarm) {
    message = `危险: 横摇角 ${rollAngleDeg.toFixed(1)}° 超过安全限值 ${maxRollDeg}°，有落箱风险！`;
  } else if (cargoShiftAlarm) {
    message = `警告: 横摇角 ${rollAngleDeg.toFixed(1)}° 超过 ${cargoShiftDeg}°，货物可能移位`;
  }

  return { rollAlarm, cargoShiftAlarm, message };
}
