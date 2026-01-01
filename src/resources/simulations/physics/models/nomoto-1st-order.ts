/**
 * Nomoto 一阶船舶操纵模型
 * 线性化模型，适用于小舵角、低速机动
 *
 * 方程: T * dr/dt + r = K * delta
 * 其中: r = 转艏角速度, delta = 舵角
 */

import type { NomotoParams, NomotoState, PIDGains, ControlMode } from '../../core/types';

// 重新导出类型
export type { NomotoState } from '../../core/types';
import {
  DEFAULT_NOMOTO_PARAMS,
  clamp,
  toRadians,
  toDegrees,
  angleDelta,
} from '../../core/constants';

// ============ 状态初始化 ============

/** 创建初始 Nomoto 状态 */
export function createNomotoState(
  x: number = 0,
  z: number = 0,
  headingDeg: number = 0,
  speedMps: number = DEFAULT_NOMOTO_PARAMS.speedMps
): NomotoState {
  return {
    headingRad: toRadians(headingDeg),
    yawRateRad: 0,
    rudderDeg: 0,
    positionX: x,
    positionZ: z,
    speedMps,
  };
}

// ============ 核心步进函数 ============

/**
 * Nomoto 一阶模型步进
 * 使用欧拉法积分
 */
export function nomotoStep(
  state: NomotoState,
  rudderDeg: number,
  dt: number,
  params: NomotoParams = DEFAULT_NOMOTO_PARAMS
): NomotoState {
  // 舵角限幅
  const clampedRudder = clamp(rudderDeg, -params.maxRudderDeg, params.maxRudderDeg);
  const rudderRad = toRadians(clampedRudder);

  // Nomoto 一阶方程: T * dr/dt = K * delta - r
  // => dr/dt = (K * delta - r) / T
  const dYawRate = (params.K * rudderRad - state.yawRateRad) / params.T;

  // 更新转向角速度
  const newYawRateRad = state.yawRateRad + dYawRate * dt;

  // 更新航向角
  const newHeadingRad = state.headingRad + newYawRateRad * dt;

  // 更新位置 (假设速度沿航向)
  const newPositionX = state.positionX + state.speedMps * Math.cos(newHeadingRad) * dt;
  const newPositionZ = state.positionZ + state.speedMps * Math.sin(newHeadingRad) * dt;

  return {
    headingRad: newHeadingRad,
    yawRateRad: newYawRateRad,
    rudderDeg: clampedRudder,
    positionX: newPositionX,
    positionZ: newPositionZ,
    speedMps: state.speedMps,
  };
}

/**
 * Nomoto 一阶模型步进 (RK4 积分)
 * 更高精度的数值积分
 */
export function nomotoStepRK4(
  state: NomotoState,
  rudderDeg: number,
  dt: number,
  params: NomotoParams = DEFAULT_NOMOTO_PARAMS
): NomotoState {
  // 舵角限幅
  const clampedRudder = clamp(rudderDeg, -params.maxRudderDeg, params.maxRudderDeg);
  const rudderRad = toRadians(clampedRudder);

  // 状态向量 [headingRad, yawRateRad, positionX, positionZ]
  const y = [state.headingRad, state.yawRateRad, state.positionX, state.positionZ];

  // 导数函数
  const derivatives = (s: number[]): number[] => {
    const heading = s[0];
    const yawRate = s[1];
    const dYawRate = (params.K * rudderRad - yawRate) / params.T;
    const dHeading = yawRate;
    const dX = state.speedMps * Math.cos(heading);
    const dZ = state.speedMps * Math.sin(heading);
    return [dHeading, dYawRate, dX, dZ];
  };

  // RK4 步骤
  const k1 = derivatives(y);
  const k2 = derivatives(y.map((v, i) => v + 0.5 * dt * k1[i]));
  const k3 = derivatives(y.map((v, i) => v + 0.5 * dt * k2[i]));
  const k4 = derivatives(y.map((v, i) => v + dt * k3[i]));

  // 更新状态
  const newY = y.map((v, i) =>
    v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  );

  return {
    headingRad: newY[0],
    yawRateRad: newY[1],
    positionX: newY[2],
    positionZ: newY[3],
    rudderDeg: clampedRudder,
    speedMps: state.speedMps,
  };
}

// ============ PID 控制器 ============

export interface PIDControllerState {
  integral: number;
  prevError: number;
}

/** 创建初始 PID 状态 */
export function createPIDState(): PIDControllerState {
  return { integral: 0, prevError: 0 };
}

/**
 * PID 控制器计算
 */
export function pidControl(
  targetHeading: number,
  currentHeading: number,
  pidState: PIDControllerState,
  gains: PIDGains,
  controlMode: ControlMode,
  dt: number,
  maxRudderDeg: number = DEFAULT_NOMOTO_PARAMS.maxRudderDeg
): { rudderDeg: number; newPidState: PIDControllerState } {
  if (controlMode === 'manual' || controlMode === 'dp' || controlMode === 'autopilot') {
    return { rudderDeg: 0, newPidState: pidState };
  }

  // 计算误差（考虑角度环绕）
  const errorDeg = angleDelta(targetHeading, currentHeading);
  const errorRad = toRadians(errorDeg);

  // 微分项 (带滤波)
  const derivative = (errorRad - pidState.prevError) / dt;

  // 积分项 (带抗饱和)
  let newIntegral = pidState.integral + errorRad * dt;

  // 积分限幅 (抗饱和)
  const integralLimit = toRadians(maxRudderDeg) / gains.ki;
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
  const rudderDeg = clamp(toDegrees(outputRad), -maxRudderDeg, maxRudderDeg);

  return {
    rudderDeg,
    newPidState: {
      integral: newIntegral,
      prevError: errorRad,
    },
  };
}

// ============ 工具函数 ============

/**
 * 获取 Nomoto 模型的稳态转向特性
 * 稳态时: r_ss = K * delta
 * 稳态回转半径: R = V / r_ss = V / (K * delta)
 */
export function getSteadyStateCharacteristics(
  rudderDeg: number,
  params: NomotoParams = DEFAULT_NOMOTO_PARAMS
): {
  steadyYawRate: number;    // 稳态转艏角速度 (rad/s)
  turningRadius: number;    // 回转半径 (m)
  timeToSteadyState: number; // 达到稳态所需时间 (s) ≈ 3T
} {
  const rudderRad = toRadians(rudderDeg);
  const steadyYawRate = params.K * rudderRad;
  const turningRadius = Math.abs(rudderDeg) > 0.1
    ? Math.abs(params.speedMps / steadyYawRate)
    : Infinity;

  return {
    steadyYawRate,
    turningRadius,
    timeToSteadyState: 3 * params.T,
  };
}

/**
 * 计算从 Nomoto 状态到通用仿真状态的转换
 */
export function nomotoToSimulationState(
  nomoto: NomotoState,
  time: number
): {
  position: { x: number; z: number };
  heading: number;
  headingRad: number;
  yawRate: number;
  yawRateRad: number;
  rudder: number;
  speed: number;
  time: number;
} {
  return {
    position: { x: nomoto.positionX, z: nomoto.positionZ },
    heading: toDegrees(nomoto.headingRad),
    headingRad: nomoto.headingRad,
    yawRate: toDegrees(nomoto.yawRateRad),
    yawRateRad: nomoto.yawRateRad,
    rudder: nomoto.rudderDeg,
    speed: nomoto.speedMps,
    time,
  };
}
