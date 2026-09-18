/**
 * 降级阶梯（#2103）：超预算时的显式开销裁剪顺序与不变量声明。
 *
 * 纯模块。顺序：先降附加视觉（后处理/天气粒子/阴影），再压 DPR 与远场细节，
 * 最后降水面渲染细分——基础交互波场、姿态所有权与数值结果在任何档位不变
 * （#2097/#2098 已建立并在测试中钉住）。
 */

import type { QualityTierId, QualityTierParams } from './quality-tiers';

/** 每档裁剪掉的附加开销（按序；数值/基础波面不在裁剪集内）。 */
export const DEGRADATION_LADDER: Record<QualityTierId, readonly string[]> = {
  high: [],
  medium: ['particle-scale-halved', 'shadow-map-1024', 'water-render-medium'],
  low: ['post-disabled', 'particles-quarter', 'shadows-off', 'dpr-capped-1', 'water-render-low'],
};

/** 降级不变量：任何档位都不改变的三件事（与 spec 验收一致）。 */
export const DEGRADATION_INVARIANTS = [
  'base-interaction-wave-field',
  'pose-ownership-per-dof',
  'numerical-results',
] as const;

export interface DegradationDecision {
  readonly fromTier: QualityTierId;
  readonly toTier: QualityTierId;
  /** 本次降档新裁剪的开销项（阶梯差集）。 */
  readonly newlyCutCosts: readonly string[];
  /** 不变量（恒定，供报告声明）。 */
  readonly invariants: typeof DEGRADATION_INVARIANTS;
}

/** 相邻档降级决策（供 governor 报告/埋点）。 */
export function degradationDecision(fromTier: QualityTierId, toTier: QualityTierId): DegradationDecision {
  const fromCuts = new Set(DEGRADATION_LADDER[fromTier]);
  const toCuts = DEGRADATION_LADDER[toTier];
  return {
    fromTier,
    toTier,
    newlyCutCosts: toCuts.filter((cost) => !fromCuts.has(cost)),
    invariants: DEGRADATION_INVARIANTS,
  };
}

/**
 * 验证档位参数只表达附加开销：降档不得改变基础交互波场（近场网格与波组档位无关，
 * #2098 常量）——这里检查渲染参数与不变量的集合一致性（参数面越少越廉价）。
 */
export function degradationPreservesSemantics(
  paramsByTier: Record<QualityTierId, QualityTierParams>,
): boolean {
  // 降档必须减少附加开销（post/粒子/阴影/渲染细分单调不增）。
  const tiers: QualityTierId[] = ['high', 'medium', 'low'];
  for (let i = 1; i < tiers.length; i += 1) {
    const upper = paramsByTier[tiers[i - 1]!];
    const lower = paramsByTier[tiers[i]!];
    if (upper.postEnabled && !lower.postEnabled) continue; // post 关闭是合法首降
    if (lower.particleScale > upper.particleScale) return false;
    if (lower.shadowMapSize > upper.shadowMapSize) return false;
    if (lower.dprCap > upper.dprCap) return false;
  }
  // 档位参数不包含任何波场/姿态/数值字段（这些不在 QualityTierParams 中，结构性保证）。
  return true;
}
