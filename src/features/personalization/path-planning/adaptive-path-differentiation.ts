/**
 * 候选路径两两量化区分度指标（Issue #2033）。
 *
 * 纯函数：输入一对候选的核心观测（节点、对象键、类型分布、顺序、时长、检查点），
 * 输出 7 项指标与达标计数。阈值与达标规则来自 issue 验收标准：
 * 7 项中至少 3 项达标才算高区分度。统一先修/终结验证节点由调用方预先剔除。
 */

export interface AdaptivePathDifferentiationCandidate {
  styleId: string;
  /** 有序核心节点 ID（已剔除各候选共享的先修与终结验证节点）。 */
  coreNodeIds: string[];
  /** 核心 OSS 对象键（去重）。 */
  coreObjectKeys: string[];
  /** 核心资源类型分布（类型 → 占比，和为 1；空资源集为空对象）。 */
  resourceTypeShares: Record<string, number>;
  /** 预计学习时长（分钟）。 */
  estimatedMinutes: number;
  /** 检查点结构签名：按出现顺序的 `terminal` 与带位置桶的 `inline-*` 序列。 */
  checkpointSignature: string[];
  /** 核心资源中存在可验证的 Runtime 对象键资源（无则候选无法提供读取证明）。 */
  hasVerifiableRuntimeResource?: boolean;
}

export interface AdaptivePathPairDifferentiationMetrics {
  coreNodeJaccard: number;
  objectKeyJaccard: number;
  resourceTypeTotalVariation: number;
  sharedNodeOrderDifference: number;
  estimatedMinutesDeltaRatio: number;
  checkpointStructuralDifference: boolean;
  distinctCoreNodeCount: number;
  satisfiedCount: number;
  satisfiedRules: string[];
}

export interface AdaptivePathDifferentiationThresholds {
  coreNodeJaccard: number;
  objectKeyJaccard: number;
  resourceTypeTotalVariation: number;
  sharedNodeOrderDifference: number;
  estimatedMinutesDeltaRatio: number;
  distinctCoreNodeCount: number;
  minSatisfiedCount: number;
}

export const ADAPTIVE_PATH_DIFFERENTIATION_THRESHOLDS: AdaptivePathDifferentiationThresholds = {
  coreNodeJaccard: 0.4,
  objectKeyJaccard: 0.4,
  resourceTypeTotalVariation: 0.3,
  sharedNodeOrderDifference: 0.3,
  estimatedMinutesDeltaRatio: 0.2,
  distinctCoreNodeCount: 2,
  minSatisfiedCount: 3,
};

function jaccardDistance(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : 1 - intersection / union;
}

function totalVariationDistance(
  left: Record<string, number>,
  right: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let distance = 0;
  for (const key of keys) distance += Math.abs((left[key] ?? 0) - (right[key] ?? 0));
  return distance / 2;
}

/**
 * 共有节点顺序差异（#2033 复审修复）：先把两侧投影为共有节点序列，再比较
 * 其相对排列（逆序对比例，归一到 [0,1]）。独有节点在前后移动不再伪造顺序差异；
 * 仅有单个共有节点或相对次序完全一致时为 0。
 */
function sharedNodeOrderDifference(
  left: string[],
  right: string[],
): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const leftShared = left.filter((nodeId) => rightSet.has(nodeId));
  if (leftShared.length < 2) return 0;
  const rightShared = right.filter((nodeId) => leftSet.has(nodeId));
  const rightRank = new Map(rightShared.map((nodeId, index) => [nodeId, index]));
  let inversions = 0;
  for (let i = 0; i < leftShared.length; i += 1) {
    for (let j = i + 1; j < leftShared.length; j += 1) {
      if ((rightRank.get(leftShared[i]) ?? 0) > (rightRank.get(leftShared[j]) ?? 0)) inversions += 1;
    }
  }
  const totalPairs = (leftShared.length * (leftShared.length - 1)) / 2;
  return totalPairs === 0 ? 0 : inversions / totalPairs;
}

