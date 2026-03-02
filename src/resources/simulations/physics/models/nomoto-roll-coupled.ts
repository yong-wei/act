/**
 * 横摇耦合 Nomoto 二阶模型
 * 用于邮轮等需要舒适度控制的船舶
 *
 * 航向动力学:
 *   T1*T2*r'' + (T1+T2)*r' + r = K*δ
 *
 * 横摇动力学:
 *   T_φ1*T_φ2*φ'' + (T_φ1+T_φ2)*φ' + φ = K_φ*(M_wave + M_fin)
 *
 * 其中:
 *   M_wave = 波浪激励力矩
 *   M_fin = 减摇鳍抗横摇力矩
 */

import type {
  RollCoupledNomotoParams,
  RollCoupledState,
} from '../../core/types';
import {
  clamp,
  toRadians,
  toDegrees,
  DEG_TO_RAD,
  RAD_TO_DEG,
  CRUISE_ADORA_PARAMS,
} from '../../core/constants';

// ============ 类型导出 ============

export type { RollCoupledNomotoParams, RollCoupledState };

// ============ 默认参数 ============

/** 邮轮默认横摇耦合 Nomoto 参数 */
export const DEFAULT_ROLL_COUPLED_PARAMS: RollCoupledNomotoParams = {
  // 航向动力学
  K: CRUISE_ADORA_PARAMS.K,
  T1: CRUISE_ADORA_PARAMS.T1,
  T2: CRUISE_ADORA_PARAMS.T2,

  // 横摇动力学
  K_phi: CRUISE_ADORA_PARAMS.K_PHI,
  T_phi1: CRUISE_ADORA_PARAMS.T_PHI1,
  T_phi2: CRUISE_ADORA_PARAMS.T_PHI2,
  naturalRollPeriod: CRUISE_ADORA_PARAMS.NATURAL_ROLL_PERIOD,
  rollDamping: CRUISE_ADORA_PARAMS.ROLL_DAMPING,

  // 限制
  maxRudderDeg: CRUISE_ADORA_PARAMS.MAX_RUDDER_ANGLE,
  speedMps: CRUISE_ADORA_PARAMS.CRUISE_SPEED,
};

// ============ 状态初始化 ============

/**
 * 创建初始状态
 */
export function createRollCoupledState(
  startX: number = 0,
  startZ: number = 0,
  startHeadingDeg: number = 0,
  speedMps: number = DEFAULT_ROLL_COUPLED_PARAMS.speedMps
): RollCoupledState {
  return {
    // 航向状态
    headingRad: toRadians(startHeadingDeg),
    yawRateRad: 0,
    yawAccelRad: 0,

    // 横摇状态
    rollRad: 0,
    rollRateRad: 0,

    // 位置与速度
    positionX: startX,
    positionZ: startZ,
    speedMps,

    // 控制输入
    rudderDeg: 0,
    finAngleDeg: 0,
  };
}

// ============ 波浪激励模型 ============

/**
 * 计算波浪激励的横摇力矩
 * 基于海况等级和波浪频率
 */
export function computeWaveExcitation(
  time: number,
  seaStateLevel: number,
  waveDirection: number = 90,  // 相对船艏的波向 (°)
  shipHeading: number = 0
): number {
  // 基础波浪幅度 (与海况等级相关)
  const baseAmplitude = 0.2 * Math.pow(seaStateLevel, 1.35);  // rad，增强高海况分辨率

  // 主要波浪频率成分 (致晕频段 0.1-0.3 Hz)
  const freq1 = 0.12;  // Hz (周期 ~8.3s)
  const freq2 = 0.18;  // Hz (周期 ~5.5s)
  const freq3 = 0.25;  // Hz (周期 ~4s)

  // 相对波向角 (横浪最大)
  const relativeAngle = toRadians(waveDirection);
  const directionFactor = 0.25 + 0.75 * Math.abs(Math.sin(relativeAngle));

  // 多频率叠加
  const omega1 = 2 * Math.PI * freq1;
  const omega2 = 2 * Math.PI * freq2;
  const omega3 = 2 * Math.PI * freq3;

  const excitation =
    baseAmplitude *
    directionFactor *
    (0.5 * Math.sin(omega1 * time) +
      0.3 * Math.sin(omega2 * time + 0.5) +
      0.2 * Math.sin(omega3 * time + 1.2));

  return excitation;
}

// ============ 核心物理步进 ============

