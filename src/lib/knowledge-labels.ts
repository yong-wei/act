export const BLOOM_LEVEL_LABELS: Record<string, string> = {
  REMEMBER: '记忆',
  UNDERSTAND: '理解',
  APPLY: '应用',
  ANALYZE: '分析',
  EVALUATE: '评价',
  CREATE: '创造',
};

export const KNOWLEDGE_DIMENSION_LABELS: Record<string, string> = {
  FACTUAL: '事实性',
  CONCEPTUAL: '概念性',
  PROCEDURAL: '程序性',
  METACOGNITIVE: '元认知',
};

export function getBloomLabel(level?: string | null) {
  if (!level) return '';
  return BLOOM_LEVEL_LABELS[level] ?? level;
}

export function getKnowledgeDimLabel(dim?: string | null) {
  if (!dim) return '';
  return KNOWLEDGE_DIMENSION_LABELS[dim] ?? dim;
}
