/**
 * 知识图谱标签中文映射
 */

// Bloom 认知层级
export const BLOOM_LEVEL_LABELS: Record<string, string> = {
  REMEMBER: '记忆',
  UNDERSTAND: '理解',
  APPLY: '应用',
  ANALYZE: '分析',
  EVALUATE: '评价',
  CREATE: '创造',
};

// 知识维度
export const KNOWLEDGE_DIMENSION_LABELS: Record<string, string> = {
  FACTUAL: '事实性',
  CONCEPTUAL: '概念性',
  PROCEDURAL: '程序性',
  METACOGNITIVE: '元认知',
};

// 节点类型
export const NODE_TYPE_LABELS: Record<string, string> = {
  THEORY: '控制理论',
  SCENARIO: '船舶场景',
  ETHICS: '伦理决策',
};

// 知识关系类型
export const RELATION_TYPE_LABELS: Record<string, string> = {
  prerequisite: '前置',
  provides_foundation: '前置',
  follows: '后置',
  related: '关联',
  influences: '关联',
  defines: '关联',
  implements: '关联',
  governs: '关联',
};

// 获取 Bloom 认知层级标签
export function getBloomLabel(level?: string | null) {
  if (!level) return '';
  return BLOOM_LEVEL_LABELS[level] ?? level;
}

// 获取知识维度标签
export function getKnowledgeDimLabel(dim?: string | null) {
  if (!dim) return '';
  return KNOWLEDGE_DIMENSION_LABELS[dim] ?? dim;
}

// 获取节点类型标签
export function getNodeTypeLabel(type?: string | null) {
  if (!type) return '';
  return NODE_TYPE_LABELS[type] ?? type;
}

// 获取关系类型标签
export function getRelationLabel(relation?: string | null) {
  if (!relation) return '关联';
  return RELATION_TYPE_LABELS[relation] ?? '关联';
}

// 获取关系类型的分类（用于列表显示）
export function getRelationCategory(relation?: string | null): 'prerequisite' | 'follows' | 'related' {
  if (!relation) return 'related';
  if (relation === 'prerequisite' || relation === 'provides_foundation') return 'prerequisite';
  if (relation === 'follows') return 'follows';
  return 'related';
}