/**
 * 航向动力学微分方程 (Nomoto 二阶)
 *
 * T1*T2*r'' + (T1+T2)*r' + r = K*δ
 *
 * 状态空间:
 *   x1 = r (艏摇角速度)
 *   x2 = r' (艏摇角加速度)
 *
 *   x1' = x2
 *   x2' = (K*δ - x1 - (T1+T2)*x2) / (T1*T2)
 */
function headingDerivatives(
  yawRate: number,
  yawAccel: number,
  rudderRad: number,
  params: RollCoupledNomotoParams
): { dYawRate: number; dYawAccel: number } {
  const { K, T1, T2 } = params;

  const dYawRate = yawAccel;
  const dYawAccel = (K * rudderRad - yawRate - (T1 + T2) * yawAccel) / (T1 * T2);

  return { dYawRate, dYawAccel };
}

/**
 * 横摇动力学微分方程
 *
 * T_φ1*T_φ2*φ'' + (T_φ1+T_φ2)*φ' + φ = K_φ*(M_wave + M_fin)
 *
 * 状态空间:
 *   y1 = φ (横摇角)
 *   y2 = φ' (横摇角速度)
 *
 *   y1' = y2
 *   y2' = (K_φ*M - y1 - (T_φ1+T_φ2)*y2) / (T_φ1*T_φ2)
 *
 * 其中 M = M_wave + M_fin (归一化力矩)
 */
function rollDerivatives(
  rollAngle: number,
  rollRate: number,
  waveExcitation: number,
  finMoment: number,
  turningExcitation: number,
  params: RollCoupledNomotoParams
): { dRollAngle: number; dRollRate: number } {
  const { K_phi, T_phi1, T_phi2 } = params;

  // 总力矩 (波浪激励 + 转向横倾激励 - 减摇鳍力矩)
  const totalMoment = waveExcitation + turningExcitation - finMoment;

  const dRollAngle = rollRate;
  const dRollRate =
    (K_phi * totalMoment - rollAngle - (T_phi1 + T_phi2) * rollRate) /
    (T_phi1 * T_phi2);

  return { dRollAngle, dRollRate };
}

/**
 * 横摇耦合 Nomoto 模型步进 (RK4 积分)
 *
 * @param state 当前状态
 * @param rudderDeg 舵角指令 (°)
 * @param finMomentNormalized 减摇鳍归一化力矩输入 (无量纲)
 * @param waveExcitation 波浪激励 (rad)
 * @param dt 时间步长 (s)
 * @param params 模型参数
 */
export function rollCoupledNomotoStep(
  state: RollCoupledState,
  rudderDeg: number,
  finMomentNormalized: number,
  waveExcitation: number,
  dt: number,
  params: RollCoupledNomotoParams = DEFAULT_ROLL_COUPLED_PARAMS,
  turningExcitation: number = 0
): RollCoupledState {
  // 限制舵角
  const clampedRudder = clamp(rudderDeg, -params.maxRudderDeg, params.maxRudderDeg);
  const rudderRad = toRadians(clampedRudder);

  // 减摇鳍归一化力矩直接参与横摇动力学
  const finMoment = finMomentNormalized;

  // 当前状态
  const { yawRateRad, yawAccelRad, rollRad, rollRateRad } = state;

  // ============ RK4 积分航向动力学 ============
  const hk1 = headingDerivatives(yawRateRad, yawAccelRad, rudderRad, params);
  const hk2 = headingDerivatives(
    yawRateRad + 0.5 * dt * hk1.dYawRate,
    yawAccelRad + 0.5 * dt * hk1.dYawAccel,
    rudderRad,
    params
  );
  const hk3 = headingDerivatives(
    yawRateRad + 0.5 * dt * hk2.dYawRate,
    yawAccelRad + 0.5 * dt * hk2.dYawAccel,
    rudderRad,
    params
  );
  const hk4 = headingDerivatives(
    yawRateRad + dt * hk3.dYawRate,
    yawAccelRad + dt * hk3.dYawAccel,
    rudderRad,
    params
  );

  const newYawRate =
    yawRateRad +
    (dt / 6) * (hk1.dYawRate + 2 * hk2.dYawRate + 2 * hk3.dYawRate + hk4.dYawRate);
  const newYawAccel =
    yawAccelRad +
    (dt / 6) * (hk1.dYawAccel + 2 * hk2.dYawAccel + 2 * hk3.dYawAccel + hk4.dYawAccel);

  // ============ RK4 积分横摇动力学 ============
  const rk1 = rollDerivatives(rollRad, rollRateRad, waveExcitation, finMoment, turningExcitation, params);
  const rk2 = rollDerivatives(
    rollRad + 0.5 * dt * rk1.dRollAngle,
    rollRateRad + 0.5 * dt * rk1.dRollRate,
    waveExcitation,
    finMoment,
    turningExcitation,
    params
  );
  const rk3 = rollDerivatives(
    rollRad + 0.5 * dt * rk2.dRollAngle,
    rollRateRad + 0.5 * dt * rk2.dRollRate,
    waveExcitation,
    finMoment,
    turningExcitation,
    params
  );
  const rk4 = rollDerivatives(
    rollRad + dt * rk3.dRollAngle,
    rollRateRad + dt * rk3.dRollRate,
    waveExcitation,
    finMoment,
    turningExcitation,
    params
  );

  const newRollAngle =
    rollRad +
    (dt / 6) *
      (rk1.dRollAngle + 2 * rk2.dRollAngle + 2 * rk3.dRollAngle + rk4.dRollAngle);
  const newRollRate =
    rollRateRad +
    (dt / 6) * (rk1.dRollRate + 2 * rk2.dRollRate + 2 * rk3.dRollRate + rk4.dRollRate);

  // 更新航向
  const newHeading = state.headingRad + newYawRate * dt;

  // 更新位置
  const speed = state.speedMps;
  const newX = state.positionX + speed * Math.cos(newHeading) * dt;
  const newZ = state.positionZ + speed * Math.sin(newHeading) * dt;

  return {
    headingRad: newHeading,
    yawRateRad: newYawRate,
    yawAccelRad: newYawAccel,
    rollRad: newRollAngle,
    rollRateRad: newRollRate,
    positionX: newX,
    positionZ: newZ,
    speedMps: speed,
    rudderDeg: clampedRudder,
    finAngleDeg: state.finAngleDeg,
  };
}

