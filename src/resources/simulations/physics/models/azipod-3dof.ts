/**
 * Azipod 3DOF 动力学模型
 * 适用于吊舱推进器船舶 (如破冰船、邮轮等)
 *
 * 状态向量: [x, y, ψ, u, v, r, α₁, α₂]
 * - x, y: 位置 (m)
 * - ψ: 艏向角 (rad)
 * - u: 纵向速度 (m/s)
 * - v: 横向速度 (m/s)
 * - r: 艏摇角速度 (rad/s)
 * - α₁, α₂: Azipod 方位角 (rad)
 */

import {
  XUELONG_ICEBREAKER_PARAMS,
  XUELONG_AZIPOD_PARAMS,
  DEG_TO_RAD,
  RAD_TO_DEG,
  clamp,
  normalizeSignedHeading,
} from '../../core/constants';
import type { AzipodConfig, AzipodState, Azipod3DOFState, Vector2 } from '../../core/types';

// ============ 类型定义 ============

/** Azipod 3DOF 模型内部状态 */
export interface Azipod3DOFInternalState {
  // 位置和姿态
  x: number;           // 纵向位置 (m)
  y: number;           // 横向位置 (m)
  psi: number;         // 艏向角 (rad)

  // 速度
  u: number;           // 纵向速度 (m/s)
  v: number;           // 横向速度 (m/s)
  r: number;           // 艏摇角速度 (rad/s)

  // Azipod 状态
  azipod1: AzipodInternalState;
  azipod2: AzipodInternalState;

  // 冰阻力相关
  iceResistanceForce: number;  // 当前冰阻力 (N)
  perturbedK: number;          // 当前K摄动值
  perturbedT: number;          // 当前T摄动值

  // 时间
  time: number;
}

/** 单个 Azipod 内部状态 */
interface AzipodInternalState {
  id: number;
  azimuth: number;         // 当前方位角 (rad)
  azimuthCmd: number;      // 命令方位角 (rad)
  thrust: number;          // 当前推力 (N)
  thrustCmd: number;       // 命令推力 (N)
  power: number;           // 当前功率 (W)
  slewRate: number;        // 当前回转速率 (rad/s)
  enabled: boolean;
}

/** Azipod 3DOF 模型参数 */
export interface Azipod3DOFParams {
  // 质量和惯性
  mass: number;            // 船舶质量 (kg)
  addedMassX: number;      // 纵向附加质量系数
  addedMassY: number;      // 横向附加质量系数
  inertiaZ: number;        // 艏摇转动惯量 (kg·m²)
  addedInertiaZ: number;   // 附加惯性系数

  // 阻尼
  dampingU: number;        // 纵向阻尼 N/(m/s)
  dampingV: number;        // 横向阻尼 N/(m/s)
  dampingR: number;        // 艏摇阻尼 N·m/(rad/s)

  // Azipod 布局
  azipods: AzipodConfig[];

  // 约束
  maxSlewRate: number;     // 最大回转速率 (rad/s)
  maxThrust: number;       // 单吊舱最大推力 (N)
}

// ============ 默认参数 ============

