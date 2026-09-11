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
  /** 偏好配额未达 60% 可观察占比（资源/预算不足），偏好强化未兑现。 */
  preferenceQuotaUnmet: boolean;
}

export interface AdaptivePathBatchComparisonView {
  highDifferentiation: boolean;
  /** 任一候选核心资源被全部剔除（资源不足/验证失败），偏好/区分度不得声称兑现。 */
  insufficientVerifiedResources: boolean;
  insufficientCandidateDiversity: boolean;
  planningSnapshot: {
    indexId: string | null;
    runtimeReleaseId: string | null;
    recommendableCount: number;
  } | null;
  pairs: Array<{
    leftStyleId: string;
    rightStyleId: string;
    satisfiedCount: number;
    summary: string;
  }>;
  resourceReadiness: Array<{
    styleId: string;
    verifiedResources: number;
    indexedResources?: number;
    unreadableResources: number;
    /** 按失败类型区分的学生可理解说明（不暴露对象键原文）。 */
    notes: string[];
    /** 逐资源状态（节点标识/资源标识/状态/冻结的 Runtime release），含 verified。 */
    items: Array<{
      nodeId: string;
      resourceId: string;
      state: string;
      runtimeReleaseId: string | null;
    }>;
  }>;
  /** 逐节点 Runtime 资源绑定状态与失败原因（#2055），不含对象键原文。 */
  runtimeBindings: Array<{
    styleId: string;
    boundResources: number;
    unboundResources: number;
    notes: string[];
    items: Array<{
      nodeId: string;
      resourceId: string | null;
      state: string;
      reason: string | null;
    }>;
  }>;
}

/** 批次 metadata 中不得下发给学生 API 消费方的内部字段。 */
const INTERNAL_METADATA_KEYS = new Set([
  'differentiation',
  'objectKeyReadRecords',
  'runtimeResourceBindings',
  'planningResourceSnapshot',
]);

/** 返回剥离内部字段后的批次 metadata 副本（学生安全 API 面）。 */
export function stripInternalBatchMetadata(metadata: unknown): Record<string, unknown> {
  const source = record(metadata);
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !INTERNAL_METADATA_KEYS.has(key)),
  );
}

const UNREADABLE_STATE_NOTES: Record<string, string> = {
  missing: '个资源在当前课程资源库中暂时缺失',
  forbidden: '个资源暂无访问权限',
  'checksum-mismatch': '个资源内容校验未通过（可能与缓存不一致）',
  unverified: '个资源未能完成读取验证',
};

const UNBOUND_STATE_NOTES: Record<string, string> = {
  'no-runtime-identity': '个资源暂无 Runtime 资源身份，无法绑定课程资源库发布',
  'not-in-active-release': '个资源未包含在当前课程资源发布中',
  'no-active-release': '个资源因当前没有活动的课程资源发布而无法绑定',
};

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
    preferenceQuotaUnmet: strategy.preferenceQuotaUnmet === true,
  };
}

export function batchHasInsufficientCandidateDiversity(batch: {
  comparison?: { insufficientCandidateDiversity?: boolean } | null;
  metadata?: unknown;
} | null): boolean {
  if (!batch) return false;
  if (batch.comparison?.insufficientCandidateDiversity === true) return true;
  const limitations = record(batch.metadata).diversityLimitations;
  return Array.isArray(limitations)
    && limitations.some((item) => item === 'insufficient-candidate-diversity');
}

export function selectVisibleAdaptivePathOptions<T>(
  batch: Parameters<typeof batchHasInsufficientCandidateDiversity>[0],
  batchOptions: T[],
  fallbackOptions: T[],
): T[] {
  if (batchHasInsufficientCandidateDiversity(batch)) return [];
  return batchOptions.length > 0 ? batchOptions : fallbackOptions;
}

