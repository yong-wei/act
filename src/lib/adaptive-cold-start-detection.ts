/**
 * 冷启动检测工具函数
 *
 * 判断当前学习者是否处于冷启动状态（无历史学习证据）。
 * 当 learnerState API 已就绪且证据数为 0 时判定为冷启动。
 * loading/error 或 learner state 缺失时不应误判为冷启动。
 */
export interface ColdStartDetectionInput {
  /** learner state API 加载状态 */
  learnerStateLoadState: 'idle' | 'loading' | 'ready' | 'failed';
  /** learner state 中的证据计数；缺失时必须 fail closed */
  evidenceCount: number | null | undefined;
}

/**
 * 检测是否为冷启动状态。
 *
 * 仅在 learnerStateLoadState === 'ready' 且明确存在 evidenceCount === 0 时返回 true。
 * 此条件排除了：
 * - loading 状态（loadState !== 'ready' → false）
 * - API 失败或 learner state 缺失（evidenceCount 为 null/undefined → false）
 * - 有历史记录场景（evidenceCount > 0 → false）
 */
export function isColdStartLearner(input: ColdStartDetectionInput): boolean {
  return input.learnerStateLoadState === 'ready' && input.evidenceCount === 0;
}

/**
 * 从 AdaptiveLearnerState 中提取 evidenceCount。
 * 此处仅定义提取合同，具体类型由消费方保证。
 */
export function extractColdStartEvidenceCount(
  learnerState: { evidence?: { confidence?: { evidenceCount?: number } } } | null | undefined,
): number | null {
  return learnerState?.evidence?.confidence?.evidenceCount ?? null;
}
