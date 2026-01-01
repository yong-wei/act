/**
 * 半潜式钻井平台 3DOF 耦合动力学模型
 * 用于 HYSY981 等深水半潜式平台的动力定位仿真
 *
 * 特点:
 * - 3自由度耦合: X(纵荡), Y(横荡), ψ(艏摇)
 * - 强耦合阻尼项: D_vr (sway→yaw), D_rv (yaw→sway)
 * - 全回转推进器输入
 * - 环境扰动: 海流、风、波浪漂移
 *
 * 教学重点: Ch6 解耦控制、现代控制理论
 */

import type {
  SemiSubmersible3DOFState,
  ThrusterState,
  DisturbanceVector,
} from '../../core/types';

// 重新导出类型供外部使用
export type { SemiSubmersible3DOFState } from '../../core/types';
import {
  HYSY981_PLATFORM_PARAMS,
  DEG_TO_RAD,
  RAD_TO_DEG,
  clamp,
} from '../../core/constants';

const P = HYSY981_PLATFORM_PARAMS;

// ============ 质量和惯性 ============

/** 含附加质量的纵向质量 */
const M11 = P.MASS * (1 + P.ADDED_MASS_X);

/** 含附加质量的横向质量 */
const M22 = P.MASS * (1 + P.ADDED_MASS_Y);

/** 含附加惯性的转动惯量 */
const M33 = P.INERTIA_Z * (1 + P.ADDED_INERTIA_Z);

// ============ 状态创建 ============

/**
 * 创建初始状态
 */
export function createSemiSub3DOFState(
  x = 0,
  y = 0,
  psiDeg = 0,
  targetX = 0,
  targetY = 0,
  targetPsiDeg = 0
): SemiSubmersible3DOFState {
  // 初始化8台推进器状态
  const thrusters: ThrusterState[] = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    thrust: 0,
    azimuth: 0,
    power: 0,
    enabled: true,
    failed: false,
  }));

  return {
    // 位置 (地固坐标系)
    x,
    y,
    psi: psiDeg * DEG_TO_RAD,

    // 速度 (体坐标系)
    u: 0,
    v: 0,
    r: 0,

    // 推进器状态
    thrusters,

    // 环境扰动 (初始为0)
    currentForceX: 0,
    currentForceY: 0,
    currentMomentN: 0,
    windForceX: 0,
    windForceY: 0,
    windMomentN: 0,

    // DP状态
    targetX,
    targetY,
    targetPsi: targetPsiDeg * DEG_TO_RAD,
    positionError: Math.sqrt(
      (x - targetX) ** 2 + (y - targetY) ** 2
    ),
    headingError:
      Math.abs(psiDeg - targetPsiDeg) > 180
        ? 360 - Math.abs(psiDeg - targetPsiDeg)
        : Math.abs(psiDeg - targetPsiDeg),

    // 控制状态
    decouplingEnabled: true,
  };
}

// ============ 动力学计算 ============

/**
 * 计算阻尼力 (含耦合项)
 * @param u 纵向速度 (m/s)
 * @param v 横向速度 (m/s)
 * @param r 艏摇角速度 (rad/s)
 * @returns [D_u, D_v, D_r] 阻尼力/力矩 (N, N, N·m)
 */
export function computeDampingForces(
  u: number,
  v: number,
  r: number
): [number, number, number] {
  // 线性阻尼
  const D_u = -P.DAMPING_U * u;

  // 横向阻尼 (含耦合项 D_vr)
  const D_v = -P.DAMPING_V * v - P.DAMPING_VR * r;

  // 艏摇阻尼 (含耦合项 D_rv)
  const D_r = -P.DAMPING_RV * v - P.DAMPING_R * r;

  return [D_u, D_v, D_r];
}

/**
 * 计算推进器合力/合力矩
 * @param thrusters 推进器状态数组
 * @returns [Fx, Fy, Mz] 合力/合力矩 (kN, kN, kN·m)
 */
export function computeThrusterForces(
  thrusters: ThrusterState[]
): [number, number, number] {
  let Fx = 0;
  let Fy = 0;
  let Mz = 0;

  for (const t of thrusters) {
    if (!t.enabled || t.failed) continue;

    const azimuthRad = t.azimuth * DEG_TO_RAD;
    const fx = t.thrust * Math.cos(azimuthRad);
    const fy = t.thrust * Math.sin(azimuthRad);

    Fx += fx;
    Fy += fy;

    // 从 HYSY981_THRUSTER_LAYOUT 获取位置 (简化处理)
    // 实际位置在推进器分配模块中处理
    const posX = getThrusterPositionX(t.id);
    const posY = getThrusterPositionY(t.id);
    Mz += posX * fy - posY * fx;
  }

  return [Fx, Fy, Mz];
}

