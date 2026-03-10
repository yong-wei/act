/**
 * MMG (Maneuvering Modeling Group) 三自由度船舶操纵模型
 * 高保真非线性模型，考虑水动力耦合效应
 *
 * 状态向量: [x, y, psi, u, v, r]
 * x, y: 地固坐标位置 (m)
 * psi: 航向角 (rad)
 * u: 纵向速度 (m/s)
 * v: 横向速度 (m/s)
 * r: 转艏角速度 (rad/s)
 *
 * 运动方程:
 * (m + m_x) * u_dot - (m + m_y) * v * r = X_H + X_P + X_R + X_D
 * (m + m_y) * v_dot + (m + m_x) * u * r = Y_H + Y_P + Y_R + Y_D
 * (I_z + J_z) * r_dot                    = N_H + N_P + N_R + N_D
 */

import type {
  DOF3State,
  MMG3DOFParams,
  MassInertiaMatrix,
  HydrodynamicCoefficients,
  DisturbanceVector,
} from '../../core/types';
import { clamp, SEA_WATER_DENSITY } from '../../core/constants';

// ============ 类型定义 ============

/** MMG 模型状态 */
export interface MMG3DOFState extends DOF3State {
  // 继承: x, y, psi, u, v, r
  rudderAngle: number;      // 当前舵角 (rad)
  propellerRPM: number;     // 螺旋桨转速
}

/** 力和力矩 */
export interface ForcesMoments {
  X: number;  // 纵向力 (N)
  Y: number;  // 横向力 (N)
  N: number;  // 艏摇力矩 (N·m)
}

// ============ 默认参数 (天鲸号挖泥船) ============

export const DEFAULT_MMG_PARAMS: MMG3DOFParams = {
  massInertia: {
    m: 17000000,          // 17000吨 → kg
    Iz: 2.5e9,            // 转动惯量
    xG: -2.5,             // 重心位置
    mx: 0.05,             // 附加质量系数 X
    my: 0.90,             // 附加质量系数 Y
    Jz: 0.15,             // 附加转动惯量
  },
  hydro: {
    // 纵向力导数 (阻力特性)
    Xuu: -0.022,
    Xvv: -0.040,
    Xrr: 0.002,
    Xvr: 0.002,
    // 横向力导数
    Yv: -0.315,
    Yr: 0.083,
    Yvvv: -1.607,
    Yrrr: 0.008,
    Yvvr: 0.379,
    Yvrr: -0.391,
    // 艏摇力矩导数
    Nv: -0.137,
    Nr: -0.049,
    Nvvv: -0.030,
    Nrrr: -0.013,
    Nvvr: -0.294,
    Nvrr: 0.055,
  },
  rudder: {
    maxAngle: 35 * Math.PI / 180,   // 35°
    maxRate: 2.5 * Math.PI / 180,   // 2.5°/s
    tR: 0.4,                         // 舵系数
    aH: 0.3,                         // 舵力系数
    xR: -63.75,                      // 舵位置 (船尾, 约0.5L)
  },
  propeller: {
    Dp: 4.5,              // 螺旋桨直径 (m)
    wp: 0.25,             // 伴流分数
    tp: 0.15,             // 推力减额
  },
};

// ============ 状态初始化 ============

/** 创建初始 MMG 状态 */
export function createMMG3DOFState(
  x: number = 0,
  y: number = 0,
  psi: number = 0,
  u: number = 2.0,    // 默认航速 2 m/s
  v: number = 0,
  r: number = 0
): MMG3DOFState {
  return {
    x, y, psi, u, v, r,
    rudderAngle: 0,
    propellerRPM: 80,   // 默认转速
  };
}

// ============ 水动力计算 ============

/**
 * 计算船体水动力 (Hull forces)
 * 使用非线性 MMG 模型公式
 */
function computeHullForces(
  state: MMG3DOFState,
  params: MMG3DOFParams,
  L: number,            // 船长 (m)
  d: number             // 吃水 (m)
): ForcesMoments {
  const { u, v, r } = state;
  const hydro = params.hydro;

  // 无量纲化速度
  const U = Math.sqrt(u * u + v * v) || 0.001; // 避免除零
  const v_prime = v / U;
  const r_prime = r * L / U;

  // 动压 (1/2 * rho * L * d * U^2)
  const dynamicPressure = 0.5 * SEA_WATER_DENSITY * L * d * U * U;

  // 纵向力 X (阻力)
  const X_H = dynamicPressure * (
    hydro.Xuu * (u / U) * (u / U) +
    hydro.Xvv * v_prime * v_prime +
    hydro.Xrr * r_prime * r_prime +
    hydro.Xvr * v_prime * r_prime
  );

  // 横向力 Y
  const Y_H = dynamicPressure * (
    hydro.Yv * v_prime +
    hydro.Yr * r_prime +
    hydro.Yvvv * v_prime * v_prime * v_prime +
    hydro.Yrrr * r_prime * r_prime * r_prime +
    hydro.Yvvr * v_prime * v_prime * r_prime +
    hydro.Yvrr * v_prime * r_prime * r_prime
  );

  // 艏摇力矩 N
  const N_H = dynamicPressure * L * (
    hydro.Nv * v_prime +
    hydro.Nr * r_prime +
    hydro.Nvvv * v_prime * v_prime * v_prime +
    hydro.Nrrr * r_prime * r_prime * r_prime +
    hydro.Nvvr * v_prime * v_prime * r_prime +
    hydro.Nvrr * v_prime * r_prime * r_prime
  );

  return { X: X_H, Y: Y_H, N: N_H };
}