/** 雪龙号默认 Azipod 3DOF 参数 */
export const DEFAULT_AZIPOD_3DOF_PARAMS: Azipod3DOFParams = {
  mass: XUELONG_ICEBREAKER_PARAMS.MASS,
  addedMassX: XUELONG_ICEBREAKER_PARAMS.ADDED_MASS_X,
  addedMassY: XUELONG_ICEBREAKER_PARAMS.ADDED_MASS_Y,
  inertiaZ: XUELONG_ICEBREAKER_PARAMS.INERTIA_Z,
  addedInertiaZ: XUELONG_ICEBREAKER_PARAMS.ADDED_INERTIA_Z,
  dampingU: XUELONG_ICEBREAKER_PARAMS.DAMPING_U,
  dampingV: XUELONG_ICEBREAKER_PARAMS.DAMPING_V,
  dampingR: XUELONG_ICEBREAKER_PARAMS.DAMPING_R,
  azipods: [
    {
      id: 1,
      positionX: -55,    // 船尾
      positionY: 5,      // 左侧
      maxThrust: 7500000, // 7500 kN → N
      maxPower: 7500000,  // 7500 kW → W
      maxSlewRate: 12 * DEG_TO_RAD,
    },
    {
      id: 2,
      positionX: -55,
      positionY: -5,     // 右侧
      maxThrust: 7500000,
      maxPower: 7500000,
      maxSlewRate: 12 * DEG_TO_RAD,
    },
  ],
  maxSlewRate: XUELONG_AZIPOD_PARAMS.MAX_SLEW_RATE * DEG_TO_RAD,
  maxThrust: XUELONG_AZIPOD_PARAMS.MAX_SINGLE_THRUST * 1000, // kN → N
};

// ============ 状态创建 ============

/** 创建初始 Azipod 3DOF 状态 */
export function createAzipod3DOFState(
  x: number = 0,
  y: number = 0,
  psi: number = 0,
  params: Azipod3DOFParams = DEFAULT_AZIPOD_3DOF_PARAMS
): Azipod3DOFInternalState {
  return {
    x,
    y,
    psi,
    u: 0,
    v: 0,
    r: 0,
    azipod1: createAzipodState(params.azipods[0]),
    azipod2: createAzipodState(params.azipods[1]),
    iceResistanceForce: 0,
    perturbedK: 1.0,
    perturbedT: 1.0,
    time: 0,
  };
}

/** 创建单个 Azipod 初始状态 */
function createAzipodState(config: AzipodConfig): AzipodInternalState {
  return {
    id: config.id,
    azimuth: 0,
    azimuthCmd: 0,
    thrust: 0,
    thrustCmd: 0,
    power: 0,
    slewRate: 0,
    enabled: true,
  };
}

// ============ 推力计算 ============

/** 计算单个 Azipod 产生的力和力矩 */
function computeAzipodForces(
  azipod: AzipodInternalState,
  config: AzipodConfig
): { fx: number; fy: number; mz: number } {
  const T = azipod.thrust;
  const alpha = azipod.azimuth;

  // 推力分解
  const fx = T * Math.cos(alpha);  // 纵向力
  const fy = T * Math.sin(alpha);  // 横向力

  // 力矩 (绕船体中心)
  const mz = -config.positionX * fy + config.positionY * fx;

  return { fx, fy, mz };
}

/** 计算总推力和力矩 */
function computeTotalForces(
  state: Azipod3DOFInternalState,
  params: Azipod3DOFParams,
  iceResistance: number = 0
): { Fx: number; Fy: number; Mz: number } {
  // Azipod 1 贡献
  const forces1 = computeAzipodForces(state.azipod1, params.azipods[0]);
  // Azipod 2 贡献
  const forces2 = computeAzipodForces(state.azipod2, params.azipods[1]);

  // 船体阻尼力
  const Fx_damping = -params.dampingU * state.u;
  const Fy_damping = -params.dampingV * state.v;
  const Mz_damping = -params.dampingR * state.r;

  // 冰阻力 (仅作用于纵向)
  const Fx_ice = -iceResistance;

  return {
    Fx: forces1.fx + forces2.fx + Fx_damping + Fx_ice,
    Fy: forces1.fy + forces2.fy + Fy_damping,
    Mz: forces1.mz + forces2.mz + Mz_damping,
  };
}

// ============ Azipod 动态 ============