/** 获取推进器X位置 */
function getThrusterPositionX(id: number): number {
  const positions = [-45, -45, -30, -30, 45, 45, 30, 30];
  return positions[id - 1] || 0;
}

/** 获取推进器Y位置 */
function getThrusterPositionY(id: number): number {
  const positions = [30, -30, 35, -35, 30, -30, 35, -35];
  return positions[id - 1] || 0;
}

/**
 * 坐标变换: 体坐标系 → 地固坐标系
 * @param u 纵向速度 (体)
 * @param v 横向速度 (体)
 * @param psi 航向角 (rad)
 * @returns [xDot, yDot] 地固系速度
 */
export function bodyToEarth(
  u: number,
  v: number,
  psi: number
): [number, number] {
  const cosPsi = Math.cos(psi);
  const sinPsi = Math.sin(psi);
  const xDot = u * cosPsi - v * sinPsi;
  const yDot = u * sinPsi + v * cosPsi;
  return [xDot, yDot];
}

/**
 * 坐标变换: 地固坐标系 → 体坐标系
 * @param xDot 北向速度 (地固)
 * @param yDot 东向速度 (地固)
 * @param psi 航向角 (rad)
 * @returns [u, v] 体坐标系速度
 */
export function earthToBody(
  xDot: number,
  yDot: number,
  psi: number
): [number, number] {
  const cosPsi = Math.cos(psi);
  const sinPsi = Math.sin(psi);
  const u = xDot * cosPsi + yDot * sinPsi;
  const v = -xDot * sinPsi + yDot * cosPsi;
  return [u, v];
}

// ============ 状态方程 ============

/**
 * 3DOF运动方程 (体坐标系)
 * M·v̇ + C·v + D·v = τ + τ_env
 *
 * @param state 当前状态
 * @param thrusterForce 推进器合力 [Fx, Fy, Mz] (kN, kN, kN·m)
 * @param envForce 环境扰动力 [Fx, Fy, Mz] (N, N, N·m)
 * @returns [uDot, vDot, rDot] 加速度
 */
export function semiSub3DOFDynamics(
  state: SemiSubmersible3DOFState,
  thrusterForce: [number, number, number],
  envForce: [number, number, number]
): [number, number, number] {
  const { u, v, r } = state;

  // 阻尼力 (N, N, N·m)
  const [D_u, D_v, D_r] = computeDampingForces(u, v, r);

  // 推进器力 (kN → N)
  const tau_x = thrusterForce[0] * 1000;
  const tau_y = thrusterForce[1] * 1000;
  const tau_n = thrusterForce[2] * 1000;

  // 环境力 (已是 N)
  const [env_x, env_y, env_n] = envForce;

  // 科里奥利力 (离心力项)
  // 对于半潜平台，低速下可近似忽略
  const C_u = M22 * v * r;
  const C_v = -M11 * u * r;
  const C_r = (M11 - M22) * u * v;

  // 运动方程求解
  // M11 * uDot = tau_x + env_x + D_u + C_u
  // M22 * vDot = tau_y + env_y + D_v + C_v
  // M33 * rDot = tau_n + env_n + D_r + C_r

  const uDot = (tau_x + env_x + D_u + C_u) / M11;
  const vDot = (tau_y + env_y + D_v + C_v) / M22;
  const rDot = (tau_n + env_n + D_r + C_r) / M33;

  return [uDot, vDot, rDot];
}

// ============ 积分器 ============

/**
 * RK4 积分一步
 * @param state 当前状态
 * @param thrusterForce 推进器合力 (kN)
 * @param envForce 环境扰动力 (N)
 * @param dt 时间步长 (s)
 * @returns 更新后的状态
 */
