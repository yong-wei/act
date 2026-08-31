/**
 * 推力分配算法
 * 用于半潜式钻井平台等多推进器DP系统
 *
 * 特点:
 * - 8台全回转推进器
 * - 伪逆分配算法
 * - 推力/功率约束
 * - 方位角速率限制
 * - 禁止区域处理
 * - 故障重构
 *
 * 参考: Fossen, T.I. "Handbook of Marine Craft Hydrodynamics and Motion Control"
 */

import type {
  ThrusterConfig,
  ThrusterState,
} from '../../core/types';
import {
  HYSY981_THRUSTER_LAYOUT,
  DEG_TO_RAD,
  RAD_TO_DEG,
} from '../../core/constants';

// ============ 推进器配置 ============

/** 创建推进器配置 (从常量) */
export function createThrusterConfigs(): ThrusterConfig[] {
  return HYSY981_THRUSTER_LAYOUT.map((t) => ({
    id: t.id,
    positionX: t.positionX,
    positionY: t.positionY,
    maxThrust: t.maxThrust,
    maxPower: t.maxPower,
    maxAzimuthRate: t.maxAzimuthRate,
    // 禁止区域: 避免推进器互射 (简化处理)
    forbiddenZones: getForbiddenZones(t.id),
  }));
}

/**
 * 获取推进器禁止角度区域
 * 防止相邻推进器互相喷射
 */
function getForbiddenZones(id: number): Array<[number, number]> {
  // 简化实现: 禁止指向平台中心方向 ±30°
  // 实际需要根据布局计算
  const zones: Record<number, Array<[number, number]>> = {
    // 前左 T1: 避免指向右后
    1: [[120, 180]],
    // 前左 T2: 避免指向右前
    2: [[-180, -120]],
    // 中左前 T3: 无特别限制
    3: [],
    // 中左后 T4: 无特别限制
    4: [],
    // 后右 T5: 避免指向左前
    5: [[-60, 0]],
    // 后右 T6: 避免指向左后
    6: [[0, 60]],
    // 中右前 T7: 无特别限制
    7: [],
    // 中右后 T8: 无特别限制
    8: [],
  };
  return zones[id] || [];
}

/** 创建初始推进器状态 */
export function createThrusterStates(): ThrusterState[] {
  return HYSY981_THRUSTER_LAYOUT.map((t) => ({
    id: t.id,
    thrust: 0,
    azimuth: 0, // 初始指向前方
    power: 0,
    enabled: true,
    failed: false,
  }));
}

// ============ 推力分配算法 ============

/**
 * 计算推进器配置矩阵 B(α)
 * B = [cos(α₁) ... cos(α₈)]
 *     [sin(α₁) ... sin(α₈)]
 *     [l_1     ... l_8    ]
 *
 * @param configs 推进器配置
 * @param azimuths 当前方位角 (deg)
 * @returns 3×8 配置矩阵
 */
export function computeThrusterMatrix(
  configs: ThrusterConfig[],
  azimuths: number[]
): number[][] {
  const n = configs.length;
  const B: number[][] = [
    new Array(n).fill(0), // Fx
    new Array(n).fill(0), // Fy
    new Array(n).fill(0), // Mz
  ];

  for (let i = 0; i < n; i++) {
    const config = configs[i];
    const azRad = azimuths[i] * DEG_TO_RAD;

    B[0][i] = Math.cos(azRad);
    B[1][i] = Math.sin(azRad);
    // 力矩臂: M = x * Fy - y * Fx
    B[2][i] =
      config.positionX * Math.sin(azRad) - config.positionY * Math.cos(azRad);
  }

  return B;
}

/**
 * 计算伪逆 B⁺ = Bᵀ(BBᵀ)⁻¹
 * @param B 3×8 配置矩阵
 * @returns 8×3 伪逆矩阵
 */