/** 更新 Azipod 方位角 (带回转速率限制) */
function updateAzipodAzimuth(
  azipod: AzipodInternalState,
  config: AzipodConfig,
  dt: number
): AzipodInternalState {
  if (!azipod.enabled) return azipod;

  // 计算期望回转速率
  const azimuthError = azipod.azimuthCmd - azipod.azimuth;
  let desiredSlewRate = azimuthError / dt;

  // 应用回转速率限制 (关键约束!)
  const maxSlew = config.maxSlewRate;
  desiredSlewRate = clamp(desiredSlewRate, -maxSlew, maxSlew);

  // 更新方位角
  const newAzimuth = azipod.azimuth + desiredSlewRate * dt;

  // 归一化到 [-π, π]
  const normalizedAzimuth = Math.atan2(Math.sin(newAzimuth), Math.cos(newAzimuth));

  return {
    ...azipod,
    azimuth: normalizedAzimuth,
    slewRate: desiredSlewRate,
  };
}

/** 更新 Azipod 推力 (带响应时间) */
function updateAzipodThrust(
  azipod: AzipodInternalState,
  config: AzipodConfig,
  dt: number
): AzipodInternalState {
  if (!azipod.enabled) {
    return { ...azipod, thrust: 0, power: 0 };
  }

  // 推力响应 (一阶滞后)
  const timeConstant = XUELONG_AZIPOD_PARAMS.THRUST_TIME_CONSTANT;
  const alpha = dt / (timeConstant + dt);
  const newThrust = azipod.thrust + alpha * (azipod.thrustCmd - azipod.thrust);

  // 限制推力
  const clampedThrust = clamp(newThrust, 0, config.maxThrust);

  // 计算功率 (简化模型: P ∝ T^1.5)
  const power = Math.pow(clampedThrust / config.maxThrust, 1.5) * config.maxPower;

  return {
    ...azipod,
    thrust: clampedThrust,
    power,
  };
}

// ============ 运动学积分 ============

/** 使用 RK4 进行动力学积分 */
export function azipod3dofStepRK4(
  state: Azipod3DOFInternalState,
  params: Azipod3DOFParams,
  iceResistance: number,
  dt: number
): Azipod3DOFInternalState {
  // 更新 Azipod 状态
  const azipod1 = updateAzipodThrust(
    updateAzipodAzimuth(state.azipod1, params.azipods[0], dt),
    params.azipods[0],
    dt
  );
  const azipod2 = updateAzipodThrust(
    updateAzipodAzimuth(state.azipod2, params.azipods[1], dt),
    params.azipods[1],
    dt
  );

  // 临时状态用于 RK4
  const tempState = { ...state, azipod1, azipod2 };

  // 计算质量矩阵
  const m11 = params.mass * (1 + params.addedMassX);
  const m22 = params.mass * (1 + params.addedMassY);
  const m33 = params.inertiaZ * (1 + params.addedInertiaZ);

  // 导数计算函数
  const derivatives = (s: typeof tempState) => {
    const forces = computeTotalForces(s, params, iceResistance);

    // 加速度 (含科氏力项)
    const du = (forces.Fx + m22 * s.v * s.r) / m11;
    const dv = (forces.Fy - m11 * s.u * s.r) / m22;
    const dr = forces.Mz / m33;

    // 位置导数 (转换到全局坐标)
    const cosPsi = Math.cos(s.psi);
    const sinPsi = Math.sin(s.psi);
    const dx = s.u * cosPsi - s.v * sinPsi;
    const dy = s.u * sinPsi + s.v * cosPsi;
    const dpsi = s.r;

    return { dx, dy, dpsi, du, dv, dr };
  };

  // RK4 积分
  const k1 = derivatives(tempState);

  const s2 = {
    ...tempState,
    x: tempState.x + k1.dx * dt / 2,
    y: tempState.y + k1.dy * dt / 2,
    psi: tempState.psi + k1.dpsi * dt / 2,
    u: tempState.u + k1.du * dt / 2,
    v: tempState.v + k1.dv * dt / 2,
    r: tempState.r + k1.dr * dt / 2,
  };
  const k2 = derivatives(s2);

  const s3 = {
    ...tempState,
    x: tempState.x + k2.dx * dt / 2,
    y: tempState.y + k2.dy * dt / 2,
    psi: tempState.psi + k2.dpsi * dt / 2,
    u: tempState.u + k2.du * dt / 2,
    v: tempState.v + k2.dv * dt / 2,
    r: tempState.r + k2.dr * dt / 2,
  };
  const k3 = derivatives(s3);

  const s4 = {
    ...tempState,
    x: tempState.x + k3.dx * dt,
    y: tempState.y + k3.dy * dt,
    psi: tempState.psi + k3.dpsi * dt,
    u: tempState.u + k3.du * dt,
    v: tempState.v + k3.dv * dt,
    r: tempState.r + k3.dr * dt,
  };
  const k4 = derivatives(s4);

  // 合成
  return {
    ...tempState,
    x: tempState.x + (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx) * dt / 6,
    y: tempState.y + (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy) * dt / 6,
    psi: tempState.psi + (k1.dpsi + 2 * k2.dpsi + 2 * k3.dpsi + k4.dpsi) * dt / 6,
    u: tempState.u + (k1.du + 2 * k2.du + 2 * k3.du + k4.du) * dt / 6,
    v: tempState.v + (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv) * dt / 6,
    r: tempState.r + (k1.dr + 2 * k2.dr + 2 * k3.dr + k4.dr) * dt / 6,
    azipod1,
    azipod2,
    iceResistanceForce: iceResistance,
    time: state.time + dt,
  };
}

