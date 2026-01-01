/**
 * 减摇鳍主动控制模型
 *
 * 用于大型邮轮的主动横摇抑制系统
 *
 * 物理原理:
 *   升力: L_fin = 0.5 * ρ * V² * A_fin * CL_α * δ_fin
 *   抗横摇力矩: M_roll = 2 * L_fin * arm * cos(φ) * η
 *
 * 其中:
 *   ρ: 海水密度 (kg/m³)
 *   V: 船速 (m/s)
 *   A_fin: 单侧鳍面积 (m²)
 *   CL_α: 升力系数斜率 (/rad)
 *   δ_fin: 鳍偏转角 (rad)
 *   arm: 力臂 (m)
 *   φ: 横摇角 (rad)
 *   η: 效率系数
 */

import type { FinStabilizerState } from '../../core/types';
import {
  clamp,
  toRadians,
  toDegrees,
  FIN_STABILIZER_PARAMS,
  CRUISE_ADORA_PARAMS,
} from '../../core/constants';

// ============ 类型导出 ============

export type { FinStabilizerState };

/** 减摇鳍参数 */
export interface FinStabilizerParams {
  finArea: number;              // 单侧鳍面积 (m²)
  maxFinAngle: number;          // 最大偏转角 (°)
  maxFinRate: number;           // 最大偏转率 (°/s)
  liftCoefficientSlope: number; // 升力系数斜率 (/rad)
  armLength: number;            // 力臂 (m)
  efficiency: number;           // 效率系数
  seawaterDensity: number;      // 海水密度 (kg/m³)
  maxPower: number;             // 最大功率 (kW)
}

// ============ 默认参数 ============

/** 默认减摇鳍参数 (爱达·魔都号配置) */
export const DEFAULT_FIN_PARAMS: FinStabilizerParams = {
  finArea: FIN_STABILIZER_PARAMS.FIN_AREA,
  maxFinAngle: FIN_STABILIZER_PARAMS.MAX_FIN_ANGLE,
  maxFinRate: FIN_STABILIZER_PARAMS.MAX_FIN_RATE,
  liftCoefficientSlope: FIN_STABILIZER_PARAMS.LIFT_COEFFICIENT_SLOPE,
  armLength: FIN_STABILIZER_PARAMS.ARM_LENGTH,
  efficiency: FIN_STABILIZER_PARAMS.EFFICIENCY,
  seawaterDensity: 1025,  // 标准海水密度
  maxPower: FIN_STABILIZER_PARAMS.MAX_POWER,
};

// ============ 状态初始化 ============

/**
 * 创建初始减摇鳍状态
 */
export function createFinStabilizerState(
  enabled: boolean = true
): FinStabilizerState {
  return {
    portFinAngleDeg: 0,
    starboardFinAngleDeg: 0,
    portLiftForce: 0,
    starboardLiftForce: 0,
    antiRollMoment: 0,
    powerConsumption: 0,
    enabled,
  };
}

// ============ 核心物理计算 ============

/**
 * 计算单个鳍的升力
 *
 * L = 0.5 * ρ * V² * A * CL_α * δ
 *
 * @param finAngleDeg 鳍偏转角 (°)
 * @param shipSpeedMps 船速 (m/s)
 * @param params 鳍参数
 * @returns 升力 (N)
 */
export function computeFinLiftForce(
  finAngleDeg: number,
  shipSpeedMps: number,
  params: FinStabilizerParams = DEFAULT_FIN_PARAMS
): number {
  // 速度平方项 (动压)
  const dynamicPressure = 0.5 * params.seawaterDensity * shipSpeedMps * shipSpeedMps;

  // 升力计算
  const finAngleRad = toRadians(finAngleDeg);
  const liftForce = dynamicPressure * params.finArea * params.liftCoefficientSlope * finAngleRad;

  return liftForce;
}

/**
 * 计算减摇鳍产生的抗横摇力矩
 *
 * 左右鳍协调工作，产生相同方向的力矩
 *
 * M_roll = 2 * L_fin * arm * η
 *
 * @param portAngleDeg 左舷鳍角度 (°), 正值向下
 * @param starboardAngleDeg 右舷鳍角度 (°), 正值向下
 * @param shipSpeedMps 船速 (m/s)
 * @param rollAngleRad 当前横摇角 (rad)
 * @param params 鳍参数
 */
