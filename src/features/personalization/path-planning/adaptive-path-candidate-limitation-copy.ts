export const CANDIDATE_DIVERSITY_LIMITATION_LABELS: Record<string, string> = {
  'title-or-score-only-duplicates-removed': '只保留实质不同的学习路径，相近文案方案已合并',
  'insufficient-distinct-resources': '当前可用资源只能形成更少的可执行路径',
  'insufficient-candidate-diversity': '当前已发布教学资源不足以形成三条可区分路径',
};

export function studentVisibleCandidateLimitation(code: string): string {
  return CANDIDATE_DIVERSITY_LIMITATION_LABELS[code] ?? code;
}