// ============ 简化步进 (欧拉法) ============

/** 使用欧拉法进行动力学积分 */
export function azipod3dofStep(
  state: Azipod3DOFInternalState,
  params: Azipod3DOFParams,
  iceResistance: number,
  dt: number
): Azipod3DOFInternalState {
  // 更新 Azipod 状态
  const azipod1 = updateAzipodThrust(
    updateAzipodAzimuth(state.azipod1, params.azipods[0], dt),
    params.azipods[0],
    dt
  );
  const azipod2 = updateAzipodThrust(
    updateAzipodAzimuth(state.azipod2, params.azipods[1], dt),
    params.azipods[1],
    dt
  );

  const tempState = { ...state, azipod1, azipod2 };

  // 计算力和力矩
  const forces = computeTotalForces(tempState, params, iceResistance);

  // 质量矩阵
  const m11 = params.mass * (1 + params.addedMassX);
  const m22 = params.mass * (1 + params.addedMassY);
  const m33 = params.inertiaZ * (1 + params.addedInertiaZ);

  // 加速度 (含科氏力)
  const du = (forces.Fx + m22 * state.v * state.r) / m11;
  const dv = (forces.Fy - m11 * state.u * state.r) / m22;
  const dr = forces.Mz / m33;

  // 更新速度
  const u = state.u + du * dt;
  const v = state.v + dv * dt;
  const r = state.r + dr * dt;

  // 更新位置 (转换到全局坐标)
  const cosPsi = Math.cos(state.psi);
  const sinPsi = Math.sin(state.psi);
  const x = state.x + (state.u * cosPsi - state.v * sinPsi) * dt;
  const y = state.y + (state.u * sinPsi + state.v * cosPsi) * dt;
  const psi = state.psi + state.r * dt;

  return {
    ...tempState,
    x,
    y,
    psi,
    u,
    v,
    r,
    iceResistanceForce: iceResistance,
    time: state.time + dt,
  };
}

// ============ 状态转换 ============