export function computeAntiRollMoment(
  portAngleDeg: number,
  starboardAngleDeg: number,
  shipSpeedMps: number,
  rollAngleRad: number = 0,
  params: FinStabilizerParams = DEFAULT_FIN_PARAMS
): {
  portLift: number;
  starboardLift: number;
  totalMoment: number;
} {
  // 计算左右鳍升力
  const portLift = computeFinLiftForce(portAngleDeg, shipSpeedMps, params);
  const starboardLift = computeFinLiftForce(starboardAngleDeg, shipSpeedMps, params);

  // 横摇角修正因子 (大角度时效率降低)
  const rollCorrectionFactor = Math.cos(rollAngleRad);

  // 左右鳍配合产生同向力矩
  // 左鳍向下 (正角度) + 右鳍向上 (负角度) → 向右舷的恢复力矩
  // 抗横摇力矩 = (左鳍升力 - 右鳍升力) * 力臂 * 效率
  const totalMoment =
    (portLift - starboardLift) *
    params.armLength *
    params.efficiency *
    rollCorrectionFactor;

  return {
    portLift,
    starboardLift,
    totalMoment,
  };
}

/**
 * 计算减摇鳍功率消耗
 *
 * 功率主要消耗在克服水动力阻力和驱动液压系统
 *
 * @param portAngleDeg 左舷鳍角度 (°)
 * @param starboardAngleDeg 右舷鳍角度 (°)
 * @param finRateDeg 鳍偏转速率 (°/s)
 * @param shipSpeedMps 船速 (m/s)
 * @param params 鳍参数
 */
export function computeFinPowerConsumption(
  portAngleDeg: number,
  starboardAngleDeg: number,
  finRateDeg: number,
  shipSpeedMps: number,
  params: FinStabilizerParams = DEFAULT_FIN_PARAMS
): number {
  // 静态功率 (维持鳍角)
  const avgAngle = (Math.abs(portAngleDeg) + Math.abs(starboardAngleDeg)) / 2;
  const staticPower = (avgAngle / params.maxFinAngle) * 50; // 基础 50 kW

  // 动态功率 (偏转速率相关)
  const rateRatio = Math.abs(finRateDeg) / params.maxFinRate;
  const dynamicPower = rateRatio * 100; // 最大额外 100 kW

  // 速度相关功率 (高速时水动力载荷大)
  const speedRatio = shipSpeedMps / CRUISE_ADORA_PARAMS.MAX_SPEED;
  const speedPower = speedRatio * speedRatio * 150; // 速度平方关系，最大 150 kW

  const totalPower = staticPower + dynamicPower + speedPower;

  return clamp(totalPower, 0, params.maxPower);
}

// ============ 鳍角速率限制 ============

/**
 * 应用鳍角速率限制
 *
 * @param currentAngle 当前鳍角 (°)
 * @param targetAngle 目标鳍角 (°)
 * @param dt 时间步长 (s)
 * @param params 鳍参数
 */
export function applyFinRateLimit(
  currentAngle: number,
  targetAngle: number,
  dt: number,
  params: FinStabilizerParams = DEFAULT_FIN_PARAMS
): number {
  const maxChange = params.maxFinRate * dt;
  const desiredChange = targetAngle - currentAngle;

  // 限制变化率
  const actualChange = clamp(desiredChange, -maxChange, maxChange);
  const newAngle = currentAngle + actualChange;

  // 限制最大角度
  return clamp(newAngle, -params.maxFinAngle, params.maxFinAngle);
}

// ============ 控制策略 ============

/**
 * 简单 P 控制策略
 *
 * 根据横摇角速度产生反向力矩
 *
 * @param rollRateDegPerSec 横摇角速度 (°/s)
 * @param gain 控制增益
 * @param params 鳍参数
 */
export function simpleRollRateControl(
  rollRateDegPerSec: number,
  gain: number = 2.0,
  params: FinStabilizerParams = DEFAULT_FIN_PARAMS
): {
  portAngle: number;
  starboardAngle: number;
} {
  // P 控制: 鳍角与横摇角速度反向
  const controlAngle = -gain * rollRateDegPerSec;
  const clampedAngle = clamp(controlAngle, -params.maxFinAngle, params.maxFinAngle);

  // 左右鳍协调: 左鳍正，右鳍负 (或相反)
  return {
    portAngle: clampedAngle,
    starboardAngle: -clampedAngle,
  };
}

/**
 * PD 控制策略
 *
 * 同时考虑横摇角和横摇角速度
 *
 * @param rollDeg 横摇角 (°)
 * @param rollRateDegPerSec 横摇角速度 (°/s)
 * @param kp 比例增益
 * @param kd 微分增益
 * @param params 鳍参数
 */