function computePseudoInverse(B: number[][]): number[][] {
  const m = B.length; // 3
  const n = B[0].length; // 8

  // BBᵀ (3×3)
  const BBT: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += B[i][k] * B[j][k];
      }
      BBT[i][j] = sum;
    }
  }

  // (BBᵀ)⁻¹ - 3×3 矩阵求逆
  const inv = invert3x3(BBT);
  if (!inv) {
    // 奇异矩阵，返回零矩阵
    return Array.from({ length: n }, () => new Array(m).fill(0));
  }

  // Bᵀ(BBᵀ)⁻¹
  const Bplus: number[][] = Array.from({ length: n }, () =>
    new Array(m).fill(0)
  );
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += B[k][i] * inv[k][j];
      }
      Bplus[i][j] = sum;
    }
  }

  return Bplus;
}

/**
 * 3×3 矩阵求逆
 */
function invert3x3(M: number[][]): number[][] | null {
  const det =
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);

  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const invDet = 1 / det;

  return [
    [
      (M[1][1] * M[2][2] - M[1][2] * M[2][1]) * invDet,
      (M[0][2] * M[2][1] - M[0][1] * M[2][2]) * invDet,
      (M[0][1] * M[1][2] - M[0][2] * M[1][1]) * invDet,
    ],
    [
      (M[1][2] * M[2][0] - M[1][0] * M[2][2]) * invDet,
      (M[0][0] * M[2][2] - M[0][2] * M[2][0]) * invDet,
      (M[0][2] * M[1][0] - M[0][0] * M[1][2]) * invDet,
    ],
    [
      (M[1][0] * M[2][1] - M[1][1] * M[2][0]) * invDet,
      (M[0][1] * M[2][0] - M[0][0] * M[2][1]) * invDet,
      (M[0][0] * M[1][1] - M[0][1] * M[1][0]) * invDet,
    ],
  ];
}

/**
 * 计算最优方位角
 * 简化策略: 各推进器指向全局期望力方向
 */
function computeOptimalAzimuths(
  tauCmd: [number, number, number],
  currentStates: ThrusterState[],
  configs: ThrusterConfig[]
): number[] {
  const [Fx, Fy, Mz] = tauCmd;

  // 期望力方向
  const forceMag = Math.sqrt(Fx ** 2 + Fy ** 2);
  let forceDir = 0;
  if (forceMag > 1) {
    forceDir = Math.atan2(Fy, Fx) * RAD_TO_DEG;
  }

  return currentStates.map((s, i) => {
    const config = configs[i];

    if (s.failed || !s.enabled) {
      return s.azimuth; // 故障推进器保持当前方位
    }

    // 根据推进器位置调整方向，以产生所需力矩
    // 简化: 前部推进器和后部推进器配合产生力矩
    let adjustedDir = forceDir;

    // 如果需要正力矩 (逆时针)，前左推进器向左偏，后右推进器向右偏
    const momentContribution = Mz / 1000; // 归一化
    if (config.positionX < 0) {
      // 前部推进器
      adjustedDir += momentContribution * 5;
    } else {
      // 后部推进器
      adjustedDir -= momentContribution * 5;
    }

    // 应用禁止区域约束
    adjustedDir = applyForbiddenZoneConstraint(adjustedDir, config.forbiddenZones);

    return adjustedDir;
  });
}

/**
 * 应用方位角速率限制
 */
function applyAzimuthRateLimit(
  currentAzimuths: number[],
  desiredAzimuths: number[],
  configs: ThrusterConfig[],
  dt: number
): number[] {
  return desiredAzimuths.map((desired, i) => {
    const current = currentAzimuths[i];
    const maxRate = configs[i].maxAzimuthRate;
    const maxChange = maxRate * dt;

    let diff = desired - current;
    // 处理角度环绕
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (Math.abs(diff) <= maxChange) {
      return desired;
    } else {
      return current + Math.sign(diff) * maxChange;
    }
  });
}

