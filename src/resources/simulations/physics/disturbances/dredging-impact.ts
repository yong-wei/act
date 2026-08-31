/**
 * 挖掘冲击扰动模型
 * 模拟挖泥船绞刀切入岩石时的突变扰动
 *
 * 扰动特征:
 * - 阶跃分量: 模拟绞刀切入硬质岩石的持续反力
 * - 脉冲分量: 模拟岩块破碎瞬间的冲击力
 * - 随机间隔: 真实作业的不确定性
 */

import { randomInRange, DREDGING_IMPACT_CONFIG } from '../../core/constants';
import type { RandomNumberGenerator } from '../../core/seeded-rng';

// ============ 类型定义 ============

/** 挖掘扰动配置 */
export interface DredgingImpactConfig {
  maxForce: number;           // 峰值力 (N)
  minInterval: number;        // 最小冲击间隔 (s)
  maxInterval: number;        // 最大冲击间隔 (s)
  decayTimeConstant: number;  // 衰减时间常数 (s)
  stepRatio: number;          // 阶跃分量比例
  impulseRatio: number;       // 脉冲分量比例
  directionVariance: number;  // 方向随机性 (rad)
}

/** 挖掘扰动状态 */
export interface DredgingImpactState {
  lastImpactTime: number;     // 上次冲击时间
  nextInterval: number;       // 下次冲击间隔
  isImpactActive: boolean;    // 是否正在冲击
  impactStartTime: number;    // 冲击开始时间
  currentForce: number;       // 当前力大小
  forceDirection: number;     // 力方向 (rad, 相对于船尾)
  impactType: 'step' | 'impulse' | 'mixed';
}

// ============ 默认配置 ============

export const DEFAULT_DREDGING_CONFIG: DredgingImpactConfig = {
  maxForce: DREDGING_IMPACT_CONFIG.MAX_FORCE,
  minInterval: DREDGING_IMPACT_CONFIG.MIN_INTERVAL,
  maxInterval: DREDGING_IMPACT_CONFIG.MAX_INTERVAL,
  decayTimeConstant: DREDGING_IMPACT_CONFIG.DECAY_TIME_CONSTANT,
  stepRatio: DREDGING_IMPACT_CONFIG.STEP_RATIO,
  impulseRatio: DREDGING_IMPACT_CONFIG.IMPULSE_RATIO,
  directionVariance: 0.3,  // ~17° 随机偏差
};

// ============ 状态管理 ============

/** 创建初始扰动状态 */
export function createDredgingImpactState(
  rng: RandomNumberGenerator = Math.random
): DredgingImpactState {
  return {
    lastImpactTime: 0,
    nextInterval: randomInRange(
      DEFAULT_DREDGING_CONFIG.minInterval,
      DEFAULT_DREDGING_CONFIG.maxInterval,
      rng
    ),
    isImpactActive: false,
    impactStartTime: 0,
    currentForce: 0,
    forceDirection: Math.PI,  // 默认向后 (船尾方向)
    impactType: 'mixed',
  };
}