export function pdRollControl(
  rollDeg: number,
  rollRateDegPerSec: number,
  kp: number = 1.0,
  kd: number = 2.0,
  params: FinStabilizerParams = DEFAULT_FIN_PARAMS
): {
  portAngle: number;
  starboardAngle: number;
} {
  // PD 控制
  const controlAngle = -kp * rollDeg - kd * rollRateDegPerSec;
  const clampedAngle = clamp(controlAngle, -params.maxFinAngle, params.maxFinAngle);

  return {
    portAngle: clampedAngle,
    starboardAngle: -clampedAngle,
  };
}

/**
 * 带频率加权的控制策略
 *
 * 针对致晕频段 (0.1-0.3 Hz) 增强抑制
 *
 * @param rollDeg 横摇角 (°)
 * @param rollRateDegPerSec 横摇角速度 (°/s)
 * @param rollAccelDegPerSec2 横摇角加速度 (°/s²)
 * @param params 鳍参数
 */
export function frequencyWeightedControl(
  rollDeg: number,
  rollRateDegPerSec: number,
  rollAccelDegPerSec2: number,
  params: FinStabilizerParams = DEFAULT_FIN_PARAMS
): {
  portAngle: number;
  starboardAngle: number;
} {
  // 致晕频段 0.1-0.3 Hz (周期 3.3-10s)
  // 对角速度的响应增强 (角速度代表频率信息)

  const kp = 0.8;
  const kd = 2.5;    // 增强角速度响应
  const ka = 0.3;    // 加速度反馈

  const controlAngle = -kp * rollDeg - kd * rollRateDegPerSec - ka * rollAccelDegPerSec2;
  const clampedAngle = clamp(controlAngle, -params.maxFinAngle, params.maxFinAngle);

  return {
    portAngle: clampedAngle,
    starboardAngle: -clampedAngle,
  };
}

// ============ 状态步进 ============

/**
 * 减摇鳍状态步进
 *
 * @param state 当前状态
 * @param targetPortAngle 目标左舷鳍角 (°)
 * @param targetStarboardAngle 目标右舷鳍角 (°)
 * @param shipSpeedMps 船速 (m/s)
 * @param rollAngleRad 当前横摇角 (rad)
 * @param dt 时间步长 (s)
 * @param params 鳍参数
 */
export function finStabilizerStep(
  state: FinStabilizerState,
  targetPortAngle: number,
  targetStarboardAngle: number,
  shipSpeedMps: number,
  rollAngleRad: number,
  dt: number,
  params: FinStabilizerParams = DEFAULT_FIN_PARAMS
): FinStabilizerState {
  // 如果未启用，返回零状态
  if (!state.enabled) {
    return {
      ...state,
      portFinAngleDeg: 0,
      starboardFinAngleDeg: 0,
      portLiftForce: 0,
      starboardLiftForce: 0,
      antiRollMoment: 0,
      powerConsumption: 0,
    };
  }

  // 应用速率限制
  const newPortAngle = applyFinRateLimit(
    state.portFinAngleDeg,
    targetPortAngle,
    dt,
    params
  );
  const newStarboardAngle = applyFinRateLimit(
    state.starboardFinAngleDeg,
    targetStarboardAngle,
    dt,
    params
  );

  // 计算抗横摇力矩
  const { portLift, starboardLift, totalMoment } = computeAntiRollMoment(
    newPortAngle,
    newStarboardAngle,
    shipSpeedMps,
    rollAngleRad,
    params
  );

  // 计算鳍偏转速率
  const portRate = (newPortAngle - state.portFinAngleDeg) / dt;
  const starboardRate = (newStarboardAngle - state.starboardFinAngleDeg) / dt;
  const avgRate = (Math.abs(portRate) + Math.abs(starboardRate)) / 2;

  // 计算功率消耗
  const power = computeFinPowerConsumption(
    newPortAngle,
    newStarboardAngle,
    avgRate,
    shipSpeedMps,
    params
  );

  return {
    portFinAngleDeg: newPortAngle,
    starboardFinAngleDeg: newStarboardAngle,
    portLiftForce: portLift,
    starboardLiftForce: starboardLift,
    antiRollMoment: totalMoment,
    powerConsumption: power,
    enabled: state.enabled,
  };
}

// ============ 归一化力矩 ============

/**
 * 将抗横摇力矩归一化为模型输入
 *
 * 将物理力矩 (N·m) 转换为无量纲的归一化力矩
 * 用于与波浪激励力矩在同一量纲下比较
 *
 * @param antiRollMomentNm 抗横摇力矩 (N·m)
 * @param shipDisplacement 船舶排水量 (t)
 * @param shipBeam 船宽 (m)
 */