// ============ 状态转换 ============

/**
 * 将横摇耦合状态转换为显示用角度
 */
export function rollCoupledStateToDisplay(state: RollCoupledState): {
  headingDeg: number;
  yawRateDeg: number;
  rollDeg: number;
  rollRateDeg: number;
} {
  return {
    headingDeg: toDegrees(state.headingRad),
    yawRateDeg: toDegrees(state.yawRateRad),
    rollDeg: toDegrees(state.rollRad),
    rollRateDeg: toDegrees(state.rollRateRad),
  };
}

// ============ 稳态特性 ============

/**
 * 计算稳态特性
 */
export function getRollCoupledSteadyState(
  rudderDeg: number,
  params: RollCoupledNomotoParams = DEFAULT_ROLL_COUPLED_PARAMS
): {
  steadyYawRate: number;        // 稳态转艏角速度 (°/s)
  turningRadius: number;        // 回旋半径 (m)
  timeToSteadyState: number;    // 航向调节时间 (s)
  rollTimeConstant: number;     // 横摇时间常数 (s)
} {
  const rudderRad = toRadians(rudderDeg);

  // 稳态转艏角速度
  const steadyYawRateRad = params.K * rudderRad;
  const steadyYawRate = toDegrees(steadyYawRateRad);

  // 回旋半径
  const turningRadius =
    Math.abs(steadyYawRateRad) > 1e-6
      ? params.speedMps / Math.abs(steadyYawRateRad)
      : Infinity;

  // 航向调节时间
  const timeToSteadyState = 4 * Math.max(params.T1, params.T2);

  // 横摇时间常数
  const rollTimeConstant = Math.max(params.T_phi1, params.T_phi2);

  return {
    steadyYawRate,
    turningRadius,
    timeToSteadyState,
    rollTimeConstant,
  };
}

// ============ 减摇鳍控制 ============

/**
 * 简单的减摇鳍 P 控制
 * 根据横摇角速度生成反向力矩
 */
export function simpleFinControl(
  rollRateDeg: number,
  maxFinAngle: number = 25,
  gain: number = 2.0
): number {
  // P 控制: 鳍角 = -gain * 横摇角速度
  const finAngle = -gain * rollRateDeg;
  return clamp(finAngle, -maxFinAngle, maxFinAngle);
}

/**
 * 高级减摇鳍 PD 控制
 */
export function advancedFinControl(
  rollDeg: number,
  rollRateDeg: number,
  maxFinAngle: number = 25,
  kp: number = 1.0,
  kd: number = 2.0
): number {
  // PD 控制: 鳍角 = -kp*φ - kd*φ'
  const finAngle = -kp * rollDeg - kd * rollRateDeg;
  return clamp(finAngle, -maxFinAngle, maxFinAngle);
}