/**
 * 计算螺旋桨推力 (Propeller thrust)
 */
function computePropellerForces(
  state: MMG3DOFState,
  params: MMG3DOFParams
): ForcesMoments {
  const { u } = state;
  const { Dp, wp, tp } = params.propeller;

  // 简化推力模型
  // 实际应使用 KT-J 曲线
  const n = state.propellerRPM / 60;  // 转速 (rps)
  const Va = u * (1 - wp);            // 进速

  // 进速比 J = Va / (n * Dp)
  const J = n > 0.1 ? Va / (n * Dp) : 0;

  // 简化推力系数 (典型值)
  const KT = 0.4 - 0.3 * J;

  // 推力 T = KT * rho * n^2 * Dp^4
  const T = KT * SEA_WATER_DENSITY * n * n * Dp * Dp * Dp * Dp;

  // 有效推力 (考虑推力减额)
  const X_P = (1 - tp) * T;

  return { X: X_P, Y: 0, N: 0 };
}

/**
 * 计算舵力 (Rudder forces)
 */
function computeRudderForces(
  state: MMG3DOFState,
  params: MMG3DOFParams,
  L: number
): ForcesMoments {
  const { u, v, r, rudderAngle } = state;
  const { tR, aH, xR } = params.rudder;

  // 舵处的流速
  const uR = u;
  const vR = v + xR * r;
  const UR = Math.sqrt(uR * uR + vR * vR) || 0.001;

  // 舵的有效攻角
  const alphaR = rudderAngle - Math.atan2(vR, uR);

  // 舵面积 (估算)
  const AR = L * 0.015;  // 约 1.5% 船长

  // 舵力系数 (简化)
  const CL = 2 * Math.PI * Math.sin(alphaR);  // 线性升力

  // 舵升力
  const LR = 0.5 * SEA_WATER_DENSITY * AR * UR * UR * CL;

  // 转换到船体坐标
  const F_N = (1 + aH) * LR;  // 法向力 (含船体效应)

  const X_R = -F_N * Math.sin(rudderAngle);
  const Y_R = -(1 - tR) * F_N * Math.cos(rudderAngle);
  const N_R = -(xR + aH * (L * 0.25)) * F_N * Math.cos(rudderAngle);

  return { X: X_R, Y: Y_R, N: N_R };
}

// ============ 核心步进函数 ============

/**
 * MMG 3-DOF 模型状态导数
 */
function computeDerivatives(
  state: MMG3DOFState,
  params: MMG3DOFParams,
  L: number,
  d: number,
  disturbance: DisturbanceVector = { forceX: 0, forceY: 0, momentN: 0 }
): { du: number; dv: number; dr: number; dx: number; dy: number; dpsi: number } {
  const { x, y, psi, u, v, r } = state;
  const mi = params.massInertia;

  // 质量和惯性项
  const m = mi.m;
  const mx = m * mi.mx;   // 附加质量 X
  const my = m * mi.my;   // 附加质量 Y
  const Iz = mi.Iz;
  const Jz = Iz * mi.Jz;  // 附加转动惯量

  // 计算各项力
  const hullForces = computeHullForces(state, params, L, d);
  const propForces = computePropellerForces(state, params);
  const rudderForces = computeRudderForces(state, params, L);

  // 合力
  const X = hullForces.X + propForces.X + rudderForces.X + disturbance.forceX;
  const Y = hullForces.Y + propForces.Y + rudderForces.Y + disturbance.forceY;
  const N = hullForces.N + propForces.N + rudderForces.N + disturbance.momentN;

  // 运动方程
  // (m + mx) * du/dt - (m + my) * v * r = X
  // (m + my) * dv/dt + (m + mx) * u * r = Y
  // (Iz + Jz) * dr/dt = N
  const du = (X + (m + my) * v * r) / (m + mx);
  const dv = (Y - (m + mx) * u * r) / (m + my);
  const dr = N / (Iz + Jz);

  // 位置变化 (地固坐标)
  const dx = u * Math.cos(psi) - v * Math.sin(psi);
  const dy = u * Math.sin(psi) + v * Math.cos(psi);
  const dpsi = r;

  return { du, dv, dr, dx, dy, dpsi };
}

/**
 * MMG 3-DOF 模型步进 (RK4 积分)
 */