function checkpointStructuralDifference(
  left: string[],
  right: string[],
): boolean {
  if (left.length !== right.length) return true;
  const normalize = (values: string[]) => {
    // inline 带归一化位置桶（inline-head / inline-tail），只比较桶类型。
    const inline = values.filter((value) => value.startsWith('inline')).length;
    const terminal = values.filter((value) => value.startsWith('terminal')).length;
    // 相对位置：终结验证是否收尾、内联检查点是否出现在前半程。
    const tailTerminal = values[values.length - 1]?.startsWith('terminal') ?? false;
    return { inline, terminal, tailTerminal };
  };
  const leftShape = normalize(left);
  const rightShape = normalize(right);
  if (leftShape.inline !== rightShape.inline || leftShape.terminal !== rightShape.terminal) return true;
  if (leftShape.tailTerminal !== rightShape.tailTerminal) return true;
  // 位置桶本身参与逐位比较：同数 inline 检查点安排在前半程 vs 后半程也是结构差异。
  return left.some((value, index) => value !== right[index]
    && (value.startsWith('terminal') || right[index].startsWith('terminal')
      || value.startsWith('inline') || right[index].startsWith('inline')));
}

export function computeAdaptivePathPairDifferentiation(
  left: AdaptivePathDifferentiationCandidate,
  right: AdaptivePathDifferentiationCandidate,
  thresholds: AdaptivePathDifferentiationThresholds = ADAPTIVE_PATH_DIFFERENTIATION_THRESHOLDS,
): AdaptivePathPairDifferentiationMetrics {
  const coreNodeJaccard = jaccardDistance(new Set(left.coreNodeIds), new Set(right.coreNodeIds));
  const objectKeyJaccard = jaccardDistance(new Set(left.coreObjectKeys), new Set(right.coreObjectKeys));
  const resourceTypeTotalVariation = totalVariationDistance(left.resourceTypeShares, right.resourceTypeShares);
  const sharedNodeOrderDifferenceValue = sharedNodeOrderDifference(left.coreNodeIds, right.coreNodeIds);
  const maxMinutes = Math.max(left.estimatedMinutes, right.estimatedMinutes, 1);
  const estimatedMinutesDeltaRatio = Math.abs(left.estimatedMinutes - right.estimatedMinutes) / maxMinutes;
  const checkpointStructuralDifferenceValue = checkpointStructuralDifference(left.checkpointSignature, right.checkpointSignature);
  const distinctCoreNodeCount = new Set([
    ...left.coreNodeIds.filter((nodeId) => !right.coreNodeIds.includes(nodeId)),
    ...right.coreNodeIds.filter((nodeId) => !left.coreNodeIds.includes(nodeId)),
  ]).size;

  const rules: string[] = [];
  if (coreNodeJaccard >= thresholds.coreNodeJaccard) rules.push('core-node-jaccard');
  if (objectKeyJaccard >= thresholds.objectKeyJaccard) rules.push('object-key-jaccard');
  if (resourceTypeTotalVariation >= thresholds.resourceTypeTotalVariation) rules.push('resource-type-tvd');
  if (sharedNodeOrderDifferenceValue >= thresholds.sharedNodeOrderDifference) rules.push('shared-node-order');
  if (estimatedMinutesDeltaRatio >= thresholds.estimatedMinutesDeltaRatio) rules.push('estimated-minutes-delta');
  if (checkpointStructuralDifferenceValue) rules.push('checkpoint-structure');
  if (distinctCoreNodeCount >= thresholds.distinctCoreNodeCount) rules.push('distinct-core-nodes');

  return {
    coreNodeJaccard,
    objectKeyJaccard,
    resourceTypeTotalVariation,
    sharedNodeOrderDifference: sharedNodeOrderDifferenceValue,
    estimatedMinutesDeltaRatio,
    checkpointStructuralDifference: checkpointStructuralDifferenceValue,
    distinctCoreNodeCount,
    satisfiedCount: rules.length,
    satisfiedRules: rules,
  };
}

/** 族→策略映射（#2033）：三族候选分别承载三种学习策略。 */
export const ADAPTIVE_PATH_STRATEGY_BY_FAMILY: Record<string, {
  strategyId: 'weakness-repair' | 'preference-reinforce' | 'strength-transfer';
  name: string;
}> = {
  'foundation-remediation': { strategyId: 'weakness-repair', name: '薄弱点补强' },
  'preference-matched': { strategyId: 'preference-reinforce', name: '偏好资源强化' },
  'simulation-driven': { strategyId: 'strength-transfer', name: '优势迁移应用' },
};

export interface AdaptivePathStrategyMetadata {
  family: string;
  strategyId: string;
  name: string;
  /** 驱动该策略的画像缺口/偏好/优势标识；画像不可用时为空数组。 */
  portraitBasis: string[];
  /** 画像不可用/证据不足时候选为通用策略，不得声称个性化。 */
  generic: boolean;
}
