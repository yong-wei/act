/**
 * 冰阻力和破冰模型
 * 实现 Stick-Slip 粘滑效应和参数摄动
 *
 * 物理背景:
 * - 破冰船在冰区航行时，冰层的破碎是间歇性的
 * - 粘滞相 (Stick): 船舶推动冰层，阻力增大，参数 K 下降、T 上升
 * - 滑动相 (Slip): 冰层破碎，阻力骤降，参数恢复正常
 *
 * 参数摄动范围:
 * - K (转向增益): × [0.4, 1.1], 即 -60% ~ +10%
 * - T (时间常数): × [0.8, 1.4], 即 -20% ~ +40%
 */

import {
  XUELONG_ICE_PARAMS,
  randomInRange,
} from '../../core/constants';
import type { RandomNumberGenerator } from '../../core/seeded-rng';
import type { IceBreakingParams, IceBreakingState } from '../../core/types';

// Re-export types for convenience
export type { IceBreakingParams, IceBreakingState };

// ============ 默认参数 ============

/** 默认冰阻力参数 */
export const DEFAULT_ICE_BREAKING_PARAMS: IceBreakingParams = {
  enabled: false,
  iceThickness: 1.0,                   // m
  iceDensity: XUELONG_ICE_PARAMS.ICE_DENSITY,
  frictionCoeff: 0.3,
  kVariationMin: XUELONG_ICE_PARAMS.K_PERTURBATION_MIN,  // 0.4
  kVariationMax: XUELONG_ICE_PARAMS.K_PERTURBATION_MAX,  // 1.1
  tVariationMin: XUELONG_ICE_PARAMS.T_PERTURBATION_MIN,  // 0.8
  tVariationMax: XUELONG_ICE_PARAMS.T_PERTURBATION_MAX,  // 1.4
  stickSlipCycleMin: 2,                // s
  stickSlipCycleMax: 6,                // s
};

// ============ 状态创建 ============

/** 创建初始冰阻力状态 */
export function createIceBreakingState(
  rng: RandomNumberGenerator = Math.random
): IceBreakingState {
  return {
    inContact: false,
    stickPhase: false,
    phaseTime: 0,
    nextPhaseTime: randomInRange(2, 6, rng),
    currentK: 1.0,
    currentT: 1.0,
    resistanceForce: 0,
  };
}

// ============ 核心物理模型 ============

/**
 * 计算冰阻力
 * 经验公式: R_ice = a × h^1.5 × v^0.5
 *
 * @param iceThickness 冰厚 (m)
 * @param speed 航速 (m/s)
 * @param stickPhase 是否处于粘滞相
 * @returns 冰阻力 (N)
 */
export function computeIceResistance(
  iceThickness: number,
  speed: number,
  stickPhase: boolean
): number {
  if (iceThickness <= 0 || speed <= 0) return 0;

  const a = XUELONG_ICE_PARAMS.RESISTANCE_COEFF_A;
  const h_exp = XUELONG_ICE_PARAMS.RESISTANCE_COEFF_H;
  const v_exp = XUELONG_ICE_PARAMS.RESISTANCE_COEFF_V;

  // 基础阻力
  let resistance = a * Math.pow(iceThickness, h_exp) * Math.pow(Math.abs(speed), v_exp);

  // 粘滞相阻力增加
  if (stickPhase) {
    resistance *= 1.5;  // 粘滞相阻力增加 50%
  }

  return resistance;
}

/**
 * 计算参数摄动
 * 粘滞相: K 下降，T 上升 (船舶更迟钝)
 * 滑动相: 参数恢复正常
 */
function computePerturbation(
  stickPhase: boolean,
  params: IceBreakingParams,
  rng: RandomNumberGenerator = Math.random
): { kFactor: number; tFactor: number } {
  if (stickPhase) {
    // 粘滞相: K 下降至 [0.4, 0.7], T 上升至 [1.2, 1.4]
    return {
      kFactor: randomInRange(params.kVariationMin, 0.7, rng),
      tFactor: randomInRange(1.2, params.tVariationMax, rng),
    };
  } else {
    // 滑动相: K 略高于正常, T 略低于正常
    return {
      kFactor: randomInRange(0.9, params.kVariationMax, rng),
      tFactor: randomInRange(params.tVariationMin, 1.0, rng),
    };
  }
}

// ============ 状态更新 ============

/**
 * 更新冰阻力状态
 *
 * @param state 当前冰阻力状态
 * @param params 冰阻力参数
 * @param speed 当前航速 (m/s)
 * @param dt 时间步长 (s)
 * @returns 更新后的状态
 */