export function resolveAdaptivePathToolGenerationStatus(input: {
  noMaterialDifference: boolean;
  insufficientCandidateDiversity: boolean;
  hasPersistedOutput: boolean;
}): 'no_material_difference' | 'persisted' | 'blocked' {
  if (input.noMaterialDifference) return 'no_material_difference';
  if (input.insufficientCandidateDiversity || !input.hasPersistedOutput) return 'blocked';
  return 'persisted';
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
  const resourceReadiness = new Map<string, {
    verified: number;
    indexed: number;
    unreadableByState: Map<string, number>;
    items: Array<{ nodeId: string; resourceId: string; state: string; runtimeReleaseId: string | null }>;
  }>();
  for (const value of Array.isArray(source.objectKeyReadRecords) ? source.objectKeyReadRecords : []) {
    const item = record(value);
    const styleId = typeof item.candidateStyleId === 'string' ? item.candidateStyleId : null;
    const state = typeof item.state === 'string' ? item.state : null;
    if (!styleId || !state) continue;
    const counts = resourceReadiness.get(styleId)
      ?? { verified: 0, indexed: 0, unreadableByState: new Map<string, number>(), items: [] };
    if (state === 'verified') counts.verified += 1;
    else if (state === 'index-verified') counts.indexed += 1;
    else counts.unreadableByState.set(state, (counts.unreadableByState.get(state) ?? 0) + 1);
    // verified 与失败状态都投影逐资源条目：正常候选同样并列呈现 OSS 读取状态与来源。
    counts.items.push({
      nodeId: typeof item.nodeNodeId === 'string' ? item.nodeNodeId : 'unknown-node',
      resourceId: typeof item.resourceId === 'string' ? item.resourceId : 'unknown-resource',
      state,
      runtimeReleaseId: typeof item.runtimeReleaseId === 'string' ? item.runtimeReleaseId : null,
    });
    resourceReadiness.set(styleId, counts);
  }
  const runtimeBindings = buildRuntimeBindingsView(source);
  const snapshot = record(source.planningResourceSnapshot);
  const hardDiversity = record(differentiation.hardDiversity);
  const limitations = Array.isArray(source.diversityLimitations)
    ? source.diversityLimitations.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    highDifferentiation: differentiation.highDifferentiation === true,
    insufficientVerifiedResources: differentiation.insufficientVerifiedResources === true,
    insufficientCandidateDiversity: limitations.includes('insufficient-candidate-diversity')
      || (typeof hardDiversity.passed === 'boolean' && hardDiversity.passed === false),
    planningSnapshot: typeof snapshot.indexId === 'string'
      ? {
          indexId: snapshot.indexId,
          runtimeReleaseId: typeof snapshot.runtimeReleaseId === 'string' ? snapshot.runtimeReleaseId : null,
          recommendableCount: Array.isArray(snapshot.recommendable) ? snapshot.recommendable.length : 0,
        }
      : null,
    pairs,
    resourceReadiness: [...resourceReadiness.entries()].map(([styleId, counts]) => {
      const notes = [...counts.unreadableByState.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .filter(([state, count]) => count > 0 && UNREADABLE_STATE_NOTES[state])
        .map(([state, count]) => `这条路径有 ${count} ${UNREADABLE_STATE_NOTES[state]}，已不计入方案对比。`);
      return {
        styleId,
        verifiedResources: counts.verified,
        ...(counts.indexed > 0 ? { indexedResources: counts.indexed } : {}),
        unreadableResources: [...counts.unreadableByState.values()].reduce((sum, count) => sum + count, 0),
        notes: counts.indexed > 0 ? [...notes, `已确认 ${counts.indexed} 项资源入口，打开时检查内容。`] : notes,
        items: counts.items,
      };
    }),
    runtimeBindings,
  };
}

/** 逐节点绑定状态投影（#2055）：只保留节点/资源身份、状态与原因，不下发对象键。 */
function buildRuntimeBindingsView(source: Record<string, unknown>): AdaptivePathBatchComparisonView['runtimeBindings'] {
  const byStyle = new Map<string, {
    bound: number;
    unboundByState: Map<string, number>;
    items: Array<{ nodeId: string; resourceId: string | null; state: string; reason: string | null }>;
  }>();
  for (const value of Array.isArray(source.runtimeResourceBindings) ? source.runtimeResourceBindings : []) {
    const binding = record(value);
    const nodeId = typeof binding.nodeId === 'string' ? binding.nodeId : null;
    const state = typeof binding.state === 'string' ? binding.state : null;
    if (!nodeId || !state) continue;
    const styleIds = Array.isArray(binding.candidateStyleIds)
      && binding.candidateStyleIds.every((item) => typeof item === 'string')
      ? binding.candidateStyleIds as string[]
      : [];
    const item = {
      nodeId,
      resourceId: typeof binding.resourceId === 'string' ? binding.resourceId : null,
      state,
      reason: typeof binding.reason === 'string' ? binding.reason : null,
    };
    for (const styleId of styleIds.length > 0 ? styleIds : [null]) {
      const counts = byStyle.get(styleId ?? '')
        ?? { bound: 0, unboundByState: new Map<string, number>(), items: [] };
      if (state === 'bound') counts.bound += 1;
      else counts.unboundByState.set(state, (counts.unboundByState.get(state) ?? 0) + 1);
      counts.items.push(item);
      byStyle.set(styleId ?? '', counts);
    }
  }
  return [...byStyle.entries()].map(([styleId, counts]) => ({
    styleId,
    boundResources: counts.bound,
    unboundResources: [...counts.unboundByState.values()].reduce((sum, count) => sum + count, 0),
    notes: [...counts.unboundByState.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .filter(([state, count]) => count > 0 && UNBOUND_STATE_NOTES[state])
      .map(([state, count]) => `这条路径有 ${count} ${UNBOUND_STATE_NOTES[state]}。`),
    items: counts.items,
  }));
}