export function normalizeFinMoment(
  antiRollMomentNm: number,
  shipDisplacement: number = CRUISE_ADORA_PARAMS.DISPLACEMENT / 1000, // GT to t approx
  shipBeam: number = CRUISE_ADORA_PARAMS.BEAM
): number {
  // 归一化因子: 排水量 * 船宽 * 重力加速度
  // 典型值约 1e8 量级
  const normalizationFactor = shipDisplacement * 1000 * shipBeam * 9.81;

  return antiRollMomentNm / normalizationFactor;
}

// ============ 指标计算 ============

/**
 * 获取减摇鳍指标
 */
export function getFinStabilizerMetrics(state: FinStabilizerState): {
  avgFinAngle: number;           // 平均鳍角 (°)
  totalLiftForceKN: number;      // 总升力 (kN)
  antiRollMomentKNm: number;     // 抗横摇力矩 (kN·m)
  powerKW: number;               // 功率消耗 (kW)
  efficiencyRating: string;      // 效率评级
  isHighPower: boolean;          // 是否高功耗
} {
  const avgFinAngle = (Math.abs(state.portFinAngleDeg) + Math.abs(state.starboardFinAngleDeg)) / 2;
  const totalLiftForceKN = (Math.abs(state.portLiftForce) + Math.abs(state.starboardLiftForce)) / 1000;
  const antiRollMomentKNm = Math.abs(state.antiRollMoment) / 1000;
  const powerKW = state.powerConsumption;

  // 效率评级 (力矩/功率比)
  let efficiencyRating: string;
  if (powerKW < 10) {
    efficiencyRating = '待机';
  } else {
    const efficiency = antiRollMomentKNm / powerKW;
    if (efficiency > 50) {
      efficiencyRating = '优秀';
    } else if (efficiency > 30) {
      efficiencyRating = '良好';
    } else if (efficiency > 15) {
      efficiencyRating = '一般';
    } else {
      efficiencyRating = '较低';
    }
  }

  const isHighPower = powerKW > FIN_STABILIZER_PARAMS.MAX_POWER * 0.8;

  return {
    avgFinAngle,
    totalLiftForceKN,
    antiRollMomentKNm,
    powerKW,
    efficiencyRating,
    isHighPower,
  };
}

/**
 * 判断是否超功率
 */
export function isFinPowerExceeded(
  powerKW: number,
  threshold: number = FIN_STABILIZER_PARAMS.MAX_POWER
): boolean {
  return powerKW > threshold;
}

// ============ 减摇效果评估 ============

/**
 * 评估减摇效果
 *
 * @param rollWithoutFin 无减摇鳍时的横摇角 (°)
 * @param rollWithFin 有减摇鳍时的横摇角 (°)
 */
export function evaluateStabilizationEffect(
  rollWithoutFin: number,
  rollWithFin: number
): {
  reductionPercent: number;      // 减摇百分比
  effectivenessRating: string;   // 效果评级
  isEffective: boolean;          // 是否有效
} {
  const reductionPercent =
    rollWithoutFin > 0.1
      ? ((rollWithoutFin - rollWithFin) / rollWithoutFin) * 100
      : 0;

  let effectivenessRating: string;
  let isEffective: boolean;

  if (reductionPercent >= 70) {
    effectivenessRating = '优秀';
    isEffective = true;
  } else if (reductionPercent >= 50) {
    effectivenessRating = '良好';
    isEffective = true;
  } else if (reductionPercent >= 30) {
    effectivenessRating = '一般';
    isEffective = true;
  } else if (reductionPercent >= 10) {
    effectivenessRating = '有限';
    isEffective = false;
  } else {
    effectivenessRating = '无效';
    isEffective = false;
  }

  return {
    reductionPercent: clamp(reductionPercent, 0, 100),
    effectivenessRating,
    isEffective,
  };
}

// ============ 启用/禁用控制 ============

/**
 * 切换减摇鳍启用状态
 */
export function toggleFinStabilizer(
  state: FinStabilizerState,
  enabled: boolean
): FinStabilizerState {
  return {
    ...state,
    enabled,
  };
}

/**
 * 检查减摇鳍是否可用
 *
 * 减摇鳍在低速时效果降低
 */
export function isFinStabilizerEffective(
  shipSpeedMps: number,
  minEffectiveSpeed: number = 3.0  // 最低有效速度 ~6 节
): boolean {
  return shipSpeedMps >= minEffectiveSpeed;
}
