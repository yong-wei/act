export const COLD_START_DIMENSION_LIMITATION_LABELS: Record<string, string> = {
  'cold-start-mastery-insufficient': '目前还不能判断你的知识掌握情况，先按入门路径补概念。',
  'cold-start-ability-insufficient': '目前还不能判断你的学习节奏和完成稳定性。',
  'cold-start-preference-insufficient': '目前还不能判断你更适合视频、讲义还是仿真。',
  'cold-start-freshness-insufficient': '现有学习证据不足或已经过期，暂时不能据此做精细个性化。',
};

export const COLD_START_COLLECTION_ACTIVITY_COPY = {
  'short-diagnosis': {
    title: '完成短诊断',
    description: '用少量题目了解当前薄弱点，不会把未完成作答当成掌握度。',
  },
  'resource-trial': {
    title: '试学一份资源',
    description: '完整学完一份讲义、视频或知识卡片，用于了解资源偏好。',
  },
  'short-simulation': {
    title: '完成一次短仿真',
    description: '用一次完整仿真或实践任务观察完成稳定性。',
  },
} as const;

export const COLD_START_COLLECTION_IMPACT_LABELS: Record<string, string> = {
  'collection-short-diagnosis': '短诊断结果影响了后续路径的检查点安排。',
  'collection-resource-trial': '资源试学结果影响了后续路径的资源组合。',
  'collection-short-simulation': '短仿真结果影响了后续路径的学习节奏。',
};

export function studentVisibleColdStartLimitation(code: string): string | undefined {
  return COLD_START_DIMENSION_LIMITATION_LABELS[code];
}

export function studentVisibleCollectionImpact(code: string): string | undefined {
  return COLD_START_COLLECTION_IMPACT_LABELS[code];
}