export function semiSub3DOFStep(
  state: SemiSubmersible3DOFState,
  thrusterForce: [number, number, number],
  envForce: [number, number, number],
  dt: number
): SemiSubmersible3DOFState {
  // 提取当前状态
  const { x, y, psi, u, v, r } = state;

  // RK4 积分
  const k1 = computeDerivatives(x, y, psi, u, v, r, thrusterForce, envForce);
  const k2 = computeDerivatives(
    x + (k1[0] * dt) / 2,
    y + (k1[1] * dt) / 2,
    psi + (k1[2] * dt) / 2,
    u + (k1[3] * dt) / 2,
    v + (k1[4] * dt) / 2,
    r + (k1[5] * dt) / 2,
    thrusterForce,
    envForce
  );
  const k3 = computeDerivatives(
    x + (k2[0] * dt) / 2,
    y + (k2[1] * dt) / 2,
    psi + (k2[2] * dt) / 2,
    u + (k2[3] * dt) / 2,
    v + (k2[4] * dt) / 2,
    r + (k2[5] * dt) / 2,
    thrusterForce,
    envForce
  );
  const k4 = computeDerivatives(
    x + k3[0] * dt,
    y + k3[1] * dt,
    psi + k3[2] * dt,
    u + k3[3] * dt,
    v + k3[4] * dt,
    r + k3[5] * dt,
    thrusterForce,
    envForce
  );

  // 更新状态
  const newX = x + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  const newY = y + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  let newPsi = psi + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  const newU = u + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
  const newV = v + (dt / 6) * (k1[4] + 2 * k2[4] + 2 * k3[4] + k4[4]);
  const newR = r + (dt / 6) * (k1[5] + 2 * k2[5] + 2 * k3[5] + k4[5]);

  // 航向角归一化到 [-π, π]
  while (newPsi > Math.PI) newPsi -= 2 * Math.PI;
  while (newPsi < -Math.PI) newPsi += 2 * Math.PI;

  // 速度限幅 (数值稳定性)
  const maxVelocity = 2.0; // m/s
  const maxYawRate = 0.1; // rad/s

  // 计算位置和航向误差
  const positionError = Math.sqrt(
    (newX - state.targetX) ** 2 + (newY - state.targetY) ** 2
  );
  let headingErrorRad = newPsi - state.targetPsi;
  while (headingErrorRad > Math.PI) headingErrorRad -= 2 * Math.PI;
  while (headingErrorRad < -Math.PI) headingErrorRad += 2 * Math.PI;
  const headingError = Math.abs(headingErrorRad) * RAD_TO_DEG;

  return {
    ...state,
    x: newX,
    y: newY,
    psi: newPsi,
    u: clamp(newU, -maxVelocity, maxVelocity),
    v: clamp(newV, -maxVelocity, maxVelocity),
    r: clamp(newR, -maxYawRate, maxYawRate),
    positionError,
    headingError,
  };
}

/**
 * 计算状态导数 [xDot, yDot, psiDot, uDot, vDot, rDot]
 */
function computeDerivatives(
  _x: number,
  _y: number,
  psi: number,
  u: number,
  v: number,
  r: number,
  thrusterForce: [number, number, number],
  envForce: [number, number, number]
): [number, number, number, number, number, number] {
  // 创建临时状态用于计算动力学
  const tempState = { u, v, r } as SemiSubmersible3DOFState;

  // 计算加速度
  const [uDot, vDot, rDot] = semiSub3DOFDynamics(
    tempState,
    thrusterForce,
    envForce
  );

  // 计算位置导数 (体坐标系 → 地固坐标系)
  const [xDot, yDot] = bodyToEarth(u, v, psi);
  const psiDot = r;

  return [xDot, yDot, psiDot, uDot, vDot, rDot];
}

// ============ 耦合分析 ============

/**
 * 计算耦合矩阵 (用于解耦控制器设计)
 * 返回线性化的耦合矩阵 C，使得:
 * y = C * u (稳态近似)
 *
 * @returns 3x3 耦合矩阵
 */
export function getCouplingMatrix(): number[][] {
  // 稳态时: D * v = τ
  // 耦合主要来自阻尼矩阵的非对角元素

  // 简化的耦合矩阵 (基于阻尼比)
  const k_vr = P.DAMPING_VR / P.DAMPING_V; // v→r 耦合系数
  const k_rv = P.DAMPING_RV / P.DAMPING_R; // r→v 耦合系数

  return [
    [1, 0, 0],           // surge (无耦合)
    [0, 1, k_vr],        // sway (受yaw影响)
    [0, k_rv, 1],        // yaw (受sway影响)
  ];
}

/**
 * 计算解耦矩阵 (耦合矩阵的逆)
 * @returns 3x3 解耦矩阵
 */
