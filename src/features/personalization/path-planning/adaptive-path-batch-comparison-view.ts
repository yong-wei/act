/**
 * 候选批次比较的学生安全投影（Issue #2033）。
 *
 * 纯函数、无服务端依赖：konling 工具响应、候选批次 API 消费方（页面）与
 * 个人中心合约共用同一投影，保证持久化批次与瞬时响应呈现一致。
 * 不下发指标原始数值、规则名与对象键原文；画像不可用（generic）时不声称个性化。
 */

export interface AdaptivePathStrategyView {
  strategyId: string;
  name: string;
  portraitBasis: string[];
  generic: boolean;
}

export interface AdaptivePathBatchComparisonView {
  highDifferentiation: boolean;
  pairs: Array<{
    leftStyleId: string;
    rightStyleId: string;
    satisfiedCount: number;
    summary: string;
  }>;
  resourceReadiness: Array<{
    styleId: string;
    verifiedResources: number;
    unreadableResources: number;
    summary: string | null;
  }>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function buildAdaptivePathStrategyView(value: unknown): AdaptivePathStrategyView | null {
  if (!value || typeof value !== 'object') return null;
  const strategy = record(value);
  const strategyId = typeof strategy.strategyId === 'string' ? strategy.strategyId : null;
  const name = typeof strategy.name === 'string' ? strategy.name : null;
  if (!strategyId || !name) return null;
  const generic = strategy.generic === true;
  return {
    strategyId,
    name,
    // 画像不可用时如实标记通用策略，画像依据不下发。
    portraitBasis: generic
      ? []
      : Array.isArray(strategy.portraitBasis)
        ? strategy.portraitBasis.filter((item): item is string => typeof item === 'string')
        : [],
    generic,
  };
}

export function buildAdaptivePathBatchComparisonView(metadata: unknown): AdaptivePathBatchComparisonView {
  const source = record(metadata);
  const differentiation = record(source.differentiation);
  const pairs = Array.isArray(differentiation.pairs)
    ? differentiation.pairs.flatMap((value) => {
        const pair = record(value);
        const leftStyleId = typeof pair.leftStyleId === 'string' ? pair.leftStyleId : null;
        const rightStyleId = typeof pair.rightStyleId === 'string' ? pair.rightStyleId : null;
        const metrics = record(pair.metrics);
        const satisfiedCount = typeof metrics.satisfiedCount === 'number' && Number.isFinite(metrics.satisfiedCount)
          ? metrics.satisfiedCount
          : null;
        if (!leftStyleId || !rightStyleId || satisfiedCount === null) return [];
        return [{
          leftStyleId,
          rightStyleId,
          satisfiedCount,
          summary: satisfiedCount >= 3
            ? '这两条路径在资源构成与学习安排上有明显差异。'
            : '这两条路径较为接近，可结合课程内容自行选择。',
        }];
      })
    : [];
  const resourceReadiness = new Map<string, { verified: number; unreadable: number }>();
  for (const value of Array.isArray(source.objectKeyReadRecords) ? source.objectKeyReadRecords : []) {
    const item = record(value);
    const styleId = typeof item.candidateStyleId === 'string' ? item.candidateStyleId : null;
    const state = typeof item.state === 'string' ? item.state : null;
    if (!styleId || !state) continue;
    const counts = resourceReadiness.get(styleId) ?? { verified: 0, unreadable: 0 };
    if (state === 'verified') counts.verified += 1;
    else counts.unreadable += 1;
    resourceReadiness.set(styleId, counts);
  }
  return {
    highDifferentiation: differentiation.highDifferentiation === true,
    pairs,
    resourceReadiness: [...resourceReadiness.entries()].map(([styleId, counts]) => ({
      styleId,
      verifiedResources: counts.verified,
      unreadableResources: counts.unreadable,
      summary: counts.unreadable > 0
        ? `这条路径有 ${counts.unreadable} 个资源暂时无法读取，已不计入方案对比。`
        : null,
    })),
  };
}