/**
 * 应用禁止区域约束
 */
function applyForbiddenZoneConstraint(
  angle: number,
  forbiddenZones?: Array<[number, number]>
): number {
  if (!forbiddenZones || forbiddenZones.length === 0) {
    return angle;
  }

  // 归一化角度到 [-180, 180)
  let normalized = angle;
  while (normalized >= 180) normalized -= 360;
  while (normalized < -180) normalized += 360;

  for (const [min, max] of forbiddenZones) {
    if (normalized >= min && normalized <= max) {
      // 在禁止区域内，移动到最近边界
      const distToMin = Math.abs(normalized - min);
      const distToMax = Math.abs(normalized - max);
      normalized = distToMin < distToMax ? min - 1 : max + 1;
    }
  }

  return normalized;
}

// ============ 故障处理 ============

/** 故障类型 */
export type FailureType = 'complete' | 'partial' | 'stuck';

/**
 * 应用推进器故障 (单个推进器)
 * @param state 推进器状态
 * @param failureType 故障类型
 * @returns 更新后的状态
 */
export function simulateThrusterFailure(
  state: ThrusterState,
  failureType: FailureType = 'complete'
): ThrusterState {
  switch (failureType) {
    case 'complete':
      return { ...state, failed: true, thrust: 0, power: 0, enabled: false };
    case 'partial':
      // 部分故障: 推力减半
      return { ...state, failed: true, thrust: state.thrust * 0.5, power: state.power * 0.5 };
    case 'stuck':
      // 卡死: 方位角无法改变，但仍可输出推力
      return { ...state, failed: true };
    default:
      return { ...state, failed: true, thrust: 0, power: 0 };
  }
}

/**
 * 模拟推进器故障 (批量操作)
 * @param states 推进器状态数组
 * @param thrusterId 故障推进器ID
 * @returns 更新后的状态数组
 */
export function simulateThrusterFailureById(
  states: ThrusterState[],
  thrusterId: number
): ThrusterState[] {
  return states.map((s) =>
    s.id === thrusterId ? { ...s, failed: true, thrust: 0, power: 0 } : s
  );
}

/**
 * 恢复推进器
 * @param states 推进器状态
 * @param thrusterId 推进器ID
 * @returns 更新后的状态
 */
export function recoverThruster(
  states: ThrusterState[],
  thrusterId: number
): ThrusterState[] {
  return states.map((s) =>
    s.id === thrusterId ? { ...s, failed: false, enabled: true } : s
  );
}

/**
 * 切换推进器启用状态
 */
export function toggleThruster(
  states: ThrusterState[],
  thrusterId: number,
  enabled: boolean
): ThrusterState[] {
  return states.map((s) =>
    s.id === thrusterId ? { ...s, enabled } : s
  );
}

// ============ 工具函数 ============

/**
 * 计算总功率消耗
 */
export function computeTotalPower(states: ThrusterState[]): number {
  return states.reduce((sum, s) => sum + s.power, 0);
}

/**
 * 检查是否有推进器饱和
 */
export function checkSaturation(
  states: ThrusterState[],
  configs: ThrusterConfig[]
): boolean {
  return states.some((s, i) => {
    if (s.failed || !s.enabled) return false;
    return Math.abs(s.thrust) >= configs[i].maxThrust * 0.95;
  });
}

/**
 * 获取推进器状态摘要
 */
export function getThrusterSummary(states: ThrusterState[]): {
  activeCount: number;
  failedCount: number;
  totalThrust: number;
  totalPower: number;
} {
  let activeCount = 0;
  let failedCount = 0;
  let totalThrust = 0;
  let totalPower = 0;

  for (const s of states) {
    if (s.failed) {
      failedCount++;
    } else if (s.enabled) {
      activeCount++;
      totalThrust += s.thrust;
      totalPower += s.power;
    }
  }

  return { activeCount, failedCount, totalThrust, totalPower };
}
