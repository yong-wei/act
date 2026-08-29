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