/** 转换为外部接口状态 */
export function azipod3dofToExternalState(
  state: Azipod3DOFInternalState,
  targetHeading: number
): Azipod3DOFState {
  const headingDeg = state.psi * RAD_TO_DEG;
  const headingError = normalizeSignedHeading(targetHeading - headingDeg);

  return {
    x: state.x,
    y: state.y,
    psi: state.psi,
    u: state.u,
    v: state.v,
    r: state.r,
    azipods: [
      {
        id: state.azipod1.id,
        azimuth: state.azipod1.azimuth * RAD_TO_DEG,
        azimuthCmd: state.azipod1.azimuthCmd * RAD_TO_DEG,
        thrust: state.azipod1.thrust / 1000, // N → kN
        thrustCmd: state.azipod1.thrustCmd / 1000,
        power: state.azipod1.power / 1000, // W → kW
        slewRate: state.azipod1.slewRate * RAD_TO_DEG,
        enabled: state.azipod1.enabled,
      },
      {
        id: state.azipod2.id,
        azimuth: state.azipod2.azimuth * RAD_TO_DEG,
        azimuthCmd: state.azipod2.azimuthCmd * RAD_TO_DEG,
        thrust: state.azipod2.thrust / 1000,
        thrustCmd: state.azipod2.thrustCmd / 1000,
        power: state.azipod2.power / 1000,
        slewRate: state.azipod2.slewRate * RAD_TO_DEG,
        enabled: state.azipod2.enabled,
      },
    ],
    iceContact: state.iceResistanceForce > 0,
    iceResistance: state.iceResistanceForce / 1000, // N → kN
    perturbedK: state.perturbedK,
    perturbedT: state.perturbedT,
    targetHeading,
    headingError,
  };
}

/** 设置 Azipod 命令 */
export function setAzipodCommands(
  state: Azipod3DOFInternalState,
  azimuthCmd1: number,  // 弧度
  azimuthCmd2: number,
  thrustCmd1: number,   // N
  thrustCmd2: number
): Azipod3DOFInternalState {
  return {
    ...state,
    azipod1: {
      ...state.azipod1,
      azimuthCmd: azimuthCmd1,
      thrustCmd: thrustCmd1,
    },
    azipod2: {
      ...state.azipod2,
      azimuthCmd: azimuthCmd2,
      thrustCmd: thrustCmd2,
    },
  };
}

/** 设置冰阻力摄动参数 */
export function setIcePerturbation(
  state: Azipod3DOFInternalState,
  perturbedK: number,
  perturbedT: number
): Azipod3DOFInternalState {
  return {
    ...state,
    perturbedK,
    perturbedT,
  };
}

/** 禁用指定 Azipod (故障模拟) */
export function disableAzipod(
  state: Azipod3DOFInternalState,
  azipodId: number
): Azipod3DOFInternalState {
  if (azipodId === 1) {
    return {
      ...state,
      azipod1: { ...state.azipod1, enabled: false, thrust: 0, power: 0 },
    };
  } else {
    return {
      ...state,
      azipod2: { ...state.azipod2, enabled: false, thrust: 0, power: 0 },
    };
  }
}

/** 获取总速度 */
export function getTotalSpeed(state: Azipod3DOFInternalState): number {
  return Math.sqrt(state.u * state.u + state.v * state.v);
}

/** 获取航向角 (度) */
export function getHeadingDeg(state: Azipod3DOFInternalState): number {
  return state.psi * RAD_TO_DEG;
}

/** 转换为 SimulationState 接口 (用于仿真引擎工厂) */
export function azipodToSimulationState(
  state: Azipod3DOFInternalState,
  time: number
): {
  position: Vector2;
  heading: number;
  headingRad: number;
  yawRate: number;
  yawRateRad: number;
  rudder: number;
  speed: number;
  surgeVelocity: number;
  swayVelocity: number;
} {
  const headingDeg = state.psi * RAD_TO_DEG;
  const normalizedHeading = ((headingDeg % 360) + 360) % 360;

  return {
    position: { x: state.x, z: state.y },
    heading: normalizedHeading,
    headingRad: state.psi,
    yawRate: state.r * RAD_TO_DEG,
    yawRateRad: state.r,
    rudder: 0, // Azipod 系统无传统舵
    speed: getTotalSpeed(state),
    surgeVelocity: state.u,
    swayVelocity: state.v,
  };
}