export function iceBreakingStep(
  state: IceBreakingState,
  params: IceBreakingParams,
  speed: number,
  dt: number,
  rng: RandomNumberGenerator = Math.random
): IceBreakingState {
  // 如果未启用冰区模式，返回无接触状态
  if (!params.enabled || params.iceThickness <= 0) {
    return {
      inContact: false,
      stickPhase: false,
      phaseTime: 0,
      nextPhaseTime: state.nextPhaseTime,
      currentK: 1.0,
      currentT: 1.0,
      resistanceForce: 0,
    };
  }

  // 检测是否接触冰层 (航速 > 0)
  const inContact = Math.abs(speed) > 0.1;

  if (!inContact) {
    return {
      ...state,
      inContact: false,
      resistanceForce: 0,
      currentK: 1.0,
      currentT: 1.0,
    };
  }

  // 更新相位时间
  let newPhaseTime = state.phaseTime + dt;
  let stickPhase = state.stickPhase;
  let nextPhaseTime = state.nextPhaseTime;

  // 检查是否需要切换相位
  if (newPhaseTime >= state.nextPhaseTime) {
    // 切换相位
    stickPhase = !stickPhase;
    newPhaseTime = 0;

    // 计算下一次相位切换时间
    if (stickPhase) {
      // 进入粘滞相，持续时间较长
      nextPhaseTime = randomInRange(
        XUELONG_ICE_PARAMS.STICK_DURATION_MIN,
        XUELONG_ICE_PARAMS.STICK_DURATION_MAX,
        rng
      );
    } else {
      // 进入滑动相，持续时间较短
      nextPhaseTime = randomInRange(
        XUELONG_ICE_PARAMS.SLIP_DURATION_MIN,
        XUELONG_ICE_PARAMS.SLIP_DURATION_MAX,
        rng
      );
    }
  }

  // 计算参数摄动
  const { kFactor, tFactor } = computePerturbation(stickPhase, params, rng);

  // 平滑过渡参数变化 (避免突变)
  const smoothingFactor = 0.1;
  const smoothedK = state.currentK + smoothingFactor * (kFactor - state.currentK);
  const smoothedT = state.currentT + smoothingFactor * (tFactor - state.currentT);

  // 计算冰阻力
  const resistanceForce = computeIceResistance(
    params.iceThickness,
    speed,
    stickPhase
  );

  return {
    inContact: true,
    stickPhase,
    phaseTime: newPhaseTime,
    nextPhaseTime,
    currentK: smoothedK,
    currentT: smoothedT,
    resistanceForce,
  };
}

// ============ 工具函数 ============

/**
 * 检查冰厚是否超出破冰能力
 */
export function isIceThicknessExceeded(
  iceThickness: number,
  maxThickness: number = XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS
): boolean {
  return iceThickness > maxThickness;
}

/**
 * 获取冰区安全等级
 */
export function getIceZoneSafetyLevel(
  iceThickness: number
): 'safe' | 'caution' | 'danger' {
  if (iceThickness <= 0.8) return 'safe';
  if (iceThickness <= 1.2) return 'caution';
  return 'danger';
}

/**
 * 估算破冰所需最小航速
 */
export function estimateMinBreakingSpeed(
  iceThickness: number
): number {
  // 经验公式: 冰越厚需要越高的航速
  if (iceThickness <= 0) return 0;
  return 1.5 + iceThickness * 1.0;  // 基础 1.5 m/s + 每米冰厚 1.0 m/s
}

/**
 * 计算螺旋桨应力系数 (用于伦理检测)
 */
export function computePropellerStress(
  iceThickness: number,
  speed: number,
  thrustRatio: number  // 当前推力 / 最大推力
): number {
  if (iceThickness <= 0) return 0;

  // 应力与冰厚、航速、推力都相关
  const baseStress = iceThickness / XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS;
  const speedFactor = Math.min(speed / 3.0, 1.5);  // 速度越高应力越大
  const thrustFactor = thrustRatio;

  return baseStress * speedFactor * thrustFactor;
}

/**
 * 获取冰区状态摘要 (用于 UI 显示)
 */
export function getIceBreakingSummary(state: IceBreakingState): {
  phase: string;
  phaseProgress: number;
  kPerturbation: string;
  tPerturbation: string;
  resistanceKN: number;
} {
  return {
    phase: state.stickPhase ? '粘滞 (Stick)' : '滑动 (Slip)',
    phaseProgress: state.phaseTime / state.nextPhaseTime,
    kPerturbation: `${((state.currentK - 1) * 100).toFixed(0)}%`,
    tPerturbation: `${((state.currentT - 1) * 100).toFixed(0)}%`,
    resistanceKN: state.resistanceForce / 1000,
  };
}

/**
 * 创建冰区环境配置
 */
export function createIceEnvironment(
  enabled: boolean,
  iceThickness: number = 1.0
): IceBreakingParams {
  return {
    ...DEFAULT_ICE_BREAKING_PARAMS,
    enabled,
    iceThickness,
  };
}

/**
 * 检查是否应触发冰厚警报
 */
export function shouldTriggerIceAlarm(
  iceThickness: number
): 'none' | 'warning' | 'exceeded' {
  if (iceThickness <= XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS * 0.8) {
    return 'none';
  }
  if (iceThickness <= XUELONG_ICE_PARAMS.MAX_ICE_THICKNESS) {
    return 'warning';
  }
  return 'exceeded';
}