export function getDecouplingMatrix(): number[][] {
  const C = getCouplingMatrix();

  // 3x3矩阵求逆 (假设对角占优)
  const det =
    C[0][0] * (C[1][1] * C[2][2] - C[1][2] * C[2][1]) -
    C[0][1] * (C[1][0] * C[2][2] - C[1][2] * C[2][0]) +
    C[0][2] * (C[1][0] * C[2][1] - C[1][1] * C[2][0]);

  if (Math.abs(det) < 1e-10) {
    // 接近奇异，返回单位矩阵
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  // 伴随矩阵除以行列式
  return [
    [
      (C[1][1] * C[2][2] - C[1][2] * C[2][1]) / det,
      -(C[0][1] * C[2][2] - C[0][2] * C[2][1]) / det,
      (C[0][1] * C[1][2] - C[0][2] * C[1][1]) / det,
    ],
    [
      -(C[1][0] * C[2][2] - C[1][2] * C[2][0]) / det,
      (C[0][0] * C[2][2] - C[0][2] * C[2][0]) / det,
      -(C[0][0] * C[1][2] - C[0][2] * C[1][0]) / det,
    ],
    [
      (C[1][0] * C[2][1] - C[1][1] * C[2][0]) / det,
      -(C[0][0] * C[2][1] - C[0][1] * C[2][0]) / det,
      (C[0][0] * C[1][1] - C[0][1] * C[1][0]) / det,
    ],
  ];
}

/**
 * 应用解耦矩阵到控制力
 * @param tauCmd 原始控制力 [tau_x, tau_y, tau_n]
 * @param decouplingEnabled 是否启用解耦
 * @returns 解耦后的控制力
 */
export function applyDecoupling(
  tauCmd: [number, number, number],
  decouplingEnabled: boolean
): [number, number, number] {
  if (!decouplingEnabled) {
    return tauCmd;
  }

  const D = getDecouplingMatrix();
  return [
    D[0][0] * tauCmd[0] + D[0][1] * tauCmd[1] + D[0][2] * tauCmd[2],
    D[1][0] * tauCmd[0] + D[1][1] * tauCmd[1] + D[1][2] * tauCmd[2],
    D[2][0] * tauCmd[0] + D[2][1] * tauCmd[1] + D[2][2] * tauCmd[2],
  ];
}

// ============ 工具函数 ============

/**
 * 计算平台在当前状态下的水动力参数描述
 */
export function getHydrodynamicDescription(
  state: SemiSubmersible3DOFState
): string {
  const speed = Math.sqrt(state.u ** 2 + state.v ** 2);
  const driftAngle = Math.atan2(state.v, state.u) * RAD_TO_DEG;

  if (speed < 0.1) {
    return '平台定点保持中';
  } else if (Math.abs(driftAngle) < 10) {
    return `平台纵向移动 (${speed.toFixed(2)} m/s)`;
  } else if (Math.abs(driftAngle) > 80) {
    return `平台横向漂移 (${speed.toFixed(2)} m/s)`;
  } else {
    return `平台斜向移动 (${speed.toFixed(2)} m/s, 漂角 ${driftAngle.toFixed(1)}°)`;
  }
}

/**
 * 评估当前状态的 DP 性能
 */
export function evaluateDPPerformance(state: SemiSubmersible3DOFState): {
  positionGrade: 'green' | 'yellow' | 'red';
  headingGrade: 'green' | 'yellow' | 'red';
  overallGrade: 'green' | 'yellow' | 'red';
} {
  // 位置等级
  let positionGrade: 'green' | 'yellow' | 'red';
  if (state.positionError < 1.0) {
    positionGrade = 'green';
  } else if (state.positionError < 3.0) {
    positionGrade = 'yellow';
  } else {
    positionGrade = 'red';
  }

  // 航向等级
  let headingGrade: 'green' | 'yellow' | 'red';
  if (state.headingError < 2.0) {
    headingGrade = 'green';
  } else if (state.headingError < 5.0) {
    headingGrade = 'yellow';
  } else {
    headingGrade = 'red';
  }

  // 综合等级 (取最差)
  let overallGrade: 'green' | 'yellow' | 'red' = 'green';
  if (positionGrade === 'red' || headingGrade === 'red') {
    overallGrade = 'red';
  } else if (positionGrade === 'yellow' || headingGrade === 'yellow') {
    overallGrade = 'yellow';
  }

  return { positionGrade, headingGrade, overallGrade };
}

/**
 * 将半潜平台3DOF状态转换为通用仿真状态
 * 用于与仿真引擎接口对接
 */
export function semiSubToSimulationState(
  state: SemiSubmersible3DOFState,
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
  const speed = Math.sqrt(state.u ** 2 + state.v ** 2);

  return {
    position: { x: state.x, z: state.y },
    heading: state.psi * RAD_TO_DEG,
    headingRad: state.psi,
    yawRate: state.r * RAD_TO_DEG,
    yawRateRad: state.r,
    rudder: 0, // 半潜平台无舵，使用推进器
    speed,
    surgeVelocity: state.u,
    swayVelocity: state.v,
    time,
  };
}