export function mmg3dofStep(
  state: MMG3DOFState,
  rudderCommand: number,      // 舵令 (rad)
  propellerRPM: number,       // 螺旋桨转速
  dt: number,
  params: MMG3DOFParams = DEFAULT_MMG_PARAMS,
  shipLength: number = 127.5,
  shipDraft: number = 6.2,
  disturbance: DisturbanceVector = { forceX: 0, forceY: 0, momentN: 0 }
): MMG3DOFState {
  // 舵角限幅和速率限制
  const maxRudderChange = params.rudder.maxRate * dt;
  const targetRudder = clamp(rudderCommand, -params.rudder.maxAngle, params.rudder.maxAngle);
  const rudderChange = clamp(
    targetRudder - state.rudderAngle,
    -maxRudderChange,
    maxRudderChange
  );
  const newRudderAngle = state.rudderAngle + rudderChange;

  // 更新舵角和转速
  const stateWithRudder: MMG3DOFState = {
    ...state,
    rudderAngle: newRudderAngle,
    propellerRPM,
  };

  // RK4 积分
  const k1 = computeDerivatives(stateWithRudder, params, shipLength, shipDraft, disturbance);

  const s2: MMG3DOFState = {
    ...stateWithRudder,
    x: state.x + 0.5 * dt * k1.dx,
    y: state.y + 0.5 * dt * k1.dy,
    psi: state.psi + 0.5 * dt * k1.dpsi,
    u: state.u + 0.5 * dt * k1.du,
    v: state.v + 0.5 * dt * k1.dv,
    r: state.r + 0.5 * dt * k1.dr,
  };
  const k2 = computeDerivatives(s2, params, shipLength, shipDraft, disturbance);

  const s3: MMG3DOFState = {
    ...stateWithRudder,
    x: state.x + 0.5 * dt * k2.dx,
    y: state.y + 0.5 * dt * k2.dy,
    psi: state.psi + 0.5 * dt * k2.dpsi,
    u: state.u + 0.5 * dt * k2.du,
    v: state.v + 0.5 * dt * k2.dv,
    r: state.r + 0.5 * dt * k2.dr,
  };
  const k3 = computeDerivatives(s3, params, shipLength, shipDraft, disturbance);

  const s4: MMG3DOFState = {
    ...stateWithRudder,
    x: state.x + dt * k3.dx,
    y: state.y + dt * k3.dy,
    psi: state.psi + dt * k3.dpsi,
    u: state.u + dt * k3.du,
    v: state.v + dt * k3.dv,
    r: state.r + dt * k3.dr,
  };
  const k4 = computeDerivatives(s4, params, shipLength, shipDraft, disturbance);

  // 最终更新
  return {
    x: state.x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
    y: state.y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
    psi: state.psi + (dt / 6) * (k1.dpsi + 2 * k2.dpsi + 2 * k3.dpsi + k4.dpsi),
    u: state.u + (dt / 6) * (k1.du + 2 * k2.du + 2 * k3.du + k4.du),
    v: state.v + (dt / 6) * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv),
    r: state.r + (dt / 6) * (k1.dr + 2 * k2.dr + 2 * k3.dr + k4.dr),
    rudderAngle: newRudderAngle,
    propellerRPM,
  };
}

// ============ 工具函数 ============

/**
 * 从 MMG 状态转换到通用仿真状态
 */
export function mmgToSimulationState(
  mmg: MMG3DOFState,
  time: number
): {
  position: { x: number; z: number };
  heading: number;
  headingRad: number;
  yawRate: number;
  yawRateRad: number;
  rudder: number;
  speed: number;
  surgeVelocity: number;
  swayVelocity: number;
  time: number;
} {
  const headingDeg = mmg.psi * 180 / Math.PI;
  const yawRateDeg = mmg.r * 180 / Math.PI;
  const speed = Math.sqrt(mmg.u * mmg.u + mmg.v * mmg.v);

  return {
    position: { x: mmg.x, z: mmg.y },
    heading: ((headingDeg % 360) + 360) % 360,
    headingRad: mmg.psi,
    yawRate: yawRateDeg,
    yawRateRad: mmg.r,
    rudder: mmg.rudderAngle * 180 / Math.PI,
    speed,
    surgeVelocity: mmg.u,
    swayVelocity: mmg.v,
    time,
  };
}

/**
 * 计算位置误差 (用于 DP 控制)
 */
export function computePositionError(
  current: { x: number; y: number; psi: number },
  target: { x: number; y: number; psi: number }
): { xe: number; ye: number; psie: number } {
  // 地固坐标误差
  const dxE = target.x - current.x;
  const dyE = target.y - current.y;

  // 转换到体固坐标
  const cosPsi = Math.cos(current.psi);
  const sinPsi = Math.sin(current.psi);

  const xe = cosPsi * dxE + sinPsi * dyE;   // 纵向误差
  const ye = -sinPsi * dxE + cosPsi * dyE;  // 横向误差

  // 航向误差 (考虑角度环绕)
  let psie = target.psi - current.psi;
  while (psie > Math.PI) psie -= 2 * Math.PI;
  while (psie < -Math.PI) psie += 2 * Math.PI;

  return { xe, ye, psie };
}
